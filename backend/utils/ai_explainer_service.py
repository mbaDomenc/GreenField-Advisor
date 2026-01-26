import os
import asyncio
import logging
from typing import Dict, Any, Optional, Tuple
from datetime import datetime
import httpx

logger = logging.getLogger(__name__)

# URL API 
HF_API_URL = "https://openrouter.ai/api/v1/chat/completions"

# Modelli di fallback in ordine di preferenza
HF_FALLBACK_MODELS = [
    "xiaomi/mimo-v2-flash:free",                        # Primario
    "meta-llama/llama-3.3-70b-instruct:free",           # Fallback 1
    "google/gemini-2.0-flash-lite-preview-02-05:free",  # Fallback 2
    "google/gemini-2.0-pro-exp-02-05:free",             # Fallback 3
]

def _fmt(v, unit: Optional[str] = None):
    if v is None: return "n/d"
    try:
        s = f"{float(v):.1f}"
        return f"{s}{unit}" if unit else s
    except: return "n/d"


def _format_rain_trend(trend: list, today_date: str) -> str:
    if not trend: return "Nessun dato."
    past, future = [], []
    today_str = today_date[:10] 
    for item in trend:
        d = item.get("date", "")
        r = item.get("rain", 0.0)
        if r > 0.5:
            entry = f"{d[5:]} ({r:.0f}mm)"
            if d < today_str: past.append(entry)
            elif d >= today_str: future.append(entry)
    
    p_str = ", ".join(past) if past else "Assente"
    f_str = ", ".join(future) if future else "Assente"
    return f"Passata: {p_str}. Futura: {f_str}"


def _get_season(now: datetime) -> str:
    m = now.month
    if 3 <= m <= 5: return "Primavera"
    if 6 <= m <= 8: return "Estate"
    if 9 <= m <= 11: return "Autunno"
    return "Inverno"


def _fallback_text(reason: str, decision: Dict[str, Any]) -> str:
    action = decision.get("recommendation", "—")
    return f"💧 CONSIGLIO: {action}. (Analisi AI momentaneamente non disponibile: {reason})"


def _prepare_prompt(plant: Dict[str, Any], agg: Dict[str, Any], decision: Dict[str, Any], now: datetime) -> str:
    meta_wx = agg.get("weather") or {}
    
    rec = decision.get("recommendation")
    qty = decision.get("quantity", 0)
    
    # Dati Nascosti 
    calc_val = _fmt(decision.get("debug_anfis"), "L")
    user_water = _fmt(decision.get("debug_user_water"), "L")
    past_rain = _fmt(decision.get("debug_past_rain"), "mm")
    future_rain = _fmt(decision.get("debug_future_rain"), "mm")

    # Info Concimazione
    fert_info = decision.get("debug_fertilizer_info") 
    
    # Istruzione Concimazione
    if fert_info:
        fert_instr = f"L'utente ha già concimato ({fert_info}). Rispondi: '🌿 CONCIMAZIONE: Non necessaria (Già effettuata: {fert_info}).'"
    else:
        fert_instr = "Nessuna concimazione recente. Consiglia una concimazione NPK equilibrata."

    season = _get_season(now)

    return f"""
Sei un ASSISTENTE AGRONOMO professionale e sintetico.

[DATI E CONDIZIONI]
Pianta: {plant.get('name')}
Stagione: {season}
Meteo: {_fmt(meta_wx.get('temp'), '°C')}, Pioggia 5gg passati: {past_rain}, previsti: {future_rain}.
Acqua data oggi: {user_water}

[RISULTATO ANALISI]
- Fabbisogno calcolato: {calc_val}
- Consiglio: {rec} (Qtà: {qty}L)
- Istruzione Concimazione: {fert_instr}

[REGOLE RIGIDE DI FORMATTAZIONE]
1. Usa SOLO ed ESCLUSIVAMENTE le emoji indicate nel formato qui sotto (💧, 🌿, 💡) all'inizio della riga.
2. VIETATO inserire altre emoji (niente faccine, niente mani che salutano, niente frutti) all'interno delle frasi.
3. Tono: Professionale, diretto, niente saluti iniziali (tipo "Ciao!"). Vai dritto al punto.
4. Non usare termini tecnici complessi (no "ANFIS").

FORMATO RISPOSTA OBBLIGATORIO:
💧 IRRIGAZIONE: [Testo del consiglio, senza emoji aggiuntive]
🌿 CONCIMAZIONE: [Testo del consiglio, senza emoji aggiuntive]
💡 NOTE: [Breve nota tecnica, senza emoji aggiuntive]
""".strip()


async def _call_hf_text_generation_async(model: str, prompt: str) -> Tuple[Optional[str], Optional[int], Optional[str]]:
    api_key = os.getenv("OPENROUTER_API_KEY") or os.getenv("HF_API_KEY")
    if not api_key:
        logger.error("❌ Nessuna API key trovata (OPENROUTER_API_KEY o HF_API_KEY)")
        return None, None, "No Key"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://greenfield-advisor.com",
        "X-Title": "Greenfield Advisor"
    }
    
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "Sei un agronomo AI. Rispondi in Italiano. Usa le emoji (💧, 🌿, 💡) SOLO come punto elenco a inizio riga. NON usare assolutamente altre emoji o faccine nel testo. Sii professionale e molto dettagliato."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.3, 
        "max_tokens": 800
    }

    try:
        logger.info(f"🔄 Tentativo con modello: {model}")
        async with httpx.AsyncClient(timeout=45.0) as cli:
            r = await cli.post(HF_API_URL, headers=headers, json=payload)
            
            if r.status_code == 200:
                j = r.json()
                content = j.get("choices", [])[0].get("message", {}).get("content")
                tokens = j.get("usage", {}).get("total_tokens")
                
                if content:
                    logger.info(f"✅ SUCCESSO con modello: {model} (tokens: {tokens})")
                    return content.strip(), tokens, None
                else:
                    logger.warning(f"⚠️ Modello {model} - Risposta vuota")
                    return None, None, "Empty response"
            else:
                error_msg = f"Status {r.status_code}"
                logger.warning(f"⚠️ Modello {model} fallito: {error_msg}")
                logger.debug(f"Response body: {r.text[:200]}")
                return None, None, error_msg
                
    except Exception as e:
        logger.error(f"❌ Errore con {model}: {str(e)}")
        return None, None, str(e)


async def explain_irrigation_async(*, plant: Dict[str, Any], agg: Dict[str, Any], decision: Dict[str, Any], now: datetime) -> Dict[str, Any]:
    api_key = os.getenv("HF_API_KEY") or os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        logger.error("❌ Manca API Key nel .env")
        return {"text": _fallback_text("Manca API Key", decision), "usedLLM": False}

    logger.info(f"🚀 Inizio ciclo fallback con {len(HF_FALLBACK_MODELS)} modelli")
    prompt = _prepare_prompt(plant, agg, decision, now)
    
    for i, model in enumerate(HF_FALLBACK_MODELS, 1):
        logger.info(f"📡 [{i}/{len(HF_FALLBACK_MODELS)}] Provo modello: {model}")
        text, tokens, err = await _call_hf_text_generation_async(model, prompt)
        
        if text:
            logger.info(f"🎉 SUCCESS! Modello {model} ha risposto correttamente!")
            return {"text": text, "usedLLM": True, "model": model, "tokens": tokens}
        
        logger.warning(f"⏭️ Passo al prossimo modello (errore: {err})")
        await asyncio.sleep(1)

    logger.error("❌ TUTTI I MODELLI HANNO FALLITO - Uso fallback testuale")
    return {"text": _fallback_text("Server occupati", decision), "usedLLM": False}


get_ai_explanation = explain_irrigation_async
