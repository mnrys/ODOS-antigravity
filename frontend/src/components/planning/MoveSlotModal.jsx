import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, ArrowRight, Check, AlertCircle } from 'lucide-react';

// Options d'heures par pas de 15 minutes (07:00 à 22:45)
const START_MINUTES = 420;  // 07:00
const END_MINUTES = 1380;   // 23:00

const minsToTimeString = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const generateTimeOptions = () => {
  const options = [];
  for (let m = START_MINUTES; m < END_MINUTES; m += 15) {
    options.push({ minutes: m, label: minsToTimeString(m) });
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

const DURATION_OPTIONS = [
  { minutes: 15, label: '15 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 45, label: '45 min' },
  { minutes: 60, label: '1 h' },
  { minutes: 90, label: '1 h 30' },
  { minutes: 120, label: '2 h' },
  { minutes: 150, label: '2 h 30' },
  { minutes: 180, label: '3 h' },
  { minutes: 240, label: '4 h' },
];

/**
 * Modale de déplacement et de reprogrammation rapide d'un créneau du planning.
 * Permet à l'utilisateur de changer en 2 clics le jour, l'heure et la durée d'une activité
 * en alternative ou complément fluide au glisser-déposer.
 */
export default function MoveSlotModal({
  isOpen,
  onClose,
  slot,
  nbJours = 7,
  tripStartDate = null,
  onSave
}) {
  const [selectedDay, setSelectedDay] = useState(1);
  const [startMinutes, setStartMinutes] = useState(540); // 09:00
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (slot && isOpen) {
      setSelectedDay(slot.jour || 1);
      const start = slot.heure_debut || 540;
      const end = slot.heure_fin || (start + 60);
      const dur = Math.max(end - start, 15);
      setStartMinutes(start);
      setDurationMinutes(dur);
      setError(null);
    }
  }, [slot, isOpen]);

  if (!isOpen || !slot) return null;

  const endMinutes = Math.min(startMinutes + durationMinutes, END_MINUTES);

  const formatDayDate = (jourIndex) => {
    if (!tripStartDate) return `Jour ${jourIndex}`;
    try {
      const d = new Date(tripStartDate);
      d.setDate(d.getDate() + (jourIndex - 1));
      const formatted = d.toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      });
      return `Jour ${jourIndex} — ${formatted}`;
    } catch {
      return `Jour ${jourIndex}`;
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    if (endMinutes <= startMinutes) {
      setError("L'heure de fin doit être supérieure à l'heure de début.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSave(slot.id, selectedDay, startMinutes, endMinutes);
      onClose();
    } catch (err) {
      setError(err.message || "Erreur lors du déplacement de l'activité.");
    } finally {
      setLoading(false);
    }
  };

  const categoryColor = slot.categorie_couleur || '#3F7A55';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div
        className="bg-white border border-[#E6E4DF] rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="p-5 border-b border-[#E6E4DF] bg-[#FAF9F7] flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm"
              style={{ backgroundColor: categoryColor }}
            >
              <Calendar className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#8E8F92]">
                Déplacer l'activité
              </span>
              <h3 className="text-base font-extrabold text-[#17181A] truncate">
                {slot.titre}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#55565A] hover:text-[#17181A] hover:bg-[#E6E4DF] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleConfirm} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-[#FAF0EE] border border-[#F3CDC7] rounded-2xl text-xs font-semibold text-[#C95D4E] flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Sélection du jour */}
          <div>
            <label className="block text-xs font-extrabold text-[#17181A] mb-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#3F7A55]" />
              Choisir le jour de destination
            </label>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(parseInt(e.target.value, 10))}
              className="w-full px-4 py-2.5 bg-[#FAF9F7] border border-[#E6E4DF] rounded-2xl text-xs font-bold text-[#17181A] focus:outline-hidden focus:border-[#3F7A55] focus:ring-1 focus:ring-[#3F7A55] transition-all cursor-pointer"
            >
              {Array.from({ length: nbJours }).map((_, idx) => {
                const j = idx + 1;
                return (
                  <option key={j} value={j}>
                    {formatDayDate(j)}
                  </option>
                );
              })}
            </select>
          </div>

          {/* 2. Sélection de l'horaire de début */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold text-[#17181A] mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#3F7A55]" />
                Heure de début
              </label>
              <select
                value={startMinutes}
                onChange={(e) => setStartMinutes(parseInt(e.target.value, 10))}
                className="w-full px-4 py-2.5 bg-[#FAF9F7] border border-[#E6E4DF] rounded-2xl text-xs font-bold text-[#17181A] focus:outline-hidden focus:border-[#3F7A55] focus:ring-1 focus:ring-[#3F7A55] transition-all cursor-pointer"
              >
                {TIME_OPTIONS.map((opt) => (
                  <option key={opt.minutes} value={opt.minutes}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#17181A] mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#8E8F92]" />
                Durée
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10))}
                className="w-full px-4 py-2.5 bg-[#FAF9F7] border border-[#E6E4DF] rounded-2xl text-xs font-bold text-[#17181A] focus:outline-hidden focus:border-[#3F7A55] focus:ring-1 focus:ring-[#3F7A55] transition-all cursor-pointer"
              >
                {DURATION_OPTIONS.map((opt) => (
                  <option key={opt.minutes} value={opt.minutes}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Récapitulatif du nouvel horaire */}
          <div className="p-4 bg-[#FAF9F7] rounded-2xl border border-[#E6E4DF] flex items-center justify-between">
            <span className="text-xs font-extrabold text-[#55565A]">Nouvel horaire prévu :</span>
            <div className="flex items-center gap-2 font-black text-xs text-[#17181A] bg-white px-3 py-1.5 rounded-xl border border-[#E6E4DF] shadow-2xs">
              <span>{minsToTimeString(startMinutes)}</span>
              <ArrowRight className="w-3 h-3 text-[#3F7A55]" />
              <span>{minsToTimeString(endMinutes)}</span>
              <span className="text-[10px] text-[#8E8F92] font-semibold">({durationMinutes} min)</span>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl text-xs font-bold text-[#55565A] hover:bg-[#E6E4DF] transition-colors"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-[#17181A] hover:bg-[#3F7A55] text-white rounded-2xl text-xs font-extrabold shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Déplacement...</span>
              ) : (
                <>
                  <Check className="w-4 h-4 text-[#D6F84C]" />
                  <span>Valider le déplacement</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
