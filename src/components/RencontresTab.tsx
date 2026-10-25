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
  Plus, 
  Shield, 
  UserCheck, 
  ClipboardList, 
  ShieldAlert, 
  Check, 
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  FileSpreadsheet,
  Lock,
  Info,
  Scale
} from 'lucide-react';
import { Rencontre, Adherent, UserRole } from '../types/tennis';
import { checkFFT2027Eligibility } from '../utils/fftEligibility';
import { getNextFftMonthlyRankingRelease, getWeeklyScheduleInfo } from '../utils/fftCalendar';
import { getCompetitionFormat, validateMatchDateAndSchedule } from '../utils/competitionFormats';
import { getAdverseClubFullAddress, computeMatchRotationSchedule } from '../utils/matchScheduling';

interface RencontresTabProps {
  rencontres: Rencontre[];
  adherents: Adherent[];
  onOpenNewMatchModal: () => void;
  onOpenCompositionModal: (rencontre: Rencontre) => void;
  onOpenGsheetModal?: (tab?: 'mapping' | 'import_adherents' | 'import_rencontres' | 'soldes') => void;
  onOpenGoogleSyncModal?: () => void;
  isGoogleConnected?: boolean;
  userRole?: UserRole;
}

export const RencontresTab: React.FC<RencontresTabProps> = ({
  rencontres,
  adherents,
  onOpenNewMatchModal,
  onOpenCompositionModal,
  onOpenGsheetModal,
  onOpenGoogleSyncModal,
  isGoogleConnected,
  userRole = 'bureau',
}) => {
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'upcoming' | 'finished'>('all');
  const [showRulesGuide, setShowRulesGuide] = useState<boolean>(false);

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
    return Array.from(set);
  }, [rencontres]);

  const filteredRencontres = useMemo(() => {
    return rencontres.filter(r => {
      if (filterTeam !== 'all' && r.numeroEquipe !== filterTeam) {
        return false;
      }

      const isUpcoming = !r.score || r.score === 'À venir';
      if (filterStatus === 'upcoming' && !isUpcoming) return false;
      if (filterStatus === 'finished' && isUpcoming) return false;

      return true;
    });
  }, [rencontres, filterTeam, filterStatus]);

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

  return (
    <div className="space-y-6">
      
      {/* En-tête de section avec rappel FFT 2027 */}
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
            <span>Championnats Interclubs • Module de composition & éligibilité FFT Millésime 2027</span>
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {onOpenGoogleSyncModal && (
            <button
              onClick={onOpenGoogleSyncModal}
              className={`inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition shadow-sm cursor-pointer ${
                isGoogleConnected
                  ? 'bg-emerald-950/40 hover:bg-emerald-900/50 border-emerald-500/50 text-emerald-300 hover:text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white'
              }`}
              title="Accéder directement au fichier Données_appli sans import/export CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>{isGoogleConnected ? 'Données_appli Connecté' : 'Connecter Données_appli (sans CSV)'}</span>
            </button>
          )}

          {onOpenGsheetModal && (
            <button
              onClick={() => onOpenGsheetModal('import_rencontres')}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-orange-950/40 hover:bg-orange-900/50 border border-orange-500/40 text-orange-300 hover:text-orange-200 text-xs font-bold transition shadow-sm cursor-pointer"
              title="Cartographie des 41 colonnes Rencontres"
            >
              <FileSpreadsheet className="w-4 h-4 text-orange-400" />
              <span>Colonnes Rencontres</span>
            </button>
          )}

          <button
            onClick={onOpenNewMatchModal}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[#1d222c] hover:bg-[#272d3a] border border-[#2d3443] text-zinc-200 hover:text-white text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#FF6D00]" />
            <span>Ajouter une rencontre</span>
          </button>
        </div>
      </div>

      {/* Alerte Cycle des Mises à Jour & Classements Mensuels */}
      {(() => {
        const nextRanking = getNextFftMonthlyRankingRelease();
        const weeklyInfo = getWeeklyScheduleInfo();
        return (
          <div className="space-y-3">
            <div className="p-3.5 bg-gradient-to-r from-[#141820] to-[#12151c] rounded-2xl border border-orange-500/20 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-xl bg-orange-500/15 border border-orange-500/30 text-[#FF6D00] flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-heading font-black text-white text-xs sm:text-sm">
                      Cycle des Rencontres & Classements FFT
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
                  <span>Règles Formats & Logistique</span>
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
                      Règles Officielles des Championnats par Équipes & Logistique TCM
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400">Ligue de Bretagne & Comité 56 Morbihan</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* 1. Calendrier & Alternance */}
                  <div className="p-3 bg-[#161a22] rounded-xl border border-zinc-800 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-orange-400 font-bold">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>1. Calendrier & Alternance</span>
                    </div>
                    <ul className="text-[11px] text-zinc-300 space-y-1 list-disc list-inside">
                      <li><strong>Seniors+ (+35, +45...)</strong> : Hommes et Femmes jouent le <em>même week-end</em> (dimanche). Pas de championnat jeunes.</li>
                      <li><strong>Championnats Seniors</strong> : 1 week-end Dames le dimanche (&amp; Garçons le samedi d'avant), puis 1 week-end Hommes le dimanche (&amp; Filles le samedi d'avant) hors vacances scolaires.</li>
                      <li><strong>Horaires officiels</strong> : 9h00 ou 14h00.</li>
                      <li><strong>Lieux TCM</strong> : Clos des Moines (2 résines) ; Nivillac en emprunt si 3 équipes à domicile.</li>
                    </ul>
                  </div>

                  {/* 2. Seniors : Divisions & Formats Officiels 2027 */}
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
                          <li><strong>Divisions D2 & D3</strong> : 3 simples + 1 double</li>
                        </ul>
                      </div>
                      <div>
                        <strong className="text-blue-400 block font-heading">Masculin :</strong>
                        <ul className="list-disc list-inside space-y-0.5 text-[10px]">
                          <li><strong>Pré-Régionale</strong> : 4S + 2D (Poids D1 &ge; D2)</li>
                          <li><strong>Division D1 (2027)</strong> : 4S + 2D (Poids D1 &ge; D2)</li>
                          <li><strong>Divisions D2 & D3</strong> : 5 simples + 1 double</li>
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
                      <li><strong>Déroulement à suivre</strong> : Rencontres en continu à partir de 09H ou 14H (plus de convocation horaire match par match).</li>
                      <li><strong>Jeudi 20H00</strong> : L’ordre est proposé par le capitaine qui se déplace avant le jeudi 20h précédant la rencontre.</li>
                      <li><strong>En cas de désaccord</strong> :
                        <ul className="list-none pl-1 space-y-0.5 text-[10px] text-zinc-400">
                          <li>• <em>Pré-Régional (F & H)</em> : 4-2, 3-1, doubles (sur 2 courts) OU 4-2, D2, 3-1, D1 sur 1 court (2S / 1D / 2S / 1D).</li>
                          <li>• <em>Hommes D1 / D2 / D3</em> : 4-3-2-1-5 - double (sur 2 courts, le double en même temps que le dernier simple).</li>
                          <li>• <em>Femmes D2 / D3</em> : 1-2-3 - double.</li>
                        </ul>
                      </li>
                      <li><strong>Repos des doubles</strong> : Éviter de placer les joueurs de double en dernier simple (droit d'attendre la fin de son match).</li>
                      <li><strong>2 terrains de surfaces différentes</strong> : Le capitaine qui reçoit propose au visiteur de choisir le terrain pour chaque simple (ex: 4 & 2 sur résine, 3 & 1 sur omnisport).</li>
                    </ul>
                  </div>

                  {/* 4. Circulation des joueurs & Règle du N-1 */}
                  <div className="p-3 bg-[#161a22] rounded-xl border border-zinc-800 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <Shield className="w-3.5 h-3.5" />
                      <span>4. Circulation des joueurs</span>
                    </div>
                    <ul className="text-[11px] text-zinc-300 space-y-1 list-disc list-inside">
                      <li><strong className="text-emerald-300">Règle du N-1 (Forfait)</strong> : Permet de pallier un forfait de dernière minute (veille/avant-veille) sans changer toutes les équipes. Le remplaçant joue en dernière position.</li>
                      <li><strong>Condition N-1</strong> : L’avant-dernier joueur de l'équipe supérieure doit avoir un <em>classement &ge; au N°1 de l’équipe en dessous</em> (ex: A: 15/2, 15/4, 15/4, 30/4 remplaçant valide car 15/4 &ge; 15/5 de B).</li>
                      <li><strong>Barrages (Phases finales)</strong> : Minimum <strong className="text-amber-300">3 rencontres jouées</strong> à ce niveau pour être autorisé à jouer en barrage.</li>
                      <li><strong>Gel des classements</strong> : Si l'équipe supérieure ne joue pas (ou gagne par forfait), ses 4 ou 5 classements sont <strong className="text-rose-300">gelés</strong> pour la journée.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Filtres par statut et par équipe */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        
        {/* Filtre statut (Tous, À venir, Terminés) */}
        <div className="flex items-center p-1 bg-[#141820] rounded-2xl border border-[#252b37] text-xs">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
              filterStatus === 'all'
                ? 'bg-[#E65100] text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Toutes ({rencontres.length})
          </button>
          <button
            onClick={() => setFilterStatus('upcoming')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
              filterStatus === 'upcoming'
                ? 'bg-[#E65100] text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            À venir
          </button>
          <button
            onClick={() => setFilterStatus('finished')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
              filterStatus === 'finished'
                ? 'bg-[#E65100] text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Jouées
          </button>
        </div>

        {/* Filtres par équipes */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full text-xs">
          <button
            onClick={() => setFilterTeam('all')}
            className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition cursor-pointer ${
              filterTeam === 'all'
                ? 'bg-[#E65100]/20 text-[#FF6D00] border border-[#E65100]/40'
                : 'bg-[#141820] text-zinc-400 hover:text-white border border-[#242a36]'
            }`}
          >
            Toutes équipes
          </button>

          {uniqueTeams.map(team => (
            <button
              key={team}
              onClick={() => setFilterTeam(team)}
              className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition cursor-pointer ${
                filterTeam === team
                  ? 'bg-[#E65100]/20 text-[#FF6D00] border border-[#E65100]/40'
                  : 'bg-[#141820] text-zinc-400 hover:text-white border border-[#242a36]'
              }`}
            >
              {team}
            </button>
          ))}
        </div>

      </div>

      {/* Liste des fiches de rencontre */}
      <div className="space-y-4">
        {filteredRencontres.length > 0 ? (
          filteredRencontres.map((r) => {
            const isUpcoming = !r.score || r.score === 'À venir';
            const isHome = r.clubAccueilNom.toLowerCase().includes('muzillac');
            const formatInfo = getCompetitionFormat(r, { formatReduit: r.composition?.formatReduit });
            const dateValidation = validateMatchDateAndSchedule(r.dateRencontre, formatInfo, r.sexeHomologation);
            const compStatus = getCompositionStatus(r);
            const adverseAddressInfo = getAdverseClubFullAddress(r);
            const effectiveVenue = r.composition?.lieuRencontre || (isHome ? 'Clos des Moines (TCM)' : adverseAddressInfo.venueLabel);
            const matchHour = r.composition?.heureDebut || '14:00';
            const matchCourts = r.composition?.nombreCourts || 2;
            const schedulePlan = computeMatchRotationSchedule(matchHour, matchCourts, formatInfo, r.composition, adherentsById);
            
            // Calcul indicatif du résultat si le score est sous la forme X/Y
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
                className="bg-[#171b22] border border-[#272e3b] hover:border-[#E65100]/50 rounded-3xl p-4 sm:p-5 transition-all shadow-md space-y-4"
              >
                {/* En-tête de la rencontre avec Homologation, Sexe, Catégorie, Division & Poule */}
                <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full font-black bg-[#E65100]/25 text-[#FF6D00] border border-[#E65100]/40">
                      {r.numeroEquipe}
                    </span>

                    {/* Badge Format Officiel FFT / Bretagne par Division */}
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
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
                      {formatInfo.doubleWeightStrict ? ' (Poids D1 ≥ D2)' : ''}
                      {formatInfo.divisionLabel ? ` • ${formatInfo.divisionLabel}` : ''}
                    </span>

                    {r.journee && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {r.journee}
                      </span>
                    )}
                    <span className="font-bold text-white px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-xs">
                      {r.categorieAgeHomologation}
                    </span>
                    <span className={`font-black text-xs px-2 py-0.5 rounded border ${
                      r.sexeHomologation === 'Dames' 
                        ? 'bg-pink-500/20 text-pink-300 border-pink-500/40' 
                        : r.sexeHomologation === 'Mixte' 
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' 
                          : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    }`}>
                      {r.sexeHomologation === 'Dames' ? 'Dames (F)' : r.sexeHomologation === 'Messieurs' ? 'Messieurs (H)' : 'Mixte'}
                    </span>
                    {(r.division || r.poule) && (
                      <span className="text-[11px] text-zinc-400 font-medium">
                        {r.division} {r.poule ? `• ${r.poule}` : ''}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-zinc-300 flex items-center gap-1.5 font-semibold bg-[#12151b] px-2.5 py-1 rounded-xl border border-zinc-800">
                      <Calendar className="w-3.5 h-3.5 text-orange-400" />
                      <span>{r.dateRencontre}</span>
                      {dateValidation.dayName && (
                        <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                          dateValidation.isValidDay
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {dateValidation.dayName}
                        </span>
                      )}
                    </span>
                    <span className={`px-2 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                      isHome 
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' 
                        : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                    }`}>
                      {isHome ? '🏠 Domicile' : '🚗 Déplacement'}
                    </span>
                  </div>
                </div>

                {/* Logistique TCM : Heure de démarrage, Lieu & Nombre de courts */}
                <div className="flex flex-col gap-2 text-xs bg-[#12151b]/80 p-2.5 rounded-xl border border-zinc-800/80">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-zinc-400 flex items-center gap-1 font-medium">
                        <Clock className="w-3.5 h-3.5 text-zinc-400" />
                        <span>À suivre dès :</span>
                        <strong className="text-white">
                          {r.composition?.heureDebut || '14:00 (ou 09:00)'}
                        </strong>
                      </span>

                      <span className="text-zinc-600">•</span>

                      <span className="text-zinc-400 flex items-center gap-1 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span>Lieu :</span>
                        <strong className="text-white truncate max-w-xs" title={effectiveVenue}>
                          {effectiveVenue}
                        </strong>
                      </span>

                      <span className="text-zinc-600">•</span>

                      <span className="text-zinc-400 font-medium">
                        <span>Courts : </span>
                        <strong className="text-white">
                          {r.composition?.nombreCourts ? `${r.composition.nombreCourts} courts` : (isHome ? '2 courts résine' : '2 courts')}
                        </strong>
                      </span>
                    </div>

                    <div className="text-[11px] text-zinc-400 font-medium shrink-0 flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500 font-mono">Jeudi 20h : Choix visiteur</span>
                      <span>{dateValidation.alternationMessage}</span>
                    </div>
                  </div>

                  {/* Aperçu des créneaux de rotation */}
                  <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-300 bg-black/40 px-2 py-1 rounded-lg overflow-x-auto">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Clock className="w-3 h-3 text-orange-400 shrink-0" />
                      <span className="text-zinc-400 shrink-0 font-medium">À suivre :</span>
                      <span className="font-mono text-orange-200 truncate">
                        {schedulePlan.rotations.map(rot => `${rot.timeSlot} [${rot.matches.map(m => m.matchLabel).join(', ')}]`).join(' • ')}
                      </span>
                    </div>

                    {schedulePlan.fatigueRisk?.hasRisk && (
                      <span className="shrink-0 text-[10px] px-2 py-0.2 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1" title={schedulePlan.fatigueRisk.message}>
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        <span>{schedulePlan.fatigueRisk.playerName} (Double &amp; dernier simple)</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Libellé homologation FFT & Installation */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                  <p className="text-zinc-400 font-medium">
                    {r.libelleHomologation || 'Championnat Interclubs'}
                  </p>
                  {(r.adresse1Installation || r.villeInstallation) && (
                    <p className="text-zinc-500 text-[11px] flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-zinc-400 shrink-0" />
                      <span>{r.adresse1Installation ? `${r.adresse1Installation}, ` : ''}{r.villeInstallation || ''}</span>
                    </p>
                  )}
                </div>

                {/* Confrontation & Score */}
                <div className="bg-[#11141a] p-3.5 sm:p-4 rounded-2xl border border-[#232934] flex items-center justify-between gap-4">
                  
                  {/* Clubs */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs sm:text-sm font-black truncate ${
                        r.clubAccueilNom.toLowerCase().includes('muzillac')
                          ? 'text-[#FF6D00]'
                          : 'text-zinc-200'
                      }`}>
                        {r.clubAccueilNom}
                      </span>
                      {isHome && (
                        <span className="text-[10px] text-zinc-500 uppercase font-bold shrink-0 ml-2">Dom</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className={`text-xs sm:text-sm font-black truncate ${
                        r.clubVisiteurNom.toLowerCase().includes('muzillac')
                          ? 'text-[#FF6D00]'
                          : 'text-zinc-200'
                      }`}>
                        {r.clubVisiteurNom}
                      </span>
                      {!isHome && (
                        <span className="text-[10px] text-zinc-500 uppercase font-bold shrink-0 ml-2">Ext</span>
                      )}
                    </div>
                  </div>

                  {/* Badge Score */}
                  <div className="shrink-0 text-center">
                    <div className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-heading font-black border ${
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
                      <span className="text-[9px] font-bold uppercase tracking-wider block mt-1 text-zinc-400">
                        {r.vainqueur ? `Vainqueur : ${r.vainqueur}` : isWin ? 'Victoire TCM' : isLoss ? 'Défaite' : 'Score final'}
                      </span>
                    )}
                  </div>

                </div>

                {/* ==================== MODULE COMPOSITION CAPITAINE & ÉLIGIBILITÉ ==================== */}
                <div className="p-3 bg-[#13161c] rounded-2xl border border-[#232934] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center space-x-2.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                      compStatus.hasIssue 
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' 
                        : compStatus.isValidated 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                          : 'bg-orange-500/15 text-[#FF6D00] border border-orange-500/30'
                    }`}>
                      <ClipboardList className="w-4 h-4" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-white text-xs">Composition d'équipe :</span>
                        {compStatus.doubleWeightIssue ? (
                          <span className="text-[10px] px-2 py-0.2 rounded font-black bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3" />
                            Infraction : Poids Double 1 &lt; Double 2
                          </span>
                        ) : compStatus.hasIssue ? (
                          <span className="text-[10px] px-2 py-0.2 rounded font-black bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3" />
                            Alerte FFT : Joueur inéligible
                          </span>
                        ) : compStatus.isValidated ? (
                          <span className="text-[10px] px-2 py-0.2 rounded font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Validée FFT ({compStatus.count}/{compStatus.required} simples)
                          </span>
                        ) : compStatus.count > 0 ? (
                          <span className="text-[10px] px-2 py-0.2 rounded font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            En cours ({compStatus.count}/{compStatus.required} simples)
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-500">Non renseignée ({compStatus.required} simples requis)</span>
                        )}

                        {formatInfo.type === 'seniors_regional' && r.composition?.poidsDoublesValide && (
                          <span className="text-[10px] px-2 py-0.2 rounded font-black bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                            <Scale className="w-3 h-3" />
                            Poids D1 &ge; D2 conforme
                          </span>
                        )}

                        {r.composition?.frozenPlayers && r.composition.frozenPlayers.length > 0 && (
                          <span className="text-[10px] px-2 py-0.2 rounded font-black bg-orange-500/15 text-[#FF6D00] border border-orange-500/30 flex items-center gap-1" title="Données et classements des joueurs gelés à la date du match dans Données_appli">
                            <Lock className="w-3 h-3 text-[#FF6D00]" />
                            Données_appli Figé
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        {r.composition?.frozenPlayers && r.composition.frozenPlayers.length > 0 ? (
                          <span className="text-orange-300">
                            Joueurs gelés : {r.composition.frozenPlayers.map(p => `${p.nomPrenom} (${p.classementGele})`).join(', ')}
                          </span>
                        ) : compStatus.isValidated ? (
                          'Feuille de match conforme au Millésime 2027' 
                        ) : (
                          'Vérification Licence C/W, Sexe et barème 2027'
                        )}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => onOpenCompositionModal(r)}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#BF360C]/20 to-[#E65100]/20 hover:from-[#BF360C] hover:to-[#E65100] text-orange-400 hover:text-white border border-[#E65100]/40 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer self-start sm:self-auto"
                  >
                    <span>
                      {userRole === 'adherent'
                        ? 'Consulter la composition'
                        : compStatus.isValidated
                          ? 'Modifier la feuille'
                          : 'Composer l\'équipe'}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Capitaine TCM & Adversaire & Contacts */}
                <div className="pt-2 border-t border-[#232934] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  
                  {/* Capitaine TCM */}
                  <div className="flex items-center space-x-2 text-zinc-400">
                    <UserCheck className="w-3.5 h-3.5 text-[#FF6D00]" />
                    <span>Capitaine TCM :</span>
                    <strong className="text-white">
                      {r.prenomCapitaine ? `${r.prenomCapitaine} ${r.nomCapitaine}` : (r.nomCapitaine || 'Non désigné')}
                    </strong>
                    {r.portableCapitaine && (
                      <div className="inline-flex items-center space-x-1 ml-2">
                        <a
                          href={`tel:${r.portableCapitaine}`}
                          className="p-1 rounded-lg bg-[#12151b] hover:bg-emerald-500/20 text-zinc-300 hover:text-emerald-400 border border-[#252b37] transition flex items-center gap-1 px-2 text-[10px] font-bold"
                          title="Appeler le capitaine TCM"
                        >
                          <Phone className="w-3 h-3" />
                          <span>Appel</span>
                        </a>
                        <a
                          href={`sms:${r.portableCapitaine}`}
                          className="p-1 rounded-lg bg-[#12151b] hover:bg-sky-500/20 text-zinc-300 hover:text-sky-400 border border-[#252b37] transition flex items-center gap-1 px-2 text-[10px] font-bold"
                          title="SMS au capitaine TCM"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>SMS</span>
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Capitaine Adverse */}
                  {r.nomCapitaineAdverse && (
                    <div className="flex items-center space-x-2 text-zinc-400">
                      <span className="text-zinc-500">Capitaine adverse :</span>
                      <strong className="text-zinc-200">
                        {r.prenomCapitaineAdverse ? `${r.prenomCapitaineAdverse} ${r.nomCapitaineAdverse}` : r.nomCapitaineAdverse}
                      </strong>
                      {r.portableCapitaineAdverse && (
                        <div className="inline-flex items-center space-x-1 ml-1">
                          <a
                            href={`tel:${r.portableCapitaineAdverse}`}
                            className="p-1 rounded-lg bg-[#12151b] hover:bg-emerald-500/20 text-zinc-300 hover:text-emerald-400 border border-[#252b37] transition flex items-center gap-1 px-2 text-[10px] font-bold"
                            title="Appeler le capitaine adverse"
                          >
                            <Phone className="w-3 h-3" />
                          </a>
                          <a
                            href={`sms:${r.portableCapitaineAdverse}`}
                            className="p-1 rounded-lg bg-[#12151b] hover:bg-sky-500/20 text-zinc-300 hover:text-sky-400 border border-[#252b37] transition flex items-center gap-1 px-2 text-[10px] font-bold"
                            title="SMS au capitaine adverse"
                          >
                            <MessageSquare className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Juge-arbitre */}
                  {r.jugeArbitreNom && (
                    <div className="text-[11px] text-zinc-500">
                      JA : <strong className="text-zinc-400">{r.jugeArbitreNom} {r.jugeArbitrePrenom || ''}</strong>
                    </div>
                  )}

                </div>

              </div>
            );
          })
        ) : (
          <div className="p-12 text-center bg-[#141820] rounded-3xl border border-[#252b37]">
            <Trophy className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <h3 className="font-heading font-black text-white text-base">Aucune rencontre trouvée</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
              Aucune rencontre ne correspond à vos filtres sélectionnés.
            </p>
          </div>
        )}
      </div>

    </div>
  );
};
