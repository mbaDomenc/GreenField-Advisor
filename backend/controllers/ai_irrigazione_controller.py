import os
from datetime import datetime, timedelta
from typing import List, Dict, Any
from bson import ObjectId
from fastapi import HTTPException
from dateutil import parser 

# Database e Servizi
from database import db
from controllers.weather_controller import weatherController
from utils.ai_explainer_service import explain_irrigation_async
from utils.ai_anfis_service import anfisService

# --- HELPER ---
def parse_date_safe(date_val):
    if not date_val: return None
    if isinstance(date_val, datetime): return date_val
    try: return parser.parse(str(date_val))
    except: return None

def _get_weather_context_fallback(existing_data: dict = None) -> dict:
    data = (existing_data or {}).copy()
    if data.get("temp") is None: data["temp"] = 15.0
    if data.get("humidity") is None: data["humidity"] = 60.0
    if data.get("et0") is None: data["et0"] = 2.0
    if data.get("solar_rad") is None: data["solar_rad"] = 400.0
    if data.get("wind") is None: data["wind"] = 10.0
    if not data.get("rain_trend"): data["rain_trend"] = []
    return data

def _calculate_manual_water_today(plant_id_str: str) -> float:
    try:
        start_of_day = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        pipeline = [
            {"$match": {
                "plantId": plant_id_str, 
                "type": "irrigazione", 
                "executedAt": {"$gte": start_of_day}
            }},
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
            print(f"   [MANUAL WATER] Trovati: {val}L oggi.")
            return val
        return 0.0
    except Exception as e:
        print(f"[ERR MANUAL WATER] {e}")
        return 0.0

# --- CONTROLLO CONCIMAZIONE ---
def _check_recent_fertilization(plant_id_str: str, plant_oid=None) -> str:
    """
    Controlla se c'è stata una concimazione negli ultimi 15 giorni.
    Ritorna una stringa descrittiva (es. "50g in data 20/12") o None.
    """
    try:
        limit_date = datetime.utcnow() - timedelta(days=15)
        
        search_ids = [plant_id_str]
        if plant_oid: search_ids.append(plant_oid)

        # Cerca l'ultimo intervento di tipo 'concimazione'
        last_fert = db["interventi"].find_one(
            {
                "plantId": {"$in": search_ids},
                "type": "concimazione",
                "executedAt": {"$gte": limit_date}
            },
            sort=[("executedAt", -1)]
        )

        if last_fert:
            qty = last_fert.get("dose") or last_fert.get("liters") or "dose standard"
            exec_dt = parse_date_safe(last_fert.get("executedAt"))
            date_str = exec_dt.strftime("%d/%m") if exec_dt else "?"
            
            info = f"{qty} in data {date_str}"
            print(f"   [MANUAL FERT] Trovata concimazione: {info}")
            return info
        
        print("   [MANUAL FERT] Nessuna concimazione recente trovata.")
        return None
    except Exception as e:
        print(f"[AI ERROR] Fert check: {e}")
        return None

# --- CORE LOGIC ---

async def compute_for_plant(plant: dict) -> Dict[str, Any]:
    try:
        # Recupero ID Robusto
        raw_id = plant.get("_id") or plant.get("id")
        if not raw_id: raise HTTPException(400, "ID Mancante")
        
        plant_id_str = str(raw_id)
        # Creiamo plant_oid da usare per le query al DB e il salvataggio
        try: plant_oid = ObjectId(plant_id_str)
        except: plant_oid = None

        print(f"\n[AI IBRIDA] --- Analisi per: {plant.get('name')} ---")

        # 1. METEO REALE
        real_wx = {}
        # Logica recupero meteo
        db_lat = plant.get("geoLat")
        db_lon = plant.get("geoLng")
        db_city = plant.get("location") or plant.get("addressLocality")
        try:
            if db_lat and db_lon:
                real_wx = await weatherController.get_weather_data(lat=db_lat, lon=db_lon)
            elif db_city:
                real_wx = await weatherController.get_weather_data(city=db_city)
            else:
                real_wx = await weatherController.get_weather_data()
        except: pass

        merged_wx = {
            "temp": real_wx.get("temp", 20.0),
            "humidity": real_wx.get("humidity", 50.0),
            "et0": real_wx.get("et0", 2.5),
            "solar_rad": real_wx.get("solar_rad", 400.0),
            "wind": real_wx.get("wind", 10.0),
            "rain_trend": real_wx.get("rain_trend", [])
        }
        final_wx = _get_weather_context_fallback(merged_wx)
        prof = plant.get("profile_data") or {"stageNorm": "Vegetativa", "plant_type": plant.get("species", "Generica")}

        # 2. PIOGGIA
        past_rain_5days = 0.0
        recent_rain_48h = 0.0
        future_rain_5days = 0.0
        rain_tomorrow = 0.0
        
        today_str = datetime.now().strftime("%Y-%m-%d")
        yesterday_str = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        tomorrow_str = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

        for day in final_wx.get("rain_trend", []):
            d_str = day["date"]
            r = float(day["rain"])
            if d_str < today_str: past_rain_5days += r
            elif d_str > today_str: future_rain_5days += r
            if d_str == today_str or d_str == yesterday_str: recent_rain_48h += r
            if d_str == tomorrow_str: rain_tomorrow = r

        print(f"   [PIOGGIA] Ieri+Oggi: {recent_rain_48h:.1f}mm | Ultimi 5gg: {past_rain_5days:.1f}mm")

        # 3. MODELLO ANFIS
        try:
            theoretical_liters = anfisService.predict(
                temp=float(final_wx["temp"]),
                humidity=float(final_wx["humidity"]),
                rain=float(rain_tomorrow), 
                et0=float(final_wx["et0"])
            )
            theoretical_liters = max(0.5, theoretical_liters)
        except:
            theoretical_liters = max(1.0, float(final_wx["et0"])) 

        print(f"   [ANFIS] Fabbisogno Stimato: {theoretical_liters:.2f}L")

        # 4. CONTROLLI MANUALI (ACQUA E CONCIME)
        water_today = _calculate_manual_water_today(plant_id_str)
        recent_fertilizer = _check_recent_fertilization(plant_id_str, plant_oid)
        

        # 5. SUPERVISORE (REGOLE DI BLOCCO ACQUA)
        target = theoretical_liters
        recommendation = "IRRIGARE"
        reason = f"Modello ANFIS suggerisce {theoretical_liters:.2f}L."

        if water_today >= target:
            recommendation = "SKIP"
            reason = f"Fabbisogno ({theoretical_liters:.2f}L) coperto dall'utente."
        elif recent_rain_48h > 5.0:
            target = 0.0
            recommendation = "SKIP"
            reason = f"Stop per pioggia recente ({recent_rain_48h:.1f}mm)."
        elif past_rain_5days > 40.0:
            target = 0.0
            recommendation = "SKIP"
            reason = f"Terreno saturo ({past_rain_5days:.1f}mm negli ultimi 5gg)."
        elif future_rain_5days > 20.0:
            target = 0.0
            recommendation = "SKIP"
            reason = f"Prevista pioggia abbondante ({future_rain_5days:.1f}mm)."

        delta = max(0.0, target - water_today)
        if recommendation == "IRRIGARE" and delta <= 0.2:
            recommendation = "SKIP"
            reason = "Fabbisogno idrico soddisfatto."

        print(f"   [DECISIONE] {recommendation} | Delta: {delta:.2f}L")

        # 6. DATI PER LLM
        decision = {
            "recommendation": recommendation,
            "reason": reason,
            "quantity": round(delta, 2),
            
            "debug_anfis": theoretical_liters,
            "debug_past_rain": past_rain_5days,
            "debug_future_rain": future_rain_5days,
            "debug_user_water": water_today,
            "debug_recent_rain": recent_rain_48h,
            
            # INFO CONCIME
            "debug_fertilizer_info": recent_fertilizer 
        }

        # 7. CHIAMATA AI EXPLAINER
        final_wx["rainNext24h"] = rain_tomorrow
        ai_report = await explain_irrigation_async(
            plant=plant, agg={"weather": final_wx, "profile": prof}, 
            decision=decision, now=datetime.now()
        )

        # 8. SALVATAGGIO
        if plant_oid:
            db["piante"].update_one(
                {"_id": plant_oid},
                {"$set": {
                    "ai_analysis_report": ai_report,
                    "weather_data": final_wx,
                    "last_ai_check": datetime.utcnow(),
                    "water_today": water_today
                }}
            )

        # 9. RISPOSTA
        return {
            "decision": decision, 
            "recommendation": decision["recommendation"],
            "reason": decision["reason"],
            "liters": decision["quantity"],
            "weather": final_wx,
            "explanationLLM": ai_report.get("text"),
            "tech": "Hybrid:ANFIS+Rules"
        }

    except Exception as e:
        print(f"[CRITICAL ERROR] {e}")
        return {"recommendation": "SKIP", "reason": f"Errore: {str(e)}", "liters": 0}

async def compute_batch(plants: list):
    results = []
    for p in (plants or []):
        try:
            res = await compute_for_plant(p)
            pid = str(p.get("_id") or p.get("id"))
            res["id"] = pid
            results.append(res)
        except: continue
    return results