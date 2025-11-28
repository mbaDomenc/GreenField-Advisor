from fastapi import APIRouter, Response, Request, Depends, HTTPException, UploadFile, File

from datetime import datetime
from bson import ObjectId
from controllers.userController import get_me, set_user_avatar
from database import db


from controllers import userController
from utils.auth import get_current_user
router = APIRouter()
users_collection = db["utenti"]
interventions_collection = db["interventi"]
piante_collection = db["piante"]


@router.post("/register")
def register(user: dict):
    return userController.register_user(user)

@router.post("/login")
def login(response: Response, credentials: dict):
    return userController.login_user(response, credentials)

@router.post("/refresh")
def refresh(request: Request):
    return userController.refresh_access_token(request)

@router.post("/logout")
def logout(response: Response, request: Request):
    return userController.logout_user(response, request)



@router.get("/me")
def get_my_profile(current_user=Depends(get_current_user)):
    user = current_user.copy()

    try:
        user_id = ObjectId(user["id"])
    except Exception:
        return {"error": "ID utente non valido"}

        #Conta le piante registrate dall'utente preciso
    plant_count = piante_collection.count_documents({"userId": user_id})
    user["plantCount"] = plant_count



    #Conteggio irrigazioni oggi


    today = datetime.utcnow().date()
    start = datetime.combine(today, datetime.min.time())
    end = datetime.combine(today, datetime.max.time())

    irrigations_today = interventions_collection.count_documents({
        "userId": ObjectId(user["id"]),
        "type": "irrigazione",
        "status": "done",
        "executedAt": {"$gte": start, "$lte": end}
    })
    user["interventionsToday"] = irrigations_today

    return {"utente": user}


@router.post("/avatar")
async def api_upload_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Immagine troppo grande (max 5MB)")

    saved = set_user_avatar(current_user["id"], data)
    if saved is None:
        raise HTTPException(status_code=404, detail="Utente non trovato")

    return saved