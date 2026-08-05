import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  Clock,
  Euro,
  Lock,
  Trash2,
  Plus,
  Maximize2,
  AlertCircle,
  CheckCircle2,
  LayoutGrid,
  Columns
} from 'lucide-react';

const START_MINUTES = 420; // 07:00
const END_MINUTES = 1380;  // 23:00
const TOTAL_HOURS = (END_MINUTES - START_MINUTES) / 60; // 16h
const COMPACT_HOUR_HEIGHT = 46; // Hauteur compacte pour le volet latéral

/**
 * Volet latéral Planning Express pour l'Atelier.
 * Conforme à US-14 (PRD_ecran2_atelier.md).
 * Permet le glisser-déposer immédiat d'activités sur les créneaux horaires,
 * avec bascule vue 1 jour / vue 3 jours.
 */
export default function PlanningSidebarDrawer({
  isOpen,
  onToggleOpen,
  tripId = 1,
  activeActivity = null,
  onSlotCreated,
  onOpenFullScreenPlanning
}) {
  const [planningData, setPlanningData] = useState(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [viewMode, setViewMode] = useState('1day'); // '1day' ou '3days'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [dragOverTarget, setDragOverTarget] = useState(null); // { day, hourMinutes }

  const fetchPlanning = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/trips/${tripId}/planning`);
      if (res.ok) {
        const data = await res.json();
        setPlanningData(data);
        setError(null);
      }
    } catch (err) {
      console.error('Erreur chargement mini-planning:', err);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    if (isOpen) {
      fetchPlanning();
    }
  }, [isOpen, fetchPlanning]);

  const showToast = (text, isError = false) => {
    setToast({ text, isError });
    setTimeout(() => setToast(null), 3500);
  };

  const nbJours = planningData?.trip?.nb_jours || 7;

  // Calcul de la date réelle d'un jour donné
  const getDayFormattedDate = (dayNumber) => {
    if (!planningData?.trip?.date_debut) return null;
    try {
      const d = new Date(planningData.trip.date_debut);
      d.setDate(d.getDate() + (dayNumber - 1));
      return d.toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      });
    } catch {
      return null;
    }
  };

  // Liste des jours visibles selon le mode (1 jour ou 3 jours)
  const visibleDays = viewMode === '1day'
    ? [selectedDay]
    : [selectedDay, selectedDay + 1, selectedDay + 2].filter((d) => d <= nbJours);

  // Placement d'une activité sur un créneau précis
  const placeActivityOnSlot = async (activityObj, targetDay, startHourMinutes) => {
    if (!activityObj) {
      showToast("Glissez ou sélectionnez d'abord une fiche d'activité.", true);
      return;
    }

    const actId = activityObj.activity_id || activityObj.id;
    const duration = activityObj.duree_min || 60;
    const roundedDuration = Math.ceil(duration / 15) * 15;

    try {
      const res = await fetch(`/api/trips/${tripId}/slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_id: actId,
          jour: targetDay,
          heure_debut: startHourMinutes,
          heure_fin: startHourMinutes + roundedDuration
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Impossible de placer l'activité (créneau occupé ou verrouillé).");
      }

      showToast(`« ${activityObj.titre || 'Activité'} » positionnée sur Jour ${targetDay} à ${minsToTimeString(startHourMinutes)} !`);
      await fetchPlanning();
      if (onSlotCreated) onSlotCreated();
    } catch (err) {
      showToast(err.message, true);
    }
  };

  // Gestion du drop HTML5 sur une case horaire
  const handleDropOnHour = async (e, targetDay, hourMinutes) => {
    e.preventDefault();
    setDragOverTarget(null);
    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      let act = activeActivity;
      if (dataStr) {
        try {
          const parsed = JSON.parse(dataStr);
          if (parsed && (parsed.activity_id || parsed.id)) {
            act = parsed;
          }
        } catch {}
      }
      await placeActivityOnSlot(act, targetDay, hourMinutes);
    } catch (err) {
      showToast(err.message, true);
    }
  };

  // Suppression d'un créneau
  const handleDeleteSlot = async (slotId) => {
    try {
      const res = await fetch(`/api/slots/${slotId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error("Erreur lors du retrait du créneau.");
      showToast("Activité retirée du planning.");
      await fetchPlanning();
      if (onSlotCreated) onSlotCreated();
    } catch (err) {
      showToast(err.message, true);
    }
  };

  const minsToTimeString = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  return (
    <>
      {/* Languette fixe sur le bord droit de l'Atelier (US-14) */}
      {!isOpen && (
        <button
          onClick={onToggleOpen}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-[#17181A] text-white px-3 py-4 rounded-l-2xl shadow-2xl flex flex-col items-center gap-2 border-y border-l border-[#55565A] hover:bg-[#3F7A55] transition-all group animate-fade-in"
          title="Ouvrir le volet express Planning"
        >
          <Calendar className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
          <span
            className="text-[11px] font-extrabold uppercase tracking-widest text-white"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            Planning
          </span>
        </button>
      )}

      {/* Volet Latéral Rétractable (z-50 pour être toujours au premier plan) */}
      {isOpen && (
        <div className={`fixed inset-y-0 right-0 z-50 bg-white border-l border-[#E6E4DF] shadow-2xl flex flex-col animate-slide-in transition-all duration-300 ${
          viewMode === '3days' ? 'w-full max-w-2xl md:max-w-3xl' : 'w-full max-w-md'
        }`}>
          {/* Header */}
          <div className="p-3.5 border-b border-[#E6E4DF] bg-[#F7F6F3] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#17181A] text-[#D6F84C] flex items-center justify-center font-bold">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#17181A]">Planning express</h3>
                <p className="text-[11px] text-[#55565A]">Glissez ou cliquez directement pour planifier</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Bascule vue 1 jour / 3 jours */}
              <div className="flex items-center bg-[#E6E4DF]/70 p-0.5 rounded-xl">
                <button
                  type="button"
                  onClick={() => setViewMode('1day')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    viewMode === '1day'
                      ? 'bg-white text-[#17181A] shadow-xs'
                      : 'text-[#55565A] hover:text-[#17181A]'
                  }`}
                  title="Vue 1 jour détaillé"
                >
                  1 jour
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('3days')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    viewMode === '3days'
                      ? 'bg-white text-[#17181A] shadow-xs'
                      : 'text-[#55565A] hover:text-[#17181A]'
                  }`}
                  title="Vue 3 jours simultanés"
                >
                  3 jours
                </button>
              </div>

              {onOpenFullScreenPlanning && (
                <button
                  type="button"
                  onClick={onOpenFullScreenPlanning}
                  title="Ouvrir le grand écran Planning"
                  className="p-1.5 rounded-lg text-[#55565A] hover:text-[#17181A] hover:bg-[#E6E4DF] transition-colors"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onToggleOpen}
                className="p-1.5 rounded-lg text-[#55565A] hover:text-[#17181A] hover:bg-[#E6E4DF] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Toast de notification / feedback */}
          {toast && (
            <div
              className={`p-2.5 text-xs font-bold flex items-center gap-2 border-b animate-fade-in ${
                toast.isError
                  ? 'bg-[#FAF0EE] text-[#C95D4E] border-[#E8C5BE]'
                  : 'bg-[#17181A] text-[#D6F84C] border-black'
              }`}
            >
              {toast.isError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-[#D6F84C] shrink-0" />}
              <span>{toast.text}</span>
            </div>
          )}

          {/* Sélecteur de jour & Date réelle & Budget */}
          <div className="p-3 bg-[#FAF9F7] border-b border-[#E6E4DF] flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedDay((d) => Math.max(d - (viewMode === '3days' ? 3 : 1), 1))}
                disabled={selectedDay <= 1}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#E6E4DF] bg-white text-[#17181A] disabled:opacity-30 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-1.5 px-3 py-1 bg-white rounded-lg border border-[#E6E4DF] shadow-2xs">
                <span className="text-xs font-extrabold text-[#17181A]">
                  {viewMode === '3days'
                    ? `Jours ${visibleDays.join(', ')} / ${nbJours}`
                    : `Jour ${selectedDay} / ${nbJours}`}
                </span>
                {getDayFormattedDate(selectedDay) && (
                  <span className="text-[11px] font-semibold text-[#55565A] border-l border-[#E6E4DF] pl-2 capitalize">
                    {getDayFormattedDate(selectedDay)}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedDay((d) => Math.min(d + (viewMode === '3days' ? 3 : 1), nbJours))}
                disabled={selectedDay >= nbJours || (viewMode === '3days' && selectedDay + 2 >= nbJours)}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#E6E4DF] bg-white text-[#17181A] disabled:opacity-30 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {viewMode === '1day' && (
              <div className="flex items-center gap-1 text-xs font-bold text-[#17181A] bg-white px-2.5 py-1 rounded-lg border border-[#E6E4DF]">
                <Euro className="w-3 h-3 text-[#B9862F]" />
                <span>{Math.round(planningData?.daily_budgets?.[selectedDay] || 0)} €</span>
              </div>
            )}
          </div>

          {/* Activité active sélectionnée ou indication */}
          {activeActivity ? (
            <div className="p-2.5 bg-[#FAF3E7] border-b border-[#E8D4B0] flex items-center justify-between gap-2 animate-fade-in">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#B9862F] block">
                  Activité sélectionnée
                </span>
                <p className="text-xs font-extrabold text-[#17181A] truncate">
                  {activeActivity.titre}
                </p>
                <span className="text-[10px] text-[#55565A]">
                  Durée : {activeActivity.duree_min || 60} min
                </span>
              </div>
              <span className="text-[10px] font-bold text-[#B9862F] bg-white px-2 py-1 rounded-md border border-[#E8D4B0] shrink-0 shadow-xs">
                Cliquez sur une case ou glissez
              </span>
            </div>
          ) : (
            <div className="p-2 bg-[#FAF9F7] border-b border-[#E6E4DF] text-center text-[11px] text-[#8E8F92]">
              💡 Glissez une carte d'activité ou cliquez sur une heure
            </div>
          )}

          {/* En-tête des colonnes de jours en mode 3 jours */}
          {viewMode === '3days' && (
            <div className="flex border-b border-[#E6E4DF] bg-[#FAF9F7] pl-14">
              {visibleDays.map((d) => (
                <div key={d} className="flex-1 py-1.5 px-2 text-center border-r border-[#E6E4DF] last:border-r-0">
                  <span className="text-xs font-extrabold text-[#17181A] block">
                    Jour {d}
                  </span>
                  <span className="text-[10px] font-semibold text-[#55565A] capitalize block truncate">
                    {getDayFormattedDate(d) || `Journée ${d}`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Grille horaire défilable avec récepteurs de drop */}
          <div className="flex-1 overflow-y-auto relative flex select-none bg-white">
            {/* Colonne fixe des heures */}
            <div
              className="w-14 shrink-0 border-r border-[#E6E4DF] bg-[#FAF9F7] relative"
              style={{ height: `${TOTAL_HOURS * COMPACT_HOUR_HEIGHT}px` }}
            >
              {Array.from({ length: TOTAL_HOURS + 1 }).map((_, idx) => (
                <div
                  key={idx}
                  className="absolute left-0 right-0 border-t border-[#E6E4DF] text-[9px] font-bold text-[#8E8F92] pr-1.5 text-right -translate-y-2"
                  style={{ top: `${idx * COMPACT_HOUR_HEIGHT}px` }}
                >
                  {minsToTimeString(START_MINUTES + idx * 60)}
                </div>
              ))}
            </div>

            {/* Colonnes des jours visibles */}
            <div className="flex-1 flex relative" style={{ height: `${TOTAL_HOURS * COMPACT_HOUR_HEIGHT}px` }}>
              {visibleDays.map((dayNum) => {
                const daySlots = (planningData?.slots || []).filter((s) => s.jour === dayNum);

                return (
                  <div
                    key={dayNum}
                    className="flex-1 relative border-r border-[#E6E4DF] last:border-r-0"
                  >
                    {/* Cases horaires interactives */}
                    {Array.from({ length: TOTAL_HOURS }).map((_, hIdx) => {
                      const hourMinutes = START_MINUTES + hIdx * 60;
                      const isDragOver =
                        dragOverTarget?.day === dayNum && dragOverTarget?.hourMinutes === hourMinutes;

                      return (
                        <div
                          key={hIdx}
                          data-slot-droptarget="true"
                          data-day={dayNum}
                          data-hour={hourMinutes}
                          onClick={() => placeActivityOnSlot(activeActivity, dayNum, hourMinutes)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'copy';
                            if (dragOverTarget?.day !== dayNum || dragOverTarget?.hourMinutes !== hourMinutes) {
                              setDragOverTarget({ day: dayNum, hourMinutes });
                            }
                          }}
                          onDragLeave={() => {
                            if (dragOverTarget?.day === dayNum && dragOverTarget?.hourMinutes === hourMinutes) {
                              setDragOverTarget(null);
                            }
                          }}
                          onDrop={(e) => handleDropOnHour(e, dayNum, hourMinutes)}
                          className={`absolute left-0 right-0 border-t border-[#E6E4DF] transition-all cursor-pointer group flex items-center justify-end pr-2 ${
                            isDragOver
                              ? 'bg-[#3F7A55]/20 ring-2 ring-inset ring-[#3F7A55]'
                              : 'hover:bg-[#FAF9F7]'
                          }`}
                          style={{
                            top: `${hIdx * COMPACT_HOUR_HEIGHT}px`,
                            height: `${COMPACT_HOUR_HEIGHT}px`
                          }}
                        >
                          {isDragOver ? (
                            <span className="text-[10px] font-extrabold text-[#3F7A55] flex items-center gap-1 animate-pulse">
                              <Plus className="w-3.5 h-3.5" /> J{dayNum} {minsToTimeString(hourMinutes)}
                            </span>
                          ) : activeActivity ? (
                            <span className="text-[10px] font-bold text-[#B9862F] opacity-0 group-hover:opacity-100 flex items-center gap-1">
                              <Plus className="w-3 h-3" /> Placer {minsToTimeString(hourMinutes)}
                            </span>
                          ) : null}
                        </div>
                      );
                    })}

                    {/* Créneaux planifiés de ce jour */}
                    {daySlots.map((slot) => {
                      const top = ((slot.heure_debut - START_MINUTES) / 60) * COMPACT_HOUR_HEIGHT;
                      const height = ((slot.heure_fin - slot.heure_debut) / 60) * COMPACT_HOUR_HEIGHT;
                      const categoryColor = slot.categorie_couleur || '#3F7A55';

                      return (
                        <div
                          key={slot.id}
                          className="absolute inset-x-1 rounded-lg p-1.5 shadow-xs border flex items-center justify-between overflow-hidden group hover:z-10 animate-fade-in"
                          style={{
                            top: `${top}px`,
                            height: `${Math.max(height, 24)}px`,
                            backgroundColor: `${categoryColor}20`,
                            borderColor: categoryColor,
                            borderLeftWidth: '4px'
                          }}
                        >
                          <div className="min-w-0 flex-1 pr-1">
                            <p className="text-[10px] font-extrabold text-[#17181A] truncate">
                              {slot.titre}
                            </p>
                            <span className="text-[9px] text-[#55565A] block font-semibold">
                              {slot.heure_debut_str} - {slot.heure_fin_str}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSlot(slot.id);
                            }}
                            title="Retirer du planning"
                            className="p-1 rounded bg-white/90 text-[#55565A] hover:text-[#C95D4E] opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
