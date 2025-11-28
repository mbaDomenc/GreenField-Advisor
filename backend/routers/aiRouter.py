from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
from ai.cnn_service import cnn_classifier

router = APIRouter(prefix="/api/ai", tags=["ai"])

@router.post("/analyze-health", summary="Analisi Salute Pianta")
async def analyze_health(
    file: UploadFile = File(...),
    plant_type: Optional[str] = Form(None) # Riceve la specie dal frontend
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File non valido")
    
    try:
        image_data = await file.read()
        # Passa la specie al servizio per il filtro
        result = cnn_classifier.predict_health(image_data, plant_context=plant_type)
        return {"status": "success", "analysis": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))