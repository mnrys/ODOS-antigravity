import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Calendar,
  Layers,
  Plus,
  Coins,
  Sparkles
} from 'lucide-react';

/**
 * Barre d'outils du Planning (Écran 3).
 * Navigation par jour / 3 jours / semaine avec affichage des dates réelles du calendrier.
 * cf. PRD_ecran3_planning.md (US-12, US-13, US-19, US-20).
 */
export default function PlanningToolbar({
  viewMode,
  setViewMode,
  currentStartDay,
  onNavigate,
  onResetToDayOne,
  nbJours = 7,
  tripStartDate = null,
  granularity,
  setGranularity,
  hourHeight,
  setHourHeight,
  budgetEngage = 0,
  budgetTotal = 0,
  unplacedCount = 0,
  isUnplacedOpen,
  setIsUnplacedOpen,
  onOpenSpecialBlockModal
}) {
  // Calcul du libellé enrichi avec dates réelles du voyage
  const getVisibleDaysLabel = () => {
    const count = viewMode === 'day' ? 1 : viewMode === '3days' ? 3 : 7;
    const endDay = Math.min(currentStartDay + count - 1, nbJours);

    if (!tripStartDate) {
      if (viewMode === 'day') {
        return `Jour ${currentStartDay} sur ${nbJours}`;
      }
      return `Jours ${currentStartDay} à ${endDay} sur ${nbJours}`;
    }

    const dStart = new Date(tripStartDate);
    dStart.setDate(dStart.getDate() + (currentStartDay - 1));

    const dEnd = new Date(tripStartDate);
    dEnd.setDate(dEnd.getDate() + (endDay - 1));

    const fmtFull = (d) =>
      d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    const fmtShort = (d) =>
      d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

    if (viewMode === 'day') {
      const fullDay = dStart.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      });
      return `Jour ${currentStartDay} / ${nbJours} • ${fullDay}`;
    }
    return `Jours ${currentStartDay} à ${endDay} / ${nbJours} • ${fmtShort(dStart)} au ${fmtShort(dEnd)}`;
  };

  const budgetRatio = budgetTotal > 0 ? (budgetEngage / budgetTotal) * 100 : 0;
  const isBudgetOver = budgetTotal > 0 && budgetEngage > budgetTotal;

  return (
    <div className="bg-white border border-[#E6E4DF] rounded-2xl p-3 md:px-5 md:py-3.5 shadow-sm flex flex-wrap items-center justify-between gap-4 select-none">
      {/* 1. Vues & Navigation */}
      <div className="flex items-center flex-wrap gap-2 sm:gap-3">
        {/* Sélecteur de vue */}
        <div className="flex items-center bg-[#F7F6F3] p-1 rounded-xl border border-[#E6E4DF] text-xs font-bold text-[#55565A]">
          <button
            onClick={() => setViewMode('day')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              viewMode === 'day'
                ? 'bg-white text-[#17181A] shadow-sm font-extrabold'
                : 'hover:text-[#17181A]'
            }`}
          >
            1 Jour
          </button>
          <button
            onClick={() => setViewMode('3days')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              viewMode === '3days'
                ? 'bg-white text-[#17181A] shadow-sm font-extrabold'
                : 'hover:text-[#17181A]'
            }`}
          >
            3 Jours
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              viewMode === 'week'
                ? 'bg-white text-[#17181A] shadow-sm font-extrabold'
                : 'hover:text-[#17181A]'
            }`}
          >
            Semaine
          </button>
        </div>

        {/* Flèches de navigation */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onNavigate(-1)}
            disabled={currentStartDay <= 1}
            title="Période précédente"
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#E6E4DF] text-[#17181A] hover:bg-[#F7F6F3] disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 text-xs font-bold text-[#17181A] px-3 py-1.5 bg-[#F7F6F3] rounded-xl border border-[#E6E4DF] capitalize">
            <Calendar className="w-3.5 h-3.5 text-[#3F7A55] shrink-0" />
            <span>{getVisibleDaysLabel()}</span>
          </div>

          <button
            onClick={() => onNavigate(1)}
            disabled={
              (viewMode === 'day' && currentStartDay >= nbJours) ||
              (viewMode === '3days' && currentStartDay + 2 >= nbJours) ||
              (viewMode === 'week' && currentStartDay + 6 >= nbJours)
            }
            title="Période suivante"
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#E6E4DF] text-[#17181A] hover:bg-[#F7F6F3] disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {currentStartDay > 1 && (
            <button
              onClick={onResetToDayOne}
              className="text-xs font-bold text-[#3F7A55] hover:underline px-1.5 py-1"
            >
              Jour 1
            </button>
          )}
        </div>
      </div>

      {/* 2. Granularité & Zoom */}
      <div className="flex items-center flex-wrap gap-4">
        {/* Bascule Granularité (US-19, US-20) */}
        <div className="flex items-center gap-1.5 bg-[#F7F6F3] p-1 rounded-xl border border-[#E6E4DF]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E8F92] px-1.5">
            Grille
          </span>
          <button
            onClick={() => setGranularity('1/4')}
            title="Grille au quart d'heure (15 min)"
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              granularity === '1/4'
                ? 'bg-white text-[#17181A] shadow-sm'
                : 'text-[#55565A] hover:text-[#17181A]'
            }`}
          >
            1/4 h
          </button>
          <button
            onClick={() => setGranularity('1/2')}
            title="Grille à la demi-heure (30 min)"
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              granularity === '1/2'
                ? 'bg-white text-[#17181A] shadow-sm'
                : 'text-[#55565A] hover:text-[#17181A]'
            }`}
          >
            1/2 h
          </button>
        </div>

        {/* Curseur Zoom (US-13) */}
        <div className="hidden lg:flex items-center gap-2 bg-[#F7F6F3] px-3 py-1.5 rounded-xl border border-[#E6E4DF]">
          <ZoomOut className="w-3.5 h-3.5 text-[#55565A]" />
          <input
            type="range"
            min="50"
            max="140"
            step="5"
            value={hourHeight}
            onChange={(e) => setHourHeight(Number(e.target.value))}
            title={`Zoom hauteur d'heure : ${hourHeight}px`}
            className="w-20 accent-[#17181A] cursor-pointer"
          />
          <ZoomIn className="w-3.5 h-3.5 text-[#55565A]" />
        </div>
      </div>

      {/* 3. Budget Global & Actions */}
      <div className="flex items-center flex-wrap gap-2.5">
        {/* Budget Global (US-12) */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 bg-[#FAF3E7] border border-[#E8D4B0] rounded-xl text-xs">
          <Coins className="w-4 h-4 text-[#B9862F] shrink-0" />
          <div>
            <div className="flex items-center gap-1.5 font-bold text-[#17181A]">
              <span>{Math.round(budgetEngage)} €</span>
              {budgetTotal > 0 && (
                <span className="text-[#8E8F92] font-normal">/ {Math.round(budgetTotal)} €</span>
              )}
            </div>
            {budgetTotal > 0 && (
              <div className="w-20 bg-[#E8D4B0] h-1.5 rounded-full overflow-hidden mt-0.5">
                <div
                  className={`h-full transition-all duration-300 ${
                    isBudgetOver ? 'bg-[#C95D4E]' : 'bg-[#B9862F]'
                  }`}
                  style={{ width: `${Math.min(budgetRatio, 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Bouton + Bloc libre (US-16) */}
        <button
          onClick={onOpenSpecialBlockModal}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#F7F6F3] text-[#17181A] border border-[#E6E4DF] hover:bg-[#E6E4DF] transition-colors shadow-2xs"
        >
          <Plus className="w-3.5 h-3.5 text-[#3F7A55]" />
          <span>+ Bloc libre</span>
        </button>
      </div>
    </div>
  );
}
