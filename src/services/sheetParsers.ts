import { Adherent, Rencontre, SexeHomologation } from '../types/tennis';
import { normalizeDateString } from '../utils/dateUtils';
import { formatFrenchPhoneNumber } from '../utils/phoneUtils';
import { cleanRanking, isValidTennisRanking } from '../utils/ranking';
export { normalizeDateString, formatFrenchPhoneNumber };

/**
 * Normalise une clé d'en-tête pour matching insensible à la casse et aux accents
 */
function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, "'")
    .trim();
}

function findColIdx(
  headers: string[], 
  candidates: string[], 
  fallbackIdx: number = -1,
  exclude: string[] = []
): number {
  const normHeaders = headers.map(normalizeHeader);
  const normExclude = exclude.map(normalizeHeader);
  const isExcluded = (h: string) => normExclude.some(ex => h.includes(ex));

  for (const cand of candidates) {
    const normCand = normalizeHeader(cand);
    const idx = normHeaders.findIndex(h => h === normCand && !isExcluded(h));
    if (idx >= 0) return idx;
  }
  for (const cand of candidates) {
    const normCand = normalizeHeader(cand);
    const idx = normHeaders.findIndex(h => h.includes(normCand) && !isExcluded(h));
    if (idx >= 0) return idx;
  }
  return fallbackIdx;
}

export function parseAdherentRow(cols: any[], rawHeaders: string[], rowIndex: number): Adherent | null {
  const nomPrenomIdx = findColIdx(rawHeaders, ['nom prenom', 'nom et prenom', 'adherent'], 0);
  const nomPrenom = String(cols[nomPrenomIdx] || '').trim();
  if (!nomPrenom) return null;

  const idxCivilite = findColIdx(rawHeaders, ['civilite', 'sexe'], 5);
  const idxDateNaiss = findColIdx(rawHeaders, ['date naiss.', 'date naissance', 'naissance'], 6);
  const idxSolde = findColIdx(rawHeaders, ['solde du', 'solde'], 1);
  const idxLicence = findColIdx(rawHeaders, ['licence', 'n° licence'], 22);
  const idxMillesime = findColIdx(rawHeaders, ['millesime derniere licence', 'millesime'], 23);
  const idxTelPort = findColIdx(rawHeaders, ['telephone portable', 'portable'], 18);
  const idxEmail = findColIdx(rawHeaders, ['email', 'mail'], 20);
  const idxClassTennis = findColIdx(rawHeaders, ['dernier class. tennis', 'dernier classement', 'classement'], 29, ['date']);
  const idxMeilleurClass = findColIdx(rawHeaders, ['meilleur class. tennis', 'meilleur class.', 'meilleur class', 'meilleur classement', 'classement max', 'meilleur'], -1, ['date']);
  const idxAgeSportif = findColIdx(rawHeaders, ['age sportif', 'echelon'], 39);
  const idxGroupe = findColIdx(rawHeaders, ['groupe enseignement', 'cours', 'groupe'], 54);
  const idxTenUp = findColIdx(rawHeaders, ["compte ten'up", 'tenup'], 65);
  const idxVille = findColIdx(rawHeaders, ['ville', 'commune'], 13);
  const idxClub = findColIdx(rawHeaders, ['nom du club', 'club de rattachement', 'club'], 27);
  const idxCommentaire = findColIdx(rawHeaders, ['commentaire'], 62);

  // Parsing Solde
  let soldeDu = 0;
  const rawSolde = cols[idxSolde >= 0 ? idxSolde : 1];
  if (typeof rawSolde === 'number') {
    soldeDu = rawSolde;
  } else if (rawSolde) {
    const clean = String(rawSolde).replace('€', '').replace(/\s+/g, '').replace(',', '.');
    soldeDu = parseFloat(clean) || 0;
  }

  // Civilité
  const rawCiv = String(cols[idxCivilite >= 0 ? idxCivilite : 5] || '').toLowerCase().trim();
  const civilite = (
    rawCiv.includes('madame') || 
    rawCiv.includes('fem') || 
    rawCiv === 'f' || 
    rawCiv === 'mme' || 
    rawCiv === 'mlle' ||
    rawCiv.includes('dame')
  ) ? 'Madame' : 'Monsieur';

  const dateNaissance = normalizeDateString(cols[idxDateNaiss >= 0 ? idxDateNaiss : 6]);
  const licence = String(cols[idxLicence >= 0 ? idxLicence : 22] || '').trim();
  const millesime = String(cols[idxMillesime >= 0 ? idxMillesime : 23] || '').trim();

  // Colonne BA (index 52) : Inscription / Formule cours
  const idxFormule = findColIdx(rawHeaders, ['formule cours', 'inscrit cours', 'cours collectif', 'formule', 'statut cours', 'inscription cours'], 52);
  const rawFormule = String(cols[idxFormule >= 0 ? idxFormule : 52] || '').trim();
  const lowerFormule = rawFormule.toLowerCase();
  const inscritEnCours = rawFormule !== '' && 
    rawFormule !== '0' && 
    lowerFormule !== 'non' && 
    lowerFormule !== 'false' && 
    lowerFormule !== 'pratique libre' &&
    lowerFormule !== 'aucun';

  let rawGroupe = String(cols[idxGroupe >= 0 ? idxGroupe : 54] || '').trim();
  if (!rawGroupe) rawGroupe = 'Pratique libre';
  const groupe = rawGroupe.split('(')[0].trim() || rawGroupe;

  let typeLicence = 'C';
  if (!licence || !millesime) {
    typeLicence = groupe.toLowerCase().includes('parent') ? "Sans licence (Parent d'élève)" : 'Sans licence';
  } else if (millesime !== '2027') {
    typeLicence = `Expirée (${millesime})`;
  }

  const rawTel = cols[idxTelPort >= 0 ? idxTelPort : 18];
  const tel = formatFrenchPhoneNumber(rawTel);

  // Assainissement du Dernier Classement
  const dernierClass = cleanRanking(cols[idxClassTennis >= 0 ? idxClassTennis : 29], 'NC');

  // Assainissement du Meilleur Classement (en évitant la colonne Date)
  let rawMeilleur: any = '';
  if (idxMeilleurClass >= 0 && cols[idxMeilleurClass] !== undefined) {
    rawMeilleur = cols[idxMeilleurClass];
  } else if (cols[32] !== undefined && isValidTennisRanking(cleanRanking(cols[32], ''))) {
    rawMeilleur = cols[32];
  } else if (cols[31] !== undefined && isValidTennisRanking(cleanRanking(cols[31], ''))) {
    rawMeilleur = cols[31];
  } else if (cols[33] !== undefined && isValidTennisRanking(cleanRanking(cols[33], ''))) {
    rawMeilleur = cols[33];
  }

  let meilleurClass = cleanRanking(rawMeilleur, dernierClass);
  if (!isValidTennisRanking(meilleurClass)) {
    meilleurClass = dernierClass;
  }

  const tenUp = String(cols[idxTenUp >= 0 ? idxTenUp : 65] || 'Non créé').trim();
  const ville = String(cols[idxVille >= 0 ? idxVille : 13] || 'MUZILLAC').trim();
  const rawClub = cols[idxClub >= 0 ? idxClub : 27];
  const club = rawClub ? String(rawClub).trim() : 'MUZILLAC TENNIS CLUB';
  const commentaire = String(cols[idxCommentaire >= 0 ? idxCommentaire : 62] || '').trim();
  const ageSportif = String(cols[idxAgeSportif >= 0 ? idxAgeSportif : 39] || '').trim();
  const adresse = String(cols[10] || cols[11] || '').trim();
  const codePostal = String(cols[12] || '56190').trim();
  const representantLegal = String(cols[8] || '').trim();

  return {
    id: `adh-${rowIndex}-${licence || nomPrenom.replace(/\s+/g, '_')}`,
    nomPrenom,
    civilite,
    dateNaissance,
    typeLicence,
    millesimeLicence: millesime,
    soldeDu,
    telephonePortable: tel,
    email: String(cols[idxEmail >= 0 ? idxEmail : 20] || '').trim(),
    dernierClassTennis: dernierClass,
    meilleurClassTennis: meilleurClass,
    licence,
    ageSportif,
    groupeEnseignement: groupe,
    formuleCours: rawFormule,
    inscritEnCours: inscritEnCours || (groupe !== 'Pratique libre' && groupe !== ''),
    compteTenUp: tenUp,
    ville,
    codePostal,
    adresse,
    representantLegal,
    clubRattachement: club,
    commentaire,
  };
}

export function parseRencontreRow(cols: any[], rawHeaders: string[], rowIndex: number): Rencontre | null {
  const getVal = (candidates: string[], fallbackIdx: number): string => {
    const idx = findColIdx(rawHeaders, candidates, fallbackIdx);
    return idx >= 0 && cols[idx] !== undefined && cols[idx] !== null ? String(cols[idx]).trim() : '';
  };

  const libelleHomologation = getVal(["libelle de l'homologation", 'libelle homologation'], 1) || 'Championnat par équipes';
  
  // Colonne C : Sexe de l'homologation ('H' pour Homme/Messieurs, 'F' pour Femme/Dames)
  const rawSexe = getVal(["sexe de l'homologation", 'sexe'], 2).trim().toUpperCase();
  let sexeHomologation: SexeHomologation = 'Messieurs';
  if (rawSexe === 'F' || rawSexe.startsWith('F') || rawSexe.includes('DAME') || rawSexe.includes('FEM')) {
    sexeHomologation = 'Dames';
  } else if (rawSexe.includes('MIX')) {
    sexeHomologation = 'Mixte';
  } else {
    sexeHomologation = 'Messieurs';
  }

  // Colonne D : Catégorie d'âge de l'homologation (ex: '+35', 'Seniors +35', 'Seniors', '11/12'...)
  const rawCatAge = getVal(["categorie d'age de l'homologation", 'categorie', 'age'], 3) || 'Seniors';

  const numeroEquipe = getVal(["numero de l'equipe", 'equipe'], 6) || `Équipe ${rowIndex}`;
  const rawDate = getVal(['date de la rencontre', 'date'], 7);
  const dateRencontre = rawDate ? normalizeDateString(rawDate) : 'Date à définir';

  return {
    id: `match-${rowIndex}-${dateRencontre.replace(/\//g, '')}-${numeroEquipe.replace(/\s+/g, '')}`,
    niveauHomologation: getVal(["niveau de l'homologation", 'niveau'], 0) || 'Départemental',
    libelleHomologation,
    sexeHomologation,
    categorieAgeHomologation: rawCatAge,
    division: getVal(['division'], 4),
    poule: getVal(['poule'], 5),
    numeroEquipe,
    dateRencontre,
    journee: getVal(['journee n°', 'journee'], 8),
    clubAccueilNom: getVal(["club d'accueil nom", 'accueil'], 10) || 'TC Muzillac',
    clubVisiteurNom: getVal(['club visiteur nom', 'visiteur'], 12) || 'Adversaire',
    score: getVal(['score'], 14) || 'À jouer',
    nomCapitaine: getVal(['nom capitaine', 'capitaine'], 17) || 'Non désigné',
    prenomCapitaine: getVal(['prenom capitaine'], 18),
    licenceCapitaine: getVal(['licence capitaine'], 19),
    portableCapitaine: formatFrenchPhoneNumber(getVal(['portable capitaine'], 20)),
    mailCapitaine: getVal(['mail capitaine'], 21),
    nomCapitaineAdverse: getVal(['nom capitaine adverse'], 22),
    prenomCapitaineAdverse: getVal(['prenom capitaine adverse'], 23),
    licenceCapitaineAdverse: getVal(['licence capitaine adverse'], 24),
    portableCapitaineAdverse: formatFrenchPhoneNumber(getVal(['portable capitaine adverse'], 25)),
    mailCapitaineAdverse: getVal(['mail capitaine adverse'], 26),
    nomCorrespondant: getVal(['nom correspondant'], 27),
    prenomCorrespondant: getVal(['prenom correspondant'], 28),
    licenceCorrespondant: getVal(['licence correspondant'], 29),
    portableCorrespondant: formatFrenchPhoneNumber(getVal(['portable correspondant'], 30)),
    mailCorrespondant: getVal(['mail correspondant'], 31),
    nomCorrespondantAdverse: getVal(['nom correspondant adverse'], 32),
    prenomCorrespondantAdverse: getVal(['prenom correspondant adverse'], 33),
    licenceCorrespondantAdverse: getVal(['licence correspondant adverse'], 34),
    portableCorrespondantAdverse: formatFrenchPhoneNumber(getVal(['portable correspondant adverse'], 35)),
    mailCorrespondantAdverse: getVal(['mail correspondant adverse'], 36),
    adresse1Installation: getVal(['adresse 1 installation'], 37),
    adresse2Installation: getVal(['adresse 2 installation'], 38),
    codePostalInstallation: getVal(['code postal installation'], 39),
    villeInstallation: getVal(['ville installation'], 40),
  };
}
