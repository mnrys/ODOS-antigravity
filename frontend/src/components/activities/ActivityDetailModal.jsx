/**
 * Composant Modale de Consultation d'une fiche d'activité (Lecture Seule / Plein écran centré).
 * Conforme aux spécifications de la Phase 11 (PRD_ecran1_creation.md - US-13, US-14, US-15).
 *
 * Caractéristiques :
 * - Affichage centré avec fond flou (backdrop-blur-md bg-black/60).
 * - Galerie photos interactive (aperçu principal + bande de miniatures).
 * - Rappel de toutes les informations : durée, budget total / par personne, horaires, adresse, avis tiers.
 * - Bouton discret « ✏️ Modifier » dans l'en-tête et bouton d'action en pied de page pour basculer en édition.
 * - Fermeture possible par la croix (X), le bouton « Fermer », un clic sur le fond flou ou la touche Échap.
 */
import React, { useState, useEffect } from 'react';
import {
  X,
  Edit3,
  Calendar,
  Clock,
  Euro,
  MapPin,
  Tag,
  Star,
  ExternalLink,
  CheckCircle2,
  Info,
  Layers,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { getPhotoUrl } from '../../utils/imageUtils';

export default function ActivityDetailModal({
  isOpen,
  onClose,
  activityId,
  activityData: initialData,
  onEdit,
  nbPersonnes = 1,
}) {
  const [activity, setActivity] = useState(initialData || null);
  const [loading, setLoading] = useState(false);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // Charger les données complètes de l'activité dès l'ouverture
  useEffect(() => {
    if (!isOpen || !activityId) return;

    // Si des données complètes sont déjà passées en prop
    if (initialData && initialData.id === activityId && initialData.description !== undefined) {
      setActivity(initialData);
      setActivePhotoIdx(0);
      return;
    }

    const fetchActivity = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/activities/${activityId}`);
        if (res.ok) {
          const data = await res.json();
          setActivity(data);
          setActivePhotoIdx(0);
        }
      } catch (err) {
        console.error('Erreur chargement détails activité en consultation:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, [isOpen, activityId, initialData]);

  // Fermeture par la touche Échap
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Extraction des photos
  const photos = [];
  if (activity?.documents && activity.documents.length > 0) {
    activity.documents
      .filter((d) => d.type_fichier === 'photo')
      .forEach((d) => photos.push(d.chemin_fichier));
  }
  if (photos.length === 0 && activity?.photo_principale) {
    photos.push(activity.photo_principale);
  }
  if (photos.length === 0 && activity?.photo_url) {
    photos.push(activity.photo_url);
  }

  const categoryColor = activity?.categorie_couleur || '#3F7A55';
  const coutTotal =
    activity?.cout_total !== undefined
      ? activity.cout_total
      : (activity?.cout_par_personne || 0) * nbPersonnes;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        // Clic sur l'arrière-plan flou = fermeture de la modale
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-2xl bg-white rounded-[28px] shadow-2xl border border-brand-border overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
        {/* 1. En-tête de la modale */}
        <div className="px-5 py-4 bg-brand-surface border-b border-brand-border flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="w-3.5 h-3.5 rounded-full shrink-0"
              style={{ backgroundColor: categoryColor }}
            />
            <div className="min-w-0">
              <span className="text-xs font-extrabold text-brand-encre truncate block uppercase tracking-wider">
                {activity?.categorie_nom || 'Activité'}
              </span>
              {activity?.destination_nom && (
                <span className="text-[11px] font-semibold text-brand-secondary truncate block">
                  📍 Destination : {activity.destination_nom}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Bouton discret "Modifier" dans l'en-tête */}
            {onEdit && activity && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(activity);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-encre hover:bg-brand-success text-white text-xs font-bold transition-colors shadow-xs"
                title="Basculer vers le formulaire d'édition complète"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Modifier</span>
              </button>
            )}

            {/* Bouton Croix Fermer */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white hover:bg-brand-border text-brand-secondary hover:text-brand-encre flex items-center justify-center transition-colors shadow-xs"
              title="Fermer la fiche (Échap)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. Corps avec défilement interne propre */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {loading && !activity ? (
            <div className="py-20 text-center text-sm font-bold text-brand-muted">
              Chargement des détails...
            </div>
          ) : activity ? (
            <>
              {/* Galerie photos */}
              {photos.length > 0 ? (
                <div className="space-y-2">
                  <div className="relative rounded-2xl overflow-hidden border border-brand-border bg-brand-surface aspect-video shadow-xs">
                    <img
                      src={getPhotoUrl(photos[activePhotoIdx])}
                      alt={activity.titre}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.opacity = '0.3';
                      }}
                    />

                    {photos.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setActivePhotoIdx((prev) => (prev === 0 ? photos.length - 1 : prev - 1))
                          }
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black transition-colors shadow-md"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setActivePhotoIdx((prev) => (prev === photos.length - 1 ? 0 : prev + 1))
                          }
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black transition-colors shadow-md"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-black/70 text-white text-[11px] font-bold">
                          {activePhotoIdx + 1} / {photos.length}
                        </div>
                      </>
                    )}
                  </div>

                  {photos.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5">
                      {photos.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActivePhotoIdx(idx)}
                          className={`w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                            idx === activePhotoIdx
                              ? 'border-brand-encre ring-2 ring-brand-lime scale-105'
                              : 'border-brand-border opacity-70 hover:opacity-100'
                          }`}
                        >
                          <img
                            src={getPhotoUrl(p)}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="rounded-2xl p-6 flex flex-col items-center justify-center text-white text-center shadow-inner"
                  style={{ backgroundColor: categoryColor }}
                >
                  <Layers className="w-10 h-10 mb-2 opacity-80" />
                  <span className="text-xs font-bold uppercase tracking-wider opacity-90">
                    {activity.categorie_nom || 'Activité'}
                  </span>
                </div>
              )}

              {/* Titre et Badges */}
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span
                    className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide border"
                    style={{
                      backgroundColor: `${categoryColor}15`,
                      borderColor: `${categoryColor}40`,
                      color: categoryColor,
                    }}
                  >
                    {activity.type_element || 'Activité'}
                  </span>

                  {activity.statut === 'reserve' ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#EBF5EE] text-brand-success border border-[#CDE5D4] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Réservé</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#FAF3E7] text-brand-alert border border-[#E8D4B0]">
                      À réserver / Option
                    </span>
                  )}

                  {activity.est_placée && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#EBF5EE] text-brand-success border border-[#CDE5D4]">
                      ✓ Placé au planning
                    </span>
                  )}
                </div>

                <h2 className="text-xl sm:text-2xl font-extrabold text-brand-encre leading-snug">
                  {activity.titre}
                </h2>

                {activity.zone_geo && (
                  <div className="flex items-center gap-1 text-xs font-bold text-brand-secondary mt-1.5">
                    <MapPin className="w-3.5 h-3.5 text-brand-muted shrink-0" />
                    <span>Zone géographique : {activity.zone_geo}</span>
                  </div>
                )}
              </div>

              {/* Chiffres clés (Durée, Budget, Intérêt) */}
              <div className="grid grid-cols-3 gap-2.5 p-3.5 rounded-2xl bg-brand-surface border border-brand-border">
                <div className="flex flex-col">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-muted flex items-center gap-1">
                    <Clock className="w-3 h-3 text-brand-secondary" />
                    <span>Durée</span>
                  </span>
                  <span className="text-sm font-extrabold text-brand-encre mt-0.5">
                    {activity.duree_min ? `${activity.duree_min} min` : 'Non précisée'}
                  </span>
                </div>

                <div className="flex flex-col">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-muted flex items-center gap-1">
                    <Euro className="w-3 h-3 text-brand-secondary" />
                    <span>Budget Total</span>
                  </span>
                  <span className="text-sm font-extrabold text-brand-encre mt-0.5">
                    {coutTotal > 0 ? `${coutTotal} €` : 'Gratuit'}
                  </span>
                  {activity.cout_par_personne > 0 && (
                    <span className="text-[10px] text-brand-muted">
                      ({activity.cout_par_personne} € / pers.)
                    </span>
                  )}
                </div>

                <div className="flex flex-col">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-muted flex items-center gap-1">
                    <Star className="w-3 h-3 text-brand-alert" />
                    <span>Intérêt</span>
                  </span>
                  <span className="text-sm font-extrabold text-brand-encre mt-0.5">
                    {activity.note_interet ? `${activity.note_interet} / 5` : '—'}
                  </span>
                </div>
              </div>

              {/* Informations pratiques */}
              {(activity.numero_reference ||
                activity.date_debut ||
                activity.horaires_ouverture ||
                activity.adresse) && (
                <div className="p-4 rounded-2xl border border-brand-border bg-brand-fond space-y-2.5 text-xs">
                  <h4 className="text-xs font-extrabold text-brand-encre flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-brand-success" />
                    <span>Informations pratiques & Logistique</span>
                  </h4>

                  {activity.numero_reference && (
                    <div className="flex items-center justify-between py-1 border-b border-brand-border">
                      <span className="text-brand-secondary font-medium">N° de réservation :</span>
                      <span className="font-bold font-mono text-brand-encre bg-white px-2 py-0.5 rounded border border-brand-border">
                        {activity.numero_reference}
                      </span>
                    </div>
                  )}

                  {activity.date_debut && (
                    <div className="flex items-center justify-between py-1 border-b border-brand-border">
                      <span className="text-brand-secondary font-medium">Date prévue :</span>
                      <span className="font-bold text-brand-encre">
                        {new Date(activity.date_debut).toLocaleDateString('fr-FR')}
                        {activity.date_fin &&
                          ` — ${new Date(activity.date_fin).toLocaleDateString('fr-FR')}`}
                      </span>
                    </div>
                  )}

                  {activity.horaires_ouverture && (
                    <div className="flex items-start justify-between py-1 border-b border-brand-border">
                      <span className="text-brand-secondary font-medium">Horaires :</span>
                      <span className="font-bold text-brand-encre text-right">
                        {activity.horaires_ouverture}
                      </span>
                    </div>
                  )}

                  {activity.adresse && (
                    <div className="flex items-start justify-between py-1">
                      <span className="text-brand-secondary font-medium">Adresse :</span>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          activity.adresse
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-brand-success hover:underline text-right max-w-[240px] truncate flex items-center gap-1"
                        title="Ouvrir dans Google Maps"
                      >
                        <span>{activity.adresse}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Description complète */}
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-brand-secondary mb-1.5">
                  Description
                </h4>
                <div className="p-4 rounded-2xl bg-white border border-brand-border text-xs text-brand-encre leading-relaxed whitespace-pre-wrap">
                  {activity.description || 'Aucune description rédigée pour cette fiche.'}
                </div>
              </div>

              {/* Synthèse des avis voyageurs (TripAdvisor, GetYourGuide, etc.) */}
              {(activity.avis_utilisateurs || activity.lien_avis_tripadvisor) && (
                <div className="p-4 rounded-2xl bg-[#F0F7F3] border border-[#CDE5D4] space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-[#254A33] flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-brand-success" />
                      <span>Synthèse des avis voyageurs</span>
                    </h4>
                    {activity.rating && (
                      <span className="px-2 py-0.5 rounded-full bg-white text-brand-success text-[11px] font-extrabold border border-[#CDE5D4]">
                        ★ {activity.rating.toFixed(1)} / 5
                      </span>
                    )}
                  </div>

                  {activity.avis_utilisateurs && (
                    <p className="text-xs text-[#254A33] leading-relaxed whitespace-pre-wrap">
                      {activity.avis_utilisateurs}
                    </p>
                  )}

                  {activity.lien_avis_tripadvisor && (
                    <div className="pt-2 border-t border-[#CDE5D4]/60 flex items-center justify-between">
                      <a
                        href={activity.lien_avis_tripadvisor}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-brand-success hover:text-brand-encre inline-flex items-center gap-1 hover:underline transition-colors"
                      >
                        <span>Voir la fiche et les avis sur TripAdvisor</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Remarques & Conseils personnels */}
              {activity.remarques && (
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-cat-gastro mb-1.5">
                    Remarques & Conseils personnels
                  </h4>
                  <div className="p-4 rounded-2xl bg-[#FFF9F2] border border-[#F5E5D3] text-xs text-cat-gastro leading-relaxed whitespace-pre-wrap">
                    {activity.remarques}
                  </div>
                </div>
              )}

              {/* Tags thématiques */}
              {activity.tags && activity.tags.length > 0 && (
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-brand-secondary mb-1.5">
                    Tags associés
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {activity.tags.map((t) => (
                      <span
                        key={t.id}
                        className="px-2.5 py-1 rounded-xl bg-brand-surface border border-brand-border text-xs font-bold text-brand-secondary flex items-center gap-1"
                      >
                        <Tag className="w-3 h-3 text-brand-muted" />
                        <span>#{t.nom}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Lien source officiel */}
              {activity.url_source && (
                <a
                  href={activity.url_source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3.5 rounded-2xl border border-brand-border bg-brand-fond hover:border-brand-encre hover:bg-white transition-all flex items-center justify-between text-xs font-bold text-brand-encre group"
                >
                  <div className="flex items-center gap-2 truncate">
                    <ExternalLink className="w-4 h-4 text-brand-success shrink-0" />
                    <span className="truncate">Consulter le site officiel / réservation</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-brand-muted group-hover:translate-x-0.5 transition-transform" />
                </a>
              )}
            </>
          ) : null}
        </div>

        {/* 3. Pied de page avec actions */}
        <div className="px-5 py-3.5 bg-brand-surface border-t border-brand-border flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-full bg-white hover:bg-brand-border text-brand-encre text-xs font-extrabold border border-brand-border transition-colors shadow-xs"
          >
            Fermer
          </button>

          {onEdit && activity && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(activity);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-encre hover:bg-brand-success text-white text-xs font-extrabold transition-colors shadow-sm"
            >
              <Edit3 className="w-4 h-4" />
              <span>Modifier cette fiche</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
