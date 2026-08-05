import React, { useEffect, useState } from 'react';
import { Compass, Sparkles, MapPin } from 'lucide-react';

/**
 * Écran de démarrage animé (SplashScreen - Phase 10).
 * S'exécute une seule fois au chargement initial de l'application (session).
 * S'estompe avec un fondu doux vers le Dashboard.
 */
export default function SplashScreen({ onFinish }) {
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Déclenchement du fondu de sortie à 1.4s
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 1400);

    // Fin complète et démontage à 1.9s
    const endTimer = setTimeout(() => {
      onFinish();
    }, 1900);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(endTimer);
    };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#17181A] text-white transition-opacity duration-500 select-none ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Halo lumineux d'arrière-plan */}
      <div className="absolute w-96 h-96 bg-[#3F7A55]/20 rounded-full blur-3xl animate-pulse pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center px-6">
        {/* Logo Iconique ODOS */}
        <div className="w-20 h-20 rounded-3xl bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center mb-6 shadow-2xl">
          <Compass className="w-10 h-10 text-[#D6F84C] stroke-[2.25]" />
        </div>

        {/* Titre & Typographie ODOS */}
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-2 notranslate" translate="no">
          ODOS
        </h1>
        <p className="text-sm font-semibold tracking-widest uppercase text-[#8E8F92] flex items-center gap-2 mb-6">
          <span>Travel Planner</span>
          <span className="w-1 h-1 rounded-full bg-[#D6F84C]" />
          <span className="text-[#D6F84C]">Canaries</span>
        </p>

        {/* Barre de progression subtile */}
        <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-[#D6F84C] rounded-full w-full transition-all duration-1000 ease-out" />
        </div>
      </div>
    </div>
  );
}
