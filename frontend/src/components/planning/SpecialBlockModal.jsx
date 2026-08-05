import React, { useState, useEffect } from 'react';
import { X, Utensils, Navigation, Coffee, ShoppingBag, PlusCircle, AlertCircle, Clock, Euro, Calendar } from 'lucide-react';

const PRESETS = [
  { type: 'repas', label: 'Repas / Restaurant', icon: Utensils, defaultDuration: 90, color: '#B9862F' },
  { type: 'trajet', label: 'Trajet / Déplacement', icon: Navigation, defaultDuration: 60, color: '#55565A' },
  { type: 'pause', label: 'Pause / Détente', icon: Coffee, defaultDuration: 60, color: '#3F7A55' },
  { type: 'personnalise', label: 'Shopping / Dépense libre', icon: ShoppingBag, defaultDuration: 60, color: '#8E8F92' },
  { type: 'personnalise', label: 'Frais supplémentaires', icon: PlusCircle, defaultDuration: 15, color: '#C95D4E' },
];

export default function SpecialBlockModal({
  isOpen,
  onClose,
  onSubmit,
  categories = [],
  nbJours = 7,
  initialData = null,
  defaultJour = 1,
  defaultHour = 540 // 09:00
}) {
  const [label, setLabel] = useState('');
  const [type, setType] = useState('repas');
  const [categorieId, setCategorieId] = useState('');
  const [dureeMinutes, setDureeMinutes] = useState(60);
  const [cout, setCout] = useState('');
  const [jour, setJour] = useState(defaultJour);
  const [heureDebutMinutes, setHeureDebutMinutes] = useState(defaultHour);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setLabel(initialData.label || '');
      setType(initialData.type || 'repas');
      setCategorieId(initialData.categorie_id ? String(initialData.categorie_id) : '');
      setDureeMinutes(initialData.duree_minutes || 60);
      setCout(initialData.cout !== undefined ? String(initialData.cout) : '');
      setJour(initialData.jour || defaultJour);
      setHeureDebutMinutes(initialData.heure_debut || defaultHour);
    } else {
      setLabel('');
      setType('repas');
      setCategorieId('');
      setDureeMinutes(60);
      setCout('');
      setJour(defaultJour);
      setHeureDebutMinutes(defaultHour);
    }
    setError(null);
  }, [initialData, isOpen, defaultJour, defaultHour]);

  if (!isOpen) return null;

  const handlePresetSelect = (preset) => {
    setType(preset.type);
    if (!label || PRESETS.some(p => p.label === label)) {
      setLabel(preset.label);
    }
    setDureeMinutes(preset.defaultDuration);
  };

  const minutesToTimeString = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const timeStringToMinutes = (str) => {
    const [h, m] = str.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!label.trim()) {
      setError('Veuillez renseigner un libellé pour ce bloc.');
      return;
    }

    if (heureDebutMinutes % 15 !== 0) {
      setError('L\'heure de début doit être un multiple de 15 minutes (ex: 09:00, 09:15, 09:30).');
      return;
    }

    if (dureeMinutes % 15 !== 0 || dureeMinutes <= 0) {
      setError('La durée doit être un multiple de 15 minutes supérieur à 0.');
      return;
    }

    try {
      setLoading(true);
      await onSubmit({
        label: label.trim(),
        type,
        categorie_id: categorieId ? parseInt(categorieId, 10) : null,
        duree_minutes: dureeMinutes,
        cout: parseFloat(cout) || 0.0,
        jour,
        heure_debut: heureDebutMinutes
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border border-[#E6E4DF] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E6E4DF] bg-[#F7F6F3]">
          <div>
            <h3 className="text-lg font-extrabold text-[#17181A]">
              {initialData ? 'Modifier le bloc libre' : 'Ajouter un bloc libre / dépense'}
            </h3>
            <p className="text-xs text-[#55565A] mt-0.5">
              Repas, trajet, pause ou dépense intégrée au suivi budgétaire
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full text-[#55565A] hover:text-[#17181A] hover:bg-[#E6E4DF] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-[#FAF0EE] border border-[#E8C5BE] rounded-xl text-xs font-semibold text-[#C95D4E]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Modèles rapides (Presets) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#8E8F92] mb-2">
              Modèles rapides
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PRESETS.map((preset, idx) => {
                const IconComponent = preset.icon;
                const isSelected = type === preset.type && label === preset.label;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handlePresetSelect(preset)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold text-left transition-all ${
                      isSelected
                        ? 'border-[#17181A] bg-[#17181A] text-white shadow-sm'
                        : 'border-[#E6E4DF] bg-white text-[#17181A] hover:bg-[#F7F6F3]'
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5 shrink-0" style={{ color: isSelected ? 'white' : preset.color }} />
                    <span className="truncate">{preset.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Libellé */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#8E8F92] mb-1.5">
              Libellé du bloc *
            </label>
            <input
              type="text"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: Déjeuner Tapas, Plein d'essence, Shopping..."
              className="w-full px-4 py-2.5 rounded-xl border border-[#E6E4DF] text-sm text-[#17181A] focus:outline-none focus:border-[#17181A] focus:ring-1 focus:ring-[#17181A]"
            />
          </div>

          {/* Coût et Catégorie */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#8E8F92] mb-1.5 flex items-center gap-1">
                <Euro className="w-3.5 h-3.5 text-[#55565A]" />
                Coût total (€)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={cout}
                onChange={(e) => setCout(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2.5 rounded-xl border border-[#E6E4DF] text-sm text-[#17181A] focus:outline-none focus:border-[#17181A] focus:ring-1 focus:ring-[#17181A]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#8E8F92] mb-1.5">
                Catégorie de dépense
              </label>
              <select
                value={categorieId}
                onChange={(e) => setCategorieId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E6E4DF] text-sm text-[#17181A] focus:outline-none focus:border-[#17181A] focus:ring-1 focus:ring-[#17181A] bg-white"
              >
                <option value="">(Aucune / Non catégorisé)</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nom}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Jour, Heure et Durée */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#8E8F92] mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#55565A]" />
                Jour
              </label>
              <select
                value={jour}
                onChange={(e) => setJour(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E6E4DF] text-sm text-[#17181A] focus:outline-none focus:border-[#17181A] focus:ring-1 focus:ring-[#17181A] bg-white"
              >
                {Array.from({ length: nbJours }, (_, i) => i + 1).map((j) => (
                  <option key={j} value={j}>
                    Jour {j}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#8E8F92] mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#55565A]" />
                Heure début
              </label>
              <input
                type="time"
                step="900" // multiples de 15 min
                value={minutesToTimeString(heureDebutMinutes)}
                onChange={(e) => setHeureDebutMinutes(timeStringToMinutes(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E6E4DF] text-sm text-[#17181A] focus:outline-none focus:border-[#17181A] focus:ring-1 focus:ring-[#17181A]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#8E8F92] mb-1.5">
                Durée
              </label>
              <select
                value={dureeMinutes}
                onChange={(e) => setDureeMinutes(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E6E4DF] text-sm text-[#17181A] focus:outline-none focus:border-[#17181A] focus:ring-1 focus:ring-[#17181A] bg-white"
              >
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>1 h 00</option>
                <option value={90}>1 h 30</option>
                <option value={120}>2 h 00</option>
                <option value={180}>3 h 00</option>
              </select>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E6E4DF]">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-[#55565A] hover:bg-[#F7F6F3] transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl text-sm font-bold bg-[#17181A] text-white hover:bg-[#3F7A55] transition-colors disabled:opacity-50"
            >
              {loading ? 'Enregistrement...' : initialData ? 'Mettre à jour' : 'Ajouter au planning'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
