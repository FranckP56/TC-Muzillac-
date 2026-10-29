import React, { useState, useRef, useEffect } from 'react';
import { 
  Trophy, 
  Users, 
  Calendar, 
  Info, 
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
  ShieldCheck,
  Settings,
  X
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
  saison?: string;
  onUpdateSaison?: (newSaison: string) => void;
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
  saison = '2027',
  onUpdateSaison,
}) => {
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isAdminSettingsOpen, setIsAdminSettingsOpen] = useState(false);
  const [tempSaison, setTempSaison] = useState(saison);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTempSaison(saison);
  }, [saison]);

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
      id: 'admin',
      label: 'Admin',
      sublabel: 'Réglages saison, synchronisation et gestion complète',
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      icon: <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />,
    },
    {
      id: 'bureau',
      label: 'Membre du Bureau',
      sublabel: 'Accès gestionnaire complet au club',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      icon: <Shield className="w-3.5 h-3.5 text-emerald-400" />,
    },
    {
      id: 'prof',
      label: 'Enseignant (Prof)',
      sublabel: 'Groupes par jour, soldes, relances & attestations',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      icon: <GraduationCap className="w-3.5 h-3.5 text-purple-400" />,
    },
    {
      id: 'capitaine',
      label: 'Capitaine d\'équipe',
      sublabel: 'Composition & validation des rencontres',
      badgeColor: 'bg-orange-500/20 text-[#FF6D00] border-orange-500/30',
      icon: <Trophy className="w-3.5 h-3.5 text-orange-400" />,
    },
    {
      id: 'adherent',
      label: 'Adhérent',
      sublabel: 'Matchs & Infos du club (lecture seule)',
      badgeColor: 'bg-zinc-800 text-zinc-300 border-zinc-700',
      icon: <User className="w-3.5 h-3.5 text-zinc-400" />,
    },
  ];

  const currentRoleConfig = rolesConfig.find(r => r.id === userRole) || rolesConfig[0];

  const handleSelectRole = (newRole: UserRole) => {
    setUserRole(newRole);
    setIsRoleDropdownOpen(false);
    
    // Si l'onglet en cours n'est plus accessible avec le nouveau rôle, rediriger vers 'rencontres'
    if (newRole === 'adherent' && (activeTab === 'adherents' || activeTab === 'enseignants' || activeTab === 'licencies')) {
      setActiveTab('rencontres');
    } else if (newRole === 'capitaine' && (activeTab === 'adherents' || activeTab === 'enseignants')) {
      setActiveTab('rencontres');
    } else if (newRole === 'prof' && activeTab === 'adherents') {
      setActiveTab('enseignants');
    }
  };

  // Droits d'affichage des onglets selon les profils
  const canSeeAdherents = userRole === 'admin' || userRole === 'bureau';
  const canSeeEnseignants = userRole === 'admin' || userRole === 'bureau' || userRole === 'prof';
  const canSeeLicencies = userRole !== 'adherent'; // Masqué pour les adhérents simples

  const handleSaveSaison = (yearToSave: string) => {
    if (onUpdateSaison && yearToSave.trim()) {
      onUpdateSaison(yearToSave.trim());
      setIsAdminSettingsOpen(false);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-[#12151b]/95 backdrop-blur-md border-b border-[#252b37] shadow-lg shadow-black/40">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        
        {/* Ligne 1 : Logo, Titre Club, Badge Ten'Up & Sélecteur de rôle épuré */}
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
          
          {/* Logo & Titre Club avec Badge Ten'Up */}
          <div 
            onClick={() => setActiveTab('infos')}
            className="flex items-center space-x-2.5 sm:space-x-3 cursor-pointer group select-none shrink-0"
            title={`Tennis Club de Muzillac • Saison ${saison}`}
          >
            {/* Bulle orange TCM avec la saison (2027) demandée */}
            <div className="relative">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-[#BF360C] via-[#E65100] to-[#FF6D00] flex flex-col items-center justify-center font-heading font-black text-white shadow-lg shadow-orange-950/60 border border-orange-400/40 group-hover:scale-105 transition-transform duration-200">
                <span className="text-xs font-black tracking-tight leading-none">TCM</span>
                <span className="text-[9px] font-black text-orange-200 leading-none mt-0.5">{saison}</span>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#12151b] flex items-center justify-center" title={`Saison FFT ${saison} Active`} />
            </div>

            <div className="flex flex-col">
              <span className="font-heading font-black text-white text-sm sm:text-base tracking-tight group-hover:text-orange-400 transition-colors">
                TC MUZILLAC
              </span>
              <p className="text-[10px] text-zinc-400 flex items-center gap-1.5">
                <span>FFT 52 56 0212</span>
                <span className="hidden xs:inline">•</span>
                <span className="text-zinc-500 hidden xs:inline">Complexe du Chêne Rond</span>
              </p>
            </div>
          </div>

          {/* Côté Droit épuré : Réglage Saison Admin + Sélecteur de rôle */}
          <div className="flex items-center space-x-2 shrink-0">
            {userRole === 'admin' && (
              <button
                onClick={() => setIsAdminSettingsOpen(true)}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-300 hover:text-white text-xs font-bold transition shadow-sm cursor-pointer"
                title={`Modifier la saison active (${saison})`}
              >
                <Settings className="w-3.5 h-3.5 text-[#FF6D00]" />
                <span className="hidden sm:inline font-mono">Saison {saison}</span>
              </button>
            )}

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                className={`flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-sm cursor-pointer ${currentRoleConfig.badgeColor}`}
                title="Changer de rôle (Admin, Bureau, Prof, Capitaine, Adhérent)"
              >
                <span className="shrink-0">{currentRoleConfig.icon}</span>
                <span className="text-xs font-bold">{currentRoleConfig.label}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${isRoleDropdownOpen ? 'rotate-180' : ''}`} />
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
          </div>
        </div>

        {/* Ligne 2 : Onglets de navigation superposés (icône au-dessus du titre) sans ascenseur horizontal */}
        <div className="border-t border-[#1e2430] py-1.5">
          <nav className="w-full grid grid-flow-col auto-cols-fr gap-1 sm:gap-2">
            
            {/* 1. Infos Club (Tous) */}
            <button
              onClick={() => setActiveTab('infos')}
              className={`flex flex-col items-center justify-center py-1 sm:py-1.5 px-1 sm:px-2 rounded-xl font-bold transition-all duration-200 cursor-pointer ${
                activeTab === 'infos'
                  ? 'bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white shadow-md shadow-orange-950/50'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <Info className="w-4 h-4 shrink-0 mb-0.5" />
              <span className="text-[10px] sm:text-xs leading-tight tracking-tight truncate">Infos Club</span>
            </button>

            {/* 2. Rencontres (Tous) */}
            <button
              onClick={() => setActiveTab('rencontres')}
              className={`flex flex-col items-center justify-center py-1 sm:py-1.5 px-1 sm:px-2 rounded-xl font-bold transition-all duration-200 cursor-pointer ${
                activeTab === 'rencontres'
                  ? 'bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white shadow-md shadow-orange-950/50'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <Trophy className="w-4 h-4 shrink-0 mb-0.5" />
              <span className="text-[10px] sm:text-xs leading-tight tracking-tight truncate">Rencontres</span>
            </button>

            {/* 3. Licenciés (Club Muzillac) - Masqué pour les adhérents */}
            {canSeeLicencies && (
              <button
                onClick={() => setActiveTab('licencies')}
                className={`flex flex-col items-center justify-center py-1 sm:py-1.5 px-1 sm:px-2 rounded-xl font-bold transition-all duration-200 cursor-pointer relative ${
                  activeTab === 'licencies'
                    ? 'bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white shadow-md shadow-orange-950/50'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 shrink-0 mb-0.5 text-emerald-400" />
                  {typeof totalLicencies === 'number' && (
                    <span className={`hidden sm:inline-block absolute -top-1 -right-4 text-[9px] px-1 py-0.2 rounded-full font-black ${
                      activeTab === 'licencies' 
                        ? 'bg-black/40 text-white' 
                        : 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {totalLicencies}
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-0.5 leading-tight">
                  <span className="text-[10px] sm:text-xs tracking-tight truncate">Licenciés</span>
                  {typeof totalLicencies === 'number' && (
                    <span className="sm:hidden text-[9px] font-black opacity-80">({totalLicencies})</span>
                  )}
                </div>
              </button>
            )}

            {/* 4. Enseignants (Profs & Bureau) */}
            {canSeeEnseignants && (
              <button
                onClick={() => setActiveTab('enseignants')}
                className={`flex flex-col items-center justify-center py-1 sm:py-1.5 px-1 sm:px-2 rounded-xl font-bold transition-all duration-200 cursor-pointer ${
                  activeTab === 'enseignants'
                    ? 'bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white shadow-md shadow-orange-950/50'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                }`}
              >
                <GraduationCap className="w-4 h-4 shrink-0 mb-0.5 text-purple-400" />
                <span className="text-[10px] sm:text-xs leading-tight tracking-tight truncate">Enseignants</span>
              </button>
            )}

            {/* 5. Adhérents (Bureau uniquement) */}
            {canSeeAdherents && (
              <button
                onClick={() => setActiveTab('adherents')}
                className={`flex flex-col items-center justify-center py-1 sm:py-1.5 px-1 sm:px-2 rounded-xl font-bold transition-all duration-200 relative cursor-pointer ${
                  activeTab === 'adherents'
                    ? 'bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white shadow-md shadow-orange-950/50'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <Users className="w-4 h-4 shrink-0 mb-0.5" />
                  <span className={`hidden sm:inline-block absolute -top-1 -right-4 text-[9px] px-1 py-0.2 rounded-full font-black ${
                    activeTab === 'adherents' 
                      ? 'bg-black/40 text-white' 
                      : 'bg-zinc-800 text-zinc-300'
                  }`}>
                    {totalAdherents}
                  </span>
                </div>
                <div className="flex items-center space-x-0.5 leading-tight">
                  <span className="text-[10px] sm:text-xs tracking-tight truncate">Adhérents</span>
                  <span className="sm:hidden text-[9px] font-black opacity-80">({totalAdherents})</span>
                </div>
              </button>
            )}

          </nav>
        </div>

      </div>

      {/* ==================== MODALE DE RÉGLAGE SAISON (PROFIL ADMIN) ==================== */}
      {isAdminSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#141820] border border-orange-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/20 text-[#FF6D00] flex items-center justify-center font-bold">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-black text-white text-base">
                    Réglage de la Saison Sportive
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Configuration réservée au profil Administrateur
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAdminSettingsOpen(false)}
                className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-zinc-300 leading-relaxed">
                Ce réglage permet de mettre l'application à jour d'une année sur l'autre :
              </p>
              <ul className="list-disc list-inside space-y-1 text-zinc-400 text-[11px]">
                <li>Met à jour la <strong className="text-orange-400">bulle orange TCM</strong> en haut à gauche (ex : TCM {tempSaison}).</li>
                <li>Actualise le filtre des <strong className="text-emerald-400">licences valides</strong> (colonne X du fichier adhérents).</li>
                <li>Recalcule automatiquement les <strong className="text-blue-400">catégories d'âge FFT</strong> des rencontres interclubs.</li>
              </ul>

              <div className="p-4 bg-[#0d1016] rounded-2xl border border-zinc-800 space-y-3">
                <label className="block text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                  Année de la Saison FFT Active
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tempSaison}
                    onChange={(e) => setTempSaison(e.target.value)}
                    placeholder="ex: 2027, 2028..."
                    className="flex-1 px-3 py-2 rounded-xl bg-[#141820] border border-zinc-700 text-white font-mono font-black text-base focus:border-[#FF6D00] outline-none text-center"
                  />
                  <div className="flex items-center gap-1">
                    {['2026', '2027', '2028', '2029'].map((yr) => (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => setTempSaison(yr)}
                        className={`px-2.5 py-2 rounded-xl font-bold font-mono transition text-xs cursor-pointer ${
                          tempSaison === yr
                            ? 'bg-orange-500/20 text-[#FF6D00] border border-orange-500/50'
                            : 'bg-zinc-800/80 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {yr}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsAdminSettingsOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => handleSaveSaison(tempSaison)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#BF360C] to-[#E65100] hover:brightness-110 text-white text-xs font-black transition shadow-lg shadow-orange-950/50 cursor-pointer flex items-center space-x-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Appliquer la saison {tempSaison}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
