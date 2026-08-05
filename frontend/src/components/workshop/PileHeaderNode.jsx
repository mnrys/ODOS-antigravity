import React, { memo } from 'react';
import { Sparkles, Layers } from 'lucide-react';

/**
 * Nœud d'en-tête de pile pour le canvas Atelier.
 * Conforme à PRD_ecran2_atelier.md (US-2, Décisions d'implémentation).
 */
function PileHeaderNode({ data }) {
  const { label, count = 0, color = '#3F7A55', isAiSuggestions = false } = data;

  return (
    <div className={`w-[290px] px-3.5 py-2.5 rounded-2xl border shadow-xs flex items-center justify-between select-none ${
      isAiSuggestions
        ? 'bg-[#FAF3E7] border-[#E3E1DC] text-[#17181A]'
        : 'bg-[#F8F7F5] border-[#E3E1DC] text-[#17181A]'
    }`}>
      <div className="flex items-center gap-2 min-w-0">
        {isAiSuggestions ? (
          <div className="w-6 h-6 rounded-lg bg-[#D6F84C] text-[#17181A] flex items-center justify-center shrink-0">
            <Sparkles size={13} className="fill-current" />
          </div>
        ) : (
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
        )}
        <span className="text-xs font-extrabold truncate tracking-tight">
          {label}
        </span>
      </div>

      <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
        isAiSuggestions
          ? 'bg-[#17181A]/10 text-[#5A5B5E]'
          : 'bg-[#E3E1DC]/80 text-[#5A5B5E]'
      }`}>
        {count}
      </span>
    </div>
  );
}

export default memo(PileHeaderNode);
