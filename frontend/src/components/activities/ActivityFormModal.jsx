/**
 * Modal / Tiroir de création manuelle et d'édition complète d'une fiche activité.
 * Répond à US-1 (Création), US-5 (Édition complète), US-10 (Provenance), US-12 (Documents).
 * Conforme à PRD_ecran1_creation.md et docs/DESIGN.md.
 */
import React, { useState, useEffect } from 'react';
import {
  X, Star, MapPin, Clock, Calendar, DollarSign, Tag, FileText,
  ExternalLink, Sparkles, AlertCircle, Save, CheckCircle2, Navigation
} from 'lucide-react';
import TagInput from './TagInput';
import DocumentUploader from './DocumentUploader';
import { formatApiError } from '../../api/client';

const TYPES_ELEMENT = [
  { id: 'activite', label: 'Activité / Visite', icone: '🎯' },
  { id: 'restaurant', label: 'Restaurant / Café', icone: '🍽️' },
  { id: 'logement', label: 'Hébergement / Hôtel', icone: '🏨' },
  { id: 'transport', label: 'Transport / Trajet', icone: '🚆' },
  { id: 'vol', label: 'Vol aérien', icone: '✈️' },
  { id: 'vehicule', label: 'Location véhicule', icone: '🚗' },
  { id: 'autre', label: 'Autre', icone: '📌' },
];

const ZONES_GEO = [
  { id: 'nord', label: 'Nord' },
  { id: 'sud', label: 'Sud' },
  { id: 'est', label: 'Est' },
  { id: 'ouest', label: 'Ouest' },
];

const STATUTS_RESERVATION = [
  { id: 'non_reserve', label: 'Non réservé', couleur: '#8E8F92' },
  { id: 'en_cours', label: 'En cours', couleur: '#395E8C' },
  { id: 'reserve', label: 'Réservé / Confirmé', couleur: '#3F7A55' },
  { id: 'action_requise', label: 'Action requise', couleur: '#B9862F' },
  { id: 'annule', label: 'Annulé', couleur: '#B4472F' },
];

export default function ActivityFormModal({
  isOpen,
  onClose,
  tripId = 1,
  nbPersonnes = 4,
  activityToEdit = null,
  activityId = null,
  destinations = [],
  categories = [],
  onSaved,
  onSave
}) {
  const effectiveActivityToEdit = activityToEdit || (activityId ? { id: activityId } : null);
  const isEditMode = Boolean(effectiveActivityToEdit?.id);
  const draftKey = `odos_activity_draft_${tripId}`;

  const [destList, setDestList] = useState(destinations || []);
  const [catList, setCatList] = useState(categories || []);

  // État local du formulaire
  const [formData, setFormData] = useState({
    titre: '',
    type_element: 'activite',
    destination_id: '',
    categorie_id: '',
    adresse: '',
    zone_geo: '',
    duree_min: '',
    duree_max: '',
    date_debut: '',
    date_fin: '',
    numero_reference: '',
    cout_par_personne: 0,
    description: '',
    horaires_ouverture: '',
    jours_fermeture: '',
    remarques: '',
    avis_utilisateurs: '',
    note_interet: 0,
    statut: 'non_reserve',
    url_source: '',
  });

  // États spécialisés pour le formulaire Vol Aérien et la conversion Prix Groupe / Pers
  const [flightDepTime, setFlightDepTime] = useState('');
  const [flightArrTime, setFlightArrTime] = useState('');
  const [flightArrAirport, setFlightArrAirport] = useState('');
  const [priceMode, setPriceMode] = useState('person'); // 'person' ou 'group'
  const [groupPriceInput, setGroupPriceInput] = useState('');

  const [selectedTags, setSelectedTags] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Synchronisation automatique de la durée de vol à partir des heures de départ et arrivée
  const handleFlightTimesChange = (newDep, newArr) => {
    setFlightDepTime(newDep);
    setFlightArrTime(newArr);

    if (newDep && newArr) {
      const [dh, dm] = newDep.split(':').map(Number);
      const [ah, am] = newArr.split(':').map(Number);
      if (!isNaN(dh) && !isNaN(dm) && !isNaN(ah) && !isNaN(am)) {
        let depMins = dh * 60 + dm;
        let arrMins = ah * 60 + am;
        if (arrMins < depMins) {
          arrMins += 24 * 60; // Vol de nuit / atterrissage le lendemain
        }
        const diffMins = arrMins - depMins;
        setFormData((prev) => ({
          ...prev,
          duree_min: diffMins,
          horaires_ouverture: `${newDep} → ${newArr}`
        }));
        return;
      }
    }

    if (newDep || newArr) {
      setFormData((prev) => ({
        ...prev,
        horaires_ouverture: newDep && newArr ? `${newDep} → ${newArr}` : (newDep ? `Départ ${newDep}` : `Arrivée ${newArr}`)
      }));
    }
  };

  // Gestion du mode Prix Groupe vs Prix par personne
  const handleGroupPriceChange = (val) => {
    setGroupPriceInput(val);
    const num = parseFloat(val);
    const people = Number(nbPersonnes) || 1;
    if (!isNaN(num) && num >= 0) {
      const perPerson = Math.round((num / people) * 100) / 100;
      setFormData((prev) => ({ ...prev, cout_par_personne: perPerson }));
    } else {
      setFormData((prev) => ({ ...prev, cout_par_personne: 0 }));
    }
  };

  const handlePersonPriceChange = (val) => {
    const num = parseFloat(val);
    setFormData((prev) => ({ ...prev, cout_par_personne: val }));
    const people = Number(nbPersonnes) || 1;
    if (!isNaN(num) && num >= 0) {
      setGroupPriceInput((num * people).toString());
    } else {
      setGroupPriceInput('');
    }
  };

  // Chargement de secours des destinations et catégories si non fournies
  useEffect(() => {
    if (!isOpen) return;
    if (destinations && destinations.length > 0) {
      setDestList(destinations);
    } else {
      fetch(`/api/trips/${tripId}/destinations`)
        .then((r) => r.json())
        .then((d) => Array.isArray(d) && setDestList(d))
        .catch((e) => console.error("Erreur chargement destinations secours:", e));
    }

    if (categories && categories.length > 0) {
      setCatList(categories);
    } else {
      fetch(`/api/categories`)
        .then((r) => r.json())
        .then((c) => Array.isArray(c) && setCatList(c))
        .catch((e) => console.error("Erreur chargement catégories secours:", e));
    }
  }, [isOpen, destinations, categories, tripId]);

  // Initialisation des champs en mode création ou édition
  useEffect(() => {
    if (!isOpen) return;

    if (isEditMode && effectiveActivityToEdit?.id) {
      // Chargement des détails complets de l'activité
      fetch(`/api/activities/${effectiveActivityToEdit.id}`)
        .then((res) => res.json())
        .then((data) => {
          setFormData({
            titre: data.titre || '',
            type_element: data.type_element || 'activite',
            destination_id: data.destination_id || (destList[0]?.id || ''),
            categorie_id: data.categorie_id || '',
            adresse: data.adresse || '',
            zone_geo: data.zone_geo || '',
            duree_min: data.duree_min || '',
            duree_max: data.duree_max || '',
            date_debut: data.date_debut || '',
            date_fin: data.date_fin || '',
            numero_reference: data.numero_reference || '',
            cout_par_personne: data.cout_par_personne || 0,
            description: data.description || '',
            horaires_ouverture: data.horaires_ouverture || '',
            jours_fermeture: data.jours_fermeture || '',
            remarques: data.remarques || '',
            avis_utilisateurs: data.avis_utilisateurs || '',
            note_interet: data.note_interet || 0,
            statut: data.statut || 'non_reserve',
            url_source: data.url_source || '',
          });
          setSelectedTags(data.tags || []);
          setDocuments(data.documents || []);
          setPendingFiles([]);
        })
        .catch((err) => console.error("Erreur de chargement activité:", err));
    } else {
      // Mode création : Vérifie s'il existe un brouillon sauvegardé
      let initialForm = {
        titre: '',
        type_element: 'activite',
        destination_id: destList[0]?.id || '',
        categorie_id: catList[0]?.id || '',
        adresse: '',
        zone_geo: '',
        duree_min: '',
        duree_max: '',
        date_debut: '',
        date_fin: '',
        numero_reference: '',
        cout_par_personne: 0,
        description: '',
        horaires_ouverture: '',
        jours_fermeture: '',
        remarques: '',
        avis_utilisateurs: '',
        note_interet: 0,
        statut: 'non_reserve',
        url_source: '',
      };

      try {
        const savedDraft = localStorage.getItem(draftKey);
        if (savedDraft) {
          const parsed = JSON.parse(savedDraft);
          if (parsed && typeof parsed === 'object') {
            initialForm = { ...initialForm, ...parsed };
          }
        }
      } catch (e) {
        // Ignorer si brouillon illisible
      }

      setFormData(initialForm);
      setSelectedTags([]);
      setDocuments([]);
      setPendingFiles([]);
    }
    setErrorMessage(null);
  }, [isOpen, effectiveActivityToEdit?.id, isEditMode, destList, catList, draftKey]);

  // Sauvegarde automatique du brouillon lors de la saisie
  useEffect(() => {
    if (!isOpen || isEditMode) return;
    try {
      if (formData.titre || formData.description || formData.remarques) {
        localStorage.setItem(draftKey, JSON.stringify(formData));
      }
    } catch (e) {}
  }, [formData, isOpen, isEditMode, draftKey]);

  if (!isOpen) return null;

  // Sécurise la fermeture en cas de saisie en cours
  const handleSafeClose = () => {
    const isDirty = formData.titre?.trim() || formData.description?.trim() || formData.remarques?.trim() || pendingFiles.length > 0;
    if (isDirty && !isEditMode) {
      const confirmClose = window.confirm(
        "Vous avez une saisie en cours. Voulez-vous vraiment fermer ? Votre brouillon restera enregistré pour la prochaine fois."
      );
      if (!confirmClose) return;
    }
    onClose();
  };

  // Calcul dynamique du score de complétude en direct
  const calculateLiveScore = () => {
    let score = 0;
    if (formData.titre.trim()) score += 15;
    if (formData.destination_id) score += 5;
    if (formData.adresse.trim()) score += 10;
    if (formData.duree_min || formData.date_debut) score += 10;
    if (formData.cout_par_personne !== undefined && formData.cout_par_personne !== '') score += 5;
    if (formData.description.trim()) score += 15;
    if (documents.some((d) => d.type_fichier === 'photo') || pendingFiles.some((f) => f.type === 'photo')) score += 10;
    if (formData.horaires_ouverture.trim()) score += 10;
    if (selectedTags.length > 0) score += 5;
    if (formData.note_interet > 0) score += 5;
    if (formData.zone_geo) score += 10;
    return Math.min(100, score);
  };

  const completenessScore = calculateLiveScore();
  const coutTotalEstime = (Number(formData.cout_par_personne) || 0) * (Number(nbPersonnes) || 1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.titre.trim()) {
      setErrorMessage("Le titre de l'activité est obligatoire");
      return;
    }
    if (!formData.destination_id) {
      setErrorMessage("Veuillez sélectionner une destination");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    // Nettoyage rigoureux du payload : les chaînes vides deviennent null pour satisfaire Pydantic
    const payload = {
      destination_id: Number(formData.destination_id),
      titre: formData.titre?.trim() || '',
      type_element: formData.type_element || 'activite',
      categorie_id: formData.categorie_id ? Number(formData.categorie_id) : null,
      adresse: formData.adresse?.trim() || null,
      zone_geo: formData.zone_geo?.trim() || null,
      duree_min: formData.duree_min ? Number(formData.duree_min) : null,
      duree_max: formData.duree_max ? Number(formData.duree_max) : null,
      date_debut: formData.date_debut && String(formData.date_debut).trim() ? String(formData.date_debut).trim() : null,
      date_fin: formData.date_fin && String(formData.date_fin).trim() ? String(formData.date_fin).trim() : null,
      numero_reference: formData.numero_reference?.trim() || null,
      cout_par_personne: Number(formData.cout_par_personne) || 0.0,
      description: formData.description?.trim() || null,
      horaires_ouverture: formData.horaires_ouverture?.trim() || null,
      jours_fermeture: formData.jours_fermeture?.trim() || null,
      source: formData.source || 'manuel',
      remarques: formData.remarques?.trim() || null,
      avis_utilisateurs: formData.avis_utilisateurs?.trim() || null,
      rating: formData.rating ? Number(formData.rating) : null,
      note_interet: formData.note_interet ? Number(formData.note_interet) : null,
      statut: formData.statut || 'non_reserve',
      statut_validation: formData.statut_validation || 'validee',
      url_source: formData.url_source?.trim() || null,
      tag_ids: selectedTags.map((t) => t.id).filter((id) => typeof id === 'number'),
    };

    try {
      let savedActivity;
      if (isEditMode) {
        // Mise à jour de l'activité existante
        const res = await fetch(`/api/activities/${effectiveActivityToEdit.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(formatApiError(err, "Erreur lors de la mise à jour"));
        }
        savedActivity = await res.json();
      } else {
        // Création de la nouvelle activité
        const res = await fetch(`/api/trips/${tripId}/activities`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(formatApiError(err, "Erreur lors de la création"));
        }
        savedActivity = await res.json();

        // Envoi des fichiers en attente pour la nouvelle activité avec gestion de la miniature
        if (pendingFiles.length > 0) {
          for (let pf of pendingFiles) {
            const fd = new FormData();
            fd.append('file', pf.file);
            fd.append('libelle', pf.name);
            fd.append('type_source', 'upload_manuel');
            if (pf.isMain) {
              fd.append('est_principale', 'true');
            }
            await fetch(`/api/activities/${savedActivity.id}/documents`, {
              method: 'POST',
              body: fd,
            });
          }
        }

        // Nettoyage du brouillon après succès
        try {
          localStorage.removeItem(draftKey);
        } catch (e) {}
      }

      if (typeof onSaved === 'function') onSaved(savedActivity);
      if (typeof onSave === 'function') onSave(savedActivity);
      onClose();
    } catch (err) {
      setErrorMessage(err.message || "Une erreur est survenue lors de l'enregistrement");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17181A]/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-[#F1F0ED] rounded-[24px] shadow-2xl border border-[#E6E4DF] my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="px-6 py-4 bg-[#EDEBE6] border-b border-[#E6E4DF] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[12px] bg-[#17181A] text-[#D6F84C] flex items-center justify-center font-bold text-[18px]">
              {isEditMode ? "✏️" : "+"}
            </div>
            <div>
              <h2 className="text-[17px] font-bold text-[#17181A]">
                {isEditMode ? "Panneau complet de la fiche" : "Nouvelle fiche manuelle"}
              </h2>
              <div className="flex items-center gap-2 text-[12px] text-[#55565A]">
                <span className="inline-flex items-center gap-1 font-medium bg-white px-2 py-0.5 rounded-full border border-[#E6E4DF]">
                  ✏️ Provenance : Manuel
                </span>
                <span>·</span>
                <span>Complétude : <strong>{completenessScore}%</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {formData.url_source && (
              <a
                href={formData.url_source}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#17181A] hover:bg-[#3F7A55] text-white text-xs font-bold transition-all shadow-sm group"
                title="Ouvrir la page source officielle / réservation"
              >
                <ExternalLink size={13} className="text-[#D6F84C] group-hover:scale-110 transition-transform" />
                <span>Source / Réserver</span>
              </a>
            )}
            <button
              type="button"
              onClick={handleSafeClose}
              className="w-8 h-8 rounded-full bg-white hover:bg-[#E6E4DF] text-[#55565A] hover:text-[#17181A] flex items-center justify-center transition-colors shadow-sm"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Barre de complétude */}
        <div className="w-full bg-[#E6E4DF] h-1.5">
          <div
            className="h-full bg-[#3F7A55] transition-all duration-300"
            style={{ width: `${completenessScore}%` }}
          />
        </div>

        {/* Formulaire défilable */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMessage && (
            <div className="p-3 bg-[#B4472F]/10 border border-[#B4472F]/30 rounded-[12px] text-[13px] text-[#B4472F] flex items-center gap-2">
              <AlertCircle size={16} />
              {errorMessage}
            </div>
          )}

          {/* Section 1 : Informations principales */}
          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-semibold uppercase tracking-wider text-[#55565A] mb-1.5">
                Titre de l'activité <span className="text-[#B4472F]">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.titre}
                onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                placeholder="Ex : Randonnée volcan Caldera de Taburiente..."
                className="w-full px-3.5 py-2.5 bg-[#F7F6F3] rounded-[12px] border border-transparent focus:border-[#17181A] focus:ring-2 focus:ring-[#D6F84C]/60 text-[15px] font-semibold text-[#17181A] outline-none transition-all"
              />
            </div>

            {/* Type d'élément et Destination */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[12px] font-semibold uppercase tracking-wider text-[#55565A] mb-1.5">
                  Type d'élément
                </label>
                <select
                  value={formData.type_element}
                  onChange={(e) => setFormData({ ...formData, type_element: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F7F6F3] rounded-[12px] border border-transparent focus:border-[#17181A] focus:ring-2 focus:ring-[#D6F84C]/60 text-[13px] text-[#17181A] outline-none font-medium"
                >
                  {TYPES_ELEMENT.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.icone} {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-semibold uppercase tracking-wider text-[#55565A] mb-1.5">
                  Destination <span className="text-[#B4472F]">*</span>
                </label>
                <select
                  required
                  value={formData.destination_id}
                  onChange={(e) => setFormData({ ...formData, destination_id: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F7F6F3] rounded-[12px] border border-transparent focus:border-[#17181A] focus:ring-2 focus:ring-[#D6F84C]/60 text-[13px] text-[#17181A] outline-none font-medium"
                >
                  {destList.map((d) => (
                    <option key={d.id} value={d.id}>
                      📍 {d.nom}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-semibold uppercase tracking-wider text-[#55565A] mb-1.5">
                  Catégorie
                </label>
                <select
                  value={formData.categorie_id}
                  onChange={(e) => setFormData({ ...formData, categorie_id: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F7F6F3] rounded-[12px] border border-transparent focus:border-[#17181A] focus:ring-2 focus:ring-[#D6F84C]/60 text-[13px] text-[#17181A] outline-none font-medium"
                >
                  <option value="">(Aucune catégorie)</option>
                  {catList.map((c) => (
                    <option key={c.id} value={c.id}>
                      ● {c.nom}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2 : Champs adaptatifs selon le type d'élément */}
          <div className="p-4 bg-[#EDEBE6] rounded-[16px] border border-[#E6E4DF] space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#8E8F92]">
              Détails spécifiques : {TYPES_ELEMENT.find((t) => t.id === formData.type_element)?.label}
            </span>

            {/* Pour Activité / Restaurant / Autre : Durées et Horaires */}
            {(formData.type_element === 'activite' || formData.type_element === 'restaurant' || formData.type_element === 'autre') && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[#55565A] mb-1">
                    Durée estimée (min)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="15"
                    value={formData.duree_min}
                    onChange={(e) => setFormData({ ...formData, duree_min: e.target.value })}
                    placeholder="Ex : 120 (pour 2h)"
                    className="w-full px-3 py-2 bg-white rounded-[10px] border border-[#E6E4DF] text-[13px] text-[#17181A] outline-none focus:border-[#17181A]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[12px] font-medium text-[#55565A] mb-1">
                    Horaires d'ouverture
                  </label>
                  <input
                    type="text"
                    value={formData.horaires_ouverture}
                    onChange={(e) => setFormData({ ...formData, horaires_ouverture: e.target.value })}
                    placeholder="Ex : 09:30 - 18:00 (fermé lundi)"
                    className="w-full px-3 py-2 bg-white rounded-[10px] border border-[#E6E4DF] text-[13px] text-[#17181A] outline-none focus:border-[#17181A]"
                  />
                </div>
              </div>
            )}

            {/* Pour Logement / Véhicule : Dates de séjour et N° de référence */}
            {(formData.type_element === 'logement' || formData.type_element === 'vehicule') && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[#55565A] mb-1">
                    Date de début (Check-in / Prise)
                  </label>
                  <input
                    type="date"
                    value={formData.date_debut}
                    onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })}
                    className="w-full px-3 py-2 bg-white rounded-[10px] border border-[#E6E4DF] text-[13px] text-[#17181A] outline-none focus:border-[#17181A]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#55565A] mb-1">
                    Date de fin (Check-out / Retour)
                  </label>
                  <input
                    type="date"
                    value={formData.date_fin}
                    onChange={(e) => setFormData({ ...formData, date_fin: e.target.value })}
                    className="w-full px-3 py-2 bg-white rounded-[10px] border border-[#E6E4DF] text-[13px] text-[#17181A] outline-none focus:border-[#17181A]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#55565A] mb-1">
                    N° de réservation / confirmation
                  </label>
                  <input
                    type="text"
                    value={formData.numero_reference}
                    onChange={(e) => setFormData({ ...formData, numero_reference: e.target.value })}
                    placeholder="Ex : BK-7489201"
                    className="w-full px-3 py-2 bg-white rounded-[10px] border border-[#E6E4DF] text-[13px] text-[#17181A] outline-none focus:border-[#17181A]"
                  />
                </div>
              </div>
            )}

            {/* Pour Vol Aérien dédié : Heures de départ et d'arrivée séparées, calcul auto durée, sans adresse/zone/priorité */}
            {formData.type_element === 'vol' && (
              <div className="space-y-3.5 p-4 bg-[#FAF9F7] rounded-2xl border border-[#3F7A55]/30 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-[#3F7A55]">
                    <span>✈️ Détails du Vol Aérien</span>
                  </div>
                  {formData.duree_min > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EBF5EE] text-[#3F7A55] border border-[#CDE5D4]">
                      Durée calculée : {Math.floor(formData.duree_min / 60)}h{formData.duree_min % 60 > 0 ? `${(formData.duree_min % 60).toString().padStart(2, '0')}` : '00'} ({formData.duree_min} min)
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-semibold text-[#55565A] mb-1">
                      N° de vol & Compagnie
                    </label>
                    <input
                      type="text"
                      value={formData.numero_reference}
                      onChange={(e) => setFormData({ ...formData, numero_reference: e.target.value })}
                      placeholder="Ex : AF-1422 (Air France) / IB-3810"
                      className="w-full px-3 py-2 bg-white rounded-[10px] border border-[#E6E4DF] text-[13px] text-[#17181A] outline-none focus:border-[#17181A]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-[#55565A] mb-1">
                      Date du vol
                    </label>
                    <input
                      type="date"
                      value={formData.date_debut}
                      onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })}
                      className="w-full px-3 py-2 bg-white rounded-[10px] border border-[#E6E4DF] text-[13px] text-[#17181A] outline-none focus:border-[#17181A]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-semibold text-[#55565A] mb-1">
                      Aéroport de départ (Origine & Terminal)
                    </label>
                    <input
                      type="text"
                      value={formData.adresse}
                      onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                      placeholder="Ex : Paris CDG — Terminal 2E"
                      className="w-full px-3 py-2 bg-white rounded-[10px] border border-[#E6E4DF] text-[13px] text-[#17181A] outline-none focus:border-[#17181A]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-[#55565A] mb-1">
                      Aéroport d'arrivée (Destination)
                    </label>
                    <input
                      type="text"
                      value={formData.remarques ? (formData.remarques.split(' | Arrivée : ')[1] || formData.remarques) : ''}
                      onChange={(e) => {
                        const arr = e.target.value;
                        setFormData({
                          ...formData,
                          remarques: arr ? `Arrivée : ${arr}` : ''
                        });
                      }}
                      placeholder="Ex : Tenerife Sud (TFS)"
                      className="w-full px-3 py-2 bg-white rounded-[10px] border border-[#E6E4DF] text-[13px] text-[#17181A] outline-none focus:border-[#17181A]"
                    />
                  </div>
                </div>

                {/* Heures de départ et d'arrivée dans des champs séparés */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-[#E6E4DF]">
                  <div>
                    <label className="block text-[12px] font-semibold text-[#17181A] mb-1 flex items-center gap-1">
                      <span>🛫 Heure de départ (Décollage)</span>
                    </label>
                    <input
                      type="time"
                      value={flightDepTime || (formData.horaires_ouverture?.includes('→') ? formData.horaires_ouverture.split('→')[0].trim() : '')}
                      onChange={(e) => handleFlightTimesChange(e.target.value, flightArrTime || (formData.horaires_ouverture?.includes('→') ? formData.horaires_ouverture.split('→')[1].trim() : ''))}
                      className="w-full px-3 py-2 bg-[#F7F6F3] rounded-[10px] border border-[#E6E4DF] text-[13px] text-[#17181A] font-bold outline-none focus:border-[#17181A]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-[#17181A] mb-1 flex items-center gap-1">
                      <span>🛬 Heure d'arrivée (Atterrissage)</span>
                    </label>
                    <input
                      type="time"
                      value={flightArrTime || (formData.horaires_ouverture?.includes('→') ? formData.horaires_ouverture.split('→')[1].trim() : '')}
                      onChange={(e) => handleFlightTimesChange(flightDepTime || (formData.horaires_ouverture?.includes('→') ? formData.horaires_ouverture.split('→')[0].trim() : ''), e.target.value)}
                      className="w-full px-3 py-2 bg-[#F7F6F3] rounded-[10px] border border-[#E6E4DF] text-[13px] text-[#17181A] font-bold outline-none focus:border-[#17181A]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Pour Autre Transport (Train, Bateau, Bus) */}
            {formData.type_element === 'transport' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[#55565A] mb-1">
                    N° de train / Référence trajet
                  </label>
                  <input
                    type="text"
                    value={formData.numero_reference}
                    onChange={(e) => setFormData({ ...formData, numero_reference: e.target.value })}
                    placeholder="Ex : TGV 8402 / Fred Olsen Ferry"
                    className="w-full px-3 py-2 bg-white rounded-[10px] border border-[#E6E4DF] text-[13px] text-[#17181A] outline-none focus:border-[#17181A]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#55565A] mb-1">
                    Horaires de départ / trajet
                  </label>
                  <input
                    type="text"
                    value={formData.horaires_ouverture}
                    onChange={(e) => setFormData({ ...formData, horaires_ouverture: e.target.value })}
                    placeholder="Ex : Départ 08:30"
                    className="w-full px-3 py-2 bg-white rounded-[10px] border border-[#E6E4DF] text-[13px] text-[#17181A] outline-none focus:border-[#17181A]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#55565A] mb-1">
                    Durée du trajet (min)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.duree_min}
                    onChange={(e) => setFormData({ ...formData, duree_min: e.target.value })}
                    placeholder="Ex : 120 (pour 2h)"
                    className="w-full px-3 py-2 bg-white rounded-[10px] border border-[#E6E4DF] text-[13px] text-[#17181A] outline-none focus:border-[#17181A]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 3 : Localisation & Zone (Masqué si Vol Aérien) */}
          {formData.type_element !== 'vol' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[12px] font-semibold uppercase tracking-wider text-[#55565A]">
                    Adresse / Lieu exact
                  </label>
                  {formData.adresse && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formData.adresse)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-[#395E8C] hover:underline font-medium"
                    >
                      <Navigation size={11} />
                      Tester sur Google Maps
                    </a>
                  )}
                </div>
                <input
                  type="text"
                  value={formData.adresse}
                  onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                  placeholder="Ex : Calle Real 14, Santa Cruz de La Palma"
                  className="w-full px-3.5 py-2.5 bg-[#F7F6F3] rounded-[12px] border border-transparent focus:border-[#17181A] focus:ring-2 focus:ring-[#D6F84C]/60 text-[13px] text-[#17181A] outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold uppercase tracking-wider text-[#55565A] mb-1.5">
                  Zone géographique
                </label>
                <select
                  value={formData.zone_geo}
                  onChange={(e) => setFormData({ ...formData, zone_geo: e.target.value })}
                  className="w-full px-3 py-2.5 bg-[#F7F6F3] rounded-[12px] border border-transparent focus:border-[#17181A] focus:ring-2 focus:ring-[#D6F84C]/60 text-[13px] text-[#17181A] outline-none font-medium"
                >
                  <option value="">(Non précisée)</option>
                  {ZONES_GEO.map((z) => (
                    <option key={z.id} value={z.id}>
                      🧭 {z.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Section 4 : Budget (avec conversion Prix Total Groupe / Par personne), Statut & Note d'intérêt */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1.5 h-[18px]">
                <label className="block text-[12px] font-semibold uppercase tracking-wider text-[#55565A]">
                  Budget / Coût
                </label>
                <button
                  type="button"
                  onClick={() => setPriceMode(priceMode === 'person' ? 'group' : 'person')}
                  className="text-[11px] font-bold text-[#395E8C] hover:underline"
                >
                  {priceMode === 'person' ? `Saisir total (${nbPersonnes || 4} pers.)` : 'Saisir / pers.'}
                </button>
              </div>

              {priceMode === 'person' ? (
                <div>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={formData.cout_par_personne}
                    onChange={(e) => handlePersonPriceChange(e.target.value)}
                    placeholder="0"
                    className="w-full px-3.5 py-2.5 bg-[#F7F6F3] rounded-[12px] border border-transparent focus:border-[#17181A] focus:ring-2 focus:ring-[#D6F84C]/60 text-[13px] text-[#17181A] font-tabular outline-none font-semibold h-[44px]"
                  />
                  <p className="text-[11px] font-semibold text-[#17181A] mt-1.5">
                    Prix par personne • Total ({nbPersonnes || 1} pers.) : {coutTotalEstime.toFixed(0)} €
                  </p>
                </div>
              ) : (
                <div>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={groupPriceInput || (formData.cout_par_personne ? (formData.cout_par_personne * (Number(nbPersonnes) || 1)).toString() : '')}
                    onChange={(e) => handleGroupPriceChange(e.target.value)}
                    placeholder={`Total pour ${nbPersonnes || 4} personnes`}
                    className="w-full px-3.5 py-2.5 bg-[#F7F6F3] rounded-[12px] border border-transparent focus:border-[#17181A] focus:ring-2 focus:ring-[#D6F84C]/60 text-[13px] text-[#17181A] font-tabular outline-none font-semibold h-[44px]"
                  />
                  <p className="text-[11px] font-semibold text-[#3F7A55] mt-1.5">
                    Soit {(Number(formData.cout_par_personne) || 0).toFixed(2)} € / personne
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[12px] font-semibold uppercase tracking-wider text-[#55565A] mb-1.5 h-[18px]">
                Statut de réservation
              </label>
              <select
                value={formData.statut}
                onChange={(e) => setFormData({ ...formData, statut: e.target.value })}
                className="w-full px-3 py-2.5 bg-[#F7F6F3] rounded-[12px] border border-transparent focus:border-[#17181A] focus:ring-2 focus:ring-[#D6F84C]/60 text-[13px] text-[#17181A] outline-none font-medium h-[44px]"
              >
                {STATUTS_RESERVATION.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-[#8E8F92] mt-1.5">
                État d'avancement
              </p>
            </div>

            {/* Note d'intérêt (Masqué pour Vol) */}
            {formData.type_element !== 'vol' ? (
              <div>
                <label className="block text-[12px] font-semibold uppercase tracking-wider text-[#55565A] mb-1.5 h-[18px]">
                  Priorité / Intérêt
                </label>
                <div className="flex items-center gap-1.5 px-3 py-2 bg-[#F7F6F3] rounded-[12px] h-[44px]">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFormData({ ...formData, note_interet: star === formData.note_interet ? 0 : star })}
                      className="p-1 hover:scale-125 transition-transform"
                    >
                      <Star
                        size={18}
                        className={star <= (formData.note_interet || 0) ? "text-[#B9862F] fill-[#B9862F]" : "text-[#8E8F92]"}
                      />
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-[#8E8F92] mt-1.5">
                  Note de 1 à 5 étoiles
                </p>
              </div>
            ) : (
              <div className="flex flex-col justify-center">
                <span className="text-[12px] font-semibold uppercase tracking-wider text-[#55565A] mb-1.5">
                  Verrouillage Planning
                </span>
                <span className="text-xs text-[#3F7A55] font-semibold bg-[#EBF5EE] p-2 rounded-xl border border-[#CDE5D4]">
                  🔒 Vol prioritaire
                </span>
              </div>
            )}
          </div>

          {/* Section 5 : Tags transversaux */}
          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-[#55565A] mb-1.5">
              Tags & Filtres
            </label>
            <TagInput
              tripId={tripId}
              selectedTags={selectedTags}
              onChange={setSelectedTags}
            />
          </div>

          {/* Section 6 : Description & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold uppercase tracking-wider text-[#55565A] mb-1.5">
                Description générale
              </label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Détails sur l'activité, programme, ambiance..."
                className="w-full px-3.5 py-2.5 bg-[#F7F6F3] rounded-[12px] border border-transparent focus:border-[#17181A] focus:ring-2 focus:ring-[#D6F84C]/60 text-[13px] text-[#17181A] outline-none"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold uppercase tracking-wider text-[#55565A] mb-1.5">
                Remarques personnelles
              </label>
              <textarea
                rows={3}
                value={formData.remarques}
                onChange={(e) => setFormData({ ...formData, remarques: e.target.value })}
                placeholder="Conseils, équipement à prévoir, contacts..."
                className="w-full px-3.5 py-2.5 bg-[#F7F6F3] rounded-[12px] border border-transparent focus:border-[#17181A] focus:ring-2 focus:ring-[#D6F84C]/60 text-[13px] text-[#17181A] outline-none"
              />
            </div>
          </div>

          {/* Section 7 : Avis voyageurs & Lien source */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold uppercase tracking-wider text-[#55565A] mb-1.5">
                Avis d'autres voyageurs
              </label>
              <textarea
                rows={2}
                value={formData.avis_utilisateurs}
                onChange={(e) => setFormData({ ...formData, avis_utilisateurs: e.target.value })}
                placeholder="Retours d'expérience, notes Tripadvisor..."
                className="w-full px-3.5 py-2.5 bg-[#F7F6F3] rounded-[12px] border border-transparent focus:border-[#17181A] focus:ring-2 focus:ring-[#D6F84C]/60 text-[13px] text-[#17181A] outline-none"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold uppercase tracking-wider text-[#55565A] mb-1.5">
                Lien source web
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={formData.url_source}
                  onChange={(e) => setFormData({ ...formData, url_source: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3.5 py-2.5 bg-[#F7F6F3] rounded-[12px] border border-transparent focus:border-[#17181A] focus:ring-2 focus:ring-[#D6F84C]/60 text-[13px] text-[#17181A] outline-none font-mono"
                />
                {formData.url_source && (
                  <a
                    href={formData.url_source}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute right-2.5 top-2.5 p-1 text-[#395E8C] hover:text-[#17181A]"
                    title="Ouvrir le lien source"
                  >
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Section 8 : Documents & Photos */}
          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-[#55565A] mb-1.5">
              Documents joints & Galerie photos (US-12)
            </label>
            <DocumentUploader
              activityId={activityToEdit?.id}
              documents={documents}
              onDocumentsChange={setDocuments}
              pendingFiles={pendingFiles}
              onPendingFilesChange={setPendingFiles}
            />
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-[#EDEBE6] border-t border-[#E6E4DF] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <button
              type="button"
              onClick={handleSafeClose}
              className="px-4 py-2.5 rounded-[12px] text-[13px] font-semibold text-[#55565A] hover:bg-white transition-colors"
            >
              Annuler
            </button>
            {!isEditMode && (formData.titre || formData.description) && (
              <span className="text-[11px] text-[#8E8F92] italic hidden md:inline">
                Brouillon sauvegardé automatiquement
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {errorMessage && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#B4472F]/10 border border-[#B4472F]/30 rounded-[10px] text-[#B4472F] text-[12px] font-medium max-w-sm truncate">
                <AlertCircle size={14} className="shrink-0" />
                <span className="truncate">{errorMessage}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-full bg-[#D6F84C] hover:bg-[#cbf13b] text-[#17181A] text-[14px] font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 shrink-0"
            >
              <Save size={16} />
              <span>{isSubmitting ? "Enregistrement..." : isEditMode ? "Enregistrer les modifications" : "Créer l'activité"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
