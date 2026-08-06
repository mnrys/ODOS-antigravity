/**
 * Page dédiée "Capture Rapide" pour l'extension Claude for Chrome, collage JSON et saisie instantanée.
 * Conforme à PRD_ecran1_creation.md (US-3, US-4), docs/PLAN.md (Phase 4) et docs/DESIGN.md.
 */
import React, { useState, useEffect } from 'react';
import {
  Zap, ArrowLeft, CheckCircle2, AlertCircle, Link as LinkIcon, DollarSign,
  Clock, Star, MapPin, Clipboard, FileJson, Copy, Check, Sparkles, Layers,
  RefreshCw, ExternalLink, Tag as TagIcon, FileText, Info, Compass, Image as ImageIcon
} from 'lucide-react';
import DocumentUploader from '../components/activities/DocumentUploader';
import TagInput from '../components/activities/TagInput';
import { formatApiError } from '../api/client';

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

/**
 * Normalise une chaîne de caractères sans accents et en minuscules pour comparaison robuste
 */
function normalizeStr(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Recherche tolérante d'une valeur dans un objet par liste de clés candidates
 */
function getFieldVal(obj, candidates) {
  if (!obj || typeof obj !== 'object') return undefined;
  
  const entries = Object.entries(obj);
  for (const cand of candidates) {
    const candNorm = normalizeStr(cand).replace(/[^a-z0-9]/g, '');
    for (const [key, val] of entries) {
      const keyNorm = normalizeStr(key).replace(/[^a-z0-9]/g, '');
      if (keyNorm === candNorm || (candNorm.length >= 4 && keyNorm.includes(candNorm))) {
        if (val !== undefined && val !== null && val !== '') {
          return val;
        }
      }
    }
  }
  return undefined;
}

export default function QuickCapturePage({
  tripId = 1,
  onPendingCountChange,
  onNavigateTab
}) {
  const [destinations, setDestinations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [nbPersonnes, setNbPersonnes] = useState(1);

  // État complet du formulaire de capture
  const [formData, setFormData] = useState({
    titre: '',
    type_element: 'activite',
    destination_id: '',
    categorie_id: '',
    adresse: '',
    zone_geo: '',
    duree_min: '',
    duree_max: '',
    cout_par_personne: 0,
    description: '',
    horaires_ouverture: '',
    jours_fermeture: '',
    remarques: '',
    avis_utilisateurs: '',
    note_interet: 4,
    statut: 'non_reserve',
    url_source: '',
  });

  // Gestion des photos par glisser-déposer et tags
  const [pendingFiles, setPendingFiles] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [priceMode, setPriceMode] = useState('person'); // 'person' | 'group'
  const [groupPriceInput, setGroupPriceInput] = useState('');

  // Zone de collage JSON & Support Batch
  const [jsonInput, setJsonInput] = useState('');
  const [batchItems, setBatchItems] = useState(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [jsonSuccessMessage, setJsonSuccessMessage] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Chargement des données de référence (destinations, catégories, voyage)
  useEffect(() => {
    async function loadReferenceData() {
      try {
        const [destRes, catRes, dashRes] = await Promise.all([
          fetch(`/api/trips/${tripId}/destinations`),
          fetch(`/api/trips/${tripId}/categories`),
          fetch(`/api/trips/${tripId}/dashboard`)
        ]);

        if (destRes.ok) {
          const dests = await destRes.json();
          setDestinations(dests);
          if (dests.length > 0 && !formData.destination_id) {
            setFormData(prev => ({ ...prev, destination_id: dests[0].id }));
          }
        }
        if (catRes.ok) {
          const cats = await catRes.json();
          setCategories(cats);
        }
        if (dashRes.ok) {
          const dash = await dashRes.json();
          setNbPersonnes(dash.nb_personnes || 1);
        }
      } catch (err) {
        console.error("Erreur de chargement des données de référence:", err);
      }
    }
    loadReferenceData();
  }, [tripId]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Gestion du mode Prix Groupe vs Prix par personne
  const handleGroupPriceChange = (val) => {
    setGroupPriceInput(val);
    const num = parseFloat(val);
    const people = Number(nbPersonnes) || 1;
    if (!isNaN(num) && num >= 0) {
      const perPerson = Math.round((num / people) * 100) / 100;
      setFormData(prev => ({ ...prev, cout_par_personne: perPerson }));
    } else {
      setFormData(prev => ({ ...prev, cout_par_personne: 0 }));
    }
  };

  const handlePersonPriceChange = (val) => {
    const num = parseFloat(val);
    setFormData(prev => ({ ...prev, cout_par_personne: val }));
    const people = Number(nbPersonnes) || 1;
    if (!isNaN(num) && num >= 0) {
      setGroupPriceInput((num * people).toString());
    } else {
      setGroupPriceInput('');
    }
  };

  // Calcul dynamique du score de complétude en direct
  const calculateLiveScore = () => {
    let score = 0;
    if (formData.titre?.trim()) score += 15;
    if (formData.destination_id) score += 5;
    if (formData.adresse?.trim()) score += 10;
    if (formData.duree_min) score += 10;
    if (formData.cout_par_personne !== undefined && formData.cout_par_personne !== '') score += 5;
    if (formData.description?.trim()) score += 15;
    if (pendingFiles.some(f => f.type === 'photo')) score += 10;
    if (formData.horaires_ouverture?.trim()) score += 10;
    if (selectedTags.length > 0) score += 5;
    if (formData.note_interet > 0) score += 5;
    if (formData.zone_geo) score += 10;
    return Math.min(100, score);
  };

  const completenessScore = calculateLiveScore();
  const coutTotalEstime = (Number(formData.cout_par_personne) || 0) * (Number(nbPersonnes) || 1);

  /**
   * Prompt optimisé pour Claude / Claude in Chrome
   */
  const claudePromptText = `Tu es un assistant d'extraction de voyage pour ODOS. Analyse la page web courante et extrais les détails de l'activité au format JSON strict suivant :
{
  "titre": "Nom clair de l'activité",
  "destination": "Nom de la destination (ex: Tenerife)",
  "type_element": "activite",
  "categorie": "Nature",
  "zone_geo": "Sud",
  "cout_par_personne": 25.0,
  "duree_min": 120,
  "note_interet": 4,
  "url_source": "URL exacte de la page",
  "adresse": "Adresse ou lieu-dit",
  "horaires_ouverture": "Horaires éventuels (ex: 09:00 - 18:00)",
  "description": "Points clés, programme et informations pratiques...",
  "remarques": "Conseils pratiques, équipement nécessaire, etc."
}

RÈGLES IMPORTANTES :
- Ne ferme JAMAIS l'onglet de la page web analysée. Laisse la page ouverte pour permettre la vérification et la récupération manuelle des photos.
- type_element parmi : 'activite', 'restaurant', 'logement', 'transport', 'vol', 'vehicule', 'autre'
- zone_geo parmi : 'Nord', 'Sud', 'Est', 'Ouest'
- Réponds UNIQUEMENT avec le bloc JSON valide.`;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(claudePromptText);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2500);
  };

  /**
   * Parseur JSON tolérant aux enrobages markdown et structures imbriquées
   */
  const parseJsonData = (rawText) => {
    if (!rawText || !rawText.trim()) return null;

    let cleaned = rawText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    }

    try {
      return JSON.parse(cleaned);
    } catch (err) {
      // Recherche de crochets [...] ou accolades {...}
      const firstBracket = cleaned.indexOf('[');
      const lastBracket = cleaned.lastIndexOf(']');
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');

      if (firstBracket !== -1 && lastBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
        try {
          return JSON.parse(cleaned.substring(firstBracket, lastBracket + 1));
        } catch (e) {}
      }
      if (firstBrace !== -1 && lastBrace !== -1) {
        try {
          return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
        } catch (e) {}
      }
      return null;
    }
  };

  /**
   * Normalisation robuste d'un objet JSON vers les champs d'une fiche ODOS
   */
  const normalizeItem = (rawItem, currentDestId) => {
    // Si l'objet est imbriqué dans une sous-clé comme { "activite": {...} } ou { "data": {...} }
    let item = rawItem;
    if (rawItem && typeof rawItem === 'object' && !Array.isArray(rawItem)) {
      const keys = Object.keys(rawItem);
      if (keys.length === 1 && typeof rawItem[keys[0]] === 'object' && rawItem[keys[0]] !== null && !Array.isArray(rawItem[keys[0]])) {
        item = rawItem[keys[0]];
      }
    }

    // 1. Titre
    const titre = getFieldVal(item, [
      'titre_activite', 'titre_de_l_activite', 'nom_activite', 'nom_de_l_activite',
      'titre', 'title', 'nom', 'name', 'activity_name', 'activity_title', 'lieu', 'place_name'
    ]) || '';

    // 2. Type d'élément
    let typeElement = 'activite';
    const rawType = getFieldVal(item, ['type_element', 'type', 'categorie', 'category', 'type_activite']);
    if (rawType) {
      const normT = normalizeStr(rawType);
      if (normT.includes('restau') || normT.includes('caf') || normT.includes('bar') || normT.includes('food') || normT.includes('manger')) {
        typeElement = 'restaurant';
      } else if (normT.includes('logement') || normT.includes('hotel') || normT.includes('heberg') || normT.includes('stay') || normT.includes('chambre')) {
        typeElement = 'logement';
      } else if (normT.includes('vol') || normT.includes('flight') || normT.includes('avion')) {
        typeElement = 'vol';
      } else if (normT.includes('vehicule') || normT.includes('voiture') || normT.includes('car') || normT.includes('auto') || normT.includes('location')) {
        typeElement = 'vehicule';
      } else if (normT.includes('transport') || normT.includes('trajet') || normT.includes('bus') || normT.includes('train') || normT.includes('ferry')) {
        typeElement = 'transport';
      } else if (normT.includes('autre')) {
        typeElement = 'autre';
      } else {
        typeElement = 'activite';
      }
    }

    // 3. Destination (recherche floue sans accents)
    let destId = currentDestId || (destinations[0]?.id ?? '');
    const destName = getFieldVal(item, ['destination', 'destination_nom', 'destination_name', 'ville', 'city', 'lieu']);
    if (destName && destinations.length > 0) {
      const normInput = normalizeStr(destName);
      const match = destinations.find(d => {
        const dNorm = normalizeStr(d.nom);
        return dNorm.includes(normInput) || normInput.includes(dNorm);
      });
      if (match) destId = match.id;
    }

    // 4. Catégorie (recherche intelligente par nom ou id dans la liste des catégories du voyage)
    let catId = '';
    const rawCat = getFieldVal(item, ['categorie', 'category', 'categorie_nom', 'nom_categorie', 'type_activite', 'theme']);
    if (rawCat && categories.length > 0) {
      if (typeof rawCat === 'number' && categories.some(c => c.id === rawCat)) {
        catId = rawCat;
      } else {
        const normCat = normalizeStr(rawCat);
        const matchCat = categories.find(c => {
          const cNorm = normalizeStr(c.nom);
          return cNorm === normCat || cNorm.includes(normCat) || normCat.includes(cNorm);
        });
        if (matchCat) catId = matchCat.id;
      }
    }

    // 5. Zone géographique (conversion tolérante vers le code interne : 'nord', 'sud', 'est', 'ouest')
    let zoneGeo = '';
    const rawZone = getFieldVal(item, ['zone_geo', 'zone', 'region', 'secteur', 'secteur_geo', 'zone_geographique']);
    if (rawZone) {
      const normZ = normalizeStr(rawZone);
      if (normZ.includes('nord') || normZ.includes('north')) {
        zoneGeo = 'nord';
      } else if (normZ.includes('sud') || normZ.includes('south')) {
        zoneGeo = 'sud';
      } else if (normZ.includes('ouest') || normZ.includes('west')) {
        zoneGeo = 'ouest';
      } else if (normZ.includes('est') || normZ.includes('east')) {
        zoneGeo = 'est';
      }
    }

    // 6. URL Source
    const urlSource = getFieldVal(item, [
      'url_source', 'lien_source', 'lien', 'url', 'link', 'source_url', 'source', 'page_url', 'web_url', 'site_web'
    ]) || '';

    // 7. Coût / Prix
    let price = 0.0;
    const rawPrice = getFieldVal(item, [
      'cout_par_personne', 'prix_par_personne', 'prix', 'cout', 'tarif', 'price', 'cost', 'rate', 'price_per_person'
    ]);
    if (typeof rawPrice === 'number') {
      price = rawPrice;
    } else if (typeof rawPrice === 'string') {
      const normP = rawPrice.toLowerCase();
      if (normP.includes('gratuit') || normP.includes('free')) {
        price = 0.0;
      } else {
        const parsed = parseFloat(rawPrice.replace(/[^0-9.,]/g, '').replace(',', '.'));
        if (!isNaN(parsed)) price = parsed;
      }
    }

    // 8. Durée
    let duration = '';
    const rawDur = getFieldVal(item, ['duree_min', 'duree_minutes', 'duree', 'duration', 'temps_visite', 'duree_estimee']);
    if (typeof rawDur === 'number') {
      duration = rawDur;
    } else if (typeof rawDur === 'string') {
      const normD = rawDur.toLowerCase();
      if (normD.includes('h')) {
        const parts = normD.split('h');
        const h = parseInt(parts[0].replace(/[^0-9]/g, ''), 10) || 0;
        const m = parseInt((parts[1] || '').replace(/[^0-9]/g, ''), 10) || 0;
        duration = h * 60 + m;
      } else {
        const parsed = parseInt(normD.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(parsed)) duration = parsed;
      }
    }

    // 9. Note d'intérêt (1 à 5)
    let rating = 4;
    const rawRate = getFieldVal(item, ['note_interet', 'note', 'rating', 'score', 'interet', 'stars']);
    if (rawRate !== undefined && rawRate !== null) {
      const parsed = parseInt(String(rawRate).replace(/[^0-9]/g, ''), 10);
      if (!isNaN(parsed)) rating = Math.min(5, Math.max(1, parsed));
    }

    // 10. Description, Remarques, Horaires, Adresse, Avis
    const description = getFieldVal(item, [
      'description', 'details', 'points_cles', 'resume', 'notes', 'information', 'informations', 'extrait', 'content', 'summary'
    ]) || '';

    const adresse = getFieldVal(item, ['adresse', 'address', 'localisation', 'lieu_dit']) || '';
    const horaires = getFieldVal(item, ['horaires_ouverture', 'horaires', 'heures', 'opening_hours', 'hours']) || '';
    const joursFermeture = getFieldVal(item, ['jours_fermeture', 'fermeture', 'closed_days', 'closed']) || '';
    const remarques = getFieldVal(item, ['remarques', 'conseils', 'tips', 'recommendations', 'remarque']) || '';
    const avis = getFieldVal(item, ['avis_utilisateurs', 'avis', 'reviews', 'rating_details']) || '';

    return {
      titre,
      type_element: typeElement,
      destination_id: destId,
      categorie_id: catId,
      adresse,
      zone_geo: zoneGeo,
      duree_min: duration,
      duree_max: '',
      cout_par_personne: price,
      description,
      horaires_ouverture: horaires,
      jours_fermeture: joursFermeture,
      remarques,
      avis_utilisateurs: avis,
      note_interet: rating,
      statut: 'non_reserve',
      url_source: urlSource
    };
  };

  /**
   * Analyse automatique du JSON lors de la saisie ou du collage
   */
  const handleJsonChange = (text) => {
    setJsonInput(text);
    setError(null);
    setJsonSuccessMessage(null);
    setBatchItems(null);

    if (!text.trim()) return;

    const parsed = parseJsonData(text);
    if (!parsed) {
      setError("Le texte collé n'a pas pu être converti en JSON valide. Vérifiez le format.");
      return;
    }

    if (Array.isArray(parsed)) {
      // Lot de plusieurs fiches
      const normalizedList = parsed.map(item => normalizeItem(item, formData.destination_id));
      setBatchItems(normalizedList);
      setJsonSuccessMessage(`✨ ${normalizedList.length} activités détectées dans le JSON !`);
    } else if (typeof parsed === 'object') {
      // Fiche unique
      const normalized = normalizeItem(parsed, formData.destination_id);
      setFormData(prev => ({
        ...prev,
        ...normalized
      }));
      // Recalcule le prix de groupe
      const people = Number(nbPersonnes) || 1;
      setGroupPriceInput(((normalized.cout_par_personne || 0) * people).toString());
      setJsonSuccessMessage(`✨ Données de "${normalized.titre || 'Activité'}" chargées dans le formulaire !`);
    }
  };

  /**
   * Collage direct depuis le presse-papier système
   */
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        handleJsonChange(text);
      }
    } catch (err) {
      setError("Impossible d'accéder directement au presse-papier. Collez le texte manuellement dans le champ ci-dessous.");
    }
  };

  /**
   * Réinitialisation complète du formulaire
   */
  const handleResetForm = () => {
    setFormData({
      titre: '',
      type_element: 'activite',
      destination_id: destinations[0]?.id || '',
      categorie_id: '',
      adresse: '',
      zone_geo: '',
      duree_min: '',
      duree_max: '',
      cout_par_personne: 0,
      description: '',
      horaires_ouverture: '',
      jours_fermeture: '',
      remarques: '',
      avis_utilisateurs: '',
      note_interet: 4,
      statut: 'non_reserve',
      url_source: '',
    });
    setPendingFiles([]);
    setSelectedTags([]);
    setGroupPriceInput('');
    setJsonInput('');
    setBatchItems(null);
    setJsonSuccessMessage(null);
    setError(null);
    setSuccess(null);
  };

  /**
   * Soumission du formulaire individuel avec upload des photos
   */
  const handleSubmitSingle = async (e) => {
    e.preventDefault();
    if (!formData.titre.trim()) {
      setError("Le titre de l'activité est obligatoire.");
      return;
    }
    if (!formData.destination_id) {
      setError("Veuillez sélectionner une destination pour cette activité.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        destination_id: parseInt(formData.destination_id, 10),
        titre: formData.titre.trim(),
        type_element: formData.type_element || 'activite',
        categorie_id: formData.categorie_id ? parseInt(formData.categorie_id, 10) : null,
        adresse: formData.adresse?.trim() || null,
        zone_geo: formData.zone_geo?.trim() || null,
        duree_min: formData.duree_min ? parseInt(formData.duree_min, 10) : null,
        duree_max: formData.duree_max ? parseInt(formData.duree_max, 10) : null,
        cout_par_personne: Number(formData.cout_par_personne) || 0.0,
        description: formData.description?.trim() || null,
        horaires_ouverture: formData.horaires_ouverture?.trim() || null,
        jours_fermeture: formData.jours_fermeture?.trim() || null,
        source: 'claude_chrome',
        remarques: formData.remarques?.trim() || null,
        avis_utilisateurs: formData.avis_utilisateurs?.trim() || null,
        note_interet: formData.note_interet ? parseInt(formData.note_interet, 10) : 4,
        statut: formData.statut || 'non_reserve',
        statut_validation: 'a_valider',
        url_source: formData.url_source?.trim() || null,
        tag_ids: selectedTags.map(t => t.id).filter(id => typeof id === 'number')
      };

      // 1. Création de l'activité en base
      const res = await fetch(`/api/trips/${tripId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(formatApiError(errData, "Erreur lors de l'enregistrement de l'activité"));
      }

      const createdActivity = await res.json();

      // 2. Téléversement des photos glissées-déposées
      if (pendingFiles.length > 0) {
        for (let pf of pendingFiles) {
          const fd = new FormData();
          fd.append('file', pf.file);
          fd.append('libelle', pf.name);
          fd.append('type_source', 'upload_manuel');
          if (pf.isMain) {
            fd.append('est_principale', 'true');
          }
          await fetch(`/api/activities/${createdActivity.id}/documents`, {
            method: 'POST',
            body: fd,
          });
        }
      }

      // Mise à jour du compteur global de validation
      if (onPendingCountChange) {
        fetch(`/api/trips/${tripId}/pending-validation`)
          .then(r => r.json())
          .then(list => onPendingCountChange(list.length))
          .catch(() => {});
      }

      setSuccess(`Fiche "${createdActivity.titre}" enregistrée avec succès dans la pile "À valider" avec ${pendingFiles.length} document(s) / photo(s) !`);
      
      // Réinitialisation après enregistrement
      handleResetForm();
    } catch (err) {
      setError(err.message || "Une erreur est survenue lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Import en lot de la liste d'activités détectées dans le JSON
   */
  const handleImportBatch = async () => {
    if (!batchItems || batchItems.length === 0) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payloadList = batchItems.map(item => ({
        trip_id: tripId,
        destination_id: parseInt(item.destination_id || destinations[0]?.id, 10),
        titre: item.titre.trim() || 'Activité sans titre',
        url_source: item.url_source?.trim() || null,
        description: item.description?.trim() || null,
        cout_par_personne: Number(item.cout_par_personne) || 0.0,
        duree_min: item.duree_min ? parseInt(item.duree_min, 10) : null,
        duree_max: item.duree_max ? parseInt(item.duree_max, 10) : null,
        note_interet: item.note_interet ? parseInt(item.note_interet, 10) : 4,
        type_element: item.type_element || 'activite',
        adresse: item.adresse?.trim() || null,
        horaires_ouverture: item.horaires_ouverture?.trim() || null,
        jours_fermeture: item.jours_fermeture?.trim() || null,
        remarques: item.remarques?.trim() || null,
        avis_utilisateurs: item.avis_utilisateurs?.trim() || null,
        statut: item.statut || 'non_reserve'
      }));

      const res = await fetch('/activities/quick-capture/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadList)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(formatApiError(errData, "Erreur lors de l'import par lot"));
      }

      const createdList = await res.json();

      if (onPendingCountChange) {
        fetch(`/api/trips/${tripId}/pending-validation`)
          .then(r => r.json())
          .then(list => onPendingCountChange(list.length))
          .catch(() => {});
      }

      setSuccess(`🎉 ${createdList.length} fiches importées avec succès dans la pile "À valider" !`);
      setBatchItems(null);
      setJsonInput('');
      setJsonSuccessMessage(null);
    } catch (err) {
      setError(err.message || "Une erreur est survenue lors de l'import par lot");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* En-tête de navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => onNavigateTab && onNavigateTab('creation')}
          className="flex items-center gap-2 text-sm font-semibold text-[#8E8F92] hover:text-[#17181A] transition-colors"
        >
          <ArrowLeft size={16} />
          Retour à la Création & Catalogue
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono bg-[#3F7A55]/10 text-[#3F7A55] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-[#3F7A55]/20">
            <Sparkles size={12} />
            source: claude_chrome
          </span>
          <span className="text-xs font-mono bg-[#B9862F]/10 text-[#B9862F] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-[#B9862F]/20">
            statut: à valider
          </span>
        </div>
      </div>

      {/* Titre et description */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E2E0D8] mb-6 flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-[#3F7A55]/10 flex items-center justify-center text-[#3F7A55] shrink-0">
          <Zap size={24} />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[#17181A]">Capture Rapide (Claude in Chrome & JSON)</h1>
          <p className="text-sm text-[#8E8F92] mt-1">
            Collez le JSON généré par Claude ou laissez l'extension remplir les champs. Glissez-déposez ensuite vos photos directement depuis la page active dans la galerie ci-dessous.
          </p>
        </div>
      </div>

      {/* Bannière de conseils et instructions pour Claude in Chrome */}
      <div className="bg-[#395E8C]/10 border border-[#395E8C]/20 rounded-xl p-4 mb-6 flex items-start gap-3">
        <Info size={20} className="text-[#395E8C] shrink-0 mt-0.5" />
        <div className="text-xs text-[#395E8C] flex-1">
          <p className="font-semibold text-sm mb-1 text-[#395E8C]">
            💡 Conseil pour Claude in Chrome & Transfert de photos :
          </p>
          <p>
            Lorsque Claude in Chrome extrait les données, demandez-lui de <strong>conserver l'onglet source ouvert</strong>. Pendant que la page est visible, vous pouvez faire un <strong>glisser-déposer (drag & drop)</strong> rapide des images directement dans la section "Galerie & Documents" ci-dessous.
          </p>
        </div>
      </div>

      {/* Messages de statut global */}
      {error && (
        <div className="mb-6 p-4 bg-[#B4472F]/10 border border-[#B4472F]/20 rounded-xl flex items-start gap-3 text-[#B4472F]">
          <AlertCircle size={20} className="shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Attention</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-[#3F7A55]/10 border border-[#3F7A55]/20 rounded-xl flex items-center justify-between text-[#3F7A55]">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} className="shrink-0" />
            <p className="text-sm font-semibold">{success}</p>
          </div>
          <button
            onClick={() => onNavigateTab && onNavigateTab('creation')}
            className="text-xs font-bold underline hover:text-[#2D583D] ml-4 shrink-0"
          >
            Aller au Mode Focus / Pile à valider →
          </button>
        </div>
      )}

      {/* Zone de collage JSON Intelligent & Prompt Claude */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E2E0D8] mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <FileJson size={18} className="text-[#3F7A55]" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#17181A]">
              Coller le JSON généré par Claude
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePasteClipboard}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F1F0ED] hover:bg-[#E2E0D8] text-[#17181A] text-xs font-semibold rounded-lg transition-colors border border-[#E2E0D8]"
            >
              <Clipboard size={14} />
              Coller depuis le presse-papier
            </button>
            <button
              type="button"
              onClick={handleCopyPrompt}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3F7A55]/10 hover:bg-[#3F7A55]/20 text-[#3F7A55] text-xs font-semibold rounded-lg transition-colors border border-[#3F7A55]/20"
              title="Copie le prompt calibré à envoyer à Claude ou Claude in Chrome"
            >
              {copiedPrompt ? <Check size={14} /> : <Copy size={14} />}
              {copiedPrompt ? 'Prompt copié !' : 'Copier le prompt Claude'}
            </button>
          </div>
        </div>

        <textarea
          value={jsonInput}
          onChange={(e) => handleJsonChange(e.target.value)}
          placeholder={`Collez ici le JSON produit par Claude (une fiche ou un tableau de fiches)...\nExemple:\n{\n  "titre": "Visite Slingshot en autonomie",\n  "destination": "Tenerife",\n  "cout_par_personne": 35.0,\n  "duree_min": 120,\n  "url_source": "https://...",\n  "description": "Superbe balade côtière..."\n}`}
          rows={5}
          className="w-full text-xs font-mono p-3 bg-[#FAF9F5] border border-[#E2E0D8] rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3F7A55] focus:border-transparent transition-all"
        />

        {jsonSuccessMessage && (
          <div className="mt-3 p-2.5 bg-[#3F7A55]/10 border border-[#3F7A55]/20 rounded-lg flex items-center gap-2 text-xs font-semibold text-[#3F7A55]">
            <Sparkles size={15} />
            <span>{jsonSuccessMessage}</span>
          </div>
        )}

        {/* Bloc d'aperçu et import par lot si un tableau JSON a été détecté */}
        {batchItems && batchItems.length > 0 && (
          <div className="mt-4 p-4 bg-[#F1F0ED] border border-[#E2E0D8] rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-[#3F7A55]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#17181A]">
                  Mode Lot : {batchItems.length} fiches prêtes à être importées
                </span>
              </div>
              <button
                type="button"
                onClick={handleImportBatch}
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#3F7A55] hover:bg-[#2D583D] text-white text-xs font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Importer les {batchItems.length} fiches dans "À valider"
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {batchItems.map((item, idx) => (
                <div key={idx} className="p-2.5 bg-white border border-[#E2E0D8] rounded-lg text-xs flex items-center justify-between">
                  <div className="flex-1 min-w-0 pr-3">
                    <p className="font-bold text-[#17181A] truncate">{item.titre || 'Sans titre'}</p>
                    <p className="text-[#8E8F92] truncate">{item.description || item.url_source || 'Aucun détail'}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-[#8E8F92]">
                    {item.cout_par_personne > 0 && <span>{item.cout_par_personne} €/p</span>}
                    {item.duree_min && <span>{item.duree_min} min</span>}
                    <span className="bg-[#F1F0ED] px-2 py-0.5 rounded text-[10px] font-semibold text-[#17181A]">{item.type_element}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Formulaire Complet de Vérification & Enrichissement */}
      <form onSubmit={handleSubmitSingle} className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-[#E2E0D8] space-y-8">
        {/* En-tête du formulaire avec Jauge de Complétude */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#E2E0D8] gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#17181A]">Fiche d'Activité Complète</h2>
            <p className="text-xs text-[#8E8F92] mt-0.5">
              Vérifiez les données extraites, complétez les champs et déposez vos photos avant d'enregistrer.
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Score de complétude en direct */}
            <div className="flex items-center gap-2 bg-[#F1F0ED] px-3.5 py-1.5 rounded-xl border border-[#E2E0D8]">
              <span className="text-xs font-semibold text-[#8E8F92]">Complétude :</span>
              <div className="w-16 h-2 bg-[#E2E0D8] rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-300 rounded-full"
                  style={{
                    width: `${completenessScore}%`,
                    backgroundColor: completenessScore >= 80 ? '#3F7A55' : completenessScore >= 50 ? '#B9862F' : '#B4472F'
                  }}
                />
              </div>
              <span className="text-xs font-bold text-[#17181A] font-mono">{completenessScore}%</span>
            </div>

            <button
              type="button"
              onClick={handleResetForm}
              className="text-xs font-semibold text-[#8E8F92] hover:text-[#B4472F] transition-colors"
            >
              Vider
            </button>
          </div>
        </div>

        {/* Section 1 : Essentiel (Titre, Destination, Type, Catégorie) */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#8E8F92] flex items-center gap-1.5">
            <Info size={14} className="text-[#3F7A55]" />
            1. Informations Essentielles
          </h3>

          <div>
            <label className="block text-xs font-bold text-[#17181A] mb-1.5">
              Titre de l'activité <span className="text-[#B4472F]">*</span>
            </label>
            <input
              id="quick-capture-title"
              type="text"
              required
              value={formData.titre}
              onChange={(e) => handleChange('titre', e.target.value)}
              placeholder="Ex: Randonnée dans le Parc National du Teide"
              className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-[#E2E0D8] rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3F7A55] focus:border-transparent transition-all"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#17181A] mb-1.5">
                Destination <span className="text-[#B4472F]">*</span>
              </label>
              <select
                id="quick-capture-destination"
                value={formData.destination_id}
                onChange={(e) => handleChange('destination_id', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-[#E2E0D8] rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3F7A55] focus:border-transparent transition-all"
              >
                {destinations.map((d, idx) => (
                  <option key={d.id} value={d.id}>
                    {d.nom} (Étape {idx + 1})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#17181A] mb-1.5">
                Type d'élément
              </label>
              <select
                id="quick-capture-type"
                value={formData.type_element}
                onChange={(e) => handleChange('type_element', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-[#E2E0D8] rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3F7A55] focus:border-transparent transition-all"
              >
                {TYPES_ELEMENT.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.icone} {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#17181A] mb-1.5">
                Catégorie
              </label>
              <select
                id="quick-capture-category"
                value={formData.categorie_id}
                onChange={(e) => handleChange('categorie_id', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-[#E2E0D8] rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3F7A55] focus:border-transparent transition-all"
              >
                <option value="">-- Sans catégorie --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#17181A] mb-1.5">
                Zone géographique
              </label>
              <select
                id="quick-capture-zone-geo"
                value={formData.zone_geo}
                onChange={(e) => handleChange('zone_geo', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-[#E2E0D8] rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3F7A55] focus:border-transparent transition-all"
              >
                <option value="">-- Non spécifiée --</option>
                {ZONES_GEO.map(z => (
                  <option key={z.id} value={z.id}>
                    {z.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#17181A] mb-1.5">
              Adresse complète / Lieu-dit
            </label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3.5 top-3 text-[#8E8F92]" />
              <input
                id="quick-capture-address"
                type="text"
                value={formData.adresse}
                onChange={(e) => handleChange('adresse', e.target.value)}
                placeholder="Ex: Calle Real 12, 38400 Puerto de la Cruz"
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#FAF9F5] border border-[#E2E0D8] rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3F7A55] focus:border-transparent transition-all"
              />
            </div>
          </div>
        </div>

        {/* Section 2 : Budget, Durée & Horaires */}
        <div className="space-y-4 pt-4 border-t border-[#E2E0D8]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#8E8F92] flex items-center gap-1.5">
            <DollarSign size={14} className="text-[#3F7A55]" />
            2. Organisation & Budget
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Prix avec commutateur Par personne / Groupe */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-[#17181A]">
                  Tarif / Coût
                </label>
                <div className="flex items-center bg-[#F1F0ED] rounded-lg p-0.5 border border-[#E2E0D8] text-[11px]">
                  <button
                    type="button"
                    onClick={() => setPriceMode('person')}
                    className={`px-2 py-0.5 rounded font-semibold transition-colors ${priceMode === 'person' ? 'bg-white text-[#17181A] shadow-xs' : 'text-[#8E8F92]'}`}
                  >
                    Par pers.
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriceMode('group')}
                    className={`px-2 py-0.5 rounded font-semibold transition-colors ${priceMode === 'group' ? 'bg-white text-[#17181A] shadow-xs' : 'text-[#8E8F92]'}`}
                  >
                    Groupe ({nbPersonnes} pers.)
                  </button>
                </div>
              </div>

              {priceMode === 'person' ? (
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm text-[#8E8F92]">€</span>
                  <input
                    id="quick-capture-price"
                    type="number"
                    step="0.5"
                    min="0"
                    value={formData.cout_par_personne}
                    onChange={(e) => handlePersonPriceChange(e.target.value)}
                    placeholder="0"
                    className="w-full pl-8 pr-3.5 py-2.5 bg-[#FAF9F5] border border-[#E2E0D8] rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3F7A55] focus:border-transparent transition-all"
                  />
                </div>
              ) : (
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm text-[#8E8F92]">€</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={groupPriceInput}
                    onChange={(e) => handleGroupPriceChange(e.target.value)}
                    placeholder="Prix pour tout le groupe"
                    className="w-full pl-8 pr-3.5 py-2.5 bg-[#FAF9F5] border border-[#E2E0D8] rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3F7A55] focus:border-transparent transition-all"
                  />
                </div>
              )}
              <p className="text-[11px] text-[#8E8F92] mt-1">
                Coût total estimé : <strong className="text-[#17181A]">{coutTotalEstime.toFixed(2)} €</strong> ({formData.cout_par_personne || 0} € × {nbPersonnes} pers.)
              </p>
            </div>

            {/* Durée estimée en minutes avec presets */}
            <div>
              <label className="block text-xs font-bold text-[#17181A] mb-1.5">
                Durée estimée (minutes)
              </label>
              <div className="relative">
                <Clock size={16} className="absolute left-3.5 top-3 text-[#8E8F92]" />
                <input
                  id="quick-capture-duration"
                  type="number"
                  step="15"
                  min="0"
                  value={formData.duree_min}
                  onChange={(e) => handleChange('duree_min', e.target.value)}
                  placeholder="Ex: 90"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-[#FAF9F5] border border-[#E2E0D8] rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3F7A55] focus:border-transparent transition-all"
                />
              </div>
              {/* Presets rapides de durée */}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {[30, 60, 90, 120, 180, 240].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => handleChange('duree_min', mins)}
                    className="px-2 py-0.5 bg-[#F1F0ED] hover:bg-[#E2E0D8] text-[10px] font-semibold text-[#17181A] rounded transition-colors"
                  >
                    {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#17181A] mb-1.5">
                Horaires d'ouverture
              </label>
              <input
                id="quick-capture-hours"
                type="text"
                value={formData.horaires_ouverture}
                onChange={(e) => handleChange('horaires_ouverture', e.target.value)}
                placeholder="Ex: 09:00 - 18:00 (dernière entrée 17h)"
                className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-[#E2E0D8] rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3F7A55] focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#17181A] mb-1.5">
                Jours de fermeture
              </label>
              <input
                id="quick-capture-closing-days"
                type="text"
                value={formData.jours_fermeture}
                onChange={(e) => handleChange('jours_fermeture', e.target.value)}
                placeholder="Ex: Lundi, 25 décembre"
                className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-[#E2E0D8] rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3F7A55] focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Note d'intérêt (1 à 5 étoiles) */}
            <div>
              <label className="block text-xs font-bold text-[#17181A] mb-1.5">
                Note d'intérêt (1 à 5)
              </label>
              <div className="flex items-center gap-1.5 py-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => handleChange('note_interet', star)}
                    className="p-1 text-[#E2E0D8] hover:text-[#B9862F] transition-colors focus:outline-none"
                  >
                    <Star
                      size={22}
                      className={star <= (formData.note_interet || 0) ? 'text-[#B9862F] fill-[#B9862F]' : ''}
                    />
                  </button>
                ))}
                <span className="text-xs font-semibold text-[#8E8F92] ml-2">
                  {formData.note_interet ? `${formData.note_interet} / 5` : 'Non noté'}
                </span>
              </div>
            </div>

            {/* Statut de réservation */}
            <div>
              <label className="block text-xs font-bold text-[#17181A] mb-1.5">
                Statut de réservation
              </label>
              <select
                id="quick-capture-status"
                value={formData.statut}
                onChange={(e) => handleChange('statut', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-[#E2E0D8] rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3F7A55] focus:border-transparent transition-all"
              >
                {STATUTS_RESERVATION.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 3 : Liens & Description */}
        <div className="space-y-4 pt-4 border-t border-[#E2E0D8]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#8E8F92] flex items-center gap-1.5">
            <FileText size={14} className="text-[#3F7A55]" />
            3. Liens & Description
          </h3>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-[#17181A]">
                Lien source (URL)
              </label>
              {formData.url_source && (
                <a
                  href={formData.url_source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-[#395E8C] hover:underline flex items-center gap-1"
                >
                  <ExternalLink size={12} />
                  Ouvrir la page source dans un nouvel onglet
                </a>
              )}
            </div>
            <div className="relative">
              <LinkIcon size={16} className="absolute left-3.5 top-3 text-[#8E8F92]" />
              <input
                id="quick-capture-url"
                type="url"
                value={formData.url_source}
                onChange={(e) => handleChange('url_source', e.target.value)}
                placeholder="https://..."
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#FAF9F5] border border-[#E2E0D8] rounded-xl text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3F7A55] focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#17181A] mb-1.5">
              Description complète / Programme
            </label>
            <textarea
              id="quick-capture-description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Détails de l'activité, programme, points forts repérés..."
              rows={4}
              className="w-full p-3 bg-[#FAF9F5] border border-[#E2E0D8] rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3F7A55] focus:border-transparent transition-all"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#17181A] mb-1.5">
                Remarques & Conseils pratiques
              </label>
              <textarea
                id="quick-capture-remarks"
                value={formData.remarques}
                onChange={(e) => handleChange('remarques', e.target.value)}
                placeholder="Ex: Prévoir des chaussures de marche, réservation requise 48h à l'avance..."
                rows={3}
                className="w-full p-3 bg-[#FAF9F5] border border-[#E2E0D8] rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3F7A55] focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#17181A] mb-1.5">
                Avis utilisateurs & Synthèse
              </label>
              <textarea
                id="quick-capture-reviews"
                value={formData.avis_utilisateurs}
                onChange={(e) => handleChange('avis_utilisateurs', e.target.value)}
                placeholder="Ex: 4.8/5 sur 320 avis. Les utilisateurs recommandent d'y aller le matin pour éviter la foule..."
                rows={3}
                className="w-full p-3 bg-[#FAF9F5] border border-[#E2E0D8] rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3F7A55] focus:border-transparent transition-all"
              />
            </div>
          </div>
        </div>

        {/* Section 4 : Tags & Mots-clés */}
        <div className="space-y-4 pt-4 border-t border-[#E2E0D8]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#8E8F92] flex items-center gap-1.5">
            <TagIcon size={14} className="text-[#3F7A55]" />
            4. Tags & Mots-clés
          </h3>
          <TagInput
            tripId={tripId}
            selectedTags={selectedTags}
            onTagsChange={setSelectedTags}
          />
        </div>

        {/* Section 5 : Galerie Photos & Documents (Glisser-Déposer Direct) */}
        <div className="space-y-4 pt-4 border-t border-[#E2E0D8]">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#8E8F92] flex items-center gap-1.5">
              <ImageIcon size={14} className="text-[#3F7A55]" />
              5. Galerie & Photos (Glisser-Déposer Direct)
            </h3>
            <span className="text-xs text-[#8E8F92]">
              {pendingFiles.length} fichier(s) en attente
            </span>
          </div>

          <p className="text-xs text-[#8E8F92]">
            Glissez-déposez vos photos directement depuis la page web ouverte ou vos dossiers locaux. La première image devient automatiquement la photo principale de la fiche.
          </p>

          <DocumentUploader
            activityId={null}
            documents={[]}
            pendingFiles={pendingFiles}
            onPendingFilesChange={setPendingFiles}
          />
        </div>

        {/* Section 6 : Boutons d'Action & Soumission */}
        <div className="pt-6 border-t border-[#E2E0D8] flex flex-col sm:flex-row items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleResetForm}
            className="w-full sm:w-auto px-5 py-2.5 bg-[#F1F0ED] hover:bg-[#E2E0D8] text-[#17181A] text-sm font-semibold rounded-xl transition-colors"
          >
            Réinitialiser
          </button>

          <button
            id="quick-capture-submit"
            type="submit"
            disabled={loading || !formData.titre.trim()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-[#3F7A55] hover:bg-[#2D583D] text-white text-sm font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Enregistrement en cours...
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                Enregistrer dans la pile "À valider"
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
