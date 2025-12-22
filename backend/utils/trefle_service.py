import os
from typing import Any, Dict, List, Optional, Union
import httpx
from functools import lru_cache

TREFLE_TOKEN = os.getenv("TREFLE_TOKEN")  # obbligatorio
TREFLE_BASE_URL = (os.getenv("TREFLE_BASE_URL", "https://trefle.io/api/v1") or "").rstrip("/")
DEFAULT_TIMEOUT = 12.0


class TrefleError(Exception):
    """Errore generico per il proxy Trefle."""
    pass



# Client & Helpers HTTP
def _ensure_token():
    if not TREFLE_TOKEN:
        raise TrefleError("TREFLE_TOKEN non configurato nelle variabili d'ambiente")


def _client() -> httpx.Client:
    """
    Client HTTP con Authorization: Bearer e timeout.
    """
    headers = {
        "Authorization": f"Bearer {TREFLE_TOKEN}",
        "Accept": "application/json",
        "User-Agent": "HomeGardening/1.0 (+https://example.com)",
    }
    return httpx.Client(timeout=DEFAULT_TIMEOUT, headers=headers)


def _get(path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Esegue una GET verso Trefle usando Authorization: Bearer.
    Ritorna JSON o solleva TrefleError.
    """
    _ensure_token()
    url = f"{TREFLE_BASE_URL}/{path.lstrip('/')}"
    try:
        with _client() as cli:
            r = cli.get(url, params=params or {})
            if r.status_code >= 400:
                raise TrefleError(f"HTTP {r.status_code} – {r.text}")
            return r.json()
    except httpx.RequestError as e:
        raise TrefleError(f"Errore di rete verso Trefle: {str(e)}")


def _safe_get(d: Any, *path, default=None):
    """
    Lettore sicuro per dizionari annidati.
    Esempio: _safe_get(obj, "data", "main_species", "growth", "light")
    """
    cur = d
    for p in path:
        if isinstance(cur, dict) and p in cur:
            cur = cur[p]
        else:
            return default
    return cur


# Euristica di mapping Growth

def _map_sunlight_from_growth(growth: dict) -> Optional[str]:
    """
    Usa growth.light (0-10) e growth.shade (0/1) per mappare:
    - >= 8 → 'pieno sole'
    - 5-7  → 'sole o mezz’ombra'
    - < 5  → 'mezz’ombra' (se shade) altrimenti 'mezz’ombra/sole'
    """
    light = growth.get("light")
    shade = growth.get("shade")

    if light is None and shade is None:
        return None

    try:
        light_val = int(light) if light is not None else None
    except (TypeError, ValueError):
        light_val = None

    if light_val is not None:
        if light_val >= 8:
            return "pieno sole"
        if 5 <= light_val <= 7:
            return "sole o mezz’ombra"
        if light_val < 5:
            return "mezz’ombra" if shade else "mezz’ombra/sole"
    if shade:
        return "mezz’ombra"
    return None


def _map_soil_from_growth(growth: dict) -> Optional[str]:
    """
    Stima del tipo di suolo da alcuni campi growth.
    - soil_texture (0-10): più alto → più sabbioso
    - ph_minimum / ph_maximum
    """
    texture = growth.get("soil_texture")  
    ph_min = growth.get("ph_minimum")
    ph_max = growth.get("ph_maximum")

    try:
        t = int(texture) if texture is not None else None
    except (TypeError, ValueError):
        t = None

    if t is not None:
        if t >= 7:
            soil_descr = "terreno sabbioso o ben drenante"
        elif 4 <= t < 7:
            soil_descr = "terreno franco/limoso"
        else:
            soil_descr = "terreno più argilloso"
    else:
        soil_descr = None

    if ph_min is not None and ph_max is not None:
        ph_str = f"pH {ph_min}–{ph_max}"
        soil_descr = f"{soil_descr} ({ph_str})" if soil_descr else ph_str

    return soil_descr


def _compute_watering_interval_from_growth(growth: dict) -> Optional[int]:
    """
    Stima di intervallo di irrigazione (giorni) in base a growth:
    - moisture_use: 'low' | 'moderate' | 'high'
    - drought_tolerance: 'low' | 'medium' | 'high'
    - maximum_precipitation (mm/mese), se presente → leggero aumento dell'intervallo
    """
    moisture = (growth.get("moisture_use") or "").lower()
    drought = (growth.get("drought_tolerance") or "").lower()
    precip_max = growth.get("maximum_precipitation")

    try:
        pmax = int(precip_max) if precip_max is not None else None
    except (TypeError, ValueError):
        pmax = None

    # baseline
    interval = 4

    if moisture == "high":
        interval = 2
    elif moisture in ("moderate", "medium"):
        interval = 4
    elif moisture == "low":
        interval = 6

    if drought in ("high", "very_high"):
        interval += 2
    elif drought == "medium":
        interval += 1

    if pmax and pmax >= 100:
        interval += 1

    return max(2, min(interval, 10))


def _extract_growth(doc: dict) -> dict:
    """
    Preferisci main_species.growth; fallback a data.growth.
    Dipende da endpoint: /plants/{slug} spesso ha main_species.
    """
    growth = _safe_get(doc, "data", "main_species", "growth")
    if not growth:
        growth = _safe_get(doc, "data", "growth", default={})
    if not isinstance(growth, dict):
        growth = {}
    return growth


# Ricerca robusta (con fallback)
def _map_min_item(item: Dict[str, Any]) -> Dict[str, Any]:
    """
    Unifica il formato dei risultati per il FE (PlantFormModal).
    """
    return {
        "trefleId": item.get("id"),
        "trefleSlug": item.get("slug"),
        "trefleScientificName": item.get("scientific_name"),
        "trefleCommonName": item.get("common_name"),
        "imageUrl": item.get("image_url"),
    }


@lru_cache(maxsize=256)
def search_plants(query: str, page: int = 1, per_page: int = 10) -> List[Dict[str, Any]]:
    """
    Ricerca piante/specie in modo robusto:
    1) /species/search?q=...
    2) fallback → /plants/search?q=...
    3) fallback → /plants?filter[common_name]=...
    4) fallback → /species?filter[scientific_name]=...
    Ritorna lista già mappata con i campi minimi.
    """
    q = (query or "").strip()
    if len(q) < 2:
        return []

    # 1) species/search
    try:
        j = _get("/species/search", params={"q": q, "page": page, "per_page": per_page})
        data = j.get("data", [])
        if data:
            return [_map_min_item(x) for x in data]
    except Exception:
        pass

    # 2) plants/search
    try:
        j = _get("/plants/search", params={"q": q, "page": page, "per_page": per_page})
        data = j.get("data", [])
        if data:
            return [_map_min_item(x) for x in data]
    except Exception:
        pass

    # 3) plants filter common_name
    try:
        j = _get("/plants", params={"filter[common_name]": q, "page": page, "per_page": per_page})
        data = j.get("data", [])
        if data:
            return [_map_min_item(x) for x in data]
    except Exception:
        pass

    # 4) species filter scientific_name
    try:
        j = _get("/species", params={"filter[scientific_name]": q, "page": page, "per_page": per_page})
        data = j.get("data", [])
        if data:
            return [_map_min_item(x) for x in data]
    except Exception:
        pass

    return []


# Dettaglio pianta + raccomandazioni
def _extract_growth_from_payload(payload: Dict[str, Any]) -> dict:
    """
    Estrae growth preferendo data.main_species.growth; fallback a data.growth.
    """
    data = payload.get("data") or {}
    main_species = data.get("main_species") or {}
    growth = main_species.get("growth") or data.get("growth") or {}
    return growth if isinstance(growth, dict) else {}


def _build_detail_response(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Dato il payload Trefle di dettaglio, crea l'output standard:
    {
      "raw": <payload>,
      "recommendations": {...},
      "brief": {...},
      "growth": {...}
    }
    """
    data = payload.get("data") or {}
    growth = _extract_growth_from_payload(payload)

    rec_sunlight = _map_sunlight_from_growth(growth)
    rec_soil = _map_soil_from_growth(growth)
    rec_watering = _compute_watering_interval_from_growth(growth)

    brief = {
        "trefleId": data.get("id"),
        "trefleSlug": data.get("slug"),
        "trefleScientificName": data.get("scientific_name"),
        "trefleCommonName": data.get("common_name"),
        "imageUrl": data.get("image_url"),
        "sunlight": rec_sunlight,
        "soil": rec_soil,
        "wateringIntervalDays": rec_watering,
    }

    return {
        "raw": payload,
        "recommendations": {
            "recommendedSunlight": rec_sunlight,
            "recommendedSoil": rec_soil,
            "recommendedWateringIntervalDays": rec_watering,
        },
        "brief": brief,
        "growth": growth,
    }


@lru_cache(maxsize=256)
def fetch_plant_detail(id_or_slug: Union[int, str]) -> Dict[str, Any]:
    """
    Recupera il dettaglio tentando:
      1) /species/{id_or_slug}
      2) /plants/{id_or_slug}
    Ritorna un dict con: raw, recommendations, brief, growth.
    """
    ident = str(id_or_slug).strip()

    # 1) species/{id_or_slug}
    try:
        payload = _get(f"/species/{ident}")
        if payload and payload.get("data"):
            return _build_detail_response(payload)
    except Exception as e:
        print(f"[TREFLE] species/{ident} fallita: {e}")

    # 2) plants/{id_or_slug}
    try:
        payload = _get(f"/plants/{ident}")
        if payload and payload.get("data"):
            return _build_detail_response(payload)
    except Exception as e:
        print(f"[TREFLE] plants/{ident} fallita: {e}")

    raise TrefleError(f"Dettaglio Trefle non disponibile per '{ident}'")


def fetch_plant_by_id(trefle_id: Union[int, str]) -> Dict[str, Any]:
    return fetch_plant_detail(trefle_id)



@lru_cache(maxsize=256)
def fetch_brief_and_recommendations(id_or_slug: Union[int, str]) -> Dict[str, Any]:
    """
    Ritorna solo:
      {
        "brief": {...},
        "recommendations": {...}
      }
    """
    full = fetch_plant_detail(id_or_slug)
    return {
        "brief": full.get("brief"),
        "recommendations": full.get("recommendations"),
    }