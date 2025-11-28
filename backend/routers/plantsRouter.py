from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from typing import List
from pydantic import BaseModel, Field

from utils.auth import get_current_user
from models.plantModel import PlantCreate, PlantUpdate, PlantOut
from controllers.plantsController import (
    list_plants, get_plant, create_plant, update_plant, delete_plant,
    save_plant_image, remove_plant_image,
    calculate_irrigation_for_plant  
)

from controllers.ai_irrigazione_controller import compute_for_plant, compute_batch

from database import db

router = APIRouter(prefix="/api/piante", tags=["piante"])
plants_collection = db["piante"]


@router.get("/", response_model=List[PlantOut])
def api_list_plants(current_user: dict = Depends(get_current_user)):
    return list_plants(current_user["id"])


@router.post("/", response_model=PlantOut, status_code=status.HTTP_201_CREATED)
def api_create_plant(payload: PlantCreate, current_user: dict = Depends(get_current_user)):
    return create_plant(current_user["id"], payload)


@router.get("/{plant_id}", response_model=PlantOut)
def api_get_plant(plant_id: str, current_user: dict = Depends(get_current_user)):
    doc = get_plant(current_user["id"], plant_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Pianta non trovata")
    return doc


@router.patch("/{plant_id}", response_model=PlantOut)
def api_update_plant(plant_id: str, payload: PlantUpdate, current_user: dict = Depends(get_current_user)):
    doc = update_plant(current_user["id"], plant_id, payload)
    if not doc:
        raise HTTPException(status_code=404, detail="Pianta non trovata")
    return doc


@router.delete("/{plant_id}", status_code=status.HTTP_204_NO_CONTENT)
def api_delete_plant(plant_id: str, current_user: dict = Depends(get_current_user)):
    ok = delete_plant(current_user["id"], plant_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Pianta non trovata")
    return None


@router.post("/{plant_id}/image")
async def api_upload_plant_image(
    plant_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Immagine troppo grande (max 8MB)")

    saved = save_plant_image(current_user["id"], plant_id, data)
    if saved is None:
        raise HTTPException(status_code=404, detail="Pianta non trovata")

    return saved


@router.delete("/{plant_id}/image")
def api_delete_plant_image(plant_id: str, current_user: dict = Depends(get_current_user)):
    doc = remove_plant_image(current_user["id"], plant_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Pianta non trovata")
    return doc


# AI IRRIGAZIONE

class AIPlantBatchIn(BaseModel):
    plantIds: List[str] = Field(default_factory=list)


#ENDPOINT DELLA PIPELINE
@router.post("/{plant_id}/ai/irrigazione", summary="Analisi AI Irrigazione/Concimazione")
async def api_ai_irrigazione_per_pianta(
    plant_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Esegue la pipeline AI v2 (Meteo Reale + Suolo + Concimazione).
    """
    # Chiama la nuova funzione asincrona nel controller
    return await calculate_irrigation_for_plant(current_user["id"], plant_id)


@router.post("/ai/irrigazione/batch")
def api_ai_irrigazione_batch(
    payload: AIPlantBatchIn,
    current_user: dict = Depends(get_current_user)
):
    return compute_batch(payload.plantIds, current_user)