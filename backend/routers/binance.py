from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import models, encryption, database
from auth import get_current_user

router = APIRouter(prefix="/binance", tags=["binance"])

def _get_binance_client(user_id:int, db:Session):
    cred = db.query(models.BrokerCredential).filter(
        models.BrokerCredential.user_id == user_id,
        models.BrokerCredential.broker_name.in_(["Binance Demo", "Binance Spot"])
    ).first()
    if not cred:
        raise HTTPException(status_code=404, detail="Binance credential not found")
    secret = encryption.decrypt(cred.encrypted_secret)
    try:
        from binance.spot import Spot as SpotClient
        client = SpotClient(api_key=cred.api_key, secret_key=secret)
        return client
    except ImportError:
        raise HTTPException(status_code=500, detail="Binance SDK not installed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/account")
def get_account(current_user: models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    client = _get_binance_client(current_user.id, db)
    try:
        return client.account()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/balances")
def get_balances(current_user: models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    client = _get_binance_client(current_user.id, db)
    try:
        info = client.account()
        return [b for b in info.get('balances', []) if float(b.get('free','0'))>0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/price_history")
def price_history(symbol:str="BTCUSDT", interval:str="1h", current_user: models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    client = _get_binance_client(current_user.id, db)
    try:
        klines = client.klines(symbol=symbol, interval=interval, limit=100)
        return [{"time": k[0], "open": k[1], "high": k[2], "low": k[3], "close": k[4]} for k in klines]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
