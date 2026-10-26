import { Adherent } from '../types/tennis';

/**
 * Critères officiels des licenciés du club affectables aux rencontres interclubs :
 * - Millésime de licence 2027 (Colonne X de l'onglet Adhérents)
 * - Club de rattachement : MUZILLAC TENNIS CLUB (Colonne AB de l'onglet Adhérents)
 * - N° de licence valide
 */
export function isLicencieMuzillac2027(adherent: Adherent): boolean {
  if (!adherent) return false;

  // 1. Colonne X : Millésime 2027
  const millesime = String(adherent.millesimeLicence || '').trim();
  const is2027 = millesime === '2027' || millesime.includes('2027');

  // 2. Colonne AB : MUZILLAC TENNIS CLUB
  const club = (adherent.clubRattachement || '').toUpperCase().trim();
  const isMuzillac = 
    club.includes('MUZILLAC') || 
    club === 'MUZILLAC TENNIS CLUB' ||
    club.includes('TCM');

  // 3. Licence renseignée
  const hasLicence = !!adherent.licence && adherent.licence.trim().length >= 4;

  return is2027 && isMuzillac && hasLicence;
}

/**
 * Filtre et renvoie uniquement les licenciés officiels 2027 du Tennis Club de Muzillac
 */
export function filterLicenciesMuzillac2027(adherents: Adherent[]): Adherent[] {
  return adherents.filter(isLicencieMuzillac2027);
}

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
