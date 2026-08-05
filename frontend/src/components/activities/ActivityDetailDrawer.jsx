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
  Trash2,
  CheckCircle2,
  FileText,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Info,
  Layers,
  Plane,
  Home,
  Utensils,
  Compass
} from 'lucide-react';
import { getPhotoUrl } from '../../utils/imageUtils';

/**
 * Panneau latéral de consultation des fiches d'activités (Lecture Seule / Rappel des détails).
 * Affiche la galerie photos, toutes les métadonnées, dates, numéro de référence, description et avis.
 * Comporte un bouton bien mis en avant « ✏️ Modifier cette fiche » pour basculer vers le formulaire d'édition.
 */
export default function ActivityDetailDrawer({
  isOpen,
  onClose,
  activityId,
  activityData: initialData,
  onEdit,
  onDelete,
  onQuickPlace,
  nbPersonnes = 1
}) {
  const [activity, setActivity] = useState(initialData || null);
  const [loading, setLoading] = useState(false);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // Charger les données complètes de l'activité si un ID est fourni
  useEffect(() => {
    if (!isOpen || !activityId) return;

    // Si on a déjà des données complètes passées en prop
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
        console.error('Erreur chargement détails activité:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, [isOpen, activityId, initialData]);

  if (!isOpen || (!activity && !loading)) return null;

  // Extraction de la liste des photos disponibles
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
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md md:max-w-lg bg-white border-l border-[#E6E4DF] shadow-2xl flex flex-col animate-slide-in">
      {/* 1. En-tête */}
      <div className="p-4 border-b border-[#E6E4DF] bg-[#F7F6F3] flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: categoryColor }}
          />
          <div className="min-w-0">
            <span className="text-xs font-extrabold text-[#17181A] truncate block">
              {activity?.categorie_nom || 'Activité'}
            </span>
            {activity?.destination_nom && (
              <span className="text-[11px] text-[#55565A] truncate block">
                Étape : {activity.destination_nom}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onEdit && activity && (
            <button
              type="button"
              onClick={() => onEdit(activity.id)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#17181A] text-white text-xs font-extrabold hover:bg-[#3F7A55] transition-colors shadow-xs"
              title="Modifier les informations de cette fiche"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Modifier</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#55565A] hover:text-[#17181A] hover:bg-[#E6E4DF] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Corps avec défilement */}
      <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-5">
        {loading && !activity ? (
          <div className="py-20 text-center text-xs font-bold text-[#8E8F92]">
            Chargement des détails...
          </div>
        ) : (
          <>
            {/* 2. Galerie de Photos avec aperçu et bande de miniatures */}
            {photos.length > 0 ? (
              <div className="space-y-2">
                <div className="relative rounded-2xl overflow-hidden border border-[#E6E4DF] bg-[#FAF9F7] aspect-video shadow-xs">
                  <img
                    src={getPhotoUrl(photos[activePhotoIdx])}
                    alt={activity.titre}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.opacity = '0.3';
                    }}
                  />

                  {/* Contrôles carrousel si plusieurs photos */}
                  {photos.length > 1 && (
                    <>
                      <button
                        onClick={() =>
                          setActivePhotoIdx((prev) => (prev === 0 ? photos.length - 1 : prev - 1))
                        }
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black transition-colors shadow-md"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          setActivePhotoIdx((prev) => (prev === photos.length - 1 ? 0 : prev + 1))
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black transition-colors shadow-md"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-bold">
                        {activePhotoIdx + 1} / {photos.length}
                      </div>
                    </>
                  )}
                </div>

                {/* Bande de miniatures interactive si plusieurs photos */}
                {photos.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5">
                    {photos.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActivePhotoIdx(idx)}
                        className={`w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                          idx === activePhotoIdx
                            ? 'border-[#17181A] ring-2 ring-[#D6F84C] scale-105'
                            : 'border-[#E6E4DF] opacity-70 hover:opacity-100'
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

            {/* 3. Titre & Statuts */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border"
                  style={{
                    backgroundColor: `${categoryColor}15`,
                    borderColor: `${categoryColor}40`,
                    color: categoryColor
                  }}
                >
                  {activity.type_element || 'Activité'}
                </span>

                {activity.statut === 'reserve' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#EBF5EE] text-[#3F7A55] border border-[#CDE5D4] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Réservé</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#FAF3E7] text-[#B9862F] border border-[#E8D4B0]">
                    À réserver / Option
                  </span>
                )}

                {activity.est_placée && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#EBF5EE] text-[#3F7A55] border border-[#CDE5D4]">
                    Placé au planning
                  </span>
                )}
              </div>

              <h2 className="text-lg md:text-xl font-extrabold text-[#17181A] leading-snug">
                {activity.titre}
              </h2>

              {activity.zone_geo && (
                <div className="flex items-center gap-1 text-xs font-bold text-[#55565A] mt-1">
                  <MapPin className="w-3.5 h-3.5 text-[#8E8F92] shrink-0" />
                  <span>Secteur / Zone : {activity.zone_geo}</span>
                </div>
              )}
            </div>

            {/* 4. Barre récapitulative des chiffres clés (Durée, Budget, Intérêt) */}
            <div className="grid grid-cols-3 gap-2.5 p-3 rounded-2xl bg-[#F7F6F3] border border-[#E6E4DF]">
              <div className="flex flex-col">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#8E8F92] flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#55565A]" />
                  <span>Durée</span>
                </span>
                <span className="text-sm font-extrabold text-[#17181A] mt-0.5">
                  {activity.duree_min ? `${activity.duree_min} min` : 'Non précisée'}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#8E8F92] flex items-center gap-1">
                  <Euro className="w-3 h-3 text-[#55565A]" />
                  <span>Budget Total</span>
                </span>
                <span className="text-sm font-extrabold text-[#17181A] mt-0.5">
                  {coutTotal > 0 ? `${coutTotal} €` : 'Gratuit'}
                </span>
                {activity.cout_par_personne > 0 && (
                  <span className="text-[9px] text-[#8E8F92]">
                    ({activity.cout_par_personne} € / pers.)
                  </span>
                )}
              </div>

              <div className="flex flex-col">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#8E8F92] flex items-center gap-1">
                  <Star className="w-3 h-3 text-[#B9862F]" />
                  <span>Intérêt</span>
                </span>
                <span className="text-sm font-extrabold text-[#17181A] mt-0.5">
                  {activity.note_interet ? `${activity.note_interet} / 5` : '—'}
                </span>
              </div>
            </div>

            {/* 5. Références de réservation & Horaires (Spécifique Vols / Hébergements / Transports) */}
            {(activity.numero_reference ||
              activity.date_debut ||
              activity.horaires_ouverture ||
              activity.adresse) && (
              <div className="p-3.5 rounded-2xl border border-[#E6E4DF] bg-white space-y-2.5 text-xs">
                <h4 className="text-xs font-extrabold text-[#17181A] flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-[#3F7A55]" />
                  <span>Informations pratiques</span>
                </h4>

                {activity.numero_reference && (
                  <div className="flex items-center justify-between py-1 border-b border-[#F2EFEA]">
                    <span className="text-[#55565A] font-medium">N° de référence / Dossier :</span>
                    <span className="font-bold font-mono text-[#17181A] bg-[#F7F6F3] px-2 py-0.5 rounded">
                      {activity.numero_reference}
                    </span>
                  </div>
                )}

                {activity.date_debut && (
                  <div className="flex items-center justify-between py-1 border-b border-[#F2EFEA]">
                    <span className="text-[#55565A] font-medium">Date prévue :</span>
                    <span className="font-bold text-[#17181A]">
                      {new Date(activity.date_debut).toLocaleDateString('fr-FR')}
                      {activity.date_fin &&
                        ` — ${new Date(activity.date_fin).toLocaleDateString('fr-FR')}`}
                    </span>
                  </div>
                )}

                {activity.horaires_ouverture && (
                  <div className="flex items-start justify-between py-1 border-b border-[#F2EFEA]">
                    <span className="text-[#55565A] font-medium">Horaires :</span>
                    <span className="font-bold text-[#17181A] text-right">
                      {activity.horaires_ouverture}
                    </span>
                  </div>
                )}

                {activity.adresse && (
                  <div className="flex items-start justify-between py-1">
                    <span className="text-[#55565A] font-medium">Adresse :</span>
                    <span className="font-bold text-[#17181A] text-right max-w-[200px] truncate">
                      {activity.adresse}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* 6. Description complète */}
            <div>
              <h4 className="text-xs font-extrabold text-[#17181A] mb-1.5">Description</h4>
              <div className="p-3.5 rounded-2xl bg-[#FAF9F7] border border-[#E6E4DF] text-xs text-[#17181A] leading-relaxed whitespace-pre-wrap">
                {activity.description || 'Aucune description rédigée pour cette fiche.'}
              </div>
            </div>

            {/* 7. Remarques / Avis */}
            {activity.remarques && (
              <div>
                <h4 className="text-xs font-extrabold text-[#17181A] mb-1.5">Remarques & Conseils</h4>
                <div className="p-3.5 rounded-2xl bg-[#FFF9F2] border border-[#F5E5D3] text-xs text-[#A4553A] leading-relaxed">
                  {activity.remarques}
                </div>
              </div>
            )}

            {/* 8. Tags Thématiques */}
            {activity.tags && activity.tags.length > 0 && (
              <div>
                <h4 className="text-xs font-extrabold text-[#17181A] mb-1.5">Tags associés</h4>
                <div className="flex flex-wrap gap-1.5">
                  {activity.tags.map((t) => (
                    <span
                      key={t.id}
                      className="px-2.5 py-1 rounded-xl bg-[#F7F6F3] border border-[#E6E4DF] text-xs font-bold text-[#55565A] flex items-center gap-1"
                    >
                      <Tag className="w-3 h-3 text-[#8E8F92]" />
                      <span>{t.nom}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 9. Lien Source Externe */}
            {activity.url_source && (
              <a
                href={activity.url_source}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 rounded-2xl border border-[#E6E4DF] bg-white hover:border-[#17181A] transition-all flex items-center justify-between text-xs font-bold text-[#17181A] group"
              >
                <div className="flex items-center gap-2 truncate">
                  <ExternalLink className="w-4 h-4 text-[#3F7A55] shrink-0" />
                  <span className="truncate">Consulter le site officiel / réservation</span>
                </div>
                <ChevronRight className="w-4 h-4 text-[#8E8F92] group-hover:translate-x-0.5 transition-transform" />
              </a>
            )}
          </>
        )}
      </div>

      {/* 10. Barre d'action inférieure */}
      {activity && (
        <div className="p-4 border-t border-[#E6E4DF] bg-[#F7F6F3] flex items-center justify-between gap-2">
          {onDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete(activity.id);
                onClose();
              }}
              className="p-2.5 rounded-xl border border-[#E8C5BE] bg-[#FAF0EE] text-[#C95D4E] hover:bg-[#C95D4E] hover:text-white transition-colors"
              title="Déplacer vers la corbeille"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <div className="flex-1 flex items-center justify-end gap-2">
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(activity.id);
                }}
                className="flex-1 max-w-[160px] py-2.5 px-3 rounded-xl bg-white border border-[#E6E4DF] text-xs font-extrabold text-[#17181A] hover:border-[#17181A] transition-colors flex items-center justify-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#55565A]" />
                <span>Modifier</span>
              </button>
            )}

            {onQuickPlace && !activity.est_placée && (
              <button
                type="button"
                onClick={() => {
                  onQuickPlace(activity);
                  onClose();
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#17181A] hover:bg-[#3F7A55] text-white text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Placer au planning</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
