import httpx
from datetime import datetime, timedelta

class WeatherController:
    def __init__(self):
        self.base_url_forecast = "https://api.open-meteo.com/v1/forecast"
        self.base_url_history = "https://archive-api.open-meteo.com/v1/archive"
        self.base_url_geocoding = "https://geocoding-api.open-meteo.com/v1/search"
        self.base_url_reverse = "https://nominatim.openstreetmap.org/reverse"

    async def get_coordinates(self, city: str):
        print(f"   >>> [METEO CHECK] Sto chiedendo a Open-Meteo dove si trova: '{city}'...")
        try:
            params = {"name": city, "count": 1, "language": "it", "format": "json"}
            async with httpx.AsyncClient() as client:
                r = await client.get(self.base_url_geocoding, params=params)
                data = r.json()
                if "results" in data and len(data["results"]) > 0:
                    lat = data["results"][0]["latitude"]
                    lon = data["results"][0]["longitude"]
                    name_found = data["results"][0]["name"]
                    country = data["results"][0].get("country", "")
                    print(f"   >>> [METEO SUCCESS] Trovato! {name_found} ({country}) -> Lat: {lat}, Lon: {lon}")
                    return lat, lon
                else:
                    print(f"   >>> [METEO FAIL] Nessuna città trovata con nome: '{city}'")
        except Exception as e:
            print(f"[GEOCODING ERROR] {e}")
        return None, None

    async def _get_city_name_from_coords(self, lat, lon):
        try:
            headers = {'User-Agent': 'GreenfieldAdvisorApp/1.0'}
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{self.base_url_reverse}?lat={lat}&lon={lon}&format=json",
                    headers=headers,
                    timeout=5.0
                )
                if resp.status_code == 200:
                    data = resp.json()
                    addr = data.get("address", {})
                    return addr.get("city") or addr.get("town") or addr.get("village") or addr.get("municipality")
        except Exception as e:
            print(f"[REVERSE GEO ERROR] {e}")
        return None

    # FUNZIONE PER CALCOLARE LA LUCE
    def _estimate_lux(self, radiation_mj):
        """
        Converte la Radiazione Solare (MJ/m^2 giornalieri) in Lux stimati.
        """
        if not radiation_mj or radiation_mj < 0:
            return 0.0
        
        # Conversione MJ/m2/day -> W/m2 medi (assumendo 12h di luce media)
        # 1 MJ = 1,000,000 Joule. 12h = 43200 secondi.
        watts_m2 = (radiation_mj * 1_000_000) / 43200
        
        # Conversione stimata W/m2 -> Lux (Luce solare diretta ~110-120 lux/W)
        lux = watts_m2 * 120 
        return round(lux, 2)
    # -----------------------------------------------------------

    async def get_weather_data(self, lat: float = None, lon: float = None, city: str = None):
        print(f"\n--- [METEO REQUEST] Inizio richiesta meteo ---")
        
        # 1. Risoluzione Coordinate
        if (not lat or not lon) and city:
            lat, lon = await self.get_coordinates(city)
        
        # Fallback nel caso in cui non si riesce a determinare la città in cui ci troviamo
        if not lat or not lon:
            print("   >>> [METEO WARNING] Nè coordinate nè città valide. Uso DEFAULT (Bisceglie).")
            lat, lon = 41.24, 16.50 

        # 2. Risoluzione Nome Città
        location_name = city if city else "Posizione Rilevata"
        if lat and lon and not city:
            detected = await self._get_city_name_from_coords(lat, lon)
            if detected:
                location_name = detected
                print(f"   >>> [GEO] Coordinate {lat},{lon} corrispondono a: {location_name}")

        try:
            async with httpx.AsyncClient() as client:
                # 3. STORICO
                end_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
                start_date = (datetime.now() - timedelta(days=6)).strftime("%Y-%m-%d")
                
                r_hist = await client.get(self.base_url_history, params={
                    "latitude": lat, "longitude": lon,
                    "start_date": start_date, "end_date": end_date,
                    "daily": "precipitation_sum", "timezone": "auto"
                })
                hist_data = r_hist.json() if r_hist.status_code == 200 else {}

                # 4. PREVISIONI
                r_fore = await client.get(self.base_url_forecast, params={
                    "latitude": lat, "longitude": lon,
                    "daily": "temperature_2m_max,relative_humidity_2m_max,precipitation_sum,et0_fao_evapotranspiration,shortwave_radiation_sum,wind_speed_10m_max",
                    "timezone": "auto"
                })
                fore_data = r_fore.json() if r_fore.status_code == 200 else {}

                # 5. Parsing Dati
                rain_trend = []
                seen_dates = set()

                if "daily" in hist_data:
                    dates = hist_data["daily"].get("time", [])
                    rains = hist_data["daily"].get("precipitation_sum", [])
                    for d, r in zip(dates, rains):
                        if d not in seen_dates:
                            rain_trend.append({"date": d, "rain": float(r) if r is not None else 0.0})
                            seen_dates.add(d)

                current_temp = 15.0
                current_hum = 60.0
                current_et0 = 2.0
                current_rad_mj = 0.0 
                current_wind = 10.0
                rain_next_24h = 0.0
                
                if "daily" in fore_data:
                    daily = fore_data["daily"]
                    dates = daily.get("time", [])
                    rains = daily.get("precipitation_sum", [])
                    temps = daily.get("temperature_2m_max", [])
                    hums = daily.get("relative_humidity_2m_max", [])
                    et0s = daily.get("et0_fao_evapotranspiration", [])
                    rads = daily.get("shortwave_radiation_sum", []) # <--- MJ/m2
                    winds = daily.get("wind_speed_10m_max", [])

                    if len(temps) > 0:
                        current_temp = temps[0]
                        current_hum = hums[0]
                        current_et0 = et0s[0]
                        # Recupero Radiazione MJ
                        current_rad_mj = rads[0] if rads and rads[0] is not None else 0.0
                        current_wind = winds[0] if winds and winds[0] is not None else 10.0
                        rain_next_24h = rains[0] if rains and rains[0] is not None else 0.0

                    for i, d in enumerate(dates):
                        if d not in seen_dates:
                            r = rains[i]
                            rain_trend.append({"date": d, "rain": float(r) if r is not None else 0.0})
                            seen_dates.add(d)

                rain_trend.sort(key=lambda x: x['date'])

                # --- CALCOLO LUX (FIX per il grafico) ---
                lux_val = self._estimate_lux(current_rad_mj)
                klux_val = round(lux_val / 1000, 1) 
                # ----------------------------------------

                print(f"   >>> [METEO DATA] Scaricati dati per Lat:{lat}, Lon:{lon}. Temp: {current_temp}°C, Lux: {lux_val}")

                return {
                    "location": {
                        "name": location_name,
                        "lat": lat,
                        "lon": lon
                    },
                    "temp": current_temp,
                    "humidity": current_hum,
                    "et0": current_et0,
                    "rainNext24h": rain_next_24h,
                    "solar_rad": round(current_rad_mj, 1), 
                    "wind": current_wind,
                    "soil_moisture": 50.0,
                    
                    
                    "light": lux_val,  
                    "lux": lux_val,     
                    "klux": klux_val,   
                    

                    "rain_trend": rain_trend
                }

        except Exception as e:
            print(f"[WEATHER ERROR] {e}")
            return {}

weatherController = WeatherController()