# backend/routes/weather_router.py
from fastapi import APIRouter, Query
from controllers.weather_controller import weatherController

router = APIRouter(prefix="/api", tags=["weather"])

@router.get("/weather")
async def weather(city: str = Query(..., description="Es: Bari, IT")):
    """
    Proxy verso Open-Meteo.
    Restituisce: Temperatura, Umidità, Pioggia, Luce stimata e Umidità Suolo stimata.
    """
    # Chiamiamo il metodo della nuova classe
    return await weatherController.get_weather_data(city)