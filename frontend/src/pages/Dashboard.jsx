import React, { useEffect, useState } from 'react';
import {
  MapPin, Cloud, Droplets, Leaf, Wind, Calendar, ArrowRight, Activity
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/axiosInstance';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

const Dashboard = () => {
  const { accessToken, updateUser } = useAuth(); 
  const [userData, setUserData] = useState(null);
  const [weather, setWeather] = useState(null);
  const [recentInterventions, setRecentInterventions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const now = new Date();

  useEffect(() => {
    if (accessToken) {
      loadDashboardData();
    }
  }, [accessToken]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Recupera dati aggiornati utente
      const resUser = await api.get('/api/utenti/me');
      const user = resUser.data.utente;
      setUserData(user);
      updateUser?.(user);

      // Meteo
      if (user?.location) {
        const resWeather = await api.get(`/api/weather?city=${encodeURIComponent(user.location)}`);
        setWeather(resWeather.data);
      }

      // Interventi recenti globali
      const resInterv = await api.get(`/api/piante/utente/interventi-recenti`);
      setRecentInterventions(resInterv.data || []);

      setError(null);
    } catch (err) {
      console.error('Errore nel caricamento dashboard:', err);
      setError(err.response?.data?.detail || err.message || 'Errore imprevisto');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0fdf4]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
      </div>
  );

  if (error) return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0fdf4]">
          <div className="p-8 bg-white rounded-3xl shadow-xl text-red-500 font-medium border border-red-100">
              Errore: {error}
          </div>
      </div>
  );
  
  if (!userData) return null;

  return (
    // 🟢 pt-32: Spazio extra in alto per non finire sotto la Navbar
    <div className="bg-[#f0fdf4] min-h-screen p-6 pt-32 pb-12 font-sans relative overflow-hidden">
      
      {/* Decorazioni Sfondo */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-200/20 rounded-full blur-3xl -z-10 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-teal-200/20 rounded-full blur-3xl -z-10 pointer-events-none"></div>

      <div className="max-w-7xl mx-auto space-y-8">

        {/* HEADER: Benvenuto */}
        <div className="relative bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-[2.5rem] p-8 md:p-10 shadow-2xl shadow-emerald-900/20 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Pattern decorativo */}
            <div className="absolute top-0 right-0 p-8 opacity-10">
                <Leaf className="h-48 w-48 transform rotate-12" />
            </div>
            
            <div className="relative z-10">
                <h1 className="text-3xl md:text-5xl font-extrabold mb-3 tracking-tight">
                    Ciao, {userData.nome} 👋
                </h1>
                <p className="text-emerald-100 text-lg font-medium mb-1 flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {format(now, 'EEEE d MMMM yyyy', { locale: it })}
                </p>
                <p className="text-emerald-200 italic text-sm md:text-base opacity-90 mt-2">
                    "La pazienza è l'ingrediente segreto di ogni raccolto."
                </p>
            </div>
        </div>

        {/* STATISTICHE (Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
            <StatCard 
                title="Piante totali" 
                value={userData.plantCount || 0} 
                icon={<Leaf className="h-6 w-6 text-white" />} 
                bgIcon="bg-emerald-500"
                trend="Attive"
            />
            <StatCard 
                title="Azioni oggi" 
                value={userData.interventionsToday || 0} 
                icon={<Activity className="h-6 w-6 text-white" />} 
                bgIcon="bg-blue-500"
                trend="Completate"
            />
            <StatCard 
                title="La tua zona" 
                value={userData.location?.split(',')[0] || '—'} 
                icon={<MapPin className="h-6 w-6 text-white" />} 
                bgIcon="bg-orange-400"
                trend="Località"
                isText
            />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
            
            {/* METEO CARD */}
            <div className="lg:col-span-1 h-full">
                <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-white/60 hover-float h-full relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
                    
                    <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <Cloud className="h-6 w-6 text-blue-500" /> Meteo Locale
                    </h2>
                    
                    {weather ? (
                        <div className="flex flex-col items-center justify-center py-4">
                            <div className="text-6xl font-black text-gray-800 mb-2 tracking-tighter">
                                {Math.round(weather.temp)}°
                            </div>
                            <div className="flex items-center gap-2 text-gray-500 font-medium mb-8 bg-gray-100 px-4 py-1 rounded-full">
                                <MapPin className="h-3 w-3" /> {userData.location?.split(',')[0]}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 w-full">
                                <div className="bg-blue-50 p-4 rounded-2xl flex flex-col items-center">
                                    <Droplets className="h-6 w-6 text-blue-500 mb-1" />
                                    <span className="text-xs text-blue-400 font-bold uppercase">Umidità</span>
                                    <span className="text-lg font-bold text-blue-900">{weather.humidity}%</span>
                                </div>
                                <div className="bg-indigo-50 p-4 rounded-2xl flex flex-col items-center">
                                    <Wind className="h-6 w-6 text-indigo-500 mb-1" />
                                    <span className="text-xs text-indigo-400 font-bold uppercase">Pioggia</span>
                                    <span className="text-lg font-bold text-indigo-900">{weather.rainNext24h} mm</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-gray-400 py-10">Dati meteo non disponibili</div>
                    )}
                </div>
            </div>

            {/* ULTIMI INTERVENTI */}
            <div className="lg:col-span-2">
                <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-white/60 h-full">
                    <div className="flex justify-between items-end mb-6">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Activity className="h-6 w-6 text-emerald-600" /> Attività Recenti
                        </h2>
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">Ultimi 5</span>
                    </div>

                    {recentInterventions.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-2xl">
                            <p className="text-gray-400 font-medium">Nessuna attività recente.</p>
                            <p className="text-sm text-gray-300 mt-1">Inizia a curare le tue piante!</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {recentInterventions.map((intv) => (
                                <div key={intv.id} className="group flex items-start gap-4 p-4 rounded-2xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                                    {/* Icona Tipo */}
                                    <div className={`p-3 rounded-xl flex-shrink-0 ${
                                        intv.type === 'irrigazione' ? 'bg-blue-100 text-blue-600' :
                                        intv.type === 'concimazione' ? 'bg-amber-100 text-amber-600' :
                                        'bg-gray-100 text-gray-600'
                                    }`}>
                                        {intv.type === 'irrigazione' ? <Droplets className="h-5 w-5" /> :
                                         intv.type === 'concimazione' ? <Leaf className="h-5 w-5" /> :
                                         <Activity className="h-5 w-5" />}
                                    </div>

                                    {/* Contenuto */}
                                    <div className="flex-1 min-w-0 pt-1">
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-bold text-gray-900 capitalize text-base">{intv.type}</h4>
                                            <span className="text-xs text-gray-400 font-medium bg-white px-2 py-1 rounded-md border border-gray-100 shadow-sm">
                                                {format(new Date(new Date(intv.executedAt || intv.createdAt).getTime() + 2 * 60 * 60 * 1000), 'dd MMM, HH:mm', { locale: it })}
                                            </span>
                                        </div>
                                        
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {intv.liters && <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-md">{intv.liters} L</span>}
                                            {intv.fertilizerType && <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-md">{intv.fertilizerType}</span>}
                                            {intv.dose && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md">Dose: {intv.dose}</span>}
                                        </div>

                                        {intv.notes && (
                                            <p className="text-sm text-gray-500 mt-2 italic border-l-2 border-gray-200 pl-3 line-clamp-1">
                                                "{intv.notes}"
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {/* Footer lista */}
                    {recentInterventions.length > 0 && (
                        <div className="mt-6 pt-4 border-t border-gray-100 text-center">
                            <button className="text-sm font-bold text-emerald-600 hover:text-emerald-700 flex items-center justify-center gap-1 group">
                                Vedi tutto lo storico <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

// Componente StatCard ridisegnato
const StatCard = ({ title, value, icon, bgIcon, trend, isText = false }) => {
  return (
    <div className="hover-float bg-white p-6 rounded-[2rem] shadow-xl shadow-emerald-900/5 border border-white/60 flex items-center gap-5">
        <div className={`w-16 h-16 ${bgIcon} rounded-2xl flex items-center justify-center shadow-lg transform rotate-3`}>
            {icon}
        </div>
        <div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-wide">{title}</p>
            <div className={`font-extrabold text-gray-900 ${isText ? 'text-xl' : 'text-4xl'} mt-1 leading-none`}>
                {value}
            </div>
            {trend && <p className="text-xs font-medium text-emerald-600 mt-2 bg-emerald-50 px-2 py-0.5 rounded-md inline-block">{trend}</p>}
        </div>
    </div>
  );
};

export default Dashboard;