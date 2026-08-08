import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, ArrowRight, Check, AlertCircle, Copy } from 'lucide-react';

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
 * ou de la dupliquer (cloner) sur un nouvel horaire.
 */
export default function MoveSlotModal({
  isOpen,
  onClose,
  slot,
  nbJours = 7,
  tripStartDate = null,
  onSave,
  onDuplicate
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

  const handleDuplicateConfirm = async (e) => {
    e.preventDefault();
    if (endMinutes <= startMinutes) {
      setError("L'heure de fin doit être supérieure à l'heure de début.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      if (onDuplicate) {
        await onDuplicate(slot.id, selectedDay, startMinutes, endMinutes);
      }
      onClose();
    } catch (err) {
      setError(err.message || "Erreur lors de la duplication de l'activité.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#E6E4DF] overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#E6E4DF] bg-[#FAF9F7]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#17181A] text-white flex items-center justify-center">
              <Calendar className="w-4 h-4 text-[#D6F84C]" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#17181A]">Programmer le créneau</h3>
              <p className="text-[11px] font-semibold text-[#55565A] truncate max-w-[240px]">
                {slot.titre}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-[#E6E4DF] text-[#55565A] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleConfirm} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-[#FAF0EE] border border-[#E8C5BE] rounded-2xl flex items-start gap-2.5 text-xs text-[#C95D4E]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Sélection du Jour */}
          <div>
            <label className="block text-xs font-extrabold text-[#17181A] mb-1.5">
              Jour du voyage
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
              {Array.from({ length: nbJours }, (_, i) => i + 1).map((j) => (
                <button
                  key={j}
                  type="button"
                  onClick={() => setSelectedDay(j)}
                  className={`py-2 rounded-xl text-xs font-extrabold transition-all border ${
                    selectedDay === j
                      ? 'bg-[#17181A] text-white border-black shadow-xs'
                      : 'bg-[#FAF9F7] text-[#55565A] border-[#E6E4DF] hover:border-[#17181A]'
                  }`}
                >
                  J{j}
                </button>
              ))}
            </div>
            <p className="text-[11px] font-semibold text-[#8E8F92] mt-1 text-right">
              {formatDayDate(selectedDay)}
            </p>
          </div>

          {/* 2. Sélection Heure de Début et Durée */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold text-[#17181A] mb-1.5">
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
              <label className="block text-xs font-extrabold text-[#17181A] mb-1.5">
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

          {/* 3. Récapitulatif */}
          <div className="p-4 bg-[#FAF9F7] rounded-2xl border border-[#E6E4DF] flex items-center justify-between">
            <span className="text-xs font-extrabold text-[#55565A]">Nouvel horaire :</span>
            <div className="flex items-center gap-2 font-black text-xs text-[#17181A] bg-white px-3 py-1.5 rounded-xl border border-[#E6E4DF] shadow-2xs">
              <span>{minsToTimeString(startMinutes)}</span>
              <ArrowRight className="w-3 h-3 text-[#3F7A55]" />
              <span>{minsToTimeString(endMinutes)}</span>
              <span className="text-[10px] text-[#8E8F92] font-semibold">({durationMinutes} min)</span>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2.5 rounded-2xl text-xs font-bold text-[#55565A] hover:bg-[#E6E4DF] transition-colors"
            >
              Annuler
            </button>

            <div className="flex items-center gap-2">
              {onDuplicate && (
                <button
                  type="button"
                  onClick={handleDuplicateConfirm}
                  disabled={loading}
                  title="Créer une copie sur cet horaire sans déplacer l'original"
                  className="px-3.5 py-2.5 bg-[#FAF9F7] hover:bg-[#3F7A55] hover:text-white text-[#17181A] border border-[#E6E4DF] hover:border-[#3F7A55] rounded-2xl text-xs font-extrabold shadow-2xs transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Copy className="w-3.5 h-3.5 text-[#3F7A55] hover:text-white" />
                  <span>Cloner</span>
                </button>
              )}

              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2.5 bg-[#17181A] hover:bg-[#3F7A55] text-white rounded-2xl text-xs font-extrabold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {loading ? (
                  <span>Enregistrement...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4 text-[#D6F84C]" />
                    <span>Déplacer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
