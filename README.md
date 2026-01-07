# 🌱 GreenField-Advisor

**Piattaforma DSS (Decision Support System) per Agricoltura di Precisione basata su AI Ibrida.**

> Integrazione di **ANFIS (MLP)**, **CNN (MobileNetV2)** e **LLM** per raccomandazioni irrigue, diagnosi malattie e analisi predittiva.

---

## 📋 Indice

- [Architettura](#architettura)
- [Stack Tecnologico](#stack-tecnologico)
- [Prerequisiti](#prerequisiti)
- [Installazione](#installazione)
- [Configurazione](#configurazione)
- [Avvio Applicazione](#avvio-applicazione)
- [Dataset](#dataset)
- [API Documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)
- [Autori](#autori)
- [Licenza](#licenza)
- [Supporto](#supporto)


---

<a name="architettura"></a>
## 🏗️ Architettura

Struttura del progetto e organizzazione delle directory:

```text
GreenField-Advisor/
├── backend/   # FastAPI + Python (AI Services, Pipeline, Controllers)
├── frontend/  # React + TailwindCSS (Dashboard SPA)
└── README.md
```

---

**Pattern Implementati:**
- **Strategy**: Algoritmi intercambiabili per stima irrigazione (TomatoStrategy, PotatoStrategy, etc.)
- **Chain of Responsibility**: Pipeline modulare (DataValidator → FeatureEngineer → IrrigationEstimator)
- **Adapter**: Normalizzazione immagini eterogenee (EXIF, GPS, thumbnail)

---

<a name="stack-tecnologico"></a>
## 🛠️ Stack Tecnologico

### Backend
- **Framework**: FastAPI 0.116.1
- **Database**: MongoDB (Motor async driver)
- **AI/ML**: 
  - scikit-learn (ANFIS/MLP)
  - TensorFlow + Keras (CNN MobileNetV2)
  - OpenRouter API (LLM - Gemini, Llama, Mistral)
- **Librerie Agro**: pyfao56 (coefficienti colturali FAO56)

### Frontend
- **Framework**: React 18.x
- **Styling**: TailwindCSS
- **HTTP Client**: Axios
- **Routing**: React Router

---

<a name="prerequisiti"></a>
## ✅ Prerequisiti

### Requisiti di Sistema
- **Python**: 3.10 o superiore
- **Node.js**: 16.x o superiore
- **npm**: 8.x o superiore
- **MongoDB**: 4.4 o superiore (locale o Atlas)

### Verifica Installazione
```bash
# Verifica Python
python --version   # oppure python3 --version

# Verifica Node.js e npm
node --version
npm --version

# Verifica MongoDB (se locale)
mongod --version
```

---

<a name="installazione"></a>
## 📦 Installazione

### 🪟 Windows

### 1️⃣ Backend Setup
```powershell
# Naviga nella cartella backend
cd backend

# Crea ambiente virtuale Python
python -m venv venv

# Attiva ambiente virtuale
venv\Scripts\activate

# Aggiorna pip
python -m pip install --upgrade pip

# Installa dipendenze
pip install -r requirements.txt

# NOTA: Se riscontri errori con TensorFlow, installa la versione CPU:
# pip install tensorflow-cpu
```

### 2️⃣ Frontend Setup
```powershell
# Apri un NUOVO terminale e naviga nella cartella frontend
cd frontend

# Installa dipendenze Node.js
npm install

# Opzionale: Risolvi vulnerabilità (se richiesto)
npm audit fix
```

---

### 🍎 macOS/Linux

### 1️⃣ Backend Setup
```bash
# Naviga nella cartella backend
cd backend

# Crea ambiente virtuale Python
python3 -m venv venv

# Attiva ambiente virtuale
source venv/bin/activate

# Aggiorna pip
python -m pip install --upgrade pip

# Installa dipendenze
pip install -r requirements.txt

# NOTA: Su macOS con Apple Silicon (M1/M2), potrebbe essere necessario:
# brew install hdf5
# export HDF5_DIR=/opt/homebrew/opt/hdf5
```

### 2️⃣ Frontend Setup
```bash
# Apri un NUOVO terminale e naviga nella cartella frontend
cd frontend

# Installa dipendenze Node.js
npm install

# Opzionale: Risolvi vulnerabilità (se richiesto)
npm audit fix
```

---

<a name="configurazione"></a>
## ⚙️ Configurazione

**Backend - Variabili d'Ambiente**

Crea un file .env nella cartella backend/ con le seguenti variabili:

```text
# MongoDB
MONGODB_URL=mongodb://localhost:27017
DB_NAME=greenfield_db

# JWT
SECRET_KEY=your-secret-key-here-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# OpenWeatherMap API (opzionale)
OPENWEATHER_API_KEY=your-openweathermap-api-key

# OpenRouter API (per LLM)
OPENROUTER_API_KEY=your-openrouter-api-key

# HuggingFace API (fallback LLM)
HF_API_KEY=your-huggingface-api-key
```

Ottieni le API keys gratuite:
- **OpenWeatherMap**: https://openweathermap.org/api
- **OpenRouter**: https://openrouter.ai/
- **HuggingFace**: https://huggingface.co/settings/tokens

**Frontend - Configurazione API Endpoint**

Se il backend non è su **localhost:8000**, modifica **frontend/src/services/api.js**:

```javascript
const API_BASE_URL = 'http://localhost:8000/api';
```

---

<a name="avvio-applicazione"></a>
## 🚀 Avvio Applicazione

### 🪟 Windows

**Terminale 1 - Backend**
```powershell
cd backend
venv\Scripts\activate
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Terminale 2 - Frontend**
```powershell
cd frontend
npm start
```

---

### 🍎 macOS/Linux

**Terminale 1 - Backend**
```powershell
cd backend
source venv/bin/activate
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Terminale 2 - Frontend**
```powershell
cd frontend
npm start
```

---

## ✅ Verifica Funzionamento

Dopo l'avvio, dovresti vedere:

**Backend**
```text
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Application startup complete.
```

**Frontend**
```text
Compiled successfully!

You can now view greenfield-advisor in the browser.

  Local:            http://localhost:3000
  On Your Network:  http://192.168.x.x:3000
```

Accedi all'applicazione:
- Frontend: http://localhost:3000
- API Docs (Swagger): http://localhost:8000/docs
- MongoDB: **mongodb://localhost:27017/greenfield_db**

---

<a name="dataset"></a>
## 📊 Dataset

**PlantVillage Dataset (CNN Training)**

Il modello CNN MobileNetV2 è stato addestrato sul dataset PlantVillage:

**Link Kaggle**: https://www.kaggle.com/datasets/emmarex/plantdisease

---

<a name="api-documentation"></a>
## 📖 API Documentation

Una volta avviato il backend, la documentazione interattiva è disponibile su:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

** Endpoint Principali **

```text
POST   /api/auth/login              - Autenticazione utente
GET    /api/plants                  - Lista piante
POST   /api/plants                  - Crea nuova pianta
GET    /api/plants/{id}             - Dettagli pianta
POST   /api/sensors/data            - Invia lettura sensore
POST   /api/images/upload           - Upload immagine per analisi CNN
GET    /api/pipeline/process        - Esegui pipeline AI completa
POST   /api/interventions           - Registra intervento agricolo
GET    /api/weather                 - Dati meteo correnti
```

---

<a name="troubleshooting"></a>
## 🐛 Troubleshooting

**Problema**: *ModuleNotFoundError: No module named 'fastapi'*
**Soluzione**: Verifica che l'ambiente virtuale sia attivo e reinstalla dipendenze:
```bash
pip install -r requirements.txt
```

**Problema**: *Port 8000 already in use*
**Soluzione**: Cambia porta o termina processo esistente:
```bash
# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:8000 | xargs kill -9
```

**Problema:  MongoDB Connection Failed**
**Soluzione**: Verifica che MongoDB sia in esecuzione:
```bash
# Windows (se servizio)
net start MongoDB

# macOS/Linux
brew services start mongodb-community
# oppure
sudo systemctl start mongod
```

**Problema**: *npm ERR! ERESOLVE unable to resolve dependency tree*
**Soluzione**: Usa flag legacy peer deps:
```bash
# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:8000 | xargs kill -9
```

**Problema**: *Port 8000 already in use*
**Soluzione**: Cambia porta o termina processo esistente:
```bash
npm install --legacy-peer-deps
```

**Problema: TensorFlow Installation Errors (Apple Silicon M1/M2)**
**Soluzione**: Installa versione compatibile:
```bash
pip install tensorflow-macos tensorflow-metal
```

---

<a name="autori"></a>
## 👥 Autori

- Domenico D'Ambrosio
- Mauro Pasquale
- Fabrizio Corsini

**Corso di Laurea Magistrale in Ingegneria Informatica**
**Curriculum**: Artificial Intelligence and Data Science
**A.A.** 2025/2026

---

<a name="licenza"></a>
##  📄 Licenza
Questo progetto è sviluppato per scopi accademici.

---

<a name="supporto"></a>
## 📞 Supporto
Per problemi o domande:
- Issues GitHub: Apri una Issue

---

**Made with 🌱 by GreenField Team**
