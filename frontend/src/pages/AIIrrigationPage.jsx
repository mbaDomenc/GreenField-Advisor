import React, { useEffect, useState } from 'react';
import { Brain, CheckCircle, Leaf, ArrowLeft } from 'lucide-react';
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
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPlants();
  }, []);

  const loadPlants = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/api/piante'); // lista piante utente
      setPlants(data || []);
      setError(null);
    } catch (err) {
      console.error('Errore nel caricamento piante:', err);
      setError('Errore nel caricamento delle piante');
    } finally {
      setLoading(false);
    }
  };

  const askForAdvice = async (plant) => {
    if (!plant?.id) return;
    setLoadingPlants(prev => new Set([...prev, plant.id]));
    try {
      const { data } = await api.post(`/api/piante/${plant.id}/ai/irrigazione`, {});
      setRecommendations(prev => ({ ...prev, [plant.id]: data }));
    } catch (err) {
      console.error('Errore nel consiglio AI:', err);
      setRecommendations(prev => ({
        ...prev,
        [plant.id]: { error: 'Errore nel calcolo del consiglio' }
      }));
    } finally {
      setLoadingPlants(prev => {
        const s = new Set(prev);
        s.delete(plant.id);
        return s;
      });
    }
  };

  const handleLogIrrigation = (plant) => {
    alert(`Registra irrigazione per ${plant.name} (TODO: apri modal interventi)`);
  };

  const refreshWeather = (plant) => {
    askForAdvice(plant);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-green-50 pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600">{error}</p>
            <button
              onClick={loadPlants}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Riprova
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-50 pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-6">
            {onBack && (
              <button onClick={onBack} className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors">
                <ArrowLeft className="h-5 w-5" />
                <span>Indietro</span>
              </button>
            )}
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-full">
                <Brain className="h-8 w-8 text-white" />
              </div>
              <div>
                {/* 🟢 TITOLO AGGIORNATO */}
                <h1 className="text-3xl font-bold text-gray-900">
                  AI Tools → Assistente Coltivazione
                </h1>
                <p className="text-gray-600">
                  Analisi completa: Irrigazione, Concimazione, Fabbisogno del suolo e Salute della pianta.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Plants */}
        {plants.length === 0 ? (
          <div className="text-center py-16">
            <div className="bg-white rounded-xl shadow-lg p-12 max-w-md mx-auto">
              <div className="bg-blue-100 p-4 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <Leaf className="h-10 w-10 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Nessuna pianta disponibile
              </h3>
              <p className="text-gray-600 mb-6">
                Aggiungi delle piante per ottenere consigli AI personalizzati.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {plants.map((plant) => {
              const img = plant.imageUrl || plant.trefleImageUrl || getPlaceholderImage(plant);
              const rec = recommendations[plant.id];
              const weather = rec?._debug?.weather || rec?.weather || null;

              return (
                <AIIrrigationCard
                  key={plant.id}
                  plant={plant}
                  imageUrl={img}
                  loadingExternal={loadingPlants.has(plant.id)}
                  recommendation={recommendations[plant.id]}
                  onAskAdvice={() => askForAdvice(plant)}
                  onRefreshWeather={() => refreshWeather(plant)}
                  onLogIrrigation={() => handleLogIrrigation(plant)}
                  weather={weather}
                />
              );
            })}
          </div>
        )}

        {/* Bottom Info */}
        <div className="mt-12 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl p-8 text-center">
          <Brain className="h-12 w-12 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">
            Assistente Virtuale Completo
          </h2>
          <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
            Il nostro sistema analizza il meteo in tempo reale, il tipo di terreno e le necessità specifiche della specie per ottimizzare ogni aspetto della cura.
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5" />
              <span>Irrigazione Intelligente</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5" />
              <span>Piani Concimazione</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5" />
              <span>Diagnosi Salute (Visione)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIIrrigationPage;