import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Calendar, Users, Sprout, Lock, Eye, EyeOff, MapPin, ArrowRight } from 'lucide-react';
import { api } from '../api/axiosInstance';
import { useAuth } from '../context/AuthContext';
import PlaceAutocomplete from '../components/PlaceAutocomplete';
const GOOGLE_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

const RegisterPage = () => {
  const navigate = useNavigate();
  const { setAccessToken, setUser } = useAuth();
  const [formData, setFormData] = useState({ nome: '', cognome: '', email: '', username: '', dataNascita: '', sesso: '', password: '', confirmPassword: '', location: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if(formData.password !== formData.confirmPassword) return setError('Le password non coincidono');
    setLoading(true);
    try {
      await api.post('/api/utenti/register', { ...formData });
      const res = await api.post('/api/utenti/login', { email: formData.email, password: formData.password });
      setAccessToken(res.data?.accessToken);
      setUser(res.data?.utente);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.detail || 'Errore registrazione');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative py-16 px-4 overflow-hidden bg-[#f0fdf4]">
      <div className="absolute inset-0 bg-gradient-to-tr from-emerald-50 to-teal-100 -z-20"></div>
      
      <div className="w-full max-w-lg relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex bg-gradient-to-br from-emerald-500 to-teal-600 p-5 rounded-3xl shadow-xl mb-6 transform -rotate-3">
             <Sprout className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">Nuovo Account</h2>
        </div>

        <div className="glass bg-white/80 p-10 rounded-[2.5rem] shadow-2xl border border-white/60">
          {error && <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-center font-bold text-sm border border-red-100">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
                <InputIcon icon={User} name="nome" placeholder="Nome" val={formData.nome} onChange={handleChange} />
                <InputIcon icon={User} name="cognome" placeholder="Cognome" val={formData.cognome} onChange={handleChange} />
            </div>
            <InputIcon icon={Mail} name="email" type="email" placeholder="Email" val={formData.email} onChange={handleChange} />
            <InputIcon icon={User} name="username" placeholder="Username" val={formData.username} onChange={handleChange} />
            
            <div className="grid grid-cols-2 gap-4">
                <InputIcon icon={Calendar} name="dataNascita" type="date" val={formData.dataNascita} onChange={handleChange} />
                <div className="relative">
                    <Users className="absolute left-4 top-4 h-5 w-5 text-gray-400" />
                    <select name="sesso" value={formData.sesso} onChange={handleChange} className="w-full pl-12 pr-4 py-4 bg-white border-none rounded-2xl shadow-sm focus:ring-4 focus:ring-emerald-100 font-medium text-gray-600 appearance-none" required>
                        <option value="">Sesso</option><option value="M">Uomo</option><option value="F">Donna</option><option value="Altro">Altro</option>
                    </select>
                </div>
            </div>

            <div className="relative">
                <MapPin className="absolute left-4 top-4 h-5 w-5 text-gray-400 z-10" />
                <PlaceAutocomplete 
                    value={formData.location} onChangeText={v => setFormData(p=>({...p, location:v}))} 
                    onSelectPlace={p => setFormData(prev => ({...prev, location: p.formattedAddress}))}
                    apiKey={GOOGLE_API_KEY}
                    className="w-full pl-12 pr-4 py-4 bg-white border-none rounded-2xl shadow-sm focus:ring-4 focus:ring-emerald-100 font-medium placeholder-gray-400"
                    placeholder="Località (es. Milano)"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                    <Lock className="absolute left-4 top-4 h-5 w-5 text-gray-400" />
                    <input type={showPw ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} placeholder="Password" required className="w-full pl-12 pr-4 py-4 bg-white border-none rounded-2xl shadow-sm focus:ring-4 focus:ring-emerald-100 font-medium placeholder-gray-400" />
                </div>
                <div className="relative">
                    <Lock className="absolute left-4 top-4 h-5 w-5 text-gray-400" />
                    <input type={showPw ? "text" : "password"} name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="Conferma" required className="w-full pl-12 pr-4 py-4 bg-white border-none rounded-2xl shadow-sm focus:ring-4 focus:ring-emerald-100 font-medium placeholder-gray-400" />
                    <button type="button" onClick={()=>setShowPw(!showPw)} className="absolute right-4 top-4 text-gray-400 hover:text-emerald-600"><Eye className="h-5 w-5"/></button>
                </div>
            </div>

            <button type="submit" disabled={loading} className="btn-bouncy w-full mt-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 text-lg">
                {loading ? "Attendere..." : <>Crea Account <ArrowRight className="h-5 w-5" /></>}
            </button>
          </form>
          <div className="mt-8 text-center"><p className="text-gray-600 font-medium">Hai già un account? <Link to="/login" className="text-emerald-700 font-bold hover:underline">Accedi</Link></p></div>
        </div>
      </div>
    </div>
  );
};

const InputIcon = ({ icon: Icon, name, type='text', placeholder, val, onChange }) => (
    <div className="relative">
        <Icon className="absolute left-4 top-4 h-5 w-5 text-gray-400" />
        <input type={type} name={name} value={val} onChange={onChange} placeholder={placeholder} required className="w-full pl-12 pr-4 py-4 bg-white border-none rounded-2xl shadow-sm focus:ring-4 focus:ring-emerald-100 font-medium placeholder-gray-400 transition-all" />
    </div>
);

export default RegisterPage;