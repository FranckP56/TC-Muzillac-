import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  Users, 
  Search, 
  Filter, 
  Trophy, 
  Phone, 
  MessageSquare, 
  Mail, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  MapPin, 
  Check, 
  CreditCard, 
  ExternalLink,
  Sparkles,
  Award,
  UserCheck
} from 'lucide-react';
import { Adherent, UserRole } from '../types/tennis';
import { filterLicenciesMuzillac2027, getLicenciesStats } from '../utils/licencies';
import { getRankingMeta } from '../utils/ranking';

interface LicenciesTabProps {
  adherents: Adherent[];
  userRole?: UserRole;
  onSelectAdherent?: (adherent: Adherent) => void;
  onNavigateToRencontres?: () => void;
}

export const LicenciesTab: React.FC<LicenciesTabProps> = ({
  adherents,
  userRole = 'bureau',
  onSelectAdherent,
  onNavigateToRencontres,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSex, setFilterSex] = useState<'all' | 'Messieurs' | 'Dames'>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | 'seniors' | 'seniors_plus' | 'jeunes'>('all');
  const [filterSerie, setFilterSerie] = useState<'all' | '2' | '3' | '4' | 'nc'>('all');

  // Filtrage exclusif des licenciés 2027 rattachés à MUZILLAC TENNIS CLUB
  const licenciesMuzillac2027 = useMemo(() => {
    return filterLicenciesMuzillac2027(adherents);
  }, [adherents]);

  const stats = useMemo(() => {
    return getLicenciesStats(licenciesMuzillac2027);
  }, [licenciesMuzillac2027]);

  // Filtrage utilisateur interactif
  const filteredList = useMemo(() => {
    return licenciesMuzillac2027.filter(adh => {
      // 1. Recherche texte
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchName = adh.nomPrenom.toLowerCase().includes(q);
        const matchLicence = (adh.licence || '').toLowerCase().includes(q);
        const matchClass = (adh.dernierClassTennis || '').toLowerCase().includes(q);
        const matchVille = (adh.ville || '').toLowerCase().includes(q);
        if (!matchName && !matchLicence && !matchClass && !matchVille) return false;
      }

      // 2. Filtre Sexe
      if (filterSex !== 'all') {
        const adhSex = adh.civilite === 'Madame' ? 'Dames' : 'Messieurs';
        if (adhSex !== filterSex) return false;
      }

      // 3. Filtre Catégorie d'âge
      if (filterCategory !== 'all') {
        const age = parseInt(adh.ageSportif || '25', 10);
        if (filterCategory === 'seniors_plus' && age < 35) return false;
        if (filterCategory === 'seniors' && (age < 18 || age >= 35)) return false;
        if (filterCategory === 'jeunes' && age >= 18) return false;
      }

      // 4. Filtre Série
      if (filterSerie !== 'all') {
        const meta = getRankingMeta(adh.dernierClassTennis);
        const rank = (adh.dernierClassTennis || 'NC').toUpperCase();
        if (filterSerie === 'nc' && rank !== 'NC') return false;
        if (filterSerie === '4' && !meta.serie.includes('4')) return false;
        if (filterSerie === '3' && !meta.serie.includes('3')) return false;
        if (filterSerie === '2' && !meta.serie.includes('2') && !meta.serie.includes('1')) return false;
      }

      return true;
    });
  }, [licenciesMuzillac2027, searchQuery, filterSex, filterCategory, filterSerie]);

  return (
    <div className="space-y-6">
      
      {/* ==================== EN-TÊTE DE LA SECTION ==================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-black font-heading text-white">
              Licenciés du Club (Saison 2027)
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              {licenciesMuzillac2027.length} licenciés actifs
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Membres titulaires d'une licence FFT 2027 (Colonne X) • MUZILLAC TENNIS CLUB (Colonne AB)</span>
          </p>
        </div>

        {onNavigateToRencontres && (
          <button
            onClick={onNavigateToRencontres}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white text-xs font-bold transition shadow-lg hover:brightness-110 cursor-pointer self-start sm:self-auto"
          >
            <Trophy className="w-4 h-4" />
            <span>Voir les rencontres d'équipes</span>
          </button>
        )}
      </div>

      {/* ==================== STATISTIQUES DES LICENCIÉS 2027 ==================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        
        {/* Total & Répartition Sexe */}
        <div className="p-3.5 rounded-2xl bg-[#141820] border border-[#252b37] space-y-1">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Effectif Licencié 2027</span>
          <div className="flex items-baseline space-x-2">
            <span className="text-xl font-heading font-black text-white">{stats.total}</span>
            <span className="text-[11px] text-zinc-400">joueurs</span>
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
          <p className="text-[10px] text-zinc-500 mt-1">Éligibles aux simples & doubles</p>
        </div>

        {/* Comptes Ten'Up */}
        <div className="p-3.5 rounded-2xl bg-[#141820] border border-[#252b37] space-y-1">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Comptes Ten'Up</span>
          <div className="flex items-baseline space-x-2">
            <span className="text-xl font-heading font-black text-emerald-400">{stats.avecTenUp}</span>
            <span className="text-[11px] text-zinc-400">/{stats.total} activés</span>
          </div>
          <p className="text-[10px] text-zinc-500 pt-1">Réservations et licences en ligne</p>
        </div>

        {/* Cotisations & Soldes */}
        <div className="p-3.5 rounded-2xl bg-[#141820] border border-[#252b37] space-y-1">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Statut Cotisations</span>
          <div className="flex items-baseline space-x-2">
            <span className={`text-xl font-heading font-black ${stats.avecSoldeDu > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {stats.total - stats.avecSoldeDu}
            </span>
            <span className="text-[11px] text-zinc-400">à jour ({stats.avecSoldeDu} dû)</span>
          </div>
          <p className="text-[10px] text-zinc-500 pt-1">
            {stats.avecSoldeDu > 0 ? `${stats.totalSoldeDu.toFixed(0)} € restant à percevoir` : 'Tous soldes régularisés'}
          </p>
        </div>

      </div>

      {/* ==================== FILTRES INTERACTIFS ==================== */}
      <div className="p-4 bg-[#141820] rounded-2xl border border-[#252b37] flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        
        {/* Recherche texte */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom, classement, licence..."
            className="w-full bg-[#1b202c] border border-[#2c3547] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
          />
        </div>

        {/* Boutons filtres */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          
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

      </div>

      {/* ==================== GRILLE DES LICENCIÉS 2027 ==================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredList.length > 0 ? (
          filteredList.map((adh) => {
            const meta = getRankingMeta(adh.dernierClassTennis);
            const isFemme = adh.civilite === 'Madame';

            return (
              <div
                key={adh.id}
                onClick={() => onSelectAdherent && onSelectAdherent(adh)}
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

                      <p className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-1.5">
                        <span>{adh.ageSportif ? `${adh.ageSportif} ans` : 'Senior'}</span>
                        <span>•</span>
                        <span>Né(e) en {adh.dateNaissance ? adh.dateNaissance.split('/')[2] || adh.dateNaissance : 'N/A'}</span>
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`px-2.5 py-1 rounded-xl text-xs font-black border block ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`}>
                        {adh.dernierClassTennis}
                      </span>
                      {adh.meilleurClassTennis && adh.meilleurClassTennis !== adh.dernierClassTennis && (
                        <span className="text-[9px] text-zinc-500 block mt-0.5">
                          Max: {adh.meilleurClassTennis}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ligne 2 : Badges Licence 2027 & Club Muzillac */}
                  <div className="flex items-center gap-1.5 flex-wrap mt-2.5 text-[10px]">
                    <span className="px-2 py-0.5 rounded font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Licence {adh.millesimeLicence || '2027'} : {adh.licence}</span>
                    </span>

                    <span className="px-2 py-0.5 rounded font-bold bg-orange-500/15 text-orange-300 border border-orange-500/30">
                      TCM Muzillac
                    </span>

                    {adh.soldeDu < 0 ? (
                      <span className="px-2 py-0.5 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Dû : {Math.abs(adh.soldeDu).toFixed(0)} €
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                        À jour
                      </span>
                    )}
                  </div>
                </div>

                {/* Ligne 3 : Actions rapides & Coordonnées */}
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
                    <span>Fiche &amp; éligibilité</span>
                    <span>→</span>
                  </span>
                </div>

              </div>
            );
          })
        ) : (
          <div className="col-span-full p-12 text-center bg-[#141820] rounded-3xl border border-[#252b37]">
            <Users className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <h3 className="font-heading font-black text-white text-base">Aucun licencié 2027 trouvé</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
              Aucun membre ne correspond à vos filtres actuels.
            </p>
          </div>
        )}
      </div>

    </div>
  );
};
