import React, { useState, useEffect } from 'react';
import { Zap, ArrowLeft, CheckCircle2, AlertCircle, Link, Euro, Clock, Star, MapPin } from 'lucide-react';

/**
 * Page dédiée "Capture Rapide" pour l'extension Claude for Chrome et saisie ultra-rapide.
 * Conforme à PRD_ecran1_creation.md (US-3), docs/PLAN.md (Phase 4) et docs/DESIGN.md.
 */
export default function QuickCapturePage({ tripId = 1, onNavigateTab }) {
  const [destinations, setDestinations] = useState([]);
  const [formData, setFormData] = useState({
    destination_id: '',
    titre: '',
    url_source: '',
    cout_par_personne: '',
    duree_min: '',
    note_interet: 4,
    type_element: 'activite',
    description: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    async function fetchDestinations() {
      try {
        const res = await fetch(`/api/trips/${tripId}/destinations`);
        if (res.ok) {
          const data = await res.json();
          setDestinations(data);
          if (data.length > 0 && !formData.destination_id) {
            setFormData(prev => ({ ...prev, destination_id: data[0].id }));
          }
        }
      } catch (err) {
        console.error("Erreur chargement destinations:", err);
      }
    }
    fetchDestinations();
  }, [tripId]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.titre.trim() || !formData.destination_id) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        trip_id: tripId,
        destination_id: parseInt(formData.destination_id, 10),
        titre: formData.titre.trim(),
        url_source: formData.url_source.trim() || null,
        description: formData.description.trim() || null,
        cout_par_personne: formData.cout_par_personne ? parseFloat(formData.cout_par_personne) : 0.0,
        duree_min: formData.duree_min ? parseInt(formData.duree_min, 10) : null,
        note_interet: parseInt(formData.note_interet, 10),
        type_element: formData.type_element
      };

      const res = await fetch('/activities/quick-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Erreur lors de l'enregistrement de la capture");
      }

      const created = await res.json();
      setSuccess(`Fiche "${created.titre}" enregistrée avec succès dans la pile "À valider" !`);

      // Réinitialisation partielle pour une prochaine capture
      setFormData(prev => ({
        ...prev,
        titre: '',
        url_source: '',
        cout_par_personne: '',
        duree_min: '',
        description: ''
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-8 space-y-6">
      {/* Barre de retour */}
      {onNavigateTab && (
        <button
          onClick={() => onNavigateTab('creation')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5A5B5E] hover:text-[#17181A] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour à la Création & Catalogue</span>
        </button>
      )}

      {/* En-tête de la page */}
      <div className="bg-white p-6 rounded-2xl border border-[#E3E1DC] shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E8F2EC] flex items-center justify-center text-[#3F7A55]">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#17181A]">Capture Rapide (Claude for Chrome)</h1>
            <p className="text-xs text-[#8E8F92]">Point d'entrée optimisé pour la saisie et capture depuis le web</p>
          </div>
        </div>
        <span className="px-2.5 py-1 bg-[#E8F2EC] text-[#254A33] border border-[#3F7A55]/30 rounded-full text-xs font-bold">
          ⚡ source: chrome
        </span>
      </div>

      {/* Messages de retour */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-[#E8F2EC] border border-[#3F7A55]/30 text-[#254A33] text-sm rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[#3F7A55] shrink-0" />
            <span className="font-medium">{success}</span>
          </div>
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('creation')}
              className="text-xs font-bold underline hover:opacity-80 ml-4 shrink-0"
            >
              Voir dans la pile
            </button>
          )}
        </div>
      )}

      {/* Formulaire de Capture Rapide */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-[#E3E1DC] shadow-sm space-y-4">
        {/* Titre */}
        <div>
          <label className="block text-xs font-semibold text-[#5A5B5E] mb-1 uppercase tracking-wider">
            Titre de l'activité *
          </label>
          <input
            id="quick-capture-title"
            type="text"
            required
            placeholder="Ex: Randonnée Caldera de Taburiente"
            value={formData.titre}
            onChange={(e) => handleChange('titre', e.target.value)}
            className="w-full px-3.5 py-2.5 bg-[#F8F7F5] border border-[#E3E1DC] rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-[#3F7A55] focus:outline-none"
          />
        </div>

        {/* Destination & Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#5A5B5E] mb-1 uppercase tracking-wider flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#3F7A55]" />
              Destination *
            </label>
            <select
              id="quick-capture-destination"
              value={formData.destination_id}
              onChange={(e) => handleChange('destination_id', e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#F8F7F5] border border-[#E3E1DC] rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[#3F7A55] focus:outline-none"
            >
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nom} (Étape {d.ordre})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#5A5B5E] mb-1 uppercase tracking-wider">
              Type d'élément
            </label>
            <select
              id="quick-capture-type"
              value={formData.type_element}
              onChange={(e) => handleChange('type_element', e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#F8F7F5] border border-[#E3E1DC] rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[#3F7A55] focus:outline-none"
            >
              <option value="activite">Activité / Visite</option>
              <option value="restaurant">Restaurant / Café</option>
              <option value="logement">Hébergement</option>
              <option value="transport">Transport</option>
              <option value="autre">Autre</option>
            </select>
          </div>
        </div>

        {/* URL Source */}
        <div>
          <label className="block text-xs font-semibold text-[#5A5B5E] mb-1 uppercase tracking-wider flex items-center gap-1">
            <Link className="w-3.5 h-3.5 text-[#3F7A55]" />
            Lien Source (URL)
          </label>
          <input
            id="quick-capture-url"
            type="url"
            placeholder="https://..."
            value={formData.url_source}
            onChange={(e) => handleChange('url_source', e.target.value)}
            className="w-full px-3.5 py-2.5 bg-[#F8F7F5] border border-[#E3E1DC] rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[#3F7A55] focus:outline-none"
          />
        </div>

        {/* Prix, Durée, Note */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#5A5B5E] mb-1 uppercase tracking-wider flex items-center gap-1">
              <Euro className="w-3.5 h-3.5 text-[#3F7A55]" />
              Prix / pers.
            </label>
            <input
              id="quick-capture-price"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={formData.cout_par_personne}
              onChange={(e) => handleChange('cout_par_personne', e.target.value)}
              className="w-full px-3 py-2 bg-[#F8F7F5] border border-[#E3E1DC] rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[#3F7A55] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#5A5B5E] mb-1 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#3F7A55]" />
              Durée (min)
            </label>
            <input
              id="quick-capture-duration"
              type="number"
              step="15"
              min="0"
              placeholder="120"
              value={formData.duree_min}
              onChange={(e) => handleChange('duree_min', e.target.value)}
              className="w-full px-3 py-2 bg-[#F8F7F5] border border-[#E3E1DC] rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[#3F7A55] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#5A5B5E] mb-1 uppercase tracking-wider flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-[#D97706]" />
              Note (1-5)
            </label>
            <select
              id="quick-capture-rating"
              value={formData.note_interet}
              onChange={(e) => handleChange('note_interet', e.target.value)}
              className="w-full px-3 py-2 bg-[#F8F7F5] border border-[#E3E1DC] rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[#3F7A55] focus:outline-none"
            >
              <option value="1">★☆☆☆☆ (1)</option>
              <option value="2">★★☆☆☆ (2)</option>
              <option value="3">★★★☆☆ (3)</option>
              <option value="4">★★★★☆ (4)</option>
              <option value="5">★★★★★ (5)</option>
            </select>
          </div>
        </div>

        {/* Description / Remarques */}
        <div>
          <label className="block text-xs font-semibold text-[#5A5B5E] mb-1 uppercase tracking-wider">
            Notes / Extrait capturé
          </label>
          <textarea
            id="quick-capture-description"
            rows="3"
            placeholder="Détails, horaires, points forts repérés lors de la visite du site..."
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            className="w-full px-3.5 py-2.5 bg-[#F8F7F5] border border-[#E3E1DC] rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[#3F7A55] focus:outline-none resize-none"
          />
        </div>

        {/* Bouton de soumission */}
        <div className="pt-3">
          <button
            id="quick-capture-submit"
            type="submit"
            disabled={loading || !formData.titre.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#3F7A55] hover:bg-[#254A33] disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md transition-all"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>{loading ? 'Enregistrement...' : 'Enregistrer dans la pile "À valider"'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
