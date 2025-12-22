from datetime import datetime, timezone
from typing import List, Optional, Union
from bson import ObjectId

from database import db
from models.interventionModel import (
    InterventionCreate, InterventionUpdate, serialize_intervention
)

interventions_collection = db["interventi"]
plants_collection = db["piante"]

# Valori ammessi 
ALLOWED_TYPES = {"irrigazione", "concimazione", "potatura", "altro"}
ALLOWED_STATUS = {"done", "planned", "skipped", "canceled"}


def _oid(val: str) -> ObjectId:
    return ObjectId(val)


def _parse_dt(dt: Optional[Union[str, datetime]]) -> Optional[datetime]:
    """
    Accetta datetime o stringa in ISO e ritorna datetime UTC naive.
    Restituisce None se non valorizzato o malformato.
    """
    if not dt:
        return None
    if isinstance(dt, datetime):
        return dt
    try:
        dt2 = datetime.fromisoformat(str(dt).replace("Z", "+00:00"))
        
        return dt2.astimezone(timezone.utc).replace(tzinfo=timezone.utc)
    except Exception:
        return None


def ensure_interventions_indexes():
    try:
        interventions_collection.create_index(
            [("userId", 1), ("plantId", 1), ("createdAt", -1)],
            name="idx_user_plant_created"
        )
        interventions_collection.create_index(
            [("plantId", 1), ("status", 1), ("plannedAt", 1)],
            name="idx_plant_status_plannedAt"
        )
        interventions_collection.create_index(
            [("userId", 1), ("type", 1), ("createdAt", -1)],
            name="idx_user_type_created"
        )
    except Exception as e:
        print("[WARN] interventions indexes:", e)


def _update_plant_denorm(user_id: str, plant_id: str):
    """
    Aggiorna alcuni campi derivati nella pianta:
      - lastWateredAt: ultimo intervento 'irrigazione' con status='done' (preferisce executedAt, fallback createdAt)
      - lastFertilizedAt: ultimo intervento 'concimazione' con status='done'
      - nextPlannedAt: intervento 'planned' più vicino nel futuro
    """
    uid = _oid(user_id)
    pid = _oid(plant_id)

    # Ultima irrigazione
    last_irrig = interventions_collection.find_one(
        {"userId": uid, "plantId": pid, "type": "irrigazione", "status": "done"},
        sort=[("executedAt", -1), ("createdAt", -1)]
    )
    lastWateredAt = (last_irrig.get("executedAt") or last_irrig.get("createdAt")) if last_irrig else None

    # Ultima concimazione
    last_fert = interventions_collection.find_one(
        {"userId": uid, "plantId": pid, "type": "concimazione", "status": "done"},
        sort=[("executedAt", -1), ("createdAt", -1)]
    )
    lastFertilizedAt = (last_fert.get("executedAt") or last_fert.get("createdAt")) if last_fert else None

    # Prossimo pianificato (dall'ultima irrigazione in poi)
    now = datetime.now(timezone.utc)
    next_plan = interventions_collection.find_one(
        {"userId": uid, "plantId": pid, "status": "planned", "plannedAt": {"$gte": now}},
        sort=[("plannedAt", 1)]
    )
    nextPlannedAt = next_plan.get("plannedAt") if next_plan else None

    plants_collection.update_one(
        {"_id": pid, "userId": uid},
        {"$set": {
            "lastWateredAt": lastWateredAt,
            "lastFertilizedAt": lastFertilizedAt,
            "nextPlannedAt": nextPlannedAt,
            "updatedAt": datetime.utcnow()
        }}
    )


def create_intervention(user_id: str, plant_id: str, data: InterventionCreate) -> Optional[dict]:
    """
    Crea un intervento:
      - Valida type/status
      - Converte le date
      - Imposta executedAt=NOW se status='done' e non fornito
      - Aggiorna campi denormalizzati della pianta
    """
    # Validazione base
    if data.type not in ALLOWED_TYPES:
        return None
    if data.status not in ALLOWED_STATUS:
        return None

    uid = _oid(user_id)
    pid = _oid(plant_id)

    # verifica proprietario pianta
    plant = plants_collection.find_one({"_id": pid, "userId": uid})
    if not plant:
        return None

    now = datetime.now(timezone.utc)

    executed_at = _parse_dt(data.executedAt)
    planned_at = _parse_dt(data.plannedAt)


    if data.status == "done" and not executed_at:
        executed_at = now

    doc = {
        "userId": uid,
        "plantId": pid,
        "type": data.type,                 
        "status": data.status,             
        "notes": data.notes,
        "liters": data.liters,             
        "fertilizerType": data.fertilizerType,  
        "dose": data.dose,                 
        "executedAt": now,
        "plannedAt": planned_at,
        "createdAt": now,
    }

    res = interventions_collection.insert_one(doc)
    doc["_id"] = res.inserted_id

    # aggiorna denormalizzati
    _update_plant_denorm(user_id, plant_id)

    return serialize_intervention(doc)


def list_interventions(
    user_id: str,
    plant_id: str,
    limit: int = 20,
    status: Optional[str] = None,
    itype: Optional[str] = None
) -> List[dict]:
    """
    Lista interventi per pianta con filtri opzionali (status/type) e limite.
    Ordina per createdAt decrescente.
    """
    uid = _oid(user_id)
    pid = _oid(plant_id)

    query = {"userId": uid, "plantId": pid}
    if status:
        query["status"] = status
    if itype:
        query["type"] = itype

    cursor = interventions_collection.find(query).sort("createdAt", -1).limit(limit)
    return [serialize_intervention(doc) for doc in cursor]


def list_recent_interventions_for_plant(
    user_id: str,
    plant_id: str,
    limit: int = 5
) -> List[dict]:
    """
    Helper comodo per la rotta: GET /api/piante/{plant_id}/interventi
    Torna gli ultimi N interventi (mix di planned/done/...) per la pianta.
    """
    return list_interventions(user_id, plant_id, limit=limit)


def patch_intervention(user_id: str, inter_id: str, data: InterventionUpdate) -> Optional[dict]:
    uid = _oid(user_id)
    iid = _oid(inter_id)

    # fetch doc
    doc = interventions_collection.find_one({"_id": iid, "userId": uid})
    if not doc:
        return None

    patch = {}
    # Valida ed applica campi testuali base
    if data.type is not None:
        if data.type not in ALLOWED_TYPES:
            return None
        patch["type"] = data.type

    if data.status is not None:
        if data.status not in ALLOWED_STATUS:
            return None
        patch["status"] = data.status

    for field in ["notes", "liters", "fertilizerType", "dose"]:
        val = getattr(data, field, None)
        if val is not None:
            patch[field] = val

    # Date
    if data.executedAt is not None:
        patch["executedAt"] = _parse_dt(data.executedAt)
    if data.plannedAt is not None:
        patch["plannedAt"] = _parse_dt(data.plannedAt)

    if not patch:
        return serialize_intervention(doc)

    interventions_collection.update_one({"_id": iid, "userId": uid}, {"$set": patch})
    updated = interventions_collection.find_one({"_id": iid, "userId": uid})

    pid = str(updated["plantId"])
    _update_plant_denorm(user_id, pid)

    return serialize_intervention(updated)


def delete_intervention(user_id: str, inter_id: str) -> bool:
    uid = _oid(user_id)
    iid = _oid(inter_id)

    doc = interventions_collection.find_one({"_id": iid, "userId": uid})
    if not doc:
        return False

    res = interventions_collection.delete_one({"_id": iid, "userId": uid})
    if res.deleted_count == 1:
        pid = str(doc["plantId"])
        _update_plant_denorm(user_id, pid)
        return True
    return False


def list_recent_interventions_for_user(user_id: str, limit: int = 5) -> List[dict]:
    uid = ObjectId(user_id)

    cursor = interventions_collection.find(
        {"userId": uid, "status": "done"}
    ).sort("executedAt", -1).limit(limit)

    return [serialize_intervention(doc) for doc in cursor]