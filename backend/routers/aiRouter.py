from fastapi import APIRouter, UploadFile, File, HTTPException
from ai.cnn_service import cnn_classifier

router = APIRouter(prefix="/api/ai", tags=["ai"])

@router.post("/analyze-health", summary="Analisi Salute Pianta (CNN)")
async def analyze_health(file: UploadFile = File(...)):
    """
    Riceve un'immagine, la analizza con il modello addestrato e restituisce:
    - Etichetta (es. Tomato Healthy)
    - Confidenza
    - Consiglio operativo
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Il file caricato non è un'immagine valida.")
    
    try:
        # Leggi il file in memoria
        image_data = await file.read()
        
        # Esegui la predizione
        result = cnn_classifier.predict_health(image_data)
        
        return {
            "status": "success",
            "analysis": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore analisi AI: {str(e)}")