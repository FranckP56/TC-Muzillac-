import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  Search, 
  CheckCircle2, 
} from 'lucide-react';
import { Adherent, UserRole } from '../types/tennis';
import { filterLicenciesMuzillac2027, getLicenciesStats } from '../utils/licencies';
import { getRankingMeta, cleanRanking, isValidTennisRanking } from '../utils/ranking';
import { extractBirthYear } from '../utils/fftEligibility';

interface LicenciesTabProps {
  adherents: Adherent[];
  userRole?: UserRole;
  onSelectAdherent?: (adherent: Adherent) => void;
  onNavigateToRencontres?: () => void;
  saison?: string;
}

function getAdherentAge(adh: Adherent): number {
  const parsed = parseInt(adh.ageSportif || '', 10);
  if (!isNaN(parsed) && parsed > 0 && parsed < 120) {
    return parsed;
  }
  const year = extractBirthYear(adh.dateNaissance);
  if (year && year > 1900 && year < 2027) {
    return 2027 - year;
  }
  return 30;
}

export const LicenciesTab: React.FC<LicenciesTabProps> = ({
  adherents,
  onSelectAdherent,
  saison = '2027',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSex, setFilterSex] = useState<'all' | 'Messieurs' | 'Dames'>('all');

  // Filtrage exclusif des licenciés rattachés à MUZILLAC TENNIS CLUB pour la saison active
  const licenciesMuzillac = useMemo(() => {
    return filterLicenciesMuzillac2027(adherents, saison);
  }, [adherents, saison]);

  const stats = useMemo(() => {
    return getLicenciesStats(licenciesMuzillac);
  }, [licenciesMuzillac]);

  // Calcul dynamique des limites mini/maxi selon le sexe sélectionné (Tous, Hommes ou Femmes)
  const { minClubAge, maxClubAge } = useMemo(() => {
    const listForSex = licenciesMuzillac.filter(adh => {
      if (filterSex === 'Messieurs') return adh.civilite !== 'Madame';
      if (filterSex === 'Dames') return adh.civilite === 'Madame';
      return true;
    });

    if (listForSex.length === 0) {
      return { minClubAge: 7, maxClubAge: 85 };
    }

    let min = 999;
    let max = 0;
    listForSex.forEach(adh => {
      const age = getAdherentAge(adh);
      if (age < min) min = age;
      if (age > max) max = age;
    });

    return { 
      minClubAge: min === 999 ? 7 : min, 
      maxClubAge: max === 0 ? 85 : max 
    };
  }, [licenciesMuzillac, filterSex]);

  // Intervalle d'âge actif (initialisé et mis à jour automatiquement selon les limites de sexe)
  const [ageRange, setAgeRange] = useState<[number, number]>([minClubAge, maxClubAge]);

  useEffect(() => {
    setAgeRange([minClubAge, maxClubAge]);
  }, [minClubAge, maxClubAge]);

  // Filtrage utilisateur interactif
  const filteredList = useMemo(() => {
    return licenciesMuzillac.filter(adh => {
      // 1. Recherche texte (nom, classement, licence, ville)
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

      // 3. Filtre Âge via slider d'intervalle
      const age = getAdherentAge(adh);
      if (age < ageRange[0] || age > ageRange[1]) {
        return false;
      }

      return true;
    });
  }, [licenciesMuzillac, searchQuery, filterSex, ageRange]);

  return (
    <div className="space-y-3.5">
      
      {/* ==================== BULLE UNIQUE REGROUPÉE (EFFECTIF & PYRAMIDE FFT) ==================== */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-[#141820] border border-[#252b37] flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 text-xs shadow-sm">
        
        {/* Partie Effectif Licencié & Répartition Sexe */}
        <div className="flex items-center space-x-4">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Effectif Licencié</span>
            <div className="flex items-baseline space-x-2">
              <span className="text-xl sm:text-2xl font-heading font-black text-white">{stats.total}</span>
              <span className="text-xs text-zinc-400">joueurs</span>
            </div>
          </div>
          <div className="h-8 w-px bg-zinc-800" />
          <div className="flex flex-col gap-0.5 text-xs">
            <span className="text-blue-400 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              {stats.hommes} Hommes
            </span>
            <span className="text-pink-400 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-pink-500" />
              {stats.femmes} Femmes
            </span>
          </div>
        </div>

        {/* Séparateur vertical */}
        <div className="hidden md:block h-9 w-px bg-zinc-800" />

        {/* Partie Pyramide FFT : 4 bulles alignées sur la même ligne */}
        <div className="space-y-1 w-full md:w-auto">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Pyramide FFT</span>
          <div className="grid grid-cols-4 gap-1.5 sm:flex sm:items-center sm:space-x-2 font-mono text-[11px] sm:text-xs font-bold text-center">
            <span className="px-1.5 sm:px-2.5 py-1 rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/30 whitespace-nowrap">
              {stats.series.deuxieme} en 2e
            </span>
            <span className="px-1.5 sm:px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-300 border border-blue-500/30 whitespace-nowrap">
              {stats.series.troisieme} en 3e
            </span>
            <span className="px-1.5 sm:px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 whitespace-nowrap">
              {stats.series.quatrieme} en 4e
            </span>
            <span className="px-1.5 sm:px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-400 border border-zinc-700 whitespace-nowrap">
              {stats.series.nc} NC
            </span>
          </div>
        </div>

      </div>

      {/* ==================== RECHERCHE & FILTRES ALIGNÉS EN MOBILE & DESKTOP ==================== */}
      <div className="p-3 sm:p-3.5 bg-[#141820] rounded-2xl border border-[#252b37] flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 text-xs shadow-sm">
        
        {/* Recherche texte (pleine largeur sur mobile, calibrée sur desktop) */}
        <div className="relative w-full lg:w-72 shrink-0">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom, classement, licence..."
            className="w-full h-10 bg-[#1b202c] border border-[#2c3547] rounded-xl pl-9 pr-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>

        {/* Filtres Sexe et Slider d'âge unifié : parfaitement alignés sur mobile */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
          
          {/* Choix Hommes / Femmes (grille 3 colonnes alignée en mobile) */}
          <div className="w-full sm:w-auto grid grid-cols-3 sm:flex items-center h-10 bg-[#1b202c] rounded-xl p-1 border border-[#2c3547] shrink-0">
            <button
              onClick={() => setFilterSex('all')}
              className={`h-full px-3 rounded-lg font-bold transition cursor-pointer text-xs flex items-center justify-center ${
                filterSex === 'all' ? 'bg-[#E65100] text-white shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setFilterSex('Messieurs')}
              className={`h-full px-3 rounded-lg font-bold transition cursor-pointer text-xs flex items-center justify-center ${
                filterSex === 'Messieurs' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Hommes ({stats.hommes})
            </button>
            <button
              onClick={() => setFilterSex('Dames')}
              className={`h-full px-3 rounded-lg font-bold transition cursor-pointer text-xs flex items-center justify-center ${
                filterSex === 'Dames' ? 'bg-pink-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Femmes ({stats.femmes})
            </button>
          </div>

          {/* Slider d'âge unifié (pleine largeur alignée en mobile) */}
          <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-3 h-10 bg-[#1b202c] rounded-xl px-3.5 border border-[#2c3547]">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-xs font-bold text-zinc-300">
                Âge : <span className="text-orange-400 font-black">{ageRange[0]}</span>-<span className="text-amber-400 font-black">{ageRange[1]}</span>
              </span>
              {(ageRange[0] > minClubAge || ageRange[1] < maxClubAge) && (
                <button
                  type="button"
                  onClick={() => setAgeRange([minClubAge, maxClubAge])}
                  className="text-[10px] font-bold text-orange-400 hover:text-orange-300 underline cursor-pointer ml-1"
                  title="Réinitialiser l'intervalle d'âge"
                >
                  Tous
                </button>
              )}
            </div>

            {/* Rail unifié compact */}
            <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
              <span className="text-[10px] text-zinc-500 font-mono font-bold shrink-0">{minClubAge}</span>
              <div className="relative w-full sm:w-36 h-5 flex items-center">
                <div className="absolute w-full h-1.5 bg-[#2c3547] rounded-full" />
                <div 
                  className="absolute h-1.5 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full pointer-events-none" 
                  style={{
                    left: `${((ageRange[0] - minClubAge) / Math.max(maxClubAge - minClubAge, 1)) * 100}%`,
                    width: `${((ageRange[1] - ageRange[0]) / Math.max(maxClubAge - minClubAge, 1)) * 100}%`,
                  }}
                />
                <input
                  type="range"
                  min={minClubAge}
                  max={maxClubAge}
                  value={ageRange[0]}
                  onChange={(e) => {
                    const val = Math.min(Number(e.target.value), ageRange[1]);
                    setAgeRange([val, ageRange[1]]);
                  }}
                  className="absolute w-full h-1.5 appearance-none bg-transparent pointer-events-none cursor-pointer z-10
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md hover:[&::-webkit-slider-thumb]:scale-110
                    [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-orange-500 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white"
                  title={`Âge minimum : ${ageRange[0]} ans`}
                />
                <input
                  type="range"
                  min={minClubAge}
                  max={maxClubAge}
                  value={ageRange[1]}
                  onChange={(e) => {
                    const val = Math.max(Number(e.target.value), ageRange[0]);
                    setAgeRange([ageRange[0], val]);
                  }}
                  className="absolute w-full h-1.5 appearance-none bg-transparent pointer-events-none cursor-pointer z-20
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md hover:[&::-webkit-slider-thumb]:scale-110
                    [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-amber-500 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white"
                  title={`Âge maximum : ${ageRange[1]} ans`}
                />
              </div>
              <span className="text-[10px] text-zinc-500 font-mono font-bold shrink-0">{maxClubAge}</span>
            </div>
          </div>

        </div>

      </div>

      {/* ==================== GRILLE COMPACTE DES BULLES DE LICENCIÉS ==================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {filteredList.length > 0 ? (
          filteredList.map((adh) => {
            const meta = getRankingMeta(adh.dernierClassTennis);
            const isFemme = adh.civilite === 'Madame';

            // Teinte complète de la bulle selon le sexe
            const cardGenderStyle = isFemme
              ? "bg-[#201321] hover:bg-[#281729] border-[#442340] hover:border-pink-500/60 shadow-pink-950/20"
              : "bg-[#121927] hover:bg-[#162032] border-[#20324c] hover:border-blue-500/60 shadow-blue-950/20";

            return (
              <div
                key={adh.id}
                onClick={() => onSelectAdherent && onSelectAdherent(adh)}
                className={`${cardGenderStyle} border rounded-xl px-3.5 py-2.5 transition-all shadow-sm hover:shadow-md cursor-pointer group flex items-center justify-between gap-3`}
              >
                {/* Bloc Gauche : Nom, Prénom, Âge et Numéro de licence */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5 truncate">
                    <h3 className={`font-heading font-black text-sm transition truncate ${
                      isFemme 
                        ? 'text-pink-100 group-hover:text-pink-300' 
                        : 'text-blue-100 group-hover:text-blue-300'
                    }`}>
                      {adh.nomPrenom}
                    </h3>
                    <span className="text-[11px] text-zinc-400 font-medium shrink-0">
                      • {adh.ageSportif ? `${adh.ageSportif} ans` : 'Senior'}
                    </span>
                  </div>

                  {/* Numéro de licence FFT direct */}
                  <div className="flex items-center gap-1.5 mt-0.5 text-[10px]">
                    <span className="font-mono font-bold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>N° {adh.licence}</span>
                    </span>
                  </div>
                </div>

                {/* Bloc Droit : Classement FFT actuel & Max */}
                <div className="text-right shrink-0 flex flex-col items-end justify-center">
                  <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black border ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`}>
                    {adh.dernierClassTennis}
                  </span>
                  {(() => {
                    const maxRank = cleanRanking(adh.meilleurClassTennis, '');
                    if (maxRank && maxRank !== adh.dernierClassTennis && isValidTennisRanking(maxRank)) {
                      return (
                        <span className="text-[9px] text-zinc-500 font-semibold mt-0.5" title="Meilleur classement FFT">
                          Max {maxRank}
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full p-8 text-center bg-[#141820] rounded-2xl border border-[#252b37]">
            <Users className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <h3 className="font-heading font-black text-white text-sm">Aucun licencié trouvé</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
              Aucun membre ne correspond à vos filtres actuels.
            </p>
          </div>
        )}
      </div>

    </div>
  );
};
