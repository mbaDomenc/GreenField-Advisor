
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class SensorReading(BaseModel):
    """Modello per una lettura da sensore"""
    sensor_id: str = Field(..., description="ID univoco del sensore")
    sensor_type: str = Field(..., description="Tipo: temperature, humidity, soil_moisture, ph, light")
    value: float = Field(..., description="Valore misurato")
    unit: str = Field(..., description="Unità di misura")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Timestamp della lettura")
    location: str = Field(default="garden_zone_1", description="Posizione del sensore")
    plant_id: Optional[str] = Field(None, description="ID pianta associata (opzionale)")

    class Config:
        schema_extra = {
            "example": {
                "sensor_id": "temp_sensor_1",
                "sensor_type": "temperature",
                "value": 22.5,
                "unit": "°C",
                "timestamp": "2025-11-17T17:00:00",
                "location": "garden_zone_1"
            }
        }

class SensorReadingResponse(BaseModel):
    """Risposta dopo il salvataggio"""
    status: str
    id: str
    message: str
