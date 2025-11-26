import os
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from bson import ObjectId
from fastapi import HTTPException

from config import settings
from controllers.interventionsController import interventions_collection
from database import db
from models.plantModel import PlantCreate, PlantUpdate, serialize_plant
from utils.images import save_image_bytes
from pipeline.pipeline_manager import PipelineManager
from controllers.weather_controller import weatherController

try:
    from utils.trefle_service import fetch_plant_by_id, derive_defaults_from_trefle_data
    TREFLE_AVAILABLE = True
except Exception:
    TREFLE_AVAILABLE = False

plants_collection = db["piante"]

# --- HELPER ---
def _oid(val: str) -> ObjectId: return ObjectId(val)
def _safe_int(v, default=None): 
    try: return int(v)
    except: return default

# ... (Funzioni CRUD list_plants, get_plant, ecc. rimangono UGUALI a prima - per brevità non le copio tutte, ma assicurati di averle nel file. Se vuoi copio tutto, dimmelo!)
# ... PER SICUREZZA COPIO LE FUNZIONI BASE QUI SOTTO ...

def list_plants(user_id: str) -> List[dict]:
    cursor = plants_collection.find({"userId": _oid(user_id)}).sort("createdAt", -1)
    return [serialize_plant(doc) for doc in cursor]

def get_plant(user_id: str, plant_id: str) -> Optional[dict]:
    doc = plants_collection.find_one({"_id": _oid(plant_id), "userId": _oid(user_id)})
    return serialize_plant(doc)

def create_plant(user_id: str, data: PlantCreate) -> dict:
    now = datetime.utcnow()
    base_doc = {
        "userId": _oid(user_id),
        "name": data.name,
        "species": data.species,
        "location": data.location,
        "description": data.description,
        "soil": getattr(data, "soil", None),
        "healthStatus": getattr(data, "healthStatus", None),
        "healthAdvice": getattr(data, "healthAdvice", None),
        "wateringIntervalDays": getattr(data, "wateringIntervalDays", 3),
        "sunlight": getattr(data, "sunlight", "pieno sole"),
        "lastWateredAt": None,
        "imageUrl": data.imageUrl,
        "imageThumbUrl": getattr(data, "imageThumbUrl", None),
        "geoLat": getattr(data, "geoLat", None),
        "geoLng": getattr(data, "geoLng", None),
        "placeId": getattr(data, "placeId", None),
        "addressLocality": getattr(data, "addressLocality", None),
        "createdAt": now, "updatedAt": now,
    }
    res = plants_collection.insert_one(base_doc)
    base_doc["_id"] = res.inserted_id
    return serialize_plant(base_doc)

def update_plant(user_id: str, plant_id: str, data: PlantUpdate) -> Optional[dict]:
    existing = plants_collection.find_one({"_id": _oid(plant_id), "userId": _oid(user_id)})
    if not existing: return None
    update_fields = {}
    # Lista campi aggiornabili
    for field in ["name", "species", "location", "description", "imageUrl", "imageThumbUrl", "soil", "geoLat", "geoLng", "placeId", "addressLocality", "healthStatus", "healthAdvice"]:
        val = getattr(data, field, None)
        if val is not None: update_fields[field] = val
    update_fields["updatedAt"] = datetime.utcnow()
    plants_collection.update_one({"_id": _oid(plant_id), "userId": _oid(user_id)}, {"$set": update_fields})
    return serialize_plant(plants_collection.find_one({"_id": _oid(plant_id)}))

def delete_plant(user_id: str, plant_id: str) -> bool:
    res = plants_collection.delete_one({"_id": _oid(plant_id), "userId": _oid(user_id)})
    return res.deleted_count == 1

def save_plant_image(user_id: str, plant_id: str, file_bytes: bytes) -> Optional[dict]:
    plant = plants_collection.find_one({"_id": _oid(plant_id), "userId": _oid(user_id)})
    if not plant: return None
    saved = save_image_bytes(data=file_bytes, subdir=f"plants/{user_id}/{plant_id}")
    plants_collection.update_one({"_id": _oid(plant_id)}, {"$set": {"imageUrl": saved["url"], "imageThumbUrl": saved["thumbUrl"]}})
    return {"imageUrl": saved["url"], "imageThumbUrl": saved["thumbUrl"]}

def remove_plant_image(user_id: str, plant_id: str) -> Optional[dict]:
    plants_collection.update_one({"_id": _oid(plant_id), "userId": _oid(user_id)}, {"$unset": {"imageUrl": "", "imageThumbUrl": ""}})
    return serialize_plant(plants_collection.find_one({"_id": _oid(plant_id)}))


# --- 🚀 AI & METEO (Funzione Corretta e Robusta) ---

async def calculate_irrigation_for_plant(user_id: str, plant_id: str) -> Dict[str, Any]:
    try: obj_id = _oid(plant_id)
    except: raise HTTPException(status_code=400, detail="ID pianta non valido")

    plant = plants_collection.find_one({"_id": obj_id, "userId": _oid(user_id)})
    if not plant: raise HTTPException(status_code=404, detail="Pianta non trovata")

    # Dati base
    raw_species = plant.get("species", "generic") or "generic"
    soil_type = plant.get("soil", "universale") or "universale"
    location_name = plant.get("location") or plant.get("addressLocality")
    
    # Recupera coordinate e converti a float (Importante!)
    lat = plant.get("geoLat")
    lng = plant.get("geoLng")
    try:
        if lat is not None: lat = float(lat)
        if lng is not None: lng = float(lng)
    except ValueError:
        lat, lng = None, None

    # Default Sensor Data (Se il meteo fallisce, userà questo e vedrai 20°C)
    sensor_data = {
        "temperature": 20.0, "humidity": 50.0, "rainfall": 0.0, 
        "light": 10000.0, "soil_moisture": 40.0, 
        "soil": soil_type,
        "plant_type": raw_species, 
        "species": raw_species 
    }

    # 🟢 METEO: Priorità alle coordinate
    weather_success = False
    if lat is not None and lng is not None:
        try:
            print(f"🌍 Meteo per {plant_id}: Uso coordinate ({lat}, {lng})")
            wx = await weatherController.get_weather_data(city=location_name, lat=lat, lon=lng)
            sensor_data.update(wx)
            weather_success = True
        except Exception as e: 
            print(f"⚠️ Meteo coordinate fallito: {e}")

    # Se coordinate falliscono o mancano, prova con il nome città
    if not weather_success and location_name:
        try:
            print(f"🌍 Meteo per {plant_id}: Uso nome città '{location_name}'")
            wx = await weatherController.get_weather_data(city=location_name)
            sensor_data.update(wx)
            weather_success = True
        except Exception as e: 
            print(f"❌ Meteo nome città fallito: {e}")

    if not weather_success:
        print(f"🚨 ATTENZIONE: Meteo non disponibile per pianta {plant_id}. Uso valori default (20°C).")

    # 🟢 SMART SENSOR (Override se irrigato di recente)
    last_watered = plant.get("lastWateredAt")
    if last_watered:
        try:
            if isinstance(last_watered, str):
                 last_watered = datetime.fromisoformat(last_watered.replace("Z", "+00:00"))
            if last_watered.tzinfo is None:
                 last_watered = last_watered.replace(tzinfo=timezone.utc)
            
            diff_hours = (datetime.now(timezone.utc) - last_watered).total_seconds() / 3600
            if diff_hours < 24: sensor_data["soil_moisture"] = 95.0
            elif diff_hours < 48: sensor_data["soil_moisture"] = max(sensor_data["soil_moisture"], 70.0)
        except Exception: pass

    # Mappatura
    pt = raw_species.lower()
    mapped = "generic"
    if "pomodoro" in pt or "tomato" in pt: mapped = "tomato"
    elif "patata" in pt or "potato" in pt: mapped = "potato"
    elif "pesca" in pt or "peach" in pt: mapped = "peach"
    elif "uva" in pt or "grape" in pt: mapped = "grape"
    elif "peperone" in pt or "pepper" in pt: mapped = "pepper"
    
    pipeline = PipelineManager(plant_type=mapped)
    result = pipeline.process(sensor_data)

    details = result.get("details", {})
    suggestions = details.get("full_suggestions", {})
    main = suggestions.get("main_action", {})
    timing = suggestions.get("timing", {})

    return {
        "status": "success",
        "suggestion": {
            "should_water": main.get("action") == "irrigate",
            "water_amount_liters": main.get("water_amount_liters", 0.0),
            "decision": main.get("decision", ""),
            "description": main.get("description", ""),
            "timing": timing.get("suggested_time", ""),
            "priority": suggestions.get("priority", "medium"),
            "frequency_estimation": suggestions.get("frequency_estimation"),
            "fertilizer_estimation": suggestions.get("fertilizer_estimation")
        },
        "details": {
            "cleaned_data": details.get("cleaned_data"),
            "features": details.get("features"),
            "estimation": details.get("estimation"),
            "anomalies": details.get("anomalies", [])
        },
        "meta": { "weather": sensor_data }
    }