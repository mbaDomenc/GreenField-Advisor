from typing import Optional, Dict, Any, List, Tuple
from fastapi import UploadFile, HTTPException
from pymongo.collection import Collection
from pymongo import DESCENDING
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime, timedelta
from PIL import Image
from io import BytesIO
import os
import random
import dateutil.parser 

from utils.images import save_image_bytes
from config import settings
from utils.ai_explainer_service import explain_irrigation_async
from controllers.weather_controller import weatherController

class ImageController:
    
    def __init__(self, collection: Collection):
        self.collection = collection
        print(f" ImageController inizializzato con collection: {collection.name}")
    
    def validate_objectid(self, imageid: str) -> ObjectId:
        try: return ObjectId(imageid)
        except InvalidId: raise ValueError(f"ID immagine non valido: {imageid}")

    def _get_weather_context_fallback(self, existing_data: dict = None) -> dict:
        data = (existing_data or {}).copy()
        if data.get("temp") is None: data["temp"] = 15.0
        if data.get("humidity") is None: data["humidity"] = 60.0
        if data.get("et0") is None: data["et0"] = 2.0
        if data.get("solar_rad") is None: data["solar_rad"] = 400.0
        if data.get("wind") is None: data["wind"] = 10.0
        if not data.get("rain_trend"): data["rain_trend"] = []
        return data

    def _enrich_image_for_frontend(self, image: dict) -> dict:
        if "_id" in image:
            image["id"] = str(image["_id"])
            del image["_id"]

        wx = image.get("weather_data", {})
        prof = image.get("profile_data", {})
        image["et0"] = wx.get("et0", 0)
        image["ET0"] = wx.get("et0", 0)
        image["solar_radiation"] = wx.get("solar_rad", 0)
        image["solarRadiation"] = wx.get("solar_rad", 0)
        image["wind"] = wx.get("wind", 0)
        image["rain_trend"] = wx.get("rain_trend", [])
        image["weather_data"] = wx
        image["profile_data"] = prof
        return image

    def _calculate_manual_water_today(self, plant_id_str: str) -> float:
        try:
            start_of_day = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            db = self.collection.database
            pipeline = [
                {"$match": {"plantId": plant_id_str, "type": "irrigazione", "executedAt": {"$gte": start_of_day}}},
                {"$group": {"_id": None, "total": {"$sum": "$liters"}}}
            ]
            res = list(db["interventi"].aggregate(pipeline))
            if not res:
                try:
                    pipeline[0]["$match"]["plantId"] = ObjectId(plant_id_str)
                    res = list(db["interventi"].aggregate(pipeline))
                except: pass
            if res: return float(res[0]["total"])
            return 0.0
        except: return 0.0

    async def analyze_irrigation(self, plant_id: str) -> dict:
        try:
            print(f"\n[IMAGE CONTROLLER] --- Nuova Analisi per ID: {plant_id} ---")
            
            oid = self.validate_objectid(plant_id)
            plant = self.collection.find_one({"_id": oid})
            if not plant: raise HTTPException(404, "Pianta non trovata")

            # 1. METEO
            real_wx = {}
            try:
                lat = plant.get("geoLat")
                lon = plant.get("geoLng")
                city = plant.get("location")
                if lat and lon:
                    real_wx = await weatherController.get_weather_data(lat=lat, lon=lon)
                elif city:
                    real_wx = await weatherController.get_weather_data(city=city)
                else:
                    real_wx = await weatherController.get_weather_data()
            except Exception as e: print(f"Err meteo: {e}")

            current_wx = plant.get("weather_data", {})
            merged_wx = {
                "temp": real_wx.get("temp", current_wx.get("temp")),
                "humidity": real_wx.get("humidity", current_wx.get("humidity")),
                "et0": real_wx.get("et0", current_wx.get("et0")),
                "solar_rad": real_wx.get("solar_rad", current_wx.get("solar_rad")),
                "wind": real_wx.get("wind", current_wx.get("wind")),
                "soil_moisture": 40.0,
                "rain_trend": real_wx.get("rain_trend") or current_wx.get("rain_trend")
            }
            final_wx = self._get_weather_context_fallback(merged_wx)
            prof = plant.get("profile_data") or {"stageNorm": "Vegetativa", "plant_type": "Generica"}

            # 2. ANALISI PIOGGIA
            past_rain_5days = 0.0
            recent_rain_48h = 0.0
            future_rain_5days = 0.0
            today_str = datetime.now().strftime("%Y-%m-%d")
            yesterday_str = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
            
            for day in final_wx.get("rain_trend", []):
                d_str = day["date"]
                r = float(day["rain"])
                if d_str < today_str: past_rain_5days += r
                elif d_str > today_str: future_rain_5days += r
                if d_str == today_str or d_str == yesterday_str: recent_rain_48h += r

            # 3. ACQUA MANUALE
            water_today = self._calculate_manual_water_today(str(oid))

            # 4. CALCOLO TARGET
            et0_val = float(final_wx.get("et0", 0.0))
            wind_speed = float(final_wx.get("wind", 0.0))
            
            target = max(1.0, et0_val)
            if wind_speed > 20: target += 0.5

            recommendation = "IRRIGARE"
            reason = f"Terreno asciutto (ET0: {et0_val}mm). Serve acqua."

            # REGOLE DI BLOCCO
            if water_today >= target:
                recommendation = "SKIP"
                reason = f"Fabbisogno coperto ({water_today}L forniti)."
            elif recent_rain_48h > 5.0:
                target = 0.0
                recommendation = "SKIP"
                reason = f"Pioggia recente ({recent_rain_48h:.1f}mm)."
            elif past_rain_5days > 40.0:
                target = 0.0
                recommendation = "SKIP"
                reason = f"Terreno saturo ({past_rain_5days:.1f}mm)."
            elif future_rain_5days > 20.0:
                target = 0.0
                recommendation = "SKIP"
                reason = f"Prevista pioggia ({future_rain_5days:.1f}mm)."

            delta = target - water_today
            if recommendation == "IRRIGARE" and delta <= 0.2:
                recommendation = "SKIP"
                reason = "Fabbisogno soddisfatto."

            print(f"[DECISIONE] Rec: {recommendation} | Delta: {delta:.2f}L")

            decision = {
                "recommendation": recommendation,
                "reason": reason,
                "quantity": round(max(0, delta), 2)
            }

            ai_report = await explain_irrigation_async(
                plant=plant, agg={"weather": final_wx, "profile": prof}, 
                decision=decision, now=datetime.now()
            )

            self.collection.update_one(
                {"_id": oid},
                {"$set": {
                    "ai_analysis_report": ai_report, 
                    "weather_data": final_wx,
                    "last_ai_check": datetime.utcnow(),
                    "water_today": water_today
                }}
            )
            return ai_report

        except Exception as e:
            print(f"Errore: {e}")
            raise HTTPException(500, str(e))
    
    # --- CRUD STANDARD 
    async def upload_image(self, file: UploadFile, planttype: str = None, location: str = None, sensorid: str = None, notes: str = None) -> dict:
        if not file.content_type.startswith("image/"): raise HTTPException(400, "File non valido")
        imagedata = await file.read()
        metadata = self.extract_image_metadata(imagedata, file.filename)
        saved_paths = self.save_image_to_filesystem(imagedata)
        wx = self._get_weather_context_fallback()
        doc = {
            "filename": os.path.basename(saved_paths["abs"]),
            "originalfilename": file.filename,
            "filepathfull": saved_paths["abs"],
            "filepaththumb": saved_paths["absThumb"],
            "urlfull": saved_paths["url"],
            "urlthumb": saved_paths["thumbUrl"],
            "planttype": planttype or "Generica",
            "location": location,
            "sensorid": sensorid,
            "uploadtimestamp": datetime.utcnow(),
            "processed": False,
            "notes": notes,
            "metadata": metadata,
            "weather_data": wx,
            "profile_data": {"stageNorm": "Vegetativa", "plant_type": planttype},
            "water_today": 0.0
        }
        res = self.collection.insert_one(doc)
        doc["_id"] = res.inserted_id
        return {"status": "success", "image": self._enrich_image_for_frontend(doc)}

    def list_images(self, limit: int = 100, processed: bool = None, planttype: str = None, location: str = None) -> dict:
        q = {}
        if processed is not None: q["processed"] = processed
        if planttype: q["planttype"] = planttype
        if location: q["location"] = location
        raw = list(self.collection.find(q).limit(limit).sort("uploadtimestamp", DESCENDING))
        return {"status": "success", "images": [self._enrich_image_for_frontend(i) for i in raw], "count": len(raw)}

    def get_image_details(self, imageid: str) -> dict:
        oid = self.validate_objectid(imageid)
        img = self.collection.find_one({"_id": oid})
        if not img: raise HTTPException(404, "Non trovata")
        return {"status": "success", "image": self._enrich_image_for_frontend(img)}

    def delete_image(self, imageid: str) -> dict:
        oid = self.validate_objectid(imageid)
        img = self.collection.find_one({"_id": oid})
        if not img: raise HTTPException(404, "Non trovata")
        self.delete_image_files(img.get("filepathfull"), img.get("filepaththumb"))
        self.collection.delete_one({"_id": oid})
        return {"status": "success", "message": "Eliminata"}

    def extract_image_metadata(self, imagedata, filename):
        try:
            img = Image.open(BytesIO(imagedata))
            return {"width": img.width, "height": img.height, "format": img.format}
        except: return {}

    def save_image_to_filesystem(self, imagedata):
        datesubdir = datetime.utcnow().strftime("%Y%m%d")
        subdir = f"plant_images/{datesubdir}"
        return save_image_bytes(data=imagedata, subdir=subdir, basename=None, maxside=1280, thumbside=384, webpquality=82)

    def delete_image_files(self, f1, f2):
        for f in [f1, f2]:
            if f and os.path.exists(f): os.remove(f)