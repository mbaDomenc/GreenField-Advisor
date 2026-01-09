import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, Sprout, CheckCircle, Clock } from 'lucide-react';
import { api } from '../api/axiosInstance';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const response = await api.post('/api/auth/forgot-password', {
        email: email
      });
      
      setSuccess(true);
      // NON pulire l'email subito per mostrare a quale email è stato inviato
      
    } catch (err) {
      setError(err.response?.data?.detail || 'Errore durante la richiesta');
    } finally {
      setLoading(false);
    }
  };

  // Se il form è stato inviato con successo, mostra schermata di conferma
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center relative py-10 px-4 overflow-hidden">
        {/* Sfondo decorativo */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-teal-50 -z-20"></div>
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-emerald-200/30 rounded-full blur-[100px] -z-10"></div>

        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-10">
            <div className="inline-flex bg-gradient-to-br from-emerald-500 to-teal-500 p-5 rounded-3xl shadow-xl mb-6">
              <CheckCircle className="h-12 w-12 text-white" />
            </div>
            <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-2">
              Email Inviata! 📧
            </h2>
            <p className="text-gray-600 font-medium">
              Controlla la tua casella di posta
            </p>
          </div>

          <div className="glass bg-white/70 p-10 rounded-[2.5rem] shadow-2xl shadow-emerald-900/10 border border-white">
            {/* Messaggio di successo dettagliato */}
            <div className="space-y-6">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
                <div className="flex items-start gap-4">
                  <Mail className="h-6 w-6 text-emerald-600 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="font-bold text-emerald-800 mb-2">
                      Link inviato a:
                    </h3>
                    <p className="text-emerald-700 font-semibold break-all">
                      {email}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
                <div className="flex items-start gap-4">
                  <Clock className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="font-bold text-blue-800 mb-2">
                      Prossimi passi:
                    </h3>
                    <ol className="text-blue-700 text-sm space-y-2 list-decimal list-inside">
                      <li>Controlla la tua email (anche in spam)</li>
                      <li>Clicca sul link ricevuto</li>
                      <li>Crea una nuova password sicura</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Info aggiuntive */}
              <div className="text-center text-gray-600 text-sm">
                <p className="mb-2">
                  ⏱️ Il link sarà valido per <strong>1 ora</strong>
                </p>
                <p className="text-xs text-gray-500">
                  Non hai ricevuto l'email? Controlla lo spam o riprova tra qualche minuto
                </p>
              </div>

              {/* Bottoni azione */}
              <div className="space-y-3 pt-4">
                <button
                  onClick={() => navigate('/login')}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-500/30 transition"
                >
                  Torna al Login
                </button>
                
                <button
                  onClick={() => {
                    setSuccess(false);
                    setEmail('');
                  }}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-4 rounded-2xl transition"
                >
                  Invia di Nuovo
                </button>
              </div>
            </div>
          </div>

          {/* Info contatto supporto */}
          <div className="text-center mt-8 text-sm text-gray-600">
            <p>
              Hai problemi? Contattaci a{' '}
              <a href="mailto:support@greenfield-advisor.com" className="text-emerald-600 font-semibold hover:underline">
                support@greenfield-advisor.com
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Form iniziale per inserire l'email
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
          <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-2">
            Password Dimenticata?
          </h2>
          <p className="text-gray-600 font-medium">
            Inserisci la tua email per ricevere il link di reset
          </p>
        </div>

        <div className="glass bg-white/70 p-10 rounded-[2.5rem] shadow-2xl shadow-emerald-900/10 border border-white">
          {/* Messaggio di errore */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm font-bold text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-600 ml-1">
                Indirizzo Email
              </label>
              <div className="relative">
                <Mail className="absolute left-5 top-4 h-5 w-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-5 py-4 bg-white border-none rounded-2xl shadow-sm focus:ring-4 focus:ring-emerald-100 transition-all font-medium text-gray-800"
                  placeholder="tu@esempio.com"
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-bouncy w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 text-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path 
                      className="opacity-75" 
                      fill="currentColor" 
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Invio in corso...
                </>
              ) : (
                'Invia Link di Reset'
              )}
            </button>
          </form>
        </div>

        {/* Link torna al login */}
        <div className="text-center mt-8">
          <button
            onClick={() => navigate('/login')}
            className="text-emerald-700 font-bold hover:underline inline-flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Torna al Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
