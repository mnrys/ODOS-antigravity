import React, { memo } from 'react';
import { Clock, Euro, Trash2, CalendarCheck, Star, Eye, Edit3, Tag } from 'lucide-react';
import { getPhotoUrl } from '../../utils/imageUtils';

/**
 * Nœud personnalisé de fiche activité pour le canvas de l'Atelier.
 * Conforme à PRD_ecran2_atelier.md (US-1, US-7, US-8, US-9, US-10) et docs/DESIGN.md.
 */
function ActivityCardNode({ data, selected }) {
  const {
    id,
    titre,
    categorie_nom,
    categorie_couleur = '#8E8F92',
    type_element = 'activite',
    cout_par_personne = 0,
    cout_total = 0,
    duree_min,
    note_interet,
    photo_principale,
    description,
    remarques,
    tags = [],
    zone_geo,
    est_placée = false,
    isActive = false,
    onSelect,
    onPreview,
    onEdit,
    onTrash
  } = data;

  const isHighlighted = isActive || selected;

  const formatDuration = (mins) => {
    if (!mins) return null;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h${m.toString().padStart(2, '0')}`;
    if (h > 0) return `${h}h`;
    return `${mins}m`;
  };

  const handleClick = (e) => {
    if (onSelect) onSelect(id);
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (onPreview) {
      onPreview(data);
    } else if (onEdit) {
      onEdit(data);
    }
  };

  const handlePreviewClick = (e) => {
    e.stopPropagation();
    if (onSelect) onSelect(id);
    if (onPreview) {
      onPreview(data);
    } else if (onEdit) {
      onEdit(data);
    }
  };

  const handleTrashClick = (e) => {
    e.stopPropagation();
    if (onTrash) onTrash(id);
  };

  const handleDragStart = (e) => {
    // Permet le glisser-déposer natif depuis l'atelier vers le panneau latéral Planning
    e.dataTransfer.setData(
      'text/plain',
      JSON.stringify({
        type: 'activity',
        activity_id: id,
        id: id,
        titre: titre,
        duree_min: duree_min || 60,
        cout_par_personne: cout_par_personne || 0,
        categorie_couleur: categorie_couleur,
        categorie_nom: categorie_nom
      })
    );
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const imageUrl = getPhotoUrl(photo_principale);

  return (
    <div
      draggable="true"
      onDragStart={handleDragStart}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={`w-[320px] rounded-2xl bg-white border transition-all duration-200 select-none cursor-grab active:cursor-grabbing relative overflow-hidden transform hover:-translate-y-1 hover:shadow-xl active:-rotate-[1deg] ${
        isHighlighted
          ? 'ring-2 ring-[#3F7A55] border-[#3F7A55] shadow-xl shadow-[#3F7A55]/10'
          : 'border-[#E6E4DF] shadow-xs hover:border-[#8E8F92]'
      } ${
        est_placée
          ? 'opacity-50 hover:opacity-85 bg-[#FAF9F7] border-dashed border-[#8E8F92]/70 shadow-none'
          : ''
      }`}
    >
      {/* Liseré supérieur si carte sélectionnée */}
      {isHighlighted && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-[#3F7A55]" />
      )}

      {/* 1. En-tête : Catégorie, Note, Actions rapides */}
      <div className={`px-3 py-2 flex items-center justify-between border-b gap-1.5 ${
        isHighlighted ? 'bg-[#3F7A55]/10 border-[#3F7A55]/20' : 'bg-[#FAF9F7] border-[#E6E4DF]'
      }`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: categorie_couleur }}
          />
          <span className="text-[11px] font-extrabold tracking-tight truncate text-[#17181A]">
            {categorie_nom || "Sans catégorie"}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {note_interet ? (
            <span className="text-[11px] font-bold text-[#B9862F] flex items-center mr-1">
              ★ {note_interet}
            </span>
          ) : null}

          {/* Bouton Voir détails / Prévisualiser */}
          <button
            type="button"
            onClick={handlePreviewClick}
            className="p-1 rounded-lg text-[#55565A] hover:text-[#17181A] hover:bg-white transition-colors"
            title="Consulter les détails de la fiche (double-clic)"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>

          {/* Bouton corbeille bien visible */}
          <button
            type="button"
            onClick={handleTrashClick}
            className="p-1 rounded-lg text-[#8E8F92] hover:text-[#C95D4E] hover:bg-[#FAF0EE] transition-colors"
            title="Mettre cette fiche à la corbeille"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Corps de la carte avec miniature agrandie (112x112px) et extrait */}
      <div className="p-3 space-y-2.5">
        <div className="flex gap-3">
          {/* Miniature photo agrandie (au moins le double : 112x112 px) */}
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              className="w-28 h-28 rounded-xl object-cover border border-[#E6E4DF] shrink-0 cursor-pointer shadow-2xs hover:brightness-105 transition-all"
              onClick={handlePreviewClick}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div
              className="w-28 h-28 rounded-xl shrink-0 flex items-center justify-center text-white text-lg font-extrabold cursor-pointer shadow-2xs"
              style={{ backgroundColor: categorie_couleur }}
              onClick={handlePreviewClick}
            >
              {titre ? titre.substring(0, 2).toUpperCase() : 'OD'}
            </div>
          )}

          <div className="min-w-0 flex-1 flex flex-col justify-between">
            <div>
              {/* Titre cliquable pour voir les détails */}
              <h4
                onClick={handlePreviewClick}
                className="text-xs font-extrabold text-[#17181A] line-clamp-2 leading-tight tracking-tight hover:text-[#3F7A55] cursor-pointer"
                title="Cliquer pour voir la fiche détaillée"
              >
                {titre}
              </h4>

              {zone_geo && (
                <span className="inline-block text-[9px] font-extrabold text-[#3F7A55] mt-1 bg-[#EBF5EE] border border-[#CDE5D4] px-1.5 py-0.5 rounded uppercase">
                  Zone {zone_geo}
                </span>
              )}
            </div>

            {/* Extrait concis de description ou remarques */}
            {(description || remarques) && (
              <p className="text-[10px] text-[#55565A] line-clamp-2 leading-snug italic bg-[#F7F6F3] p-1.5 rounded-lg border border-[#E6E4DF]/60 mt-1">
                {description || remarques}
              </p>
            )}
          </div>
        </div>

        {/* Tags badges légers */}
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 3).map((t) => (
              <span
                key={t.id || t.nom}
                className="inline-flex items-center gap-0.5 text-[9px] font-bold text-[#55565A] bg-[#EDEBE6] px-1.5 py-0.2 rounded"
              >
                #{t.nom}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="text-[9px] text-[#8E8F92] font-bold">
                +{tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* 3. Métadonnées : Durée & Prix */}
        <div className="pt-1.5 flex items-center justify-between text-[11px] text-[#55565A] border-t border-[#E6E4DF]">
          <div className="flex items-center gap-1 font-semibold text-[#55565A]">
            {duree_min && (
              <>
                <Clock className="w-3 h-3 text-[#8E8F92]" />
                <span>{formatDuration(duree_min)}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1 font-bold text-[#17181A]">
            <Euro className="w-3 h-3 text-[#3F7A55]" />
            <span>{cout_par_personne > 0 ? `${cout_par_personne.toFixed(0)} €` : 'Gratuit'}</span>
            {cout_par_personne > 0 && cout_total > 0 && (
              <span className="text-[10px] font-normal text-[#8E8F92]">
                (tot. {cout_total.toFixed(0)}€)
              </span>
            )}
          </div>
        </div>

        {/* 4. Barre inférieure : Statut Placé & Bouton Détails */}
        <div className="pt-1 flex items-center justify-between gap-2">
          {est_placée ? (
            <div className="flex-1 flex items-center justify-center gap-1.5 py-1 bg-[#EBF5EE] text-[#3F7A55] border border-[#CDE5D4] rounded-lg text-[10px] font-extrabold uppercase tracking-wide">
              <CalendarCheck className="w-3.5 h-3.5" />
              <span>Placée dans le planning</span>
            </div>
          ) : (
            <div className="flex-1" />
          )}

          <button
            type="button"
            onClick={handlePreviewClick}
            className="px-2.5 py-1 rounded-lg bg-[#F7F6F3] hover:bg-[#17181A] text-[#55565A] hover:text-white text-[10px] font-extrabold flex items-center gap-1 transition-all shrink-0"
            title="Consulter les détails de l'activité"
          >
            <Eye className="w-3 h-3" />
            <span>Détails</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(ActivityCardNode);

