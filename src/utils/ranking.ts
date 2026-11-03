import { Adherent } from '../types/tennis';

/**
 * Vérifie si le classement est 'ND' (Non Déterminé).
 * Les joueurs ND sont d'anciens classés ayant arrêté la compétition plusieurs années.
 * Ils doivent obligatoirement redemander un reclassement auprès de la FFT (Comité / Ligue)
 * et NE PEUVENT PAS jouer en compétition officielle tant que ce reclassement n'est pas validé.
 */
export function isRankingND(rank: string | undefined): boolean {
  if (!rank) return false;
  const clean = rank.trim().toUpperCase().replace(/\s+/g, '');
  return (
    clean === 'ND' ||
    clean.includes('NONDÉTERMINÉ') ||
    clean.includes('NONDETERMINE') ||
    clean.includes('NONDÉTERMINÉ(ND)') ||
    clean.includes('NON-DÉTERMINÉ') ||
    clean.includes('NON-DETERMINE')
  );
}

/**
 * Vérifie si une valeur correspond à un classement officiel FFT valide
 * (ex: 'NC', '40', '30/1', '15/2', '15', '5/6', '0', '-2/6', 'N25', 'ND'...)
 */
export function isValidTennisRanking(val: any): boolean {
  if (!val) return false;
  const s = String(val).trim().toUpperCase();
  if (isRankingND(s)) return true;
  // Classements numérotés Top 100 français (ex: N20, N85)
  if (/^N\d{1,3}$/.test(s)) return true;
  // Classements standards FFT
  return /^(NC|NON CLASS[EÉ]|40|30\/[1-5]|30|15\/[1-5]|15|[1-5]\/6|0|-[24]\/6|-15|-30)$/.test(s);
}

/**
 * Nettoie et rétablit un classement FFT si Google Sheets l'a converti automatiquement en date ISO.
 * Ex : "15/1" converti par GSheets en "2026-01-14T23:00:00.000Z" -> rétabli en "15/1"
 * Ex : "15/2" converti par GSheets en "2026-02-14T23:00:00.000Z" -> rétabli en "15/2"
 * Ex : "30/1" converti par GSheets en "2026-01-29T23:00:00.000Z" -> rétabli en "30/1"
 * Ex : "5/6" converti par GSheets en "2026-06-04T22:00:00.000Z" -> rétabli en "5/6"
 * Ex : 15 (nombre ou texte) -> "15"
 * Si la valeur est une vraie date non reconvertible, retourne le fallback fourni (par défaut 'NC')
 * et JAMAIS une chaîne de date brute.
 */
export function cleanRanking(val: any, fallback: string = 'NC'): string {
  if (val === undefined || val === null || val === '') return fallback;
  const str = String(val).trim();

  // Si c'est déjà un classement FFT valide
  if (isValidTennisRanking(str)) {
    return str.toUpperCase();
  }

  // Si Google Sheets a transformé un classement avec slash (15/1, 30/1, 5/6...) en Date ISO
  if (str.includes('T') || str.includes('Z') || (str.includes('-') && str.length >= 10)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      // Décalage pour fuseau horaire français (+4h permet de tomber au cœur de la journée locale)
      const localD = new Date(d.getTime() + 4 * 3600 * 1000);
      const day = localD.getUTCDate();
      const month = localD.getUTCMonth() + 1;

      // Série 15/1 à 15/5 (GSheets comprend jour 15 du mois 1 à 5)
      if (day === 15 && month >= 1 && month <= 5) {
        return `15/${month}`;
      }

      // Série 30/1 à 30/5 (GSheets comprend jour 30 ou fin de mois 1 à 5)
      if ((day >= 28 && day <= 31) && month >= 1 && month <= 5) {
        return `30/${month}`;
      }

      // Séries 1/6 à 5/6
      if (month === 6 && day >= 1 && day <= 5) {
        return `${day}/6`;
      }
      if (day === 6 && month >= 1 && month <= 5) {
        return `${month}/6`;
      }
    }
  }

  // Nettoyage standard si format proche (ex: " 15 / 2 ")
  const simplified = str.replace(/\s+/g, '').toUpperCase();
  if (isValidTennisRanking(simplified)) {
    return simplified;
  }

  // Si la valeur contient encore des tirets de date ou un T d'ISO, ne JAMAIS la renvoyer comme classement
  if (str.includes('T') || (str.includes('-') && /\d{4}/.test(str))) {
    return fallback;
  }

  return str.toUpperCase() || fallback;
}

/**
 * Détermine le statut d'affiliation club et de licence de l'adhérent
 * Permet de distinguer :
 * 1. Licencié au TCM Muzillac
 * 2. Licencié dans un autre club FFT (ex: TC Vannes, Sarzeau...)
 * 3. Sans licence (ex: Formule Parent d'élève, adhésion loisir seule)
 */
export function getClubAffiliationBadge(adh: {
  licence?: string;
  typeLicence?: string;
  clubRattachement?: string;
  groupeEnseignement?: string;
}) {
  const rawLicence = (adh.licence || '').trim();
  const rawType = (adh.typeLicence || '').trim();
  const rawGroupe = (adh.groupeEnseignement || '').toLowerCase();
  const isParent = rawGroupe.includes('parent');

  // Adhérent sans licence FFT active
  const hasNoLicence = 
    !rawLicence || 
    rawLicence === '-' || 
    rawLicence === '0' ||
    rawType.toLowerCase().includes('sans licence') ||
    rawType === 'Non renouvelée' ||
    (isParent && !rawLicence);

  if (hasNoLicence) {
    return {
      type: 'sans_licence' as const,
      isTCM: false,
      hasLicence: false,
      label: isParent ? "Sans licence (Parent d'élève)" : "Sans licence",
      shortLabel: isParent ? "Parent d'élève" : "Sans licence",
      badgeClass: "bg-zinc-800 text-zinc-300 border-zinc-700",
    };
  }

  // Adhérent licencié : vérification du club de rattachement
  const rawClub = (adh.clubRattachement || '').trim();
  const clubNorm = rawClub.toLowerCase();
  const isTCM = 
    !rawClub || 
    clubNorm.includes('muzillac') || 
    clubNorm.includes('tcm') || 
    rawClub.includes('52 56 0212') ||
    rawClub.includes('52560212');

  if (isTCM) {
    return {
      type: 'tcm' as const,
      isTCM: true,
      hasLicence: true,
      label: "TCM Muzillac",
      shortLabel: "TCM Muzillac",
      badgeClass: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    };
  }

  // Licencié dans un autre club FFT
  return {
    type: 'autre_club' as const,
    isTCM: false,
    hasLicence: true,
    label: `Licencié ${rawClub}`,
    shortLabel: rawClub,
    badgeClass: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  };
}

/**
 * Poids de chaque classement FFT (Fédération Française de Tennis).
 * Plus le score est élevé, meilleur est le classement (1ère série > 2ème > 3ème > 4ème > NC > ND).
 */
export function getRankingWeight(rank: string | undefined): number {
  if (!rank) return 0;
  const clean = cleanRanking(rank).replace(/\s+/g, '');

  // Classement ND (Non Déterminé) : inéligible compétition, poids négatif pour être classé après NC
  if (isRankingND(clean)) {
    return -1;
  }

  if (clean === 'NC' || clean === 'NON CLASSÉ' || clean === 'NON CLASSE') {
    return 0;
  }

  // Joueurs numérotés (Top 100 français, ex: N25, N80)
  if (clean.startsWith('N') && !clean.includes('NC')) {
    const num = parseInt(clean.replace('N', ''), 10) || 100;
    return 1000 - num;
  }

  const weights: Record<string, number> = {
    // 2ème Série
    '-30': 450,
    '-15': 430,
    '-4/6': 410,
    '-2/6': 390,
    '0': 370,
    '1/6': 350,
    '2/6': 330,
    '3/6': 310,
    '4/6': 290,
    '5/6': 270,
    '15': 250,

    // 3ème Série
    '15/1': 230,
    '15/2': 210,
    '15/3': 190,
    '15/4': 170,
    '15/5': 150,
    '30': 130,

    // 4ème Série
    '30/1': 110,
    '30/2': 90,
    '30/3': 70,
    '30/4': 50,
    '30/5': 30,
    '40': 15,
  };

  return weights[clean] ?? 0;
}

/**
 * Trie la liste des adhérents par classement FFT décroissant (meilleurs classements en premier),
 * puis alphabétiquement par NOM Prénom.
 */
export function sortAdherentsByRankingDesc(adherents: Adherent[]): Adherent[] {
  return [...adherents].sort((a, b) => {
    const weightA = getRankingWeight(a.dernierClassTennis);
    const weightB = getRankingWeight(b.dernierClassTennis);

    if (weightB !== weightA) {
      return weightB - weightA;
    }

    return a.nomPrenom.localeCompare(b.nomPrenom, 'fr');
  });
}

/**
 * Renvoie la série FFT et les styles associés pour l'affichage visuel
 */
export function getRankingMeta(rank: string | undefined): {
  serie: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  isHighRank: boolean;
  isND: boolean;
} {
  const isND = isRankingND(rank);

  if (isND) {
    return {
      serie: 'ND - Non Déterminé (Reclassement FFT requis)',
      badgeBg: 'bg-rose-500/20',
      badgeBorder: 'border-rose-500/50',
      badgeText: 'text-rose-300',
      isHighRank: false,
      isND: true,
    };
  }

  const weight = getRankingWeight(rank);
  const clean = (rank || 'NC').trim().toUpperCase();

  if (weight >= 500) {
    return {
      serie: '1ère Série',
      badgeBg: 'bg-amber-500/20',
      badgeBorder: 'border-amber-500/50',
      badgeText: 'text-amber-400',
      isHighRank: true,
      isND: false,
    };
  }

  if (weight >= 250) {
    return {
      serie: '2ème Série',
      badgeBg: 'bg-orange-500/20',
      badgeBorder: 'border-orange-500/50',
      badgeText: 'text-orange-400',
      isHighRank: true,
      isND: false,
    };
  }

  if (weight >= 130) {
    return {
      serie: '3ème Série',
      badgeBg: 'bg-amber-600/20',
      badgeBorder: 'border-amber-600/40',
      badgeText: 'text-amber-300',
      isHighRank: false,
      isND: false,
    };
  }

  if (weight >= 15) {
    return {
      serie: '4ème Série',
      badgeBg: 'bg-blue-500/15',
      badgeBorder: 'border-blue-500/40',
      badgeText: 'text-blue-300',
      isHighRank: false,
      isND: false,
    };
  }

  return {
    serie: 'Non Classé',
    badgeBg: 'bg-zinc-800/80',
    badgeBorder: 'border-zinc-700',
    badgeText: 'text-zinc-400',
    isHighRank: false,
    isND: false,
  };
}
