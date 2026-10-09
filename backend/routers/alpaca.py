from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models, schemas, encryption, database
from auth import get_current_user

router = APIRouter(prefix="/alpaca", tags=["alpaca"])

# Helper to obtain the Alpaca client using stored credentials
def _get_alpaca_client(user_id: int, db: Session):
    cred = db.query(models.BrokerCredential).filter(
        models.BrokerCredential.user_id == user_id,
        models.BrokerCredential.broker_name == "Alpaca"
    ).first()
    if not cred:
        raise HTTPException(status_code=404, detail="Alpaca credential not found")
    secret = encryption.decrypt(cred.encrypted_secret)
    try:
        from alpaca.trading.client import TradingClient
        client = TradingClient(api_key=cred.api_key, secret_key=secret)
        return client
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/account")
def get_account(current_user: models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    client = _get_alpaca_client(current_user.id, db)
    try:
        return client.get_account()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/positions")
def get_positions(current_user: models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    client = _get_alpaca_client(current_user.id, db)
    try:
        return client.get_all_positions()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/orders")
def get_orders(limit: int = 50, current_user: models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    client = _get_alpaca_client(current_user.id, db)
    try:
        return client.get_orders(limit=limit)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
