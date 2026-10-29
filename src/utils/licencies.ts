import { Adherent } from '../types/tennis';

/**
 * Critères officiels des licenciés du club affectables aux rencontres interclubs :
 * - Millésime de licence correspondant à la saison active (Colonne X de l'onglet Adhérents)
 * - Club de rattachement : MUZILLAC TENNIS CLUB (Colonne AB de l'onglet Adhérents)
 * - N° de licence valide
 */
export function isLicencieMuzillac(adherent: Adherent, saison: string = '2027'): boolean {
  if (!adherent) return false;

  // 1. Colonne X : Millésime de la saison active
  const millesime = String(adherent.millesimeLicence || '').trim();
  const isSaisonActive = millesime === saison || millesime.includes(saison);

  // 2. Colonne AB : MUZILLAC TENNIS CLUB
  const club = (adherent.clubRattachement || '').toUpperCase().trim();
  const isMuzillac = 
    club.includes('MUZILLAC') || 
    club === 'MUZILLAC TENNIS CLUB' ||
    club.includes('TCM');

  // 3. Licence renseignée
  const hasLicence = !!adherent.licence && adherent.licence.trim().length >= 4;

  return isSaisonActive && isMuzillac && hasLicence;
}

export const isLicencieMuzillac2027 = (adherent: Adherent, saison: string = '2027') => isLicencieMuzillac(adherent, saison);

/**
 * Filtre et renvoie uniquement les licenciés officiels de la saison active du Tennis Club de Muzillac
 */
export function filterLicenciesMuzillac(adherents: Adherent[], saison: string = '2027'): Adherent[] {
  return adherents.filter(a => isLicencieMuzillac(a, saison));
}

export const filterLicenciesMuzillac2027 = (adherents: Adherent[], saison: string = '2027') => filterLicenciesMuzillac(adherents, saison);

/**
 * Statistiques clés des licenciés 2027
 */
export function getLicenciesStats(licencies: Adherent[]) {
  const total = licencies.length;
  let hommes = 0;
  let femmes = 0;
  let avecSoldeDu = 0;
  let totalSoldeDu = 0;
  let avecTenUp = 0;

  const series = {
    deuxieme: 0, // 15 et au-dessus
    troisieme: 0, // 15/1 à 30
    quatrieme: 0, // 30/1 à 40
    nc: 0,        // NC
  };

  licencies.forEach(l => {
    if (l.civilite === 'Madame') femmes++;
    else hommes++;

    if (l.soldeDu < 0) {
      avecSoldeDu++;
      totalSoldeDu += Math.abs(l.soldeDu);
    }

    if (l.compteTenUp && l.compteTenUp.toLowerCase().includes('créé')) {
      avecTenUp++;
    }

    const rank = (l.dernierClassTennis || 'NC').toUpperCase().trim();
    if (rank === 'NC') {
      series.nc++;
    } else if (
      rank.startsWith('30/1') || 
      rank.startsWith('30/2') || 
      rank.startsWith('30/3') || 
      rank.startsWith('30/4') || 
      rank.startsWith('30/5') || 
      rank === '40'
    ) {
      series.quatrieme++;
    } else if (
      rank.startsWith('15/1') || 
      rank.startsWith('15/2') || 
      rank.startsWith('15/3') || 
      rank.startsWith('15/4') || 
      rank.startsWith('15/5') || 
      rank === '30'
    ) {
      series.troisieme++;
    } else {
      series.deuxieme++;
    }
  });

  return {
    total,
    hommes,
    femmes,
    avecSoldeDu,
    totalSoldeDu,
    avecTenUp,
    series,
  };
}
