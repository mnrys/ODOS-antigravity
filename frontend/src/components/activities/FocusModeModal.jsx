/**
 * Mode Focus séquentiel — Validation fiche par fiche.
 * Conforme à PRD_ecran1_creation.md (US-4, US-6, US-7, US-10) et docs/DESIGN.md.
 */
import React, { useState, useEffect } from 'react';
import {
  X, Check, Trash2, ExternalLink, MapPin, Clock, Star,
  Tag as TagIcon, Sparkles, AlertCircle, ChevronLeft, ChevronRight,
  Compass, Euro, FileText
} from 'lucide-react';
import TagInput from './TagInput';

export default function FocusModeModal({
  isOpen,
  onClose,
  tripId,
  nbPersonnes = 1,
  destinations = [],
  categories = [],
  onProcessed
}) {
  const [pendingActivities, setPendingActivities] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // État local de la fiche active en cours d'édition
  const [formData, setFormData] = useState({
    titre: '',
    destination_id: '',
    categorie_id: '',
    type_element: 'activite',
    adresse: '',
    zone_geo: '',
    cout_par_personne: 0,
    duree_min: 60,
    note_interet: 3,
    description: '',
    remarques: '',
    tags: []
  });

  // Chargement des fiches en attente au démarrage
  const loadPending = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/trips/${tripId}/pending-validation`);
      if (res.ok) {
        const data = await res.json();
        setPendingActivities(data);
        setCurrentIndex(0);
      }
    } catch (err) {
      console.error("Erreur de chargement des fiches en attente:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && tripId) {
      loadPending();
    }
  }, [isOpen, tripId]);

  // Synchronisation du formulaire avec la fiche active
  useEffect(() => {
    const current = pendingActivities[currentIndex];
    if (current) {
      setFormData({
        titre: current.titre || '',
        destination_id: current.destination_id || (destinations[0]?.id ?? ''),
        categorie_id: current.categorie_id || '',
        type_element: current.type_element || 'activite',
        adresse: current.adresse || '',
        zone_geo: current.zone_geo || '',
        cout_par_personne: current.cout_par_personne ?? 0,
        duree_min: current.duree_min ?? 60,
        note_interet: current.note_interet ?? 3,
        description: current.description || '',
        remarques: current.remarques || '',
        tags: current.tags || []
      });
    }
  }, [currentIndex, pendingActivities, destinations]);

  if (!isOpen) return null;

  const currentActivity = pendingActivities[currentIndex];
  const totalCount = pendingActivities.length;

  const getSourceHost = (url) => {
    try {
      if (!url) return '';
      const parsed = new URL(url);
      return parsed.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  // Action : Valider la fiche courante (avec ou sans modifications)
  const handleValidate = async () => {
    if (!currentActivity) return;
    try {
      setSaving(true);
      const payload = {
        titre: formData.titre,
        destination_id: Number(formData.destination_id) || currentActivity.destination_id,
        categorie_id: formData.categorie_id ? Number(formData.categorie_id) : null,
        type_element: formData.type_element,
        adresse: formData.adresse,
        zone_geo: formData.zone_geo,
        cout_par_personne: parseFloat(formData.cout_par_personne) || 0,
        duree_min: parseInt(formData.duree_min) || null,
        note_interet: formData.note_interet,
        description: formData.description,
        remarques: formData.remarques,
        tag_ids: formData.tags.map((t) => t.id)
      };

      const res = await fetch(`/api/activities/${currentActivity.id}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showFeedback("✅ Fiche validée et ajoutée au catalogue !");
        removeCurrentAndAdvance();
        if (onProcessed) onProcessed();
      }
    } catch (err) {
      console.error("Erreur lors de la validation:", err);
    } finally {
      setSaving(false);
    }
  };

  // Action : Rejeter la fiche courante vers la corbeille
  const handleReject = async () => {
    if (!currentActivity) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/activities/${currentActivity.id}/reject`, {
        method: 'POST'
      });
      if (res.ok) {
        showFeedback("🗑️ Fiche déplacée vers la corbeille (récupérable 30j)");
        removeCurrentAndAdvance();
        if (onProcessed) onProcessed();
      }
    } catch (err) {
      console.error("Erreur lors du rejet:", err);
    } finally {
      setSaving(false);
    }
  };

  const removeCurrentAndAdvance = () => {
    const nextList = pendingActivities.filter((_, idx) => idx !== currentIndex);
    setPendingActivities(nextList);
    if (currentIndex >= nextList.length) {
      setCurrentIndex(Math.max(0, nextList.length - 1));
    }
  };

  const showFeedback = (msg) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 2500);
  };

  // Gestion des raccourcis clavier
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleValidate();
    }
  };

  const coutTotal = (parseFloat(formData.cout_par_personne) || 0) * nbPersonnes;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onKeyDown={handleKeyDown}
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-[28px] border border-[#E6E4DF] shadow-2xl flex flex-col overflow-hidden">
        {/* Header Modal Focus Mode */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6E4DF] bg-[#FAF3E7]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#17181A] text-[#D6F84C] flex items-center justify-center shadow-sm">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[18px] font-extrabold text-[#17181A]">
                  Mode Focus — Validation
                </h2>
                {totalCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-[#17181A] text-[#D6F84C] text-[12px] font-bold font-tabular">
                    {currentIndex + 1} / {totalCount}
                  </span>
                )}
              </div>
              <p className="text-[12px] text-[#55565A]">
                Examinez, ajustez et validez ou rejetez les fiches importées
              </p>
            </div>
          </div>

          {/* Navigation & Fermeture */}
          <div className="flex items-center gap-2">
            {totalCount > 1 && (
              <div className="flex items-center bg-white rounded-full border border-[#E6E4DF] p-0.5 mr-2">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  className="p-1.5 rounded-full text-[#55565A] hover:text-[#17181A] disabled:opacity-30 transition-colors"
                  title="Fiche précédente"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  disabled={currentIndex >= totalCount - 1}
                  onClick={() => setCurrentIndex((prev) => Math.min(totalCount - 1, prev + 1))}
                  className="p-1.5 rounded-full text-[#55565A] hover:text-[#17181A] disabled:opacity-30 transition-colors"
                  title="Fiche suivante"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full text-[#8E8F92] hover:text-[#17181A] hover:bg-white/80 transition-colors"
              title="Fermer le mode focus (Échap)"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Notification Feedback temporaire */}
        {feedbackMsg && (
          <div className="bg-[#17181A] text-white px-4 py-2 text-center text-[13px] font-semibold flex items-center justify-center gap-2 animate-slide-down">
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* Corps principal */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-20 text-center text-[#8E8F92] text-[14px]">
              Chargement des fiches en attente...
            </div>
          ) : totalCount === 0 ? (
            <div className="py-16 text-center space-y-4 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-[#EBF7EE] text-[#3F7A55] flex items-center justify-center mx-auto shadow-inner">
                <Check size={32} strokeWidth={3} />
              </div>
              <h3 className="text-[20px] font-extrabold text-[#17181A]">
                Pile vide ! Tout est classé 🎉
              </h3>
              <p className="text-[13px] text-[#55565A]">
                Toutes les fiches en attente de validation ont été traitées. Vous pouvez en importer d'autres via le scraping ou la capture rapide.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-full bg-[#17181A] text-white text-[13px] font-bold hover:bg-black transition-colors"
              >
                Retour au catalogue
              </button>
            </div>
          ) : currentActivity && (
            <div className="space-y-6">
              {/* Bannière d'origine et complétude */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F7F6F3] p-3.5 rounded-[18px] border border-[#E6E4DF]">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-[12px] font-bold bg-white text-[#17181A] shadow-xs">
                    {currentActivity.source === 'scraping_auto'
                      ? '🤖 Scraping auto'
                      : currentActivity.source === 'claude_chrome'
                      ? '⚡ Claude for Chrome'
                      : '✏️ Création manuelle'}
                  </span>
                  {currentActivity.url_source && (
                    <a
                      href={currentActivity.url_source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold bg-[#EDEBE6] hover:bg-[#E6E4DF] text-[#17181A] transition-colors"
                      title="Ouvrir la page d'origine pour vérifier les informations"
                    >
                      <ExternalLink size={13} className="text-[#55565A]" />
                      <span>Source : {getSourceHost(currentActivity.url_source)}</span>
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-2 text-[12px] text-[#55565A]">
                  <span>Complétude initiale :</span>
                  <div className="w-16 bg-[#E6E4DF] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#3F7A55] h-full"
                      style={{ width: `${currentActivity.completude || 0}%` }}
                    />
                  </div>
                  <span className="font-bold font-tabular text-[#17181A]">
                    {currentActivity.completude || 0}%
                  </span>
                </div>
              </div>

              {/* Formulaire de validation rapide */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Colonne gauche : Informations de base */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-[12px] font-bold uppercase tracking-wider text-[#55565A] mb-1.5">
                      Titre de la fiche *
                    </label>
                    <input
                      type="text"
                      value={formData.titre}
                      onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#F7F6F3] rounded-[14px] border border-transparent focus:border-[#17181A] focus:bg-white text-[14px] font-bold text-[#17181A] outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-bold uppercase tracking-wider text-[#55565A] mb-1.5">
                        Destination *
                      </label>
                      <select
                        value={formData.destination_id}
                        onChange={(e) => setFormData({ ...formData, destination_id: e.target.value })}
                        className="w-full px-3 py-2 bg-[#F7F6F3] rounded-[12px] border border-transparent focus:border-[#17181A] text-[13px] font-medium text-[#17181A] outline-none"
                      >
                        {destinations.map((d) => (
                          <option key={d.id} value={d.id}>
                            📍 {d.nom}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[12px] font-bold uppercase tracking-wider text-[#55565A] mb-1.5">
                        Catégorie
                      </label>
                      <select
                        value={formData.categorie_id}
                        onChange={(e) => setFormData({ ...formData, categorie_id: e.target.value })}
                        className="w-full px-3 py-2 bg-[#F7F6F3] rounded-[12px] border border-transparent focus:border-[#17181A] text-[13px] font-medium text-[#17181A] outline-none"
                      >
                        <option value="">Non catégorisé</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nom}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-bold uppercase tracking-wider text-[#55565A] mb-1.5">
                        Zone géo
                      </label>
                      <select
                        value={formData.zone_geo}
                        onChange={(e) => setFormData({ ...formData, zone_geo: e.target.value })}
                        className="w-full px-3 py-2 bg-[#F7F6F3] rounded-[12px] border border-transparent focus:border-[#17181A] text-[13px] font-medium text-[#17181A] outline-none"
                      >
                        <option value="">Non spécifiée</option>
                        <option value="nord">Nord</option>
                        <option value="sud">Sud</option>
                        <option value="est">Est</option>
                        <option value="ouest">Ouest</option>
                        <option value="centre">Centre</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[12px] font-bold uppercase tracking-wider text-[#55565A] mb-1.5">
                        Type d'élément
                      </label>
                      <select
                        value={formData.type_element}
                        onChange={(e) => setFormData({ ...formData, type_element: e.target.value })}
                        className="w-full px-3 py-2 bg-[#F7F6F3] rounded-[12px] border border-transparent focus:border-[#17181A] text-[13px] font-medium text-[#17181A] outline-none"
                      >
                        <option value="activite">🎯 Activité</option>
                        <option value="logement">🏨 Logement</option>
                        <option value="vol">✈️ Vol</option>
                        <option value="transport">🚆 Transport</option>
                        <option value="vehicule">🚗 Véhicule</option>
                        <option value="autre">📦 Autre</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-bold uppercase tracking-wider text-[#55565A] mb-1.5">
                      Adresse / Point de départ
                    </label>
                    <input
                      type="text"
                      value={formData.adresse}
                      onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                      placeholder="Ex: Puerto de Tazacorte, La Palma"
                      className="w-full px-3.5 py-2 bg-[#F7F6F3] rounded-[12px] border border-transparent focus:border-[#17181A] text-[13px] text-[#17181A] outline-none"
                    />
                  </div>
                </div>

                {/* Colonne droite : Prix, Note, Description et Tags */}
                <div className="space-y-4">
                  {/* Bloc Prix & Calcul total */}
                  <div className="bg-[#F7F6F3] p-3.5 rounded-[16px] border border-[#E6E4DF] space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[12px] font-bold uppercase tracking-wider text-[#55565A]">
                        Prix par personne (€)
                      </label>
                      <div className="text-[12px] font-semibold text-[#55565A]">
                        Total voyage ({nbPersonnes} pers.) :{' '}
                        <span className="text-[14px] font-extrabold text-[#17181A] font-tabular">
                          {coutTotal.toFixed(0)} €
                        </span>
                      </div>
                    </div>
                    <div className="relative">
                      <Euro size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8F92]" />
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={formData.cout_par_personne}
                        onChange={(e) => setFormData({ ...formData, cout_par_personne: e.target.value })}
                        className="w-full pl-9 pr-3 py-2 bg-white rounded-[10px] border border-[#E6E4DF] focus:border-[#17181A] text-[13px] font-bold text-[#17181A] font-tabular outline-none"
                      />
                    </div>
                  </div>

                  {/* Note d'intérêt */}
                  <div>
                    <label className="block text-[12px] font-bold uppercase tracking-wider text-[#55565A] mb-1.5">
                      Note d'intérêt (1 à 5)
                    </label>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setFormData({ ...formData, note_interet: star })}
                          className="p-1 rounded-lg hover:bg-[#F7F6F3] transition-colors"
                        >
                          <Star
                            size={20}
                            className={
                              star <= formData.note_interet
                                ? 'text-[#B9862F] fill-[#B9862F]'
                                : 'text-[#E6E4DF]'
                            }
                          />
                        </button>
                      ))}
                      <span className="text-[12px] font-bold text-[#55565A] ml-2">
                        {formData.note_interet === 5 ? '⭐ Incontournable' : `${formData.note_interet}/5`}
                      </span>
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-[12px] font-bold uppercase tracking-wider text-[#55565A] mb-1.5">
                      Tags thématiques
                    </label>
                    <TagInput
                      tripId={tripId}
                      selectedTags={formData.tags}
                      onChange={(newTags) => setFormData({ ...formData, tags: newTags })}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-[12px] font-bold uppercase tracking-wider text-[#55565A] mb-1.5">
                      Description / Remarques
                    </label>
                    <textarea
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Notes ou extrait de la description source..."
                      className="w-full px-3.5 py-2 bg-[#F7F6F3] rounded-[12px] border border-transparent focus:border-[#17181A] text-[13px] text-[#17181A] outline-none resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions (Rejeter vs Valider) */}
        {totalCount > 0 && currentActivity && (
          <div className="px-6 py-4 bg-[#F7F6F3] border-t border-[#E6E4DF] flex items-center justify-between">
            {/* Bouton Rejeter */}
            <button
              type="button"
              disabled={saving}
              onClick={handleReject}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[#B4472F] hover:bg-[#B4472F]/10 text-[13px] font-bold transition-colors disabled:opacity-50"
            >
              <Trash2 size={16} />
              <span>Rejeter vers la corbeille</span>
            </button>

            {/* Bouton Valider & Suivant */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-[#8E8F92] hidden sm:inline">
                Raccourci : <kbd className="px-1.5 py-0.5 bg-white rounded border border-[#E6E4DF] font-mono">Ctrl+Entrée</kbd>
              </span>
              <button
                type="button"
                disabled={saving}
                onClick={handleValidate}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#D6F84C] hover:bg-[#cbf13b] text-[#17181A] text-[14px] font-bold shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 disabled:opacity-50"
              >
                <Check size={18} strokeWidth={2.5} />
                <span>Valider & Suivant</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
