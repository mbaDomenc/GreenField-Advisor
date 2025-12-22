import os
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
from bson import ObjectId
from fastapi import HTTPException

from config import settings
from controllers.interventionsController import interventions_collection
from database import db
from models.plantModel import PlantCreate, PlantUpdate, serialize_plant
from utils.images import save_image_bytes
from controllers.weather_controller import weatherController
from utils.ai_explainer_service import explain_irrigation_async

try:
    from ai.cnn_service import cnn_classifier
except ImportError:
    from ai.cnn_service import cnn_classifier

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

def _get_weather_context_fallback(existing_data: dict = None) -> dict:
    data = (existing_data or {}).copy()
    if data.get("temp") is None: data["temp"] = 15.0
    if data.get("humidity") is None: data["humidity"] = 60.0
    if data.get("et0") is None: data["et0"] = 2.0
    if data.get("solar_rad") is None: data["solar_rad"] = 400.0
    if data.get("wind") is None: data["wind"] = 10.0
    if not data.get("rain_trend"): data["rain_trend"] = []
    return data

def _calculate_manual_water_today_db(plant_id_str: str) -> float:
    try:
        start_of_day = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        pipeline = [
            {"$match": {"plantId": plant_id_str, "type": "irrigazione", "executedAt": {"$gte": start_of_day}}},
            {"$group": {"_id": None, "total": {"$sum": "$liters"}}}
        ]
        res = list(db["interventi"].aggregate(pipeline))
        
        # Fallback ObjectId
        if not res:
            try:
                pipeline[0]["$match"]["plantId"] = ObjectId(plant_id_str)
                res = list(db["interventi"].aggregate(pipeline))
            except: pass

        if res:
            val = float(res[0]["total"])
            print(f"   [MANUAL WATER CHECK] Trovati nel DB: {val} Litri oggi.")
            return val
        return 0.0
    except Exception as e:
        print(f"[ERR MANUAL] {e}")
        return 0.0

# --- CRUD STANDARD 
def list_plants(user_id: str) -> List[dict]:
    cursor = plants_collection.find({"userId": _oid(user_id)}).sort("createdAt", -1)
    return [serialize_plant(doc) for doc in cursor]

def get_plant(user_id: str, plant_id: str) -> Optional[dict]:
    doc = plants_collection.find_one({"_id": _oid(plant_id), "userId": _oid(user_id)})
    return serialize_plant(doc)

def create_plant(user_id: str, data: PlantCreate) -> dict:
    now = datetime.utcnow()
    base_doc = {
        "userId": _oid(user_id), "name": data.name, "species": data.species,
        "location": data.location, "description": data.description,
        "soil": getattr(data, "soil", None),
        "healthStatus": getattr(data, "healthStatus", None),
        "healthAdvice": getattr(data, "healthAdvice", None),
        "wateringIntervalDays": getattr(data, "wateringIntervalDays", 3),
        "sunlight": getattr(data, "sunlight", "pieno sole"),
        "lastWateredAt": None,
        "imageUrl": data.imageUrl, "imageThumbUrl": getattr(data, "imageThumbUrl", None),
        "geoLat": getattr(data, "geoLat", None), "geoLng": getattr(data, "geoLng", None),
        "placeId": getattr(data, "placeId", None), "addressLocality": getattr(data, "addressLocality", None),
        "createdAt": now, "updatedAt": now,
    }
    res = plants_collection.insert_one(base_doc)
    base_doc["_id"] = res.inserted_id
    return serialize_plant(base_doc)

def update_plant(user_id: str, plant_id: str, data: PlantUpdate) -> Optional[dict]:
    existing = plants_collection.find_one({"_id": _oid(plant_id), "userId": _oid(user_id)})
    if not existing: return None
    update_fields = {}
    for field in ["name", "species", "location", "description", "imageUrl", "imageThumbUrl", "soil", "geoLat", "geoLng", "placeId", "addressLocality", "healthStatus", "healthAdvice"]:
        val = getattr(data, field, None)
        if val is not None: update_fields[field] = val
    if getattr(data, "wateringIntervalDays", None) is not None:
        update_fields["wateringIntervalDays"] = _safe_int(data.wateringIntervalDays, 3)
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
    plant_species = plant.get("species", "generic")
    health_result = cnn_classifier.predict_health(file_bytes, plant_context=plant_species)
    update_payload = {
        "imageUrl": saved["url"],
        "imageThumbUrl": saved["thumbUrl"],
        "healthStatus": health_result["label"],
        "healthAdvice": health_result["advice"],
        "updatedAt": datetime.utcnow()
    }
    plants_collection.update_one({"_id": _oid(plant_id)}, {"$set": update_payload})
    return {
        "imageUrl": saved["url"],
        "imageThumbUrl": saved["thumbUrl"],
        "healthStatus": health_result["label"],
        "healthAdvice": health_result["advice"]
    }

def remove_plant_image(user_id: str, plant_id: str) -> Optional[dict]:
    plants_collection.update_one({"_id": _oid(plant_id), "userId": _oid(user_id)}, {"$unset": {"imageUrl": "", "imageThumbUrl": ""}})
    return serialize_plant(plants_collection.find_one({"_id": _oid(plant_id)}))


# --- AI & METEO

async def calculate_irrigation_for_plant(user_id: str, plant_id: str) -> Dict[str, Any]:
    """
    Funzione chiamata dal Router /ai/irrigazione.
    Sostituita la vecchia logica Pipeline con quella nuova basata su Meteo Reale + Storico Pioggia.
    """
    try:
        print(f"\n[PLANT CONTROLLER] --- NUOVA Logica Attiva per ID: {plant_id} ---")
        
        try: oid = ObjectId(plant_id)
        except: raise HTTPException(400, "ID non valido")

        # Verifica utente e pianta
        plant = plants_collection.find_one({"_id": oid, "userId": _oid(user_id)})
        if not plant: raise HTTPException(404, "Pianta non trovata")

        # 1. METEO REALE
        real_wx = {}
        db_lat = plant.get("geoLat")
        db_lon = plant.get("geoLng")
        db_city = plant.get("location") or plant.get("addressLocality")

        try:
            if db_lat and db_lon:
                print(f"[AI] Uso GPS DB: {db_lat}, {db_lon}")
                real_wx = await weatherController.get_weather_data(lat=db_lat, lon=db_lon)
            elif db_city:
                print(f"[AI] Uso Città DB: {db_city}")
                real_wx = await weatherController.get_weather_data(city=db_city)
            else:
                print("[AI] Nessun dato geografico. Uso default Meteo.")
                real_wx = await weatherController.get_weather_data()
        except Exception as e:
            print(f"[ERR METEO] {e}")

        # 2. UNIONE DATI
        current_wx = plant.get("weather_data", {})
        merged_wx = {
            "temp": real_wx.get("temp", current_wx.get("temp")),
            "humidity": real_wx.get("humidity", current_wx.get("humidity")),
            "et0": real_wx.get("et0", current_wx.get("et0")),
            "solar_rad": real_wx.get("solar_rad", current_wx.get("solar_rad")),
            "wind": real_wx.get("wind", current_wx.get("wind")),
            "rain_trend": real_wx.get("rain_trend") or current_wx.get("rain_trend")
        }
        final_wx = _get_weather_context_fallback(merged_wx)
        prof = plant.get("profile_data") or {"stageNorm": "Vegetativa", "plant_type": plant.get("species", "Generica")}

        # 3. ANALISI PIOGGIA (5 GIORNI)
        past_rain_5days = 0.0
        recent_rain_48h = 0.0
        future_rain_5days = 0.0
        today_str = datetime.now().strftime("%Y-%m-%d")
        yesterday_str = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

        for day in final_wx.get("rain_trend", []):
            d_str = day["date"]
            r = float(day["rain"])
            # Accumulo 5 giorni passati (escluso oggi)
            if d_str < today_str:
                past_rain_5days += r
            # Accumulo 5 giorni futuri
            elif d_str > today_str:
                future_rain_5days += r
            
            # Accumulo Ieri + Oggi
            if d_str == today_str or d_str == yesterday_str:
                recent_rain_48h += r

        print(f"[RAIN CHECK] Ieri+Oggi: {recent_rain_48h:.1f}mm | Totale 5gg Passati: {past_rain_5days:.1f}mm | Futuri: {future_rain_5days:.1f}mm")

        # 4. ACQUA MANUALE
        water_today = _calculate_manual_water_today_db(plant_id)

        # 5. CALCOLO FABBISOGNO (LOGICA DI DECISIONE)
        et0_val = float(final_wx.get("et0", 0.0))
        wind_speed = float(final_wx.get("wind", 0.0))
        
        # Target Base = ET0 Reale (Minimo 1L per garantire irrigazione se non piove)
        target = max(1.0, et0_val)
        
        # Se c'è vento forte (>20km/h), la pianta asciuga prima
        if wind_speed > 20: 
            target += 0.5

        recommendation = "IRRIGARE"
        reason = f"Terreno asciutto (ET0: {et0_val}mm). Serve acqua."

        # --- REGOLE DI BLOCCO (Se scattano, l'irrigazione diventa SKIP) ---
        
        # A. Hai già irrigato?
        if water_today >= target:
            recommendation = "SKIP"
            reason = f"Fabbisogno coperto dall'utente ({water_today}L forniti)."
        
        # B. Ha piovuto molto RECENTEMENTE? (Soglia 5mm in 48h)
        elif recent_rain_48h > 5.0:
            target = 0.0
            recommendation = "SKIP"
            reason = f"Pioggia recente ({recent_rain_48h:.1f}mm)."
        
        # C. Il terreno è zuppo da giorni? (Soglia 40mm in 5gg - molto permissiva)
        elif past_rain_5days > 40.0:
            target = 0.0
            recommendation = "SKIP"
            reason = f"Terreno saturo da piogge passate ({past_rain_5days:.1f}mm)."
        
        # D. Sta per piovere tantissimo? (Soglia 20mm prossimi 5gg)
        elif future_rain_5days > 20.0:
            target = 0.0
            recommendation = "SKIP"
            reason = f"Prevista forte pioggia ({future_rain_5days:.1f}mm). Risparmia acqua."

        # Delta finale
        delta = target - water_today
        if recommendation == "IRRIGARE" and delta <= 0.2:
            recommendation = "SKIP"
            reason = "Fabbisogno soddisfatto."

        print(f"[DECISIONE] Rec: {recommendation} | Delta: {delta:.2f}L | Motivo: {reason}")

        decision = {
            "recommendation": recommendation,
            "reason": reason,
            "quantity": round(max(0, delta), 2),
            # Dati extra per l'AI
            "debug_past_rain": past_rain_5days,
            "debug_future_rain": future_rain_5days
        }

        # 6. AI EXPLAINER
        ai_report = await explain_irrigation_async(
            plant=plant, agg={"weather": final_wx, "profile": prof}, 
            decision=decision, now=datetime.now()
        )

        # 7. SALVA I DATI NELLA PIANTA (Per visualizzarli nel frontend)
        plants_collection.update_one(
            {"_id": oid},
            {"$set": {
                "ai_analysis_report": ai_report,
                "weather_data": final_wx,
                "last_ai_check": datetime.utcnow(),
                "water_today": water_today
            }}
        )

        # Ritorna lo stesso formato che si aspetta il frontend
        # (Nota: Il frontend legge 'ai_analysis_report' o 'recommendation' dall'oggetto ritornato)
        return ai_report

    except Exception as e:
        print(f"[CRITICAL ERROR] {e}")
        raise HTTPException(500, str(e))