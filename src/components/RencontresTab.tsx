import React, { useState, useMemo } from 'react';
import { 
  Trophy, 
  Calendar, 
  MapPin, 
  Phone, 
  MessageSquare, 
  Mail, 
  Clock, 
  CheckCircle2, 
  Shield, 
  UserCheck, 
  ClipboardList, 
  ShieldAlert, 
  Check, 
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  RefreshCw,
  Lock,
  Info,
  Scale,
  ClipboardCheck,
  Users,
  Award,
  Search,
  Filter,
  X
} from 'lucide-react';
import { Rencontre, Adherent, UserRole } from '../types/tennis';
import { checkFFT2027Eligibility } from '../utils/fftEligibility';
import { getNextFftMonthlyRankingRelease, getWeeklyScheduleInfo } from '../utils/fftCalendar';
import { getCompetitionFormat, validateMatchDateAndSchedule } from '../utils/competitionFormats';
import { getAdverseClubFullAddress, computeMatchRotationSchedule } from '../utils/matchScheduling';
import { normalizeDateString, parseDateToJs } from '../utils/dateUtils';

interface RencontresTabProps {
  rencontres: Rencontre[];
  adherents: Adherent[];
  onOpenCompositionModal: (rencontre: Rencontre) => void;
  onOpenSondageModal?: (rencontre: Rencontre) => void;
  onUpdateMatchHour?: (rencontreId: string, hour: string) => void;
  userRole?: UserRole;
  onRefreshData?: () => void;
  isAutoSyncing?: boolean;
  saison?: string;
}

export const RencontresTab: React.FC<RencontresTabProps> = ({
  rencontres,
  adherents,
  onOpenCompositionModal,
  onOpenSondageModal,
  onUpdateMatchHour,
  userRole = 'bureau',
  onRefreshData,
  isAutoSyncing = false,
  saison = '2027',
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'upcoming' | 'finished'>('all');
  const [filterSexe, setFilterSexe] = useState<'all' | 'H' | 'F'>('all');
  const [filterChampionnat, setFilterChampionnat] = useState<string>('all');
  const [filterCategorieAge, setFilterCategorieAge] = useState<string>('all');
  const [showRulesGuide, setShowRulesGuide] = useState<boolean>(false);
  const [expandedTeamDetails, setExpandedTeamDetails] = useState<Record<string, boolean>>({});

  // Dictionnaire des adhérents pour lookup rapide
  const adherentsById = useMemo(() => {
    const map = new Map<string, Adherent>();
    adherents.forEach(a => map.set(a.id, a));
    return map;
  }, [adherents]);

  // Équipes distinctes
  const uniqueTeams = useMemo(() => {
    const set = new Set<string>();
    rencontres.forEach(r => {
      if (r.numeroEquipe) set.add(r.numeroEquipe);
    });
    return Array.from(set).sort();
  }, [rencontres]);

  // Championnats distincts
  const uniqueChampionnats = useMemo(() => {
    const set = new Set<string>();
    rencontres.forEach(r => {
      const champ = r.libelleHomologation || r.division;
      if (champ && champ.trim()) set.add(champ.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [rencontres]);

  // Catégories d'âge distinctes
  const uniqueCategoriesAge = useMemo(() => {
    const set = new Set<string>();
    rencontres.forEach(r => {
      if (r.categorieAgeHomologation && r.categorieAgeHomologation.trim()) {
        set.add(r.categorieAgeHomologation.trim());
      }
    });
    return Array.from(set).sort();
  }, [rencontres]);

  const filteredRencontres = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return rencontres.filter(r => {
      // 1. Recherche texte (adversaire, ville, capitaine, date...)
      if (q) {
        const adverse = (r.clubVisiteurNom || '').toLowerCase();
        const accueil = (r.clubAccueilNom || '').toLowerCase();
        const capitaine = `${r.prenomCapitaine || ''} ${r.nomCapitaine || ''}`.toLowerCase();
        const equipe = (r.numeroEquipe || '').toLowerCase();
        const division = (r.division || '').toLowerCase();
        const libelle = (r.libelleHomologation || '').toLowerCase();
        const dateStr = (r.dateRencontre || '').toLowerCase();
        if (!adverse.includes(q) && !accueil.includes(q) && !capitaine.includes(q) && !equipe.includes(q) && !division.includes(q) && !libelle.includes(q) && !dateStr.includes(q)) {
          return false;
        }
      }

      // 2. Filtre statut
      const isUpcoming = !r.score || r.score === 'À venir';
      if (filterStatus === 'upcoming' && !isUpcoming) return false;
      if (filterStatus === 'finished' && isUpcoming) return false;

      // 3. Filtre Sexe
      if (filterSexe !== 'all') {
        const s = (r.sexeHomologation || '').toUpperCase();
        const isFemme = s.includes('F') || s.includes('DAME');
        if (filterSexe === 'F' && !isFemme) return false;
        if (filterSexe === 'H' && isFemme) return false;
      }

      // 4. Filtre Championnat
      if (filterChampionnat !== 'all') {
        const champ = (r.libelleHomologation || r.division || '').trim();
        if (champ !== filterChampionnat) return false;
      }

      // 5. Filtre Catégorie d'âge
      if (filterCategorieAge !== 'all') {
        if ((r.categorieAgeHomologation || '').trim() !== filterCategorieAge) return false;
      }

      // 6. Filtre Équipe
      if (filterTeam !== 'all' && r.numeroEquipe !== filterTeam) {
        return false;
      }

      return true;
    });
  }, [rencontres, searchQuery, filterStatus, filterSexe, filterChampionnat, filterCategorieAge, filterTeam]);

  // Rassemblement des rencontres filtrées par date (triées chronologiquement)
  const matchesByDate = useMemo(() => {
    const groupsMap = new Map<string, {
      dateKey: string;
      formattedDate: string;
      timestamp: number;
      matches: Rencontre[];
    }>();

    filteredRencontres.forEach(r => {
      const normDate = normalizeDateString(r.dateRencontre) || 'Date inconnue';
      const jsDate = parseDateToJs(normDate);
      const timestamp = jsDate ? jsDate.getTime() : 0;

      let formatted = normDate;
      if (jsDate) {
        formatted = jsDate.toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      }

      if (!groupsMap.has(normDate)) {
        groupsMap.set(normDate, {
          dateKey: normDate,
          formattedDate: formatted.toUpperCase(),
          timestamp,
          matches: []
        });
      }

      groupsMap.get(normDate)!.matches.push(r);
    });

    return Array.from(groupsMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [filteredRencontres]);

  // Vérifie si une rencontre a une composition complète ou des problèmes
  const getCompositionStatus = (r: Rencontre) => {
    const formatInfo = getCompetitionFormat(r, { formatReduit: r.composition?.formatReduit });
    if (!r.composition) return { count: 0, required: formatInfo.numSingles, isValidated: false, hasIssue: false, doubleWeightIssue: false };

    const c = r.composition;
    const playerIds = [c.simple1Id, c.simple2Id, c.simple3Id, c.simple4Id, c.simple5Id].filter(Boolean) as string[];
    
    let hasIssue = false;
    playerIds.forEach(id => {
      const p = adherentsById.get(id);
      if (p) {
        const check = checkFFT2027Eligibility(p, r);
        if (!check.isEligible) hasIssue = true;
      }
    });

    const doubleWeightIssue = c.poidsDoublesValide === false;
    if (doubleWeightIssue) hasIssue = true;

    return {
      count: playerIds.length,
      required: formatInfo.numSingles,
      isValidated: !!c.valideParCapitaine && !hasIssue,
      hasIssue,
      doubleWeightIssue,
    };
  };

  const toggleTeamDetails = (matchId: string) => {
    setExpandedTeamDetails(prev => ({
      ...prev,
      [matchId]: !prev[matchId]
    }));
  };

  return (
    <div className="space-y-6">
      
      {/* En-tête de section avec synchronisation automatique FFT et Données_appli */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-black font-heading text-white">
              Rencontres par Équipes
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#E65100]/25 text-[#FF6D00] border border-[#E65100]/40">
              {filteredRencontres.length} match{filteredRencontres.length > 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-[#FF6D00]" />
            <span>Championnats Interclubs • Calendrier FFT officiel &amp; Gestion des compositions</span>
          </p>
        </div>

        {/* Badge de synchronisation automatique FFT & Données_appli (Visible uniquement pour Admin) */}
        {userRole === 'admin' && (
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-semibold shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Export FFT &amp; Données_appli synchronisés</span>
            </div>

            {onRefreshData && (
              <button
                onClick={onRefreshData}
                disabled={isAutoSyncing}
                className="p-2 rounded-xl bg-[#181d26] hover:bg-[#222938] text-zinc-300 hover:text-white border border-[#2b3547] transition cursor-pointer shadow-sm disabled:opacity-50"
                title="Rafraîchir les rencontres"
              >
                <RefreshCw className={`w-4 h-4 ${isAutoSyncing ? 'animate-spin text-orange-400' : ''}`} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Alerte Cycle des Mises à Jour & Règles FFT (Réservé au profil Admin) */}
      {userRole === 'admin' && (() => {
        const nextRanking = getNextFftMonthlyRankingRelease();
        const weeklyInfo = getWeeklyScheduleInfo();
        return (
          <div className="space-y-3">
            <div className="p-3.5 bg-gradient-to-r from-[#141820] to-[#12151c] rounded-2xl border border-orange-500/20 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-orange-500/15 text-[#FF6D00] flex items-center justify-center font-bold shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-heading font-black text-white text-xs">
                      Cycle Officiel FFT {saison} :
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      Mise à jour résultats : Chaque Lundi
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Prochaine parution mensuelle FFT : <strong className="text-orange-400">{nextRanking.formattedDate}</strong> (dans {nextRanking.daysRemaining} j).
                    Tout changement de classement le 1er mardi réordonne l'ordre des simples (Simple 1 &ge; Simple 2).
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 text-[11px] self-end md:self-auto shrink-0 text-zinc-400">
                <button
                  onClick={() => setShowRulesGuide(!showRulesGuide)}
                  className="px-3 py-1.5 rounded-xl bg-[#1c222e] hover:bg-[#252d3d] border border-zinc-700 hover:border-orange-500/40 text-orange-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Info className="w-3.5 h-3.5 text-[#FF6D00]" />
                  <span>Règles Formats &amp; Logistique</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showRulesGuide ? 'rotate-180' : ''}`} />
                </button>
                <span className="px-2 py-1 rounded-xl bg-black/40 border border-zinc-800 text-zinc-300">
                  Phase : <strong className="text-white">{weeklyInfo.phase}</strong>
                </span>
              </div>
            </div>

            {/* Guide Accordéon des Formats FFT Bretagne & Logistique TCM */}
            {showRulesGuide && (
              <div className="p-4 bg-[#11141a] rounded-2xl border border-orange-500/30 text-xs space-y-3.5 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <Scale className="w-4 h-4 text-[#FF6D00]" />
                    <span className="font-heading font-black text-white text-sm">
                      Règles Officielles des Championnats par Équipes &amp; Logistique TCM
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400">Ligue de Bretagne &amp; Comité 56 Morbihan</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* 1. Calendrier & Alternance */}
                  <div className="p-3 bg-[#161a22] rounded-xl border border-zinc-800 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-orange-400 font-bold">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>1. Calendrier &amp; Alternance</span>
                    </div>
                    <ul className="text-[11px] text-zinc-300 space-y-1 list-disc list-inside">
                      <li><strong>Seniors+ (+35, +45...)</strong> : Hommes et Femmes jouent le <em>même week-end</em> (dimanche). Pas de championnat jeunes.</li>
                      <li><strong>Championnats Seniors</strong> : 1 week-end Dames le dimanche (&amp; Garçons le samedi d'avant), puis 1 week-end Hommes le dimanche (&amp; Filles le samedi d'avant) hors vacances scolaires.</li>
                      <li><strong>Horaires officiels</strong> : 9h00 ou 14h00.</li>
                      <li><strong>Lieux TCM</strong> : Clos des Moines (2 résines) ; Nivillac en emprunt si 3 équipes à domicile.</li>
                    </ul>
                  </div>

                  {/* 2. Seniors : Divisions & Formats Officiels */}
                  <div className="p-3 bg-[#161a22] rounded-xl border border-zinc-800 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-purple-400 font-bold">
                      <Trophy className="w-3.5 h-3.5" />
                      <span>2. Divisions Seniors</span>
                    </div>
                    <div className="text-[11px] text-zinc-300 space-y-2">
                      <div>
                        <strong className="text-pink-400 block font-heading">Féminin :</strong>
                        <ul className="list-disc list-inside space-y-0.5 text-[10px]">
                          <li><strong>Pré-Régionale</strong> : 4S + 2D (Poids D1 &ge; D2)</li>
                          <li><strong>Division D1</strong> : 4 simples + 1 double</li>
                          <li><strong>Divisions D2 &amp; D3</strong> : 3 simples + 1 double</li>
                        </ul>
                      </div>
                      <div>
                        <strong className="text-blue-400 block font-heading">Masculin :</strong>
                        <ul className="list-disc list-inside space-y-0.5 text-[10px]">
                          <li><strong>Pré-Régionale</strong> : 4S + 2D (Poids D1 &ge; D2)</li>
                          <li><strong>Division D1</strong> : 4S + 2D (Poids D1 &ge; D2)</li>
                          <li><strong>Divisions D2 &amp; D3</strong> : 5 simples + 1 double</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* 3. Ordre des parties & Déroulement à suivre */}
                  <div className="p-3 bg-[#161a22] rounded-xl border border-zinc-800 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-sky-400 font-bold">
                      <Clock className="w-3.5 h-3.5" />
                      <span>3. Ordre des parties</span>
                    </div>
                    <ul className="text-[11px] text-zinc-300 space-y-1 list-disc list-inside">
                      <li><strong>Déroulement à suivre</strong> : Rencontres en continu dès 09H ou 14H (plus de convocation horaire match par match).</li>
                      <li><strong>Jeudi 20H00</strong> : L’ordre est proposé par le capitaine qui se déplace avant jeudi 20h.</li>
                      <li><strong>En cas de désaccord</strong> :
                        <ul className="list-none pl-1 space-y-0.5 text-[10px] text-zinc-400">
                          <li>• <em>Pré-Régional</em> : 4-2, 3-1, doubles (sur 2 courts) OU 4-2, D2, 3-1, D1 sur 1 court (2S / 1D / 2S / 1D).</li>
                          <li>• <em>Hommes D1 / D2 / D3</em> : 4-3-2-1-5 - double (sur 2 courts, le double en même temps que le dernier simple).</li>
                          <li>• <em>Femmes D2 / D3</em> : 1-2-3 - double.</li>
                        </ul>
                      </li>
                      <li><strong>Repos des doubles</strong> : Éviter de placer les joueurs de double en dernier simple.</li>
                      <li><strong>2 terrains de surfaces différentes</strong> : Le capitaine qui reçoit propose au visiteur de choisir le terrain pour chaque simple.</li>
                    </ul>
                  </div>

                  {/* 4. Circulation des joueurs & Règle du N-1 */}
                  <div className="p-3 bg-[#161a22] rounded-xl border border-zinc-800 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <Shield className="w-3.5 h-3.5" />
                      <span>4. Circulation des joueurs</span>
                    </div>
                    <ul className="text-[11px] text-zinc-300 space-y-1 list-disc list-inside">
                      <li><strong className="text-emerald-300">Règle du N-1 (Forfait)</strong> : Permet de pallier un forfait de dernière minute sans changer toutes les équipes. Le remplaçant joue en dernière position.</li>
                      <li><strong>Condition N-1</strong> : L’avant-dernier joueur de l'équipe supérieure doit avoir un <em>classement &ge; au N°1 de l’équipe en dessous</em> (ex: 15/4 &ge; 15/5).</li>
                      <li><strong>Barrages (Phases finales)</strong> : Minimum <strong className="text-amber-300">3 rencontres jouées</strong> à ce niveau.</li>
                      <li><strong>Gel des classements</strong> : Si l'équipe supérieure ne joue pas (ou forfait), ses 4 ou 5 classements sont <strong className="text-rose-300">gelés</strong> pour la journée.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ==================== BARRE DE RECHERCHE & FILTRES MULTI-CRITÈRES ==================== */}
      <div className="bg-[#141820] p-4 rounded-2xl border border-[#252b37] space-y-3 text-xs">
        {/* Ligne 1 : Recherche texte (gauche) & Filtre statut (droite) */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Recherche texte rapide */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par adversaire, ville, capitaine, équipe, date (JJ/MM/AAAA)..."
              className="w-full bg-[#0d1016] border border-zinc-800 rounded-xl pl-10 pr-9 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtre statut : Toutes, À venir, Jouées */}
          <div className="flex items-center p-1 bg-[#0d1016] rounded-xl border border-zinc-800 shrink-0 self-start md:self-auto">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                filterStatus === 'all'
                  ? 'bg-[#E65100] text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Toutes ({rencontres.length})
            </button>
            <button
              onClick={() => setFilterStatus('upcoming')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                filterStatus === 'upcoming'
                  ? 'bg-[#E65100] text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              À venir
            </button>
            <button
              onClick={() => setFilterStatus('finished')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                filterStatus === 'finished'
                  ? 'bg-[#E65100] text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Jouées
            </button>
          </div>
        </div>

        {/* Ligne 2 : Filtres demandés : Championnat, Sexe, Catégorie d'âge, Équipe */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-zinc-800/80">
          
          {/* 1. Championnat */}
          <div>
            <label className="text-[10px] text-zinc-400 block mb-1 font-semibold">Championnat</label>
            <select
              value={filterChampionnat}
              onChange={(e) => setFilterChampionnat(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-[#0d1016] border border-zinc-800 text-white text-xs focus:border-[#FF6D00] outline-none cursor-pointer truncate"
            >
              <option value="all">Tous championnats</option>
              {uniqueChampionnats.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* 2. Sexe */}
          <div>
            <label className="text-[10px] text-zinc-400 block mb-1 font-semibold">Sexe / Épreuve</label>
            <select
              value={filterSexe}
              onChange={(e) => setFilterSexe(e.target.value as any)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-[#0d1016] border border-zinc-800 text-white text-xs focus:border-[#FF6D00] outline-none cursor-pointer"
            >
              <option value="all">Tous (Hommes & Femmes)</option>
              <option value="H">Hommes (Messieurs)</option>
              <option value="F">Femmes (Dames)</option>
            </select>
          </div>

          {/* 3. Catégorie d'âge */}
          <div>
            <label className="text-[10px] text-zinc-400 block mb-1 font-semibold">Catégorie d'âge</label>
            <select
              value={filterCategorieAge}
              onChange={(e) => setFilterCategorieAge(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-[#0d1016] border border-zinc-800 text-white text-xs focus:border-[#FF6D00] outline-none cursor-pointer"
            >
              <option value="all">Toutes catégories</option>
              {uniqueCategoriesAge.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* 4. Équipe TCM */}
          <div>
            <label className="text-[10px] text-zinc-400 block mb-1 font-semibold">Équipe Club</label>
            <select
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-[#0d1016] border border-zinc-800 text-white text-xs focus:border-[#FF6D00] outline-none cursor-pointer"
            >
              <option value="all">Toutes les équipes</option>
              {uniqueTeams.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

        </div>

        {/* Ligne 3 : Indicateur filtres actifs & réinitialisation */}
        {(searchQuery || filterChampionnat !== 'all' || filterSexe !== 'all' || filterCategorieAge !== 'all' || filterTeam !== 'all' || filterStatus !== 'all') && (
          <div className="flex items-center justify-between pt-1 text-[11px] text-orange-400">
            <span>Filtre actif : {filteredRencontres.length} rencontre{filteredRencontres.length > 1 ? 's' : ''} trouvée{filteredRencontres.length > 1 ? 's' : ''} sur {rencontres.length}</span>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterChampionnat('all');
                setFilterSexe('all');
                setFilterCategorieAge('all');
                setFilterTeam('all');
                setFilterStatus('all');
              }}
              className="text-zinc-400 hover:text-white underline cursor-pointer"
            >
              Réinitialiser tous les filtres
            </button>
          </div>
        )}
      </div>

      {/* ==================== RENCONTRES GROUPÉES PAR DATE (EN PLUS GROS) ==================== */}
      {matchesByDate.length > 0 ? (
        <div className="space-y-8">
          {matchesByDate.map((dateGroup) => (
            <div key={dateGroup.dateKey} className="space-y-3.5">
              
              {/* En-tête de date EN PLUS GROS */}
              <div className="flex items-center justify-between border-b-2 border-orange-500/40 pb-2.5 pt-2">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-orange-500/15 border border-orange-500/30 text-[#FF6D00] flex items-center justify-center font-black shadow-md shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-xl font-heading font-black text-white uppercase tracking-tight">
                      {dateGroup.formattedDate}
                    </h2>
                    <p className="text-[11px] text-zinc-400">
                      {dateGroup.matches.length} rencontre{dateGroup.matches.length > 1 ? 's' : ''} programmée{dateGroup.matches.length > 1 ? 's' : ''} ce jour
                    </p>
                  </div>
                </div>

                <span className="px-3 py-1 rounded-xl text-xs font-black bg-orange-500/10 text-orange-400 border border-orange-500/25">
                  {dateGroup.dateKey}
                </span>
              </div>

              {/* Disposition par 3 des cartes de cette date */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dateGroup.matches.map((r) => {
            const isUpcoming = !r.score || r.score === 'À venir';
            const isHome = r.clubAccueilNom.toLowerCase().includes('muzillac');
            const formatInfo = getCompetitionFormat(r, { formatReduit: r.composition?.formatReduit });
            const normalizedDate = normalizeDateString(r.dateRencontre);
            const dateValidation = validateMatchDateAndSchedule(normalizedDate, formatInfo, r.sexeHomologation);
            const compStatus = getCompositionStatus(r);
            const adverseAddressInfo = getAdverseClubFullAddress(r);
            const effectiveVenue = r.composition?.lieuRencontre || (isHome ? 'Clos des Moines (TCM)' : adverseAddressInfo.venueLabel);
            const matchHour = r.composition?.heureDebut || '14:00';
            const matchCourts = r.composition?.nombreCourts || 2;
            const schedulePlan = computeMatchRotationSchedule(matchHour, matchCourts, formatInfo, r.composition, adherentsById);
            const isDetailsOpen = !!expandedTeamDetails[r.id];

            // Récupération des joueurs de la composition
            const comp = r.composition;
            const registeredSingles: { slot: number; player?: Adherent }[] = [];
            if (comp) {
              for (let s = 1; s <= formatInfo.numSingles; s++) {
                const pid = (comp as any)[`simple${s}Id`];
                registeredSingles.push({
                  slot: s,
                  player: pid ? adherentsById.get(pid) : undefined
                });
              }
            }

            const registeredDouble1 = comp?.double1Player1Id && comp?.double1Player2Id
              ? { p1: adherentsById.get(comp.double1Player1Id), p2: adherentsById.get(comp.double1Player2Id) }
              : null;
            const registeredDouble2 = comp?.double2Player1Id && comp?.double2Player2Id
              ? { p1: adherentsById.get(comp.double2Player1Id), p2: adherentsById.get(comp.double2Player2Id) }
              : null;

            // Nombre de réponses au sondage
            const dispoResponses = r.disponibilites || [];
            const dispoCount = dispoResponses.filter(d => d.statut === 'disponible').length;
            
            // Calcul indicatif du score
            let isWin = false;
            let isLoss = false;
            if (!isUpcoming && r.score.includes('/')) {
              const parts = r.score.split('/');
              const s1 = parseInt(parts[0], 10);
              const s2 = parseInt(parts[1], 10);
              if (!isNaN(s1) && !isNaN(s2)) {
                if (isHome) {
                  isWin = s1 > s2;
                  isLoss = s1 < s2;
                } else {
                  isWin = s2 > s1;
                  isLoss = s2 < s1;
                }
              }
            }

            return (
              <div 
                key={r.id}
                className="bg-[#161a22] hover:bg-[#191f2a] border border-[#272e3b] hover:border-[#E65100]/50 rounded-3xl p-4 transition-all shadow-md flex flex-col justify-between space-y-3.5 group"
              >
                <div className="space-y-3">
                  {/* Ligne 1 : Équipe, Catégorie, Sexe & Domicile/Déplacement */}
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full font-black bg-[#E65100]/25 text-[#FF6D00] border border-[#E65100]/40 text-xs">
                        {r.numeroEquipe}
                      </span>
                      <span className={`font-black text-[10px] px-2 py-0.5 rounded border ${
                        r.sexeHomologation === 'Dames' 
                          ? 'bg-pink-500/20 text-pink-300 border-pink-500/40' 
                          : r.sexeHomologation === 'Mixte' 
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' 
                            : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      }`}>
                        {r.sexeHomologation === 'Dames' ? 'Dames' : r.sexeHomologation === 'Messieurs' ? 'Messieurs' : 'Mixte'}
                      </span>
                      <span className="font-bold text-white px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px]">
                        {r.categorieAgeHomologation}
                      </span>
                      {r.journee && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-zinc-800 text-zinc-300 border border-zinc-700">
                          {r.journee}
                        </span>
                      )}
                    </div>

                    <span className={`px-2 py-0.5 rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0 ${
                      isHome 
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' 
                        : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                    }`}>
                      {isHome ? '🏠 Domicile' : '🚗 Déplacement'}
                    </span>
                  </div>

                  {/* Ligne 2 : Date & Format officiel FFT */}
                  <div className="flex items-center justify-between gap-1.5 text-xs flex-wrap">
                    <span className="text-zinc-300 flex items-center gap-1.5 font-semibold bg-[#12151b] px-2.5 py-1 rounded-xl border border-zinc-800 text-[11px]">
                      <Calendar className="w-3.5 h-3.5 text-orange-400" />
                      <span>{normalizedDate}</span>
                      {dateValidation.dayName && (
                        <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
                          dateValidation.isValidDay
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {dateValidation.dayName}
                        </span>
                      )}
                    </span>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                      formatInfo.numDoubles === 2
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                        : formatInfo.isSeniorsPlus
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : formatInfo.isJeunes
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : r.sexeHomologation === 'Dames'
                              ? 'bg-pink-500/20 text-pink-300 border-pink-500/40'
                              : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    }`}>
                      {formatInfo.numSingles}S + {formatInfo.numDoubles}D
                      {formatInfo.divisionLabel ? ` • ${formatInfo.divisionLabel}` : ''}
                    </span>
                  </div>

                  {/* Ligne 3 : Confrontation & Score */}
                  <div className="bg-[#11141a] p-3 rounded-2xl border border-[#232934] flex items-center justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-black truncate ${
                          r.clubAccueilNom.toLowerCase().includes('muzillac')
                            ? 'text-[#FF6D00]'
                            : 'text-zinc-200'
                        }`}>
                          {r.clubAccueilNom}
                        </span>
                        {isHome && (
                          <span className="text-[9px] text-zinc-500 uppercase font-bold shrink-0 ml-1">Dom</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-black truncate ${
                          r.clubVisiteurNom.toLowerCase().includes('muzillac')
                            ? 'text-[#FF6D00]'
                            : 'text-zinc-200'
                        }`}>
                          {r.clubVisiteurNom}
                        </span>
                        {!isHome && (
                          <span className="text-[9px] text-zinc-500 uppercase font-bold shrink-0 ml-1">Ext</span>
                        )}
                      </div>
                    </div>

                    {/* Badge Score */}
                    <div className="shrink-0 text-center">
                      <div className={`px-2.5 py-1 rounded-xl text-xs font-heading font-black border ${
                        isUpcoming 
                          ? 'bg-[#1b2029] text-zinc-400 border-zinc-700' 
                          : isWin 
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-950/40' 
                            : isLoss 
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' 
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      }`}>
                        {r.score || 'À venir'}
                      </div>
                      {!isUpcoming && (
                        <span className="text-[9px] font-bold uppercase tracking-wider block mt-0.5 text-zinc-400">
                          {r.vainqueur ? r.vainqueur : isWin ? 'Victoire TCM' : isLoss ? 'Défaite' : 'Score'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ligne 4 : Logistique TCM (Horaire rapide, Lieu, Rotations) */}
                  <div className="flex flex-col gap-1.5 text-xs bg-[#12151b]/80 p-2.5 rounded-2xl border border-zinc-800/80">
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1.5 text-zinc-300 text-[11px]">
                        <Clock className="w-3 h-3 text-orange-400 shrink-0" />
                        <span className="text-zinc-400">Horaire :</span>
                        <strong className="text-white font-mono">{matchHour}</strong>
                      </div>

                      {/* Sélecteur rapide 9h00 / 14h00 */}
                      {onUpdateMatchHour && (
                        <div className="flex items-center space-x-1 bg-black/50 p-0.5 rounded-lg border border-zinc-700/80">
                          <button
                            onClick={() => onUpdateMatchHour(r.id, '09:00')}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition cursor-pointer ${
                              matchHour === '09:00' 
                                ? 'bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white shadow' 
                                : 'text-zinc-400 hover:text-white'
                            }`}
                            title="Fixer à 9h00"
                          >
                            9h
                          </button>
                          <button
                            onClick={() => onUpdateMatchHour(r.id, '14:00')}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition cursor-pointer ${
                              matchHour === '14:00' 
                                ? 'bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white shadow' 
                                : 'text-zinc-400 hover:text-white'
                            }`}
                            title="Fixer à 14h00"
                          >
                            14h
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="text-[11px] text-zinc-400 flex items-center justify-between gap-1.5">
                      <span className="flex items-center gap-1 min-w-0">
                        <MapPin className="w-3 h-3 text-zinc-400 shrink-0" />
                        <strong className="text-white truncate" title={effectiveVenue}>
                          {effectiveVenue}
                        </strong>
                      </span>
                      <span className="shrink-0 text-[10px] text-zinc-400 font-mono">
                        {r.composition?.nombreCourts ? `${r.composition.nombreCourts} courts` : '2 courts'}
                      </span>
                    </div>

                    {/* Aperçu rotations */}
                    <div className="text-[10px] text-zinc-300 bg-black/40 px-2 py-1 rounded-lg flex items-center gap-1.5 overflow-hidden">
                      <Clock className="w-3 h-3 text-orange-400 shrink-0" />
                      <span className="font-mono text-orange-200 truncate">
                        {schedulePlan.rotations.map(rot => `${rot.timeSlot} [${rot.matches.map(m => m.matchLabel).join(',')}]`).join(' • ')}
                      </span>
                    </div>
                  </div>

                  {/* Ligne 5 : Module Composition & Sondage */}
                  <div className="p-3 bg-[#13161c] rounded-2xl border border-[#232934] space-y-2.5">
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <div className="flex items-center space-x-1.5">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold shrink-0 ${
                          compStatus.hasIssue 
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' 
                            : compStatus.isValidated 
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                              : 'bg-orange-500/15 text-[#FF6D00] border border-orange-500/30'
                        }`}>
                          <ClipboardList className="w-3 h-3" />
                        </div>
                        <span className="font-bold text-white text-[11px]">Équipe :</span>
                      </div>

                      {compStatus.doubleWeightIssue ? (
                        <span className="text-[9px] px-2 py-0.2 rounded font-black bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          Poids D1 &lt; D2
                        </span>
                      ) : compStatus.hasIssue ? (
                        <span className="text-[9px] px-2 py-0.2 rounded font-black bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          Inéligible
                        </span>
                      ) : compStatus.isValidated ? (
                        <span className="text-[9px] px-2 py-0.2 rounded font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Validée FFT
                        </span>
                      ) : compStatus.count > 0 ? (
                        <span className="text-[9px] px-2 py-0.2 rounded font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          En cours ({compStatus.count}/{compStatus.required})
                        </span>
                      ) : (
                        <span className="text-[9px] text-zinc-500">Non renseignée</span>
                      )}
                    </div>

                    {/* 2 Boutons d'action adaptés à la disposition par 3 */}
                    <div className="grid grid-cols-2 gap-2">
                      {onOpenSondageModal && (
                        <button
                          onClick={() => onOpenSondageModal(r)}
                          className={`px-2 py-1.5 rounded-xl border text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm ${
                            dispoCount > 0
                              ? 'bg-emerald-950/40 hover:bg-emerald-900/50 border-emerald-500/50 text-emerald-300 hover:text-white'
                              : 'bg-[#1b202a] hover:bg-[#232936] border-zinc-700 text-zinc-300 hover:text-white'
                          }`}
                          title="Sondage des disponibilités des joueurs"
                        >
                          <ClipboardCheck className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                          <span className="truncate">
                            Sondage {dispoCount > 0 ? `(${dispoCount})` : ''}
                          </span>
                        </button>
                      )}

                      <button
                        onClick={() => onOpenCompositionModal(r)}
                        className={`px-2 py-1.5 rounded-xl bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white text-[11px] font-bold transition flex items-center justify-center gap-1 shadow-sm cursor-pointer hover:brightness-110 ${
                          !onOpenSondageModal ? 'col-span-2' : ''
                        }`}
                      >
                        <span className="truncate">
                          {userRole === 'adherent' ? 'Voir l\'équipe' : compStatus.isValidated ? 'Modifier' : 'Composer'}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                      </button>
                    </div>

                    {/* Joueurs enregistrés par le capitaine */}
                    {compStatus.count > 0 && (
                      <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            <span>Joueurs ({compStatus.count}) :</span>
                          </span>
                          <button
                            onClick={() => toggleTeamDetails(r.id)}
                            className="text-[9px] font-bold text-zinc-400 hover:text-white flex items-center gap-0.5 cursor-pointer"
                          >
                            <span>{isDetailsOpen ? 'Réduire' : 'Détails'}</span>
                            <ChevronDown className={`w-3 h-3 transition-transform ${isDetailsOpen ? 'rotate-180' : ''}`} />
                          </button>
                        </div>

                        {/* Grille compacte des joueurs */}
                        <div className="grid grid-cols-2 gap-1 text-[10px]">
                          {registeredSingles.filter(s => isDetailsOpen || s.player).map(({ slot, player }) => (
                            <div 
                              key={slot}
                              className={`p-1.5 rounded-lg border flex flex-col justify-between ${
                                player 
                                  ? 'bg-black/40 border-zinc-700/80' 
                                  : 'bg-black/20 border-zinc-800/40 text-zinc-500'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-black text-zinc-400 uppercase text-[9px]">S{slot}</span>
                                <span className="font-mono text-orange-300 font-bold text-[9px]">{player ? player.dernierClassTennis : '-'}</span>
                              </div>
                              <span className="font-bold text-white truncate mt-0.5">{player ? player.nomPrenom : 'Non désigné'}</span>
                            </div>
                          ))}

                          {registeredDouble1 && (
                            <div className="p-1.5 rounded-lg bg-purple-950/20 border border-purple-500/30 col-span-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black uppercase text-purple-300">Double 1</span>
                                <span className="font-mono text-purple-300 text-[9px]">
                                  [{registeredDouble1.p1?.dernierClassTennis || '-'} / {registeredDouble1.p2?.dernierClassTennis || '-'}]
                                </span>
                              </div>
                              <p className="font-bold text-white truncate text-[10px] mt-0.5">
                                {registeredDouble1.p1?.nomPrenom} &amp; {registeredDouble1.p2?.nomPrenom}
                              </p>
                            </div>
                          )}

                          {registeredDouble2 && (
                            <div className="p-1.5 rounded-lg bg-purple-950/20 border border-purple-500/30 col-span-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black uppercase text-purple-300">Double 2</span>
                                <span className="font-mono text-purple-300 text-[9px]">
                                  [{registeredDouble2.p1?.dernierClassTennis || '-'} / {registeredDouble2.p2?.dernierClassTennis || '-'}]
                                </span>
                              </div>
                              <p className="font-bold text-white truncate text-[10px] mt-0.5">
                                {registeredDouble2.p1?.nomPrenom} &amp; {registeredDouble2.p2?.nomPrenom}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pied de carte : Capitaine TCM & Contact */}
                <div className="pt-2 border-t border-[#232934] flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center space-x-1.5 text-zinc-400 min-w-0">
                    <UserCheck className="w-3.5 h-3.5 text-[#FF6D00] shrink-0" />
                    <strong className="text-white text-[11px] truncate" title={r.nomCapitaine ? `${r.prenomCapitaine || ''} ${r.nomCapitaine}` : 'Capitaine TCM'}>
                      {r.prenomCapitaine ? `${r.prenomCapitaine} ${r.nomCapitaine}` : (r.nomCapitaine || 'Non désigné')}
                    </strong>
                  </div>

                  {r.portableCapitaine && (
                    <div className="inline-flex items-center space-x-1 shrink-0">
                      <a
                        href={`tel:${r.portableCapitaine}`}
                        className="p-1 rounded-lg bg-[#12151b] hover:bg-emerald-500/20 text-zinc-300 hover:text-emerald-400 border border-[#252b37] transition flex items-center gap-1 px-1.5 text-[10px] font-bold"
                        title="Appeler le capitaine TCM"
                      >
                        <Phone className="w-3 h-3" />
                      </a>
                      <a
                        href={`sms:${r.portableCapitaine}`}
                        className="p-1 rounded-lg bg-[#12151b] hover:bg-sky-500/20 text-zinc-300 hover:text-sky-400 border border-[#252b37] transition flex items-center gap-1 px-1.5 text-[10px] font-bold"
                        title="SMS au capitaine TCM"
                      >
                        <MessageSquare className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      </div>
    ))}
  </div>
) : (
  <div className="p-12 text-center bg-[#141820] rounded-3xl border border-[#252b37] max-w-md mx-auto">
    <Trophy className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
    <h3 className="font-heading font-black text-white text-base">Aucune rencontre trouvée</h3>
    <p className="text-xs text-zinc-400 mt-1">
      Aucune rencontre ne correspond à vos filtres sélectionnés.
    </p>
  </div>
)}
    </div>
  );
};
