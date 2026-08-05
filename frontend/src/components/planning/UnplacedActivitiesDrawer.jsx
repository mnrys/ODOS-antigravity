import React, { useState } from 'react';
import { X, Search, Plus, Clock, Euro, MapPin, Tag, ArrowRight, GripVertical } from 'lucide-react';
import { getPhotoUrl } from '../../utils/imageUtils';

/**
 * Tiroir latéral des fiches d'activités disponibles (non encore placées).
 * Supporte le glisser-déposer (HTML5 Drag & Drop) direct vers la grille du Planning,
 * ainsi que le bouton de placement rapide.
 * cf. PRD_ecran3_planning.md (US-16).
 */
export default function UnplacedActivitiesDrawer({
  isOpen,
  onClose,
  unplacedActivities = [],
  destinations = [],
  categories = [],
  currentVisibleDays = [1],
  onQuickPlace,
  onOpenActivityModal
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [selectedDest, setSelectedDest] = useState('');
  const [targetDay, setTargetDay] = useState(currentVisibleDays[0] || 1);
  const [targetHour, setTargetHour] = useState('09:00');

  if (!isOpen) return null;

  const filteredActivities = unplacedActivities.filter((act) => {
    if (searchQuery && !act.titre.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (selectedCat && String(act.categorie_id) !== String(selectedCat)) {
      return false;
    }
    if (selectedDest && String(act.destination_id) !== String(selectedDest)) {
      return false;
    }
    return true;
  });

  const handlePlace = (activity) => {
    const [h, m] = targetHour.split(':').map(Number);
    const startMins = (h || 9) * 60 + (m || 0);
    const duration = activity.duree_min || 60;
    // Arrondi au multiple de 15 minutes supérieur
    const roundedDuration = Math.ceil(duration / 15) * 15;

    onQuickPlace({
      activity_id: activity.id,
      jour: Number(targetDay),
      heure_debut: startMins,
      heure_fin: startMins + roundedDuration
    });
  };

  const handleDragStart = (e, act) => {
    e.dataTransfer.setData(
      'text/plain',
      JSON.stringify({
        type: 'activity',
        id: act.id,
        titre: act.titre,
        duree_min: act.duree_min || 60,
        categorie_couleur: act.categorie_couleur
      })
    );
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  return (
    <div className="fixed inset-y-0 left-0 z-40 w-full max-w-sm bg-white border-r border-[#E6E4DF] shadow-2xl flex flex-col animate-slide-in">
      {/* En-tête */}
      <div className="p-4 border-b border-[#E6E4DF] bg-[#F7F6F3] flex items-center justify-between">
        <div>
          <h3 className="text-base font-extrabold text-[#17181A]">Fiches disponibles</h3>
          <p className="text-xs text-[#55565A]">
            {unplacedActivities.length} activité{unplacedActivities.length > 1 ? 's' : ''} à planifier
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full text-[#55565A] hover:text-[#17181A] hover:bg-[#E6E4DF] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Sélecteur de placement rapide */}
      <div className="p-3 bg-[#FAF3E7] border-b border-[#E8D4B0] flex items-center gap-2 text-xs">
        <span className="font-bold text-[#B9862F] shrink-0">Placer sur :</span>
        <select
          value={targetDay}
          onChange={(e) => setTargetDay(Number(e.target.value))}
          className="px-2 py-1 rounded-lg border border-[#E8D4B0] bg-white font-bold text-[#17181A]"
        >
          {currentVisibleDays.map((d) => (
            <option key={d} value={d}>
              Jour {d}
            </option>
          ))}
        </select>
        <span className="text-[#B9862F]">à</span>
        <select
          value={targetHour}
          onChange={(e) => setTargetHour(e.target.value)}
          className="px-2 py-1 rounded-lg border border-[#E8D4B0] bg-white font-bold text-[#17181A]"
        >
          {['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00', '20:00'].map((time) => (
            <option key={time} value={time}>
              {time}
            </option>
          ))}
        </select>
      </div>

      {/* Filtres & Recherche */}
      <div className="p-3 border-b border-[#E6E4DF] space-y-2 bg-white">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8F92]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher une fiche..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#F7F6F3] border border-[#E6E4DF] rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#17181A] transition-all"
          />
        </div>

        <div className="flex gap-2">
          {categories.length > 0 && (
            <select
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
              className="flex-1 px-2 py-1 bg-[#F7F6F3] border border-[#E6E4DF] rounded-lg text-xs font-semibold text-[#17181A]"
            >
              <option value="">Toutes catégories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          )}

          {destinations.length > 0 && (
            <select
              value={selectedDest}
              onChange={(e) => setSelectedDest(e.target.value)}
              className="flex-1 px-2 py-1 bg-[#F7F6F3] border border-[#E6E4DF] rounded-lg text-xs font-semibold text-[#17181A]"
            >
              <option value="">Toutes étapes</option>
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nom}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Guide Drag & Drop */}
      <div className="px-3 py-2 bg-[#F7F6F3] border-b border-[#E6E4DF] text-[11px] text-[#55565A] flex items-center gap-1.5">
        <GripVertical className="w-3.5 h-3.5 text-[#8E8F92] shrink-0" />
        <span>Glissez une fiche directement sur l'heure souhaitée dans la grille</span>
      </div>

      {/* Liste des cartes d'activités */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filteredActivities.length === 0 ? (
          <div className="text-center py-10 px-4 text-[#8E8F92] text-xs">
            Aucune fiche disponible correspondant aux filtres.
          </div>
        ) : (
          filteredActivities.map((act) => (
            <div
              key={act.id}
              draggable="true"
              onDragStart={(e) => handleDragStart(e, act)}
              className="p-3 rounded-2xl border border-[#E6E4DF] bg-white hover:border-[#17181A] hover:shadow-md transition-all group cursor-grab active:cursor-grabbing relative"
            >
              <div className="flex items-start gap-2.5">
                {act.photo_url ? (
                  <img
                    src={getPhotoUrl(act.photo_url)}
                    alt={act.titre}
                    className="w-12 h-12 rounded-xl object-cover shrink-0 border border-[#E6E4DF]"
                  />
                ) : (
                  <div
                    className="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: act.categorie_couleur || '#8E8F92' }}
                  >
                    {act.titre.substring(0, 2).toUpperCase()}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: act.categorie_couleur || '#8E8F92' }}
                    />
                    <span className="text-[10px] font-bold text-[#8E8F92] truncate">
                      {act.categorie_nom}
                    </span>
                  </div>

                  <h4
                    onClick={() => onOpenActivityModal && onOpenActivityModal(act.id)}
                    className="text-xs font-bold text-[#17181A] truncate cursor-pointer hover:underline"
                    title={act.titre}
                  >
                    {act.titre}
                  </h4>

                  <div className="flex items-center gap-3 mt-1 text-[11px] text-[#55565A]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#8E8F92]" />
                      {act.duree_min} min
                    </span>
                    {act.cout_total > 0 && (
                      <span className="flex items-center gap-0.5 font-bold text-[#17181A]">
                        <Euro className="w-3 h-3 text-[#8E8F92]" />
                        {act.cout_total} €
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Placer & Voir détails */}
              <div className="mt-2.5 pt-2 border-t border-[#E6E4DF] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onOpenActivityModal && onOpenActivityModal(act.id)}
                  className="text-[10px] font-bold text-[#55565A] hover:text-[#17181A] hover:underline"
                >
                  Voir fiche
                </button>
                <button
                  type="button"
                  onClick={() => handlePlace(act)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#17181A] text-white hover:bg-[#3F7A55] transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>Placer</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
