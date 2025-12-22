"""
Controller per la pipeline di processing.
"""
import logging
from datetime import datetime
from fastapi import HTTPException
from pipeline.pipeline_manager import PipelineManager
from models.pipelineModel import (
    PipelineRequest, PipelineResponse, IrrigationSuggestion,
    PipelineDetailsResponse, PipelineMetadataResponse, HealthCheckResponse
)

logger = logging.getLogger(__name__)

class PipelineController:
    
    
    SUPPORTED_PLANTS = ["tomato", "potato", "peach", "grape", "pepper", "generic"]
    
    def __init__(self):
        logger.info(" PipelineController inizializzato")
        
    def process_sensor_data(self, request: PipelineRequest) -> PipelineResponse:
        try:
            # 1. Validazione
            if request.plant_type not in self.SUPPORTED_PLANTS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Tipo pianta '{request.plant_type}' non supportato. "
                           f"Supportati: {', '.join(self.SUPPORTED_PLANTS)}"
                )
            
            logger.info(f"Inizio processing IDONEITÀ per pianta: {request.plant_type}")
            started_at = datetime.utcnow().isoformat()
            
            # 2. Preparazione Dati
            sensor_data = request.sensor_data.model_dump()
            
            #INIEZIONE DEL TERRENO
            if request.soil_type:
                sensor_data["soil"] = request.soil_type.lower() 
                sensor_data["plant_type"] = request.plant_type
            
            # 3. Esecuzione Pipeline
            pipeline = PipelineManager(plant_type=request.plant_type)
            result = pipeline.process(sensor_data)
            
            # 4. Formattazione Risposta
            details_dict = result.get("details", {})
            suggestions = details_dict.get("full_suggestions", {})
            main_action = suggestions.get("main_action", {})
            timing_info = suggestions.get("timing", {})
            
            return PipelineResponse(
                status=result.get("status", "success"),
                suggestion=IrrigationSuggestion(
                    should_water=main_action.get("action") == "irrigate",
                    water_amount_liters=main_action.get("water_amount_liters", 0.0),
                    decision=main_action.get("decision", ""),
                    description=main_action.get("description", ""),
                    timing=timing_info.get("suggested_time", ""), 
                    priority=suggestions.get("priority", "medium"),
                    frequency_estimation=suggestions.get("frequency_estimation"),
                    fertilizer_estimation=suggestions.get("fertilizer_estimation")
                ),
                details=PipelineDetailsResponse(
                    cleaned_data=details_dict.get("cleaned_data"),
                    features=details_dict.get("features"),
                    estimation=details_dict.get("estimation"),
                    anomalies=details_dict.get("anomalies", []),
                    full_suggestions=suggestions
                ),
                metadata=PipelineMetadataResponse(
                    started_at=result.get("metadata", {}).get("started_at"),
                    completed_at=result.get("metadata", {}).get("completed_at"),
                    errors=result.get("metadata", {}).get("errors", []),
                    warnings=result.get("metadata", {}).get("warnings", []),
                    stage_results=result.get("metadata", {}).get("stage_results", {})
                )
            )

        except HTTPException: raise
        except Exception as e:
            logger.exception(f"Errore pipeline: {str(e)}")
            return PipelineResponse(
                status="error",
                suggestion=None, details=None,
                metadata=PipelineMetadataResponse(
                    started_at=started_at,
                    errors=[str(e)]
                )
            )
    
    def get_health_check(self) -> HealthCheckResponse:
        return HealthCheckResponse(
            status="healthy",
            pipeline_available=True,
            supported_plants=self.SUPPORTED_PLANTS,
            timestamp=datetime.utcnow().isoformat()
        )