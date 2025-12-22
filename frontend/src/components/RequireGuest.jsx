
import React, { useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RequireGuest({ children, redirectTo = '/dashboard', showAlert = true }) {
  const { isAuthenticated, loading } = useAuth();

  // Si tiene traccia del valore precedente di isAuthenticated
  const prevAuthRef = useRef(isAuthenticated);
  const prevAuth = prevAuthRef.current;

  useEffect(() => {
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated]);

  // Lascia renderizzare finché l'AuthContext non ha finito di inizializzare
  if (loading) return children;
  if (!isAuthenticated) return children;

  // Sei autenticato. Ora distinguo:
  // Se PRIMA non lo eri e ORA sì -> ti sei appena loggato su questa pagina -> NO popup
  // Se eri già autenticato quando sei arrivato qui -> reindirizza
  const justLoggedInHere = prevAuth === false && isAuthenticated === true;

  if (justLoggedInHere) {
    // appena loggato da questa stessa pagina: nessun popup
    return <Navigate to={redirectTo} replace />;
  }

  // Utente già autenticato che prova a vedere /login o /register: puoi opzionalmente mostrare un flash
  if (showAlert) {
    return (
      <Navigate
        to="/"
        replace
        state={{ flash: { type: 'info', message: 'Sei già autenticato.' } }}
      />
    );
  }

  // oppure senza alcun messaggio
  return <Navigate to={redirectTo} replace />;
}