import React, { useState } from 'react';
import { 
    Brain, MapPin, Sprout, Thermometer, 
    Droplets, Sun, CloudRain, AlertTriangle, Search, ArrowRight
} from 'lucide-react';
import { processPipeline } from '../api/pipelineApi';
import { api } from '../api/axiosInstance'; 
import PlaceAutocomplete from '../components/PlaceAutocomplete';
import PipelineResultCard from '../components/PipelineResultCard';
import RequireAuth from '../components/RequireAuth';

// Lista piante coerente col backend
const SUPPORTED_PLANTS = [
    { id: 'tomato', label: 'Pomodoro (Tomato)' },
    { id: 'potato', label: 'Patata (Potato)' },
    { id: 'pepper', label: 'Peperone (Pepper)' },
    { id: 'peach', label: 'Pesca (Peach)' },   
    { id: 'grape', label: 'Uva (Grape)' },     
    { id: 'generic', label: 'Altra Specie (Generica)' }
];

// Lista Terreni
const SUPPORTED_SOILS = [
    { id: 'franco', label: 'Lavorabile (Medio impasto)' },
    { id: 'universale', label: 'Universale (Standard)' },
    { id: 'argilloso', label: 'Argilloso (Pesante)' },
    { id: 'sabbioso', label: 'Sabbioso (Drenante)' },
    { id: 'acido', label: 'Acido (es. Mirtilli)' },
    { id: 'torboso', label: 'Torboso' }
];

export default function PipelineTestPage() {
    const [plantType, setPlantType] = useState('tomato');
    const [location, setLocation] = useState('');
    const [geoData, setGeoData] = useState(null); 
    const [soilType, setSoilType] = useState('franco');

    const [result, setResult] = useState(null);
    const [weatherData, setWeatherData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handlePlaceSelect = (place) => {
        setLocation(place.formattedAddress);
        const searchTerm = place.addrParts?.locality || place.addrParts?.admin2 || place.formattedAddress;
        setGeoData({ ...place, searchCity: searchTerm });
    };

    const handleAnalyze = async () => {
        if (!geoData?.searchCity) {
            setError("Per favore seleziona una località valida dalla lista.");
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);
        setWeatherData(null);

        try {
            // 1. Meteo Reale
            const weatherRes = await api.get(`/api/weather?city=${encodeURIComponent(geoData.searchCity)}`);
            const weather = weatherRes.data;
            setWeatherData(weather);

            // 2. Sensori Virtuali basati sul meteo
            const sensorData = {
                temperature: weather.temp,
                humidity: weather.humidity,
                rainfall: weather.rainNext24h || 0.0,
                light: weather.light || 0.0,
                soil_moisture: weather.soil_moisture || 0.0
            };

            // 3. Payload Completo
            const payload = {
                sensor_data: sensorData,
                plant_type: plantType,
                soil_type: soilType 
            };

            // 4. Pipeline
            const pipelineRes = await processPipeline(payload); 
            
            if (pipelineRes.status === 'error') {
                throw new Error(pipelineRes.metadata.errors.join(', '));
            }

            setResult(pipelineRes);

        } catch (err) {
            console.error('Errore analisi:', err);
            setError(err.response?.data?.detail || err.message || 'Errore durante l\'analisi');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setLocation('');
        setGeoData(null);
        setResult(null);
        setWeatherData(null);
        setError(null);
        setSoilType('franco');
    };

    const getSuitabilityBadge = (res) => {
        const comfort = res?.details?.features?.climate_comfort_index || 0;
        const stress = res?.details?.features?.water_stress_index || 0;

        if (comfort >= 75 && stress < 40) 
            return { label: "LUOGO IDEALE", color: "text-green-700", bg: "bg-green-100", border: "border-green-500" };
        if (comfort >= 50) 
            return { label: "BUONO", color: "text-blue-700", bg: "bg-blue-100", border: "border-blue-500" };
        if (comfort >= 30) 
            return { label: "ACCETTABILE", color: "text-yellow-700", bg: "bg-yellow-100", border: "border-yellow-500" };
        
        return { label: "SCONSIGLIATO", color: "text-red-700", bg: "bg-red-100", border: "border-red-500" };
    };

    return (
        <RequireAuth>
            <div className="min-h-screen bg-green-50 pt-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    
                    <div className="mb-8 text-center md:text-left">
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center md:justify-start gap-3">
                            <Sprout className="h-8 w-8 text-green-600" />
                            Analisi Idoneità Ambientale
                        </h1>
                        <p className="text-gray-600 mt-2">
                            Verifica se il clima attuale di una località è adatto alla coltivazione della tua pianta.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        
                        {/* CONFIGURAZIONE */}
                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-white p-6 rounded-xl shadow-lg border border-green-100 sticky top-24">
                                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <MapPin className="h-5 w-5 text-blue-600" /> 
                                    Configura Analisi
                                </h2>

                                <div className="space-y-5">
                                    {/* Pianta */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Pianta</label>
                                        <div className="relative">
                                            <select
                                                value={plantType}
                                                onChange={(e) => setPlantType(e.target.value)}
                                                className="w-full pl-4 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white appearance-none"
                                            >
                                                {SUPPORTED_PLANTS.map(p => (
                                                    <option key={p.id} value={p.id}>{p.label}</option>
                                                ))}
                                            </select>
                                            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none"><ArrowRight className="h-4 w-4 text-gray-400 rotate-90" /></div>
                                        </div>
                                    </div>
                                    
                                    {/* Terreno */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo di Terreno</label>
                                        <div className="relative">
                                            <select
                                                value={soilType}
                                                onChange={(e) => setSoilType(e.target.value)}
                                                className="w-full pl-4 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white appearance-none"
                                            >
                                                {SUPPORTED_SOILS.map(s => (
                                                    <option key={s.id} value={s.id}>{s.label}</option>
                                                ))}
                                            </select>
                                            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none"><ArrowRight className="h-4 w-4 text-gray-400 rotate-90" /></div>
                                        </div>
                                    </div>

                                    {/* Luogo */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Località</label>
                                        <PlaceAutocomplete 
                                            value={location}
                                            onChangeText={setLocation}
                                            onSelectPlace={handlePlaceSelect}
                                            placeholder="Es. Roma..."
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                                        />
                                    </div>

                                    <div className="pt-2 flex gap-3">
                                        <button onClick={handleAnalyze} disabled={loading || !geoData} className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 font-bold shadow-md disabled:opacity-50 flex items-center justify-center gap-2">
                                            {loading ? "Analisi..." : <><Search className="h-5 w-5" /> Verifica</>}
                                        </button>
                                        {result && <button onClick={handleReset} className="px-4 py-3 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">Reset</button>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RISULTATI */}
                        <div className="lg:col-span-2 space-y-6">
                            {error && (
                                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-start gap-3">
                                    <AlertTriangle className="h-6 w-6 text-red-600 mt-0.5" />
                                    <div><h3 className="font-bold text-red-800">Errore</h3><p className="text-red-700 text-sm">{error}</p></div>
                                </div>
                            )}

                            {!result && !loading && !error && (
                                <div className="bg-white h-full min-h-[300px] rounded-xl shadow-sm border border-gray-200 border-dashed flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                                    <Brain className="h-16 w-16 mb-4 text-gray-300" />
                                    <h3 className="text-lg font-semibold text-gray-600">Pronto per l'analisi</h3>
                                    <p className="max-w-sm mt-2 text-sm">Simula le condizioni di coltivazione prima di piantare.</p>
                                </div>
                            )}

                            {result && (
                                <div className="space-y-6 animate-in fade-in duration-500">
                                    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                                        <div className="bg-gray-50 p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                            <div>
                                                <h2 className="text-xl font-bold text-gray-900">Risultato per <span className="text-green-700 uppercase">{plantType}</span></h2>
                                                <p className="text-sm text-gray-500 flex items-center gap-1"><MapPin className="h-3 w-3" /> {geoData?.searchCity}</p>
                                            </div>
                                            {(() => {
                                                const badge = getSuitabilityBadge(result);
                                                return (
                                                    <div className={`px-5 py-2 rounded-lg border-2 ${badge.border} ${badge.bg} ${badge.color} text-center shadow-sm`}>
                                                        <p className="text-[10px] font-bold tracking-widest uppercase opacity-80">Rating</p>
                                                        <p className="text-lg font-black">{badge.label}</p>
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="text-center p-3 bg-orange-50 rounded-lg"><Thermometer className="h-6 w-6 text-orange-500 mx-auto mb-1" /><p className="text-xs text-gray-500">Temp</p><p className="font-bold text-gray-900">{weatherData.temp}°C</p></div>
                                            <div className="text-center p-3 bg-blue-50 rounded-lg"><Droplets className="h-6 w-6 text-blue-500 mx-auto mb-1" /><p className="text-xs text-gray-500">Umidità</p><p className="font-bold text-gray-900">{weatherData.humidity}%</p></div>
                                            <div className="text-center p-3 bg-indigo-50 rounded-lg"><CloudRain className="h-6 w-6 text-indigo-500 mx-auto mb-1" /><p className="text-xs text-gray-500">Pioggia</p><p className="font-bold text-gray-900">{weatherData.rainNext24h} mm</p></div>
                                            <div className="text-center p-3 bg-yellow-50 rounded-lg"><Sun className="h-6 w-6 text-yellow-500 mx-auto mb-1" /><p className="text-xs text-gray-500">Luce</p><p className="font-bold text-gray-900">{(weatherData.light / 1000).toFixed(1)}k lx</p></div>
                                        </div>
                                    </div>

                                    <div className="opacity-100">
                                        <PipelineResultCard result={result} plantType={plantType} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </RequireAuth>
    );
}