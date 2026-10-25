import { Adherent, ClubInfo, Rencontre, SexeHomologation } from '../types/tennis';
import realAdherentsData from './realAdherents.json';
import realRencontresData from './realRencontres.json';

export const REAL_DATA_FILE_URL = '/assets/aistudio/Donn_es_appli_dad0017a';
export const REAL_RENCONTRES_FILE_URL = '/assets/aistudio/Donn_es_appli_rencontres';

export const INITIAL_CLUB_INFO: ClubInfo = {
  nom: 'Tennis Club de Muzillac',
  sigle: 'TCM',
  ligue: 'Ligue de Bretagne de Tennis',
  comite: 'Comité Départemental du Morbihan (56)',
  codeClub: '52 56 0212',
  adresse: 'Complexe sportif du Chêne Rond, Rue du Stade',
  codePostal: '56190',
  ville: 'Muzillac',
  email: 'tennisclubmuzillac@gmail.com',
  telephone: '02 97 41 67 80',
  siteWeb: 'https://tennis-club-muzillac.fr',
  president: 'Laurent Le Guennec',
  secretaire: 'Sophie Bourdon',
  tresorier: 'Philippe Conan',
  enseignant: 'Alexandre Rault (Diplômé d\'État)',
  enseignants: [
    {
      id: 'prof-1',
      nomPrenom: 'Alexandre Rault',
      diplome: 'Diplômé d\'État (DE)',
      telephone: '06 12 34 56 78',
      email: 'alexandre.rault.tennis@gmail.com',
      description: 'Responsable pédagogique, école de tennis compétition, équipes régionales et cours adultes.',
    },
    {
      id: 'prof-2',
      nomPrenom: 'Thomas Mercier',
      diplome: 'BPJEPS Tennis',
      telephone: '06 98 76 54 32',
      email: 'thomas.mercier.tennis@gmail.com',
      description: 'Enseignant Galaxie Tennis (moins de 10 ans), perfectionnement jeunes et cours collectifs adultes.',
    },
  ],
  installations: [
    '2 courts couverts en résine (Salle du Clos des Moines, Complexe du Chêne Rond)',
    '2 courts extérieurs en béton poreux (Clos des Moines)',
    '2 courts couverts empruntés à la Salle du TC Nivillac (en cas de 3 réceptions simultanées)',
    'Club-house convivial avec vestiaires, douches et espace d\'accueil',
    'Accès sécurisé par badge électronique et réservation Ten\'Up',
  ],
  tarifs: [
    { id: 't1', label: 'Cotisation Jeune Galaxie (1h/semaine)', montant: 135, categorie: 'jeune', description: 'Licence FFT comprise' },
    { id: 't2', label: 'École de Tennis Jeunes (1h30/semaine)', montant: 185, categorie: 'jeune', description: 'Licence FFT + entraînements' },
    { id: 't3', label: 'Pôle Compétition Jeunes (2 x 1h30)', montant: 260, categorie: 'competition', description: 'Préparation championnats' },
    { id: 't4', label: 'Cours Collectifs Adultes (1h30/semaine)', montant: 215, categorie: 'adulte', description: 'Licence FFT incluse' },
    { id: 't5', label: 'Adhésion seule / Accès courts libre', montant: 110, categorie: 'adhesion', description: 'Accès 7j/7 + badge' },
  ],
  horairesPermanence: 'Mercredi 14h-18h et Samedi 10h-12h au Club-house',
};

/**
 * En-têtes officiels attendus dans l'onglet 'Adhérents' du GSheet Données_appli (66 colonnes)
 */
export const GSHEET_ADHERENTS_HEADERS = [
  "Nom Prénom", "Solde", "Famille", "Nom", "Prénom", "Civilité", "Date Naiss.", "Age.", 
  "Statut représentant légal", "Nationalité", "Adresse", "Adresse", "CP", "Ville", "Pays", 
  "Téléphone Domicile Principal", "2eme Téléphone Domicile", "Téléphone Bureau", "Téléphone Portable", 
  "2eme Téléphone portable", "Email", "2eme Email", "Licence", "Millésime dernière Licence", 
  "Date enr. Licence", "Date d'édition", "N° du club de rattachement", "Nom du club", 
  "Fidélité club de la dernière licence active", "Dernier class. tennis", "Echelon", 
  "Date dernier class. tennis", "Meilleur class. tennis", "Date meilleur class. tennis", 
  "Dernier class. padel", "Date dernier class. padel", "Dernier class. beach", "Date dernier class. beach", 
  "Niveau", "Age sportif", "Echelon niv.", "Cond. jeu", "JIFF", 
  "Millésime sportif plus ancienne licence connue", "Plus ancienne année adhésion pour le club", 
  "Nbre de tickets restant", "Total des réductions accordées sur la dernière année adhésion", 
  "Licencié dans un autre club", "Dernière Année Adhésion", "Grand public", "Abonnements", 
  "Carnets de ticket", "Cours", "Stage", "Groupe enseignement", "Niveau de jeu", "Solde", 
  "Échéances à venir", "Badge", "Nb résa max simultanées", "Nombre de réservation sur l'année en cours", 
  "Disponibilités", "Commentaire", "Saisie libre 1", "Saisie libre 2", "Compte Ten'UP"
];

/**
 * En-têtes officiels attendus dans l'onglet 'Rencontres' du GSheet Données_appli (41 colonnes)
 */
export const GSHEET_RENCONTRES_HEADERS = [
  "Niveau de l'homologation", "Libellé de l'homologation", "Sexe de l'homologation", 
  "Catégorie d'âge de l'homologation", "Division", "Poule", "Numéro de l'équipe", 
  "Date de la rencontre", "Journée n°", "Club d'accueil code", "Club d'accueil nom", 
  "Club visiteur code", "Club visiteur nom", "Vainqueur", "Score", "Juge-arbitre nom", 
  "Juge-arbitre prénom", "Nom capitaine", "Prénom capitaine", "Licence capitaine", 
  "Portable capitaine", "Mail capitaine", "Nom capitaine adverse", "Prénom capitaine adverse", 
  "Licence capitaine adverse", "Portable capitaine adverse", "Mail capitaine adverse", 
  "Nom correspondant", "Prénom correspondant", "Licence correspondant", "Portable correspondant", 
  "Mail correspondant", "Nom correspondant adverse", "Prénom correspondant adverse", 
  "Licence correspondant adverse", "Portable correspondant adverse", "Mail correspondant adverse", 
  "Adresse 1 installation", "Adresse 2 installation", "Code postal installation", "Ville installation"
];

/**
 * Parse une ligne CSV complexe gérant les guillemets et virgules imbriquées
 */
export function parseCsvLine(text: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

/**
 * Parser complet pour le CSV brut de l'onglet Adhérents du GSheet Données_appli
 */
export function parseAdherentsCsv(rawCsv: string): Adherent[] {
  const lines = rawCsv.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) return [];

  const headers = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
  
  // Repérage dynamique des index de colonnes
  const idxNomPrenom = headers.indexOf('nom prénom');
  const idxSolde = headers.indexOf('solde');
  const idxCivilite = headers.indexOf('civilité');
  const idxDateNaiss = headers.indexOf('date naiss.');
  const idxTelPort = headers.indexOf('téléphone portable');
  const idxEmail = headers.indexOf('email');
  const idxLicence = headers.indexOf('licence');
  const idxMillesime = headers.indexOf('millésime dernière licence');
  const idxClassTennis = headers.indexOf('dernier class. tennis');
  const idxMeilleurClass = headers.indexOf('meilleur class. tennis');
  const idxGroupe = headers.indexOf('groupe enseignement');
  const idxNiveauJeu = headers.indexOf('niveau de jeu');
  const idxCours = headers.indexOf('cours');
  const idxAbonnements = headers.indexOf('abonnements');
  const idxVille = headers.indexOf('ville');
  const idxTenUp = headers.indexOf('compte ten\'up');
  const idxClub = headers.indexOf('nom du club');
  const idxCommentaire = headers.indexOf('commentaire');
  const idxAgeSportif = headers.indexOf('age sportif');

  const list: Adherent[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const nomPrenom = cols[idxNomPrenom >= 0 ? idxNomPrenom : 0] || '';
    if (!nomPrenom || nomPrenom.trim() === '' || nomPrenom === ',') continue;

    // Normalisation du solde :
    // - nombre négatif (ex: -199) = dû au club (Impayé)
    // - nombre positif (ex: 20) = à régulariser (Avoir / Trop-perçu)
    // - 0 = à jour
    let soldeDu = 0;
    const rawSolde = cols[idxSolde >= 0 ? idxSolde : 1] || '0';
    const cleanSolde = rawSolde.replace('€', '').replace(/\s+/g, '').replace(',', '.');
    soldeDu = parseFloat(cleanSolde) || 0;

    const rawCivilite = (cols[idxCivilite >= 0 ? idxCivilite : 5] || '').toLowerCase().trim();
    const civilite = (
      rawCivilite.includes('madame') || 
      rawCivilite.includes('fem') || 
      rawCivilite === 'f' || 
      rawCivilite === 'mme' || 
      rawCivilite === 'mlle' ||
      rawCivilite.includes('dame')
    ) ? 'Madame' : 'Monsieur';
    const dateNaissance = cols[idxDateNaiss >= 0 ? idxDateNaiss : 6] || '';
    const licence = cols[idxLicence >= 0 ? idxLicence : 22] || '';
    const millesime = cols[idxMillesime >= 0 ? idxMillesime : 23] || '';
    
    // Type de licence : si millésime 2027 et licence valide -> 'C' (Club Compétition)
    // si non renouvelée -> 'Non renouvelée'
    let typeLicence = 'C';
    if (!licence || !millesime) {
      typeLicence = 'Non renouvelée';
    } else if (millesime !== '2027') {
      typeLicence = `Expirée (${millesime})`;
    }

    let tel = cols[idxTelPort >= 0 ? idxTelPort : 18] || '';
    if (tel.startsWith('33')) {
      tel = '0' + tel.slice(2).trim();
    }

    const dernierClass = (cols[idxClassTennis >= 0 ? idxClassTennis : 29] || 'NC').toUpperCase();
    const meilleurClass = (cols[idxMeilleurClass >= 0 ? idxMeilleurClass : 32] || dernierClass).toUpperCase();

    let rawGroupe = cols[idxGroupe >= 0 ? idxGroupe : 54] || '';
    if (!rawGroupe && idxNiveauJeu >= 0) rawGroupe = cols[idxNiveauJeu];
    if (!rawGroupe && idxCours >= 0) rawGroupe = cols[idxCours];
    if (!rawGroupe && idxAbonnements >= 0) rawGroupe = cols[idxAbonnements];
    if (!rawGroupe) rawGroupe = 'Pratique libre';
    const groupe = rawGroupe.split('(')[0].trim() || rawGroupe;

    const tenUp = cols[idxTenUp >= 0 ? idxTenUp : 65] || 'Non créé';
    const ville = cols[idxVille >= 0 ? idxVille : 13] || 'MUZILLAC';
    const club = cols[idxClub >= 0 ? idxClub : 27] || 'MUZILLAC TENNIS CLUB';
    const commentaire = cols[idxCommentaire >= 0 ? idxCommentaire : 62] || '';
    const ageSportif = cols[idxAgeSportif >= 0 ? idxAgeSportif : 39] || '';

    list.push({
      id: `adh-${i}`,
      nomPrenom,
      civilite,
      dateNaissance,
      typeLicence,
      millesimeLicence: millesime,
      soldeDu,
      telephonePortable: tel,
      email: cols[idxEmail >= 0 ? idxEmail : 20] || '',
      dernierClassTennis: dernierClass,
      meilleurClassTennis: meilleurClass,
      licence,
      ageSportif,
      groupeEnseignement: groupe,
      compteTenUp: tenUp,
      ville,
      clubRattachement: club,
      commentaire,
    });
  }

  return list;
}

/**
 * Données réelles complètes (159 adhérents) issues du fichier GSheet Données_appli officiel du TCM
 */
export const INITIAL_ADHERENTS: Adherent[] = realAdherentsData as Adherent[];

/**
 * Parser complet pour le CSV brut de l'onglet 'Rencontres' du GSheet Données_appli (41 colonnes officielles)
 */
export function parseRencontresCsv(rawCsv: string): Rencontre[] {
  const lines = rawCsv.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) return [];

  const headers = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());

  // Fonction helper pour retrouver l'index de colonne par nom
  const findCol = (name: string, fallbackIdx: number = -1): number => {
    const idx = headers.indexOf(name.toLowerCase());
    return idx >= 0 ? idx : fallbackIdx;
  };

  const idxNiveau = findCol("niveau de l'homologation", 0);
  const idxLibelle = findCol("libellé de l'homologation", 1);
  const idxSexe = findCol("sexe de l'homologation", 2);
  const idxCatAge = findCol("catégorie d'âge de l'homologation", 3);
  const idxDivision = findCol("division", 4);
  const idxPoule = findCol("poule", 5);
  const idxEquipe = findCol("numéro de l'équipe", 6);
  const idxDate = findCol("date de la rencontre", 7);
  const idxJournee = findCol("journée n°", 8);
  const idxClubAccueilCode = findCol("club d'accueil code", 9);
  const idxClubAccueilNom = findCol("club d'accueil nom", 10);
  const idxClubVisiteurCode = findCol("club visiteur code", 11);
  const idxClubVisiteurNom = findCol("club visiteur nom", 12);
  const idxVainqueur = findCol("vainqueur", 13);
  const idxScore = findCol("score", 14);
  const idxJugeArbitreNom = findCol("juge-arbitre nom", 15);
  const idxJugeArbitrePrenom = findCol("juge-arbitre prénom", 16);
  const idxNomCapitaine = findCol("nom capitaine", 17);
  const idxPrenomCapitaine = findCol("prénom capitaine", 18);
  const idxLicenceCapitaine = findCol("licence capitaine", 19);
  const idxPortableCapitaine = findCol("portable capitaine", 20);
  const idxMailCapitaine = findCol("mail capitaine", 21);
  const idxNomCapitaineAdv = findCol("nom capitaine adverse", 22);
  const idxPrenomCapitaineAdv = findCol("prénom capitaine adverse", 23);
  const idxLicenceCapitaineAdv = findCol("licence capitaine adverse", 24);
  const idxPortableCapitaineAdv = findCol("portable capitaine adverse", 25);
  const idxMailCapitaineAdv = findCol("mail capitaine adverse", 26);
  const idxNomCorrespondant = findCol("nom correspondant", 27);
  const idxPrenomCorrespondant = findCol("prénom correspondant", 28);
  const idxLicenceCorrespondant = findCol("licence correspondant", 29);
  const idxPortableCorrespondant = findCol("portable correspondant", 30);
  const idxMailCorrespondant = findCol("mail correspondant", 31);
  const idxNomCorrespondantAdv = findCol("nom correspondant adverse", 32);
  const idxPrenomCorrespondantAdv = findCol("prénom correspondant adverse", 33);
  const idxLicenceCorrespondantAdv = findCol("licence correspondant adverse", 34);
  const idxPortableCorrespondantAdv = findCol("portable correspondant adverse", 35);
  const idxMailCorrespondantAdv = findCol("mail correspondant adverse", 36);
  const idxAdresse1 = findCol("adresse 1 installation", 37);
  const idxAdresse2 = findCol("adresse 2 installation", 38);
  const idxCpInstallation = findCol("code postal installation", 39);
  const idxVilleInstallation = findCol("ville installation", 40);

  const list: Rencontre[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const clubAccueil = (cols[idxClubAccueilNom >= 0 ? idxClubAccueilNom : 10] || '').trim();
    const clubVisiteur = (cols[idxClubVisiteurNom >= 0 ? idxClubVisiteurNom : 12] || '').trim();
    if (!clubAccueil && !clubVisiteur) continue;

    // Déduction du sexe d'homologation : Colonne C ('H' pour Homme, 'F' pour Femme)
    let rawSexe = (cols[idxSexe >= 0 ? idxSexe : 2] || '').trim().toUpperCase();
    let sexeHomologation: SexeHomologation = 'Messieurs';
    if (rawSexe === 'F' || rawSexe.startsWith('F') || rawSexe.includes('DAME') || rawSexe.includes('FEM')) {
      sexeHomologation = 'Dames';
    } else if (rawSexe.includes('MIX')) {
      sexeHomologation = 'Mixte';
    } else {
      sexeHomologation = 'Messieurs';
    }

    let telCap = (cols[idxPortableCapitaine >= 0 ? idxPortableCapitaine : 20] || '').trim();
    if (telCap.startsWith('33')) {
      telCap = '0' + telCap.slice(2).trim();
    }

    let telCapAdv = (cols[idxPortableCapitaineAdv >= 0 ? idxPortableCapitaineAdv : 25] || '').trim();
    if (telCapAdv.startsWith('33')) {
      telCapAdv = '0' + telCapAdv.slice(2).trim();
    }

    list.push({
      id: `rencontre-${i}`,
      niveauHomologation: cols[idxNiveau >= 0 ? idxNiveau : 0] || 'Départemental',
      libelleHomologation: cols[idxLibelle >= 0 ? idxLibelle : 1] || 'Championnat Interclubs',
      sexeHomologation,
      categorieAgeHomologation: cols[idxCatAge >= 0 ? idxCatAge : 3] || 'Seniors',
      division: cols[idxDivision >= 0 ? idxDivision : 4] || '',
      poule: cols[idxPoule >= 0 ? idxPoule : 5] || '',
      numeroEquipe: cols[idxEquipe >= 0 ? idxEquipe : 6] || 'Équipe 1',
      dateRencontre: cols[idxDate >= 0 ? idxDate : 7] || '',
      journee: cols[idxJournee >= 0 ? idxJournee : 8] || '',
      clubAccueilCode: cols[idxClubAccueilCode >= 0 ? idxClubAccueilCode : 9] || '',
      clubAccueilNom: clubAccueil,
      clubVisiteurCode: cols[idxClubVisiteurCode >= 0 ? idxClubVisiteurCode : 11] || '',
      clubVisiteurNom: clubVisiteur,
      vainqueur: cols[idxVainqueur >= 0 ? idxVainqueur : 13] || '',
      score: cols[idxScore >= 0 ? idxScore : 14] || 'À venir',
      jugeArbitreNom: cols[idxJugeArbitreNom >= 0 ? idxJugeArbitreNom : 15] || '',
      jugeArbitrePrenom: cols[idxJugeArbitrePrenom >= 0 ? idxJugeArbitrePrenom : 16] || '',
      nomCapitaine: cols[idxNomCapitaine >= 0 ? idxNomCapitaine : 17] || '',
      prenomCapitaine: cols[idxPrenomCapitaine >= 0 ? idxPrenomCapitaine : 18] || '',
      licenceCapitaine: cols[idxLicenceCapitaine >= 0 ? idxLicenceCapitaine : 19] || '',
      portableCapitaine: telCap,
      mailCapitaine: cols[idxMailCapitaine >= 0 ? idxMailCapitaine : 21] || '',
      nomCapitaineAdverse: cols[idxNomCapitaineAdv >= 0 ? idxNomCapitaineAdv : 22] || '',
      prenomCapitaineAdverse: cols[idxPrenomCapitaineAdv >= 0 ? idxPrenomCapitaineAdv : 23] || '',
      licenceCapitaineAdverse: cols[idxLicenceCapitaineAdv >= 0 ? idxLicenceCapitaineAdv : 24] || '',
      portableCapitaineAdverse: telCapAdv,
      mailCapitaineAdverse: cols[idxMailCapitaineAdv >= 0 ? idxMailCapitaineAdv : 26] || '',
      nomCorrespondant: cols[idxNomCorrespondant >= 0 ? idxNomCorrespondant : 27] || '',
      prenomCorrespondant: cols[idxPrenomCorrespondant >= 0 ? idxPrenomCorrespondant : 28] || '',
      licenceCorrespondant: cols[idxLicenceCorrespondant >= 0 ? idxLicenceCorrespondant : 29] || '',
      portableCorrespondant: cols[idxPortableCorrespondant >= 0 ? idxPortableCorrespondant : 30] || '',
      mailCorrespondant: cols[idxMailCorrespondant >= 0 ? idxMailCorrespondant : 31] || '',
      nomCorrespondantAdverse: cols[idxNomCorrespondantAdv >= 0 ? idxNomCorrespondantAdv : 32] || '',
      prenomCorrespondantAdverse: cols[idxPrenomCorrespondantAdv >= 0 ? idxPrenomCorrespondantAdv : 33] || '',
      licenceCorrespondantAdverse: cols[idxLicenceCorrespondantAdv >= 0 ? idxLicenceCorrespondantAdv : 34] || '',
      portableCorrespondantAdverse: cols[idxPortableCorrespondantAdv >= 0 ? idxPortableCorrespondantAdv : 35] || '',
      mailCorrespondantAdverse: cols[idxMailCorrespondantAdv >= 0 ? idxMailCorrespondantAdv : 36] || '',
      adresse1Installation: cols[idxAdresse1 >= 0 ? idxAdresse1 : 37] || '',
      adresse2Installation: cols[idxAdresse2 >= 0 ? idxAdresse2 : 38] || '',
      codePostalInstallation: cols[idxCpInstallation >= 0 ? idxCpInstallation : 39] || '',
      villeInstallation: cols[idxVilleInstallation >= 0 ? idxVilleInstallation : 40] || '',
    });
  }

  return list;
}

/**
 * Rencontres officielles du TCM calquées sur les 41 colonnes réelles du GSheet Données_appli
 */
export const INITIAL_RENCONTRES: Rencontre[] = realRencontresData as Rencontre[];
