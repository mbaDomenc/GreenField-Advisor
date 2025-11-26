import httpx
import logging
import re
from fastapi import HTTPException

logger = logging.getLogger(__name__)

class WeatherController:
    """
    Gestisce il recupero dei dati meteo da Open-Meteo.
    Include logica avanzata per pulizia nomi città e fallback.
    """
    
    async def get_weather_data(self, city: str = None, lat: float = None, lon: float = None):
        
        location_name = "Posizione sconosciuta"
        
        # 1. GEOCODING (Se non abbiamo le coordinate)
        if lat is None or lon is None:
            if not city:
                raise HTTPException(status_code=400, detail="Coordinate o Città non specificate")

            # Tentativo 1: Pulizia Standard (Rimuove numeri e CAP)
            # Es: "73014 Gallipoli LE, Italia" -> "Gallipoli LE"
            city_clean = city.split(',')[0]
            city_clean = re.sub(r'\d+', '', city_clean).strip()
            
            logger.info(f"🌤️  Meteo: Cerco città '{city_clean}' (Originale: '{city}')")
            
            coords = await self._fetch_coords(city_clean)
            
            # Tentativo 2: Fallback "Solo prima parola" (Se il primo fallisce)
            # Es: Se "Gallipoli LE" fallisce, prova "Gallipoli"
            if not coords and len(city_clean.split()) > 1:
                city_simple = city_clean.split()[0]
                logger.info(f"⚠️  Meteo: Fallito '{city_clean}', riprovo con '{city_simple}'")
                coords = await self._fetch_coords(city_simple)

            if not coords:
                logger.error(f"❌ Meteo: Città '{city}' non trovata neanche dopo pulizia.")
                raise HTTPException(status_code=404, detail=f"Città '{city}' non trovata")
                
            lat = coords["latitude"]
            lon = coords["longitude"]
            location_name = coords["name"]
        else:
            location_name = city or "Posizione GPS"

        # 2. METEO (Open-Meteo Forecast)
        try:
            # Assicuriamoci che lat/lon siano float
            lat = float(lat)
            lon = float(lon)
            
            weather_url = "https://api.open-meteo.com/v1/forecast"
            params_wx = {
                "latitude": lat,
                "longitude": lon,
                "current": "temperature_2m,relative_humidity_2m,rain,soil_moisture_0_to_7cm,shortwave_radiation",
                "timezone": "auto"
            }
            
            async with httpx.AsyncClient() as client:
                wx_res = await client.get(weather_url, params=params_wx, timeout=10.0)
                wx_data = wx_res.json()
            
            if "error" in wx_data:
                logger.error(f"❌ Errore API Meteo: {wx_data}")
                raise HTTPException(status_code=502, detail="Errore provider meteo")

            current = wx_data.get("current", {})

            # Normalizzazione Dati
            # Suolo (m3/m3 -> %)
            raw_soil = current.get("soil_moisture_0_to_7cm")
            soil_pct = min(100.0, max(0.0, (raw_soil or 0.0) * 100))

            # Luce (W/m2 -> Lux approx)
            raw_rad = current.get("shortwave_radiation")
            light_lux = (raw_rad or 0.0) * 120.0

            return {
                "status": "success",
                "location": {"name": location_name, "lat": lat, "lng": lon},
                "temp": current.get("temperature_2m", 20.0),
                "humidity": current.get("relative_humidity_2m", 50.0),
                "rainNext24h": current.get("rain", 0.0),
                "soil_moisture": round(soil_pct, 1),
                "light": round(light_lux, 0)
            }

        except Exception as e:
            logger.exception(f"❌ Eccezione Meteo: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Errore recupero meteo: {str(e)}")

    async def _fetch_coords(self, query):
        """Helper interno per geocoding"""
        try:
            url = "https://geocoding-api.open-meteo.com/v1/search"
            params = {"name": query, "count": 1, "language": "it", "format": "json"}
            async with httpx.AsyncClient() as client:
                res = await client.get(url, params=params, timeout=5.0)
                data = res.json()
                if data.get("results"):
                    return data["results"][0]
        except Exception as e:
            logger.error(f"Geocoding error: {e}")
        return None

weatherController = WeatherController()