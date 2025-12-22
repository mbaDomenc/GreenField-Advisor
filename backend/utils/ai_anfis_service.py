import numpy as np
import random
import os
import joblib
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import StandardScaler

# Percorsi assoluti per evitare problemi di cartelle
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "trained_model.pkl")
SCALER_PATH = os.path.join(BASE_DIR, "scaler.pkl")

class AnfisIrrigationModel:
    def __init__(self):
        # Usiamo un MLPRegressor (Rete Neurale) per simulare l'apprendimento
        self.model = MLPRegressor(
            hidden_layer_sizes=(16, 8), 
            activation='relu',
            solver='adam',
            max_iter=2000, 
            random_state=42
        )
        self.scaler = StandardScaler()
        self.is_trained = False
        
        # Tenta il caricamento, se fallisce o non esiste il modello, addestra subito nuovamente
        if not self.load_model():
            print("[ANFIS] Modello non trovato o da rigenerare. Avvio Training...")
            self.train_model()

    def load_model(self):
        """Carica il modello se esiste su disco"""
        if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
            try:
                self.model = joblib.load(MODEL_PATH)
                self.scaler = joblib.load(SCALER_PATH)
                self.is_trained = True
                print("[ANFIS] Modello caricato da disco.")
                return True
            except Exception as e:
                print(f"[ANFIS] Errore caricamento: {e}")
                return False
        return False

    def generate_synthetic_data(self, n_samples=2000):
        X = []
        y = []
        
        for _ in range(n_samples):
            # 1. Variabili di Input (Range realistici e vari)
            temp = random.uniform(0, 45)      # Da 0°C a 45°C
            hum = random.uniform(10, 100)     # Da 10% a 100%
            
            # Pioggia: Più probabile se l'umidità è alta
            if hum > 70 and random.random() > 0.6:
                rain = random.uniform(0, 50)  # Fino a 50mm
            else:
                rain = 0.0
            
            # ET0: Dipende molto dalla temperatura
            et0 = (temp * 0.15) + random.uniform(0, 1.5)
            et0 = max(0.5, et0)

            #2.
            # Fabbisogno Base = ET0 * coeff (es. 1.0)
            water_need = et0 * 1.0
            if temp > 30: water_need *= 1.2    
            if hum < 30: water_need *= 1.1     
            
            # Sottrazione Pioggia (Efficiente al 80%)
            effective_rain = rain * 0.8
            water_need -= effective_rain
            
            # Limite fisico: l'acqua non può essere negativa
            water_need = max(0.0, water_need)
            water_need += random.uniform(-0.1, 0.1)
            water_need = max(0.0, water_need)

            X.append([temp, hum, rain, et0])
            y.append(water_need)
            
        return np.array(X), np.array(y)

    def train_model(self):
        """Esegue il TRAINING del modello e salva i file."""
        print("[ANFIS] Generazione dataset e training in corso...")
        
        # 1. Genera dati
        X_train, y_train = self.generate_synthetic_data()
        
        # 2. Normalizzazione dei dati
        X_scaled = self.scaler.fit_transform(X_train)
        
        # 3. Addestra
        self.model.fit(X_scaled, y_train)
        self.is_trained = True
        
        # 4. Salva
        joblib.dump(self.model, MODEL_PATH)
        joblib.dump(self.scaler, SCALER_PATH)
        
        score = self.model.score(X_scaled, y_train)
        print(f"[ANFIS] Training completato. R^2 Score: {score:.4f}")
        return {"status": "success", "accuracy": score}

    def predict(self, temp, humidity, rain, et0):
        """Usa il modello per prevedere l'irrigazione"""
        # Gestione valori None
        if temp is None: temp = 20.0
        if humidity is None: humidity = 50.0
        if rain is None: rain = 0.0
        if et0 is None: et0 = 3.0

        if not self.is_trained:
            print("[ANFIS] Modello non addestrato, uso fallback.")
            return max(0.0, (et0 * 1.0) - rain)

        # Prepara input
        input_data = np.array([[temp, humidity, rain, et0]])
        # Normalizza input usando lo stesso scaler del training
        input_scaled = self.scaler.transform(input_data)
        
        # Predizione
        prediction = self.model.predict(input_scaled)[0]
        return max(0.0, round(prediction, 2))

# Istanza globale
anfisService = AnfisIrrigationModel()