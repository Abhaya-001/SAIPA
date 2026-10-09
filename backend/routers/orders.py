from fastapi import APIRouter, Depends, HTTPException, status
from typing import Literal, Annotated
import os
import json
from sqlalchemy.orm import Session
from auth import get_current_user, db_dependency
import models, schemas, encryption, database
try:
    from binance.client import Client as BinanceClient
except ImportError:
    BinanceClient = None  # Binance SDK not installed

router = APIRouter(prefix="/orders", tags=["orders"])

# Pydantic model for order request
class OrderRequest(schemas.BaseModel):
    broker_name: Literal["Binance Demo", "Binance Spot"]
    symbol: str  # e.g. "BTCUSDT"
    side: Literal["BUY", "SELL"]
    quantity: float
    order_type: Literal["MARKET", "LIMIT"] = "MARKET"
    price: float | None = None  # required for LIMIT
    time_in_force: Literal["GTC", "IOC", "FOK"] = "GTC"

@router.post("/", response_model=schemas.BrokerCredentialResponse)
def place_order(
    order: OrderRequest,
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: db_dependency,
):
    # Retrieve broker credential for the user
    cred = (
        db.query(models.BrokerCredential)
        .filter(
            models.BrokerCredential.user_id == current_user.id,
            models.BrokerCredential.broker_name == order.broker_name,
        )
        .first()
    )
    if not cred:
        raise HTTPException(status_code=404, detail="Broker credential not found for user")

    # Decrypt the stored secret key
    api_secret = encryption.decrypt(cred.encrypted_secret)
    api_key = cred.api_key

    # Currently only Binance is supported for order placement
    if order.broker_name.startswith("Binance"):
        client = BinanceClient(api_key=api_key, api_secret=api_secret)
        try:
            if order.order_type == "MARKET":
                response = client.create_order(
                    symbol=order.symbol,
                    side=order.side,
                    type=order.order_type,
                    quantity=order.quantity,
                )
            else:  # LIMIT order requires price
                if order.price is None:
                    raise HTTPException(status_code=400, detail="Price must be provided for LIMIT orders")
                response = client.create_order(
                    symbol=order.symbol,
                    side=order.side,
                    type=order.order_type,
                    timeInForce=order.time_in_force,
                    quantity=order.quantity,
                    price=str(order.price),
                )
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Binance order failed: {str(e)}")
        # Store the order as a Transaction for UI visibility
        tx = models.Transaction(
            user_id=current_user.id,
            broker_name=order.broker_name,
            symbol=order.symbol,
            transaction_type=order.side.lower(),
            quantity=order.quantity,
            price=order.price if order.price else None,
            asset_class="crypto",
        )
        db.add(tx)
        db.commit()
        db.refresh(tx)
        # Return a minimal representation (masking key as in broker endpoint)
        return schemas.BrokerCredentialResponse(
            id=cred.id,
            user_id=cred.user_id,
            broker_name=cred.broker_name,
            nickname=cred.nickname,
            api_key=f"****{cred.api_key[-4:]}" if len(cred.api_key) > 4 else "****",
            identifier=cred.identifier,
            endpoint=cred.endpoint,
        )
    else:
        raise HTTPException(status_code=400, detail="Order placement not implemented for this broker")
