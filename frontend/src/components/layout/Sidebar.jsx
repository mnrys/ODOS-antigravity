import React from 'react';
import { LayoutDashboard, PlusCircle, Palette, Calendar, Compass } from 'lucide-react';

/**
 * Barre de navigation latérale persistante d'ODOS (88px de large sur desktop).
 * Conforme à DESIGN.md (Rail 88px, icônes seules sur desktop, pastille d'activation encre/lime).
 */
export default function Sidebar({ activeTab, setActiveTab, pendingValidationCount = 0 }) {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      subtitle: 'Accueil'
    },
    {
      id: 'creation',
      label: 'Création',
      icon: PlusCircle,
      subtitle: 'Ajouter',
      badge: pendingValidationCount > 0 ? pendingValidationCount : null
    },
    {
      id: 'atelier',
      label: 'Atelier',
      icon: Palette,
      subtitle: 'Canvas'
    },
    {
      id: 'planning',
      label: 'Planning',
      icon: Calendar,
      subtitle: 'Agenda'
    }
  ];

  return (
    <aside className="w-full md:w-22 bg-[#F7F6F3] border-b md:border-b-0 md:border-r border-[#E6E4DF] flex md:flex-col justify-between items-center py-3 md:py-6 px-4 md:px-0 z-30 shrink-0">
      {/* Brand Logo */}
      <div className="flex md:flex-col items-center gap-1.5">
        <div className="w-11 h-11 rounded-2xl bg-[#17181A] flex items-center justify-center text-[#D6F84C] shadow-sm">
          <Compass className="w-6 h-6 stroke-[2.25]" />
        </div>
        <span translate="no" className="notranslate text-[11px] font-extrabold tracking-widest text-[#17181A] uppercase hidden md:block">
          ODOS
        </span>
      </div>

      {/* Navigation Tabs */}
      <nav className="flex md:flex-col items-center gap-3 md:gap-5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`relative group flex flex-col items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-2xl transition-all duration-200 ${
                isActive
                  ? 'bg-[#17181A] text-[#D6F84C] shadow-md scale-105'
                  : 'text-[#55565A] hover:bg-[#EDEBE6] hover:text-[#17181A]'
              }`}
              title={item.label}
            >
              <Icon className="w-5 h-5 stroke-[2]" />
              <span className={`text-[10px] font-medium mt-0.5 ${isActive ? 'text-[#D6F84C]' : 'text-[#8E8F92]'}`}>
                {item.label}
              </span>

              {/* Badge d'alerte sur l'onglet Création s'il y a des fiches à valider */}
              {item.badge && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#B9862F] text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm animate-pulse">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Solo Badge */}
      <div className="hidden md:flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-[#EDEBE6] border border-[#E6E4DF] flex items-center justify-center text-[12px] font-bold text-[#17181A]">
          T
        </div>
      </div>
    </aside>
  );
}
