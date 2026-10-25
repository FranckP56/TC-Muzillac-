/**
 * =========================================================================
 * MUZILLAC TENNIS CLUB (TCM) - GOOGLE APPS SCRIPT BACKEND
 * Fichier : Code.gs (Millésime FFT 2027)
 * Description : Script pour servir la Web App et extraire les données 
 *               des onglets 'Adhérents' et 'Rencontres' du Google Sheet,
 *               avec validation d'éligibilité FFT 2027 des capitaines.
 * =========================================================================
 */

const SHEET_ADHERENTS = 'Adhérents';
const SHEET_RENCONTRES = 'Rencontres';
const SHEET_COMPOSITIONS = 'Compositions_Equipes';

/**
 * Fonction doPost() pour enregistrer les compositions d'équipes avec données gelées
 */
function doPost(e) {
  let result = {};
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const action = payload.action || (e && e.parameter ? e.parameter.action : '');
    if (action === 'saveComposition') {
      result = saveFrozenComposition(payload);
    } else {
      result = { success: false, error: 'Action inconnue : ' + action };
    }
  } catch (err) {
    result = { success: false, error: err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Fonction doGet() obligatoire pour servir l'application et les endpoints JSON
 */
function doGet(e) {
  // Support appel API JSON si ?action=...
  if (e && e.parameter && e.parameter.action) {
    const action = e.parameter.action;
    let result = {};

    try {
      if (action === 'getAdherents' || action === 'adherents') {
        result = { success: true, data: getAdherents() };
      } else if (action === 'getRencontres' || action === 'rencontres') {
        result = { success: true, data: getRencontres() };
      } else if (action === 'getCompositions' || action === 'compositions') {
        result = { success: true, data: getSavedCompositions() };
      } else if (action === 'getAll' || action === 'all') {
        result = { 
          success: true, 
          adherents: getAdherents(),
          rencontres: getRencontres(),
          compositions: getSavedCompositions(),
          clubInfo: {
            nom: "Tennis Club de Muzillac (TCM)",
            adresse: "Complexe sportif du Chêne Rond, 56190 Muzillac",
            email: "tennisclubmuzillac@gmail.com"
          }
        };
      } else {
        result = { success: false, error: "Action inconnue : " + action };
      }
    } catch (err) {
      result = { success: false, error: err.toString() };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Rendu HTML
  const template = HtmlService.createTemplateFromFile('Index');
  template.initialData = {
    adherents: getAdherents(),
    rencontres: getRencontres()
  };

  return template.evaluate()
    .setTitle("Muzillac Tennis Club (TCM)")
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Récupère les adhérents sous forme d'objets JSON avec colonnes étendues (Civilité, Date Naiss., Type Licence)
 */
function getAdherents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_ADHERENTS);
  if (!sheet) throw new Error("Onglet '" + SHEET_ADHERENTS + "' introuvable");

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  // Détection automatique des indices selon les en-têtes
  const headers = values[0].map(h => String(h || '').trim().toLowerCase());
  const idxNom = getColIndex(headers, ['nom prénom', 'nom', 'adhérent'], 0);
  const idxCivilite = getColIndex(headers, ['civilité', 'civilite', 'sexe'], -1);
  const idxDateNaiss = getColIndex(headers, ['date naiss.', 'date naiss', 'date naissance', 'naissance'], -1);
  const idxTypeLicence = getColIndex(headers, ['type licence', 'statut licence', 'type de licence'], -1);
  const idxSolde = getColIndex(headers, ['solde dû', 'solde du', 'solde'], 1);
  const idxTel = getColIndex(headers, ['téléphone portable', 'telephone portable', 'portable', 'téléphone'], 2);
  const idxEmail = getColIndex(headers, ['email', 'mail', 'courriel'], 3);
  const idxClass = getColIndex(headers, ['dernier class. tennis', 'classement', 'class.'], 4);
  const idxLicence = getColIndex(headers, ['licence', 'n° licence'], 5);
  const idxAgeSportif = getColIndex(headers, ['age sportif', 'âge sportif', 'catégorie'], 6);
  const idxGroupe = getColIndex(headers, ['groupe enseignement', 'groupe'], 7);
  const idxTenUp = getColIndex(headers, ['compte ten\'up', 'tenup', 'ten\'up'], 8);

  const adherents = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const nomPrenom = String(row[idxNom] || '').trim();
    if (!nomPrenom) continue;

    let solde = 0;
    const rawSolde = idxSolde >= 0 ? row[idxSolde] : 0;
    if (typeof rawSolde === 'number') {
      solde = rawSolde;
    } else if (rawSolde) {
      const clean = String(rawSolde).replace('€', '').replace(',', '.').trim();
      solde = parseFloat(clean) || 0;
    }

    let tel = idxTel >= 0 ? String(row[idxTel] || '').trim() : '';
    if (tel && !tel.startsWith('+') && !tel.startsWith('0') && tel.length === 9) {
      tel = '0' + tel;
    }

    // Civilité
    let civilite = 'Monsieur';
    if (idxCivilite >= 0 && row[idxCivilite]) {
      const c = String(row[idxCivilite]).toLowerCase();
      if (c.includes('mme') || c.includes('madame') || c.includes('f') || c.includes('femme')) {
        civilite = 'Madame';
      }
    }

    // Date de naissance
    let dateNaissStr = '1990';
    if (idxDateNaiss >= 0 && row[idxDateNaiss]) {
      const dRaw = row[idxDateNaiss];
      if (dRaw instanceof Date) {
        const d = ("0" + dRaw.getDate()).slice(-2);
        const m = ("0" + (dRaw.getMonth() + 1)).slice(-2);
        dateNaissStr = d + "/" + m + "/" + dRaw.getFullYear();
      } else {
        dateNaissStr = String(dRaw).trim();
      }
    }

    // Type de Licence (C, W, D, S, etc.)
    let typeLicence = 'C';
    if (idxTypeLicence >= 0 && row[idxTypeLicence]) {
      typeLicence = String(row[idxTypeLicence]).trim().toUpperCase();
    }

    adherents.push({
      id: 'adh-' + i,
      nomPrenom: nomPrenom,
      civilite: civilite,
      dateNaissance: dateNaissStr,
      typeLicence: typeLicence,
      soldeDu: solde,
      telephonePortable: tel,
      email: idxEmail >= 0 ? String(row[idxEmail] || '').trim() : '',
      dernierClassTennis: idxClass >= 0 ? String(row[idxClass] || 'NC').trim().toUpperCase() : 'NC',
      licence: idxLicence >= 0 ? String(row[idxLicence] || '').trim() : '',
      ageSportif: idxAgeSportif >= 0 ? String(row[idxAgeSportif] || '').trim() : 'Senior',
      groupeEnseignement: idxGroupe >= 0 ? String(row[idxGroupe] || 'Loisir').trim() : 'Loisir',
      compteTenUp: idxTenUp >= 0 ? String(row[idxTenUp] || 'Actif').trim() : 'Actif'
    });
  }

  // Tri automatique FFT décroissant
  return sortAdherentsByRanking(adherents);
}

/**
 * Récupère les rencontres sous forme d'objets JSON avec les 41 colonnes officielles du GSheet
 */
function getRencontres() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_RENCONTRES);
  if (!sheet) throw new Error("Onglet '" + SHEET_RENCONTRES + "' introuvable");

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(h => String(h || '').trim().toLowerCase());
  const idxNiveau = getColIndex(headers, ["niveau de l'homologation", 'niveau'], -1);
  const idxLibelle = getColIndex(headers, ["libellé de l'homologation", 'libellé', 'homologation'], 1);
  const idxCatAge = getColIndex(headers, ["catégorie d'âge de l'homologation", "catégorie d'âge", 'catégorie'], 2);
  const idxSexe = getColIndex(headers, ["sexe de l'homologation", 'sexe', 'genre'], -1);
  const idxDivision = getColIndex(headers, ['division'], -1);
  const idxPoule = getColIndex(headers, ['poule'], -1);
  const idxEquipe = getColIndex(headers, ["numéro de l'équipe", 'équipe', 'numero equipe'], 3);
  const idxDate = getColIndex(headers, ['date de la rencontre', 'date'], 0);
  const idxJournee = getColIndex(headers, ['journée n°', 'journée', 'journee'], -1);
  const idxAccueilCode = getColIndex(headers, ["club d'accueil code", 'accueil code'], -1);
  const idxAccueilNom = getColIndex(headers, ["club d'accueil nom", 'club accueil', 'accueil'], 4);
  const idxVisiteurCode = getColIndex(headers, ['club visiteur code', 'visiteur code'], -1);
  const idxVisiteurNom = getColIndex(headers, ['club visiteur nom', 'club visiteur', 'visiteur'], 5);
  const idxVainqueur = getColIndex(headers, ['vainqueur'], -1);
  const idxScore = getColIndex(headers, ['score', 'résultat'], 6);
  const idxJANom = getColIndex(headers, ['juge-arbitre nom', 'juge arbitre'], -1);
  const idxJAPrenom = getColIndex(headers, ['juge-arbitre prénom'], -1);
  const idxCapNom = getColIndex(headers, ['nom capitaine', 'capitaine'], 7);
  const idxCapPrenom = getColIndex(headers, ['prénom capitaine'], -1);
  const idxCapLic = getColIndex(headers, ['licence capitaine'], -1);
  const idxCapTel = getColIndex(headers, ['portable capitaine', 'tel capitaine', 'téléphone capitaine'], 8);
  const idxCapMail = getColIndex(headers, ['mail capitaine', 'email capitaine'], 9);
  const idxCapAdvNom = getColIndex(headers, ['nom capitaine adverse'], -1);
  const idxCapAdvPrenom = getColIndex(headers, ['prénom capitaine adverse'], -1);
  const idxCapAdvTel = getColIndex(headers, ['portable capitaine adverse'], -1);
  const idxCapAdvMail = getColIndex(headers, ['mail capitaine adverse'], -1);
  const idxAdr1 = getColIndex(headers, ['adresse 1 installation', 'adresse 1'], -1);
  const idxCp = getColIndex(headers, ['code postal installation', 'cp installation'], -1);
  const idxVille = getColIndex(headers, ['ville installation'], -1);

  const rencontres = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const clubAccueil = idxAccueilNom >= 0 ? String(row[idxAccueilNom] || '').trim() : '';
    const clubVisiteur = idxVisiteurNom >= 0 ? String(row[idxVisiteurNom] || '').trim() : '';
    if (!clubAccueil && !clubVisiteur) continue;

    let dateStr = '';
    const dateRaw = idxDate >= 0 ? row[idxDate] : '';
    if (dateRaw instanceof Date) {
      const d = ("0" + dateRaw.getDate()).slice(-2);
      const m = ("0" + (dateRaw.getMonth() + 1)).slice(-2);
      dateStr = d + "/" + m + "/" + dateRaw.getFullYear();
    } else {
      dateStr = String(dateRaw || '').trim();
    }

    let telCapitaine = idxCapTel >= 0 ? String(row[idxCapTel] || '').trim() : '';
    if (telCapitaine && !telCapitaine.startsWith('+') && !telCapitaine.startsWith('0') && telCapitaine.length === 9) {
      telCapitaine = '0' + telCapitaine;
    }

    let telCapAdv = idxCapAdvTel >= 0 ? String(row[idxCapAdvTel] || '').trim() : '';
    if (telCapAdv && !telCapAdv.startsWith('+') && !telCapAdv.startsWith('0') && telCapAdv.length === 9) {
      telCapAdv = '0' + telCapAdv;
    }

    // Déduction du sexe de l'homologation
    let sexe = 'Messieurs';
    if (idxSexe >= 0 && row[idxSexe]) {
      const s = String(row[idxSexe]).toLowerCase();
      if (s.includes('dame') || s.includes('f')) sexe = 'Dames';
      else if (s.includes('mixte')) sexe = 'Mixte';
    } else {
      const combined = `${row[idxLibelle] || ''} ${row[idxCatAge] || ''}`.toLowerCase();
      if (combined.includes('dame') || combined.includes('femm')) sexe = 'Dames';
      else if (combined.includes('mixte')) sexe = 'Mixte';
    }

    rencontres.push({
      id: 'rencontre-' + i,
      niveauHomologation: idxNiveau >= 0 ? String(row[idxNiveau] || '').trim() : 'Départemental',
      dateRencontre: dateStr,
      libelleHomologation: idxLibelle >= 0 ? String(row[idxLibelle] || '').trim() : '',
      categorieAgeHomologation: idxCatAge >= 0 ? String(row[idxCatAge] || '').trim() : 'Seniors',
      sexeHomologation: sexe,
      division: idxDivision >= 0 ? String(row[idxDivision] || '').trim() : '',
      poule: idxPoule >= 0 ? String(row[idxPoule] || '').trim() : '',
      numeroEquipe: idxEquipe >= 0 ? String(row[idxEquipe] || '').trim() : 'Équipe 1',
      journee: idxJournee >= 0 ? String(row[idxJournee] || '').trim() : '',
      clubAccueilCode: idxAccueilCode >= 0 ? String(row[idxAccueilCode] || '').trim() : '',
      clubAccueilNom: clubAccueil,
      clubVisiteurCode: idxVisiteurCode >= 0 ? String(row[idxVisiteurCode] || '').trim() : '',
      clubVisiteurNom: clubVisiteur,
      vainqueur: idxVainqueur >= 0 ? String(row[idxVainqueur] || '').trim() : '',
      score: idxScore >= 0 ? String(row[idxScore] || '').trim() : 'À venir',
      jugeArbitreNom: idxJANom >= 0 ? String(row[idxJANom] || '').trim() : '',
      jugeArbitrePrenom: idxJAPrenom >= 0 ? String(row[idxJAPrenom] || '').trim() : '',
      nomCapitaine: idxCapNom >= 0 ? String(row[idxCapNom] || '').trim() : '',
      prenomCapitaine: idxCapPrenom >= 0 ? String(row[idxCapPrenom] || '').trim() : '',
      licenceCapitaine: idxCapLic >= 0 ? String(row[idxCapLic] || '').trim() : '',
      portableCapitaine: telCapitaine,
      mailCapitaine: idxCapMail >= 0 ? String(row[idxCapMail] || '').trim() : '',
      nomCapitaineAdverse: idxCapAdvNom >= 0 ? String(row[idxCapAdvNom] || '').trim() : '',
      prenomCapitaineAdverse: idxCapAdvPrenom >= 0 ? String(row[idxCapAdvPrenom] || '').trim() : '',
      portableCapitaineAdverse: telCapAdv,
      mailCapitaineAdverse: idxCapAdvMail >= 0 ? String(row[idxCapAdvMail] || '').trim() : '',
      adresse1Installation: idxAdr1 >= 0 ? String(row[idxAdr1] || '').trim() : '',
      codePostalInstallation: idxCp >= 0 ? String(row[idxCp] || '').trim() : '',
      villeInstallation: idxVille >= 0 ? String(row[idxVille] || '').trim() : ''
    });
  }

  return rencontres;
}

function getColIndex(headers, matchKeywords, defaultIndex) {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    for (let k = 0; k < matchKeywords.length; k++) {
      if (h.includes(matchKeywords[k])) return i;
    }
  }
  return defaultIndex;
}

function getRankingWeight(rank) {
  if (!rank) return 0;
  const clean = rank.trim().toUpperCase().replace(/\\s+/g, '');
  if (clean.startsWith('N') && clean !== 'NC') {
    const num = parseInt(clean.replace('N', ''), 10) || 100;
    return 1000 - num;
  }
  const weights = {
    '-30': 450, '-15': 430, '-4/6': 410, '-2/6': 390, '0': 370,
    '1/6': 350, '2/6': 330, '3/6': 310, '4/6': 290, '5/6': 270, '15': 250,
    '15/1': 230, '15/2': 210, '15/3': 190, '15/4': 170, '15/5': 150, '30': 130,
    '30/1': 110, '30/2': 90, '30/3': 70, '30/4': 50, '30/5': 30, '40': 15, 'NC': 0
  };
  return weights[clean] !== undefined ? weights[clean] : 0;
}

function sortAdherentsByRanking(list) {
  return list.sort(function(a, b) {
    const weightA = getRankingWeight(a.dernierClassTennis);
    const weightB = getRankingWeight(b.dernierClassTennis);
    if (weightB !== weightA) return weightB - weightA;
    return a.nomPrenom.localeCompare(b.nomPrenom, 'fr');
  });
}

/**
 * Récupère les compositions enregistrées avec données gelées depuis l'onglet Compositions_Equipes
 */
function getSavedCompositions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_COMPOSITIONS);
  if (!sheet) return {};

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return {};

  const result = {};
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const matchId = String(row[0] || '').trim();
    if (!matchId) continue;

    if (!result[matchId]) {
      result[matchId] = {
        matchId: matchId,
        dateRencontre: String(row[1] || ''),
        numeroEquipe: String(row[2] || ''),
        dateValidation: String(row[15] || ''),
        valideParCapitaine: String(row[16] || '').toLowerCase() === 'oui',
        frozenPlayers: []
      };
    }

    result[matchId].frozenPlayers.push({
      poste: String(row[8] || ''),
      nomPrenom: String(row[9] || ''),
      licence: String(row[10] || ''),
      classementGele: String(row[11] || 'NC'),
      dateNaissance: String(row[12] || ''),
      ageSportif: String(row[13] || ''),
      typeLicence: String(row[14] || '')
    });
  }

  return result;
}

/**
 * Enregistre ou met à jour une composition d'équipe avec données gelées dans Compositions_Equipes
 */
function saveFrozenComposition(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_COMPOSITIONS);
  
  // Créer l'onglet si inexistant
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_COMPOSITIONS);
    sheet.setTabColor('#E65100');
    sheet.appendRow([
      "ID Rencontre", "Date Rencontre", "Numéro Équipe", "Homologation", "Catégorie", "Sexe",
      "Club Accueil", "Club Visiteur", "Poste", "Nom Prénom Joueur", "N° Licence",
      "Classement Gelé au Match", "Date Naissance", "Âge Sportif", "Type Licence",
      "Date Enregistrement", "Validé par Capitaine"
    ]);
    sheet.setFrozenRows(1);
  }

  const match = payload.rencontre || {};
  const composition = payload.composition || {};
  const players = payload.frozenPlayers || [];

  if (!match.id || players.length === 0) {
    return { success: false, error: "Données de rencontre ou joueurs manquants." };
  }

  const existingValues = sheet.getDataRange().getValues();
  const keptRows = [];
  const header = existingValues[0];
  keptRows.push(header);

  for (let i = 1; i < existingValues.length; i++) {
    if (String(existingValues[i][0]).trim() !== String(match.id).trim()) {
      keptRows.push(existingValues[i]);
    }
  }

  const now = Utilities.formatDate(new Date(), "GMT+1", "dd/MM/yyyy");

  for (let p = 0; p < players.length; p++) {
    const pl = players[p];
    keptRows.push([
      match.id,
      match.dateRencontre || '',
      match.numeroEquipe || '',
      match.libelleHomologation || '',
      match.categorieAgeHomologation || '',
      match.sexeHomologation || '',
      match.clubAccueilNom || '',
      match.clubVisiteurNom || '',
      pl.poste || '',
      pl.nomPrenom || '',
      pl.licence || '',
      pl.classementGele || pl.dernierClassTennis || 'NC', // GEL DU CLASSEMENT
      pl.dateNaissance || '',
      pl.ageSportif || '',
      pl.typeLicence || '',
      composition.dateValidation || now,
      composition.valideParCapitaine ? 'OUI' : 'NON'
    ]);
  }

  sheet.clearContents();
  sheet.getRange(1, 1, keptRows.length, keptRows[0].length).setValues(keptRows);

  return { success: true, rowsSaved: players.length };
}
