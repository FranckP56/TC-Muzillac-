import { Adherent, Rencontre, MatchComposition } from '../types/tennis';
import { getRankingWeight } from './ranking';

export interface RegleNMoins1Result {
  isApplicable: boolean;
  isValid: boolean;
  avantDernierRank?: string;
  avantDernierNom?: string;
  numero1EquipeInfRank?: string;
  numero1EquipeInfNom?: string;
  message: string;
  details: string;
}

/**
 * Valide la règle officielle du "N-1" pour la circulation des joueurs entre équipes d'un même club.
 * 
 * Philosophie FFT / Comité départemental :
 * Permet de pallier un forfait de dernière minute (la veille ou l'avant-veille d'une rencontre)
 * sans modifier la composition de toutes les équipes du club.
 * Elle ne doit en aucun cas être utilisée pour renforcer une équipe inférieure.
 * 
 * Champ d'application :
 * Toutes les divisions départementales, de la Pré-Régionale à la D3 sur tout le championnat.
 * 
 * Principe :
 * Faire jouer un remplaçant de n'importe quel classement inférieur en dernière position d'une équipe.
 * Condition stricte :
 * L'avant-dernier joueur de l'équipe doit avoir un classement supérieur ou égal (>=)
 * au classement du N°1 de l'équipe du dessous.
 * 
 * Exemple :
 * Équipe A : 15/2, 15/4, 15/4, 15/4
 * Équipe B : 15/5, 30, 30, 30/1
 * Si un 15/4 est malade, le club appelle un 30/4 en remplacement en position N°4 de l'équipe A.
 * L'avant-dernier de A (N°3 = 15/4) est supérieur ou égal au N°1 de B (15/5) => RÈGLE N-1 VALIDÉE.
 */
export function validateRegleNMoins1(
  equipeSuperieureSimples: { rank: string; nom: string }[],
  equipeInferieureSimples?: { rank: string; nom: string }[]
): RegleNMoins1Result {
  // Il faut au moins 3 simples pour avoir un avant-dernier et un dernier
  if (equipeSuperieureSimples.length < 3) {
    return {
      isApplicable: false,
      isValid: true,
      message: 'Règle N-1 non applicable (moins de 3 simples dans l\'équipe).',
      details: 'L\'équipe doit comporter au moins 3 simples.'
    };
  }

  // Pas d'équipe inférieure renseignée (ex: c'est la dernière équipe du club, Équipe 3 ou 4)
  if (!equipeInferieureSimples || equipeInferieureSimples.length === 0) {
    return {
      isApplicable: true,
      isValid: true,
      message: 'Règle N-1 valide : Aucune équipe inférieure engagée sous cette équipe.',
      details: 'Le remplacement en dernière position ne risque pas de contourner la hiérarchie du club.'
    };
  }

  // L'avant-dernier joueur de l'équipe supérieure
  const indexAvantDernier = equipeSuperieureSimples.length - 2;
  const avantDernier = equipeSuperieureSimples[indexAvantDernier];
  const dernier = equipeSuperieureSimples[equipeSuperieureSimples.length - 1];

  // Le numéro 1 de l'équipe du dessous
  const numero1EquipeInf = equipeInferieureSimples[0];

  if (!avantDernier || !numero1EquipeInf) {
    return {
      isApplicable: true,
      isValid: true,
      message: 'Données insuffisantes pour vérifier le N°1 de l\'équipe inférieure.',
      details: 'Renseignez les compositions pour un contrôle automatisé.'
    };
  }

  const weightAvantDernier = getRankingWeight(avantDernier.rank);
  const weightNumero1Inf = getRankingWeight(numero1EquipeInf.rank);

  const isValid = weightAvantDernier >= weightNumero1Inf;

  if (isValid) {
    return {
      isApplicable: true,
      isValid: true,
      avantDernierRank: avantDernier.rank,
      avantDernierNom: avantDernier.nom,
      numero1EquipeInfRank: numero1EquipeInf.rank,
      numero1EquipeInfNom: numero1EquipeInf.nom,
      message: `Règle N-1 validée : L'avant-dernier (${avantDernier.nom} [${avantDernier.rank}]) est supérieur ou égal au N°1 de l'équipe inférieure (${numero1EquipeInf.nom} [${numero1EquipeInf.rank}]).`,
      details: `Le remplaçant en dernière position (${dernier?.nom || 'Remplaçant'} [${dernier?.rank || '-'}]) peut jouer légalement pour pallier le forfait de dernière minute sans fausser les équipes inférieures.`
    };
  } else {
    return {
      isApplicable: true,
      isValid: false,
      avantDernierRank: avantDernier.rank,
      avantDernierNom: avantDernier.nom,
      numero1EquipeInfRank: numero1EquipeInf.rank,
      numero1EquipeInfNom: numero1EquipeInf.nom,
      message: `Infraction Règle N-1 : L'avant-dernier (${avantDernier.nom} [${avantDernier.rank}]) a un classement INFÉRIEUR au N°1 de l'équipe inférieure (${numero1EquipeInf.nom} [${numero1EquipeInf.rank}]).`,
      details: `Pour utiliser la règle du N-1 en cas de forfait, le joueur à l'avant-dernière position (${avantDernier.rank}) doit impérativement avoir un classement ≥ au N°1 de l'équipe inférieure (${numero1EquipeInf.rank}). Réajustez la hiérarchie ou sollicitez un joueur mieux classé.`
    };
  }
}

/**
 * Règle des Barrages :
 * Pour éviter de renforcer artificiellement une équipe avec des joueurs ayant joué au-dessus,
 * seuls sont autorisés à jouer les matchs de barrage les joueurs ayant déjà participé à au moins 3 rencontres
 * à ce niveau-là (dans cette équipe ou division au cours de la saison).
 */
export function checkBarrageEligibility(
  adherentId: string,
  rencontre: Rencontre,
  allRencontres: Rencontre[]
): {
  isEligible: boolean;
  matchesPlayed: number;
  requiredMatches: number;
  message: string;
} {
  const isBarrage = 
    (rencontre.libelleHomologation || '').toLowerCase().includes('barrage') ||
    (rencontre.division || '').toLowerCase().includes('barrage') ||
    (rencontre.poule || '').toLowerCase().includes('barrage') ||
    rencontre.composition?.isBarrage === true;

  if (!isBarrage) {
    return {
      isEligible: true,
      matchesPlayed: 0,
      requiredMatches: 0,
      message: 'Rencontre de poule standard (pas un match de barrage).'
    };
  }

  const teamNum = rencontre.numeroEquipe;
  let matchesCount = 0;

  allRencontres.forEach(r => {
    if (r.id === rencontre.id) return; // Ne pas compter le match actuel
    if (r.numeroEquipe !== teamNum) return; // Même équipe / même niveau

    const c = r.composition;
    if (!c) return;

    const played = [
      c.simple1Id,
      c.simple2Id,
      c.simple3Id,
      c.simple4Id,
      c.simple5Id,
      c.double1Player1Id,
      c.double1Player2Id,
      c.double2Player1Id,
      c.double2Player2Id
    ].includes(adherentId);

    if (played) {
      matchesCount++;
    }
  });

  const requiredMatches = 3;
  const isEligible = matchesCount >= requiredMatches;

  return {
    isEligible,
    matchesPlayed: matchesCount,
    requiredMatches,
    message: isEligible
      ? `Éligible barrage : Le joueur a participé à ${matchesCount} rencontre(s) avec cette équipe (minimum 3 requis).`
      : `Inéligible barrage : Le joueur n'a participé qu'à ${matchesCount} rencontre(s) à ce niveau (minimum 3 requis pour éviter le renforcement d'équipe).`
  };
}

/**
 * Règle du Gel des classements (Équipe supérieure exempte ou gagnant par forfait) :
 * Lorsqu'une équipe supérieure ne joue pas (notamment lorsqu'elle gagne une rencontre par forfait),
 * 4 ou 5 classements correspondant à cette équipe sont gelés pour cette journée
 * (interdiction formelle pour ces classements de descendre renforcer une équipe inférieure ce week-end).
 */
export function checkEquipeSuperieureGelee(
  rencontre: Rencontre,
  allRencontres: Rencontre[]
): {
  isFrozenForDay: boolean;
  reason?: string;
  higherTeamNum?: string;
  frozenRankings?: string[];
} {
  const currentTeamStr = rencontre.numeroEquipe || '';
  const currentNumMatch = currentTeamStr.match(/\d+/);
  const currentTeamIndex = currentNumMatch ? parseInt(currentNumMatch[0], 10) : 1;

  if (currentTeamIndex <= 1) {
    // Équipe 1 est l'équipe la plus haute
    return { isFrozenForDay: false };
  }

  // Chercher une équipe supérieure (ex: Équipe 1 si nous sommes Équipe 2) sur la même journée / même date
  const higherTeams = allRencontres.filter(r => {
    if (r.dateRencontre !== rencontre.dateRencontre) return false;
    if (r.sexeHomologation !== rencontre.sexeHomologation) return false;
    const num = r.numeroEquipe.match(/\d+/);
    const idx = num ? parseInt(num[0], 10) : 99;
    return idx < currentTeamIndex;
  });

  for (const ht of higherTeams) {
    const isExemptOuForfait = 
      (ht.score && (ht.score.toLowerCase().includes('wo') || ht.score.toLowerCase().includes('forfait') || ht.score.toLowerCase().includes('exempt'))) ||
      ht.clubVisiteurNom.toLowerCase().includes('exempt') ||
      ht.clubAccueilNom.toLowerCase().includes('exempt') ||
      ht.composition?.isEquipeSuperieureExempte === true;

    if (isExemptOuForfait) {
      return {
        isFrozenForDay: true,
        higherTeamNum: ht.numeroEquipe,
        reason: `L'équipe supérieure (${ht.numeroEquipe}) ne joue pas (exempte ou victoire par forfait). Les 4 ou 5 meilleurs classements de cette équipe sont gelés pour cette journée et ne peuvent pas descendre.`,
        frozenRankings: ht.composition?.frozenPlayers?.map(f => f.classementGele) || []
      };
    }
  }

  return { isFrozenForDay: false };
}
