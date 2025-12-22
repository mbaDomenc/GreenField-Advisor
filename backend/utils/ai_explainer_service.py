import os
import asyncio
from typing import Dict, Any, Optional, Tuple
from datetime import datetime
import httpx

# URL API (OpenRouter o simili)
HF_API_URL = "https://openrouter.ai/api/v1/chat/completions"

# Modelli di fallback
HF_FALLBACK_MODELS = [
    "microsoft/phi-3.5-mini-128k-instruct",       
    "google/gemini-2.0-flash-exp:free",           
    "meta-llama/llama-3.2-11b-vision-instruct:free",
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
    prof = agg.get("profile") or {}
    
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
        fert_instr = f"L'utente ha già concimato ({fert_info}). Rispondi: '✅ CONCIMAZIONE: Non necessaria (Già effettuata: {fert_info}). Ottimo lavoro!'"
    else:
        fert_instr = "Nessuna concimazione recente. Consiglia gentilmente una concimazione NPK equilibrata per la stagione."

    rain_trend_str = _format_rain_trend(meta_wx.get("rain_trend", []), now.isoformat())
    season = _get_season(now)

    return f"""
Sei un ASSISTENTE AGRONOMO amichevole e professionale. 
Il tuo obiettivo è guidare l'utente nella cura della sua pianta con un tono chiaro, incoraggiante e moderno.

[DATI PIANTA]
🌿 Nome: {plant.get('name')} ({plant.get('species')})
📅 Stagione: {season}

[CONDIZIONI AMBIENTALI]
🌡️ Temperatura: {_fmt(meta_wx.get('temp'), '°C')}
🌧️ Pioggia Recente (5gg): {past_rain}
☔ Previsioni Pioggia (5gg): {future_rain}

[STORICO INTERVENTI UTENTE]
💧 Acqua data oggi: {user_water}
💊 Concimazione recente: {fert_info if fert_info else "NESSUNA"}

[RISULTATO ANALISI AGRONOMICA]
(Questi dati provengono da calcoli complessi, NON citare 'ANFIS' o 'Modello', parla di 'fabbisogno calcolato' o 'analisi')
- Fabbisogno Teorico: {calc_val}
- Consiglio Finale: {rec} (Quantità suggerita: {qty}L)

[ISTRUZIONI DI SCRITTURA]
1. Usa un tono moderno, chiaro e qualche emoji appropriata (💧, 🌿, 🌦️, ✅) solo all'inizio della frase.
2. NON usare termini tecnici come "ANFIS", "Algoritmo" o "Modello Predittivo". Usa frasi come "Dall'analisi dei dati...", "Considerando il meteo...", "Il fabbisogno calcolato...".
3. Spiega il "PERCHÉ" della decisione in modo semplice.
   - Esempio: "💧 IRRIGAZIONE: Non serve annaffiare oggi. Hai già fornito acqua a sufficienza e il terreno risulta umido grazie alle piogge recenti."
4. Segui rigorosamente le istruzioni sulla concimazione date sopra.

FORMATO RISPOSTA (NO MARKDOWN, SOLO TESTO PULITO):
💧 IRRIGAZIONE: [Tuo consiglio amichevole]
🌿 CONCIMAZIONE: [Tuo consiglio]
💡 NOTE: [Una piccola chicca o consiglio extra per la stagione]
""".strip()

async def _call_hf_text_generation_async(model: str, prompt: str) -> Tuple[Optional[str], Optional[int], Optional[str]]:
    api_key = os.getenv("HF_API_KEY") or os.getenv("OPENROUTER_API_KEY")
    if not api_key: return None, None, "No Key"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://greenfield-advisor.com",
        "X-Title": "Greenfield Advisor"
    }
    
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "Sei un agronomo AI amichevole. Rispondi in Italiano. Usa Emoji. No Markdown."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.4, 
        "max_tokens": 800
    }

    try:
        async with httpx.AsyncClient(timeout=40.0) as cli:
            r = await cli.post(HF_API_URL, headers=headers, json=payload)
            if r.status_code != 200: return None, None, f"Status {r.status_code}"
            j = r.json()
            content = j.get("choices", [])[0].get("message", {}).get("content")
            return content.strip() if content else None, j.get("usage", {}).get("total_tokens"), None
    except Exception as e:
        return None, None, str(e)

async def explain_irrigation_async(*, plant: Dict[str, Any], agg: Dict[str, Any], decision: Dict[str, Any], now: datetime) -> Dict[str, Any]:
    api_key = os.getenv("HF_API_KEY") or os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        return {"text": _fallback_text("Manca API Key", decision), "usedLLM": False}

    prompt = _prepare_prompt(plant, agg, decision, now)
    
    for model in HF_FALLBACK_MODELS:
        print(f"[AI] Provo modello: {model}...")
        text, tokens, err = await _call_hf_text_generation_async(model, prompt)
        if text:
            print(f"[AI SUCCESS] Modello {model} ha risposto!")
            return {"text": text, "usedLLM": True, "model": model}
        await asyncio.sleep(1)

    return {"text": _fallback_text("Server occupati", decision), "usedLLM": False}

get_ai_explanation = explain_irrigation_async