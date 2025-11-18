# ... (codice precedente invariato)

# ======== AI IRRIGAZIONE ========

class AIPlantBatchIn(BaseModel):
    plantIds: List[str] = Field(default_factory=list)

@router.post("/{plant_id}/ai/irrigazione")
async def api_ai_irrigazione_per_pianta(  # <--- AGGIUNTO 'async'
    plant_id: str,
    current_user: dict = Depends(get_current_user)
):
    doc = get_plant(current_user["id"], plant_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Pianta non trovata")
    
    # <--- AGGIUNTO 'await'
    return await compute_for_plant(doc)

@router.post("/ai/irrigazione/batch")
async def api_ai_irrigazione_batch(       # <--- AGGIUNTO 'async'
    payload: AIPlantBatchIn,
    current_user: dict = Depends(get_current_user)
):
    # Anche qui userai await quando implementerai il batch reale
    return await compute_batch(payload.plantIds, current_user) # <--- AGGIUNTO 'await'
