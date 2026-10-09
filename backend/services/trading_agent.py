"""Paper-only, single-symbol Q-learning agent for the portfolio application."""
from __future__ import annotations

import json
import math
import random
import statistics
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import encryption
import models


SYMBOL = "SPY"
LOOKBACK = 20
MAX_EXPOSURE = 0.05
EXPOSURE_STEP = 0.01
MAX_ORDER_NOTIONAL = 100.0
MIN_ORDER_NOTIONAL = 5.0
TURNOVER_COST = 0.0005
ACTION_NAMES = {0: "reduce", 1: "hold", 2: "increase"}
ACTION_DELTAS = (-EXPOSURE_STEP, 0.0, EXPOSURE_STEP)
EASTERN = ZoneInfo("America/New_York")


def ensure_profile(db: Session, user_id: int) -> models.AgentProfile:
    profile = db.query(models.AgentProfile).filter(models.AgentProfile.user_id == user_id).first()
    if profile:
        return profile
    profile = models.AgentProfile(user_id=user_id)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def _credential(db: Session, user_id: int) -> models.BrokerCredential:
    credential = (
        db.query(models.BrokerCredential)
        .filter(
            models.BrokerCredential.user_id == user_id,
            models.BrokerCredential.broker_name == "Alpaca",
        )
        .order_by(models.BrokerCredential.id.asc())
        .first()
    )
    if not credential:
        raise HTTPException(status_code=409, detail="Link an Alpaca account before using the paper agent.")
    return credential


def _alpaca_clients(db: Session, user_id: int):
    credential = _credential(db, user_id)
    try:
        secret = encryption.decrypt(credential.encrypted_secret)
        from alpaca.data.enums import DataFeed
        from alpaca.data.historical import StockHistoricalDataClient
        from alpaca.trading.client import TradingClient

        data_client = StockHistoricalDataClient(credential.api_key, secret)
        # Paper mode is fixed here; this module has no live-trading path.
        trading_client = TradingClient(credential.api_key, secret, paper=True)
        return data_client, trading_client, DataFeed
    except HTTPException:
        raise
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="Install the backend requirements to use the trading agent.") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not initialize Alpaca paper clients ({type(exc).__name__}).") from exc


def _fetch_bars(data_client, feed, start: datetime, end: datetime) -> list[dict[str, Any]]:
    try:
        from alpaca.data.requests import StockBarsRequest
        from alpaca.data.timeframe import TimeFrame

        request = StockBarsRequest(
            symbol_or_symbols=SYMBOL,
            timeframe=TimeFrame.Day,
            start=start,
            end=end,
            feed=feed,
        )
        frame = data_client.get_stock_bars(request).df
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Alpaca daily data request failed ({type(exc).__name__}).") from exc

    if frame is None or frame.empty:
        raise HTTPException(status_code=502, detail=f"Alpaca returned no daily bars for {SYMBOL}.")
    if getattr(frame.index, "nlevels", 1) > 1:
        try:
            frame = frame.xs(SYMBOL, level="symbol")
        except (KeyError, ValueError):
            frame = frame.xs(SYMBOL, level=0)

    bars: list[dict[str, Any]] = []
    for timestamp, close in frame.sort_index()["close"].dropna().items():
        value = float(close)
        if not math.isfinite(value) or value <= 0:
            continue
        bar_date = timestamp.date().isoformat() if hasattr(timestamp, "date") else str(timestamp)[:10]
        bars.append({"date": bar_date, "close": value})
    if len(bars) < LOOKBACK + 3:
        raise HTTPException(status_code=422, detail="At least 23 valid daily SPY bars are required.")
    return bars


def _market_bars(data_client, feed, days: int) -> list[dict[str, Any]]:
    # Keep the most recent daily bar complete by ending before the current UTC date.
    end = datetime.now(timezone.utc) - timedelta(hours=12)
    return _fetch_bars(data_client, feed.IEX, end - timedelta(days=days), end)


def _state_key(closes: list[float], exposure: float) -> str:
    if len(closes) < LOOKBACK + 1:
        raise ValueError("Insufficient prices to make an agent observation.")
    returns = [closes[i] / closes[i - 1] - 1.0 for i in range(len(closes) - 20, len(closes))]
    r1 = closes[-1] / closes[-2] - 1.0
    r5 = closes[-1] / closes[-6] - 1.0
    r20 = closes[-1] / closes[-21] - 1.0
    vol = statistics.pstdev(returns)

    def bucket(value: float, low: float, high: float) -> int:
        return 0 if value < low else 1 if value < high else 2

    exposure_bin = min(4, max(0, int(round(exposure / MAX_EXPOSURE * 4))))
    bins = (
        bucket(r1, -0.01, 0.01),
        bucket(r5, -0.025, 0.025),
        bucket(r20, -0.06, 0.06),
        bucket(vol, 0.012, 0.03),
        exposure_bin,
    )
    return ",".join(str(value) for value in bins)


def _q_values(q_table: dict[str, list[float]], state: str) -> list[float]:
    values = q_table.get(state)
    if not isinstance(values, list) or len(values) != 3:
        return [0.0, 0.0, 0.0]
    return [float(value) for value in values]


def _select_action(q_table: dict[str, list[float]], state: str, rng: random.Random, epsilon: float = 0.0) -> int:
    if rng.random() < epsilon:
        return rng.randrange(3)
    values = _q_values(q_table, state)
    best = max(values)
    choices = [index for index, value in enumerate(values) if value == best]
    # Tie-break toward holding rather than creating turnover.
    return 1 if 1 in choices else choices[0]


def _update_q(
    q_table: dict[str, list[float]],
    state: str,
    action: int,
    reward: float,
    next_state: str | None,
    *,
    alpha: float = 0.12,
    gamma: float = 0.92,
) -> None:
    values = _q_values(q_table, state)
    future = max(_q_values(q_table, next_state)) if next_state else 0.0
    values[action] += alpha * (reward + gamma * future - values[action])
    q_table[state] = values


def _train_policy(closes: list[float]) -> tuple[dict[str, list[float]], dict[str, Any]]:
    split = int(len(closes) * 0.8)
    training, holdout = closes[:split], closes[split - LOOKBACK :]
    if len(training) < 300 or len(holdout) < LOOKBACK + 3:
        raise HTTPException(status_code=422, detail="Need at least 300 training bars and 23 holdout bars.")

    q_table: dict[str, list[float]] = {}
    rng = random.Random(7)
    epochs = 40
    for epoch in range(epochs):
        exposure = 0.0
        equity = peak = 1.0
        for index in range(LOOKBACK, len(training) - 1):
            state = _state_key(training[index - LOOKBACK : index + 1], exposure)
            epsilon = max(0.02, 0.2 * (1.0 - epoch / epochs))
            action = _select_action(q_table, state, rng, epsilon)
            next_exposure = min(MAX_EXPOSURE, max(0.0, exposure + ACTION_DELTAS[action]))
            market_return = training[index + 1] / training[index] - 1.0
            net_return = next_exposure * market_return - TURNOVER_COST * abs(next_exposure - exposure)
            old_drawdown = 1.0 - equity / peak
            equity *= max(1.0 + net_return, 1e-8)
            peak = max(peak, equity)
            drawdown = 1.0 - equity / peak
            reward = 100.0 * (net_return - 0.1 * max(0.0, drawdown - old_drawdown))
            next_state = _state_key(training[index - LOOKBACK + 1 : index + 2], next_exposure)
            _update_q(q_table, state, action, reward, next_state)
            exposure = next_exposure

    # Chronological, unseen holdout evaluation.
    exposure = 0.0
    equity = peak = 1.0
    max_drawdown = 0.0
    for index in range(LOOKBACK, len(holdout) - 1):
        state = _state_key(holdout[index - LOOKBACK : index + 1], exposure)
        action = _select_action(q_table, state, rng)
        next_exposure = min(MAX_EXPOSURE, max(0.0, exposure + ACTION_DELTAS[action]))
        net_return = next_exposure * (holdout[index + 1] / holdout[index] - 1.0)
        net_return -= TURNOVER_COST * abs(next_exposure - exposure)
        equity *= max(1.0 + net_return, 1e-8)
        peak = max(peak, equity)
        max_drawdown = max(max_drawdown, 1.0 - equity / peak)
        exposure = next_exposure

    benchmark = 1.0
    for index in range(LOOKBACK, len(holdout) - 1):
        benchmark *= max(1.0 + MAX_EXPOSURE * (holdout[index + 1] / holdout[index] - 1.0), 1e-8)
    metrics = {
        "symbol": SYMBOL,
        "training_bars": len(training),
        "holdout_bars": len(holdout),
        "holdout_agent_return": equity - 1.0,
        "holdout_5pct_exposure_benchmark_return": benchmark - 1.0,
        "holdout_max_drawdown": max_drawdown,
        "evaluation": "chronological holdout simulation; not a forecast",
    }
    return q_table, metrics


def train_for_user(db: Session, user_id: int) -> dict[str, Any]:
    data_client, _, feed = _alpaca_clients(db, user_id)
    bars = _market_bars(data_client, feed, days=365 * 5 + 90)
    q_table, metrics = _train_policy([bar["close"] for bar in bars])
    profile = ensure_profile(db, user_id)
    profile.q_table = json.dumps(q_table, separators=(",", ":"))
    profile.training_metrics = json.dumps(metrics, separators=(",", ":"))
    profile.trained_at = datetime.utcnow()
    db.commit()
    return metrics


def _decision_json(decision: models.AgentDecision) -> dict[str, Any]:
    return {
        "id": decision.id,
        "bar_date": decision.bar_date,
        "symbol": decision.symbol,
        "action": ACTION_NAMES.get(decision.action, "hold"),
        "target_exposure": decision.target_exposure,
        "order_side": decision.order_side,
        "order_qty": decision.order_qty,
        "order_notional": decision.order_notional,
        "equity_snapshot": decision.equity_snapshot,
        "market_open": decision.market_open,
        "status": decision.status,
        "reason": decision.reason,
        "order_id": decision.order_id,
        "reward": decision.reward,
        "created_at": decision.created_at.isoformat() if decision.created_at else None,
        "reviewed_at": decision.reviewed_at.isoformat() if decision.reviewed_at else None,
    }


def profile_status(db: Session, user_id: int) -> dict[str, Any]:
    profile = ensure_profile(db, user_id)
    connected = (
        db.query(models.BrokerCredential.id)
        .filter(models.BrokerCredential.user_id == user_id, models.BrokerCredential.broker_name == "Alpaca")
        .first()
        is not None
    )
    try:
        metrics = json.loads(profile.training_metrics) if profile.training_metrics else None
    except (TypeError, json.JSONDecodeError):
        metrics = None
    decisions = (
        db.query(models.AgentDecision)
        .filter(models.AgentDecision.user_id == user_id)
        .order_by(models.AgentDecision.created_at.desc())
        .limit(20)
        .all()
    )
    pending_count = (
        db.query(models.AgentDecision)
        .filter(models.AgentDecision.user_id == user_id, models.AgentDecision.reward.is_(None))
        .count()
    )
    return {
        "symbol": SYMBOL,
        "alpaca_connected": connected,
        "trained": bool(profile.q_table and profile.q_table != "{}"),
        "trained_at": profile.trained_at.isoformat() if profile.trained_at else None,
        "training_metrics": metrics,
        "enabled": bool(profile.enabled),
        "auto_submit_paper": bool(profile.auto_submit_paper),
        "pending_reviews": pending_count,
        "limits": {
            "paper_only": True,
            "max_exposure": MAX_EXPOSURE,
            "max_order_notional": MAX_ORDER_NOTIONAL,
            "orders_per_daily_bar": 1,
        },
        "recent_decisions": [_decision_json(decision) for decision in decisions],
    }


def _review_previous(db: Session, profile: models.AgentProfile, user_id: int, bar_date: str, closes: list[float], exposure: float) -> None:
    previous = (
        db.query(models.AgentDecision)
        .filter(
            models.AgentDecision.user_id == user_id,
            models.AgentDecision.reward.is_(None),
            models.AgentDecision.bar_date < bar_date,
        )
        .order_by(models.AgentDecision.bar_date.desc())
        .first()
    )
    if not previous or previous.price <= 0:
        return
    realized_return = previous.target_exposure * (closes[-1] / previous.price - 1.0)
    realized_return -= TURNOVER_COST * abs(previous.target_exposure - previous.previous_exposure)
    reward = 100.0 * realized_return
    current_state = _state_key(closes[-LOOKBACK - 1 :], exposure)
    try:
        q_table = json.loads(profile.q_table or "{}")
    except json.JSONDecodeError:
        q_table = {}
    _update_q(q_table, previous.state, previous.action, reward, current_state)
    profile.q_table = json.dumps(q_table, separators=(",", ":"))
    previous.reward = realized_return
    previous.reviewed_at = datetime.utcnow()
    db.commit()


def execute_agent(db: Session, user_id: int, *, scheduled: bool = False) -> dict[str, Any]:
    profile = ensure_profile(db, user_id)
    if not profile.q_table or profile.q_table == "{}":
        raise HTTPException(status_code=409, detail="Train the agent before running it.")
    try:
        q_table = json.loads(profile.q_table)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="The saved agent policy is invalid; train it again.") from exc

    data_client, trading_client, feed = _alpaca_clients(db, user_id)
    bars = _market_bars(data_client, feed, days=120)
    closes = [bar["close"] for bar in bars]
    bar_date = bars[-1]["date"]
    existing = (
        db.query(models.AgentDecision)
        .filter(models.AgentDecision.user_id == user_id, models.AgentDecision.bar_date == bar_date)
        .first()
    )
    if existing:
        return _decision_json(existing)

    try:
        account = trading_client.get_account()
        clock = trading_client.get_clock()
        equity = float(account.equity)
        if equity <= 0:
            raise HTTPException(status_code=409, detail="Alpaca returned non-positive account equity.")
        positions = trading_client.get_all_positions()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Alpaca paper account request failed ({type(exc).__name__}).") from exc

    spy_position = next((position for position in positions if position.symbol == SYMBOL), None)
    current_qty = float(spy_position.qty) if spy_position else 0.0
    if current_qty < 0:
        raise HTTPException(status_code=409, detail="The paper agent will not manage a short SPY position.")
    price = closes[-1]
    current_exposure = current_qty * price / equity
    state = _state_key(closes[-LOOKBACK - 1 :], current_exposure)
    _review_previous(db, profile, user_id, bar_date, closes, current_exposure)
    try:
        q_table = json.loads(profile.q_table or "{}")
    except json.JSONDecodeError:
        q_table = {}
    action = _select_action(q_table, state, random.Random(0))
    target_exposure = min(MAX_EXPOSURE, max(0.0, current_exposure + ACTION_DELTAS[action]))

    desired_delta = equity * target_exposure - current_qty * price
    capped_delta = max(-MAX_ORDER_NOTIONAL, min(MAX_ORDER_NOTIONAL, desired_delta))
    side = "BUY" if capped_delta > 0 else "SELL" if capped_delta < 0 else "HOLD"
    raw_quantity = min(abs(capped_delta) / price, current_qty) if side == "SELL" else abs(capped_delta) / price
    quantity = math.floor(max(0.0, raw_quantity) * 1_000_000) / 1_000_000
    notional = round(quantity * price, 2)
    market_open = bool(clock.is_open)
    can_submit = bool(profile.enabled and profile.auto_submit_paper)
    status = "dry_run"
    reason = "Paper order submission is disabled." if not can_submit else ""
    if side == "HOLD" or notional < MIN_ORDER_NOTIONAL or quantity == 0:
        status = "no_order"
        reason = "The target change is below the minimum order size."
    elif can_submit and not market_open:
        status = "skipped_market_closed"
        reason = "The agent only submits while the US market is open."

    decision = models.AgentDecision(
        user_id=user_id,
        bar_date=bar_date,
        symbol=SYMBOL,
        state=state,
        action=action,
        previous_exposure=current_exposure,
        target_exposure=target_exposure,
        price=price,
        order_side=side,
        order_qty=quantity,
        order_notional=notional,
        equity_snapshot=equity,
        market_open=market_open,
        status=status,
        reason=reason,
    )
    db.add(decision)
    try:
        db.commit()  # unique(user_id, bar_date) prevents duplicate daily decisions/orders
        db.refresh(decision)
    except IntegrityError:
        db.rollback()
        existing = (
            db.query(models.AgentDecision)
            .filter(models.AgentDecision.user_id == user_id, models.AgentDecision.bar_date == bar_date)
            .first()
        )
        if existing:
            return _decision_json(existing)
        raise

    if can_submit and market_open and side != "HOLD" and notional >= MIN_ORDER_NOTIONAL:
        try:
            from alpaca.trading.enums import OrderSide, TimeInForce
            from alpaca.trading.requests import MarketOrderRequest

            order = trading_client.submit_order(
                order_data=MarketOrderRequest(
                    symbol=SYMBOL,
                    qty=quantity,
                    side=OrderSide.BUY if side == "BUY" else OrderSide.SELL,
                    time_in_force=TimeInForce.DAY,
                    client_order_id=f"saipa-paper-{user_id}-{bar_date.replace('-', '')}",
                )
            )
            decision.status = "submitted"
            decision.order_id = str(order.id)
            decision.reason = "Submitted to Alpaca paper trading."
        except Exception as exc:
            decision.status = "submission_error"
            decision.reason = f"Alpaca paper rejected the order ({type(exc).__name__})."
        db.commit()
        db.refresh(decision)
    return _decision_json(decision)


def run_active_agents(db_factory) -> None:
    """Run enabled agents once per market day; called from the app background task."""
    now = datetime.now(EASTERN)
    if now.weekday() >= 5 or not (now.hour > 9 or (now.hour == 9 and now.minute >= 30)) or now.hour >= 16:
        return
    db = db_factory()
    try:
        profiles = db.query(models.AgentProfile).filter(models.AgentProfile.enabled.is_(True)).all()
        for profile in profiles:
            last = (
                db.query(models.AgentDecision)
                .filter(models.AgentDecision.user_id == profile.user_id)
                .order_by(models.AgentDecision.created_at.desc())
                .first()
            )
            if last and last.created_at:
                created = last.created_at.replace(tzinfo=timezone.utc).astimezone(EASTERN)
                if created.date() == now.date():
                    continue
            if profile.last_attempt_at:
                attempted = profile.last_attempt_at.replace(tzinfo=timezone.utc)
                if datetime.now(timezone.utc) - attempted < timedelta(minutes=15):
                    continue
            profile.last_attempt_at = datetime.utcnow()
            db.commit()
            try:
                execute_agent(db, profile.user_id, scheduled=True)
            except Exception as exc:
                # Keep the scheduler alive and avoid writing broker details to logs.
                print(f"Paper agent run failed for user {profile.user_id}: {type(exc).__name__}")
    finally:
        db.close()
