/**
 * Tiroir / Modal de la Corbeille de l'Écran 1 avec période de grâce.
 * Conforme à PRD_ecran1_creation.md (US-7, US-8, US-11) et docs/DESIGN.md.
 */
import React, { useState, useEffect } from 'react';
import {
  X, Trash2, RotateCcw, AlertTriangle, Clock, MapPin,
  Calendar, Check, ShieldAlert
} from 'lucide-react';

export default function TrashDrawer({
  isOpen,
  onClose,
  tripId,
  onRestored
}) {
  const [trashItems, setTrashItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(null);

  const loadTrash = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/trips/${tripId}/trash`);
      if (res.ok) {
        const data = await res.json();
        setTrashItems(data);
      }
    } catch (err) {
      console.error("Erreur lors du chargement de la corbeille:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && tripId) {
      loadTrash();
    }
  }, [isOpen, tripId]);

  if (!isOpen) return null;

  // Action : Restaurer une fiche
  const handleRestore = async (itemId) => {
    try {
      setActionInProgress(itemId);
      const res = await fetch(`/api/activities/${itemId}/restore`, {
        method: 'POST'
      });
      if (res.ok) {
        setTrashItems((prev) => prev.filter((i) => i.id !== itemId));
        if (onRestored) onRestored();
      }
    } catch (err) {
      console.error("Erreur de restauration:", err);
    } finally {
      setActionInProgress(null);
    }
  };

  // Action : Purger définitivement une fiche
  const handlePurge = async (itemId, titre) => {
    if (
      !window.confirm(
        `Supprimer définitivement "${titre}" ? Cette action est irréversible et supprimera également les documents attachés.`
      )
    ) {
      return;
    }

    try {
      setActionInProgress(itemId);
      const res = await fetch(`/api/activities/${itemId}/purge`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setTrashItems((prev) => prev.filter((i) => i.id !== itemId));
        if (onRestored) onRestored();
      }
    } catch (err) {
      console.error("Erreur lors de la purge:", err);
    } finally {
      setActionInProgress(null);
    }
  };

  // Action : Purger toute la corbeille
  const handlePurgeAll = async () => {
    if (
      !window.confirm(
        `Vider définitivement TOUTE la corbeille ? Cette action supprimera de façon irréversible toutes les fiches actuellement présentes.`
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/trips/${tripId}/trash/purge-all`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setTrashItems([]);
        if (onRestored) onRestored();
      }
    } catch (err) {
      console.error("Erreur lors de la purge totale:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-white rounded-[28px] border border-[#E6E4DF] shadow-2xl flex flex-col overflow-hidden">
        {/* Header Corbeille */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6E4DF] bg-[#FAF3E7]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#B4472F] text-white flex items-center justify-center shadow-sm">
              <Trash2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[18px] font-extrabold text-[#17181A]">
                  Corbeille (Écran 1)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-[#17181A] text-white text-[12px] font-bold font-tabular">
                  {trashItems.length}
                </span>
              </div>
              <p className="text-[12px] text-[#55565A]">
                Les fiches rejetées sont conservées 30 jours avant suppression définitive
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-[#8E8F92] hover:text-[#17181A] hover:bg-white/80 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Liste des éléments de la corbeille */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading ? (
            <div className="py-16 text-center text-[#8E8F92] text-[14px]">
              Chargement des éléments supprimés...
            </div>
          ) : trashItems.length === 0 ? (
            <div className="py-16 text-center space-y-3 max-w-sm mx-auto">
              <div className="w-14 h-14 rounded-full bg-[#F7F6F3] text-[#8E8F92] flex items-center justify-center mx-auto">
                <Check size={28} />
              </div>
              <h3 className="text-[16px] font-bold text-[#17181A]">Corbeille vide</h3>
              <p className="text-[13px] text-[#55565A]">
                Aucune fiche n'a été rejetée ou placée dans la corbeille pour le moment.
              </p>
            </div>
          ) : (
            trashItems.map((item) => {
              const isLowGrace = item.jours_restants_grace <= 5;
              const formattedDate = item.supprime_le
                ? new Date(item.supprime_le).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : '';

              return (
                <div
                  key={item.id}
                  className="bg-[#F7F6F3] border border-[#E6E4DF] rounded-[18px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF9F5] transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white text-[#55565A]">
                        {item.source === 'scraping_simule'
                          ? '⚠️ secours (virtuel)'
                          : item.source === 'scraping_auto'
                          ? '🤖 scraping'
                          : item.source === 'claude_chrome'
                          ? '⚡ chrome'
                          : '✏️ manuel'}
                      </span>
                      {item.destination_nom && (
                        <span className="text-[12px] font-semibold text-[#55565A] flex items-center gap-1">
                          <MapPin size={12} className="text-[#3F7A55]" />
                          {item.destination_nom}
                        </span>
                      )}
                    </div>

                    <h4 className="text-[15px] font-bold text-[#17181A]">
                      {item.titre}
                    </h4>

                    <div className="flex items-center gap-3 text-[11px] text-[#8E8F92]">
                      <span>Supprimée le {formattedDate}</span>
                      <span>·</span>
                      <span
                        className={`inline-flex items-center gap-1 font-bold ${
                          isLowGrace ? 'text-[#B4472F]' : 'text-[#B9862F]'
                        }`}
                      >
                        <Clock size={12} />
                        {item.jours_restants_grace} jours de grâce restants
                      </span>
                    </div>
                  </div>

                  {/* Actions Restauration & Purge */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      disabled={actionInProgress === item.id}
                      onClick={() => handleRestore(item.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-[#17181A] hover:text-white text-[#17181A] border border-[#E6E4DF] text-[12px] font-bold shadow-xs transition-colors disabled:opacity-50"
                      title="Restaurer cette fiche dans le catalogue actif"
                    >
                      <RotateCcw size={14} />
                      <span>Restaurer</span>
                    </button>

                    <button
                      type="button"
                      disabled={actionInProgress === item.id}
                      onClick={() => handlePurge(item.id, item.titre)}
                      className="p-2 rounded-full text-[#8E8F92] hover:text-[#B4472F] hover:bg-[#B4472F]/10 transition-colors disabled:opacity-50"
                      title="Purger définitivement de la base de données"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#F7F6F3] border-t border-[#E6E4DF] flex items-center justify-between">
          <div className="flex items-center gap-2 text-[12px] text-[#55565A]">
            <ShieldAlert size={14} className="text-[#B9862F]" />
            <span>Période de grâce de 30 jours</span>
          </div>
          <div className="flex items-center gap-3">
            {trashItems.length > 0 && (
              <button
                type="button"
                onClick={handlePurgeAll}
                className="px-5 py-2 rounded-full bg-white text-[#B4472F] border border-[#E6E4DF] hover:bg-[#B4472F]/10 text-[13px] font-bold transition-colors shadow-xs"
              >
                Vider la corbeille
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-full bg-[#17181A] text-white text-[13px] font-bold hover:bg-black transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
