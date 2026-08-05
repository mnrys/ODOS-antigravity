import React, { useState, useEffect } from 'react';
import { Trash2, RotateCcw, X, AlertCircle, Sparkles, Clock } from 'lucide-react';

/**
 * Tiroir de corbeille dédié à l'Atelier (US-8).
 * Permet de récupérer une fiche retirée du canvas pendant la période de grâce de 30 jours.
 */
export default function WorkshopTrashDrawer({ isOpen, onClose, destinationId, onRestored }) {
  const [trashItems, setTrashItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadTrash = async () => {
    if (!destinationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/destinations/${destinationId}/workshop-trash`);
      if (res.ok) {
        const data = await res.json();
        setTrashItems(data);
      } else {
        throw new Error("Erreur de chargement de la corbeille");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTrash();
    }
  }, [isOpen, destinationId]);

  const handleRestore = async (activityId) => {
    try {
      const res = await fetch(`/api/activities/${activityId}/workshop-restore`, {
        method: 'POST'
      });
      if (res.ok) {
        await loadTrash();
        if (onRestored) onRestored();
      }
    } catch (err) {
      console.error("Erreur de restauration:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#17181A]/50 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-[#E3E1DC] animate-in slide-in-from-right duration-200">
        {/* En-tête */}
        <div className="p-5 border-b border-[#E3E1DC] flex items-center justify-between bg-[#F8F7F5]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FAF3E7] text-[#B4472F] flex items-center justify-center">
              <Trash2 size={18} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#17181A]">Corbeille de l'Atelier</h3>
              <p className="text-[11px] text-[#8E8F92]">Fiches retirées du canvas (récupérables 30j)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#8E8F92] hover:text-[#17181A] hover:bg-[#E3E1DC]/50 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-xs text-[#8E8F92]">
              Chargement des fiches...
            </div>
          ) : trashItems.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-[#F1F0ED] text-[#8E8F92] flex items-center justify-center mx-auto">
                <Trash2 size={20} />
              </div>
              <p className="text-xs font-bold text-[#17181A]">La corbeille de l'atelier est vide</p>
              <p className="text-[11px] text-[#8E8F92] max-w-xs mx-auto">
                Glissez ou envoyez des cartes ici pour faire de la place sur votre table sans les supprimer.
              </p>
            </div>
          ) : (
            trashItems.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl border border-[#E3E1DC] bg-[#F8F7F5] flex items-center justify-between gap-3 hover:bg-white transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-[#17181A] truncate">{item.titre}</h4>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-[#8E8F92]">
                    <span className="flex items-center gap-1 text-[#D97706] font-semibold">
                      <Clock size={11} />
                      {item.jours_restants_grace}j restants
                    </span>
                    {item.categorie_nom && (
                      <span>· {item.categorie_nom}</span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRestore(item.id)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-[#E8F2EC] text-[#3F7A55] border border-[#3F7A55]/30 rounded-xl text-xs font-bold shadow-xs transition-colors shrink-0"
                  title="Remettre cette fiche sur le canvas"
                >
                  <RotateCcw size={12} />
                  <span>Restaurer</span>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Pied de page */}
        <div className="p-4 border-t border-[#E3E1DC] bg-[#F8F7F5] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-[#F1F0ED] border border-[#E3E1DC] rounded-xl text-xs font-bold text-[#5A5B5E] transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
