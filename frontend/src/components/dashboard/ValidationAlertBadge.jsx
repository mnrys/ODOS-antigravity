import React from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';

/**
 * Bannière d'alerte pour les fiches en attente de validation.
 * Conforme à US-9 (PRD_ecran0_dashboard.md) et couleur d'alerte ambre #B9862F (DESIGN.md).
 */
export default function ValidationAlertBadge({ count, onNavigateToCreation }) {
  if (!count || count <= 0) return null;

  return (
    <div className="w-full bg-[#FAF3E7] border border-[#E8D4B4] rounded-2xl p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm mb-6">
      <div className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-[#B9862F] text-white flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5 stroke-[2.25]" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-[#17181A]">
            {count === 1 ? '1 fiche attend votre validation' : `${count} fiches attendent votre validation`}
          </h4>
          <p className="text-xs text-[#55565A] mt-0.5">
            Des idées ou réservations scrapées sont en attente dans la pile "À valider".
          </p>
        </div>
      </div>

      <button
        onClick={onNavigateToCreation}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#17181A] text-white hover:bg-[#B9862F] text-xs font-semibold px-4 py-2.5 rounded-full transition-all duration-200 shadow-sm shrink-0"
      >
        <span>Rejoindre la pile à valider</span>
        <ArrowRight className="w-4 h-4 stroke-[2]" />
      </button>
    </div>
  );
}
