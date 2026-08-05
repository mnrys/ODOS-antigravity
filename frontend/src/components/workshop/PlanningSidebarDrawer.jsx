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
  refreshKey = 0,
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
  }, [isOpen, refreshKey, fetchPlanning]);

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

  // Déplacement d'un créneau existant dans le mini-planning
  const handleMoveSlot = async (slotId, targetDay, startHour, endHour) => {
    try {
      const res = await fetch(`/api/slots/${slotId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jour: targetDay,
          heure_debut: startHour,
          heure_fin: endHour
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Impossible de déplacer cette activité (créneau occupé ou verrouillé).");
      }

      showToast("Activité déplacée avec succès !");
      await fetchPlanning();
      if (onSlotCreated) onSlotCreated();
    } catch (err) {
      showToast(err.message, true);
    }
  };

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

  // Gestion du drop HTML5 sur une case horaire ou colonne
  const handleDropOnHour = async (e, targetDay, hourMinutes) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);
    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (dataStr) {
        try {
          const parsed = JSON.parse(dataStr);
          if (parsed?.type === 'slot_move') {
            const duration = (parsed.heure_fin - parsed.heure_debut) || 60;
            await handleMoveSlot(parsed.slot_id, targetDay, hourMinutes, hourMinutes + duration);
            return;
          } else if (parsed && (parsed.activity_id || parsed.id)) {
            await placeActivityOnSlot(parsed, targetDay, hourMinutes);
            return;
          }
        } catch {}
      }
      if (activeActivity) {
        await placeActivityOnSlot(activeActivity, targetDay, hourMinutes);
      }
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
          title="Ouvrir le Planning Express"
        >
          <Calendar className="w-5 h-5 text-[#D6F84C] group-hover:scale-110 transition-transform" />
          <span className="text-[11px] font-bold tracking-wider [writing-mode:vertical-lr] rotate-180 text-[#FAF9F7]">
            Planning
          </span>
        </button>
      )}

      {/* Panneau latéral rétractable */}
      {isOpen && (
        <div className="fixed right-0 top-0 bottom-0 w-[380px] md:w-[480px] z-40 bg-[#FAF9F7] shadow-2xl border-l border-[#E6E4DF] flex flex-col animate-slide-in-right">
          {/* En-tête du volet */}
          <div className="p-3.5 bg-white border-b border-[#E6E4DF] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-[#3F7A55]/10 rounded-xl text-[#3F7A55]">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#17181A]">Planning Express</h3>
                <p className="text-[11px] text-[#55565A]">
                  Glissez une fiche ou déplacez un créneau
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Bascule Vue 1 Jour / 3 Jours */}
              <div className="bg-[#F1F0ED] p-0.5 rounded-lg flex items-center border border-[#E6E4DF]">
                <button
                  type="button"
                  onClick={() => setViewMode('1day')}
                  className={`px-2 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                    viewMode === '1day'
                      ? 'bg-white text-[#17181A] shadow-xs'
                      : 'text-[#55565A] hover:text-[#17181A]'
                  }`}
                  title="Vue 1 Jour"
                >
                  <Columns className="w-3.5 h-3.5" /> 1j
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('3days')}
                  className={`px-2 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                    viewMode === '3days'
                      ? 'bg-white text-[#17181A] shadow-xs'
                      : 'text-[#55565A] hover:text-[#17181A]'
                  }`}
                  title="Vue 3 Jours"
                >
                  <LayoutGrid className="w-3.5 h-3.5" /> 3j
                </button>
              </div>

              {/* Bouton Grand écran */}
              <button
                type="button"
                onClick={onOpenFullScreenPlanning}
                className="p-1.5 text-[#55565A] hover:text-[#17181A] hover:bg-[#F1F0ED] rounded-lg transition-all"
                title="Ouvrir le Planning complet"
              >
                <Maximize2 className="w-4 h-4" />
              </button>

              {/* Bouton Fermer */}
              <button
                type="button"
                onClick={onToggleOpen}
                className="p-1.5 text-[#55565A] hover:text-[#17181A] hover:bg-[#F1F0ED] rounded-lg transition-all"
                title="Fermer le volet"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Toast de notification dans le volet */}
          {toast && (
            <div
              className={`mx-3 mt-2 p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 border animate-fade-in shrink-0 ${
                toast.isError
                  ? 'bg-[#C95D4E]/10 border-[#C95D4E]/30 text-[#C95D4E]'
                  : 'bg-[#3F7A55]/10 border-[#3F7A55]/30 text-[#3F7A55]'
              }`}
            >
              {toast.isError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
              <span className="flex-1">{toast.text}</span>
            </div>
          )}

          {/* Sélecteur de jour rapide */}
          <div className="px-3 py-2 bg-white border-b border-[#E6E4DF] flex items-center justify-between shrink-0">
            <button
              type="button"
              disabled={selectedDay <= 1}
              onClick={() => setSelectedDay((d) => Math.max(1, d - 1))}
              className="p-1 rounded-lg text-[#55565A] hover:bg-[#F1F0ED] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1 overflow-x-auto py-0.5 no-scrollbar max-w-[300px]">
              {Array.from({ length: nbJours }, (_, i) => i + 1).map((dayNum) => (
                <button
                  key={dayNum}
                  type="button"
                  onClick={() => setSelectedDay(dayNum)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 ${
                    visibleDays.includes(dayNum)
                      ? 'bg-[#3F7A55] text-white shadow-xs'
                      : 'bg-[#F1F0ED] text-[#55565A] hover:bg-[#E6E4DF]'
                  }`}
                >
                  J{dayNum}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={selectedDay >= nbJours}
              onClick={() => setSelectedDay((d) => Math.min(nbJours, d + 1))}
              className="p-1 rounded-lg text-[#55565A] hover:bg-[#F1F0ED] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* En-tête des colonnes de jours en mode 3 jours */}
          {viewMode === '3days' && (
            <div className="flex border-b border-[#E6E4DF] bg-[#FAF9F7] pl-14">
              {visibleDays.map((d) => (
                <div key={d} className="flex-1 py-1.5 px-2 text-center border-r border-[#E6E4DF] last:border-r-0">
                  <span className="text-xs font-extrabold text-[#17181A] block">
                    Jour {d}
                  </span>
                  <span className="text-[10px] font-semibold text-[#55565A] capitalize block truncate">
                    {getDayFormattedDate(d) || `J${d}`}
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
                    data-planning-sidebar-day={dayNum}
                    className="flex-1 relative border-r border-[#E6E4DF] last:border-r-0"
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const clickY = e.clientY - rect.top;
                      const hourIdx = Math.floor(clickY / COMPACT_HOUR_HEIGHT);
                      const calcHour = Math.min(Math.max(START_MINUTES + hourIdx * 60, START_MINUTES), END_MINUTES - 15);
                      handleDropOnHour(e, dayNum, calcHour);
                    }}
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
                          onClick={(e) => {
                            e.stopPropagation();
                            if (activeActivity) {
                              placeActivityOnSlot(activeActivity, dayNum, hourMinutes);
                            }
                          }}
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

                    {/* Créneaux planifiés de ce jour (Draggable) */}
                    {daySlots.map((slot) => {
                      const top = ((slot.heure_debut - START_MINUTES) / 60) * COMPACT_HOUR_HEIGHT;
                      const height = ((slot.heure_fin - slot.heure_debut) / 60) * COMPACT_HOUR_HEIGHT;
                      const categoryColor = slot.categorie_couleur || '#3F7A55';

                      return (
                        <div
                          key={slot.id}
                          draggable={!slot.verrouille}
                          onDragStart={(e) => {
                            e.stopPropagation();
                            e.dataTransfer.setData('text/plain', JSON.stringify({
                              type: 'slot_move',
                              slot_id: slot.id,
                              heure_debut: slot.heure_debut,
                              heure_fin: slot.heure_fin,
                              jour: slot.jour
                            }));
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          className={`absolute inset-x-1 rounded-lg p-1.5 shadow-xs border flex items-center justify-between overflow-hidden group hover:z-20 transition-all ${
                            slot.verrouille ? 'cursor-not-allowed opacity-90' : 'cursor-grab active:cursor-grabbing hover:shadow-md'
                          }`}
                          style={{
                            top: `${top}px`,
                            height: `${Math.max(height, 24)}px`,
                            backgroundColor: `${categoryColor}25`,
                            borderColor: categoryColor,
                            borderLeftWidth: '4px'
                          }}
                        >
                          <div className="min-w-0 flex-1 pr-1 pointer-events-none">
                            <p className="text-[10px] font-extrabold text-[#17181A] truncate flex items-center gap-1">
                              {slot.verrouille && <Lock className="w-2.5 h-2.5 text-[#B9862F] shrink-0" />}
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
                            className="p-1 rounded bg-white/90 text-[#55565A] hover:text-[#C95D4E] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
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
