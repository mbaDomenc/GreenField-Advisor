import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    Droplets, CloudRain, Thermometer, RefreshCw, CheckCircle, Brain, 
    AlertCircle, Clock, MapPin, X, Activity, Wind, SunMedium, Leaf, Sprout,
    BarChart3, AlertTriangle, Layers, FlaskConical, FileText
} from 'lucide-react';
import { api } from '../api/axiosInstance';

//LISTA TIPI DI CONCIME SUPPORTATI
const FERTILIZER_TYPES = [
    "Universale Liquido",
    "Universale Granulare",
    "NPK Bilanciato (20-20-20)",
    "Alto Azoto (Per crescita)",
    "Alto Potassio (Per fioritura)",
    "Bio / Organico",
    "Specifico per Acidofile",
    "Specifico per Agrumi",
    "Rinverdente (Ferro)"
];

const statusPill = (rec) => {
    // Logica Nuova Pipeline
    if (rec?.should_water) {
        return { text: 'Irriga ora', cls: 'bg-blue-100 text-blue-800 ring-1 ring-inset ring-blue-200', icon: Droplets };
    } else if (rec?.should_water === false) {
        return { text: 'Non irrigare', cls: 'bg-green-100 text-green-800 ring-1 ring-inset ring-green-200', icon: CheckCircle };
    }
    // Fallback
    return { text: 'Analisi...', cls: 'bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200', icon: Brain };
};

const fmtLastWatered = (dateString) => {
    if (!dateString) return 'Mai irrigata';
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'Oggi';
        if (diffDays === 1) return 'Ieri';
        return `${diffDays} giorni fa`;
    } catch { return '—'; }
};

const MetricBox = ({ icon: Icon, label, value, subvalue, iconClass = '' }) => (
    <div className="bg-gray-50 rounded-lg px-3 py-2 flex flex-col justify-between border border-gray-100">
        <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wide font-semibold">
            <Icon className={`h-3.5 w-3.5 ${iconClass}`} />
            <span>{label}</span>
        </div>
        <div className="mt-1">
            <span className="text-gray-900 font-bold text-lg">{value ?? '—'}</span>
            {subvalue && <span className="text-gray-500 text-xs ml-1">{subvalue}</span>}
        </div>
    </div>
);

const Row = ({ label, value, highlight = false }) => (
    <div className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
        <span className="text-gray-600">{label}</span>
        <span className={`font-medium ${highlight ? 'text-blue-700' : 'text-gray-900'}`}>{value ?? '—'}</span>
    </div>
);

const AIIrrigationCard = ({
    plant,
    imageUrl,
    sensors = {},
    weather = {},
    recommendation,
    loadingExternal,
    onAskAdvice,
    onRefreshWeather,
}) => {
    const isControlled = typeof recommendation !== 'undefined';
    
    const [loadingInternal, setLoadingInternal] = useState(false);
    const [resultInternal, setResultInternal] = useState(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    
    // Modali
    const [showIrrigModal, setShowIrrigModal] = useState(false);
    const [showFertModal, setShowFertModal] = useState(false);

    // Form
    const [irrigForm, setIrrigForm] = useState({ liters: '', executedAt: '', notes: '' });
    const [fertForm, setFertForm] = useState({ type: '', dose: '', executedAt: '', notes: '' });

    const isLoading = isControlled ? !!loadingExternal : loadingInternal;
    const effectiveResult = isControlled ? recommendation : resultInternal;

    // Dati Pipeline
    const suggestion = effectiveResult?.suggestion || effectiveResult;
    const details = effectiveResult?.details || {};
    const features = details.features || {};
    const cleanedData = details.cleaned_data || {};
    const anomalies = details.anomalies || [];
    const fertilizer = suggestion?.fertilizer_estimation;
    const frequency = suggestion?.frequency_estimation;

    const fetchSelf = useCallback(async () => {
        if (!plant?.id) return;
        setLoadingInternal(true);
        try {
            const { data } = await api.post(`/api/piante/${plant.id}/ai/irrigazione`, {});
            setResultInternal(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingInternal(false);
        }
    }, [plant?.id]);

    useEffect(() => {
        if (!isControlled && plant?.id) fetchSelf();
    }, [plant?.id, isControlled, fetchSelf]);

    const handleRefresh = () => {
        if (onRefreshWeather) onRefreshWeather(plant);
        else fetchSelf();
    };

    // --- HANDLER IRRIGAZIONE ---
    const handleAddIrrigation = async () => {
        try {
            await api.post(`/api/piante/${plant.id}/interventi`, {
                type: 'irrigazione',
                status: 'done',
                liters: Number(irrigForm.liters),
                executedAt: new Date(irrigForm.executedAt).toISOString(),
                notes: irrigForm.notes
            });
            setShowIrrigModal(false);
            handleRefresh();
        } catch (e) { alert('Errore salvataggio irrigazione'); }
    };

    // --- HANDLER CONCIMAZIONE ---
    const handleAddFertilization = async () => {
        if (!fertForm.type) return alert('Seleziona il tipo di concime');
        
        try {
            await api.post(`/api/piante/${plant.id}/interventi`, {
                type: 'concimazione',
                status: 'done',
                fertilizerType: fertForm.type,
                dose: fertForm.dose,
                executedAt: new Date(fertForm.executedAt).toISOString(),
                notes: fertForm.notes
            });
            setShowFertModal(false);
            handleRefresh();
            alert('Concimazione registrata!');
        } catch (e) { 
            console.error(e);
            alert('Errore salvataggio concimazione'); 
        }
    };

    // Pillola Stato
    const pill = statusPill(suggestion);
    
    // Valori Meteo (Con Fix Optional Chaining per evitare crash se weather è null)
    const tempVal = cleanedData.temperature ?? weather?.temp;
    const humVal = cleanedData.humidity ?? weather?.humidity;
    const rainVal = cleanedData.rainfall ?? weather?.rainNext24h;
    
    // Valore Suolo (Usato solo nel drawer)
    const soilRaw = (effectiveResult?.details?.cleaned_data?.soil_moisture ?? weather?.soilMoistureApprox);
    const soilValue = Number.isFinite(soilRaw) ? `${Math.round(soilRaw)}%` : '—';

    return (
        <>
            {/* --- CARD PRINCIPALE --- */}
            <div className="bg-white rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-300 border border-gray-100 p-4 md:p-5 h-full flex flex-col">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-gray-100 overflow-hidden border border-gray-200">
                            {imageUrl ? (
                                <img src={imageUrl} alt={plant.name} className="h-full w-full object-cover" />
                            ) : (
                                <Leaf className="h-6 w-6 m-3 text-green-600 opacity-50" />
                            )}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 leading-tight">{plant.name}</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-xs text-gray-500">{plant.species || 'Specie n/d'}</p>
                                {plant.soil && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-100 rounded">
                                        {plant.soil}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${pill.cls}`}>
                        <pill.icon className="h-4 w-4 mr-1.5" />
                        {pill.text}
                    </span>
                </div>

                {/* Descrizione Breve */}
                {suggestion?.description && (
                    <p className="text-sm text-gray-700 mb-4 line-clamp-2 bg-gray-50 p-2 rounded border border-gray-100">
                        {suggestion.description}
                    </p>
                )}

                {/* Metriche Grid */}
                {/* 🟢 MODIFICA: Rimosso Soil Moisture per non confondere l'utente. Layout 3 colonne. */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                    <MetricBox icon={Thermometer} label="Temp" value={tempVal ? `${Math.round(tempVal)}°` : '—'} iconClass="text-orange-500" />
                    <MetricBox icon={Droplets} label="Umidità" value={humVal ? `${Math.round(humVal)}%` : '—'} iconClass="text-blue-500" />
                    <MetricBox icon={CloudRain} label="Pioggia" value={rainVal ? `${rainVal}mm` : '0mm'} iconClass="text-indigo-500" />
                </div>

                {/* Footer Card: Pulsanti Azione */}
                <div className="mt-auto flex gap-2 pt-4 border-t border-gray-100">
                    
                    {/* Bottone Irrigazione */}
                    <button 
                        onClick={() => {
                            setIrrigForm({ liters: '', executedAt: new Date().toISOString().slice(0, 16), notes: '' });
                            setShowIrrigModal(true);
                        }}
                        className="flex-1 bg-blue-600 text-white px-2 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-1.5"
                        title="Registra Irrigazione"
                    >
                        <CheckCircle className="h-4 w-4" /> Irriga
                    </button>

                    {/* 🟢 Bottone Concimazione */}
                    <button 
                        onClick={() => {
                            setFertForm({ type: '', dose: '', executedAt: new Date().toISOString().slice(0, 16), notes: '' });
                            setShowFertModal(true);
                        }}
                        className="flex-1 bg-amber-500 text-white px-2 py-2 rounded-lg text-sm font-medium hover:bg-amber-600 flex items-center justify-center gap-1.5"
                        title="Registra Concimazione"
                    >
                        <FlaskConical className="h-4 w-4" /> Concima
                    </button>

                    <button 
                        onClick={() => setDetailsOpen(true)}
                        className="px-3 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                    >
                        Dettagli
                    </button>
                    <button 
                        onClick={handleRefresh}
                        disabled={isLoading}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Aggiorna Dati"
                    >
                        <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* --- MODALE IRRIGAZIONE e CONCIMAZIONE sono invariati --- */}
            {/* ... */}

            {/* --- DRAWER DETTAGLI (Qui i dati Soil Moisture e AWC restano utili) --- */}
            {detailsOpen && (
                <>
                    <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm" onClick={() => setDetailsOpen(false)} />
                    <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col overflow-y-auto border-l border-gray-100 animate-in slide-in-from-right duration-300">
                        
                        <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between sticky top-0 z-10">
                            <div className="flex items-center gap-2">
                                <Brain className="h-5 w-5 text-indigo-600" />
                                <h3 className="text-lg font-bold text-gray-900">Analisi Completa AI</h3>
                            </div>
                            <button onClick={() => setDetailsOpen(false)} className="p-2 hover:bg-gray-200 rounded-full">
                                <X className="h-5 w-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="p-6 space-y-8">

                            {/* 1. NOTE & DIAGNOSI VISIVA */}
                            {plant.description && (
                                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                                    <h4 className="text-sm font-bold text-gray-900 uppercase mb-2 flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-blue-600" /> Note e Diagnosi
                                    </h4>
                                    <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                                        {plant.description}
                                    </p>
                                </div>
                            )}

                            {/* 2. SEZIONE CONCIMAZIONE */}
                            {fertilizer && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-3 opacity-10">
                                        <Sprout className="h-24 w-24 text-amber-600" />
                                    </div>
                                    <h4 className="text-sm font-bold text-amber-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <Sprout className="h-4 w-4" /> Piano Nutrizionale
                                    </h4>
                                    <div className="space-y-2 relative z-10">
                                        <Row label="Frequenza" value={fertilizer.frequency} />
                                        <Row label="Tipo" value={fertilizer.type} />
                                        <div className="mt-2 pt-2 border-t border-amber-200 text-xs text-amber-800 italic">
                                            "{fertilizer.reasoning}"
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 3. SEZIONE IRRIGAZIONE */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-900 uppercase mb-3 flex items-center gap-2">
                                    <Droplets className="h-4 w-4 text-blue-600" /> Strategia Irrigazione
                                </h4>
                                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                    <div className="p-4 bg-blue-50/50 border-b border-blue-100">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-sm text-blue-800 font-medium">Frequenza Stimata</span>
                                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                                                {frequency?.label || "N/D"}
                                            </span>
                                        </div>
                                        <p className="text-lg font-bold text-blue-900">{frequency?.detail || "Analisi in corso..."}</p>
                                    </div>
                                    <div className="p-4 space-y-1">
                                        <Row 
                                            label="Quantità suggerita" 
                                            value={suggestion?.should_water ? `${suggestion?.water_amount_liters} Litri` : "Non è necessaria acqua momentaneamente"} 
                                            highlight 
                                        />
                                        <Row label="Urgenza" value={`${features.irrigation_urgency}/10`} />
                                        <Row label="Prossima finestra" value={suggestion?.timing} />
                                    </div>
                                </div>
                            </div>

                            {/* 4. ANALISI AGRONOMICA AVANZATA */}
                            {features.vpd !== undefined && (
                                <div className="mt-6 border-t border-gray-100 pt-4">
                                    <h4 className="text-sm font-bold text-gray-900 uppercase mb-3 flex items-center gap-2">
                                        <Activity className="h-4 w-4 text-purple-600" /> Analisi Agronomica
                                    </h4>
                                    
                                    <div className="space-y-4">
                                        {/* VPD */}
                                        <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs font-bold text-purple-800 uppercase">Traspirazione (VPD)</span>
                                                <span className="font-mono text-sm font-bold text-purple-900">{features.vpd} kPa</span>
                                            </div>
                                            <div className="w-full bg-purple-200 h-2 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full ${features.vpd > 1.2 ? 'bg-red-500' : features.vpd < 0.4 ? 'bg-blue-500' : 'bg-green-500'}`} 
                                                    style={{ width: `${Math.min(features.vpd * 50, 100)}%` }}
                                                ></div>
                                            </div>
                                            <p className="text-[10px] text-purple-700 mt-1">
                                                {features.vpd < 0.4 ? "Basso: Rischio funghi." : features.vpd > 1.5 ? "Alto: Stress idrico." : "Ottimale."}
                                            </p>
                                        </div>

                                        {/* AWC */}
                                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs font-bold text-blue-800 uppercase">Riserva Idrica (AWC)</span>
                                                <span className="font-mono text-sm font-bold text-blue-900">{features.awc_percentage}%</span>
                                            </div>
                                            <div className="w-full bg-blue-200 h-2 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-blue-600 rounded-full transition-all duration-500"
                                                    style={{ width: `${Math.min(features.awc_percentage, 100)}%` }}
                                                ></div>
                                            </div>
                                            <p className="text-[10px] text-blue-700 mt-1">
                                                {features.soil_behavior}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 5. ANOMALIE */}
                            {anomalies.length > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                    <h4 className="text-sm font-bold text-red-800 uppercase mb-2 flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4" /> Attenzione
                                    </h4>
                                    <ul className="space-y-2">
                                        {anomalies.map((a, i) => (
                                            <li key={i} className="text-sm text-red-700 flex gap-2">
                                                <span className="font-bold">•</span> {a.message}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            
                            {/* 6. INDICATORI BASE (solo se necessario) */}
                            {features.water_stress_index !== undefined && (
                                <div className="border-t border-gray-100 pt-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <MetricBox icon={BarChart3} label="Stress Idrico" value={`${features.water_stress_index?.toFixed(0)}/100`} iconClass="text-red-500" />
                                        <MetricBox icon={SunMedium} label="Evapotraspir." value={`${features.evapotranspiration} mm`} iconClass="text-orange-500" />
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </>
            )}
        </>
    );
};

export default AIIrrigationCard;