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
 * Poids de chaque classement FFT (Fédération Française de Tennis).
 * Plus le score est élevé, meilleur est le classement (1ère série > 2ème > 3ème > 4ème > NC > ND).
 */
export function getRankingWeight(rank: string | undefined): number {
  if (!rank) return 0;
  const clean = rank.trim().toUpperCase().replace(/\s+/g, '');

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
