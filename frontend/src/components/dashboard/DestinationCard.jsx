import React from 'react';
import { ArrowRight, MapPin, CheckCircle2, Compass } from 'lucide-react';

/**
 * Carte de destination affichée sur le Dashboard.
 * Conforme à US-6 et US-7 (PRD_ecran0_dashboard.md).
 * Propose un clic direct pour rejoindre l'Atelier de la destination.
 */
export default function DestinationCard({ destination, onOpenAtelier }) {
  if (!destination) return null;

  const defaultPhoto = "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80";
  const photo = destination.photo_couverture || defaultPhoto;

  return (
    <div className="group relative bg-white border border-[#E6E4DF] hover:border-[#17181A] rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between">
      {/* Header visuel compact */}
      <div className="relative h-28 w-full overflow-hidden bg-[#EDEBE6]">
        <img
          src={photo}
          alt={destination.nom}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Badge étape */}
        <div className="absolute top-2.5 left-2.5 bg-[#17181A]/80 backdrop-blur-md text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-white/20">
          Étape #{destination.ordre}
        </div>

        {/* Titre destination */}
        <div className="absolute bottom-2 left-3 right-3 text-white">
          <h3 className="text-base font-extrabold text-white tracking-tight leading-tight">
            {destination.nom}
          </h3>
        </div>
      </div>

      {/* Stats & CTA */}
      <div className="p-3.5 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#F7F6F3] p-2 rounded-xl border border-[#E6E4DF] text-center">
            <span className="text-[9px] font-bold text-[#8E8F92] uppercase tracking-wider block">
              Activités
            </span>
            <span className="text-sm font-extrabold text-[#17181A] tabular-nums">
              {destination.nb_activites}
            </span>
          </div>

          <div className="bg-[#F7F6F3] p-2 rounded-xl border border-[#E6E4DF] text-center">
            <span className="text-[9px] font-bold text-[#8E8F92] uppercase tracking-wider block">
              Planifiées
            </span>
            <div className="flex items-center justify-center gap-1 text-[#3F7A55]">
              <CheckCircle2 className="w-3 h-3 shrink-0" />
              <span className="text-sm font-extrabold tabular-nums">
                {destination.nb_activites_placées}
              </span>
            </div>
          </div>
        </div>

        {/* Bouton vers l'Atelier */}
        <button
          onClick={() => onOpenAtelier(destination.id)}
          className="w-full flex items-center justify-center gap-1.5 bg-[#17181A] hover:bg-[#D6F84C] text-white hover:text-[#17181A] font-extrabold text-xs py-2 px-3 rounded-xl transition-all duration-200 shadow-xs"
        >
          <span>Ouvrir l'Atelier</span>
          <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
}
