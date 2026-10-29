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
  TrendingDown,
  Phone,
  MessageSquare,
  Mail,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  X
} from 'lucide-react';
import { Adherent, UserRole } from '../types/tennis';
import { getRankingMeta, getRankingWeight, isRankingND } from '../utils/ranking';
import { FileSpreadsheet } from 'lucide-react';
import { DataSyncBanner } from './DataSyncBanner';

interface AdherentsTabProps {
  adherents: Adherent[];
  userRole?: UserRole;
  onSelectAdherent: (adherent: Adherent) => void;
  onOpenNewMemberModal?: () => void;
  onOpenGsheetModal?: () => void;
  lastSyncTime?: string | null;
  isLoadingFile?: boolean;
  onRefreshFromFile?: () => Promise<void> | void;
}

export const AdherentsTab: React.FC<AdherentsTabProps> = ({
  adherents,
  userRole = 'bureau',
  onSelectAdherent,
  onOpenNewMemberModal,
  onOpenGsheetModal,
  lastSyncTime = null,
  isLoadingFile = false,
  onRefreshFromFile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSex, setFilterSex] = useState<'all' | 'Messieurs' | 'Dames'>('all');
  const [filterSerie, setFilterSerie] = useState<'all' | '2' | '3' | '4' | 'nc'>('all');
  const [filterSolde, setFilterSolde] = useState<'all' | 'due' | 'uptodate' | 'credit' | 'nd'>('all');
  const [sortBy, setSortBy] = useState<'ranking_desc' | 'name_asc' | 'solde_due_desc'>('ranking_desc');

  // Statistiques complètes du club (Sexe, Pyramide FFT, Trésorerie)
  const stats = useMemo(() => {
    const total = adherents.length;
    let hommes = 0;
    let femmes = 0;
    let s2 = 0;
    let s3 = 0;
    let s4 = 0;
    let nc = 0;
    let dueCount = 0;
    let totalDue = 0;
    let upToDateCount = 0;
    let creditCount = 0;
    let totalCredit = 0;
    let ndCount = 0;

    adherents.forEach(a => {
      if (a.civilite === 'Madame') {
        femmes++;
      } else {
        hommes++;
      }

      const r = (a.dernierClassTennis || 'NC').toUpperCase();
      const meta = getRankingMeta(r);
      if (meta.isND) {
        ndCount++;
      } else if (meta.serie.includes('2') || meta.serie.includes('1')) {
        s2++;
      } else if (meta.serie.includes('3')) {
        s3++;
      } else if (meta.serie.includes('4')) {
        s4++;
      } else {
        nc++;
      }

      if (a.soldeDu < 0) {
        dueCount++;
        totalDue += Math.abs(a.soldeDu);
      } else if (a.soldeDu === 0) {
        upToDateCount++;
      } else {
        creditCount++;
        totalCredit += a.soldeDu;
      }
    });

    return {
      total,
      hommes,
      femmes,
      series: { deuxieme: s2, troisieme: s3, quatrieme: s4, nc },
      dueCount,
      totalDue,
      upToDateCount,
      creditCount,
      totalCredit,
      ndCount,
    };
  }, [adherents]);

  // Filtrage et Tri calqué sur LicenciesTab
  const filteredAdherents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const filtered = adherents.filter(adh => {
      // 1. Recherche textuelle
      if (q) {
        const matchName = adh.nomPrenom.toLowerCase().includes(q);
        const matchLicence = (adh.licence || '').toLowerCase().includes(q);
        const matchClass = (adh.dernierClassTennis || '').toLowerCase().includes(q);
        const matchGroupe = (adh.groupeEnseignement || '').toLowerCase().includes(q);
        const matchTel = (adh.telephonePortable || '').includes(q);
        const matchMail = (adh.email || '').toLowerCase().includes(q);
        if (!matchName && !matchLicence && !matchClass && !matchGroupe && !matchTel && !matchMail) {
          return false;
        }
      }

      // 2. Filtre Sexe
      if (filterSex !== 'all') {
        const isF = adh.civilite === 'Madame';
        if (filterSex === 'Dames' && !isF) return false;
        if (filterSex === 'Messieurs' && isF) return false;
      }

      // 3. Filtre Série
      if (filterSerie !== 'all') {
        const meta = getRankingMeta(adh.dernierClassTennis);
        const rank = (adh.dernierClassTennis || 'NC').toUpperCase();
        if (filterSerie === 'nc' && rank !== 'NC') return false;
        if (filterSerie === '4' && !meta.serie.includes('4')) return false;
        if (filterSerie === '3' && !meta.serie.includes('3')) return false;
        if (filterSerie === '2' && !meta.serie.includes('2') && !meta.serie.includes('1')) return false;
      }

      // 4. Filtre Cotisation / Solde
      if (filterSolde === 'due' && adh.soldeDu >= 0) return false;
      if (filterSolde === 'uptodate' && adh.soldeDu !== 0) return false;
      if (filterSolde === 'credit' && adh.soldeDu <= 0) return false;
      if (filterSolde === 'nd' && !isRankingND(adh.dernierClassTennis)) return false;

      return true;
    });

    // Tri
    return filtered.sort((a, b) => {
      if (sortBy === 'ranking_desc') {
        const weightA = getRankingWeight(a.dernierClassTennis);
        const weightB = getRankingWeight(b.dernierClassTennis);
        if (weightB !== weightA) return weightB - weightA;
        return a.nomPrenom.localeCompare(b.nomPrenom, 'fr');
      }

      if (sortBy === 'name_asc') {
        return a.nomPrenom.localeCompare(b.nomPrenom, 'fr');
      }

      if (sortBy === 'solde_due_desc') {
        if (a.soldeDu !== b.soldeDu) return a.soldeDu - b.soldeDu;
        return a.nomPrenom.localeCompare(b.nomPrenom, 'fr');
      }

      return 0;
    });
  }, [adherents, searchQuery, filterSex, filterSerie, filterSolde, sortBy]);

  return (
    <div className="space-y-6">
      
      {/* 0. Bannière de synchronisation (Réservée exclusivement au profil Admin) */}
      {userRole === 'admin' && (
        <DataSyncBanner
          memberCount={stats.total}
          lastSyncTime={lastSyncTime}
          isLoading={isLoadingFile}
          onRefresh={onRefreshFromFile || (() => {})}
        />
      )}

      {/* ==================== EN-TÊTE ÉPURÉ DE LA SECTION ==================== */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-black font-heading text-white">
              Annuaire des Adhérents
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#E65100]/25 text-[#FF6D00] border border-[#E65100]/40">
              {stats.total} inscrits
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
            <TrendingDown className="w-3.5 h-3.5 text-[#FF6D00] shrink-0" />
            <span>Membres du club (pratique libre, cours collectifs et compétitions) • Données_appli</span>
          </p>
        </div>
      </div>

      {/* ==================== STATISTIQUES (CALQUÉES SUR LICENCIÉS) ==================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        
        {/* Total & Répartition Sexe */}
        <div className="p-3.5 rounded-2xl bg-[#141820] border border-[#252b37] space-y-1">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Effectif Total</span>
          <div className="flex items-baseline space-x-2">
            <span className="text-xl font-heading font-black text-white">{stats.total}</span>
            <span className="text-[11px] text-zinc-400">adhérents</span>
          </div>
          <div className="flex items-center gap-2 pt-1 text-[11px]">
            <span className="text-blue-400 font-bold">{stats.hommes} H</span>
            <span className="text-zinc-600">•</span>
            <span className="text-pink-400 font-bold">{stats.femmes} F</span>
          </div>
        </div>

        {/* Pyramide des Classements */}
        <div className="p-3.5 rounded-2xl bg-[#141820] border border-[#252b37] space-y-1">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Pyramide FFT</span>
          <div className="flex items-baseline space-x-1.5 flex-wrap font-mono text-[11px] font-bold pt-0.5">
            <span className="text-purple-300">{stats.series.deuxieme} en 2e</span>
            <span className="text-zinc-600">/</span>
            <span className="text-blue-300">{stats.series.troisieme} en 3e</span>
            <span className="text-zinc-600">/</span>
            <span className="text-amber-300">{stats.series.quatrieme} en 4e</span>
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-400">{stats.series.nc} NC</span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">
            {stats.ndCount > 0 ? `${stats.ndCount} à reclasser (ND)` : 'Classements à jour'}
          </p>
        </div>

        {/* Trésorerie : Soldes Dûs */}
        <div className="p-3.5 rounded-2xl bg-[#141820] border border-[#252b37] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Soldes Dûs (&lt; 0 €)</span>
            <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
              stats.dueCount > 0 ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              {stats.dueCount} impayés
            </span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-xl font-heading font-black text-rose-400">
              -{stats.totalDue.toLocaleString('fr-FR')} €
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">{stats.upToDateCount} comptes à jour (0 €)</p>
        </div>

        {/* Trésorerie : Avoirs & Trop-perçu */}
        <div className="p-3.5 rounded-2xl bg-[#141820] border border-[#252b37] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">À Régulariser (&gt; 0 €)</span>
            <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
              {stats.creditCount} avoirs
            </span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-xl font-heading font-black text-amber-400">
              +{stats.totalCredit.toLocaleString('fr-FR')} €
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">Avoirs / Tarifs familles à ajuster</p>
        </div>

      </div>

      {/* ==================== BARRE DE RECHERCHE & FILTRES (DISPOSITION PROPRE SANS SCROLL CUT-OFF) ==================== */}
      <div className="bg-[#141820] p-4 rounded-3xl border border-[#252b37] space-y-3.5">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Recherche texte */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom, licence, groupe, classement (ex: 15/1, Laurent, Je1)..."
              className="w-full pl-10 pr-8 py-2 rounded-xl bg-[#0e1116] border border-zinc-800 text-xs sm:text-sm text-white placeholder-zinc-500 focus:border-[#FF6D00] outline-none"
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

          {/* Tri */}
          <div className="flex items-center space-x-2 bg-[#0e1116] px-3 py-1.5 rounded-xl border border-zinc-800 shrink-0">
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

        {/* Filtres Sexe, Séries & Cotisations en groupes de boutons élégants */}
        <div className="flex items-center justify-between flex-wrap gap-2.5 pt-2 border-t border-zinc-800/80 text-xs">
          
          <div className="flex items-center flex-wrap gap-2">
            {/* Sexe */}
            <div className="flex items-center bg-[#1b202c] rounded-xl p-0.5 border border-[#2c3547]">
              <button
                onClick={() => setFilterSex('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  filterSex === 'all' ? 'bg-[#E65100] text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Tous
              </button>
              <button
                onClick={() => setFilterSex('Messieurs')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  filterSex === 'Messieurs' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Messieurs ({stats.hommes})
              </button>
              <button
                onClick={() => setFilterSex('Dames')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  filterSex === 'Dames' ? 'bg-pink-600 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Dames ({stats.femmes})
              </button>
            </div>

            {/* Séries */}
            <div className="flex items-center bg-[#1b202c] rounded-xl p-0.5 border border-[#2c3547]">
              <button
                onClick={() => setFilterSerie('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  filterSerie === 'all' ? 'bg-[#E65100] text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Toutes séries
              </button>
              <button
                onClick={() => setFilterSerie('2')}
                className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                  filterSerie === '2' ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-white'
                }`}
                title="2ème série (15 et au-dessus)"
              >
                2e
              </button>
              <button
                onClick={() => setFilterSerie('3')}
                className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                  filterSerie === '3' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
                }`}
                title="3ème série (15/1 à 30)"
              >
                3e
              </button>
              <button
                onClick={() => setFilterSerie('4')}
                className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                  filterSerie === '4' ? 'bg-amber-600 text-white' : 'text-zinc-400 hover:text-white'
                }`}
                title="4ème série (30/1 à 40)"
              >
                4e
              </button>
              <button
                onClick={() => setFilterSerie('nc')}
                className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                  filterSerie === 'nc' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
                }`}
                title="Non classés"
              >
                NC
              </button>
            </div>
          </div>

          {/* Filtre Cotisation */}
          <div className="flex items-center bg-[#1b202c] rounded-xl p-0.5 border border-[#2c3547] flex-wrap">
            <button
              onClick={() => setFilterSolde('all')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                filterSolde === 'all' ? 'bg-[#E65100] text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setFilterSolde('due')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                filterSolde === 'due' ? 'bg-rose-600 text-white' : 'text-rose-400 hover:text-rose-300'
              }`}
            >
              Dûs ({stats.dueCount})
            </button>
            <button
              onClick={() => setFilterSolde('uptodate')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                filterSolde === 'uptodate' ? 'bg-emerald-600 text-white' : 'text-emerald-400 hover:text-emerald-300'
              }`}
            >
              À jour ({stats.upToDateCount})
            </button>
            <button
              onClick={() => setFilterSolde('credit')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                filterSolde === 'credit' ? 'bg-amber-600 text-white' : 'text-amber-400 hover:text-amber-300'
              }`}
            >
              Avoirs ({stats.creditCount})
            </button>
            {stats.ndCount > 0 && (
              <button
                onClick={() => setFilterSolde('nd')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  filterSolde === 'nd' ? 'bg-rose-800 text-white' : 'text-rose-400 hover:text-rose-300'
                }`}
                title="Classement non déterminé : reclassement FFT requis"
              >
                ND ({stats.ndCount})
              </button>
            )}
          </div>

        </div>
      </div>

      {/* ==================== GRILLE DES ADHÉRENTS PAR 3 (COPIÉ DE L'ONGLET LICENCIÉS) ==================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredAdherents.length > 0 ? (
          filteredAdherents.map((adh) => {
            const meta = getRankingMeta(adh.dernierClassTennis);
            const isFemme = adh.civilite === 'Madame';
            const isOwed = adh.soldeDu < 0;
            const isCredit = adh.soldeDu > 0;

            return (
              <div
                key={adh.id}
                onClick={() => onSelectAdherent(adh)}
                className="bg-[#161a22] hover:bg-[#1a202a] border border-[#272e3b] hover:border-[#E65100]/50 rounded-2xl p-4 transition-all shadow-md flex flex-col justify-between space-y-3 cursor-pointer group"
              >
                <div>
                  {/* Ligne 1 : Nom, Prénom, Civilité et Classement */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <span className="font-heading font-black text-white text-sm group-hover:text-orange-400 transition truncate">
                          {adh.nomPrenom}
                        </span>
                        <span className={`px-2 py-0.2 rounded text-[10px] font-black border ${
                          isFemme 
                            ? 'bg-pink-500/20 text-pink-300 border-pink-500/30' 
                            : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                        }`}>
                          {isFemme ? 'F' : 'H'}
                        </span>
                      </div>

                      <p className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>{adh.ageSportif ? `${adh.ageSportif} ans` : 'Senior'}</span>
                        <span>•</span>
                        <span>Né(e) en {adh.dateNaissance ? adh.dateNaissance.split('/')[2] || adh.dateNaissance : 'N/A'}</span>
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`px-2.5 py-1 rounded-xl text-xs font-black border block ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`}>
                        {adh.dernierClassTennis || 'NC'}
                      </span>
                      {adh.meilleurClassTennis && adh.meilleurClassTennis !== adh.dernierClassTennis && (
                        <span className="text-[9px] text-zinc-500 block mt-0.5">
                          Max: {adh.meilleurClassTennis}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ligne 2 : Badges Licence, Groupe d'entraînement & Solde */}
                  <div className="flex items-center gap-1.5 flex-wrap mt-2.5 text-[10px]">
                    {adh.licence ? (
                      <span className="px-2 py-0.5 rounded font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Licence {adh.millesimeLicence || '2027'}</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                        Sans licence
                      </span>
                    )}

                    {adh.groupeEnseignement && (
                      <span className="px-2 py-0.5 rounded font-bold bg-orange-500/15 text-orange-300 border border-orange-500/30 truncate max-w-[150px]" title={adh.groupeEnseignement}>
                        {adh.groupeEnseignement}
                      </span>
                    )}

                    {isOwed ? (
                      <span className="px-2 py-0.5 rounded font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                        Dû : {Math.abs(adh.soldeDu).toFixed(0)} €
                      </span>
                    ) : isCredit ? (
                      <span className="px-2 py-0.5 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Avoir : +{adh.soldeDu.toFixed(0)} €
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                        À jour (0 €)
                      </span>
                    )}
                  </div>
                </div>

                {/* Ligne 3 : Actions rapides & Coordonnées directes */}
                <div className="pt-2.5 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                  <div className="flex items-center space-x-1">
                    {adh.telephonePortable && (
                      <a
                        href={`tel:${adh.telephonePortable}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-lg bg-[#11141a] hover:bg-emerald-500/20 hover:text-emerald-400 border border-zinc-800 transition"
                        title={`Appeler ${adh.nomPrenom}`}
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {adh.telephonePortable && (
                      <a
                        href={`sms:${adh.telephonePortable}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-lg bg-[#11141a] hover:bg-sky-500/20 hover:text-sky-400 border border-zinc-800 transition"
                        title={`SMS à ${adh.nomPrenom}`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {adh.email && (
                      <a
                        href={`mailto:${adh.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-lg bg-[#11141a] hover:bg-orange-500/20 hover:text-orange-400 border border-zinc-800 transition"
                        title={`Email à ${adh.nomPrenom}`}
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>

                  <span className="text-[10px] text-zinc-500 flex items-center gap-1 group-hover:text-orange-300 transition">
                    <span>Fiche adhérent</span>
                    <span>→</span>
                  </span>
                </div>

              </div>
            );
          })
        ) : (
          <div className="col-span-full p-12 text-center bg-[#141820] rounded-3xl border border-[#252b37]">
            <Users className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <h3 className="font-heading font-black text-white text-base">Aucun adhérent trouvé</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
              Aucun joueur ne correspond à vos critères de recherche ou filtres actifs.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterSex('all');
                setFilterSerie('all');
                setFilterSolde('all');
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
