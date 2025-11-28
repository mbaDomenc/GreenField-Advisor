from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional

from utils.auth import get_current_user
from models.interventionModel import InterventionCreate, InterventionUpdate, InterventionOut
from controllers.interventionsController import (
    list_interventions,
    create_intervention,
    patch_intervention,
    delete_intervention,
    ALLOWED_TYPES,
    ALLOWED_STATUS, list_recent_interventions_for_user,
)

router = APIRouter(
    prefix="/api/piante",
    tags=["interventi"]
)

def _validate_filters(status_val: Optional[str], itype_val: Optional[str]):
    if status_val and status_val not in ALLOWED_STATUS:
        raise HTTPException(
            status_code=400,
            detail=f"Parametro 'status' non valido. Ammessi: {sorted(ALLOWED_STATUS)}"
        )
    if itype_val and itype_val not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Parametro 'type' non valido. Ammessi: {sorted(ALLOWED_TYPES)}"
        )

# LISTA INTERVENTI per PIANTA
@router.get("/{plant_id}/interventi", response_model=List[InterventionOut], response_model_by_alias=True)
def api_list_interventions(
    plant_id: str,
    status: Optional[str] = Query(None, description=f"Filtra per stato. Ammessi: {sorted(ALLOWED_STATUS)}"),
    itype: Optional[str] = Query(None, alias="type", description=f"Filtra per tipo. Ammessi: {sorted(ALLOWED_TYPES)}"),
    limit: int = Query(20, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
):
    _validate_filters(status, itype)
    items = list_interventions(current_user["id"], plant_id, limit=limit, status=status, itype=itype)
    return items

# CREA INTERVENTO per PIANTA
@router.post("/{plant_id}/interventi", response_model=InterventionOut, status_code=status.HTTP_201_CREATED, response_model_by_alias=True)
def api_create_intervention(
    plant_id: str,
    payload: InterventionCreate,
    current_user: dict = Depends(get_current_user)
):
    if payload.type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Campo 'type' non valido. Ammessi: {sorted(ALLOWED_TYPES)}")
    if payload.status not in ALLOWED_STATUS:
        raise HTTPException(status_code=400, detail=f"Campo 'status' non valido. Ammessi: {sorted(ALLOWED_STATUS)}")

    created = create_intervention(current_user["id"], plant_id, payload)
    if not created:
        raise HTTPException(status_code=404, detail="Pianta non trovata o non accessibile")
    return created

# PATCH INTERVENTO by ID
@router.patch("/interventi/{inter_id}", response_model=InterventionOut, response_model_by_alias=True)
def api_patch_intervention(
    inter_id: str,
    payload: InterventionUpdate,
    current_user: dict = Depends(get_current_user)
):
    if payload.type is not None and payload.type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Campo 'type' non valido. Ammessi: {sorted(ALLOWED_TYPES)}")
    if payload.status is not None and payload.status not in ALLOWED_STATUS:
        raise HTTPException(status_code=400, detail=f"Campo 'status' non valido. Ammessi: {sorted(ALLOWED_STATUS)}")

    updated = patch_intervention(current_user["id"], inter_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Intervento non trovato o non accessibile")
    return updated

# DELETE INTERVENTO by ID
@router.delete("/interventi/{inter_id}", status_code=status.HTTP_204_NO_CONTENT)
def api_delete_intervention(
    inter_id: str,
    current_user: dict = Depends(get_current_user)
):
    ok = delete_intervention(current_user["id"], inter_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Intervento non trovato o non accessibile")
    return None


@router.get("/utente/interventi-recenti", response_model=List[InterventionOut], response_model_by_alias=True)
def api_get_recent_user_interventions(
    limit: int = Query(5, ge=1, le=20),
    current_user: dict = Depends(get_current_user)
):
    return list_recent_interventions_for_user(current_user["id"], limit)