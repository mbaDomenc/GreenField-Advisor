import React, { useEffect, useState, useCallback } from 'react';
import { Brain, ArrowLeft, RefreshCw } from 'lucide-react';
import { api } from '../api/axiosInstance';
import AIIrrigationCard from '../components/AIIrrigationCard';

function getPlaceholderImage(plant) {
  const q = encodeURIComponent(plant?.species || plant?.name || 'plant');
  return `https://source.unsplash.com/featured/800x450?${q},garden,botany`;
}

const AIIrrigationPage = ({ onBack }) => {
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [loadingPlants, setLoadingPlants] = useState(new Set());
  const [recommendations, setRecommendations] = useState({});
  const [weatherMap, setWeatherMap] = useState({});
  const [error, setError] = useState(null);

  // 1. CHIAMATA AI
  const askForAdvice = useCallback(async (plant) => {
    if (!plant?.id) return;
    setLoadingPlants(prev => new Set([...prev, plant.id]));
    try {
      const { data } = await api.post(`/api/piante/${plant.id}/ai/irrigazione`, {});
      setRecommendations(prev => ({ ...prev, [plant.id]: data }));
    } catch (err) {
      console.error("Errore AI", err);
      setRecommendations(prev => ({ 
        ...prev, 
        [plant.id]: { error: 'Analisi fallita. Riprova.' } 
      }));
    } finally {
      setLoadingPlants(prev => { const s = new Set(prev); s.delete(plant.id); return s; });
    }
  }, []);

  // 2. METEO LIVE
  const fetchPlantWeather = useCallback(async (plant) => {
    if (!plant) return;
    try {
      let url = null;
      if (plant.geoLat && plant.geoLng) {
        url = `/api/weather?lat=${plant.geoLat}&lon=${plant.geoLng}`;
      } else if (plant.location) {
        url = `/api/weather?city=${encodeURIComponent(plant.location)}`;
      }
      if (!url) return;
      const { data } = await api.get(url);
      setWeatherMap(prev => ({ ...prev, [plant.id]: data }));
    } catch (e) {
      console.error("Errore meteo", e);
    }
  }, []);

  // 3. CARICAMENTO INIZIALE
  const loadPlants = useCallback(async () => {
    setError(null);
    if (plants.length === 0) setLoading(true);
    try {
      const { data } = await api.get('/api/piante/'); 
      setPlants(data || []);
      data.forEach(p => fetchPlantWeather(p));
    } catch (err) {
      console.error("Errore caricamento piante:", err);
      setError('Errore caricamento dati.');
    } finally {
      setLoading(false);
    }
  }, [fetchPlantWeather]);

  useEffect(() => { loadPlants(); }, [loadPlants]);

  const handleLogIrrigation = async (plant) => {
    await new Promise(r => setTimeout(r, 500)); 
    await loadPlants(); 
    await askForAdvice(plant);
  };

  return (
    <div className="min-h-screen bg-green-50 pt-16">
      <div className="w-full max-w-screen-2xl xl:px-32 lg:px-12 md:px-8 sm:px-6 px-4 py-8 mx-auto">
        
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            {onBack && (
              <button onClick={onBack} className="p-2 bg-white rounded-full shadow-sm text-gray-600 hover:text-green-700">
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-green-500 to-emerald-700 p-3 rounded-xl shadow-lg">
                <Brain className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">AI Advisor</h1>
                <p className="text-gray-600 text-sm">Analisi predittiva e monitoraggio intelligente.</p>
              </div>
            </div>
          </div>
          <button onClick={loadPlants} className="px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm text-sm font-medium hover:bg-gray-50 flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Aggiorna Dati
          </button>
        </div>

        {/* LISTA */}
        {loading && plants.length === 0 ? (
           <div className="text-center py-12 text-green-700 animate-pulse">Caricamento serra...</div>
        ) : error ? (
           <div className="text-center py-12 text-red-500">{error}</div>
        ) : plants.length === 0 ? (
           <div className="text-center py-12 text-gray-500">Nessuna pianta trovata.</div>
        ) : (
          <div className="space-y-6">
            {plants.map((plant) => {
              const img = plant.imageUrl || plant.trefleImageUrl || getPlaceholderImage(plant);
              const rec = recommendations[plant.id];
              
              // Dati meteo live
              const wLive = weatherMap[plant.id] || {};
              // Dati salvati nella pianta (come fallback)
              const wInternal = plant.weather_data || {};

              // Costruiamo un oggetto meteo che la Card sappia leggere
              const displayWeather = {
                ...wInternal,
                ...wLive, // Sovrascrive con i dati live se presenti
                
                // --- FIX SOLARE ---
                // Cerca 'solarRadiation' (se presente) OPPURE 'solar_rad' (formato API Live)
                solarRadiation: wLive.solarRadiation ?? wLive.solar_rad ?? wInternal.solar_rad ?? wInternal.solarRadiation,
                
                et0: wLive.et0 ?? wInternal.et0,
                soilHumidity: wLive.soil_moisture ?? wInternal.soil_moisture ?? wInternal.soilHumidity,
                
                // Pioggia
                rainNext24h: wLive.rainNext24h ?? 0,
                rain_trend: wLive.rain_trend || wInternal.rain_trend || []
              };

              return (
                <AIIrrigationCard
                  key={plant.id}
                  plant={plant}
                  imageUrl={img}
                  loadingExternal={loadingPlants.has(plant.id)}
                  recommendation={rec}
                  weather={displayWeather}
                  onAskAdvice={() => askForAdvice(plant)}
                  onRefreshWeather={() => fetchPlantWeather(plant)}
                  onLogIrrigation={() => handleLogIrrigation(plant)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AIIrrigationPage;