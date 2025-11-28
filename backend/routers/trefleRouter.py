from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional

from utils.auth import get_current_user
from utils.trefle_service import search_plants, fetch_plant_by_id, TrefleError

router = APIRouter(prefix="/api/trefle", tags=["trefle"])

@router.get("/search")
def api_trefle_search(
    q: str = Query(..., min_length=2),
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
):
    """
    Proxy interno verso Trefle (ricerca).
    Ritorna una lista con chiavi: trefleId, trefleSlug, trefleScientificName, trefleCommonName, imageUrl
    """
    try:
        items = search_plants(q, page=page, per_page=per_page)
        return items
    except TrefleError as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/species/{trefle_id}")
def api_trefle_species_detail(
    trefle_id: int,
    current_user: dict = Depends(get_current_user),
):
    """
    Dettaglio specie.
    """
    try:
        data = fetch_plant_by_id(trefle_id)
        return data
    except TrefleError as e:
        raise HTTPException(status_code=502, detail=str(e))