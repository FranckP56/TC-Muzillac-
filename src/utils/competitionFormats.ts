import { Rencontre, Adherent, MatchComposition } from '../types/tennis';
import { getRankingWeight } from './ranking';
import { getRequiredSex } from './fftEligibility';

export type CompetitionCategoryType = 
  | 'seniors_regional'
  | 'seniors_dept_hommes'
  | 'seniors_dept_dames'
  | 'seniors_plus'
  | 'jeunes';

export interface CompetitionFormatInfo {
  type: CompetitionCategoryType;
  categoryLabel: string;
  divisionLabel: string;
  isRegional: boolean;
  isJeunes: boolean;
  isUnder10: boolean;
  isSeniorsPlus: boolean;
  numSingles: number;
  numDoubles: number;
  minPlayers: number;
  maxPlayers: number;
  pointsSystem: string;
  matchRules: string;
  doubleRules: string;
  expectedDay: 'Samedi' | 'Dimanche';
  orderOfPlay: string;
  doubleWeightStrict: boolean;
}

export const TCM_VENUES = [
  {
    id: 'clos_des_moines_resine',
    name: 'Clos des Moines - 2 courts couverts résine (TCM)',
    courtsCount: 2,
    type: 'home',
    description: 'Complexe sportif du Chêne Rond, Rue du Stade, Muzillac'
  },
  {
    id: 'clos_des_moines_exterieur',
    name: 'Clos des Moines - 2 courts extérieurs béton poreux (TCM)',
    courtsCount: 2,
    type: 'home',
    description: 'Complexe du Chêne Rond, courts extérieurs'
  },
  {
    id: 'tc_nivillac',
    name: 'Salle du TC Nivillac (Emprunt TCM 3 équipes)',
    courtsCount: 2,
    type: 'emprunt',
    description: 'Salle omnisports / tennis de Nivillac - Empruntée lorsque 3 équipes reçoivent en même temps'
  },
  {
    id: 'salle_municipale',
    name: 'Salle omnisports municipale de repli',
    courtsCount: 1,
    type: 'repli',
    description: 'Complexe sportif de Muzillac (repli intempéries)'
  },
  {
    id: 'deplacement',
    name: 'Déplacement / Installations du club adverse',
    courtsCount: 2,
    type: 'away',
    description: 'Club visiteur en championnat'
  }
];

export const STANDARD_HOURS = ['09:00', '14:00'];

/**
 * Analyse une rencontre et détermine le format réglementaire officiel FFT & Ligue de Bretagne
 */
export function getCompetitionFormat(
  rencontre: Rencontre,
  options?: { formatReduit?: boolean }
): CompetitionFormatInfo {
  const cat = (rencontre.categorieAgeHomologation || '').toLowerCase();
  const lib = (rencontre.libelleHomologation || '').toLowerCase();
  const niv = (rencontre.niveauHomologation || '').toLowerCase();
  const div = (rencontre.division || '').toLowerCase();
  const sexe = rencontre.sexeHomologation;

  // 1. Détection Jeunes
  const isJeunes = 
    cat.includes('11') || cat.includes('12') || cat.includes('13') || 
    cat.includes('14') || cat.includes('15') || cat.includes('16') || 
    cat.includes('17') || cat.includes('18') || cat.includes('jeune') || 
    cat.includes('galaxie') || cat.includes('8') || cat.includes('9') || cat.includes('10');

  const isUnder10 = 
    cat.includes('galaxie') || cat.includes('rouge') || cat.includes('orange') || 
    cat.includes('vert') || cat.includes('violet') || cat.includes('8') || 
    cat.includes('9') || cat.includes('10 ans') || cat.includes('9/10');

  if (isJeunes) {
    return {
      type: 'jeunes',
      categoryLabel: 'Championnat Jeunes (Filles ou Garçons)',
      divisionLabel: 'Ligue de Bretagne / Comité 56',
      isRegional: false,
      isJeunes: true,
      isUnder10,
      isSeniorsPlus: false,
      numSingles: 2,
      numDoubles: 1,
      minPlayers: 2,
      maxPlayers: 3,
      pointsSystem: '2 simples (1 pt chacun) + 1 double (1 pt) = 3 points en jeu',
      matchRules: isUnder10
        ? 'Moins de 10 ans (Galaxie Tennis) : Terrains réduits & balles souples/intermédiaires. Formats très courts (sets de 3 ou 4 jeux, point décisif No-Ad, super tie-break).'
        : '11 à 18 ans : Terrain classique & balles dures. Simples au meilleur des 3 sets (3e set Super Tie-Break 10 points en départemental).',
      doubleRules: 'Double systématiquement en formule simplifiée (point décisif No-Ad et Super Tie-Break 10 points au 3e set). Les 2 joueurs de simple peuvent faire le double ensemble.',
      expectedDay: 'Samedi',
      orderOfPlay: 'Simple 1, Simple 2, puis le Double',
      doubleWeightStrict: false,
    };
  }

  // 2. Détection Seniors+ (Vétérans : +35, +45, +55, +65...)
  const isSeniorsPlus = 
    cat.includes('+') || cat.includes('35') || cat.includes('45') || 
    cat.includes('55') || cat.includes('65') || cat.includes('vétéran') || 
    cat.includes('senior+');

  if (isSeniorsPlus) {
    return {
      type: 'seniors_plus',
      categoryLabel: 'Championnat Seniors+ (Vétérans Harmonisé Bretagne)',
      divisionLabel: 'Toutes divisions (Régional & Départemental)',
      isRegional: niv.includes('région') || lib.includes('région'),
      isJeunes: false,
      isUnder10: false,
      isSeniorsPlus: true,
      numSingles: 3,
      numDoubles: 1,
      minPlayers: 3,
      maxPlayers: 5,
      pointsSystem: '3 simples (1 pt chacun) + 1 double (1 ou 2 pts selon division)',
      matchRules: 'Simples : Format classique (2 sets à 6 jeux, 3e set traditionnel ou super tie-break selon les divisions).',
      doubleRules: 'Double : Format raccourci avec point décisif (No-Ad à 40A) et Super Tie-Break en 10 points en guise de 3e set (protection physique des joueurs).',
      expectedDay: 'Dimanche',
      orderOfPlay: 'Simple 1, Simple 2, Simple 3, puis le Double',
      doubleWeightStrict: false,
    };
  }

  // 3. Seniors Régional, Pré-Régionale et Départemental (D1, D2, D3)
  const reqSex = getRequiredSex(rencontre);
  const isFemme = reqSex === 'F';
  const combined = `${div} ${lib} ${niv}`.toLowerCase();

  // Détection Pré-Régionale (division qualificative Pré-Régionale)
  const isPreRegionale = 
    combined.includes('pré-rég') || 
    combined.includes('pre-reg') || 
    combined.includes('prérég') || 
    combined.includes('prereg') || 
    combined.includes('pré région') || 
    combined.includes('pre region') || 
    div === 'pr' || 
    div.startsWith('pr ') || 
    div.endsWith(' pr') ||
    combined.includes('qualificative pré-régionale') ||
    combined.includes('qualificative pre-regionale');

  // Détection Championnat Régional pur (Pré-Nationale, R1, R2, R3)
  const isPureRegional = 
    !isPreRegionale && (
      combined.includes('pré-nat') || 
      combined.includes('prenat') || 
      div.includes('r1') || 
      div.includes('r2') || 
      div.includes('r3') || 
      div.includes('pn') ||
      (niv.includes('région') && !isPreRegionale)
    );

  // Détection Division D1
  const isD1 = 
    !isPreRegionale && !isPureRegional && (
      div.includes('d1') || 
      div.includes('division 1') || 
      div.includes('1ère division') || 
      div.includes('1ere division') || 
      div === '1' ||
      lib.includes('division 1') ||
      lib.includes(' d1')
    );

  // Détection Division D2
  const isD2 = 
    !isPreRegionale && !isPureRegional && !isD1 && (
      div.includes('d2') || 
      div.includes('division 2') || 
      div.includes('2ème division') || 
      div.includes('2eme division') || 
      div === '2' ||
      lib.includes('division 2') ||
      lib.includes(' d2')
    );

  // Détection Division D3 (ou inférieure)
  const isD3 = 
    !isPreRegionale && !isPureRegional && !isD1 && !isD2 && (
      div.includes('d3') || 
      div.includes('division 3') || 
      div.includes('3ème division') || 
      div.includes('3eme division') || 
      div === '3' ||
      lib.includes('division 3') ||
      lib.includes(' d3')
    );

  // CAS A : Régional pur (Pré-Nationale, R1, R2, R3) — 4 simples + 2 doubles
  if (isPureRegional) {
    return {
      type: 'seniors_regional',
      categoryLabel: 'Championnat Régional Seniors (Ligue de Bretagne)',
      divisionLabel: div.toUpperCase() || 'Régionale',
      isRegional: true,
      isJeunes: false,
      isUnder10: false,
      isSeniorsPlus: false,
      numSingles: 4,
      numDoubles: 2,
      minPlayers: 4,
      maxPlayers: 6,
      pointsSystem: '4 simples (1 pt chacun) + 2 doubles (1 pt chacun) = 6 points en jeu',
      matchRules: 'Simples : 2 sets à 6 jeux avec avantage, 3e set classique.',
      doubleRules: 'RÈGLE DES DOUBLES FFT : 2 doubles disputés. Le Double 1 doit impérativement avoir un cumul de classement supérieur ou égal au Double 2 (Poids D1 >= Poids D2) !',
      expectedDay: 'Dimanche',
      orderOfPlay: 'Simples 4 et 2 en simultané, puis Simples 3 et 1, puis Doubles 1 et 2',
      doubleWeightStrict: true,
    };
  }

  // CAS B : Division qualificative Pré-Régionale (Féminin & Masculin) — 4 simples + 2 doubles
  if (isPreRegionale) {
    return {
      type: 'seniors_regional',
      categoryLabel: isFemme ? 'Division qualificative Pré-Régionale Féminine' : 'Division qualificative Pré-Régionale Masculine',
      divisionLabel: 'Pré-Régionale',
      isRegional: true,
      isJeunes: false,
      isUnder10: false,
      isSeniorsPlus: false,
      numSingles: 4,
      numDoubles: 2,
      minPlayers: 4,
      maxPlayers: 6,
      pointsSystem: '4 simples (1 pt chacun) + 2 doubles (1 pt chacun) = 6 points en jeu',
      matchRules: 'Simples : 2 sets à 6 jeux avec avantage, 3e set classique.',
      doubleRules: 'RÈGLE DES DOUBLES FFT : 2 doubles disputés en Pré-Régionale. Le Double 1 doit impérativement avoir un cumul de classement supérieur ou égal au Double 2 (Poids D1 >= Poids D2) !',
      expectedDay: 'Dimanche',
      orderOfPlay: 'Désaccord capitaines : 4-2, 3-1, doubles sur 2 courts OU 4-2, Double 2, 3-1, Double 1 sur 1 court',
      doubleWeightStrict: true,
    };
  }

  // CAS C : Division D1
  if (isD1) {
    if (isFemme) {
      // D1 Féminine : 4 simples + 1 double
      return {
        type: 'seniors_dept_dames',
        categoryLabel: 'Championnat Départemental Seniors Dames — Division 1 (D1)',
        divisionLabel: 'Division 1 (D1)',
        isRegional: false,
        isJeunes: false,
        isUnder10: false,
        isSeniorsPlus: false,
        numSingles: 4,
        numDoubles: 1,
        minPlayers: 4,
        maxPlayers: 5,
        pointsSystem: '4 simples (1 pt chacun) + 1 double (2 pts / point décisif) = 6 points',
        matchRules: 'Simples : Format officiel départemental au meilleur des 3 sets.',
        doubleRules: '1 double disputé (compte double ou point décisif en cas d\'égalité).',
        expectedDay: 'Dimanche',
        orderOfPlay: 'Simples 4 à 1 dans l\'ordre décroissant des classements, suivis du double',
        doubleWeightStrict: false,
      };
    } else {
      // D1 Masculine (Nouveauté 2027) : 4 simples + 2 doubles
      return {
        type: 'seniors_dept_hommes',
        categoryLabel: 'Championnat Départemental Seniors Messieurs — Division 1 (D1 - Nouveauté 2027)',
        divisionLabel: 'Division 1 (D1 - Nouveauté 2027)',
        isRegional: false,
        isJeunes: false,
        isUnder10: false,
        isSeniorsPlus: false,
        numSingles: 4,
        numDoubles: 2,
        minPlayers: 4,
        maxPlayers: 6,
        pointsSystem: '4 simples (1 pt chacun) + 2 doubles (1 pt chacun) = 6 points en jeu',
        matchRules: 'Simples : Format officiel départemental au meilleur des 3 sets.',
        doubleRules: 'NOUVEAUTÉ 2027 : 2 doubles disputés en D1 Messieurs ! Le Double 1 doit impérativement avoir un cumul de classement supérieur ou égal au Double 2 (Poids D1 >= Poids D2) !',
        expectedDay: 'Dimanche',
        orderOfPlay: 'Ordre 4-3-2-1 puis doubles (ou 4-3, 2-1 sur 2 courts)',
        doubleWeightStrict: true,
      };
    }
  }

  // CAS D : Division D2
  if (isD2) {
    if (isFemme) {
      // D2 Féminine : 3 simples + 1 double
      return {
        type: 'seniors_dept_dames',
        categoryLabel: 'Championnat Départemental Seniors Dames — Division 2 (D2)',
        divisionLabel: 'Division 2 (D2)',
        isRegional: false,
        isJeunes: false,
        isUnder10: false,
        isSeniorsPlus: false,
        numSingles: 3,
        numDoubles: 1,
        minPlayers: 3,
        maxPlayers: 5,
        pointsSystem: '3 simples (1 pt chacun) + 1 double (2 pts / point décisif) = 5 points',
        matchRules: 'Simples : Format officiel départemental au meilleur des 3 sets.',
        doubleRules: '1 double disputé (compte double ou sert de point décisif).',
        expectedDay: 'Dimanche',
        orderOfPlay: 'Ordre officiel 1-2-3 - double (sur 2 courts : Simple 3 et Double en même temps)',
        doubleWeightStrict: false,
      };
    } else {
      // D2 Masculine : 5 simples + 1 double
      const numSingles = options?.formatReduit ? 3 : 5;
      return {
        type: 'seniors_dept_hommes',
        categoryLabel: 'Championnat Départemental Seniors Messieurs — Division 2 (D2)',
        divisionLabel: 'Division 2 (D2)',
        isRegional: false,
        isJeunes: false,
        isUnder10: false,
        isSeniorsPlus: false,
        numSingles,
        numDoubles: 1,
        minPlayers: numSingles >= 5 ? 4 : 3,
        maxPlayers: 6,
        pointsSystem: numSingles >= 5 
          ? '5 simples (1 pt chacun) + 1 double (2 pts / point décisif) = 7 points'
          : `${numSingles} simples (1 pt chacun) + 1 double (2 pts) = format réduit`,
        matchRules: 'Simples : Format officiel départemental au meilleur des 3 sets.',
        doubleRules: '1 double disputé (le double compte double ou sert de point décisif en cas d\'égalité).',
        expectedDay: 'Dimanche',
        orderOfPlay: 'Ordre officiel 4-3-2-1-5 - double (sur 2 courts : Simple 5 et Double en même temps)',
        doubleWeightStrict: false,
      };
    }
  }

  // CAS E : Division D3 (ou inférieure / par défaut départemental)
  if (isFemme) {
    // D3 Féminine : 3 simples + 1 double
    return {
      type: 'seniors_dept_dames',
      categoryLabel: `Championnat Départemental Seniors Dames — ${div ? div.toUpperCase() : 'Division 3 (D3)'}`,
      divisionLabel: div ? div.toUpperCase() : 'Division 3 (D3)',
      isRegional: false,
      isJeunes: false,
      isUnder10: false,
      isSeniorsPlus: false,
      numSingles: 3,
      numDoubles: 1,
      minPlayers: 3,
      maxPlayers: 5,
      pointsSystem: '3 simples (1 pt chacun) + 1 double (2 pts / point décisif) = 5 points',
      matchRules: 'Simples : Format officiel départemental au meilleur des 3 sets.',
      doubleRules: '1 double disputé (compte double ou sert de point décisif).',
      expectedDay: 'Dimanche',
      orderOfPlay: 'Ordre officiel 1-2-3 - double (sur 2 courts : Simple 3 et Double en même temps)',
      doubleWeightStrict: false,
    };
  } else {
    // D3 Masculine : 5 simples + 1 double
    const numSingles = options?.formatReduit ? 3 : 5;
    return {
      type: 'seniors_dept_hommes',
      categoryLabel: `Championnat Départemental Seniors Messieurs — ${div ? div.toUpperCase() : 'Division 3 (D3)'}`,
      divisionLabel: div ? div.toUpperCase() : 'Division 3 (D3)',
      isRegional: false,
      isJeunes: false,
      isUnder10: false,
      isSeniorsPlus: false,
      numSingles,
      numDoubles: 1,
      minPlayers: numSingles >= 5 ? 4 : 3,
      maxPlayers: 6,
      pointsSystem: numSingles >= 5 
        ? '5 simples (1 pt chacun) + 1 double (2 pts / point décisif) = 7 points'
        : `${numSingles} simples (1 pt chacun) + 1 double (2 pts) = format réduit`,
      matchRules: 'Simples : Format officiel départemental au meilleur des 3 sets.',
      doubleRules: '1 double disputé (le double compte double ou sert de point décisif en cas d\'égalité).',
      expectedDay: 'Dimanche',
      orderOfPlay: 'Ordre officiel 4-3-2-1-5 - double (sur 2 courts : Simple 5 et Double en même temps)',
      doubleWeightStrict: false,
    };
  }
}

/**
 * Valide la conformité du jour de la semaine et l'alternance d'une date de rencontre
 */
export function validateMatchDateAndSchedule(
  dateStr: string,
  format: CompetitionFormatInfo,
  sexe: 'Messieurs' | 'Dames' | 'Mixte'
): {
  isValidDay: boolean;
  dayName: string;
  isSaturday: boolean;
  isSunday: boolean;
  alternationMessage: string;
  warning?: string;
} {
  if (!dateStr || !dateStr.includes('/')) {
    return {
      isValidDay: true,
      dayName: 'Date non renseignée',
      isSaturday: false,
      isSunday: false,
      alternationMessage: 'Date à définir',
    };
  }

  const parts = dateStr.split('/');
  if (parts.length < 3) {
    return {
      isValidDay: true,
      dayName: 'Format date',
      isSaturday: false,
      isSunday: false,
      alternationMessage: '',
    };
  }

  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const y = parseInt(parts[2], 10);
  const dateObj = new Date(y, m, d);

  const dayOfWeek = dateObj.getDay(); // 0 = Dimanche, 6 = Samedi
  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const dayName = days[dayOfWeek];

  const isSaturday = dayOfWeek === 6;
  const isSunday = dayOfWeek === 0;

  // Règle 1 : CHAMPIONNATS SENIORS+ (Vétérans +35, +45, +55, +65...)
  // Hommes et Femmes jouent le MÊME week-end (le dimanche), et il n'y a PAS de compétition jeunes.
  if (format.isSeniorsPlus) {
    const alternationMessage = 'Week-end Seniors+ (+35, +45...) : Hommes et Femmes jouent le même week-end (dimanche). Pas de championnat jeunes.';
    
    if (!isSunday) {
      return {
        isValidDay: false,
        dayName,
        isSaturday,
        isSunday,
        alternationMessage,
        warning: `Attention : Les championnats Seniors+ se jouent le DIMANCHE. La date indiquée est un ${dayName} (accord préalable requis en cas de dérogation).`,
      };
    }

    return {
      isValidDay: true,
      dayName,
      isSaturday,
      isSunday,
      alternationMessage,
    };
  }

  // Règle 2 : À PARTIR DU CHAMPIONNAT SENIOR & JEUNES
  // Alternance stricte en Bretagne (hors vacances scolaires) :
  // - 1 week-end Femme le dimanche & Garçons le samedi d'avant
  // - 1 week-end Homme le dimanche & Filles le samedi d'avant
  // Calcul de la semaine ISO de référence
  const target = new Date(dateObj.valueOf());
  const dayNr = (dateObj.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  
  // Parité : Semaine paire = Week-end Hommes (Dimanche) & Filles (Samedi)
  // Semaine impaire = Week-end Femmes (Dimanche) & Garçons (Samedi)
  const isWeekendHommesFilles = weekNumber % 2 === 0;
  
  let alternationMessage = '';
  if (isWeekendHommesFilles) {
    alternationMessage = 'Alternance FFT : Week-end Hommes (Dimanche) & Jeunes Filles (Samedi)';
  } else {
    alternationMessage = 'Alternance FFT : Week-end Femmes (Dimanche) & Jeunes Garçons (Samedi)';
  }

  // Contrôle jour attendu Jeunes
  if (format.isJeunes) {
    if (!isSaturday) {
      return {
        isValidDay: false,
        dayName,
        isSaturday,
        isSunday,
        alternationMessage,
        warning: `Attention : Les championnats Jeunes se disputent le SAMEDI. La date indiquée est un ${dayName}.`,
      };
    }

    // Cohérence Filles vs Garçons
    if (sexe === 'Dames' && !isWeekendHommesFilles) {
      return {
        isValidDay: true,
        dayName,
        isSaturday,
        isSunday,
        alternationMessage,
        warning: `Attention au calendrier FFT Bretagne : Ce samedi correspond normalement au tour des Garçons (le dimanche qui suit est le week-end des Seniors Femmes). Les Filles jouent normalement le week-end des Hommes.`,
      };
    }

    if (sexe === 'Messieurs' && isWeekendHommesFilles) {
      return {
        isValidDay: true,
        dayName,
        isSaturday,
        isSunday,
        alternationMessage,
        warning: `Attention au calendrier FFT Bretagne : Ce samedi correspond normalement au tour des Filles (le dimanche qui suit est le week-end des Seniors Hommes). Les Garçons jouent normalement le week-end des Femmes.`,
      };
    }

    return {
      isValidDay: true,
      dayName,
      isSaturday,
      isSunday,
      alternationMessage,
    };
  }

  // Contrôle jour attendu Seniors (Dimanche)
  if (!isSunday) {
    return {
      isValidDay: false,
      dayName,
      isSaturday,
      isSunday,
      alternationMessage,
      warning: `Attention : Les championnats Seniors se jouent le DIMANCHE. La date indiquée est un ${dayName}.`,
    };
  }

  // Cohérence alternance Seniors Hommes vs Seniors Femmes
  if (sexe === 'Dames' && isWeekendHommesFilles) {
    return {
      isValidDay: true,
      dayName,
      isSaturday,
      isSunday,
      alternationMessage,
      warning: `Attention au calendrier FFT Bretagne : Ce dimanche correspond au week-end des HOMMES. Le championnat Seniors Dames se joue le dimanche alterné (1 week-end sur 2, hors vacances).`,
    };
  }

  if (sexe === 'Messieurs' && !isWeekendHommesFilles) {
    return {
      isValidDay: true,
      dayName,
      isSaturday,
      isSunday,
      alternationMessage,
      warning: `Attention au calendrier FFT Bretagne : Ce dimanche correspond au week-end des FEMMES. Le championnat Seniors Hommes se joue le dimanche alterné (1 week-end sur 2, hors vacances).`,
    };
  }

  return {
    isValidDay: true,
    dayName,
    isSaturday,
    isSunday,
    alternationMessage,
  };
}

export interface DoublesWeightCheckResult {
  isValid: boolean;
  weightDouble1: number;
  weightDouble2: number;
  p1Rank: string;
  p2Rank: string;
  p3Rank: string;
  p4Rank: string;
  errorMessage?: string;
  isComplete: boolean;
}

/**
 * Vérifie la règle obligatoire FFT du poids des doubles en Championnat Régional
 * Le cumul des classements de la paire Double 1 doit être supérieur ou égal au Double 2
 */
export function checkRegionalDoublesWeight(
  composition: MatchComposition,
  adherentsById: Map<string, Adherent>
): DoublesWeightCheckResult {
  const d1p1 = composition.double1Player1Id ? adherentsById.get(composition.double1Player1Id) : null;
  const d1p2 = composition.double1Player2Id ? adherentsById.get(composition.double1Player2Id) : null;
  const d2p1 = composition.double2Player1Id ? adherentsById.get(composition.double2Player1Id) : null;
  const d2p2 = composition.double2Player2Id ? adherentsById.get(composition.double2Player2Id) : null;

  const w1 = (d1p1 ? getRankingWeight(d1p1.dernierClassTennis) : 0) + (d1p2 ? getRankingWeight(d1p2.dernierClassTennis) : 0);
  const w2 = (d2p1 ? getRankingWeight(d2p1.dernierClassTennis) : 0) + (d2p2 ? getRankingWeight(d2p2.dernierClassTennis) : 0);

  const isComplete = !!(d1p1 && d1p2 && d2p1 && d2p2);

  if (!isComplete) {
    return {
      isValid: true, // Non bloqué tant que les 4 joueurs de double ne sont pas encore tous saisis
      weightDouble1: w1,
      weightDouble2: w2,
      p1Rank: d1p1?.dernierClassTennis || '-',
      p2Rank: d1p2?.dernierClassTennis || '-',
      p3Rank: d2p1?.dernierClassTennis || '-',
      p4Rank: d2p2?.dernierClassTennis || '-',
      errorMessage: undefined,
      isComplete: false,
    };
  }

  // Règle FFT stricte : Le Double 1 doit avoir un poids supérieur ou égal au Double 2
  const isValid = w1 >= w2;

  let errorMessage: string | undefined;
  if (!isValid) {
    errorMessage = `Infraction Règle des Doubles Régionale FFT : La paire Double 2 (${d2p1?.nomPrenom} [${d2p1?.dernierClassTennis}] + ${d2p2?.nomPrenom} [${d2p2?.dernierClassTennis}] = ${w2} pts) est plus forte que la paire Double 1 (${d1p1?.nomPrenom} [${d1p1?.dernierClassTennis}] + ${d1p2?.nomPrenom} [${d1p2?.dernierClassTennis}] = ${w1} pts). La paire n°1 doit impérativement être la plus forte. Veuillez inverser les deux équipes de double.`;
  }

  return {
    isValid,
    weightDouble1: w1,
    weightDouble2: w2,
    p1Rank: d1p1?.dernierClassTennis || '-',
    p2Rank: d1p2?.dernierClassTennis || '-',
    p3Rank: d2p1?.dernierClassTennis || '-',
    p4Rank: d2p2?.dernierClassTennis || '-',
    errorMessage,
    isComplete: true,
  };
}
