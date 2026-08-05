import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/layout/Sidebar';
import DashboardPage from './pages/DashboardPage';
import CreationPage from './pages/CreationPage';
import QuickCapturePage from './pages/QuickCapturePage';
import AtelierPage from './pages/AtelierPage';
import PlanningPage from './pages/PlanningPage';
import SplashScreen from './components/common/SplashScreen';

/**
 * Composant Racine ODOS.
 * Conformément à US-1 (PRD_ecran0_dashboard.md), s'ouvre systématiquement sur le Dashboard.
 * Intègre l'écran de démarrage SplashScreen (Phase 10) affiché une seule fois au chargement.
 */
export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'creation' | 'quick-capture' | 'atelier' | 'planning'
  const [selectedDestinationId, setSelectedDestinationId] = useState(null);
  const [pendingValidationCount, setPendingValidationCount] = useState(0);
  const [showSplash, setShowSplash] = useState(true);

  const tripId = 1; // Voyage par défaut pour la V1 (Mono-utilisateur)

  // Chargement du nombre réel de fiches en attente de validation
  const loadPendingCount = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}/pending-validation`);
      if (res.ok) {
        const data = await res.json();
        setPendingValidationCount(data.length);
      }
    } catch (err) {
      console.error("Erreur chargement pending validation count:", err);
    }
  }, [tripId]);

  useEffect(() => {
    loadPendingCount();
  }, [loadPendingCount]);

  const handleFinishSplash = () => {
    setShowSplash(false);
  };

  const handleNavigateTab = (tab, destinationId = null) => {
    if (destinationId) {
      setSelectedDestinationId(destinationId);
    }
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-[#F1F0ED] topo-bg flex flex-col md:flex-row font-sans text-[#17181A]">
      {/* Écran de démarrage au premier lancement (Phase 10) */}
      {showSplash && <SplashScreen onFinish={handleFinishSplash} />}

      {/* Navigation latérale 88px */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingValidationCount={pendingValidationCount}
      />

      {/* Zone de contenu principal */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'dashboard' && (
          <DashboardPage onNavigateTab={handleNavigateTab} />
        )}
        {activeTab === 'creation' && (
          <CreationPage
            tripId={tripId}
            onPendingCountChange={setPendingValidationCount}
            onNavigateTab={handleNavigateTab}
          />
        )}
        {activeTab === 'quick-capture' && (
          <QuickCapturePage
            tripId={tripId}
            onNavigateTab={handleNavigateTab}
          />
        )}
        {activeTab === 'atelier' && (
          <AtelierPage
            selectedDestinationId={selectedDestinationId}
            onNavigateTab={handleNavigateTab}
          />
        )}
        {activeTab === 'planning' && <PlanningPage tripId={tripId} />}
      </main>
    </div>
  );
}
