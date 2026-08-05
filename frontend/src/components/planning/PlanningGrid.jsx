import React, { useState, useRef, useEffect } from 'react';
import {
  Lock,
  Unlock,
  Trash2,
  MapPin,
  ExternalLink,
  Star,
  Clock,
  Euro,
  Info,
  Plus,
  GripVertical
} from 'lucide-react';
import { getPhotoUrl } from '../../utils/imageUtils';

const START_MINUTES = 420;  // 07:00
const END_MINUTES = 1380;   // 23:00
const TOTAL_HOURS = (END_MINUTES - START_MINUTES) / 60; // 16 heures

/**
 * Grille temporelle dynamique du Planning (Écran 3).
 * Intègre le glisser-déposer (HTML5 Drag & Drop), le zoom continu,
 * le survol riche de fiche, et le verrouillage de créneaux.
 * cf. PRD_ecran3_planning.md (US-10, US-11, US-12, US-13, US-14, US-15, US-16, US-19, US-20).
 */
export default function PlanningGrid({
  visibleDays = [1],
  slots = [],
  dailyBudgets = {},
  tripStartDate = null,
  granularity = '1/4',
  hourHeight = 80,
  setHourHeight,
  onToggleLock,
  onDeleteSlot,
  onOpenSlotDetail,
  onEmptySlotClick,
  onDropActivity,
  onMoveSlot
}) {
  const [hoveredSlot, setHoveredSlot] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [dragOverDay, setDragOverDay] = useState(null);
  const gridContainerRef = useRef(null);

  // Zoom via Ctrl + Molette sur la grille (US-13)
  useEffect(() => {
    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 5 : -5;
        if (setHourHeight) {
          setHourHeight((prev) => Math.min(Math.max(prev + delta, 50), 140));
        }
      }
    };

    const el = gridContainerRef.current;
    if (el) {
      el.addEventListener('wheel', handleWheel, { passive: false });
      return () => el.removeEventListener('wheel', handleWheel);
    }
  }, [setHourHeight]);

  // Formattage de date pour l'en-tête du jour (ex: "Samedi 10 Octobre")
  const formatDayDate = (dayNumber) => {
    if (!tripStartDate) return null;
    const d = new Date(tripStartDate);
    d.setDate(d.getDate() + (dayNumber - 1));
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  // Convertit des minutes en chaîne HH:MM
  const minsToTimeString = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // Clic sur une case vide pour créer rapidement un créneau (US-16)
  const handleGridCellClick = (e, jour) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const minutesFromStart = (clickY / hourHeight) * 60;

    // Aimantation selon la granularité (15 ou 30 min)
    const snapMinutes = granularity === '1/2' ? 30 : 15;
    const snappedMinutes = Math.floor(minutesFromStart / snapMinutes) * snapMinutes;
    const calculatedHour = START_MINUTES + snappedMinutes;

    if (calculatedHour < END_MINUTES && onEmptySlotClick) {
      onEmptySlotClick(jour, calculatedHour);
    }
  };

  // Gestion du Drop sur une colonne de jour
  const handleColumnDrop = (e, jour) => {
    e.preventDefault();
    setDragOverDay(null);

    const rawData = e.dataTransfer.getData('text/plain');
    if (!rawData) return;

    try {
      const payload = JSON.parse(rawData);
      const rect = e.currentTarget.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      const minutesFromStart = (clickY / hourHeight) * 60;

      // Aimantation selon granularité
      const snapMinutes = granularity === '1/2' ? 30 : 15;
      const snappedMinutes = Math.floor(minutesFromStart / snapMinutes) * snapMinutes;
      const calculatedStart = Math.min(Math.max(START_MINUTES + snappedMinutes, START_MINUTES), END_MINUTES - 15);

      if (payload.type === 'slot_move') {
        // Déplacement d'un créneau existant
        const duration = payload.heure_fin - payload.heure_debut;
        const calculatedEnd = Math.min(calculatedStart + duration, END_MINUTES);
        if (onMoveSlot) {
          onMoveSlot(payload.slot_id, jour, calculatedStart, calculatedEnd);
        }
      } else if (payload.type === 'activity' || payload.activity_id || payload.id) {
        // Positionnement d'une fiche non placée
        const actId = payload.activity_id || payload.id;
        const duration = payload.duree_min || 60;
        const roundedDuration = Math.ceil(duration / 15) * 15;
        const calculatedEnd = Math.min(calculatedStart + roundedDuration, END_MINUTES);
        if (onDropActivity) {
          onDropActivity({
            activity_id: actId,
            jour,
            heure_debut: calculatedStart,
            heure_fin: calculatedEnd
          });
        }
      }
    } catch (err) {
      console.error('Erreur traitement drop:', err);
    }
  };

  const handleMouseEnterSlot = (e, slot) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverPos({
      x: rect.right + 10,
      y: rect.top
    });
    setHoveredSlot(slot);
  };

  const handleMouseLeaveSlot = () => {
    setHoveredSlot(null);
  };

  // Heures générées pour la colonne de gauche (07:00 à 23:00)
  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => START_MINUTES + i * 60);

  return (
    <div
      ref={gridContainerRef}
      className="bg-white border border-[#E6E4DF] rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1 relative select-none"
    >
      {/* En-tête des colonnes (Jours) */}
      <div className="flex border-b border-[#E6E4DF] bg-[#F7F6F3] sticky top-0 z-20">
        {/* Coin échelle horaire */}
        <div className="w-16 md:w-20 shrink-0 border-r border-[#E6E4DF] p-3 text-center text-[10px] font-extrabold uppercase tracking-wider text-[#8E8F92] flex items-center justify-center">
          Heure
        </div>

        {/* Colonnes des jours visibles */}
        <div
          className="flex-1 grid"
          style={{ gridTemplateColumns: `repeat(${visibleDays.length}, minmax(0, 1fr))` }}
        >
          {visibleDays.map((jour) => {
            const dateStr = formatDayDate(jour);
            const budgetDay = dailyBudgets[jour] || 0;

            return (
              <div
                key={jour}
                className="p-3 border-r border-[#E6E4DF] last:border-r-0 flex items-center justify-between gap-2"
              >
                <div>
                  {dateStr ? (
                    <>
                      <h4 className="text-xs md:text-sm font-extrabold text-[#17181A] capitalize leading-tight">
                        {dateStr}
                      </h4>
                      <p className="text-[10px] font-bold text-[#8E8F92] uppercase tracking-wider mt-0.5">
                        Jour {jour}
                      </p>
                    </>
                  ) : (
                    <span className="text-xs md:text-sm font-extrabold text-[#17181A]">
                      Jour {jour}
                    </span>
                  )}
                </div>

                {/* Badge Budget du Jour (US-12) */}
                <div
                  className="px-2.5 py-1 rounded-full text-xs font-bold bg-white border border-[#E6E4DF] text-[#17181A] shrink-0 shadow-2xs flex items-center gap-1"
                  title={`Budget engagé pour le Jour ${jour} : ${budgetDay} €`}
                >
                  <Euro className="w-3 h-3 text-[#B9862F]" />
                  <span>{Math.round(budgetDay)} €</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Corps de la grille avec défilement vertical */}
      <div className="flex-1 overflow-y-auto relative flex" style={{ minHeight: '500px' }}>
        {/* Colonne des heures à gauche */}
        <div
          className="w-16 md:w-20 shrink-0 border-r border-[#E6E4DF] bg-[#FAF9F7] relative select-none"
          style={{ height: `${TOTAL_HOURS * hourHeight}px` }}
        >
          {hours.map((hourMins, idx) => (
            <div
              key={idx}
              className="absolute left-0 right-0 border-t border-[#E6E4DF] text-[10px] md:text-xs font-semibold text-[#8E8F92] pr-2 text-right -translate-y-2"
              style={{ top: `${idx * hourHeight}px` }}
            >
              {minsToTimeString(hourMins)}
            </div>
          ))}
        </div>

        {/* Colonnes interactives des jours */}
        <div
          className="flex-1 grid relative"
          style={{
            gridTemplateColumns: `repeat(${visibleDays.length}, minmax(0, 1fr))`,
            height: `${TOTAL_HOURS * hourHeight}px`
          }}
        >
          {visibleDays.map((jour) => {
            // Créneaux appartenant à ce jour
            const daySlots = slots.filter((s) => s.jour === jour);
            const isDragTarget = dragOverDay === jour;

            return (
              <div
                key={jour}
                onClick={(e) => handleGridCellClick(e, jour)}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                  if (dragOverDay !== jour) setDragOverDay(jour);
                }}
                onDragLeave={() => {
                  if (dragOverDay === jour) setDragOverDay(null);
                }}
                onDrop={(e) => handleColumnDrop(e, jour)}
                className={`relative border-r border-[#E6E4DF] last:border-r-0 transition-colors cursor-pointer ${
                  isDragTarget ? 'bg-[#3F7A55]/10' : 'hover:bg-[#FAF9F7]/40'
                }`}
              >
                {/* Lignes de subdivision horizontales */}
                {Array.from({ length: TOTAL_HOURS }).map((_, hIdx) => (
                  <div
                    key={hIdx}
                    className="absolute left-0 right-0 border-t border-[#E6E4DF] pointer-events-none"
                    style={{ top: `${hIdx * hourHeight}px`, height: `${hourHeight}px` }}
                  >
                    {/* Demi-heure (si 1/2 ou 1/4) */}
                    <div
                      className="absolute left-0 right-0 border-t border-dashed border-[#EFECE6] pointer-events-none"
                      style={{ top: `${hourHeight / 2}px` }}
                    />
                    {/* Quarts d'heure (si 1/4) */}
                    {granularity === '1/4' && (
                      <>
                        <div
                          className="absolute left-0 right-0 border-t border-dotted border-[#F2EFEA] pointer-events-none"
                          style={{ top: `${hourHeight / 4}px` }}
                        />
                        <div
                          className="absolute left-0 right-0 border-t border-dotted border-[#F2EFEA] pointer-events-none"
                          style={{ top: `${(3 * hourHeight) / 4}px` }}
                        />
                      </>
                    )}
                  </div>
                ))}

                {/* Créneaux du jour */}
                {daySlots.map((slot) => {
                  const top = ((slot.heure_debut - START_MINUTES) / 60) * hourHeight;
                  const height = ((slot.heure_fin - slot.heure_debut) / 60) * hourHeight;
                  const isLocked = (slot.verrouille || 0) > 0;
                  const categoryColor = slot.categorie_couleur || '#3F7A55';

                  return (
                    <div
                      key={slot.id}
                      draggable={!isLocked}
                      onDragStart={(e) => {
                        e.stopPropagation();
                        e.dataTransfer.setData(
                          'text/plain',
                          JSON.stringify({
                            type: 'slot_move',
                            slot_id: slot.id,
                            heure_debut: slot.heure_debut,
                            heure_fin: slot.heure_fin,
                            jour: slot.jour
                          })
                        );
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenSlotDetail && onOpenSlotDetail(slot);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        onOpenSlotDetail && onOpenSlotDetail(slot);
                      }}
                      onMouseEnter={(e) => handleMouseEnterSlot(e, slot)}
                      onMouseLeave={handleMouseLeaveSlot}
                      className={`absolute inset-x-1 rounded-xl p-2 md:p-2.5 transition-all shadow-xs border flex flex-col justify-between overflow-hidden group hover:shadow-md hover:z-10 animate-fade-in transform hover:-translate-y-0.5 active:-rotate-[1deg] active:scale-[1.01] ${
                        isLocked ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
                      }`}
                      style={{
                        top: `${top}px`,
                        height: `${Math.max(height, 28)}px`,
                        backgroundColor: `${categoryColor}15`, // 15% opacité
                        borderColor: categoryColor,
                        borderLeftWidth: '5px'
                      }}
                    >
                      {/* En vue 1 Jour spacieuse vs 3 Jours / Semaine */}
                      {visibleDays.length === 1 && height >= 60 ? (
                        /* Vue 1 Jour : Format étendu avec photo proéminente (occupant ~70% de la largeur du bloc photo/info) */
                        <div className="flex items-stretch gap-3 min-w-0 h-full">
                          {(slot.photo_url || slot.photo_principale) && (
                            <div className="w-1/3 sm:w-2/5 max-w-[200px] h-full rounded-lg overflow-hidden shrink-0 border border-black/10 shadow-2xs">
                              <img
                                src={getPhotoUrl(slot.photo_url || slot.photo_principale)}
                                alt={slot.titre}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            </div>
                          )}

                          <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
                            <div>
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {isLocked && <Lock className="w-3.5 h-3.5 text-[#B9862F] shrink-0" />}
                                  <span className="text-xs md:text-sm font-extrabold text-[#17181A] truncate">
                                    {slot.titre}
                                  </span>
                                </div>

                                {/* Actions rapides */}
                                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onToggleLock && onToggleLock(slot.id);
                                    }}
                                    title={isLocked ? 'Déverrouiller le créneau' : 'Verrouiller le créneau'}
                                    className="p-1 rounded-md bg-white/90 hover:bg-white text-[#55565A] hover:text-[#17181A] shadow-2xs"
                                  >
                                    {isLocked ? <Lock className="w-3 h-3 text-[#B9862F]" /> : <Unlock className="w-3 h-3" />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteSlot && onDeleteSlot(slot.id);
                                    }}
                                    title="Retirer du planning"
                                    className="p-1 rounded-md bg-white/90 hover:bg-[#FAF0EE] text-[#55565A] hover:text-[#C95D4E] shadow-2xs"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>

                              <div className="text-[11px] font-bold text-[#55565A] flex items-center gap-1.5 mt-0.5">
                                <Clock className="w-3 h-3 text-[#8E8F92] shrink-0" />
                                <span>{slot.heure_debut_str} - {slot.heure_fin_str}</span>
                                {slot.zone_geo && (
                                  <span className="text-[10px] text-[#8E8F92] font-semibold flex items-center gap-0.5 ml-1">
                                    <MapPin className="w-2.5 h-2.5" />
                                    {slot.zone_geo}
                                  </span>
                                )}
                              </div>

                              {(slot.description || slot.adresse) && height >= 85 && (
                                <p className="text-[11px] text-[#55565A] line-clamp-2 mt-1 leading-relaxed">
                                  {slot.description || slot.adresse}
                                </p>
                              )}
                            </div>

                            {slot.cout_total > 0 && (
                              <div className="flex items-center justify-between text-[11px] font-bold text-[#17181A] pt-1 border-t border-black/5">
                                <span className="text-[10px] text-[#55565A]">{slot.categorie_nom}</span>
                                <span className="px-2 py-0.5 rounded-md bg-white/90 font-extrabold text-[11px] border border-black/5">
                                  {slot.cout_total} €
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* Vue Compacte (3 Jours / Semaine / Créneau court) */
                        <>
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            {height >= 48 && (slot.photo_url || slot.photo_principale) && (
                              <img
                                src={getPhotoUrl(slot.photo_url || slot.photo_principale)}
                                alt={slot.titre}
                                className="w-9 h-9 md:w-10 md:h-10 rounded-lg object-cover shrink-0 border border-black/10 shadow-2xs"
                              />
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1 text-[10px] md:text-[11px] font-extrabold text-[#17181A] leading-tight">
                                {isLocked && <Lock className="w-3 h-3 text-[#B9862F] shrink-0" />}
                                <span className="truncate">{slot.titre}</span>
                              </div>

                              <div className="text-[9px] md:text-[10px] font-bold text-[#55565A] flex items-center gap-1 mt-0.5">
                                <Clock className="w-2.5 h-2.5 shrink-0" />
                                <span>
                                  {slot.heure_debut_str} - {slot.heure_fin_str}
                                </span>
                              </div>

                              {height >= 75 && (slot.description || slot.adresse) && (
                                <p className="text-[9px] text-[#55565A] line-clamp-1 mt-0.5 italic">
                                  {slot.description || slot.adresse}
                                </p>
                              )}
                            </div>

                            {/* Boutons d'action rapides */}
                            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleLock && onToggleLock(slot.id);
                                }}
                                title={isLocked ? 'Déverrouiller' : 'Verrouiller'}
                                className="p-1 rounded-md bg-white/90 hover:bg-white text-[#55565A] hover:text-[#17181A] shadow-2xs"
                              >
                                {isLocked ? <Lock className="w-3 h-3 text-[#B9862F]" /> : <Unlock className="w-3 h-3" />}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteSlot && onDeleteSlot(slot.id);
                                }}
                                title="Retirer du planning"
                                className="p-1 rounded-md bg-white/90 hover:bg-[#FAF0EE] text-[#55565A] hover:text-[#C95D4E] shadow-2xs"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {height >= 44 && slot.cout_total > 0 && (
                            <div className="flex items-center justify-between text-[10px] font-bold text-[#17181A] mt-1 pt-1 border-t border-black/5">
                              <span className="text-[9px] text-[#55565A] truncate">
                                {slot.categorie_nom}
                              </span>
                              <span className="px-1.5 py-0.2 rounded bg-white/80 font-extrabold text-[9px]">
                                {slot.cout_total} €
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Popover / Survol enrichi de la fiche d'activité (US-7, US-9) */}
      {hoveredSlot && (
        <div
          className="fixed z-50 pointer-events-none bg-white border border-[#E6E4DF] rounded-2xl p-4 shadow-2xl w-72 animate-fade-in space-y-3"
          style={{
            left: `${Math.min(hoverPos.x, window.innerWidth - 300)}px`,
            top: `${Math.min(hoverPos.y, window.innerHeight - 300)}px`
          }}
        >
          {hoveredSlot.photo_url && (
            <img
              src={getPhotoUrl(hoveredSlot.photo_url)}
              alt={hoveredSlot.titre}
              className="w-full h-28 object-cover rounded-xl border border-[#E6E4DF]"
            />
          )}

          <div>
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: hoveredSlot.categorie_couleur }}
              />
              <span className="text-[10px] font-bold text-[#8E8F92] uppercase tracking-wider">
                {hoveredSlot.categorie_nom}
              </span>
            </div>
            <h4 className="text-sm font-extrabold text-[#17181A] mt-0.5">
              {hoveredSlot.titre}
            </h4>
          </div>

          <div className="flex items-center justify-between text-xs text-[#55565A] pt-1 border-t border-[#E6E4DF]">
            <span className="font-bold">
              {hoveredSlot.heure_debut_str} - {hoveredSlot.heure_fin_str}
            </span>
            {hoveredSlot.cout_total > 0 && (
              <span className="font-extrabold text-[#17181A]">{hoveredSlot.cout_total} €</span>
            )}
          </div>

          {hoveredSlot.adresse && (
            <div className="text-[11px] text-[#55565A] flex items-center gap-1.5 truncate">
              <MapPin className="w-3.5 h-3.5 text-[#3F7A55] shrink-0" />
              <span className="truncate">{hoveredSlot.adresse}</span>
            </div>
          )}

          {hoveredSlot.activity_details?.remarques && (
            <div className="text-[11px] text-[#55565A] bg-[#F7F6F3] p-2 rounded-lg italic line-clamp-2">
              « {hoveredSlot.activity_details.remarques} »
            </div>
          )}
        </div>
      )}
    </div>
  );
}
