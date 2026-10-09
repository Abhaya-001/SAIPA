from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import database
import models
from auth import get_current_user
from services import trading_agent


router = APIRouter(prefix="/agent", tags=["Paper Trading Agent"])


class AgentConfigUpdate(BaseModel):
    enabled: bool
    auto_submit_paper: bool
    acknowledge_dedicated_paper_account: bool = False


@router.get("/status")
def get_agent_status(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    return trading_agent.profile_status(db, current_user.id)


@router.post("/train")
def train_agent(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    metrics = trading_agent.train_for_user(db, current_user.id)
    return {"metrics": metrics, "status": trading_agent.profile_status(db, current_user.id)}


@router.put("/config")
def update_agent_config(
    payload: AgentConfigUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    profile = trading_agent.ensure_profile(db, current_user.id)
    if payload.auto_submit_paper and not payload.enabled:
        raise HTTPException(status_code=422, detail="Enable the scheduled agent before enabling paper orders.")
    if payload.enabled:
        status = trading_agent.profile_status(db, current_user.id)
        if not status["alpaca_connected"]:
            raise HTTPException(status_code=409, detail="Link an Alpaca account before enabling the agent.")
        if not status["trained"]:
            raise HTTPException(status_code=409, detail="Train the agent before enabling it.")
    if payload.auto_submit_paper and not payload.acknowledge_dedicated_paper_account:
        raise HTTPException(
            status_code=400,
            detail="Confirm the dedicated Alpaca paper account and SPY management notice before enabling paper orders.",
        )
    profile.enabled = payload.enabled
    profile.auto_submit_paper = payload.auto_submit_paper
    db.commit()
    return trading_agent.profile_status(db, current_user.id)


@router.post("/run")
def run_agent_now(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    decision = trading_agent.execute_agent(db, current_user.id)
    return {"decision": decision, "status": trading_agent.profile_status(db, current_user.id)}
