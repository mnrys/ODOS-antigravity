import React, { useEffect, useState } from 'react';
import { fetchTripDashboard } from '../api/client';
import CountdownWidget from '../components/dashboard/CountdownWidget';
import BudgetWidget from '../components/dashboard/BudgetWidget';
import DestinationCard from '../components/dashboard/DestinationCard';
import ValidationAlertBadge from '../components/dashboard/ValidationAlertBadge';
import TripDateModal from '../components/dashboard/TripDateModal';
import { CalendarCheck, Compass, AlertCircle, RefreshCw, Calendar, ArrowRight } from 'lucide-react';

/**
 * Page principale de l'Écran 0 (Dashboard).
 * Conforme à PRD_ecran0_dashboard.md, US-1 à US-10.
 * Conçu pour tenir harmonieusement sur un seul écran sans défilement inutile.
 */
export default function DashboardPage({ onNavigateTab }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);


  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTripDashboard(1); // Voyage #1 (Canaries)
      setData(res);
    } catch (err) {
      console.error(err);
      setError("Impossible de charger les données du voyage.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw className="w-8 h-8 text-[#17181A] animate-spin stroke-[2]" />
        <p className="text-sm font-semibold text-[#55565A]">Chargement de votre tableau de bord...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6">
        <div className="w-12 h-12 rounded-2xl bg-[#FAF0EE] text-[#C95D4E] flex items-center justify-center">
          <AlertCircle className="w-6 h-6 stroke-[2]" />
        </div>
        <p className="text-sm font-semibold text-[#17181A] text-center">{error || "Erreur inconnue"}</p>
        <button
          onClick={loadDashboard}
          className="bg-[#17181A] text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-[#3F7A55] transition-colors"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1550px] mx-auto px-4 md:px-6 py-4 md:py-5 flex flex-col gap-4">
      {/* 1. Bannière d'Alerte (Pile "À valider" — US-9) */}
      {data.nb_fiches_a_valider > 0 && (
        <ValidationAlertBadge
          count={data.nb_fiches_a_valider}
          onNavigateToCreation={() => onNavigateTab('creation')}
        />
      )}

      {/* 2. En-tête Voyage et Compte à Rebours (US-2) */}
      <CountdownWidget trip={data} onEditTrip={() => setIsDateModalOpen(true)} />

      {/* Modale de modification des dates du séjour */}
      <TripDateModal
        isOpen={isDateModalOpen}
        onClose={() => setIsDateModalOpen(false)}
        trip={data}
        onUpdated={loadDashboard}
      />

      {/* 3. Section Principale : Grille 2 Colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Colonne Gauche (7 col) : Destinations & Progression Planning */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-4">
          {/* Cartes Destinations (US-6, US-7) */}
          <div className="bg-white border border-[#E6E4DF] rounded-3xl p-5 shadow-xs flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-base font-extrabold text-[#17181A] tracking-tight">
                  Destinations du voyage
                </h2>
                <p className="text-[11px] text-[#55565A]">
                  Accès direct à l'atelier de chaque étape
                </p>
              </div>
              <span className="text-xs font-extrabold text-[#55565A] bg-[#EDEBE6] px-2.5 py-0.5 rounded-full">
                {data.destinations?.length || 0} étapes
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {data.destinations?.map((dest) => (
                <DestinationCard
                  key={dest.id}
                  destination={dest}
                  onOpenAtelier={(destId) => {
                    onNavigateTab('atelier', destId);
                  }}
                />
              ))}
            </div>
          </div>

          {/* Statistique de progression globale du Planning (US-8) */}
          <div className="bg-white border border-[#E6E4DF] rounded-3xl p-4 md:p-5 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-[#EDEBE6] text-[#3F7A55] flex items-center justify-center shrink-0">
                <CalendarCheck className="w-5 h-5 stroke-[2.25]" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-[#17181A]">
                  Progression du planning
                </h4>
                <p className="text-xs text-[#55565A]">
                  <strong className="text-[#3F7A55]">{data.nb_activites_placées}</strong> sur {data.nb_activites_total} activités placées dans l'agenda
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab('planning')}
              className="inline-flex items-center gap-1.5 bg-[#17181A] hover:bg-[#3F7A55] text-white text-xs font-extrabold px-3.5 py-2 rounded-xl transition-all shrink-0"
            >
              <span>Voir le planning</span>
              <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Colonne Droite (5 col) : Widget Budget Global (US-3, US-4, US-5) */}
        <div className="lg:col-span-5 flex flex-col">
          <BudgetWidget
            budget={data.budget}
            tripId={data.trip_id}
            onBudgetUpdated={loadDashboard}
          />
        </div>
      </div>
    </div>
  );
}
