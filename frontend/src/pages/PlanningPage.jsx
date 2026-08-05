import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Layers,
  X
} from 'lucide-react';

import PlanningToolbar from '../components/planning/PlanningToolbar';
import PlanningGrid from '../components/planning/PlanningGrid';
import UnplacedActivitiesDrawer from '../components/planning/UnplacedActivitiesDrawer';
import SpecialBlockModal from '../components/planning/SpecialBlockModal';
import ActivityDetailDrawer from '../components/activities/ActivityDetailDrawer';
import ActivityFormModal from '../components/activities/ActivityFormModal';

export default function PlanningPage({ tripId = 1 }) {
  // États de données Planning
  const [planningData, setPlanningData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Préférences d'affichage (localStorage) — Règle 5.3
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('odos_planning_view_mode') || '3days';
  });
  const [currentStartDay, setCurrentStartDay] = useState(1);
  const [granularity, setGranularity] = useState(() => {
    return localStorage.getItem('odos_planning_granularity') || '1/4';
  });
  const [hourHeight, setHourHeight] = useState(() => {
    const saved = localStorage.getItem('odos_planning_zoom');
    return saved ? Number(saved) : 80;
  });

  // Tiroirs & Modales
  const [isUnplacedOpen, setIsUnplacedOpen] = useState(false);
  const [isSpecialModalOpen, setIsSpecialModalOpen] = useState(false);
  const [specialModalInitialData, setSpecialModalInitialData] = useState(null);
  const [specialModalDefaultDay, setSpecialModalDefaultDay] = useState(1);
  const [specialModalDefaultHour, setSpecialModalDefaultHour] = useState(540);
  const [detailActivityId, setDetailActivityId] = useState(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState(null);

  // Persistance des préférences d'affichage
  useEffect(() => {
    localStorage.setItem('odos_planning_view_mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('odos_planning_granularity', granularity);
  }, [granularity]);

  useEffect(() => {
    localStorage.setItem('odos_planning_zoom', String(hourHeight));
  }, [hourHeight]);

  // Chargement des données du planning
  const fetchPlanningData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/trips/${tripId}/planning`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Impossible de charger le planning.");
      }
      const data = await res.json();
      setPlanningData(data);
      setError(null);
    } catch (err) {
      console.error('Erreur chargement planning:', err);
      setError(err.message || "Impossible de charger le planning.");
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchPlanningData();
  }, [fetchPlanningData]);

  // Affichage d'un toast temporaire
  const showToast = (message, isError = false) => {
    setToastMessage({ text: message, isError });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Calcul des jours visibles selon la vue active (1 jour, 3 jours, ou 7 jours)
  const nbJours = planningData?.trip?.nb_jours || 7;
  const daysCount = viewMode === 'day' ? 1 : viewMode === '3days' ? 3 : 7;
  const visibleDays = Array.from(
    { length: Math.min(daysCount, nbJours - currentStartDay + 1) },
    (_, i) => currentStartDay + i
  );

  // Navigation temporelle
  const handleNavigate = (direction) => {
    const step = viewMode === 'day' ? 1 : viewMode === '3days' ? 3 : 7;
    const nextStart = currentStartDay + direction * step;
    if (nextStart >= 1 && nextStart <= nbJours) {
      setCurrentStartDay(nextStart);
    }
  };

  const handleResetToDayOne = () => {
    setCurrentStartDay(1);
  };

  // Placement rapide / Drop d'une activité non placée
  const handleQuickPlace = async (slotPayload) => {
    try {
      const res = await fetch(`/api/trips/${tripId}/slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slotPayload)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Impossible de positionner l'activité.");
      }
      showToast("Activité positionnée dans le planning avec succès !");
      await fetchPlanningData();
    } catch (err) {
      showToast(err.message, true);
    }
  };

  // Déplacement / modification horaire d'un créneau existant (Glisser-Déposer sur la grille)
  const handleMoveSlot = async (slotId, newJour, newStart, newEnd) => {
    try {
      const res = await fetch(`/api/slots/${slotId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jour: newJour,
          heure_debut: newStart,
          heure_fin: newEnd
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Impossible de déplacer ce créneau.");
      }
      showToast("Créneau déplacé avec succès !");
      await fetchPlanningData();
    } catch (err) {
      showToast(err.message, true);
    }
  };

  // Verrouillage / Déverrouillage d'un créneau (US-11)
  const handleToggleLock = async (slotId) => {
    try {
      const res = await fetch(`/api/slots/${slotId}/toggle-lock`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error("Erreur de modification du verrouillage");
      const data = await res.json();
      const isLocked = data.verrouille > 0;
      showToast(isLocked ? "Créneau verrouillé" : "Créneau déverrouillé");
      await fetchPlanningData();
    } catch (err) {
      showToast("Erreur lors de la modification du verrouillage.", true);
    }
  };

  // Retrait d'un créneau du planning
  const handleDeleteSlot = async (slotId) => {
    try {
      const res = await fetch(`/api/slots/${slotId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error("Erreur de suppression");
      showToast("Créneau retiré du planning.");
      await fetchPlanningData();
    } catch (err) {
      showToast("Erreur lors du retrait du créneau.", true);
    }
  };

  // Clic sur une case vide pour créer un bloc libre à cet endroit (US-16)
  const handleEmptySlotClick = (jour, heureMinutes) => {
    setSpecialModalInitialData(null);
    setSpecialModalDefaultDay(jour);
    setSpecialModalDefaultHour(heureMinutes);
    setIsSpecialModalOpen(true);
  };

  // Clic sur un créneau pour voir/éditer ses détails (Lecture riche par défaut)
  const handleOpenSlotDetail = (slot) => {
    if (slot.activity_id) {
      setDetailActivityId(slot.activity_id);
      setIsDetailDrawerOpen(true);
    } else if (slot.special_block_id) {
      setSpecialModalInitialData({
        id: slot.special_block_id,
        label: slot.titre,
        type: slot.type,
        categorie_id: slot.categorie_id,
        duree_minutes: slot.duree_minutes,
        cout: slot.cout_total,
        jour: slot.jour,
        heure_debut: slot.heure_debut
      });
      setIsSpecialModalOpen(true);
    }
  };

  // Soumission de création / modification de bloc libre
  const handleSpecialBlockSubmit = async (blockData) => {
    if (specialModalInitialData?.id) {
      const res = await fetch(`/api/special_blocks/${specialModalInitialData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(blockData)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Erreur de mise à jour");
      }
      showToast("Bloc libre mis à jour !");
    } else {
      const res = await fetch(`/api/trips/${tripId}/special_blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(blockData)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Erreur de création");
      }
      showToast("Bloc libre ajouté au planning !");
    }
    await fetchPlanningData();
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col p-3 md:p-5 gap-3 max-w-[1600px] mx-auto w-full">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold animate-fade-in ${
            toastMessage.isError
              ? 'bg-[#FAF0EE] text-[#C95D4E] border-[#E8C5BE]'
              : 'bg-[#17181A] text-white border-black'
          }`}
        >
          {toastMessage.isError ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-[#3F7A55] shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-current opacity-70 hover:opacity-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Barre d'outils supérieure */}
      <PlanningToolbar
        viewMode={viewMode}
        setViewMode={setViewMode}
        currentStartDay={currentStartDay}
        onNavigate={handleNavigate}
        onResetToDayOne={handleResetToDayOne}
        nbJours={nbJours}
        tripStartDate={planningData?.trip?.date_debut}
        granularity={granularity}
        setGranularity={setGranularity}
        hourHeight={hourHeight}
        setHourHeight={setHourHeight}
        budgetEngage={planningData?.trip?.budget_engage || 0}
        budgetTotal={planningData?.trip?.budget_total || 0}
        unplacedCount={planningData?.unplaced_activities?.length || 0}
        isUnplacedOpen={isUnplacedOpen}
        setIsUnplacedOpen={setIsUnplacedOpen}
        onOpenSpecialBlockModal={() => {
          setSpecialModalInitialData(null);
          setSpecialModalDefaultDay(currentStartDay);
          setSpecialModalDefaultHour(540);
          setIsSpecialModalOpen(true);
        }}
      />

      {/* Corps principal : Grille dynamique */}
      <div className="flex-1 flex overflow-hidden relative">
        {loading && !planningData ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-white border border-[#E6E4DF] rounded-2xl">
            <RefreshCw className="w-8 h-8 text-[#55565A] animate-spin mb-2" />
            <p className="text-sm font-bold text-[#55565A]">Chargement du planning...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-white border border-[#E6E4DF] rounded-2xl p-6 text-center">
            <AlertCircle className="w-10 h-10 text-[#C95D4E] mb-2" />
            <p className="text-sm font-bold text-[#17181A]">{error}</p>
            <button
              onClick={fetchPlanningData}
              className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-[#17181A] text-white hover:bg-[#3F7A55] transition-colors"
            >
              Réessayer
            </button>
          </div>
        ) : (
          <PlanningGrid
            visibleDays={visibleDays}
            slots={planningData?.slots || []}
            dailyBudgets={planningData?.daily_budgets || {}}
            tripStartDate={planningData?.trip?.date_debut}
            granularity={granularity}
            hourHeight={hourHeight}
            setHourHeight={setHourHeight}
            onToggleLock={handleToggleLock}
            onDeleteSlot={handleDeleteSlot}
            onOpenSlotDetail={handleOpenSlotDetail}
            onEmptySlotClick={handleEmptySlotClick}
            onDropActivity={handleQuickPlace}
            onMoveSlot={handleMoveSlot}
          />
        )}

        {/* Tiroir des fiches disponibles non encore placées */}
        <UnplacedActivitiesDrawer
          isOpen={isUnplacedOpen}
          onClose={() => setIsUnplacedOpen(false)}
          unplacedActivities={planningData?.unplaced_activities || []}
          destinations={planningData?.destinations || []}
          categories={planningData?.categories || []}
          currentVisibleDays={visibleDays}
          onQuickPlace={handleQuickPlace}
          onOpenActivityModal={(id) => {
            setDetailActivityId(id);
            setIsDetailDrawerOpen(true);
          }}
        />
      </div>

      {/* Modale d'ajout / modification de bloc libre */}
      <SpecialBlockModal
        isOpen={isSpecialModalOpen}
        onClose={() => setIsSpecialModalOpen(false)}
        onSubmit={handleSpecialBlockSubmit}
        categories={planningData?.categories || []}
        nbJours={nbJours}
        initialData={specialModalInitialData}
        defaultJour={specialModalDefaultDay}
        defaultHour={specialModalDefaultHour}
      />

      {/* Panneau latéral de consultation détaillée (Photos, Dates, Commentaires, etc.) */}
      <ActivityDetailDrawer
        isOpen={isDetailDrawerOpen}
        onClose={() => setIsDetailDrawerOpen(false)}
        activityId={detailActivityId}
        onEdit={() => {
          setIsDetailDrawerOpen(false);
          setSelectedActivityId(detailActivityId);
        }}
        onDelete={async (actId) => {
          setIsDetailDrawerOpen(false);
          await fetchPlanningData();
        }}
        nbPersonnes={planningData?.trip?.nb_personnes || 4}
      />

      {/* Modale complète de modification de fiche d'activité (Bouton "✏️ Modifier cette fiche") */}
      {selectedActivityId && (
        <ActivityFormModal
          isOpen={!!selectedActivityId}
          onClose={() => setSelectedActivityId(null)}
          tripId={tripId}
          activityToEdit={{ id: selectedActivityId }}
          destinations={planningData?.destinations || []}
          categories={planningData?.categories || []}
          nbPersonnes={planningData?.trip?.nb_personnes || 4}
          onSaved={() => {
            setSelectedActivityId(null);
            fetchPlanningData();
          }}
        />
      )}
    </div>
  );
}
