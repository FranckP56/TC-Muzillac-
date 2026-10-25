import { Adherent, Rencontre, EligibilityResult } from '../types/tennis';
import { isRankingND } from './ranking';

/**
 * Extrait l'année de naissance depuis une chaîne de date (ex: "14/05/1989", "1989-05-14", "1989")
 */
export function extractBirthYear(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  const clean = dateStr.trim();

  // Format 4 chiffres directs (ex: "1989")
  if (/^\d{4}$/.test(clean)) {
    return parseInt(clean, 10);
  }

  // Format français JJ/MM/AAAA (ex: "14/05/1989")
  const frMatch = clean.match(/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b/);
  if (frMatch && frMatch[3]) {
    return parseInt(frMatch[3], 10);
  }

  // Format ISO AAAA-MM-JJ (ex: "1989-05-14")
  const isoMatch = clean.match(/\b(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\b/);
  if (isoMatch && isoMatch[1]) {
    return parseInt(isoMatch[1], 10);
  }

  return null;
}

/**
 * Normalise la catégorie d'âge d'une rencontre pour l'application des règles FFT 2027
 */
export function normalizeCategory(categoryStr: string, libelleStr: string = ''): string {
  const combined = `${categoryStr} ${libelleStr}`.toLowerCase();

  if (combined.includes('11/12') || combined.includes('11-12') || combined.includes('12 ans')) {
    return '11/12';
  }
  if (combined.includes('13/14') || combined.includes('13-14') || combined.includes('14 ans')) {
    return '13/14';
  }
  if (combined.includes('15/16') || combined.includes('15-16') || combined.includes('16 ans')) {
    return '15/16';
  }
  if (combined.includes('17/18') || combined.includes('17-18') || combined.includes('18 ans')) {
    return '17/18';
  }
  if (combined.includes('+70') || combined.includes('70 ans') || combined.includes('70')) {
    return '+70';
  }
  if (combined.includes('+65') || combined.includes('65 ans') || combined.includes('65')) {
    return '+65';
  }
  if (combined.includes('+55') || combined.includes('55 ans') || combined.includes('55')) {
    return '+55';
  }
  if (combined.includes('+45') || combined.includes('45 ans') || combined.includes('45')) {
    return '+45';
  }
  if (combined.includes('+35') || combined.includes('35 ans') || combined.includes('35')) {
    return '+35';
  }

  // Par défaut, championnat Senior standard
  return 'seniors';
}

/**
 * Détermine le sexe attendu pour la rencontre (Colonne C du GSheet : 'H' pour Homme, 'F' pour Femme)
 */
export function getRequiredSex(rencontre: Rencontre): 'H' | 'F' | 'Mixte' {
  if (rencontre.sexeHomologation) {
    const s = String(rencontre.sexeHomologation).trim().toUpperCase();
    if (s === 'F' || s.startsWith('F') || s.includes('DAME') || s.includes('FEM')) return 'F';
    if (s === 'H' || s.startsWith('H') || s.includes('MESSIEURS') || s.includes('HOMME')) return 'H';
    if (s.includes('MIX')) return 'Mixte';
  }

  const combined = `${rencontre.libelleHomologation || ''} ${rencontre.categorieAgeHomologation || ''} ${rencontre.numeroEquipe || ''}`.toLowerCase();
  if (
    combined.includes('dame') || 
    combined.includes('femm') || 
    combined.includes('fille') || 
    combined.includes('+35 dames') || 
    combined.includes('+35 f') ||
    combined.includes('senior f') ||
    combined.includes('seniors f')
  ) {
    return 'F';
  }
  if (
    combined.includes('messieur') || 
    combined.includes('homme') || 
    combined.includes('garçon') || 
    combined.includes('garcon') ||
    combined.includes('+35 h') ||
    combined.includes('senior h') ||
    combined.includes('seniors h')
  ) {
    return 'H';
  }
  if (combined.includes('mixte') || combined.includes('mix')) {
    return 'Mixte';
  }

  return 'H';
}

/**
 * Vérification de l'éligibilité FFT d'un joueur pour le Millésime 2027
 * Règles FFT 2027 :
 * 1. Licence : Types autorisés = 'C' (Club/Compétition) ou 'W' (Compétition Web Multi-raquettes) + Millésime 2027 actif
 * 2. Sexe : Monsieur = H, Madame = F, aligné sur le sexe de la rencontre
 * 3. Âge (Millésime 2027) :
 *    - 11/12 ans = nés en 2015 et 2016
 *    - 13/14 ans = nés en 2013 et 2014
 *    - 15/16 ans = nés en 2011 et 2012
 *    - 17/18 ans = nés en 2009 et 2010
 *    - Seniors = nés en 2008 et avant
 *    - Seniors +35 = nés entre 1988 et 1992 (et 1992 ou avant)
 *    - Seniors +45 = nés entre 1978 et 1982 (et 1982 ou avant)
 *    - Seniors +55 = nés entre 1968 et 1972 (et 1972 ou avant)
 *    - Seniors +65 = nés en 1962 et avant
 */
export function checkFFT2027Eligibility(
  adherent: Adherent,
  rencontre: Rencontre
): EligibilityResult {
  const errors: string[] = [];

  // 1. VÉRIFICATION DU TYPE ET DU MILLÉSIME DE LICENCE
  // Types autorisés : 'C' (Club Compétition) ou 'W' (Compétition Web)
  const rawLicenceType = (adherent.typeLicence || 'C').trim().toUpperCase();
  const millesime = String(adherent.millesimeLicence || '').trim();
  const hasLicenceNumber = !!adherent.licence && adherent.licence.trim().length > 3;

  let licenceValid = true;
  let licenceError: string | undefined;

  // Si le millésime est renseigné et antérieur à 2027 (ex: 2026, 2025...)
  if (millesime && millesime !== '2027') {
    licenceValid = false;
    licenceError = `Licence non renouvelée pour le millésime 2027 (dernière licence : ${millesime})`;
    errors.push(licenceError);
  } else if (!hasLicenceNumber) {
    licenceValid = false;
    licenceError = "Aucun numéro de licence FFT enregistré dans le classeur";
    errors.push(licenceError);
  } else if (rawLicenceType !== 'C' && rawLicenceType !== 'W') {
    licenceValid = false;
    licenceError = `Statut de licence '${rawLicenceType}' non autorisé en compétition (types autorisés : C ou W)`;
    errors.push(licenceError);
  }

  // 2. VÉRIFICATION DU SEXE (Civilité vs Homologation)
  // Monsieur = H, Madame = F
  const playerSex = adherent.civilite === 'Madame' ? 'F' : 'H';
  const reqSex = getRequiredSex(rencontre);
  let sexeValid = true;
  let sexeError: string | undefined;

  if (reqSex !== 'Mixte' && playerSex !== reqSex) {
    sexeValid = false;
    const playerLabel = adherent.civilite === 'Madame' ? 'Joueuse (Madame)' : 'Joueur (Monsieur)';
    const matchLabel = reqSex === 'H' ? 'Épreuve Hommes / Messieurs' : 'Épreuve Dames';
    sexeError = `Incompatibilité de sexe : ${playerLabel} pour une ${matchLabel}`;
    errors.push(sexeError);
  }

  // 3. VÉRIFICATION DE L'ÂGE (Millésime 2027)
  const birthYear = extractBirthYear(adherent.dateNaissance);
  let ageSportif2027: number | null = null;
  if (birthYear !== null) {
    ageSportif2027 = 2027 - birthYear;
  }

  const normalizedCategory = normalizeCategory(
    rencontre.categorieAgeHomologation,
    rencontre.libelleHomologation
  );

  let ageValid = true;
  let ageError: string | undefined;

  if (birthYear === null) {
    ageValid = false;
    ageError = "Date de naissance non renseignée (impossible de certifier le millésime 2027)";
    errors.push(ageError);
  } else {
    switch (normalizedCategory) {
      case '11/12':
        // Nés en 2015 et 2016
        if (birthYear !== 2015 && birthYear !== 2016) {
          ageValid = false;
          ageError = `Catégorie 11/12 ans : réservé aux nés en 2015 et 2016 (joueur né en ${birthYear})`;
          errors.push(ageError);
        }
        break;

      case '13/14':
        // Nés en 2013 et 2014
        if (birthYear !== 2013 && birthYear !== 2014) {
          ageValid = false;
          ageError = `Catégorie 13/14 ans : réservé aux nés en 2013 et 2014 (joueur né en ${birthYear})`;
          errors.push(ageError);
        }
        break;

      case '15/16':
        // Nés en 2011 et 2012
        if (birthYear !== 2011 && birthYear !== 2012) {
          ageValid = false;
          ageError = `Catégorie 15/16 ans : réservé aux nés en 2011 et 2012 (joueur né en ${birthYear})`;
          errors.push(ageError);
        }
        break;

      case '17/18':
        // Nés en 2009 et 2010
        if (birthYear !== 2009 && birthYear !== 2010) {
          ageValid = false;
          ageError = `Catégorie 17/18 ans : réservé aux nés en 2009 et 2010 (joueur né en ${birthYear})`;
          errors.push(ageError);
        }
        break;

      case '+35':
        // Seniors +35 : nés entre 1988 et 1992 (et 1992 ou avant)
        if (birthYear > 1992) {
          ageValid = false;
          ageError = `Catégorie Seniors +35 : réservé aux joueurs de 35 ans et + (nés en 1992 et avant, joueur né en ${birthYear})`;
          errors.push(ageError);
        }
        break;

      case '+45':
        // Seniors +45 : nés entre 1978 et 1982 (et 1982 ou avant)
        if (birthYear > 1982) {
          ageValid = false;
          ageError = `Catégorie Seniors +45 : réservé aux joueurs de 45 ans et + (nés en 1982 et avant, joueur né en ${birthYear})`;
          errors.push(ageError);
        }
        break;

      case '+55':
        // Seniors +55 : nés en 1972 et avant
        if (birthYear > 1972) {
          ageValid = false;
          ageError = `Catégorie Seniors +55 : réservé aux joueurs nés en 1972 et avant (joueur né en ${birthYear})`;
          errors.push(ageError);
        }
        break;

      case '+65':
        // Seniors +65 : nés en 1962 et avant
        if (birthYear > 1962) {
          ageValid = false;
          ageError = `Catégorie Seniors +65 : réservé aux joueurs nés en 1962 et avant (joueur né en ${birthYear})`;
          errors.push(ageError);
        }
        break;

      case 'seniors':
      default:
        // Catégorie Seniors = nés en 2008 et avant
        if (birthYear > 2008) {
          ageValid = false;
          ageError = `Catégorie Seniors : réservé aux joueurs nés en 2008 et avant (joueur né en ${birthYear}, catégorie jeune)`;
          errors.push(ageError);
        }
        break;
    }
  }

  // 4. VÉRIFICATION DU CLASSEMENT FFT (Règle spécifique ND - Non Déterminé)
  // Les classements ND sont attribués aux joueurs qui ont interrompu la compétition plusieurs années (anciens classés).
  // Ils doivent obligatoirement redemander un reclassement auprès de la FFT (Ligue/Comité) et NE PEUVENT PAS jouer en compétition officielle.
  let rankingValid = true;
  let rankingError: string | undefined;

  if (isRankingND(adherent.dernierClassTennis)) {
    rankingValid = false;
    rankingError = "Classement ND (Non Déterminé) : Reclassement FFT requis. Joueur inéligible en compétition par équipes (ancien classé ayant arrêté la compétition plusieurs années, demande de reclassement obligatoire auprès du Comité/Ligue).";
    errors.push(rankingError);
  }

  const isEligible = licenceValid && sexeValid && ageValid && rankingValid;

  return {
    isEligible,
    birthYear,
    ageSportif2027,
    licenceValid,
    licenceError,
    sexeValid,
    sexeError,
    ageValid,
    ageError,
    rankingValid,
    rankingError,
    errors,
  };
}
