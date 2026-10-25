import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  ExternalLink, 
  AlertTriangle, 
  Users, 
  Award, 
  CreditCard, 
  SlidersHorizontal,
  Plus,
  RefreshCw,
  TrendingDown
} from 'lucide-react';
import { Adherent } from '../types/tennis';
import { AdherentCard } from './AdherentCard';
import { getRankingWeight, isRankingND } from '../utils/ranking';
import { FileSpreadsheet } from 'lucide-react';
import { DataSyncBanner } from './DataSyncBanner';

interface AdherentsTabProps {
  adherents: Adherent[];
  onSelectAdherent: (adherent: Adherent) => void;
  onOpenNewMemberModal: () => void;
  onOpenGsheetModal?: () => void;
  lastSyncTime?: string | null;
  isLoadingFile?: boolean;
  onRefreshFromFile?: () => Promise<void> | void;
}

export const AdherentsTab: React.FC<AdherentsTabProps> = ({
  adherents,
  onSelectAdherent,
  onOpenNewMemberModal,
  onOpenGsheetModal,
  lastSyncTime = null,
  isLoadingFile = false,
  onRefreshFromFile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'due' | 'credit' | 'uptodate' | 'nd' | '2e' | '3e' | '4e' | 'nc' | 'comp' | 'loisir'>('all');
  const [sortBy, setSortBy] = useState<'ranking_desc' | 'name_asc' | 'solde_due_desc'>('ranking_desc');

  // Statistiques globales de trésorerie & licences
  const stats = useMemo(() => {
    const total = adherents.length;
    const withRank = adherents.filter(a => a.dernierClassTennis && a.dernierClassTennis.toUpperCase() !== 'NC' && !isRankingND(a.dernierClassTennis)).length;
    // Soldes négatifs = impayés / dû au club
    const dueMembers = adherents.filter(a => a.soldeDu < 0);
    const totalDue = dueMembers.reduce((sum, a) => sum + Math.abs(a.soldeDu || 0), 0);
    // Soldes positifs = à régulariser (avoir, tarif famille non pris en compte)
    const creditMembers = adherents.filter(a => a.soldeDu > 0);
    const totalCredit = creditMembers.reduce((sum, a) => sum + (a.soldeDu || 0), 0);
    const upToDateMembers = adherents.filter(a => a.soldeDu === 0);
    // Joueurs avec classement ND (Non Déterminé - Reclassement requis)
    const ndMembers = adherents.filter(a => isRankingND(a.dernierClassTennis));

    return {
      total,
      withRank,
      dueCount: dueMembers.length,
      totalDue,
      creditCount: creditMembers.length,
      totalCredit,
      upToDateCount: upToDateMembers.length,
      ndCount: ndMembers.length,
    };
  }, [adherents]);

  // Filtrage et Tri
  const filteredAndSortedAdherents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const filtered = adherents.filter(adh => {
      // Recherche textuelle
      const matchesSearch = 
        adh.nomPrenom.toLowerCase().includes(q) ||
        adh.licence.toLowerCase().includes(q) ||
        (adh.groupeEnseignement && adh.groupeEnseignement.toLowerCase().includes(q)) ||
        (adh.ageSportif && adh.ageSportif.toLowerCase().includes(q)) ||
        adh.dernierClassTennis.toLowerCase().includes(q) ||
        adh.telephonePortable.includes(q) ||
        adh.email.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      // Filtres financiers et par série
      const rank = adh.dernierClassTennis || 'NC';
      const weight = getRankingWeight(rank);
      const isND = isRankingND(rank);

      if (selectedFilter === 'due') return adh.soldeDu < 0;
      if (selectedFilter === 'credit') return adh.soldeDu > 0;
      if (selectedFilter === 'uptodate') return adh.soldeDu === 0;
      if (selectedFilter === 'nd') return isND;
      if (selectedFilter === '2e') return weight >= 250;
      if (selectedFilter === '3e') return weight >= 130 && weight < 250;
      if (selectedFilter === '4e') return weight >= 15 && weight < 130;
      if (selectedFilter === 'nc') return weight === 0 && !isND;
      if (selectedFilter === 'comp') {
        const g = (adh.groupeEnseignement || '').toLowerCase();
        return g.includes('compétition') || g.includes('équipe') || g.includes('espoir');
      }
      if (selectedFilter === 'loisir') {
        const g = (adh.groupeEnseignement || '').toLowerCase();
        return g.includes('loisir') || g.includes('perfectionnement') || g.includes('initiation') || g.includes('école');
      }

      return true;
    });

    // Tri (Classement décroissant par défaut comme sur Glide)
    return filtered.sort((a, b) => {
      if (sortBy === 'ranking_desc') {
        const weightA = getRankingWeight(a.dernierClassTennis);
        const weightB = getRankingWeight(b.dernierClassTennis);
        if (weightB !== weightA) {
          return weightB - weightA;
        }
        return a.nomPrenom.localeCompare(b.nomPrenom, 'fr');
      }

      if (sortBy === 'name_asc') {
        return a.nomPrenom.localeCompare(b.nomPrenom, 'fr');
      }

      if (sortBy === 'solde_due_desc') {
        // Les plus gros soldes négatifs en premier (ex: -330 avant -199 avant 0 avant +20)
        if (a.soldeDu !== b.soldeDu) {
          return a.soldeDu - b.soldeDu;
        }
        return a.nomPrenom.localeCompare(b.nomPrenom, 'fr');
      }

      return 0;
    });
  }, [adherents, searchQuery, selectedFilter, sortBy]);

  return (
    <div className="space-y-6">
      
      {/* 0. Bannière de synchronisation directe du fichier Données_appli & Calendrier FFT */}
      <DataSyncBanner
        memberCount={stats.total}
        lastSyncTime={lastSyncTime}
        isLoading={isLoadingFile}
        onRefresh={onRefreshFromFile || (() => {})}
      />

      {/* 1. Barre de stats sportives & trésorerie */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#161a22] p-3.5 sm:p-4 rounded-2xl border border-[#252b37] flex items-center space-x-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-orange-500/15 text-[#FF6D00] flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-zinc-400 font-medium">Adhérents Actifs</p>
            <p className="text-lg sm:text-xl font-heading font-black text-white">{stats.total}</p>
          </div>
        </div>

        <div className="bg-[#161a22] p-3.5 sm:p-4 rounded-2xl border border-[#252b37] flex items-center space-x-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-zinc-400 font-medium">Joueurs Classés</p>
            <p className="text-lg sm:text-xl font-heading font-black text-white">{stats.withRank}</p>
          </div>
        </div>

        {/* Soldes Négatifs = Impayés Dûs au club */}
        <div className="bg-[#161a22] p-3.5 sm:p-4 rounded-2xl border border-[#252b37] flex items-center space-x-3 shadow-sm">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
            stats.dueCount > 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
          }`}>
            <CreditCard className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <p className="text-[11px] text-zinc-400 font-medium truncate">Soldes Dûs (&lt; 0 €)</p>
              {stats.dueCount > 0 && (
                <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-rose-500/20 text-rose-300 shrink-0">
                  {stats.dueCount}
                </span>
              )}
            </div>
            <p className="text-base sm:text-lg font-heading font-black text-rose-300 truncate">
              {stats.totalDue} €
            </p>
          </div>
        </div>

        {/* Soldes Positifs = À Régulariser (avoir, tarif famille) */}
        <div className="bg-[#161a22] p-3.5 sm:p-4 rounded-2xl border border-[#252b37] flex items-center space-x-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold shrink-0">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <p className="text-[11px] text-zinc-400 font-medium truncate">À Régul. (&gt; 0 €)</p>
              {stats.creditCount > 0 && (
                <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-amber-500/20 text-amber-300 shrink-0">
                  {stats.creditCount}
                </span>
              )}
            </div>
            <p className="text-base sm:text-lg font-heading font-black text-amber-400 truncate">
              +{stats.totalCredit} €
            </p>
          </div>
        </div>
      </div>

      {/* Titre & Action Ten'Up + Bouton GSheet */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-black font-heading text-white">
              Annuaire des Adhérents
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#E65100]/25 text-[#FF6D00] border border-[#E65100]/40">
              {filteredAndSortedAdherents.length}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1.5">
            <TrendingDown className="w-3.5 h-3.5 text-[#FF6D00]" />
            <span>Tri automatique Glide : meilleur classement FFT vers NC</span>
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {onOpenGsheetModal && (
            <button
              onClick={onOpenGsheetModal}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 text-xs font-bold transition shadow-sm cursor-pointer"
              title="Inspecter les colonnes GSheet et importer Données_appli"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Colonnes GSheet</span>
            </button>
          )}

          <button
            onClick={onOpenNewMemberModal}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-[#1d222c] hover:bg-[#272d3a] border border-[#2d3443] text-zinc-200 hover:text-white text-xs font-bold transition shadow-sm cursor-pointer"
            title="Ajouter un adhérent"
          >
            <Plus className="w-4 h-4 text-[#FF6D00]" />
            <span>Ajouter</span>
          </button>

          <a
            href="https://tenup.fft.fr"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#BF360C] via-[#E65100] to-[#FF6D00] hover:brightness-110 active:scale-95 text-white text-xs font-black transition shadow-lg shadow-orange-950/50"
          >
            <span>Portail Ten'Up FFT</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Barre de recherche et sélecteur de tri */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Champ recherche */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom, licence, groupe, classement (ex: 15/1, Senior, Laurent)..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#141820] text-sm text-white placeholder-zinc-500 rounded-2xl border border-[#252b37] focus:outline-none focus:border-[#E65100] focus:ring-1 focus:ring-[#E65100] transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-white"
              >
                Effacer
              </button>
            )}
          </div>

          {/* Sélecteur de tri */}
          <div className="flex items-center space-x-2 bg-[#141820] px-3 py-1.5 rounded-2xl border border-[#252b37] shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-xs text-zinc-400 hidden sm:inline">Tri :</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs text-white font-semibold focus:outline-none cursor-pointer"
            >
              <option value="ranking_desc" className="bg-[#141820] text-white">Classement FFT (Décroissant)</option>
              <option value="name_asc" className="bg-[#141820] text-white">Nom (A - Z)</option>
              <option value="solde_due_desc" className="bg-[#141820] text-white">Solde restant dû (Impayés d'abord)</option>
            </select>
          </div>
        </div>

        {/* Puces de filtrage rapide (Filter chips) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedFilter === 'all'
                ? 'bg-[#E65100] text-white shadow-md shadow-orange-950/50'
                : 'bg-[#161a22] text-zinc-400 hover:text-white border border-[#242a36]'
            }`}
          >
            Tous ({stats.total})
          </button>

          {/* Filtre Soldes Négatifs = Impayés dûs */}
          <button
            onClick={() => setSelectedFilter('due')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
              selectedFilter === 'due'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-950/50'
                : 'bg-[#161a22] text-rose-300 hover:text-white border border-rose-500/30'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-rose-400" />
            <span>⚠️ Impayés Dûs ({stats.dueCount})</span>
          </button>

          {/* Filtre Soldes Positifs = À régulariser */}
          <button
            onClick={() => setSelectedFilter('credit')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
              selectedFilter === 'credit'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-950/50'
                : 'bg-[#161a22] text-amber-300 hover:text-white border border-amber-500/30'
            }`}
          >
            <RefreshCw className="w-3 h-3 text-amber-400" />
            <span>ℹ️ À régulariser ({stats.creditCount})</span>
          </button>

          {/* Filtre Comptes à jour */}
          <button
            onClick={() => setSelectedFilter('uptodate')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
              selectedFilter === 'uptodate'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                : 'bg-[#161a22] text-emerald-400 hover:text-white border border-emerald-500/30'
            }`}
          >
            <span>✅ À jour ({stats.upToDateCount})</span>
          </button>

          {/* Filtre Classements ND = Reclassement FFT requis */}
          <button
            onClick={() => setSelectedFilter('nd')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
              selectedFilter === 'nd'
                ? 'bg-rose-700 text-white shadow-md shadow-rose-950/60'
                : 'bg-[#161a22] text-rose-300 hover:text-white border border-rose-500/40'
            }`}
          >
            <span>⚠️ Reclassement requis ND ({stats.ndCount})</span>
          </button>

          <button
            onClick={() => setSelectedFilter('2e')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedFilter === '2e'
                ? 'bg-[#E65100] text-white'
                : 'bg-[#161a22] text-zinc-400 hover:text-white border border-[#242a36]'
            }`}
          >
            2ème Série (15 à -30)
          </button>

          <button
            onClick={() => setSelectedFilter('3e')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedFilter === '3e'
                ? 'bg-[#E65100] text-white'
                : 'bg-[#161a22] text-zinc-400 hover:text-white border border-[#242a36]'
            }`}
          >
            3ème Série (15/1 à 30)
          </button>

          <button
            onClick={() => setSelectedFilter('4e')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedFilter === '4e'
                ? 'bg-[#E65100] text-white'
                : 'bg-[#161a22] text-zinc-400 hover:text-white border border-[#242a36]'
            }`}
          >
            4ème Série (30/1 à 40)
          </button>

          <button
            onClick={() => setSelectedFilter('nc')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedFilter === 'nc'
                ? 'bg-[#E65100] text-white'
                : 'bg-[#161a22] text-zinc-400 hover:text-white border border-[#242a36]'
            }`}
          >
            Non Classés (NC)
          </button>

          <button
            onClick={() => setSelectedFilter('comp')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedFilter === 'comp'
                ? 'bg-[#E65100] text-white'
                : 'bg-[#161a22] text-zinc-400 hover:text-white border border-[#242a36]'
            }`}
          >
            🏆 Compétition
          </button>

          <button
            onClick={() => setSelectedFilter('loisir')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              selectedFilter === 'loisir'
                ? 'bg-[#E65100] text-white'
                : 'bg-[#161a22] text-zinc-400 hover:text-white border border-[#242a36]'
            }`}
          >
            🎾 Loisir & École
          </button>
        </div>
      </div>

      {/* Liste des cartes d'adhérents */}
      <div className="space-y-3">
        {filteredAndSortedAdherents.length > 0 ? (
          filteredAndSortedAdherents.map((adherent) => (
            <AdherentCard
              key={adherent.id}
              adherent={adherent}
              onSelect={onSelectAdherent}
            />
          ))
        ) : (
          <div className="p-12 text-center bg-[#141820] rounded-3xl border border-[#252b37]">
            <Users className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <h3 className="font-heading font-black text-white text-base">Aucun adhérent trouvé</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
              Aucun joueur ne correspond à vos critères de recherche ou filtre actif.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedFilter('all');
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-[#1e232d] hover:bg-[#272d3a] border border-[#2b3342] text-xs font-bold text-orange-400 hover:text-white transition cursor-pointer"
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}
      </div>

    </div>
  );
};
