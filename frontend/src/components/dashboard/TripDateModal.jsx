import React, { useState, useEffect } from 'react';
import { X, Calendar, Users, Euro, Sparkles, Check, AlertCircle } from 'lucide-react';

/**
 * Modale de modification des dates, durée, voyageurs et budget du voyage.
 * Permet de recalculer automatiquement la date de fin ou la durée.
 * cf. PRD_ecran0_dashboard.md & PRD_ecran1_creation.md.
 */
export default function TripDateModal({ isOpen, onClose, trip, onUpdated }) {
  const [nom, setNom] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [nbJours, setNbJours] = useState(7);
  const [nbPersonnes, setNbPersonnes] = useState(2);
  const [budgetTotal, setBudgetTotal] = useState(2000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (trip) {
      setNom(trip.nom_voyage || '');
      setDateDebut(trip.date_debut || '');
      setNbJours(trip.nb_jours || 7);
      setNbPersonnes(trip.nb_personnes || 2);
      setBudgetTotal(trip.budget?.budget_total_prevu || 2000);
      setError(null);
    }
  }, [trip, isOpen]);

  if (!isOpen || !trip) return null;

  // Calcul de la date de fin estimée
  const calculateEndDate = () => {
    if (!dateDebut || !nbJours) return '';
    const d = new Date(dateDebut);
    d.setDate(d.getDate() + (parseInt(nbJours, 10) - 1));
    return d.toISOString().split('T')[0];
  };

  const handleEndDateChange = (e) => {
    const endVal = e.target.value;
    if (!endVal || !dateDebut) return;
    const start = new Date(dateDebut);
    const end = new Date(endVal);
    const diffTime = end - start;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays >= 1) {
      setNbJours(diffDays);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        nom: nom.trim(),
        date_debut: dateDebut,
        nb_jours: parseInt(nbJours, 10),
        nb_personnes: parseInt(nbPersonnes, 10),
        budget_total: parseFloat(budgetTotal)
      };

      const res = await fetch(`/api/trips/${trip.trip_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Impossible de mettre à jour le voyage');
      }

      if (onUpdated) {
        await onUpdated();
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-[#E6E4DF] overflow-hidden">
        {/* En-tête de la modale */}
        <div className="flex items-center justify-between p-5 border-b border-[#E6E4DF] bg-[#F7F6F3]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#17181A] text-white flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#17181A]">Paramètres du voyage</h3>
              <p className="text-xs text-[#55565A]">Modifiez les dates, la durée et les voyageurs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#55565A] hover:text-[#17181A] hover:bg-[#E6E4DF] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message d'erreur */}
        {error && (
          <div className="mx-5 mt-4 p-3 rounded-2xl bg-[#FAF0EE] border border-[#E8C5BE] flex items-center gap-2 text-xs font-bold text-[#C95D4E]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Nom du voyage */}
          <div>
            <label className="block text-xs font-extrabold text-[#17181A] mb-1.5">
              Nom du séjour
            </label>
            <input
              type="text"
              required
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-[#E6E4DF] bg-[#F7F6F3] text-sm font-semibold text-[#17181A] focus:bg-white focus:outline-hidden focus:border-[#17181A] transition-all"
              placeholder="Ex: Voyage aux Canaries"
            />
          </div>

          {/* Dates & Durée */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold text-[#17181A] mb-1.5">
                Date de départ
              </label>
              <input
                type="date"
                required
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E6E4DF] bg-[#F7F6F3] text-xs font-bold text-[#17181A] focus:bg-white focus:outline-hidden focus:border-[#17181A] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#17181A] mb-1.5">
                Date de retour estimée
              </label>
              <input
                type="date"
                value={calculateEndDate()}
                onChange={handleEndDateChange}
                className="w-full px-3 py-2 rounded-xl border border-[#E6E4DF] bg-[#F7F6F3] text-xs font-bold text-[#17181A] focus:bg-white focus:outline-hidden focus:border-[#17181A] transition-all"
              />
            </div>
          </div>

          {/* Nombre de jours */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-extrabold text-[#17181A]">
                Nombre de jours total
              </label>
              <span className="text-xs font-extrabold text-[#3F7A55]">
                {nbJours} {nbJours > 1 ? 'jours' : 'jour'}
              </span>
            </div>
            <input
              type="number"
              min="1"
              max="90"
              required
              value={nbJours}
              onChange={(e) => setNbJours(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-full px-3.5 py-2 rounded-xl border border-[#E6E4DF] bg-[#F7F6F3] text-sm font-bold text-[#17181A] focus:bg-white focus:outline-hidden focus:border-[#17181A] transition-all"
            />
          </div>

          {/* Nombre de personnes & Budget prévu */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold text-[#17181A] mb-1.5 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-[#55565A]" />
                <span>Voyageurs</span>
              </label>
              <input
                type="number"
                min="1"
                max="50"
                required
                value={nbPersonnes}
                onChange={(e) => setNbPersonnes(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E6E4DF] bg-[#F7F6F3] text-xs font-bold text-[#17181A] focus:bg-white focus:outline-hidden focus:border-[#17181A] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#17181A] mb-1.5 flex items-center gap-1">
                <Euro className="w-3.5 h-3.5 text-[#55565A]" />
                <span>Budget prévu (€)</span>
              </label>
              <input
                type="number"
                min="0"
                step="50"
                required
                value={budgetTotal}
                onChange={(e) => setBudgetTotal(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E6E4DF] bg-[#F7F6F3] text-xs font-bold text-[#17181A] focus:bg-white focus:outline-hidden focus:border-[#17181A] transition-all"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-[#E6E4DF] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-[#55565A] hover:bg-[#F7F6F3] hover:text-[#17181A] transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-[#17181A] text-white hover:bg-[#3F7A55] active:scale-95 transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{loading ? 'Enregistrement...' : 'Enregistrer'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
