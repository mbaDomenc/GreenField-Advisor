import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function RedirectWithAlert({ message, to = '/', replace = true }) {
  const navigate = useNavigate();

  useEffect(() => {
    window.alert(message);
    navigate(to, { replace });
  }, [message, to, replace, navigate]);

  return null;
}

export default function RequireAuth({ children, roles, redirectIfNotAuth = '/login', redirectIfForbidden = '/' }) {
  const { isAuthenticated, loading, user } = useAuth();

  // Mostra spinner mentre sta caricando il token
  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  // Solo DOPO il loading, controlla se NON autenticato
  if (!isAuthenticated) {
    return (
      <RedirectWithAlert
        message="Devi effettuare il login per accedere a questa pagina."
        to={redirectIfNotAuth}
        replace
      />
    );
  }

  // Controllo ruoli (solo se specificati)
  if (roles && roles.length > 0) {
    const ruolo = user?.ruolo;
    if (!ruolo || !roles.includes(ruolo)) {
      return (
        <RedirectWithAlert
          message="Non sei autorizzato ad accedere a questa pagina."
          to={redirectIfForbidden}
          replace
        />
      );
    }
  }

  return children;
}