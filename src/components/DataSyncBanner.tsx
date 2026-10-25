import React, { useState } from 'react';
import { 
  RefreshCw, 
  CheckCircle2, 
  Calendar, 
  TrendingUp, 
  AlertCircle, 
  FileSpreadsheet, 
  ChevronDown, 
  ChevronUp,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { getNextFftMonthlyRankingRelease, getWeeklyScheduleInfo } from '../utils/fftCalendar';

interface DataSyncBannerProps {
  memberCount: number;
  lastSyncTime: string | null;
  isLoading: boolean;
  onRefresh: () => Promise<void> | void;
  variant?: 'compact' | 'full';
}

export const DataSyncBanner: React.FC<DataSyncBannerProps> = ({
  memberCount,
  lastSyncTime,
  isLoading,
  onRefresh,
  variant = 'compact',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const nextRanking = getNextFftMonthlyRankingRelease();
  const weeklyInfo = getWeeklyScheduleInfo();

  return (
    <div className="rounded-2xl bg-gradient-to-r from-[#141820] via-[#161b24] to-[#12151c] border border-orange-500/20 shadow-md p-3.5 sm:p-4 text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        
        {/* Statut Source & Conformité */}
        <div className="flex items-start sm:items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-heading font-black text-white text-xs sm:text-sm">
                Données Réelles TCM Connectées
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                {memberCount} adhérents conformes
              </span>
              <span className="text-[10px] text-zinc-400 hidden md:inline">
                • Source : <code className="text-zinc-300 bg-black/40 px-1 py-0.5 rounded">Données_appli</code>
              </span>
            </div>
            
            <p className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-2 flex-wrap">
              <span>Synchro : {lastSyncTime || 'En direct'}</span>
              <span>•</span>
              <span className="text-[#FF6D00] font-semibold flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Prochain classement FFT : {nextRanking.formattedDate}
              </span>
            </p>
          </div>
        </div>

        {/* Actions : Rafraîchir & Déplier cycle FFT */}
        <div className="flex items-center space-x-2 self-end sm:self-auto shrink-0">
          <button
            onClick={() => onRefresh()}
            disabled={isLoading}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-300 hover:text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer"
            title="Relire immédiatement le fichier Données_appli"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#FF6D00] ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Lecture...' : 'Actualiser fichier'}</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-xs transition cursor-pointer"
            title={isExpanded ? 'Réduire' : 'Afficher le détail du cycle de mise à jour'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

      </div>

      {/* Détails du cycle hebdomadaire & mensuel (dépliable) */}
      {isExpanded && (
        <div className="mt-3.5 pt-3.5 border-t border-[#252c38] grid grid-cols-1 md:grid-cols-2 gap-3 text-zinc-300">
          
          {/* Cycle 1 : Hebdomadaire (Résultats du week-end) */}
          <div className="p-3 bg-[#0d1015] rounded-xl border border-[#232934] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                1. Hebdomadaire : Résultats du Week-end
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${weeklyInfo.badgeColor}`}>
                {weeklyInfo.phase}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Mise à jour des scores et feuilles de match chaque <strong>lundi</strong> après les rencontres du week-end. Les points et bilans de chaque équipe sont recalculés.
            </p>
          </div>

          {/* Cycle 2 : Mensuel (1er mardi du mois pour les classements FFT) */}
          <div className="p-3 bg-[#0d1015] rounded-xl border border-[#232934] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#E65100]"></span>
                2. Mensuel : Nouveaux Classements FFT
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30">
                1er mardi du mois
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              La FFT publie les classements mensuels chaque <strong>premier mardi du mois à 06h00</strong>.
              Prochaine parution : <strong className="text-white">{nextRanking.formattedDate}</strong> (dans {nextRanking.daysRemaining} j).
            </p>
            <div className="p-2 rounded bg-orange-950/30 border border-orange-500/30 text-[10px] text-orange-200 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-[#FF6D00] shrink-0 mt-0.5" />
              <span>
                <strong>Impact direct :</strong> Les montées ou descentes d'échelon recalculent l'ordre des simples (Simple 1 &gt;= Simple 2) et le poids de l'équipe pour les rencontres du week-end suivant !
              </span>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
