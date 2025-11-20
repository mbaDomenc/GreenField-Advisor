import React from "react";
import { Routes, Route, Navigate, useParams, useNavigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import Dashboard from "./pages/Dashboard";
import ProfilePage from "./pages/ProfilePage";
import AIIrrigationPage from './pages/AIIrrigationPage';
import PipelineTestPage from "./pages/PipelineTestPage";
import PlantsList from "./pages/PlantsList";
import PlantDetail from "./pages/PlantDetail";
import RequireAuth from './components/RequireAuth';
import RequireGuest from './components/RequireGuest';

// Wrapper lista piante con navigazione dettagli
function PlantsListWrapper() {
  const navigate = useNavigate();
  return (
    <RequireAuth>
      <PlantsList
        onOpenDetail={(plant) => {
          if (plant?.id) navigate(`/piante/${plant.id}`);
        }}
      />
    </RequireAuth>
  );
}

// Wrapper dettaglio pianta con gestione back/delete
function PlantDetailWrapper() {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <RequireAuth>
      <PlantDetail
        plantId={id}
        onBack={() => navigate('/piante')}
        onDeleted={() => navigate('/piante')}
      />
    </RequireAuth>
  );
}

export default function App() {
  return (
    <div
      className="app-bg min-h-screen flex flex-col font-sans"
      style={{
        background: 'linear-gradient(90deg, #f7ffe5 60%, #e8ffc1 100%)',
        color: '#155452'
      }}
    >
      {/* Navbar con logo smart e highlight */}
      <Navbar />
      <main className="flex-1 flex flex-col items-center justify-start py-4 px-2">
        <Routes>
          <Route path="/" element={<HomePage />} />

          {/* Guest routes */}
          <Route path="/login" element={
            <RequireGuest>
              <LoginPage />
            </RequireGuest>
          }/>
          <Route path="/register" element={
            <RequireGuest>
              <RegisterPage />
            </RequireGuest>
          }/>

          {/* Authenticated routes */}
          <Route path="/dashboard" element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }/>
          <Route path="/profilo" element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }/>
          <Route path="/ai/irrigazione" element={
            <RequireAuth>
              <AIIrrigationPage />
            </RequireAuth>
          }/>
          <Route path="/ai/pipeline-test" element={
            <RequireAuth>
              <PipelineTestPage />
            </RequireAuth>
          }/>
          <Route path="/piante" element={<PlantsListWrapper />} />
          <Route path="/piante/:id" element={<PlantDetailWrapper />} />
          {/* Fallback redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {/* Footer con tema green */}
      <Footer style={{
        backgroundColor: '#00a86b',
        color: '#fff'
      }} />
    </div>
  );
}
