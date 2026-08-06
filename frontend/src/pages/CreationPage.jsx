/**
 * Écran 1 : Création & Catalogue des activités.
 * Conforme à PRD_ecran1_creation.md (US-4, US-6, US-7, US-8, US-10, US-11) et docs/DESIGN.md.
 */
import React, { useState, useEffect } from 'react';
import {
  Plus, Search, Filter, MapPin, Clock, Calendar, Star,
  Tag as TagIcon, Edit3, Trash2, ExternalLink, ImageOff, CheckCircle,
  Sparkles, Inbox, RefreshCw, Globe, Zap
} from 'lucide-react';
import ActivityFormModal from '../components/activities/ActivityFormModal';
import FocusModeModal from '../components/activities/FocusModeModal';
import TrashDrawer from '../components/activities/TrashDrawer';
import ScrapingModal from '../components/activities/ScrapingModal';
import { getPhotoUrl } from '../utils/imageUtils';

export default function CreationPage({ tripId = 1, onPendingCountChange, onNavigateTab }) {
  const [activities, setActivities] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tripInfo, setTripInfo] = useState({ nb_personnes: 1, nom: '' });
  const [pendingCount, setPendingCount] = useState(0);
  const [trashCount, setTrashCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filtres
  const [selectedDestination, setSelectedDestination] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Drawers
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activityToEdit, setActivityToEdit] = useState(null);
  const [isFocusModeOpen, setIsFocusModeOpen] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isScrapingOpen, setIsScrapingOpen] = useState(false);

  const loadData = async (isSilent = false) => {
    try {
      if (!isSilent && activities.length === 0) {
        setLoading(true);
      }
      const [actRes, destRes, catRes, dashRes, pendingRes, trashRes] = await Promise.all([
        fetch(`/api/trips/${tripId}/activities?statut_validation=validee`),
        fetch(`/api/trips/${tripId}/destinations`),
        fetch(`/api/trips/${tripId}/categories`),
        fetch(`/api/trips/${tripId}/dashboard`),
        fetch(`/api/trips/${tripId}/pending-validation`),
        fetch(`/api/trips/${tripId}/trash`)
      ]);

      if (actRes.ok) setActivities(await actRes.json());
      if (destRes.ok) setDestinations(await destRes.json());
      if (catRes.ok) setCategories(await catRes.json());
      if (dashRes.ok) {
        const dash = await dashRes.json();
        setTripInfo({ nb_personnes: dash.nb_personnes, nom: dash.nom_voyage });
      }
      if (pendingRes.ok) {
        const pending = await pendingRes.json();
        setPendingCount(pending.length);
        if (onPendingCountChange) onPendingCountChange(pending.length);
      }
      if (trashRes.ok) {
        const trash = await trashRes.json();
        setTrashCount(trash.length);
      }
    } catch (err) {
      console.error("Erreur de chargement des données de l'écran 1:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tripId) {
      loadData(false);
    }
  }, [tripId]);

  const handleOpenCreate = () => {
    setActivityToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (act) => {
    setActivityToEdit(act);
    setIsModalOpen(true);
  };

  const handleDeleteActivity = async (e, actId) => {
    e.stopPropagation(); // Évite de déclencher le double-clic
    if (window.confirm("Déplacer cette fiche vers la corbeille (récupérable 30 jours) ?")) {
      try {
        const res = await fetch(`/api/activities/${actId}`, { method: 'DELETE' });
        if (res.ok) {
          loadData(true);
        }
      } catch (err) {
        console.error("Erreur de suppression:", err);
      }
    }
  };

  // Filtrage des fiches affichées
  const filteredActivities = activities.filter((act) => {
    // Filtre destination
    if (selectedDestination !== 'all' && act.destination_id !== Number(selectedDestination)) {
      return false;
    }
    // Filtre catégorie
    if (selectedCategory !== 'all' && act.categorie_id !== Number(selectedCategory)) {
      return false;
    }
    // Recherche textuelle
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitre = act.titre?.toLowerCase().includes(q);
      const matchTags = act.tags?.some((t) => t.nom.toLowerCase().includes(q));
      const matchDest = act.destination_nom?.toLowerCase().includes(q);
      if (!matchTitre && !matchTags && !matchDest) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* 1. Header de l'Écran 1 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#EDEBE6] p-6 rounded-[24px] border border-[#E6E4DF]">
        <div>
          <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-[#55565A] mb-1">
            <span>Écran 1</span>
            <span>·</span>
            <span>Catalogue & Création</span>
          </div>
          <h1 className="text-[26px] font-extrabold text-[#17181A] tracking-tight">
            Fiches d'activités & Logistique
          </h1>
          <p className="text-[14px] text-[#55565A] mt-0.5">
            {activities.length} fiches validées dans le catalogue · Double-cliquez pour ouvrir
          </p>
        </div>

        {/* Actions principales */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Bouton Scraping auto */}
          <button
            type="button"
            onClick={() => setIsScrapingOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-white hover:bg-[#E8F2EC] text-[#254A33] border border-[#3F7A55]/30 text-[13px] font-bold shadow-xs transition-colors"
            title="Lancer un scraping automatique GetYourGuide par destination"
          >
            <Globe size={15} className="text-[#3F7A55]" />
            <span>Scraping auto</span>
          </button>

          {/* Bouton Capture rapide */}
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('quick-capture')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-white hover:bg-[#F7F6F3] text-[#55565A] hover:text-[#17181A] border border-[#E6E4DF] text-[13px] font-bold shadow-xs transition-colors"
              title="Ouvrir la page de capture rapide Claude for Chrome"
            >
              <Zap size={15} className="text-[#D97706]" />
              <span>Capture rapide</span>
            </button>
          )}

          {/* Bouton Corbeille */}
          <button
            type="button"
            onClick={() => setIsTrashOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-white hover:bg-[#F7F6F3] text-[#55565A] hover:text-[#17181A] border border-[#E6E4DF] text-[13px] font-bold shadow-xs transition-colors"
            title="Consulter les fiches supprimées (période de grâce 30j)"
          >
            <Trash2 size={16} className="text-[#8E8F92]" />
            <span>Corbeille</span>
            {trashCount > 0 && (
              <span className="px-2 py-0.2 rounded-full bg-[#B4472F]/10 text-[#B4472F] text-[11px] font-extrabold">
                {trashCount}
              </span>
            )}
          </button>

          {/* Bouton Mode Focus si des fiches sont en attente */}
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={() => setIsFocusModeOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#17181A] hover:bg-black text-[#D6F84C] text-[13px] font-bold shadow-md transition-all transform hover:-translate-y-0.5"
            >
              <Sparkles size={16} />
              <span>Mode Focus ({pendingCount})</span>
            </button>
          )}

          {/* Action primaire : Nouvelle fiche manuelle */}
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#D6F84C] hover:bg-[#cbf13b] text-[#17181A] text-[14px] font-bold shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
          >
            <Plus size={18} strokeWidth={2.5} />
            <span>Nouvelle fiche</span>
          </button>
        </div>
      </div>

      {/* Bannière "Pile À Valider" si des fiches sont en attente */}
      {pendingCount > 0 && (
        <div className="bg-[#FAF3E7] border border-[#E6E4DF] rounded-[20px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#17181A] text-[#D6F84C] flex items-center justify-center shrink-0">
              <Inbox size={20} />
            </div>
            <div>
              <h3 className="text-[15px] font-extrabold text-[#17181A]">
                {pendingCount} {pendingCount === 1 ? 'fiche importée en attente' : 'fiches importées en attente'} de validation
              </h3>
              <p className="text-[12px] text-[#55565A]">
                Passez en revue les fiches issues du scraping ou de la capture rapide une par une avant intégration.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsFocusModeOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-[#17181A] text-white hover:bg-black text-[13px] font-bold shadow-xs whitespace-nowrap transition-colors"
          >
            <Sparkles size={15} className="text-[#D6F84C]" />
            <span>Traiter la pile (Mode Focus)</span>
          </button>
        </div>
      )}

      {/* 2. Barre de filtres & recherche */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-[20px] border border-[#E6E4DF] shadow-sm">
        {/* Filtre Destinations */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setSelectedDestination('all')}
            className={`px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-colors whitespace-nowrap ${
              selectedDestination === 'all'
                ? 'bg-[#17181A] text-[#D6F84C]'
                : 'bg-[#F7F6F3] text-[#55565A] hover:bg-[#EDEBE6]'
            }`}
          >
            Toutes ({activities.length})
          </button>
          {destinations.map((dest) => {
            const count = activities.filter((a) => a.destination_id === dest.id).length;
            return (
              <button
                key={dest.id}
                onClick={() => setSelectedDestination(dest.id.toString())}
                className={`px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-colors whitespace-nowrap ${
                  selectedDestination === dest.id.toString()
                    ? 'bg-[#17181A] text-[#D6F84C]'
                    : 'bg-[#F7F6F3] text-[#55565A] hover:bg-[#EDEBE6]'
                }`}
              >
                📍 {dest.nom} ({count})
              </button>
            );
          })}
        </div>

        {/* Recherche et Catégories */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8F92]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par titre, tag..."
              className="w-full pl-9 pr-3 py-1.5 bg-[#F7F6F3] rounded-full border border-transparent focus:border-[#17181A] focus:ring-2 focus:ring-[#D6F84C]/60 text-[13px] text-[#17181A] outline-none"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 bg-[#F7F6F3] rounded-full border border-transparent text-[13px] text-[#55565A] font-medium outline-none"
          >
            <option value="all">Toutes catégories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id.toString()}>
                {c.nom}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Grille des cartes activités */}
      {loading ? (
        <div className="p-12 text-center text-[#8E8F92] text-[14px]">
          Chargement des fiches d'activités...
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="p-12 bg-white rounded-[24px] border border-[#E6E4DF] text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#F7F6F3] text-[#8E8F92] flex items-center justify-center mx-auto">
            <Search size={22} />
          </div>
          <h3 className="text-[16px] font-bold text-[#17181A]">Aucune fiche trouvée</h3>
          <p className="text-[13px] text-[#55565A] max-w-sm mx-auto">
            {searchQuery || selectedDestination !== 'all' || selectedCategory !== 'all'
              ? 'Aucune fiche ne correspond à vos filtres de recherche.'
              : 'Commencez par créer une première fiche ou importez-en depuis vos sources de voyage.'}
          </p>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 rounded-full bg-[#17181A] text-white text-[13px] font-bold hover:bg-black transition-colors"
          >
            Créer une fiche
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredActivities.map((act) => {
            const photoUrl = getPhotoUrl(
              act.photo_principale ||
              act.photo_url ||
              act.documents?.find((d) => d.est_principale && d.type_fichier === 'photo')?.chemin_fichier ||
              act.documents?.find((d) => d.type_fichier === 'photo')?.chemin_fichier
            );

            return (
              <div
                key={act.id}
                onDoubleClick={() => handleOpenEdit(act)}
                className="group bg-white rounded-[24px] border border-[#E6E4DF] overflow-hidden hover:border-[#17181A] hover:shadow-xl transition-all flex flex-col cursor-pointer"
              >
                {/* Header Visuel / Photo miniature occupant tout l'espace */}
                <div className="relative h-48 sm:h-52 bg-[#F7F6F3] overflow-hidden w-full">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={act.titre}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.parentElement?.querySelector('.photo-fallback');
                        if (fallback) fallback.classList.remove('hidden');
                      }}
                    />
                  ) : null}

                  {/* Fallback élégant en pleine surface avec couleur de la catégorie */}
                  <div
                    className={`photo-fallback w-full h-full flex flex-col items-center justify-center text-white p-4 ${photoUrl ? 'hidden' : 'flex'}`}
                    style={{ backgroundColor: act.categorie_couleur || '#3F7A55' }}
                  >
                    <span className="text-3xl font-black tracking-wider opacity-90 drop-shadow-xs">
                      {act.titre ? act.titre.substring(0, 2).toUpperCase() : 'OD'}
                    </span>
                    <span className="text-[11px] font-bold mt-1 opacity-80 uppercase tracking-wider">
                      {act.categorie_nom || "Activité"}
                    </span>
                  </div>

                  {/* Gradient sombre inférieur pour assurer un contraste parfait sur les textes du bas */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent pointer-events-none" />

                  {/* Badge de catégorie en haut à gauche */}
                  {act.categorie_nom && (
                    <div
                      className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-bold text-white shadow-sm flex items-center gap-1.5"
                      style={{ backgroundColor: act.categorie_couleur || '#17181A' }}
                    >
                      <span>{act.categorie_nom}</span>
                    </div>
                  )}

                  {/* Badge de provenance en haut à droite */}
                  <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/90 text-[#17181A] shadow-sm backdrop-blur-xs">
                    {act.source === 'scraping_auto' ? '🤖 scraping' : act.source === 'claude_chrome' ? '⚡ chrome' : '✏️ manuel'}
                  </div>

                  {/* Pastille noire de prix total en bas à droite de l'image */}
                  <div className="absolute bottom-3 right-3 px-3 py-1 rounded-full bg-[#17181A] text-white text-[13px] font-extrabold font-tabular shadow-md">
                    {act.cout_total > 0 ? `${act.cout_total.toFixed(0)} €` : 'Gratuit'}
                  </div>

                  {/* Destination en bas à gauche de l'image */}
                  <div className="absolute bottom-3 left-3 text-white text-[12px] font-semibold flex items-center gap-1 drop-shadow-md">
                    <MapPin size={13} className="text-[#D6F84C]" />
                    <span>{act.destination_nom || "Destination"}</span>
                  </div>
                </div>

                {/* Corps de la carte */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    {/* Note d'intérêt et statut */}
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            size={13}
                            className={s <= (act.note_interet || 0) ? "text-[#B9862F] fill-[#B9862F]" : "text-[#E6E4DF]"}
                          />
                        ))}
                      </div>

                      {act.est_placée && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#3F7A55] bg-[#3F7A55]/10 px-2 py-0.5 rounded-full">
                          <CheckCircle size={11} />
                          Planifiée
                        </span>
                      )}
                    </div>

                    {/* Titre */}
                    <h3 className="text-[16px] font-bold text-[#17181A] line-clamp-1 group-hover:text-black">
                      {act.titre}
                    </h3>

                    {/* Tags */}
                    {act.tags && act.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {act.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag.id}
                            className="text-[11px] font-medium text-[#55565A] bg-[#F7F6F3] px-2 py-0.5 rounded-full"
                          >
                            #{tag.nom}
                          </span>
                        ))}
                        {act.tags.length > 3 && (
                          <span className="text-[11px] font-medium text-[#8E8F92] px-1 py-0.5">
                            +{act.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer de la carte */}
                  <div className="pt-2.5 border-t border-[#E6E4DF] flex items-center justify-between">
                    {/* Complétude */}
                    <div className="flex items-center gap-1.5 text-[11px] text-[#55565A]">
                      <div className="w-12 bg-[#E6E4DF] h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-[#3F7A55] h-full"
                          style={{ width: `${act.completude || 0}%` }}
                        />
                      </div>
                      <span>{act.completude || 0}%</span>
                    </div>

                    {/* Actions directes */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(act)}
                        className="p-1.5 text-[#55565A] hover:text-[#17181A] hover:bg-[#F7F6F3] rounded-full transition-colors"
                        title="Éditer la fiche (ou double-cliquer)"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteActivity(e, act.id)}
                        className="p-1.5 text-[#8E8F92] hover:text-[#B4472F] hover:bg-[#B4472F]/10 rounded-full transition-colors"
                        title="Mettre en corbeille (récupérable 30j)"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal / Panneau complet d'édition */}
      <ActivityFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        tripId={tripId}
        nbPersonnes={tripInfo.nb_personnes}
        activityToEdit={activityToEdit}
        destinations={destinations}
        categories={categories}
        onSaved={() => loadData(true)}
      />

      {/* Modal / Mode Focus séquentiel */}
      <FocusModeModal
        isOpen={isFocusModeOpen}
        onClose={() => setIsFocusModeOpen(false)}
        tripId={tripId}
        nbPersonnes={tripInfo.nb_personnes}
        destinations={destinations}
        categories={categories}
        onProcessed={() => loadData(true)}
      />

      {/* Tiroir / Corbeille avec période de grâce */}
      <TrashDrawer
        isOpen={isTrashOpen}
        onClose={() => setIsTrashOpen(false)}
        tripId={tripId}
        onRestored={() => loadData(true)}
      />

      {/* Modal / Déclenchement Scraping externe */}
      <ScrapingModal
        isOpen={isScrapingOpen}
        onClose={() => setIsScrapingOpen(false)}
        tripId={tripId}
        onScrapingComplete={() => loadData(true)}
        onOpenFocusMode={() => setIsFocusModeOpen(true)}
      />
    </div>
  );
}
