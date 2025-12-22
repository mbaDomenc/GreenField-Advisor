import React, { useEffect, useState } from 'react';
import {
  MapPin, Cloud, Droplets, Leaf, Wind, Calendar, Activity
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
  const [locationSource, setLocationSource] = useState('gps'); // Default GPS

  const now = new Date();

  useEffect(() => {
    if (accessToken) {
      loadDashboardData();
    }
  }, [accessToken]);

  // Funzione GPS "aggressiva"
  const getBrowserLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocalizzazione non supportata"));
      } else {
        console.log("📡 Richiesta GPS in corso (High Accuracy)...");
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            console.log("✅ GPS Ottenuto:", pos.coords.latitude, pos.coords.longitude);
            resolve(pos.coords);
          },
          (err) => {
            console.warn("❌ Errore GPS:", err.message);
            reject(err);
          },
          {
            enableHighAccuracy: true, // FONDAMENTALE: Usa il GPS vero, non la rete internet
            timeout: 15000,           // Diamo più tempo (15s) per triangolare bene
            maximumAge: 0             // VIETATO usare cache vecchia
          }
        );
      }
    });
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Recupera Dati Utente
      const resUser = await api.get('/api/utenti/me');
      const user = resUser.data.utente;
      setUserData(user);
      updateUser?.(user);

      let weatherData = null;
      let usedSource = 'gps';

      // 2. TENTATIVO 1: GPS (Priorità Massima)
      try {
        const coords = await getBrowserLocation();
        
        // Chiamata Meteo con coordinate esatte
        const resWeather = await api.get(`/api/weather?lat=${coords.latitude}&lon=${coords.longitude}`);
        weatherData = resWeather.data;
        
        // DEBUG CRUCIALE: Controlla cosa restituisce il backend
        console.log("☁️ Dati Meteo Backend:", weatherData);
        console.log("📍 Nome località dal Backend:", weatherData.location?.name);

        usedSource = 'gps';

      } catch (gpsError) {
        console.warn("⚠️ Fallback GPS fallito, provo con la località del profilo...");
        
        // 3. TENTATIVO 2: Profilo Utente (Fallback)
        if (user?.location) {
           try {
             const resWeather = await api.get(`/api/weather?city=${encodeURIComponent(user.location)}`);
             weatherData = resWeather.data;
             usedSource = 'profile';
           } catch (e) {
             console.error("Errore meteo profilo:", e);
           }
        }
      }

      setWeather(weatherData);
      setLocationSource(usedSource);

      // 4. Interventi recenti
      const resInterv = await api.get(`/api/piante/utente/interventi-recenti`);
      setRecentInterventions(resInterv.data || []);

      setError(null);
    } catch (err) {
      console.error('Errore dashboard:', err);
      setError(err.response?.data?.detail || err.message);
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
      <div className="min-h-screen flex items-center justify-center bg-[#f0fdf4] pt-32">
          <div className="p-8 bg-white rounded-3xl shadow-xl text-red-500 font-medium border border-red-100">
              Errore: {error}
          </div>
      </div>
  );
  
  if (!userData) return null;

  // LOGICA DISPLAY NOME: Se siamo in GPS, mostriamo "Posizione Rilevata" se il nome è generico
  let displayLocation = weather?.location?.name || 'Posizione Sconosciuta';
  
  // Se usiamo il profilo, mostriamo quello che ha scritto l'utente
  if (locationSource === 'profile' && userData.location) {
      displayLocation = userData.location.split(',')[0];
  }

  return (
    <div className="bg-[#f0fdf4] min-h-screen px-6 pt-36 pb-12 font-sans relative overflow-hidden">
      
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-200/20 rounded-full blur-3xl -z-10 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-teal-200/20 rounded-full blur-3xl -z-10 pointer-events-none"></div>

      <div className="max-w-7xl mx-auto space-y-8">

        {/* HEADER */}
        <div className="relative bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-[2.5rem] p-8 md:p-12 shadow-2xl shadow-emerald-900/20 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="absolute top-0 right-0 p-8 opacity-10">
                <Leaf className="h-64 w-64 transform rotate-12" />
            </div>
            
            <div className="relative z-10">
                <h1 className="text-3xl md:text-5xl font-extrabold mb-3 tracking-tight">
                    Ciao, {userData.nome} 👋
                </h1>
                <p className="text-emerald-100 text-lg font-medium mb-1 flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {format(now, 'EEEE d MMMM yyyy', { locale: it })}
                </p>
                <p className="text-emerald-200 italic text-sm md:text-base opacity-90 mt-4 border-l-4 border-emerald-400 pl-4">
                    "Coltiva il tuo benessere ogni giorno."
                </p>
            </div>
        </div>

        {/* STATISTICHE */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
            <StatCard 
                title="Piante totali" 
                value={userData.plantCount || 0} 
                icon={<Leaf className="h-8 w-8 text-white" />} 
                bgIcon="bg-emerald-500"
                trend="Attive"
            />
            <StatCard 
                title="Azioni oggi" 
                value={userData.interventionsToday || 0} 
                icon={<Activity className="h-8 w-8 text-white" />} 
                bgIcon="bg-blue-500"
                trend="Completate"
            />
            <StatCard 
                title={locationSource === 'gps' ? "GPS (High Accuracy)" : "Città Profilo"} 
                value={displayLocation} 
                icon={<MapPin className="h-8 w-8 text-white" />} 
                bgIcon={locationSource === 'gps' ? "bg-purple-500" : "bg-orange-400"}
                trend={locationSource === 'gps' ? "Rilevata" : "Salvata"}
                isText
            />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
            
            {/* METEO CARD */}
            <div className="lg:col-span-1 h-full">
                <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-white/60 hover-float h-full relative overflow-hidden group transition-all duration-300 hover:shadow-2xl">
                    <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
                    
                    <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-xl text-blue-600"><Cloud className="h-6 w-6" /></div>
                        Meteo Locale
                    </h2>
                    
                    {weather ? (
                        <div className="flex flex-col items-center justify-center py-4">
                            <div className="text-7xl font-black text-gray-800 mb-2 tracking-tighter">
                                {Math.round(weather.temp)}°
                            </div>
                            <div className="flex items-center gap-2 text-gray-500 font-medium mb-8 bg-gray-100 px-4 py-1.5 rounded-full text-sm">
                                <MapPin className="h-4 w-4" /> {displayLocation}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 w-full">
                                <div className="bg-blue-50 p-4 rounded-2xl flex flex-col items-center border border-blue-100">
                                    <Droplets className="h-6 w-6 text-blue-500 mb-2" />
                                    <span className="text-xs text-blue-400 font-bold uppercase tracking-wider">Umidità</span>
                                    <span className="text-xl font-bold text-blue-900">{weather.humidity}%</span>
                                </div>
                                <div className="bg-indigo-50 p-4 rounded-2xl flex flex-col items-center border border-indigo-100">
                                    <Wind className="h-6 w-6 text-indigo-500 mb-2" />
                                    <span className="text-xs text-indigo-400 font-bold uppercase tracking-wider">Pioggia</span>
                                    <span className="text-xl font-bold text-indigo-900">{weather.rainNext24h} mm</span>
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
                <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-white/60 h-full relative">
                    <div className="flex justify-between items-end mb-8">
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600"><Activity className="h-6 w-6" /></div>
                            Attività Recenti
                        </h2>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-full uppercase tracking-wider">Ultimi 5</span>
                    </div>

                    {recentInterventions.length === 0 ? (
                        <div className="text-center py-16 border-2 border-dashed border-gray-100 rounded-3xl bg-gray-50/50">
                            <div className="bg-white p-4 rounded-full inline-block shadow-sm mb-3">
                                <Leaf className="h-8 w-8 text-gray-300" />
                            </div>
                            <p className="text-gray-400 font-medium text-lg">Nessuna attività recente.</p>
                            <p className="text-sm text-gray-400 mt-1">Inizia a curare le tue piante!</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {recentInterventions.map((intv) => (
                                <div key={intv.id} className="group flex items-center gap-5 p-5 rounded-2xl bg-gray-50 hover:bg-white hover:shadow-lg transition-all duration-300 border border-transparent hover:border-emerald-100 cursor-default">
                                    <div className={`p-4 rounded-2xl flex-shrink-0 shadow-sm transition-transform group-hover:scale-110 ${
                                        intv.type === 'irrigazione' ? 'bg-blue-100 text-blue-600' :
                                        intv.type === 'concimazione' ? 'bg-amber-100 text-amber-600' :
                                        'bg-gray-200 text-gray-600'
                                    }`}>
                                        {intv.type === 'irrigazione' ? <Droplets className="h-6 w-6" /> :
                                         intv.type === 'concimazione' ? <Leaf className="h-6 w-6" /> :
                                         <Activity className="h-6 w-6" />}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center mb-1">
                                            <h4 className="font-bold text-gray-900 capitalize text-lg">{intv.type}</h4>
                                            <span className="text-xs text-gray-400 font-medium bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm">
                                                {format(new Date(new Date(intv.executedAt || intv.createdAt).getTime() + 2 * 60 * 60 * 1000), 'dd MMM, HH:mm', { locale: it })}
                                            </span>
                                        </div>
                                        
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {intv.liters && <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">{intv.liters} L</span>}
                                            {intv.fertilizerType && <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100">{intv.fertilizerType}</span>}
                                            {intv.dose && <span className="text-xs text-gray-500 bg-white px-2.5 py-1 rounded-lg border border-gray-200">Dose: {intv.dose}</span>}
                                        </div>

                                        {intv.notes && (
                                            <p className="text-sm text-gray-500 mt-2 italic pl-1">
                                                "{intv.notes}"
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, bgIcon, trend, isText = false }) => {
  return (
    <div className="hover-float bg-white p-8 rounded-[2rem] shadow-xl border border-white/60 flex items-center gap-6 transition-transform duration-300 group">
        <div className={`w-20 h-20 ${bgIcon} rounded-3xl flex items-center justify-center shadow-lg shadow-emerald-900/10 transform -rotate-3 group-hover:rotate-0 transition-transform duration-500`}>
            {icon}
        </div>
        <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{title}</p>
            <div className={`font-black text-gray-900 ${isText ? 'text-xl' : 'text-5xl'} leading-none tracking-tight`}>
                {value}
            </div>
            {trend && (
                <div className="mt-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500">
                    {trend}
                </div>
            )}
        </div>
    </div>
  );
};

export default Dashboard;