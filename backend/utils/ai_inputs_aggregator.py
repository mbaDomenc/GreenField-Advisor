import os
import time
from typing import Optional, Dict, Any
from datetime import datetime
import math

from utils.nasa_power_service import get_daily_point, compute_et0_hargreaves
from utils.weather_service import get_weather as get_openmeteo
from utils.copernicus_soil_service import get_soil_moisture
from utils.fao_profile_service import get_profile

_AGG_CACHE: Dict[str, Dict[str, Any]] = {}
_AGG_TTL = int(os.getenv("AI_AGGR_TTL_SECONDS", "900"))  # 15 min
_GRID_PREC = int(os.getenv("AI_AGGR_GRID_PRECISION", "2"))

SENTINELS = {-999, -999.0, -9999, -9999.0}

def _key(lat: float, lng: float) -> str:
    return f"{round(lat, _GRID_PREC)}:{round(lng, _GRID_PREC)}"

def _expired(e: Dict[str, Any]) -> bool:
    return time.time() > e.get("expires_at", 0)

def _parse_dt(dt) -> Optional[datetime]:
    if not dt:
        return None
    if isinstance(dt, datetime):
        return dt
    try:
        return datetime.fromisoformat(str(dt).replace('Z', ''))
    except Exception:
        return None

def _estimate_soil_moisture_from_air_humidity(rh: Optional[float]) -> Optional[float]:
    # Stima grezza: utile in assenza di API per dati suolo
    if isinstance(rh, (int, float)):
        return float(max(10.0, min(95.0, rh)))
    return None

def _days_since(dt: Optional[datetime], now: datetime) -> Optional[int]:
    if not dt:
        return None
    try:
        return max(0, (now - dt).days)
    except Exception:
        return None

def _baseline_from_stage(stage: Optional[str]) -> int:
    s = (stage or "").lower()
    if s in ("iniziale", "initial", "semina", "trapianto"):
        return 2
    if s in ("medio", "mid", "crescita", "fioritura"):
        return 2
    if s in ("finale", "late", "maturazione", "raccolta"):
        return 3
    return 3

def _san(v):
    return None if (v is None or v in SENTINELS) else float(v)

def _ra_extraterrestrial(lat_deg: float, doy: int) -> Optional[float]:
    try:
        lat = math.radians(float(lat_deg))
        dr = 1 + 0.033 * math.cos(2 * math.pi * doy / 365.0)
        delta = 0.409 * math.sin(2 * math.pi * doy / 365.0 - 1.39)
        w_s = math.acos(-math.tan(lat) * math.tan(delta))
        G_sc = 0.0820
        Ra = (24 * 60 / math.pi) * G_sc * dr * (
            w_s * math.sin(lat) * math.sin(delta) +
            math.cos(lat) * math.cos(delta) * math.sin(w_s)
        )
        return float(Ra)
    except Exception:
        return None

def get_inputs(plant: Dict[str, Any], now: Optional[datetime] = None) -> Dict[str, Any]:
    """
    Aggrega profilo FAO, NASA POWER (giornaliero), Open-Meteo (orario+daily),
    Copernicus (suolo) e applica fallback/derivazioni.
    """
    now = now or datetime.utcnow()
    lat = plant.get("geoLat")
    lng = plant.get("geoLng")
    had_geo = isinstance(lat, (int, float)) and isinstance(lng, (int, float))

    profile = get_profile(
        species=plant.get("species"),
        category=None,
        stage=plant.get("stage"),
    )

    last_dt = _parse_dt(plant.get("lastWateredAt"))
    days_since_last = _days_since(last_dt, now)
    baseline = plant.get("wateringIntervalDays") or _baseline_from_stage(plant.get("stage"))

    if not had_geo:
        return {
            "hadGeo": False,
            "geo": None,
            "profile": profile,
            "weather": {
                "temp": None,
                "humidity": None,
                "rainNext24h": None,
                "precipDaily": None,
                "et0": None,
                "solarRadiation": None,
                "wind": None,
                "soilMoistureApprox": None,
                "soilMoisture0to7cm": None,
                "source": "NONE",
                "fallbacks": {}
            },
            "daysSinceLast": days_since_last,
            "baselineInterval": baseline,
            "raw": {}
        }

    key = _key(lat, lng)
    if key in _AGG_CACHE and not _expired(_AGG_CACHE[key]):
        cached = _AGG_CACHE[key]["value"]
    else:
        nasa = get_daily_point(lat, lng, now=now) or {}
        om   = get_openmeteo(lat, lng) or {}
        soil = get_soil_moisture(lat, lng) or {}

        fallbacks = {}

        #  base meteo
        temp = om.get("temp") if om.get("temp") is not None else nasa.get("temp")
        humidity = om.get("humidity") if om.get("humidity") is not None else nasa.get("humidity")
        rainNext24h = om.get("rainNext24h")
        # OM daily
        om_tmin = _san(om.get("dailyTempMin"))
        om_tmax = _san(om.get("dailyTempMax"))
        om_pday = _san(om.get("precipDaily"))
        om_wind_mean = _san(om.get("windMean"))

        # NASA avanzati
        et0 = _san(nasa.get("et0"))
        solarRadiation = _san(nasa.get("solarRadiation"))
        wind = _san(nasa.get("wind"))
        precipDaily = _san(nasa.get("precipDaily"))

        # precipDaily fallback
        if precipDaily is None:
            if om_pday is not None:
                precipDaily = om_pday
                fallbacks["precipDaily"] = "open-meteo-daily"
            elif isinstance(rainNext24h, (int, float)):
                precipDaily = float(rainNext24h)
                fallbacks["precipDaily"] = "rainNext24h"

        #  ET0 fallback (Hargreaves) se NASA non disponibile
        if et0 is None:
            # prendi Tmin/Tmax/Tmean da NASA, altrimenti OM daily
            tmin = _san(nasa.get("tempMin")) if nasa.get("tempMin") is not None else om_tmin
            tmax = _san(nasa.get("tempMax")) if nasa.get("tempMax") is not None else om_tmax
            tmean = _san(nasa.get("temp"))
            if tmean is None and tmin is not None and tmax is not None:
                tmean = (tmin + tmax) / 2.0
            if tmin is not None and tmax is not None and tmean is not None:
                et0 = compute_et0_hargreaves(lat, tmin, tmax, tmean, now=now)
                if et0 is not None:
                    fallbacks["et0"] = "hargreaves(nasa/om)"

        #  wind fallback (media OM 6h)
        if wind is None and om_wind_mean is not None:
            wind = om_wind_mean
            fallbacks["wind"] = "open-meteo(6h-mean)"

        # solarRadiation fallback (Ra stimata informativa)
        if solarRadiation is None:
            ra = _ra_extraterrestrial(lat, now.timetuple().tm_yday)
            if ra is not None:
                solarRadiation = ra
                fallbacks["solarRadiation"] = "Ra(FAO-56-estimate)"

        # suolo
        soil_moisture_0_7 = soil.get("soilMoisture0to7cm")
        soil_moisture_approx = soil_moisture_0_7
        if soil_moisture_approx is None:
            soil_moisture_approx = _estimate_soil_moisture_from_air_humidity(humidity)
            if soil_moisture_approx is not None:
                fallbacks["soilMoistureApprox"] = "from-air-humidity"

        value = {
            "hadGeo": True,
            "geo": {"lat": lat, "lng": lng},
            "profile": profile,
            "weather": {
                "temp": float(temp) if isinstance(temp, (int, float)) else None,
                "humidity": float(humidity) if isinstance(humidity, (int, float)) else None,
                "rainNext24h": float(rainNext24h) if isinstance(rainNext24h, (int, float)) else 0.0,

                "soilMoistureApprox": float(soil_moisture_approx) if isinstance(soil_moisture_approx, (int, float)) else None,
                "soilMoisture0to7cm": float(soil_moisture_0_7) if isinstance(soil_moisture_0_7, (int, float)) else None,

                "precipDaily": float(precipDaily) if isinstance(precipDaily, (int, float)) else None,
                "et0": float(et0) if isinstance(et0, (int, float)) else None,
                "solarRadiation": float(solarRadiation) if isinstance(solarRadiation, (int, float)) else None,
                "wind": float(wind) if isinstance(wind, (int, float)) else None,
                "source": "AGGR(NASA+OM+Soil)",
                "fallbacks": fallbacks
            },
            "raw": {
                "nasa": nasa,
                "openmeteo": om,
                "soil": soil
            }
        }
        _AGG_CACHE[key] = {"value": value, "expires_at": time.time() + _AGG_TTL}
        cached = value

    cached = dict(cached)
    cached["daysSinceLast"] = days_since_last
    cached["baselineInterval"] = baseline
    return cached

aggregate_inputs = get_inputs