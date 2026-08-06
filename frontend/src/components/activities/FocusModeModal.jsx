/**
 * Mode Focus séquentiel — Validation fiche par fiche.
 * Conforme à PRD_ecran1_creation.md (US-4, US-6, US-7, US-10) et docs/DESIGN.md.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  X, Check, Trash2, ExternalLink, MapPin, Clock, Star,
  Tag as TagIcon, Sparkles, AlertCircle, ChevronLeft, ChevronRight,
  Compass, Euro, FileText, Image as ImageIcon, Upload, Plus
} from 'lucide-react';
import TagInput from './TagInput';
import { getPhotoUrl } from '../../utils/imageUtils';

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
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef(null);

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
      setSelectedPhotoPreview(null);
    }
  }, [currentIndex, pendingActivities, destinations]);

  if (!isOpen) return null;

  const currentActivity = pendingActivities[currentIndex];
  const totalCount = pendingActivities.length;

  // Liste des photos rattachées à la fiche
  const activityPhotos = (currentActivity?.documents || []).filter(
    (d) => d.type_fichier === 'photo'
  );

  const activePhotoSrc =
    selectedPhotoPreview ||
    currentActivity?.photo_principale ||
    (activityPhotos[0] ? activityPhotos[0].chemin_fichier : null);

  const getSourceHost = (url) => {
    try {
      if (!url) return '';
      const parsed = new URL(url);
      return parsed.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  // Upload manuel de fichier(s) image local
  const handlePhotoUpload = async (files) => {
    if (!currentActivity?.id || !files || files.length === 0) return;
    try {
      setUploadingPhoto(true);
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const form = new FormData();
        form.append('file', file);
        form.append('libelle', file.name);
        form.append('type_source', 'upload_manuel');
        const res = await fetch(`/api/activities/${currentActivity.id}/documents`, {
          method: 'POST',
          body: form
        });
        if (res.ok) {
          const newDoc = await res.json();
          setPendingActivities((prev) =>
            prev.map((act, idx) => {
              if (idx === currentIndex) {
                const updatedDocs = [...(act.documents || []), newDoc];
                const main = act.photo_principale || newDoc.chemin_fichier;
                return { ...act, documents: updatedDocs, photo_principale: main };
              }
              return act;
            })
          );
          setSelectedPhotoPreview(newDoc.chemin_fichier);
        }
      }
      showFeedback("📸 Photo(s) ajoutée(s) avec succès !");
    } catch (err) {
      console.error("Erreur lors de l'upload photo:", err);
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Drag and Drop Universel : accepte les fichiers de l'ordinateur ET les images glissées depuis un autre onglet web
  const handleUniversalDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (!currentActivity?.id) return;

    // 1. Cas fichier local glissé
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        await handlePhotoUpload(imageFiles);
        return;
      }
    }

    // 2. Cas image glissée depuis une page web
    const urls = [];
    const uriList = e.dataTransfer.getData('text/uri-list');
    if (uriList) {
      const lines = uriList.split(/\r?\n/).map(s => s.trim()).filter(s => s.startsWith('http'));
      urls.push(...lines);
    }

    const htmlData = e.dataTransfer.getData('text/html');
    if (htmlData) {
      const imgMatches = [...htmlData.matchAll(/src=["'](https?:\/\/[^"']+)["']/gi)];
      for (const match of imgMatches) {
        if (match[1] && !urls.includes(match[1])) {
          urls.push(match[1]);
        }
      }
    }

    const plainText = e.dataTransfer.getData('text/plain');
    if (plainText && plainText.startsWith('http') && !urls.includes(plainText.trim())) {
      urls.push(plainText.trim());
    }

    if (urls.length > 0) {
      setUploadingPhoto(true);
      for (const url of urls) {
        try {
          const res = await fetch(`/api/activities/${currentActivity.id}/documents/from-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, libelle: 'Photo glissée' })
          });
          if (res.ok) {
            const newDoc = await res.json();
            setPendingActivities((prev) =>
              prev.map((act, idx) => {
                if (idx === currentIndex) {
                  const updatedDocs = [...(act.documents || []), newDoc];
                  const main = act.photo_principale || newDoc.chemin_fichier;
                  return { ...act, documents: updatedDocs, photo_principale: main };
                }
                return act;
              })
            );
            setSelectedPhotoPreview(newDoc.chemin_fichier);
          }
        } catch (err) {
          console.error("Erreur lors de l'ajout de l'image glissée:", err);
        }
      }
      setUploadingPhoto(false);
      showFeedback(`📸 ${urls.length > 1 ? `${urls.length} photos ajoutées` : 'Photo ajoutée'} par glisser-déposer !`);
    }
  };

  // Définir une photo comme couverture principale
  const handleSetMainPhoto = async (docId, chemin) => {
    try {
      if (docId) {
        await fetch(`/api/documents/${docId}/main`, { method: 'PATCH' });
      }
      setPendingActivities((prev) =>
        prev.map((act, idx) => {
          if (idx === currentIndex) {
            return { ...act, photo_principale: chemin };
          }
          return act;
        })
      );
      setSelectedPhotoPreview(chemin);
      showFeedback("⭐ Définie comme photo principale !");
    } catch (err) {
      console.error("Erreur définition photo principale:", err);
    }
  };

  // Supprimer un document photo
  const handleDeletePhoto = async (docId, chemin) => {
    try {
      if (docId) {
        await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
      }
      setPendingActivities((prev) =>
        prev.map((act, idx) => {
          if (idx === currentIndex) {
            const docs = (act.documents || []).filter(d => d.id !== docId && d.chemin_fichier !== chemin);
            const newMain = act.photo_principale === chemin ? (docs[0]?.chemin_fichier || null) : act.photo_principale;
            return { ...act, documents: docs, photo_principale: newMain };
          }
          return act;
        })
      );
      setSelectedPhotoPreview(null);
      showFeedback("🗑️ Photo retirée");
    } catch (err) {
      console.error("Erreur suppression photo:", err);
    }
  };

  // Action : Valider la fiche courante (avec ou sans modifications)
  const handleValidate = async () => {
    if (!currentActivity) return;
    try {
      setSaving(true);
      const validTagIds = (formData.tags || [])
        .map((t) => (typeof t === 'object' ? t?.id : t))
        .filter((id) => typeof id === 'number' && !isNaN(id));

      const payload = {
        titre: formData.titre,
        destination_id: Number(formData.destination_id) || currentActivity.destination_id,
        categorie_id: formData.categorie_id ? Number(formData.categorie_id) : null,
        type_element: formData.type_element,
        adresse: formData.adresse,
        zone_geo: formData.zone_geo,
        cout_par_personne: parseFloat(formData.cout_par_personne) || 0,
        duree_min: parseInt(formData.duree_min) || null,
        note_interet: Number(formData.note_interet) || 3,
        description: formData.description,
        remarques: formData.remarques,
        tag_ids: validTagIds
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
      <div className="relative w-full max-w-6xl max-h-[94vh] bg-white rounded-[28px] border border-[#E6E4DF] shadow-2xl flex flex-col overflow-hidden">
        {/* Header Modal Focus Mode */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#E6E4DF] bg-[#FAF3E7]">
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
                Examinez les photos, ajustez les informations et validez la fiche
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

        {/* Corps principal en 2 colonnes */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
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
            <div className="space-y-4">
              {/* Bannière supérieure compacte : Source & Complétude */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F7F6F3] px-4 py-2.5 rounded-[16px] border border-[#E6E4DF]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white text-[#17181A] shadow-xs">
                    {currentActivity.source === 'scraping_auto'
                      ? '🤖 Scraping auto (GetYourGuide)'
                      : currentActivity.source === 'claude_chrome'
                      ? '⚡ Claude for Chrome'
                      : '✏️ Création manuelle'}
                  </span>
                  {currentActivity.url_source && (
                    <a
                      href={currentActivity.url_source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#EDEBE6] hover:bg-[#D6F84C] hover:text-[#17181A] text-[#17181A] transition-all group"
                      title="Ouvrir la page GetYourGuide dans un nouvel onglet"
                    >
                      <ExternalLink size={12} className="text-[#55565A] group-hover:text-[#17181A]" />
                      <span>Ouvrir la page source ({getSourceHost(currentActivity.url_source)})</span>
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-2 text-[12px] text-[#55565A]">
                  <span>Complétude :</span>
                  <div className="w-16 bg-[#E6E4DF] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#3F7A55] h-full transition-all"
                      style={{ width: `${currentActivity.completude || 0}%` }}
                    />
                  </div>
                  <span className="font-bold font-tabular text-[#17181A]">
                    {currentActivity.completude || 0}%
                  </span>
                </div>
              </div>

              {/* Grille principale 2 colonnes : Galerie à gauche, Formulaire à droite */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                
                {/* COLONNE GAUCHE (5 cols) : Galerie Photos & Drag & Drop Universel */}
                <div className="lg:col-span-5 space-y-3">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingOver(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setIsDraggingOver(false);
                    }}
                    onDrop={handleUniversalDrop}
                    className={`relative bg-[#FAF9F5] rounded-[22px] border-2 transition-all p-3.5 space-y-3 ${
                      isDraggingOver
                        ? 'border-[#D6F84C] bg-[#FAF3E7] ring-4 ring-[#D6F84C]/30 scale-[1.01]'
                        : 'border-[#E6E4DF]'
                    }`}
                  >
                    {/* Overlay Drag Active */}
                    {isDraggingOver && (
                      <div className="absolute inset-0 z-20 bg-[#17181A]/85 backdrop-blur-xs rounded-[20px] flex flex-col items-center justify-center text-white gap-2 p-4 animate-fade-in pointer-events-none">
                        <div className="w-12 h-12 rounded-full bg-[#D6F84C] text-[#17181A] flex items-center justify-center shadow-lg">
                          <Upload size={24} strokeWidth={2.5} />
                        </div>
                        <p className="text-[15px] font-extrabold text-[#D6F84C]">
                          Déposez les photos ici !
                        </p>
                        <p className="text-[12px] text-white/80">
                          Image web ou fichier de votre ordinateur
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ImageIcon size={16} className="text-[#17181A]" />
                        <h3 className="text-[12px] font-bold uppercase tracking-wider text-[#17181A]">
                          Galerie Photos ({activityPhotos.length})
                        </h3>
                      </div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handlePhotoUpload(e.target.files)}
                      />
                      <button
                        type="button"
                        disabled={uploadingPhoto}
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-[#E6E4DF] hover:border-[#17181A] text-[11px] font-bold text-[#17181A] shadow-xs transition-colors"
                      >
                        <Upload size={12} />
                        <span>{uploadingPhoto ? 'Ajout...' : 'Fichier image'}</span>
                      </button>
                    </div>

                    {/* Vitrine photo active */}
                    {activePhotoSrc ? (
                      <div className="relative w-full h-52 sm:h-56 rounded-[16px] overflow-hidden bg-black/5 border border-[#E6E4DF] shadow-inner group">
                        <img
                          src={getPhotoUrl(activePhotoSrc)}
                          alt={formData.titre}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80';
                          }}
                        />
                        {currentActivity.avis_utilisateurs && (
                          <div className="absolute bottom-2.5 left-2.5 bg-[#17181A]/85 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-lg">
                            <Star size={13} className="text-[#D6F84C] fill-[#D6F84C]" />
                            <span>{currentActivity.avis_utilisateurs}</span>
                          </div>
                        )}
                        {/* Badge couverture principale */}
                        {currentActivity.photo_principale === activePhotoSrc && (
                          <div className="absolute top-2.5 left-2.5 bg-[#D6F84C] text-[#17181A] text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-md">
                            ★ Couverture
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-44 rounded-[16px] border-2 border-dashed border-[#D5D3CD] hover:border-[#17181A] bg-white flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors p-3 text-center"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#FAF3E7] text-[#17181A] flex items-center justify-center">
                          <ImageIcon size={16} />
                        </div>
                        <p className="text-[12px] font-bold text-[#17181A]">
                          Glissez vos photos ici
                        </p>
                        <p className="text-[11px] text-[#55565A]">
                          depuis GetYourGuide ou votre ordinateur
                        </p>
                      </div>
                    )}

                    {/* Carrousel de miniatures avec actions de gestion */}
                    {activityPhotos.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 overflow-x-auto py-1">
                          {activityPhotos.map((photo, idx) => {
                            const isSelected = activePhotoSrc === photo.chemin_fichier;
                            const isMain = currentActivity.photo_principale === photo.chemin_fichier;
                            return (
                              <div
                                key={photo.id || idx}
                                className={`group relative flex-shrink-0 w-16 h-12 rounded-[10px] overflow-hidden border-2 transition-all ${
                                  isSelected ? 'border-[#17181A] scale-105 shadow-md' : 'border-transparent opacity-80 hover:opacity-100'
                                }`}
                              >
                                <img
                                  src={getPhotoUrl(photo.chemin_fichier)}
                                  alt=""
                                  onClick={() => setSelectedPhotoPreview(photo.chemin_fichier)}
                                  className="w-full h-full object-cover cursor-pointer"
                                />
                                {isMain && (
                                  <div className="absolute top-0.5 left-0.5 bg-[#D6F84C] text-[#17181A] rounded-full p-0.5">
                                    <Star size={8} className="fill-[#17181A]" />
                                  </div>
                                )}
                                {/* Overlay actions au survol */}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                  {!isMain && (
                                    <button
                                      type="button"
                                      onClick={() => handleSetMainPhoto(photo.id, photo.chemin_fichier)}
                                      className="p-1 rounded bg-[#D6F84C] text-[#17181A] hover:scale-110 transition-transform"
                                      title="Définir comme photo principale"
                                    >
                                      <Star size={10} className="fill-[#17181A]" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDeletePhoto(photo.id, photo.chemin_fichier)}
                                    className="p-1 rounded bg-[#B4472F] text-white hover:scale-110 transition-transform"
                                    title="Supprimer cette photo"
                                  >
                                    <Trash2 size={10} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Zone Drop directe & Champ URL */}
                    <div className="pt-1">
                      <div className="border border-dashed border-[#D5D3CD] rounded-[14px] p-2.5 bg-white/70 hover:bg-white transition-colors text-center">
                        <p className="text-[11px] font-bold text-[#17181A]">
                          ⚡ Glissez-déposez n'importe quelle photo depuis l'onglet GetYourGuide
                        </p>
                        <p className="text-[10px] text-[#8E8F92] mt-0.5">
                          Prenez une image sur la page web voisine et lâchez-la dans cette zone
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* COLONNE DROITE (7 cols) : Formulaire complet & Description */}
                <div className="lg:col-span-7 space-y-3.5">
                  {/* Titre */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#55565A] mb-1">
                      Titre de la fiche *
                    </label>
                    <input
                      type="text"
                      value={formData.titre}
                      onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                      className="w-full px-3.5 py-2 bg-[#F7F6F3] rounded-[12px] border border-transparent focus:border-[#17181A] focus:bg-white text-[14px] font-bold text-[#17181A] outline-none"
                    />
                  </div>

                  {/* Destination & Catégorie */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#55565A] mb-1">
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
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#55565A] mb-1">
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

                  {/* Zone géo & Type d'élément */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#55565A] mb-1">
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
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#55565A] mb-1">
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

                  {/* Prix & Durée */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#55565A] mb-1">
                        Prix / pers. (€) • Total : <span className="text-[#17181A] font-extrabold">{coutTotal.toFixed(0)} €</span>
                      </label>
                      <div className="relative">
                        <Euro size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8F92]" />
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={formData.cout_par_personne}
                          onChange={(e) => setFormData({ ...formData, cout_par_personne: e.target.value })}
                          className="w-full pl-8 pr-3 py-2 bg-[#F7F6F3] rounded-[12px] border border-transparent focus:border-[#17181A] text-[13px] font-bold text-[#17181A] font-tabular outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#55565A] mb-1">
                        Durée estimée (min)
                      </label>
                      <div className="relative">
                        <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8F92]" />
                        <input
                          type="number"
                          step="15"
                          min="15"
                          value={formData.duree_min}
                          onChange={(e) => setFormData({ ...formData, duree_min: e.target.value })}
                          className="w-full pl-8 pr-3 py-2 bg-[#F7F6F3] rounded-[12px] border border-transparent focus:border-[#17181A] text-[13px] font-bold text-[#17181A] font-tabular outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Note d'intérêt & Tags */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#55565A] mb-1">
                        Note d'intérêt
                      </label>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setFormData({ ...formData, note_interet: star })}
                            className="p-0.5 rounded hover:bg-[#F7F6F3] transition-colors"
                          >
                            <Star
                              size={18}
                              className={
                                star <= formData.note_interet
                                  ? 'text-[#B9862F] fill-[#B9862F]'
                                  : 'text-[#E6E4DF]'
                              }
                            />
                          </button>
                        ))}
                        <span className="text-[11px] font-bold text-[#55565A] ml-1">
                          {formData.note_interet === 5 ? '⭐ Incontournable' : `${formData.note_interet}/5`}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#55565A] mb-1">
                        Tags thématiques
                      </label>
                      <TagInput
                        tripId={tripId}
                        selectedTags={formData.tags}
                        onChange={(newTags) => setFormData({ ...formData, tags: newTags })}
                      />
                    </div>
                  </div>

                  {/* Description enrichie & Informations avec bouton Coller */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-[#55565A]">
                        Description & Informations
                      </label>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const text = await navigator.clipboard.readText();
                            if (text && text.trim()) {
                              setFormData((prev) => ({ ...prev, description: text.trim() }));
                              showFeedback("📋 Description collée depuis le presse-papier !");
                            }
                          } catch (err) {
                            console.warn("Impossible de lire le presse-papier automatiquement:", err);
                          }
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#3F7A55] hover:text-[#17181A] transition-colors"
                        title="Coller le texte copié depuis la page GetYourGuide"
                      >
                        <span>📋 Coller le texte copié</span>
                      </button>
                    </div>
                    <textarea
                      rows={6}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Présentation de l'activité, points forts, conseils pratiques..."
                      className="w-full px-3 py-2.5 bg-[#F7F6F3] rounded-[12px] border border-transparent focus:border-[#17181A] text-[12px] leading-relaxed text-[#17181A] outline-none resize-none font-sans"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions (Rejeter vs Valider) */}
        {totalCount > 0 && currentActivity && (
          <div className="px-6 py-3.5 bg-[#F7F6F3] border-t border-[#E6E4DF] flex items-center justify-between">
            {/* Bouton Rejeter */}
            <button
              type="button"
              disabled={saving}
              onClick={handleReject}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[#B4472F] hover:bg-[#B4472F]/10 text-[13px] font-bold transition-colors disabled:opacity-50"
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


