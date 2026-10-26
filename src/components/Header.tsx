import React, { useState, useRef, useEffect } from 'react';
import { 
  Trophy, 
  Users, 
  Calendar, 
  Info, 
  ExternalLink, 
  FileCode2, 
  Sparkles,
  FileSpreadsheet,
  RefreshCw,
  GraduationCap,
  Shield,
  ChevronDown,
  UserCheck,
  User,
  Check,
  ShieldCheck
} from 'lucide-react';
import { UserRole } from '../types/tennis';

interface HeaderProps {
  activeTab: 'infos' | 'adherents' | 'rencontres' | 'licencies' | 'enseignants';
  setActiveTab: (tab: 'infos' | 'adherents' | 'rencontres' | 'licencies' | 'enseignants') => void;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  onOpenScriptModal: () => void;
  onOpenGsheetModal?: () => void;
  onOpenGoogleSyncModal?: () => void;
  totalAdherents: number;
  totalLicencies?: number;
  onRefreshFromFile?: () => Promise<void> | void;
  isRefreshing?: boolean;
  isGoogleConnected?: boolean;
  googleUserEmail?: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  userRole,
  setUserRole,
  onOpenScriptModal,
  onOpenGsheetModal,
  onOpenGoogleSyncModal,
  totalAdherents,
  totalLicencies,
  onRefreshFromFile,
  isRefreshing = false,
  isGoogleConnected = false,
  googleUserEmail,
}) => {
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fermer le dropdown en cliquant à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsRoleDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const rolesConfig: {
    id: UserRole;
    label: string;
    sublabel: string;
    badgeColor: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'adherent',
      label: 'Adhérent',
      sublabel: 'Matchs & Infos du club (lecture seule)',
      badgeColor: 'bg-zinc-800 text-zinc-300 border-zinc-700',
      icon: <User className="w-3.5 h-3.5 text-zinc-400" />,
    },
    {
      id: 'capitaine',
      label: 'Capitaine d\'équipe',
      sublabel: 'Composition & validation des rencontres',
      badgeColor: 'bg-orange-500/20 text-[#FF6D00] border-orange-500/30',
      icon: <Trophy className="w-3.5 h-3.5 text-orange-400" />,
    },
    {
      id: 'prof',
      label: 'Enseignant (Prof)',
      sublabel: 'Planning, groupes, soldes, relances & attestations',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      icon: <GraduationCap className="w-3.5 h-3.5 text-purple-400" />,
    },
    {
      id: 'bureau',
      label: 'Membre du Bureau',
      sublabel: 'Accès administrateur complet à tout le club',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      icon: <Shield className="w-3.5 h-3.5 text-emerald-400" />,
    },
  ];

  const currentRoleConfig = rolesConfig.find(r => r.id === userRole) || rolesConfig[3];

  const handleSelectRole = (newRole: UserRole) => {
    setUserRole(newRole);
    setIsRoleDropdownOpen(false);
    
    // Si l'onglet en cours n'est plus accessible avec le nouveau rôle, rediriger vers 'rencontres'
    if (newRole === 'adherent' && (activeTab === 'adherents' || activeTab === 'enseignants')) {
      setActiveTab('rencontres');
    } else if (newRole === 'capitaine' && (activeTab === 'adherents' || activeTab === 'enseignants')) {
      setActiveTab('rencontres');
    } else if (newRole === 'prof' && activeTab === 'adherents') {
      setActiveTab('enseignants');
    }
  };

  // Droits d'affichage des onglets selon les 4 fonctions définies par l'utilisateur
  const canSeeAdherents = userRole === 'bureau';
  const canSeeEnseignants = userRole === 'prof' || userRole === 'bureau';

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-[#12151b]/95 backdrop-blur-md border-b border-[#252b36] shadow-lg shadow-black/40">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-2">
          
          {/* Logo & Titre Club */}
          <div 
            onClick={() => setActiveTab('infos')}
            className="flex items-center space-x-3 cursor-pointer group select-none shrink-0"
            title="Tennis Club de Muzillac"
          >
            <div className="relative">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-[#BF360C] via-[#E65100] to-[#FF6D00] flex items-center justify-center font-heading font-black text-white text-base sm:text-lg shadow-lg shadow-orange-950/60 border border-orange-400/40 group-hover:scale-105 transition-transform duration-200">
                TCM
              </div>
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#12151b] flex items-center justify-center" title="Club Actif">
                <span className="w-1 rounded-full bg-white"></span>
              </div>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center space-x-2">
                <span className="font-heading font-black text-white text-sm sm:text-base tracking-tight group-hover:text-orange-400 transition-colors">
                  TC MUZILLAC
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-[#E65100]/25 text-[#FF6D00] border border-[#E65100]/40 uppercase tracking-wider">
                  BZH 56
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 flex items-center gap-1.5">
                <span>FFT 52 56 0212</span>
                <span>•</span>
                <span className="text-zinc-500 hidden sm:inline">Complexe du Chêne Rond</span>
              </p>
            </div>
          </div>

          {/* Onglets de navigation adaptés aux rôles */}
          <nav className="flex items-center p-1 bg-[#090b0e] rounded-2xl border border-[#232934] shadow-inner text-xs sm:text-sm">
            
            {/* 1. Infos Club (Tous) */}
            <button
              onClick={() => setActiveTab('infos')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 sm:py-2 rounded-xl font-bold transition-all duration-200 cursor-pointer ${
                activeTab === 'infos'
                  ? 'bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white shadow-md shadow-orange-950/50'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <Info className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Infos Club</span>
              <span className="sm:hidden">Infos</span>
            </button>

            {/* 2. Rencontres (Tous) */}
            <button
              onClick={() => setActiveTab('rencontres')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 sm:py-2 rounded-xl font-bold transition-all duration-200 cursor-pointer ${
                activeTab === 'rencontres'
                  ? 'bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white shadow-md shadow-orange-950/50'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <Trophy className="w-4 h-4 shrink-0" />
              <span>Rencontres</span>
            </button>

            {/* 3. Licenciés (Club Muzillac 2027) */}
            <button
              onClick={() => setActiveTab('licencies')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 sm:py-2 rounded-xl font-bold transition-all duration-200 cursor-pointer ${
                activeTab === 'licencies'
                  ? 'bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white shadow-md shadow-orange-950/50'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
              <span className="hidden sm:inline">Licenciés</span>
              <span className="sm:hidden">Lic.</span>
              {typeof totalLicencies === 'number' && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                  activeTab === 'licencies' 
                    ? 'bg-black/30 text-white' 
                    : 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {totalLicencies}
                </span>
              )}
            </button>

            {/* 4. Enseignants (Profs & Bureau) */}
            {canSeeEnseignants && (
              <button
                onClick={() => setActiveTab('enseignants')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 sm:py-2 rounded-xl font-bold transition-all duration-200 cursor-pointer ${
                  activeTab === 'enseignants'
                    ? 'bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white shadow-md shadow-orange-950/50'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                }`}
              >
                <GraduationCap className="w-4 h-4 shrink-0 text-purple-400" />
                <span className="hidden sm:inline">Enseignants</span>
                <span className="sm:hidden">Profs</span>
              </button>
            )}

            {/* 5. Adhérents (Bureau uniquement) */}
            {canSeeAdherents && (
              <button
                onClick={() => setActiveTab('adherents')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 sm:py-2 rounded-xl font-bold transition-all duration-200 relative cursor-pointer ${
                  activeTab === 'adherents'
                    ? 'bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white shadow-md shadow-orange-950/50'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>Adhérents</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                  activeTab === 'adherents' 
                    ? 'bg-black/30 text-white' 
                    : 'bg-zinc-800 text-zinc-300'
                }`}>
                  {totalAdherents}
                </span>
              </button>
            )}

          </nav>

          {/* Sélecteur de rôle & Accès Droite */}
          <div className="flex items-center space-x-2 shrink-0">
            
            {/* Sélecteur de profil / rôle interactif */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                className={`flex items-center space-x-2 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-sm cursor-pointer ${currentRoleConfig.badgeColor}`}
                title="Changer de rôle (Adhérent, Capitaine, Prof, Bureau)"
              >
                <span className="shrink-0">{currentRoleConfig.icon}</span>
                <span className="hidden sm:inline">{currentRoleConfig.label}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isRoleDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Menu déroulant de sélection des 4 rôles */}
              {isRoleDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-[#141820] border border-zinc-700 rounded-2xl shadow-2xl p-1.5 z-50 text-xs space-y-1 animate-fadeIn">
                  <div className="px-3 py-1.5 border-b border-zinc-800 text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
                    Changer de profil d'accès
                  </div>

                  {rolesConfig.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => handleSelectRole(r.id)}
                      className={`w-full text-left p-2 rounded-xl transition flex items-start space-x-2.5 cursor-pointer ${
                        userRole === r.id
                          ? 'bg-orange-500/20 text-white border border-orange-500/40'
                          : 'hover:bg-zinc-800/80 text-zinc-300'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">{r.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white">{r.label}</span>
                          {userRole === r.id && <Check className="w-3.5 h-3.5 text-orange-400" />}
                        </div>
                        <p className="text-[10px] text-zinc-400 leading-tight mt-0.5">{r.sublabel}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Bouton Données_appli Google Sheets (pour Bureau & Enseignants) */}
            {onOpenGoogleSyncModal && userRole === 'bureau' && (
              <button
                onClick={onOpenGoogleSyncModal}
                className={`hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                  isGoogleConnected
                    ? 'bg-emerald-950/40 hover:bg-emerald-900/50 border-emerald-500/50 text-emerald-300 hover:text-white'
                    : 'bg-[#1b2029] hover:bg-[#252b36] border-[#2f3746] text-zinc-300 hover:text-white'
                }`}
                title={isGoogleConnected ? `Connecté à Données_appli (${googleUserEmail})` : 'Connecter Données_appli Google Sheets'}
              >
                <FileSpreadsheet className={`w-3.5 h-3.5 ${isGoogleConnected ? 'text-emerald-400' : 'text-zinc-400'}`} />
                <span>{isGoogleConnected ? 'Données_appli' : 'Google Sheets'}</span>
              </button>
            )}

            {/* Ten'Up rapide */}
            <a
              href="https://tenup.fft.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-[#E65100]/20 hover:bg-[#E65100]/30 border border-[#E65100]/40 text-[#FF6D00] hover:text-white text-xs font-bold transition"
            >
              <span>Ten'Up</span>
              <ExternalLink className="w-3 h-3" />
            </a>

          </div>

        </div>
      </div>
    </header>
  );
};
