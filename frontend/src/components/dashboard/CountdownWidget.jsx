import React from 'react';
import { Calendar, Users, MapPin, Sparkles, Edit3, Compass } from 'lucide-react';

/**
 * En-tête Hero Banner principal du voyage avec photo de fond immersive et compte à rebours.
 * Conforme à US-2 (PRD_ecran0_dashboard.md) et système de design docs/DESIGN.md.
 */
export default function CountdownWidget({ trip, onEditTrip }) {
  if (!trip) return null;

  // Formatage propre des dates (ex: "10 oct. — 24 oct. 2026")
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const year = trip.date_debut ? new Date(trip.date_debut).getFullYear() : 2026;
  const dateRangeStr = `${formatDate(trip.date_debut)} — ${formatDate(trip.date_fin)} ${year}`;

  const countdownText =
    trip.jours_avant_depart > 0
      ? `J-${trip.jours_avant_depart}`
      : trip.jours_avant_depart === 0
      ? "Départ aujourd'hui !"
      : "Voyage en cours ou terminé";

  const heroBackground =
    trip.photo_couverture ||
    "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1920&q=85";

  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#E6E4DF] shadow-md min-h-[190px] md:min-h-[220px] flex flex-col justify-end p-6 md:p-8 group">
      {/* 1. Image d'arrière-plan avec zoom fluide au survol */}
      <img
        src={heroBackground}
        alt={trip.nom_voyage}
        className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
      />

      {/* 2. Overlay gradient sombre pour une lisibilité parfaite */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/65 to-black/40 z-0" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 z-0" />

      {/* 3. Contenu principal au-dessus de l'image */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-5">
        <div className="space-y-2.5 max-w-2xl">
          {/* Badges supérieurs : Statut & Bouton d'édition */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-md border border-white/25 px-3 py-1 rounded-full text-xs font-extrabold text-white shadow-xs">
              <span className="w-2 h-2 rounded-full bg-[#D6F84C] animate-pulse" />
              <span>Séjour en préparation</span>
            </div>

            {onEditTrip && (
              <button
                type="button"
                onClick={onEditTrip}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-[#D6F84C] hover:bg-[#cbf13b] text-[#17181A] shadow-sm transition-all transform hover:scale-105 cursor-pointer"
                title="Modifier les dates, la durée ou les voyageurs"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Modifier séjour</span>
              </button>
            )}
          </div>

          {/* Grand Titre du Voyage */}
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight leading-tight drop-shadow-md">
            {trip.nom_voyage}
          </h1>

          {/* Métadonnées : Dates, Voyageurs, Destinations en pilules translucides */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onEditTrip}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/15 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              title="Cliquez pour modifier les dates"
            >
              <Calendar className="w-3.5 h-3.5 text-[#D6F84C]" />
              <span>{dateRangeStr} ({trip.nb_jours} jours)</span>
            </button>

            <button
              type="button"
              onClick={onEditTrip}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/15 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              title="Cliquez pour modifier les voyageurs"
            >
              <Users className="w-3.5 h-3.5 text-[#D6F84C]" />
              <span>{trip.nb_personnes} {trip.nb_personnes > 1 ? 'voyageurs' : 'voyageur'}</span>
            </button>

            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/15 text-white text-xs font-semibold shadow-xs">
              <MapPin className="w-3.5 h-3.5 text-[#D6F84C]" />
              <span>{trip.destinations?.length || 0} destinations</span>
            </div>
          </div>
        </div>

        {/* 4. Bloc Compte à Rebours élégant */}
        <div className="flex items-center md:flex-col md:items-end justify-between border-t md:border-t-0 md:border-l border-white/20 pt-3 md:pt-0 md:pl-6 shrink-0">
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-white/80 drop-shadow-xs">
            Compte à rebours
          </span>
          <div className="inline-flex items-center gap-2 bg-black/70 backdrop-blur-md border border-white/20 text-[#D6F84C] px-4 py-2 rounded-2xl shadow-lg text-xl md:text-2xl font-black tabular-nums tracking-tight mt-1">
            <Compass className="w-5 h-5 text-[#D6F84C] animate-spin-slow" />
            <span>{countdownText}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
