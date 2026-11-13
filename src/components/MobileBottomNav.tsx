import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Trophy,
  BookOpen,
  ShoppingBag,
  Users,
  Info,
  ShieldCheck,
  GraduationCap,
  Scale,
  Menu,
  X,
  RefreshCw,
} from 'lucide-react';
import { ActiveTab, UserRole } from '../types/tennis';

interface MobileBottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  userRole: UserRole;
  totalAdherents: number;
  totalLicencies: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  userRole,
  totalAdherents,
  totalLicencies,
  onRefresh,
  isRefreshing = false,
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const canSeeAdherents = userRole === 'admin' || userRole === 'bureau';
  const canSeeEnseignants = userRole === 'admin' || userRole === 'bureau' || userRole === 'prof';
  const canSeeLicencies = userRole !== 'adherent';

  // 4e raccourci dynamique selon le rôle (Adhérents pour Bureau/Admin, Enseignants pour Prof, Licenciés pour Capitaine, Infos Club pour Adhérent)
  const directoryTab: { id: ActiveTab; label: string; icon: React.ReactNode } = canSeeAdherents
    ? { id: 'adherents', label: 'Adhérents', icon: <Users className="w-5 h-5" /> }
    : canSeeEnseignants
      ? { id: 'enseignants', label: 'Profs', icon: <GraduationCap className="w-5 h-5" /> }
      : canSeeLicencies
        ? { id: 'licencies', label: 'Licenciés', icon: <ShieldCheck className="w-5 h-5" /> }
        : { id: 'infos', label: 'Club', icon: <Info className="w-5 h-5" /> };

  const allTabs: { id: ActiveTab; label: string; subtitle: string; visible: boolean; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'rencontres',
      label: 'Rencontres',
      subtitle: 'Calendrier, compositions & sondages',
      visible: true,
      icon: <Trophy className="w-5 h-5 text-orange-400" />,
    },
    {
      id: 'tutos',
      label: 'Tutos & Infos',
      subtitle: "Ten'Up, réservation, paiements, équipes",
      visible: true,
      icon: <BookOpen className="w-5 h-5 text-emerald-400" />,
    },
    {
      id: 'troc',
      label: 'Troc & Occasions',
      subtitle: 'Petites annonces matériel en direct',
      visible: true,
      icon: <ShoppingBag className="w-5 h-5 text-sky-400" />,
    },
    {
      id: 'infos',
      label: 'Infos Club',
      subtitle: 'Bureau, terrains, tarifs & contacts',
      visible: true,
      icon: <Info className="w-5 h-5 text-zinc-300" />,
    },
    {
      id: 'licencies',
      label: 'Licenciés FFT',
      subtitle: 'Effectif compétition & attestations',
      visible: canSeeLicencies,
      icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
      badge: totalLicencies,
    },
    {
      id: 'enseignants',
      label: 'Enseignants',
      subtitle: 'Groupes par jour & élèves',
      visible: canSeeEnseignants,
      icon: <GraduationCap className="w-5 h-5 text-purple-400" />,
    },
    {
      id: 'adherents',
      label: 'Adhérents',
      subtitle: 'Annuaire complet, soldes & relances',
      visible: canSeeAdherents,
      icon: <Users className="w-5 h-5 text-orange-300" />,
      badge: totalAdherents,
    },
    {
      id: 'reglements',
      label: 'Règlements',
      subtitle: 'Formats championnats & ordre matchs',
      visible: true,
      icon: <Scale className="w-5 h-5 text-amber-400" />,
    },
  ];

  const handleNavigate = (tab: ActiveTab) => {
    setActiveTab(tab);
    setIsDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <nav
        aria-label="Navigation principale mobile"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#12151b]/95 backdrop-blur-md border-t border-[#252b37] pb-safe shadow-2xl shadow-black"
      >
        <div className="grid grid-cols-5 h-16 max-w-lg mx-auto px-1">
          <button
            type="button"
            onClick={() => handleNavigate('rencontres')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition cursor-pointer ${
              activeTab === 'rencontres' ? 'text-[#FF6D00]' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Trophy className="w-5 h-5" />
            <span className="text-[11px] font-bold leading-none whitespace-nowrap">Matchs</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavigate('tutos')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition cursor-pointer ${
              activeTab === 'tutos' ? 'text-[#FF6D00]' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-[11px] font-bold leading-none whitespace-nowrap">Tutos</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavigate('troc')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition cursor-pointer ${
              activeTab === 'troc' ? 'text-[#FF6D00]' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="text-[11px] font-bold leading-none whitespace-nowrap">Troc</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavigate(directoryTab.id)}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition cursor-pointer ${
              activeTab === directoryTab.id ? 'text-[#FF6D00]' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {directoryTab.icon}
            <span className="text-[11px] font-bold leading-none whitespace-nowrap">{directoryTab.label}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            aria-label="Ouvrir le menu complet"
            className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition cursor-pointer ${
              isDrawerOpen ? 'text-[#FF6D00]' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Menu className="w-5 h-5" />
            <span className="text-[11px] font-bold leading-none whitespace-nowrap">Plus</span>
          </button>
        </div>
      </nav>

      {/* Bottom Sheet Menu complet sur Mobile */}
      {isDrawerOpen && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setIsDrawerOpen(false)}
          className="md:hidden fixed inset-0 z-[99990] bg-black/80 backdrop-blur-sm flex items-end justify-center animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-[#141820] border-t border-zinc-700 rounded-t-3xl p-4 pb-safe max-h-[85vh] overflow-y-auto space-y-3"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h2 className="font-heading font-black text-white text-base">
                  Navigation TCM
                </h2>
                <p className="text-xs text-zinc-400">
                  Accès rapide à toutes les rubriques autorisées
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                aria-label="Fermer le menu"
                className="min-w-[44px] min-h-[44px] rounded-xl bg-zinc-800 text-zinc-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              {allTabs
                .filter((t) => t.visible)
                .map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleNavigate(t.id)}
                    className={`w-full min-h-[52px] p-3 rounded-2xl flex items-center justify-between gap-3 transition cursor-pointer text-left ${
                      activeTab === t.id
                        ? 'bg-orange-500/20 border border-orange-500/40 text-white'
                        : 'bg-[#0b0e14] border border-zinc-800/80 text-zinc-300 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                        {t.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-white leading-tight">{t.label}</p>
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5">{t.subtitle}</p>
                      </div>
                    </div>
                    {typeof t.badge === 'number' && (
                      <span className="text-xs font-mono font-bold text-zinc-300 tabular-nums shrink-0">
                        {t.badge}
                      </span>
                    )}
                  </button>
                ))}
            </div>

            {onRefresh && (
              <button
                type="button"
                disabled={isRefreshing}
                onClick={() => {
                  onRefresh();
                  setIsDrawerOpen(false);
                }}
                className="w-full min-h-[44px] p-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-orange-400' : ''}`} />
                <span>Synchroniser avec Google Sheets</span>
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
