import React, { useState } from 'react';
import {
    Droplets, CloudRain, Thermometer, RefreshCw, CheckCircle, Brain, 
    X, AlertTriangle, FlaskConical, Leaf, Sun, Sprout, 
    Activity, ShieldAlert, Scale, Zap, Calendar
} from 'lucide-react';
import { api } from '../api/axiosInstance';

// --- CALCOLI AGRONOMICI ---
const calculateVPD = (temp, humid) => {
    if (temp == null || humid == null) return null;
    const svp = 0.6108 * Math.exp((17.27 * temp) / (temp + 237.3));
    const avp = svp * (humid / 100);
    return (svp - avp).toFixed(2);
};

const getVPDStatus = (vpd) => {
    if (!vpd) return { label: "N/D", color: "text-gray-400", bg: "bg-gray-100" };
    const v = parseFloat(vpd);
    if (v < 0.4) return { label: "Rischio Muffe (Basso)", color: "text-blue-700", bg: "bg-blue-100" };
    if (v >= 0.4 && v <= 1.6) return { label: "Traspirazione Ottimale", color: "text-green-700", bg: "bg-green-100" };
    return { label: "Stress Idrico (Alto)", color: "text-orange-700", bg: "bg-orange-100" };
};

const getRainAccumulationStatus = (pastDays) => {
    if (!pastDays || pastDays.length === 0) return null;
    const totalRain = pastDays.reduce((acc, day) => acc + (day.rain || 0), 0);
    if (totalRain > 10) return { status: "SATURO", label: "Irrigazione Naturale", desc: `Ricevuti ${totalRain.toFixed(1)}mm di pioggia.`, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", icon: CheckCircle };
    if (totalRain > 2) return { status: "MODERATO", label: "Pioggia Scarsa", desc: `Solo ${totalRain.toFixed(1)}mm caduti.`, color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", icon: CloudRain };
    return { status: "SECCO", label: "Assenza di Piogge", desc: "Nessuna pioggia recente.", color: "text-red-700", bg: "bg-red-50", border: "border-red-200", icon: AlertTriangle };
};

const cleanText = (text) => text ? text.replace(/<s>/g, '').replace(/<\/s>/g, '').replace(/\*\*/g, '').replace(/##/g, '').replace(/`/g, '').trim() : "";

const statusPill = (rec) => {
    const action = rec?.recommendation; 
    if (action === 'irrigate_today' || action === 'irrigate_tomorrow' || (rec?.decision?.recommendation === 'IRRIGARE')) {
        return { text: 'Irriga ora', cls: 'bg-blue-100 text-blue-800 ring-1 ring-inset ring-blue-200', icon: Droplets };
    } else if (action === 'skip' || (rec?.decision?.recommendation === 'SKIP')) {
        return { text: 'Non irrigare', cls: 'bg-green-100 text-green-800 ring-1 ring-inset ring-green-200', icon: CheckCircle };
    } else if (rec?.error) {
        return { text: 'Errore', cls: 'bg-red-100 text-red-800 ring-1 ring-inset ring-red-200', icon: AlertTriangle };
    }
    return { text: 'In attesa...', cls: 'bg-gray-100 text-gray-500 ring-1 ring-inset ring-gray-200', icon: Brain };
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

const WeatherDay = ({ day, isToday, isPast }) => {
    const date = new Date(day.date);
    const dayName = date.toLocaleDateString('it-IT', { weekday: 'short' }).toUpperCase();
    const dayNum = date.getDate();
    const rain = day.rain || 0;
    const bgClass = isPast ? 'bg-gray-50 border-gray-200 opacity-70' : (isToday ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200' : 'bg-white border-gray-200');
    return (
        <div className={`flex flex-col items-center p-2 rounded-lg border min-w-[64px] ${bgClass}`}>
            <span className="text-[10px] text-gray-500 font-bold">{dayName} {dayNum}</span>
            <div className="my-1">
                {rain > 2 ? <CloudRain className="h-5 w-5 text-blue-500" /> : <Sun className="h-5 w-5 text-orange-400" />}
            </div>
            <span className="text-xs font-bold text-gray-700">{Math.round(rain)}mm</span>
        </div>
    );
};

const ComfortGauge = ({ label, value, unit, status }) => {
    let color = "bg-gray-100 text-gray-600";
    if (status === "good") color = "bg-green-50 text-green-700 border-green-200 border";
    if (status === "warning") color = "bg-orange-50 text-orange-700 border-orange-200 border";
    if (status === "bad") color = "bg-red-50 text-red-700 border-red-200 border";
    return (
        <div className={`flex flex-col p-3 rounded-xl ${color} flex-1 items-center text-center`}>
            <span className="text-[10px] uppercase font-bold opacity-70 mb-1">{label}</span>
            <div className="text-lg font-bold leading-none">{value !== null ? value : '-'}{unit}</div>
        </div>
    );
};

const AIIrrigationCard = ({
    plant, imageUrl, recommendation, loadingExternal, weather,
    onAskAdvice, onRefreshWeather, onLogIrrigation
}) => {
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [showIrrigModal, setShowIrrigModal] = useState(false);
    const [showFertModal, setShowFertModal] = useState(false);
    
    const [irrigForm, setIrrigForm] = useState({ liters: '', executedAt: '', notes: '' });
    const [fertForm, setFertForm] = useState({ type: '', dose: '', executedAt: '', notes: '' });

    const isLoading = loadingExternal;
    const effectiveResult = recommendation || plant?.ai_analysis_report;
    const rawLLMText = effectiveResult?.text || effectiveResult?.explanationLLM;   
    const llmText = cleanText(rawLLMText); 
    
    const temp = weather?.temp; 
    const hum = weather?.humidity;
    const wind = weather?.wind;
    const et0 = weather?.et0;
    const solarRad = weather?.solarRadiation;
    const rainNext24h = weather?.rainNext24h;

    const vpd = calculateVPD(temp, hum);
    const vpdStatus = getVPDStatus(vpd);
    const pathogenRisk = (hum > 80) ? "ALTO" : "BASSO";
    const getTempStatus = (t) => t == null ? "neutral" : (t > 10 && t < 32) ? "good" : "warning";
    const getHumStatus = (h) => h == null ? "neutral" : (h > 40 && h < 85) ? "good" : "bad";
    const getWindStatus = (w) => w == null ? "neutral" : (w < 20) ? "good" : "warning";

    const rainTrend = weather?.rain_trend || weather?.rain || [];
    const todayStr = new Date().toISOString().split('T')[0];
    
    const pastDays = rainTrend.filter(d => d.date < todayStr).sort((a,b) => a.date.localeCompare(b.date)).slice(-5);
    const futureDays = rainTrend.filter(d => d.date >= todayStr).sort((a,b) => a.date.localeCompare(b.date)).slice(0, 5);

    const rainAccumulation = getRainAccumulationStatus(pastDays);
    const stage = plant?.stage || plant?.lifecycle_stage || "Generico";
    const getStagePercent = (s) => {
        s = (s || "").toLowerCase();
        if (s.includes('sem') || s.includes('ini') || s.includes('germ')) return 15;
        if (s.includes('cresc') || s.includes('veg')) return 40;
        if (s.includes('fior')) return 65;
        if (s.includes('frut') || s.includes('mat')) return 85;
        return 50;
    };
    const stagePercent = getStagePercent(stage);

    const handleRefresh = () => { if (onRefreshWeather) onRefreshWeather(plant); };

    // --- HANDLERS CON RITARDO (CRUCIALE) ---
    const handleAddIrrigation = async () => { 
        try { 
            await api.post(`/api/piante/${plant.id}/interventi`, { 
                type: 'irrigazione', status: 'done', 
                liters: Number(irrigForm.liters), executedAt: new Date(irrigForm.executedAt).toISOString(), notes: irrigForm.notes 
            }); 
            setShowIrrigModal(false); 
            // Aspetta 1 secondo che il DB scriva il dato
            setTimeout(() => {
                if(onLogIrrigation) onLogIrrigation();
            }, 1000);
        } catch (e) { alert('Errore salvataggio'); } 
    };

    const handleAddFertilization = async () => { 
        try { 
            await api.post(`/api/piante/${plant.id}/interventi`, { 
                type: 'concimazione', status: 'done', 
                fertilizerType: fertForm.type, 
                dose: fertForm.dose, 
                executedAt: new Date(fertForm.executedAt).toISOString(), notes: fertForm.notes 
            }); 
            setShowFertModal(false); 
            // Ritardo CRUCIALE: dà tempo al DB di registrare la concimazione
            setTimeout(() => {
                if(onLogIrrigation) onLogIrrigation();
            }, 1000);
        } catch (e) { alert('Errore salvataggio'); } 
    };

    const pill = statusPill(effectiveResult);

    return (
        <>
            <div className="bg-white rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-300 border border-gray-100 p-4 md:p-5 h-full flex flex-col">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-gray-100 overflow-hidden border border-gray-200">
                            {imageUrl ? <img src={imageUrl} alt={plant.name} className="h-full w-full object-cover" /> : <Leaf className="h-6 w-6 m-3 text-green-600 opacity-50" />}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 leading-tight">{plant.name}</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-xs text-gray-500">{plant.species || 'Specie n/d'}</p>
                            </div>
                        </div>
                    </div>
                    {effectiveResult && <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${pill.cls}`}><pill.icon className="h-4 w-4 mr-1.5" />{pill.text}</span>}
                </div>

                <div className="mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100 min-h-[80px] flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-2">
                        <Brain className="h-4 w-4 text-purple-600" />
                        <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">Analisi AI</span>
                    </div>
                    {isLoading ? (
                        <div className="w-full py-2 bg-purple-100 text-purple-800 rounded-md text-sm font-medium flex items-center justify-center gap-2 border border-purple-200 border-dashed animate-pulse">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Analisi in corso...
                        </div>
                    ) : llmText ? (
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line animate-in fade-in">{llmText}</p>
                    ) : (
                        <button onClick={onAskAdvice} className="w-full py-2 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-purple-200 border-dashed">
                            <Brain className="h-4 w-4" /> Avvia Analisi AI
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                    <MetricBox icon={Thermometer} label="Temp" value={temp !== undefined && temp !== null ? `${Math.round(temp)}°` : '—'} iconClass="text-orange-500" />
                    <MetricBox icon={Droplets} label="Umidità" value={hum !== undefined && hum !== null ? `${Math.round(hum)}%` : '—'} iconClass="text-blue-500" />
                    <MetricBox icon={CloudRain} label="Pioggia" value={rainNext24h !== undefined && rainNext24h !== null ? `${rainNext24h}mm` : '—'} iconClass="text-indigo-500" />
                </div>

                <div className="mt-auto flex gap-2 pt-4 border-t border-gray-100">
                    <button onClick={() => { setIrrigForm({ liters: '', executedAt: new Date().toISOString().slice(0, 16), notes: '' }); setShowIrrigModal(true); }} className="flex-1 bg-blue-600 text-white px-2 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-1.5"><CheckCircle className="h-4 w-4" /> Irriga</button>
                    <button onClick={() => { setFertForm({ type: '', dose: '', executedAt: new Date().toISOString().slice(0, 16), notes: '' }); setShowFertModal(true); }} className="flex-1 bg-amber-500 text-white px-2 py-2 rounded-lg text-sm font-medium hover:bg-amber-600 flex items-center justify-center gap-1.5"><FlaskConical className="h-4 w-4" /> Concima</button>
                    <button onClick={() => setDetailsOpen(true)} className="px-3 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Dettagli</button>
                    <button onClick={handleRefresh} disabled={isLoading} className="p-2 text-gray-400 hover:text-blue-600 transition-colors"><RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} /></button>
                </div>
            </div>

            {/* Details Drawer */}
            {detailsOpen && (
                <>
                    <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm" onClick={() => setDetailsOpen(false)} />
                    <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col overflow-y-auto border-l border-gray-100 animate-in slide-in-from-right duration-300">
                        <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between sticky top-0 z-10">
                            <h3 className="text-lg font-bold text-gray-900">Cruscotto Agronomico</h3>
                            <button onClick={() => setDetailsOpen(false)}><X className="h-5 w-5" /></button>
                        </div>
                        <div className="p-6 space-y-8">
                            
                            {/* Storico Pioggia */}
                            {pastDays.length > 0 ? (
                                <div className={`p-4 rounded-xl border ${rainAccumulation ? rainAccumulation.bg : 'bg-gray-50'} ${rainAccumulation ? rainAccumulation.border : 'border-gray-200'}`}>
                                    <div className="flex items-start gap-3">
                                        <div className={`p-2 rounded-full bg-white ${rainAccumulation ? rainAccumulation.color : 'text-gray-500'}`}>
                                            {rainAccumulation ? <rainAccumulation.icon className="h-6 w-6" /> : <CloudRain className="h-6 w-6"/>}
                                        </div>
                                        <div>
                                            <h4 className={`text-sm font-bold uppercase ${rainAccumulation ? rainAccumulation.color : 'text-gray-700'} mb-1`}>
                                                {rainAccumulation ? rainAccumulation.label : "Storico Pioggia"}
                                            </h4>
                                            <p className="text-sm text-gray-700 leading-snug">
                                                {rainAccumulation ? rainAccumulation.desc : "Dati ultimi 5 giorni."}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                        {pastDays.map((d, i) => <WeatherDay key={i} day={d} isPast={true} />)}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 italic">Nessun dato storico pioggia disponibile.</p>
                            )}

                            {/* Previsioni Future */}
                            {futureDays.length > 0 && (
                                <div className="p-4 rounded-xl border border-blue-100 bg-blue-50">
                                    <div className="flex items-start gap-3 mb-3">
                                        <div className="p-2 rounded-full bg-white text-blue-600">
                                            <Calendar className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold uppercase text-blue-800 mb-1">Previsioni 5 Giorni</h4>
                                            <p className="text-sm text-blue-600 leading-snug">
                                                Prossime tendenze meteo.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-2 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                        {futureDays.map((d, i) => <WeatherDay key={i} day={d} isToday={d.date === todayStr} isPast={false} />)}
                                    </div>
                                </div>
                            )}

                            {/* Ciclo Vitale */}
                            <div>
                                <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><Sprout className="h-4 w-4 text-green-600"/> Ciclo Vitale & Ambiente</h4>
                                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                                    <div className="bg-green-600 h-2.5 rounded-full" style={{ width: `${stagePercent}%` }}></div>
                                </div>
                                <div className="flex justify-between text-[10px] text-gray-400 font-medium uppercase mb-4">
                                    <span>Semina</span><span>{stage}</span><span>Raccolto</span>
                                </div>
                            </div>

                            {/* Microclima */}
                            <div>
                                <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><Activity className="h-4 w-4 text-purple-600"/> Analisi Microclima</h4>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div className={`p-3 rounded-lg border ${vpdStatus.bg} flex flex-col justify-center`}>
                                        <div className="text-[10px] font-bold uppercase opacity-70 mb-1">Stress (VPD)</div>
                                        <div className={`text-sm font-bold ${vpdStatus.color}`}>{vpdStatus.label}</div>
                                        <div className="text-xs opacity-60">{vpd || '-'} kPa</div>
                                    </div>
                                    <div className={`p-3 rounded-lg border ${pathogenRisk === "ALTO" ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"} flex flex-col justify-center`}>
                                        <div className="text-[10px] font-bold uppercase opacity-70 mb-1 flex items-center gap-1">
                                            <ShieldAlert className="h-3 w-3" /> Rischio Funghi
                                        </div>
                                        <div className={`text-sm font-bold ${pathogenRisk === "ALTO" ? "text-red-700" : "text-green-700"}`}>
                                            {pathogenRisk === "ALTO" ? "ALTO" : "BASSO"}
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 mb-3">
                                    <div className="text-[10px] font-bold uppercase text-gray-500 mb-2 flex items-center gap-1">
                                        <Scale className="h-3 w-3" /> Bilancio Idrico
                                    </div>
                                    <div className="flex items-center gap-1 mt-1">
                                        <div className="flex-1 h-2 bg-blue-500 rounded-l" style={{ width: `${Math.min(100, (rainNext24h || 0) * 10)}%` }}></div>
                                        <div className="flex-1 h-2 bg-orange-500 rounded-r" style={{ width: `${Math.min(100, (et0 || 0) * 10)}%` }}></div>
                                    </div>
                                    <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                                        <span>Pioggia: {rainNext24h ?? '-'}mm</span>
                                        <span>Evapo: {et0 ?? '-'}mm</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <ComfortGauge label="Temp" value={temp !== null ? Math.round(temp) : null} unit="°C" status={getTempStatus(temp)} />
                                    <ComfortGauge label="Umidità" value={hum !== null ? Math.round(hum) : null} unit="%" status={getHumStatus(hum)} />
                                    <ComfortGauge label="Vento" value={wind} unit="km/h" status={getWindStatus(wind)} />
                                </div>
                            </div>

                            {/* Energia Solare */}
                            <div>
                                <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><Zap className="h-4 w-4 text-yellow-500"/> Energia Solare</h4>
                                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 flex items-center justify-between">
                                    <div>
                                        <div className="text-xs text-yellow-700 font-bold uppercase mb-1">Radiazione Solare</div>
                                        <div className="text-2xl font-bold text-yellow-900">
                                            {solarRad !== undefined && solarRad !== null ? Math.round(solarRad) : '-'} <span className="text-sm font-normal text-yellow-700">W/m²</span>
                                        </div>
                                        <p className="text-[10px] text-yellow-800 mt-2 opacity-80 leading-tight">
                                            Energia per la fotosintesi.
                                        </p>
                                    </div>
                                    <Sun className="h-10 w-10 text-yellow-400 opacity-50" />
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Modale Irrigazione */}
            {showIrrigModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
                        <h3 className="text-lg font-bold mb-4 text-blue-900 flex items-center gap-2">
                            <Droplets className="h-5 w-5" /> Registra Irrigazione
                        </h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Quantità (Litri)</label>
                                <input type="number" step="0.5" value={irrigForm.liters} onChange={e => setIrrigForm({...irrigForm, liters: e.target.value})} className="w-full border rounded-lg p-2" placeholder="Es. 1.5"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Data e Ora</label>
                                <input type="datetime-local" value={irrigForm.executedAt} onChange={e => setIrrigForm({...irrigForm, executedAt: e.target.value})} className="w-full border rounded-lg p-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                                <textarea value={irrigForm.notes} onChange={e => setIrrigForm({...irrigForm, notes: e.target.value})} className="w-full border rounded-lg p-2 resize-none" rows={2} />
                            </div>
                            <div className="flex gap-2 mt-4">
                                <button onClick={() => setShowIrrigModal(false)} className="flex-1 border rounded-lg py-2 text-gray-600">Annulla</button>
                                <button onClick={handleAddIrrigation} className="flex-1 bg-blue-600 text-white rounded-lg py-2 font-bold">Salva</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modale Concimazione */}
             {showFertModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
                     <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
                        <h3 className="text-lg font-bold mb-4 text-amber-800 flex items-center gap-2">
                            <FlaskConical className="h-5 w-5" /> Registra Concimazione
                        </h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Concime</label>
                                <input 
                                    type="text" 
                                    value={fertForm.type} 
                                    onChange={e => setFertForm({...fertForm, type: e.target.value})} 
                                    className="w-full border rounded-lg p-2" 
                                    placeholder="Es. NPK 20-20-20 o nome commerciale"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Dose</label>
                                <input type="text" value={fertForm.dose} onChange={e => setFertForm({...fertForm, dose: e.target.value})} className="w-full border rounded-lg p-2" placeholder="Es. 10ml"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Data e Ora</label>
                                <input type="datetime-local" value={fertForm.executedAt} onChange={e => setFertForm({...fertForm, executedAt: e.target.value})} className="w-full border rounded-lg p-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                                <textarea value={fertForm.notes} onChange={e => setFertForm({...fertForm, notes: e.target.value})} className="w-full border rounded-lg p-2 resize-none" rows={2} />
                            </div>
                            <div className="flex gap-2 mt-4">
                                <button onClick={() => setShowFertModal(false)} className="flex-1 border rounded-lg py-2 text-gray-600">Annulla</button>
                                <button onClick={handleAddFertilization} className="flex-1 bg-amber-500 text-white rounded-lg py-2 font-bold">Salva</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AIIrrigationCard;