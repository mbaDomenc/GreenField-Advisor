from fastapi import HTTPException, Header, Depends
from jose import jwt, JWTError
from config import JWT_SECRET, JWT_ALGORITHM
from database import db
from bson import ObjectId

users_collection = db["utenti"]

def sanitize_user(user: dict) -> dict:
    """
    Rimuove campi sensibili e normalizza l'id.
    """
    if not user:
        return None
    user = user.copy()
    user["id"] = str(user["_id"])
    user.pop("_id", None)
    user.pop("password", None)
    return user

def get_current_user(authorization: str = Header(None)):
    """
    Legge 'Authorization: Bearer <accessToken>' e ritorna il documento utente (sanitized).
    L'accessToken è quello inviato dal frontend in memoria (axios) e ottenuto da /login o /refresh.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    uid = payload.get("id")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = users_collection.find_one({"_id": ObjectId(uid)})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return sanitize_user(user)

def require_roles(*allowed_roles: str):
    """
    Dependency per controllo ruoli.
    Uso:
      - Dentro una rotta come parametro:
            def endpoint(current_user=Depends(require_roles("admin"))): ...
      - Oppure a livello router: dependencies=[Depends(require_roles("admin"))]
    """
    def _checker(current_user = Depends(get_current_user)):
        ruolo = current_user.get("ruolo")
        if ruolo not in allowed_roles:
            raise HTTPException(status_code=403, detail="Permessi insufficienti")
        return current_user
    return _checker

