# Carica .env all'avvio ---
from dotenv import load_dotenv
import os

# Carica le variabili d'ambiente dal file .env nella root
load_dotenv()

import sys
if sys.version_info < (3, 10):
    import importlib.metadata
    import importlib_metadata
    importlib.metadata.packages_distributions = importlib_metadata.packages_distributions

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from config import settings
from database import db
from controllers.interventionsController import ensure_interventions_indexes
from utils.ai_explainer_service import get_ai_explanation

# Import dei Router
from routers import interventionsRouter
from routers import trefleRouter
from routers import weatherRouter
from routers import pipelineRouter
from routers import sensorRouter
from routers import imageRouter
from routers import aiRouter 
from routers import userRouter, plantsRouter
from routers import authRouter

import logging

# Configurazione logging dettagliato
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Abilito debug per il modulo AI
logging.getLogger("ai").setLevel(logging.DEBUG)
logging.getLogger("httpx").setLevel(logging.WARNING)  # Riduci rumore HTTP

# Creazione directory upload se non esiste
uploads_dir = Path(settings.UPLOAD_DIR)
uploads_dir.mkdir(parents=True, exist_ok=True)

# Inizializzazione App
app = FastAPI(
    title="Greenfield Advisor API",
    description="API backend per la piattaforma Greenfield Advisor - Consulenza Agronomica AI",
    version="2.0.0",
)

# Configurazione CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static Files (per servire le immagini caricate)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

# ---- Registrazione Router ----
app.include_router(userRouter.router, prefix="/api/utenti", tags=["utenti"])
app.include_router(plantsRouter.router) 
app.include_router(interventionsRouter.router)
app.include_router(trefleRouter.router)
app.include_router(weatherRouter.router)
app.include_router(sensorRouter.router)
app.include_router(imageRouter.router)
app.include_router(pipelineRouter.router)
app.include_router(aiRouter.router)
app.include_router(authRouter.router, prefix="/api/auth", tags=["Authentication"])

@app.get("/health")
def health():
    # Verifica al volo se la chiave AI è letta correttamente
    ai_key = os.getenv("HF_API_KEY")
    ai_status = "OK" if ai_key and "sk-" in ai_key else "MANCANTE/INVALIDA"
    
    return {
        "status": "ok", 
        "service": "Greenfield Advisor",
        "system_check": {
            "ai_api_key": ai_status,
            "ai_model": os.getenv("HF_MODEL", "Default"),
            "database": "Connected"
        }
    }

@app.on_event("startup")
def init_indexes():
    # Indici Utenti
    try:
        db["utenti"].create_index("email", unique=True, name="uniq_email")
        db["utenti"].create_index("username", unique=True, name="uniq_username")
    except Exception as e:
        print(f"[WARN] user indexes: {e}")

    # Indici Piante
    try:
        db["piante"].create_index([("userId", 1), ("createdAt", -1)], name="idx_user_createdAt")
        db["piante"].create_index([("userId", 1), ("name", 1)], name="idx_user_name")
        db["piante"].create_index([("userId", 1), ("species", 1)], name="idx_user_species")
    except Exception as e:
        print(f"[WARN] plants indexes: {e}")

    # Indici Interventi
    try:
        ensure_interventions_indexes()
    except Exception as e:
        print(f"[WARN] interventions indexes: {e}")
