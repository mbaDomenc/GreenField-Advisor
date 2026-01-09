import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Lock, Sprout, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { api } from '../api/axiosInstance';
import { useAuth } from '../context/AuthContext';


const LoginPage = () => {
  const navigate = useNavigate();
  const { setAccessToken, setUser } = useAuth();
  const [formData, setFormData] = useState({ identifier: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = { password: formData.password };
      if (formData.identifier.includes('@')) payload.email = formData.identifier;
      else payload.username = formData.identifier;
      
      const res = await api.post('/api/utenti/login', payload);
      setAccessToken(res.data?.accessToken);
      setUser(res.data?.utente);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.detail || 'Credenziali non valide');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center relative py-10 px-4 overflow-hidden">
       {/* Sfondo decorativo */}
       <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-teal-50 -z-20"></div>
       <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-emerald-200/30 rounded-full blur-[100px] -z-10"></div>


       <div className="w-full max-w-md relative z-10">
         <div className="text-center mb-10">
             <div className="inline-flex bg-gradient-to-br from-emerald-500 to-teal-500 p-5 rounded-3xl shadow-xl mb-6 transform rotate-6">
                 <Sprout className="h-10 w-10 text-white" />
             </div>
             <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">Bentornato!</h2>
         </div>


         <div className="glass bg-white/70 p-10 rounded-[2.5rem] shadow-2xl shadow-emerald-900/10 border border-white">
            {error && <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold text-center border border-red-100">{error}</div>}
            
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-600 ml-1">Email o Username</label>
                    <div className="relative">
                        <User className="absolute left-5 top-4 h-5 w-5 text-gray-400" />
                        <input type="text" className="w-full pl-12 pr-5 py-4 bg-white border-none rounded-2xl shadow-sm focus:ring-4 focus:ring-emerald-100 transition-all font-medium text-gray-800" placeholder="tu@esempio.com" value={formData.identifier} onChange={e => setFormData({...formData, identifier: e.target.value})} required />
                    </div>
                </div>


                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-600 ml-1">Password</label>
                    <div className="relative">
                        <Lock className="absolute left-5 top-4 h-5 w-5 text-gray-400" />
                        <input type={showPw ? "text" : "password"} className="w-full pl-12 pr-12 py-4 bg-white border-none rounded-2xl shadow-sm focus:ring-4 focus:ring-emerald-100 transition-all font-medium text-gray-800" placeholder="••••••••" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />
                        <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-5 top-4 text-gray-400 hover:text-emerald-600 transition-colors">
                            {showPw ? <EyeOff className="h-5 w-5"/> : <Eye className="h-5 w-5"/>}
                        </button>
                    </div>
                </div>


                <div className="flex justify-end">
                    <Link to="/forgot-password" className="text-sm font-bold text-emerald-600 hover:text-emerald-800 transition-colors">
                        Password dimenticata?
                    </Link>
                </div>


                <button type="submit" disabled={loading} className="btn-bouncy w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 text-lg">
                    {loading ? "Accesso..." : <>Accedi <ArrowRight className="h-5 w-5" /></>}
                </button>
            </form>
         </div>
         <p className="text-center mt-8 text-gray-600 font-medium">Non hai un account? <Link to="/register" className="text-emerald-700 font-bold hover:underline">Registrati</Link></p>
       </div>
    </div>
  );
};
export default LoginPage;
