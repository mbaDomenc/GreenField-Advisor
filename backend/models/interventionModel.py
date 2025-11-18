from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class InterventionBase(BaseModel):
    type: Literal["irrigazione", "concimazione", "potatura", "pianificato", "altro"] = "irrigazione"
    status: Literal["done", "planned", "skipped", "canceled"] = "done"
    notes: Optional[str] = None

    # Dati opzionali in base al tipo
    liters: Optional[float] = None           # per irrigazione
    fertilizerType: Optional[str] = None     # per concimazione
    dose: Optional[str] = None               # per concimazione
    executedAt: Optional[datetime] = None    # quando l'intervento è stato eseguito
    plannedAt: Optional[datetime] = None     # per interventi pianificati

class InterventionCreate(InterventionBase):
    # in questo endpoint lo passiamo da path, quindi non serve qui plantId
    pass

class InterventionUpdate(BaseModel):
    type: Optional[Literal["irrigazione", "concimazione", "potatura", "pianificato", "altro"]] = None
    status: Optional[Literal["done", "planned", "skipped", "canceled"]] = None
    notes: Optional[str] = None
    liters: Optional[float] = None
    fertilizerType: Optional[str] = None
    dose: Optional[str] = None
    executedAt: Optional[datetime] = None
    plannedAt: Optional[datetime] = None

from pydantic import BaseModel, Field

class InterventionOut(BaseModel):
    id: str = Field(..., alias="id")
    type: str
    status: str
    notes: Optional[str] = None
    liters: Optional[float] = None
    fertilizerType: Optional[str] = Field(None, alias="fertilizerType")
    dose: Optional[str] = None
    executedAt: Optional[str] = Field(None, alias="executedAt")
    plannedAt: Optional[str] = Field(None, alias="plannedAt")
    createdAt: Optional[str] = Field(None, alias="createdAt")

    class Config:
        allow_population_by_field_name = True
        orm_mode = True

def _iso(dt: datetime | None):
    return dt.isoformat() if isinstance(dt, datetime) else None

def serialize_intervention(doc):
    if not doc:
        return None
    return {
        "id": str(doc.get("_id")),
        "userId": str(doc.get("userId")) if doc.get("userId") else None,
        "plantId": str(doc.get("plantId")) if doc.get("plantId") else None,
        "type": doc.get("type"),
        "status": doc.get("status"),
        "notes": doc.get("notes"),
        "liters": doc.get("liters"),
        "fertilizerType": doc.get("fertilizerType"),
        "dose": doc.get("dose"),
        "executedAt": _iso(doc.get("executedAt")),
        "plannedAt": _iso(doc.get("plannedAt")),
        "createdAt": _iso(doc.get("createdAt")),
    }