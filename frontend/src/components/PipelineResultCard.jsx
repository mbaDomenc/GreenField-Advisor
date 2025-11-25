import React from 'react';
import {
    Droplets, AlertTriangle, CheckCircle, Clock, Leaf, Thermometer, Zap, BarChart,
    Layers, CornerDownRight, X, CalendarClock, Sprout, FlaskConical
} from 'lucide-react';

const Card = ({ children, title, icon: Icon, colorClass = 'text-gray-900', bgClass = 'bg-white' }) => (
    <div className={`${bgClass} p-6 rounded-xl shadow-lg border border-gray-100 space-y-4`}>
        <h3 className={`text-xl font-bold ${colorClass} flex items-center gap-2 border-b pb-2 mb-4`}>
            <Icon className="h-6 w-6" />
            {title}
        </h3>
        {children}
    </div>
);

const DetailRow = ({ label, value, unit, icon: Icon, iconColor = 'text-gray-500' }) => (
    <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
        <div className="flex items-center gap-2 text-sm text-gray-700">
            {Icon && <Icon className={`h-4 w-4 ${iconColor}`} />}
            <span>{label}</span>
        </div>
        <span className="font-semibold text-gray-900 text-sm">
            {typeof value === 'number' ? value.toFixed(value % 1 === 0 ? 0 : 2) : value || '—'} {unit}
        </span>
    </div>
);

export default function PipelineResultCard({ result, plantType }) {
    if (!result || result.status === 'error') {
        const errors = result?.metadata?.errors || [];
        return (
            <Card title="Errore Critico" icon={X} colorClass="text-red-700" bgClass="bg-red-50">
                <p>La pipeline ha riscontrato un errore fatale durante l'elaborazione.</p>
                {errors.length > 0 && (
                    <ul className="list-disc list-inside text-red-600">
                        {errors.map((e, i) => <li key={i} className="text-sm">{e}</li>)}
                    </ul>
                )}
            </Card>
        );
    }

    const { suggestion, details, metadata } = result;
    const frequency = suggestion?.frequency_estimation;
    const fertilizer = suggestion?.fertilizer_estimation;

    return (
        <div className="space-y-6">

            {/* 1. STIMA FREQUENZA E PIANIFICAZIONE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* CARD IDRICA */}
                <Card title="Fabbisogno Idrico" icon={CalendarClock} colorClass="text-blue-700" bgClass="bg-blue-50">
                    {frequency ? (
                        <div className="text-center py-2">
                            <p className="text-xs text-blue-600 uppercase tracking-wider font-bold mb-1">Frequenza Irrigazione</p>
                            <p className="text-2xl font-extrabold text-blue-900">{frequency.detail}</p>
                            <p className="text-sm text-blue-700 mt-2 font-medium">Impatto: {frequency.label}</p>
                        </div>
                    ) : (
                        <p className="text-gray-500">Stima frequenza non disponibile.</p>
                    )}
                    <div className="mt-4 pt-3 border-t border-blue-200">
                        <DetailRow label="Evapotraspirazione" value={details.features?.evapotranspiration} unit="mm/g" />
                        <DetailRow label="Quantità Ideale" value={suggestion?.water_amount_liters} unit="Litri" />
                    </div>
                </Card>

                {/*CARD NUTRIZIONALE*/}
                <Card title="Fabbisogno Nutrizionale" icon={Sprout} colorClass="text-amber-700" bgClass="bg-amber-50">
                    {fertilizer ? (
                        <div className="text-center py-2">
                            <p className="text-xs text-amber-600 uppercase tracking-wider font-bold mb-1">Frequenza Concimazione</p>
                            <p className="text-2xl font-extrabold text-amber-900">{fertilizer.frequency}</p>
                            <p className="text-sm text-amber-800 mt-2 font-medium px-2">{fertilizer.type}</p>
                        </div>
                    ) : (
                        <p className="text-gray-500">Dati concimazione non disponibili.</p>
                    )}
                    <div className="mt-4 pt-3 border-t border-amber-200">
                        <p className="text-xs text-amber-800 italic leading-relaxed">
                            "{fertilizer?.reasoning || 'Nessuna nota specifica.'}"
                        </p>
                    </div>
                </Card>
            </div>

            {/* 2. LOG: Dati Puliti */}
            <Card title={`Analisi Input: ${plantType.toUpperCase()}`} icon={CheckCircle} colorClass="text-green-600">
                <h4 className="font-semibold text-gray-700 mt-2 mb-3">Parametri Ambientali Rilevati</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                    {Object.entries(details.cleaned_data || {}).map(([key, value]) => (
                        <DetailRow
                            key={key}
                            label={key.replace('_', ' ').charAt(0).toUpperCase() + key.replace('_', ' ').slice(1)}
                            value={value}
                            unit={key.includes('moisture') || key.includes('humidity') ? '%' : key.includes('temp') ? '°C' : key.includes('light') ? 'lux' : ''}
                            icon={Zap}
                            iconColor="text-teal-600"
                        />
                    ))}
                </div>
            </Card>

            {/* 3. LOG: Feature Calcolate */}
            <Card title="Metriche Calcolate (AI)" icon={BarChart} colorClass="text-purple-600">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                    <DetailRow label="Indice Stress Idrico" value={details.features?.water_stress_index} unit="/ 100" />
                    <DetailRow label="Indice Comfort Climatico" value={details.features?.climate_comfort_index} unit="/ 100" />
                    <DetailRow label="Deficit Idrico" value={details.features?.water_deficit} unit="mm" />
                    <DetailRow label="Urgenza (Scala 0-10)" value={details.features?.irrigation_urgency} unit="" />
                    
                    {/* Nuovi indicatori avanzati se presenti */}
                    {details.features?.vpd !== undefined && (
                        <>
                            <DetailRow label="VPD (Traspirazione)" value={details.features?.vpd} unit="kPa" />
                            <DetailRow label="Rischio Malattie" value={details.features?.disease_risk} unit="%" />
                            <DetailRow label="Fattore Terreno" value={details.features?.soil_retention_factor} unit="x" />
                        </>
                    )}
                </div>
                
                {details.features?.soil_behavior && (
                    <div className="mt-4 p-3 bg-purple-50 rounded-lg text-sm text-purple-800 border border-purple-100">
                        <strong>Analisi Suolo:</strong> {details.features.soil_behavior}
                    </div>
                )}
            </Card>

            {/* 4. LOG: Stima e Anomalie */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card title="Log Decisionale" icon={Layers} colorClass="text-orange-600">
                    <p className="text-sm font-semibold text-gray-800">
                        Strategia: <span className="uppercase">{details.estimation?.plant_type}</span>
                    </p>
                    <p className="text-sm text-gray-700 border-b pb-2 my-2">
                        <strong className="text-orange-600">Ragionamento:</strong> {details.estimation?.reasoning}
                    </p>
                    <DetailRow label="Azione Immediata" value={suggestion?.should_water ? "IRRIGARE" : "NON IRRIGARE"} icon={CornerDownRight} />
                    <DetailRow label="Confidenza" value={details.estimation?.confidence * 100} unit="%" icon={CornerDownRight} />
                </Card>

                <Card title="Anomalie Rilevate" icon={AlertTriangle} colorClass={details.anomalies?.some(a => a.severity === 'critical') ? 'text-red-600' : 'text-gray-600'}>
                    {(details.anomalies?.length || 0) > 0 ? (
                        <ul className="space-y-3">
                            {details.anomalies.map((a, i) => (
                                <li key={i} className={`p-3 rounded-lg border ${a.severity === 'critical' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'} text-sm`}>
                                    <div className={`font-bold uppercase ${a.severity === 'critical' ? 'text-red-700' : 'text-yellow-800'} flex items-center gap-2`}>
                                        <AlertTriangle className="h-4 w-4" /> {a.type}
                                    </div>
                                    <p className="text-xs mt-1 text-gray-700">{a.message}</p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-gray-500">Nessuna anomalia critica rilevata.</p>
                    )}
                </Card>
            </div>
        </div>
    );
}