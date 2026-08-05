import React, { useState } from 'react';
import {
  DollarSign,
  PieChart,
  Layers,
  Calendar,
  Edit2,
  Check,
  X,
  Loader2,
  AlertTriangle,
  Info,
  TrendingUp,
  Euro
} from 'lucide-react';
import { updateTrip } from '../../api/client';

/**
 * Widget de suivi et de ventilation du budget du voyage.
 * Conforme à US-3, US-4, US-5 (PRD_ecran0_dashboard.md) et règles d'or de GEMINI.md.
 * Commutateur à 3 positions : Catégorie / Destination / Journée.
 */
export default function BudgetWidget({ budget, tripId = 1, onBudgetUpdated }) {
  const [viewMode, setViewMode] = useState('category'); // 'category' | 'destination' | 'day'
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [editedBudget, setEditedBudget] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!budget) return null;

  const totalPrevu = budget.budget_total_prevu || 0;
  const totalEngage = budget.cout_total_estime || 0;
  const soldeRestant = totalPrevu - totalEngage;
  const ratio = totalPrevu > 0 ? Math.min((totalEngage / totalPrevu) * 100, 100) : 0;
  const isOverBudget = totalEngage > totalPrevu && totalPrevu > 0;

  const handleStartEdit = () => {
    setEditedBudget(totalPrevu.toString());
    setIsEditingBudget(true);
  };

  const handleSaveBudget = async () => {
    const val = parseFloat(editedBudget);
    if (isNaN(val) || val < 0) return;
    setIsSaving(true);
    try {
      await updateTrip(tripId, { budget_total: val });
      setIsEditingBudget(false);
      if (onBudgetUpdated) onBudgetUpdated();
    } catch (err) {
      console.error("Erreur mise à jour budget:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Sélection du jeu de données selon la bascule
  let items = [];
  if (viewMode === 'category') {
    items = budget.par_categorie || [];
  } else if (viewMode === 'destination') {
    items = budget.par_destination || [];
  } else if (viewMode === 'day') {
    items = budget.par_journee || [];
  }

  return (
    <div className="bg-white border border-[#E6E4DF] rounded-3xl p-5 md:p-6 shadow-xs flex flex-col justify-between h-full">
      <div>
        {/* En-tête du Widget */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#17181A] text-[#D6F84C] flex items-center justify-center shrink-0">
              <Euro className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#17181A] tracking-tight">
                Budget Global
              </h2>
              <p className="text-[11px] text-[#55565A]">Ventilation en temps réel</p>
            </div>
          </div>

          {/* Commutateur à 3 positions (US-5) */}
          <div className="inline-flex p-0.5 bg-[#F7F6F3] border border-[#E6E4DF] rounded-full text-xs font-semibold self-start sm:self-auto">
            <button
              onClick={() => setViewMode('category')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] transition-all duration-200 ${
                viewMode === 'category'
                  ? 'bg-[#17181A] text-white shadow-xs font-bold'
                  : 'text-[#55565A] hover:text-[#17181A]'
              }`}
            >
              <PieChart className="w-3 h-3" />
              <span>Catégorie</span>
            </button>

            <button
              onClick={() => setViewMode('destination')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] transition-all duration-200 ${
                viewMode === 'destination'
                  ? 'bg-[#17181A] text-white shadow-xs font-bold'
                  : 'text-[#55565A] hover:text-[#17181A]'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Destination</span>
            </button>

            <button
              onClick={() => setViewMode('day')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] transition-all duration-200 ${
                viewMode === 'day'
                  ? 'bg-[#17181A] text-white shadow-xs font-bold'
                  : 'text-[#55565A] hover:text-[#17181A]'
              }`}
            >
              <Calendar className="w-3 h-3" />
              <span>Journée</span>
            </button>
          </div>
        </div>

        {/* Chiffres Clés du Budget */}
        <div className="grid grid-cols-2 gap-3 p-3.5 bg-[#F7F6F3] border border-[#E6E4DF] rounded-2xl mb-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-[#8E8F92] uppercase tracking-wider">
                Budget Estimé
              </span>
              {!isEditingBudget && (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="p-1 text-[#8E8F92] hover:text-[#17181A] rounded-md transition-colors"
                  title="Modifier l'enveloppe budget"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              )}
            </div>

            {isEditingBudget ? (
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  type="number"
                  value={editedBudget}
                  onChange={(e) => setEditedBudget(e.target.value)}
                  className="w-24 px-2 py-1 text-sm font-bold bg-white border border-[#17181A] rounded-lg focus:outline-hidden"
                  autoFocus
                />
                <button
                  onClick={handleSaveBudget}
                  disabled={isSaving}
                  className="p-1.5 bg-[#17181A] text-[#D6F84C] rounded-lg hover:bg-[#333]"
                >
                  {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                </button>
                <button
                  onClick={() => setIsEditingBudget(false)}
                  className="p-1.5 bg-white text-[#55565A] border border-[#E6E4DF] rounded-lg"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <p className="text-lg font-extrabold text-[#17181A] tracking-tight mt-0.5">
                {Math.round(totalPrevu).toLocaleString('fr-FR')} €
              </p>
            )}
          </div>

          <div>
            <span className="text-[10px] font-extrabold text-[#8E8F92] uppercase tracking-wider block">
              Budget Engagé
            </span>
            <p className="text-lg font-extrabold text-[#17181A] tracking-tight mt-0.5">
              {Math.round(totalEngage).toLocaleString('fr-FR')} €
            </p>
          </div>
        </div>

        {/* Jauge de Progression */}
        <div className="space-y-1.5 mb-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-semibold text-[#55565A]">
              Utilisation : <strong className="text-[#17181A]">{ratio.toFixed(0)}%</strong>
            </span>
            <span
              className={`text-[11px] font-bold ${
                isOverBudget ? 'text-[#C95D4E]' : soldeRestant >= 0 ? 'text-[#3F7A55]' : 'text-[#B9862F]'
              }`}
            >
              {isOverBudget
                ? `Dépassement de ${Math.abs(Math.round(soldeRestant))} €`
                : `Reste ${Math.round(soldeRestant)} € disponible`}
            </span>
          </div>

          <div className="h-2 w-full bg-[#EDEBE6] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isOverBudget ? 'bg-[#C95D4E]' : ratio > 80 ? 'bg-[#B9862F]' : 'bg-[#3F7A55]'
              }`}
              style={{ width: `${ratio}%` }}
            />
          </div>
        </div>

        {/* Liste de Ventilation Scrollable & Élégante */}
        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
          {items.length === 0 ? (
            <p className="text-xs text-[#8E8F92] text-center py-4">
              Aucune dépense enregistrée dans cette vue.
            </p>
          ) : (
            items.map((item, idx) => {
              const itemColor = item.couleur || '#3F7A55';
              return (
                <div
                  key={item.cle || idx}
                  className="p-2.5 bg-[#FAF9F7] hover:bg-[#F3F2EE] border border-[#E6E4DF] rounded-xl transition-colors"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: itemColor }}
                      />
                      <span className="font-bold text-[#17181A] truncate">{item.label}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-extrabold text-[#17181A] tabular-nums">
                        {Math.round(item.montant)} €
                      </span>
                      <span className="text-[10px] font-bold text-[#8E8F92] w-9 text-right">
                        {item.pourcentage}%
                      </span>
                    </div>
                  </div>

                  {/* Barre fine proportionnelle */}
                  <div className="h-1 w-full bg-[#E6E4DF] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(item.pourcentage, 100)}%`,
                        backgroundColor: itemColor
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Note d'information de bas de widget */}
      <div className="mt-3 pt-2.5 border-t border-[#E6E4DF] flex items-center gap-1.5 text-[10px] text-[#8E8F92]">
        <Info className="w-3 h-3 shrink-0 text-[#8E8F92]" />
        <span>Activités + Dépenses libres du planning consolidées en temps réel.</span>
      </div>
    </div>
  );
}
