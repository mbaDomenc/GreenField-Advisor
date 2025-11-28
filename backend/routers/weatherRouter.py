from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from controllers.weather_controller import weatherController 

router = APIRouter(prefix="/api/weather", tags=["weather"])

@router.get("", summary="Ottieni dati meteo attuali")
async def get_weather(
    city: Optional[str] = Query(None, description="Nome della città"),
    lat: Optional[float] = Query(None, description="Latitudine"),
    lon: Optional[float] = Query(None, description="Longitudine")
):
    """
    Ottiene meteo da Open-Meteo.
    Usa 'lat' e 'lon' per precisione massima.
    """
    if not city and (lat is None or lon is None):
        raise HTTPException(status_code=400, detail="Specifica 'city' oppure 'lat' e 'lon'")

    return await weatherController.get_weather_data(city=city, lat=lat, lon=lon)