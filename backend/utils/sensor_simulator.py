# backend/utils/sensor_simulator.py
import random
import time
import os
from datetime import datetime
import math
from typing import Optional
from pymongo import MongoClient
from dotenv import load_dotenv

# Carica variabili da .env
load_dotenv()


class SensorSimulator:
    """Simulatore di sensori IoT per il giardino"""

    def __init__(self, mongo_uri=None, db_name=None):
        # Leggi da .env usando i nomi corretti delle variabili
        self.mongo_uri = mongo_uri or os.getenv("MONGO_URI", "mongodb://localhost:27017/")
        self.db_name = db_name or os.getenv("MONGO_DB", "homegardening")
        self.collection_name = "sensor_data"

        # Connessione MongoDB
        try:
            self.client = MongoClient(self.mongo_uri)
            self.db = self.client[self.db_name]
            self.collection = self.db[self.collection_name]
            # Test connessione
            self.client.server_info()
            print(f"✅ Connesso a MongoDB: {self.db_name}")
        except Exception as e:
            print(f"❌ Errore connessione MongoDB: {e}")
            raise

        self.sensors_config = {
            "temp_sensor_1": {
                "type": "temperature",
                "unit": "°C",
                "base": 22.0,
                "variation": 5.0,
                "location": "garden_zone_1"
            },
            "temp_sensor_2": {
                "type": "temperature",
                "unit": "°C",
                "base": 21.5,
                "variation": 4.0,
                "location": "garden_zone_2"
            },
            "hum_sensor_1": {
                "type": "humidity",
                "unit": "%",
                "base": 60.0,
                "variation": 15.0,
                "location": "garden_zone_1"
            },
            "soil_sensor_1": {
                "type": "soil_moisture",
                "unit": "%",
                "base": 45.0,
                "variation": 10.0,
                "location": "garden_zone_1"
            },
            "ph_sensor_1": {
                "type": "ph",
                "unit": "pH",
                "base": 6.5,
                "variation": 0.5,
                "location": "garden_zone_1"
            },
            "light_sensor_1": {
                "type": "light",
                "unit": "lux",
                "base": 5000.0,
                "variation": 3000.0,
                "location": "garden_zone_1"
            }
        }
        self.time_offset = 0

    def generate_realistic_value(self, sensor_id: str, config: dict) -> float:
        """Genera un valore realistico con pattern giornalieri"""
        # Simula ciclo giornaliero (es: temperatura più alta di giorno)
        hour_of_day = (datetime.utcnow().hour + self.time_offset) % 24
        daily_factor = math.sin((hour_of_day - 6) * math.pi / 12)  # Picco a mezzogiorno

        base_value = config["base"]
        variation = config["variation"]

        # Aggiungi effetto giornaliero per temperatura e luce
        if config["type"] in ["temperature", "light"]:
            value = base_value + (daily_factor * variation * 0.6) + random.uniform(-variation * 0.4, variation * 0.4)
        else:
            # Altri sensori: variazione più casuale
            value = base_value + random.uniform(-variation, variation)

        # Limita i valori a range realistici
        if config["type"] == "humidity" or config["type"] == "soil_moisture":
            value = max(0, min(100, value))
        elif config["type"] == "ph":
            value = max(4.0, min(9.0, value))
        elif config["type"] == "light":
            value = max(0, value)

        return round(value, 2)

    def send_reading(self, sensor_id: str, config: dict) -> bool:
        """Salva una lettura direttamente su MongoDB"""
        value = self.generate_realistic_value(sensor_id, config)

        data = {
            "sensor_id": sensor_id,
            "sensor_type": config["type"],
            "value": value,
            "unit": config["unit"],
            "timestamp": datetime.utcnow(),
            "location": config["location"]
        }

        try:
            result = self.collection.insert_one(data)
            print(f"✅ {sensor_id} ({config['type']}): {value} {config['unit']} - ID: {result.inserted_id}")
            return True

        except Exception as e:
            print(f"❌ MongoDB error: {e}")
            return False

    def run(self, interval_seconds: int = 60, duration_minutes: Optional[int] = None):
        """
        Esegue il simulatore continuamente

        Args:
            interval_seconds: Intervallo tra le letture (default: 60 secondi)
            duration_minutes: Durata totale in minuti (None = infinito)
        """
        print(f"🚀 Starting sensor simulator...")
        print(f"📊 Saving to MongoDB: {self.db_name}.{self.collection_name}")
        print(f"⏱️  Interval: {interval_seconds} seconds")
        print(f"🔢 Active sensors: {len(self.sensors_config)}")
        print("-" * 60)

        start_time = time.time()
        iteration = 0

        try:
            while True:
                iteration += 1
                print(f"\n[Iteration {iteration}] {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}")

                # Invia dati da tutti i sensori
                for sensor_id, config in self.sensors_config.items():
                    self.send_reading(sensor_id, config)

                # Controlla se deve fermarsi
                if duration_minutes:
                    elapsed_minutes = (time.time() - start_time) / 60
                    if elapsed_minutes >= duration_minutes:
                        print(f"\n✅ Simulation completed after {duration_minutes} minutes")
                        break

                # Aspetta prima della prossima iterazione
                print(f"⏳ Waiting {interval_seconds} seconds...")
                time.sleep(interval_seconds)

        except KeyboardInterrupt:
            print("\n\n⚠️  Simulator stopped by user (Ctrl+C)")
            self.client.close()
            print("✅ Connessione MongoDB chiusa")
        except Exception as e:
            print(f"\n❌ Unexpected error: {e}")
            self.client.close()


def run_simulator_cli():
    """Funzione per eseguire il simulatore da riga di comando"""
    import argparse

    parser = argparse.ArgumentParser(description="Sensor Simulator for Home Gardening")
    parser.add_argument(
        "--mongo-uri",
        type=str,
        default=None,
        help="MongoDB URI (default: from .env MONGO_URI)"
    )
    parser.add_argument(
        "--db-name",
        type=str,
        default=None,
        help="Database name (default: from .env MONGO_DB)"
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=60,
        help="Interval between readings in seconds (default: 60)"
    )
    parser.add_argument(
        "--duration",
        type=int,
        default=None,
        help="Duration in minutes (default: infinite)"
    )

    args = parser.parse_args()

    simulator = SensorSimulator(mongo_uri=args.mongo_uri, db_name=args.db_name)
    simulator.run(interval_seconds=args.interval, duration_minutes=args.duration)


# Esecuzione diretta
if __name__ == "__main__":
    run_simulator_cli()
