/**
 * =========================================================================
 * MUZILLAC TENNIS CLUB (TCM) - GOOGLE APPS SCRIPT BACKEND
 * Fichier : Code.gs (Millésime FFT 2027)
 * Description : Script pour servir la Web App et synchroniser les données
 *               des onglets du Google Sheet ('Adhérents', 'Rencontres',
 *               'Compositions_Equipes', 'Bureau_Profs', 'Installations',
 *               'Cotisations_Tarifs', 'Club_Info', 'Troc_Annonces').
 * =========================================================================
 */

const SHEET_ADHERENTS = 'Adhérents';
const SHEET_RENCONTRES = 'Rencontres';
const SHEET_COMPOSITIONS = 'Compositions_Equipes';
const SHEET_BUREAU = 'Bureau_Profs';
const SHEET_INSTALLATIONS = 'Installations';
const SHEET_TARIFS = 'Cotisations_Tarifs';
const SHEET_CLUB_INFO = 'Club_Info';
const SHEET_TROC = 'Troc_Annonces';
const SHEET_GOSPORT = 'Partenaire_GOSport';

/**
 * Normalisation des numéros de téléphone au format officiel français (10 chiffres, 0 initial)
 */
function formatPhoneNumber(raw) {
  if (!raw) return '';
  let s = String(raw).replace(/\D/g, '');
  if (s.startsWith('33') && s.length === 11) {
    s = '0' + s.slice(2);
  }
  if (s.length === 9) {
    s = '0' + s;
  }
  if (s.length === 10) {
    return s.replace(/(\d{2})(?=\d)/g, '$1 ');
  }
  return String(raw).trim();
}

/**
 * Fonction doPost() pour enregistrer :
 * 1. Les compositions d'équipes avec données gelées ('saveComposition')
 * 2. Les informations du club dans l'onglet Club_Info ('saveClubInfo')
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
    } else if (action === 'saveClubInfo') {
      result = saveClubInfo(payload);
    } else if (action === 'saveTrocAnnonce') {
      result = saveTrocAnnonce(payload);
    } else if (action === 'updateTrocStatut' || action === 'deleteTrocAnnonce') {
      result = updateTrocStatut(payload);
    } else if (action === 'saveGoSportOffre') {
      result = saveGoSportOffre(payload);
    } else if (action === 'deleteGoSportOffre') {
      result = deleteGoSportOffre(payload);
    } else if (action === 'requestAdherentOtp') {
      result = requestAdherentOtp(payload);
    } else if (action === 'verifyAdherentOtp') {
      result = verifyAdherentOtp(payload);
    } else if (action === 'updateMinorParent') {
      result = updateMinorParent(payload);
    } else if (action === 'logoutAdherentSession') {
      result = logoutAdherentSession(payload);
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
      } else if (action === 'getClubInfo' || action === 'clubInfo') {
        result = { success: true, data: getClubInfo() };
      } else if (action === 'getTroc' || action === 'troc') {
        result = { success: true, data: getTrocAnnonces() };
      } else if (action === 'getGoSport' || action === 'gosport') {
        result = { success: true, data: getGoSportOffres() };
      } else if (action === 'getAll' || action === 'all') {
        result = { 
          success: true, 
          adherents: getAdherents(),
          rencontres: getRencontres(),
          compositions: getSavedCompositions(),
          clubInfo: getClubInfo(),
          bureau: getBureauData(),
          installations: getInstallationsData(),
          tarifs: getTarifsData(),
          troc: getTrocAnnonces(),
          gosport: getGoSportOffres()
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
 * Récupère les données de l'onglet Club_Info si disponible, avec repli sur les coordonnées officielles réelles
 */
function getClubInfo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_CLUB_INFO);

  const defaultInfo = {
    nom: "Muzillac Tennis Club",
    sigle: "TCM",
    ligue: "Ligue de Bretagne de Tennis",
    comite: "Comité Départemental du Morbihan (56)",
    codeClub: "52 56 0212",
    adresse: "Complexe du Clos des Moines, 56190 Muzillac",
    codePostal: "56190",
    ville: "Muzillac",
    telephone: "06 62 43 24 64",
    email: "tennisclubmuzillac@gmail.com",
    siteWeb: "https://www.tennisclubmuzillac.fr",
    horairesPermanence: "Mercredi après-midi & Samedi matin",
    permanencePedagogiqueLibelle: "Permanences pédagogiques",
    permanencePedagogiqueVisible: true,
    badgeAccesMessage: "Accès sécurisé par badge",
    ouvertureCourtsMessage: "Courts ouverts 7j/7",
    badgeAccesVisible: true,
    modalitesPaiement: "Paiement échelonné possible par chèque et par CB via HelloAsso. Chèques vacances ANCV et Pass'Sport acceptés.",
    helloAssoUrl: "https://www.helloasso.com/associations/tennis-club-muzillac"
  };

  if (!sheet) return defaultInfo;

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return defaultInfo;

  const info = { ...defaultInfo };
  for (let i = 1; i < values.length; i++) {
    const key = String(values[i][0] || '').trim().toLowerCase();
    const val = String(values[i][1] || '').trim();
    if (!key) continue;

    if (key.includes('adress')) info.adresse = val;
    else if (key.includes('nom')) info.nom = val;
    else if (key === 'telephone' || key === 'téléphone' || key === 'tel') info.telephone = formatPhoneNumber(val);
    else if (key.includes('email') || key.includes('mail')) info.email = val;
    else if (key.includes('site') || key.includes('web')) info.siteWeb = val;
    else if (key.includes('code postal') || key === 'cp') info.codePostal = val;
    else if (key.includes('ville')) info.ville = val;
    else if (key.includes('sigle')) info.sigle = val;
    else if (key.includes('ligue')) info.ligue = val;
    else if (key.includes('comite') || key.includes('comité')) info.comite = val;
    else if (key.includes('code club')) info.codeClub = val;
    else if (key.includes('libellé permanence') || key.includes('titre permanence')) info.permanencePedagogiqueLibelle = val;
    else if (key.includes('permanence visible') || key.includes('afficher permanence')) info.permanencePedagogiqueVisible = !val.toLowerCase().includes('non') && !val.toLowerCase().includes('faux') && val !== 'false';
    else if (key.includes('permanence')) info.horairesPermanence = val;
    else if (key.includes('badge') && (key.includes('message') || key.includes('texte') || key.includes('accès') || key.includes('acces'))) info.badgeAccesMessage = val;
    else if (key.includes('badge visible') || key.includes('afficher badge')) info.badgeAccesVisible = !val.toLowerCase().includes('non') && !val.toLowerCase().includes('faux') && val !== 'false';
    else if (key.includes('ouverture') || key.includes('7/7') || key.includes('7j/7') || key.includes('court ouvert')) info.ouvertureCourtsMessage = val;
    else if (key.includes('modalite') || key.includes('paiement')) info.modalitesPaiement = val;
    else if (key.includes('helloasso')) info.helloAssoUrl = val;
    else if (key.includes('president') && (key.includes('tel') || key.includes('portable'))) info.presidentTelephone = formatPhoneNumber(val);
    else if (key.includes('president') && key.includes('mail')) info.presidentEmail = val;
    else if (key.includes('president') || key.includes('président')) info.president = val;
    else if (key.includes('secretaire') && (key.includes('tel') || key.includes('portable'))) info.secretaireTelephone = formatPhoneNumber(val);
    else if (key.includes('secretaire') && key.includes('mail')) info.secretaireEmail = val;
    else if (key.includes('secretaire') || key.includes('secrétaire')) info.secretaire = val;
    else if (key.includes('tresorier') && (key.includes('tel') || key.includes('portable'))) info.tresorierTelephone = formatPhoneNumber(val);
    else if (key.includes('tresorier') && key.includes('mail')) info.tresorierEmail = val;
    else if (key.includes('tresorier') || key.includes('trésorier')) info.tresorier = val;
    else if (key.includes('logo')) info.logoUrl = val;
    else if (key.includes('signature')) info.signatureUrl = val;
    else if (key.includes('tampon') || key.includes('cachet')) info.tamponUrl = val;
    else if (key.includes('siret')) info.siret = val;
    else if (key.includes('rna')) info.rna = val;
    else if (key.includes('signataire') && key.includes('fonction')) info.signataireFonction = val;
    else if (key.includes('signataire')) info.signataireNom = val;
    else if (key.includes('rib') || key.includes('iban')) info.ribIban = val;
  }

  return info;
}

/**
 * Sécurisation de la taille des cellules pour éviter l'erreur Google Sheets (limite de 50 000 caractères par cellule)
 */
function safeCellValue(val) {
  if (val === null || val === undefined) return '';
  var s = String(val);
  return s.length > 48000 ? s.substring(0, 48000) : s;
}

/**
 * Enregistre ou met à jour les informations du club dans l'onglet Club_Info (créé automatiquement si absent)
 */
function saveClubInfo(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_CLUB_INFO);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_CLUB_INFO);
    sheet.setTabColor('#0284C7');
  }

  const info = payload.clubInfo || payload;

  const rows = [
    ["Paramètre", "Valeur"],
    ["Nom du Club", info.nom || "Muzillac Tennis Club"],
    ["Sigle", info.sigle || "TCM"],
    ["Ligue", info.ligue || "Ligue de Bretagne de Tennis"],
    ["Comité", info.comite || "Comité Départemental du Morbihan (56)"],
    ["Code Club", info.codeClub || "52 56 0212"],
    ["Adresse", info.adresse || "Complexe du Clos des Moines, 56190 Muzillac"],
    ["Code Postal", info.codePostal || "56190"],
    ["Ville", info.ville || "Muzillac"],
    ["Téléphone", formatPhoneNumber(info.telephone)],
    ["Email", info.email || "tennisclubmuzillac@gmail.com"],
    ["Site Web", info.siteWeb || "https://www.tennisclubmuzillac.fr"],
    ["Horaires Permanence", info.horairesPermanence || ""],
    ["Libellé Permanences Pédagogiques", info.permanencePedagogiqueLibelle || "Permanences pédagogiques"],
    ["Afficher Permanences Pédagogiques", info.permanencePedagogiqueVisible !== false ? "OUI" : "NON"],
    ["Message Accès Badge", info.badgeAccesMessage || "Accès sécurisé par badge"],
    ["Message Ouverture Courts", info.ouvertureCourtsMessage || "Courts ouverts 7j/7"],
    ["Afficher Accès Badge", info.badgeAccesVisible !== false ? "OUI" : "NON"],
    ["Modalités Paiement", info.modalitesPaiement || ""],
    ["Président", info.president || ""],
    ["Téléphone Président", formatPhoneNumber(info.presidentTelephone)],
    ["Email Président", info.presidentEmail || ""],
    ["Secrétaire", info.secretaire || ""],
    ["Téléphone Secrétaire", formatPhoneNumber(info.secretaireTelephone)],
    ["Email Secrétaire", info.secretaireEmail || ""],
    ["Trésorier", info.tresorier || ""],
    ["Téléphone Trésorier", formatPhoneNumber(info.tresorierTelephone)],
    ["Email Trésorier", info.tresorierEmail || ""],
    ["Logo URL", info.logoUrl || ""],
    ["Signature URL", info.signatureUrl || ""],
    ["Tampon Cachet URL", info.tamponUrl || ""],
    ["SIRET", info.siret || ""],
    ["Numéro RNA", info.rna || ""],
    ["Nom Signataire", info.signataireNom || info.president || ""],
    ["Fonction Signataire", info.signataireFonction || "Président"],
    ["IBAN / RIB", info.ribIban || ""]
  ];

  const sanitizedRows = rows.map(function(r) {
    return [r[0], safeCellValue(r[1])];
  });

  sheet.clearContents();
  sheet.getRange(1, 1, sanitizedRows.length, 2).setValues(sanitizedRows);

  // Sauvegarder également les tarifs dans l'onglet Cotisations_Tarifs s'ils sont fournis
  if (info.tarifs && Array.isArray(info.tarifs) && info.tarifs.length > 0) {
    let tarifsSheet = ss.getSheetByName(SHEET_TARIFS);
    if (!tarifsSheet) {
      tarifsSheet = ss.insertSheet(SHEET_TARIFS);
      tarifsSheet.setTabColor('#10B981');
    }
    const tRows = [["Catégorie", "Formule / Libellé", "Montant (€)", "Description / Précisions"]];
    info.tarifs.forEach(function(t) {
      tRows.push([t.categorie || "adulte", t.label || "", t.montant || 0, t.description || ""]);
    });
    tarifsSheet.clearContents();
    tarifsSheet.getRange(1, 1, tRows.length, 4).setValues(tRows);
  }

  return { success: true, rowsSaved: rows.length };
}

/**
 * Récupère les données brutes des onglets optionnels s'ils existent
 */
function getBureauData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_BUREAU);
  return sheet ? sheet.getDataRange().getValues() : [];
}

function getInstallationsData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_INSTALLATIONS);
  return sheet ? sheet.getDataRange().getValues() : [];
}

function getTarifsData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_TARIFS);
  return sheet ? sheet.getDataRange().getValues() : [];
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

  const headers = values[0].map(h => String(h || '').trim().toLowerCase());
  const idxNom = getColIndex(headers, ['nom prénom', 'nom', 'adhérent'], 0);
  const idxCivilite = getColIndex(headers, ['civilité', 'civilite', 'sexe'], -1);
  const idxDateNaiss = getColIndex(headers, ['date naiss.', 'date naiss', 'date naissance', 'naissance'], -1);
  const idxTypeLicence = getColIndex(headers, ['type licence', 'statut licence', 'type de licence'], -1);
  const idxSolde = getColIndex(headers, ['solde dû', 'solde du', 'solde'], 1);
  const idxTel = getColIndex(headers, ['téléphone portable', 'telephone portable', 'portable', 'téléphone'], 2);
  const idxEmail = getColIndex(headers, ['email', 'mail', 'courriel'], 3);
  const idxClass = getColIndex(headers, ['dernier class. tennis', 'classement', 'class.'], 4);
  const idxMeilleurClass = getColIndex(headers, ['meilleur class. tennis', 'meilleur class', 'meilleur'], -1);
  const idxLicence = getColIndex(headers, ['licence', 'n° licence'], 5);
  const idxAgeSportif = getColIndex(headers, ['age sportif', 'âge sportif', 'catégorie'], 6);
  const idxGroupe = getColIndex(headers, ['groupe enseignement', 'groupe'], 7);
  const idxTenUp = getColIndex(headers, ['compte ten\'up', 'tenup', 'ten\'up'], 8);
  const idxClub = getColIndex(headers, ['nom du club', 'club de rattachement', 'club'], -1);

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

    const tel = idxTel >= 0 ? formatPhoneNumber(row[idxTel]) : '';

    let civilite = 'Monsieur';
    if (idxCivilite >= 0 && row[idxCivilite]) {
      const c = String(row[idxCivilite]).toLowerCase();
      if (c.includes('mme') || c.includes('madame') || c.includes('f') || c.includes('femme')) {
        civilite = 'Madame';
      }
    }

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

    let rawGroupe = idxGroupe >= 0 ? String(row[idxGroupe] || 'Loisir').trim() : 'Loisir';
    let typeLicence = 'C';
    if (idxTypeLicence >= 0 && row[idxTypeLicence]) {
      typeLicence = String(row[idxTypeLicence]).trim().toUpperCase();
    } else {
      const rawLic = idxLicence >= 0 ? String(row[idxLicence] || '').trim() : '';
      if (!rawLic) {
        typeLicence = rawGroupe.toLowerCase().includes('parent') ? "Sans licence (Parent d'élève)" : 'Sans licence';
      }
    }

    const dernierClass = idxClass >= 0 ? cleanRankingGas(row[idxClass]) : 'NC';
    let meilleurClass = idxMeilleurClass >= 0 ? cleanRankingGas(row[idxMeilleurClass]) : dernierClass;
    if (!meilleurClass || meilleurClass.indexOf('T') >= 0 || (meilleurClass.indexOf('-') >= 0 && meilleurClass.length > 5)) {
      meilleurClass = dernierClass;
    }

    const club = idxClub >= 0 && row[idxClub] ? String(row[idxClub]).trim() : 'MUZILLAC TENNIS CLUB';

    adherents.push({
      id: 'adh-' + i,
      nomPrenom: nomPrenom,
      civilite: civilite,
      dateNaissance: dateNaissStr,
      typeLicence: typeLicence,
      soldeDu: solde,
      telephonePortable: tel,
      email: idxEmail >= 0 ? String(row[idxEmail] || '').trim() : '',
      dernierClassTennis: dernierClass,
      meilleurClassTennis: meilleurClass,
      licence: idxLicence >= 0 ? String(row[idxLicence] || '').trim() : '',
      ageSportif: idxAgeSportif >= 0 ? String(row[idxAgeSportif] || '').trim() : 'Senior',
      groupeEnseignement: rawGroupe,
      compteTenUp: idxTenUp >= 0 ? String(row[idxTenUp] || 'Actif').trim() : 'Actif',
      clubRattachement: club
    });
  }

  return sortAdherentsByRanking(adherents);
}

/**
 * Récupère les rencontres sous forme d'objets JSON avec les colonnes officielles du GSheet
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

    const telCapitaine = idxCapTel >= 0 ? formatPhoneNumber(row[idxCapTel]) : '';
    const telCapAdv = idxCapAdvTel >= 0 ? formatPhoneNumber(row[idxCapAdvTel]) : '';

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

function cleanRankingGas(val) {
  if (!val) return 'NC';
  if (val instanceof Date) {
    var day = val.getDate();
    var month = val.getMonth() + 1;
    if (day === 15 && month >= 1 && month <= 5) return '15/' + month;
    if (day >= 28 && month >= 1 && month <= 5) return '30/' + month;
    if (month === 6 && day >= 1 && day <= 5) return day + '/6';
    if (day === 6 && month >= 1 && month <= 5) return month + '/6';
    return 'NC';
  }
  var s = String(val).trim().toUpperCase();
  if (s.indexOf('T') >= 0 && s.indexOf('Z') >= 0) {
    var d = new Date(s);
    if (!isNaN(d.getTime())) {
      var localD = new Date(d.getTime() + 4 * 3600 * 1000);
      var day = localD.getUTCDate();
      var month = localD.getUTCMonth() + 1;
      if (day === 15 && month >= 1 && month <= 5) return '15/' + month;
      if (day >= 28 && month >= 1 && month <= 5) return '30/' + month;
      if (month === 6 && day >= 1 && day <= 5) return day + '/6';
      if (day === 6 && month >= 1 && month <= 5) return month + '/6';
    }
  }
  return s;
}

function getRankingWeight(rank) {
  if (!rank) return 0;
  const clean = rank.trim().toUpperCase().replace(/\s+/g, '');
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
      var hDeb = '14:00';
      var lieu = 'Clos des Moines (Muzillac)';
      var nCourts = 2;
      var dateVal = '';
      var valCap = false;

      if (row.length > 17 || (row[15] && String(row[15]).indexOf(':') >= 0)) {
        hDeb = String(row[15] || '14:00').trim();
        lieu = String(row[16] || 'Clos des Moines (Muzillac)').trim();
        nCourts = parseInt(row[17], 10) || 2;
        dateVal = String(row[18] || row[15] || '').trim();
        valCap = String(row[19] || row[16] || '').toLowerCase() === 'oui' || String(row[19] || row[16] || '').toLowerCase() === 'true';
      } else {
        dateVal = String(row[15] || '').trim();
        valCap = String(row[16] || '').toLowerCase() === 'oui' || String(row[16] || '').toLowerCase() === 'true';
      }

      let ordreMatchs = [];
      let heuresRotations = {};
      try {
        if (row[20]) ordreMatchs = JSON.parse(String(row[20]));
      } catch (e) {}
      try {
        if (row[21]) heuresRotations = JSON.parse(String(row[21]));
      } catch (e) {}

      result[matchId] = {
        matchId: matchId,
        dateRencontre: String(row[1] || ''),
        numeroEquipe: String(row[2] || ''),
        heureDebut: hDeb,
        lieuRencontre: lieu,
        nombreCourts: nCourts,
        dateValidation: dateVal,
        valideParCapitaine: valCap,
        ordreMatchs: Array.isArray(ordreMatchs) ? ordreMatchs : [],
        heuresRotations: (heuresRotations && typeof heuresRotations === 'object') ? heuresRotations : {},
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
  const expectedHeaders = [
    "ID Rencontre", "Date Rencontre", "Numéro Équipe", "Homologation", "Catégorie", "Sexe",
    "Club Accueil", "Club Visiteur", "Poste", "Nom Prénom Joueur", "N° Licence",
    "Classement Gelé au Match", "Date Naissance", "Âge Sportif", "Type Licence",
    "Heure Début", "Lieu Rencontre", "Nombre Courts", "Date Enregistrement", "Validé par Capitaine",
    "Ordre des Matchs", "Heures Rotations"
  ];
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_COMPOSITIONS);
    sheet.setTabColor('#E65100');
    sheet.appendRow(expectedHeaders);
    sheet.setFrozenRows(1);
  }

  const matchId = payload.rencontreId || (payload.rencontre && payload.rencontre.id) || payload.id || '';
  const dateRencontre = payload.dateRencontre || (payload.rencontre && payload.rencontre.dateRencontre) || '';
  const numeroEquipe = payload.numeroEquipe || (payload.rencontre && payload.rencontre.numeroEquipe) || '';
  const libelleHomologation = payload.libelleHomologation || (payload.rencontre && payload.rencontre.libelleHomologation) || '';
  const categorieAgeHomologation = payload.categorieAgeHomologation || (payload.rencontre && payload.rencontre.categorieAgeHomologation) || '';
  const sexeHomologation = payload.sexeHomologation || (payload.rencontre && payload.rencontre.sexeHomologation) || '';
  const clubAccueilNom = payload.clubAccueilNom || (payload.rencontre && payload.rencontre.clubAccueilNom) || '';
  const clubVisiteurNom = payload.clubVisiteurNom || (payload.rencontre && payload.rencontre.clubVisiteurNom) || '';
  const heureDebut = payload.heureDebut || (payload.composition && payload.composition.heureDebut) || '14:00';
  const lieuRencontre = payload.lieuRencontre || (payload.composition && payload.composition.lieuRencontre) || 'Clos des Moines (Muzillac)';
  const nombreCourts = payload.nombreCourts || (payload.composition && payload.composition.nombreCourts) || 2;
  const dateValidation = payload.dateValidation || (payload.composition && payload.composition.dateValidation) || Utilities.formatDate(new Date(), "GMT+1", "dd/MM/yyyy");
  const isValide = payload.valideParCapitaine !== undefined ? payload.valideParCapitaine : (payload.composition && payload.composition.valideParCapitaine);
  const valideParCapitaine = isValide ? 'OUI' : 'NON';
  const ordreJson = JSON.stringify(payload.ordreMatchs || (payload.composition && payload.composition.ordreMatchs) || []);
  const rotationsJson = JSON.stringify(payload.heuresRotations || (payload.composition && payload.composition.heuresRotations) || {});

  const players = payload.slots || payload.frozenPlayers || [];

  if (!matchId) {
    return { success: false, error: "Identifiant de rencontre manquant." };
  }

  const existingValues = sheet.getDataRange().getValues();
  const keptRows = [];
  let header = existingValues.length > 0 ? existingValues[0].slice() : expectedHeaders.slice();
  while (header.length > 0 && String(header[header.length - 1] || '').trim() === '') {
    header.pop();
  }
  while (header.length < expectedHeaders.length) {
    header.push(expectedHeaders[header.length]);
  }
  header[20] = expectedHeaders[20];
  header[21] = expectedHeaders[21];
  keptRows.push(header);

  for (let i = 1; i < existingValues.length; i++) {
    if (String(existingValues[i][0]).trim() !== String(matchId).trim()) {
      const r = existingValues[i].slice(0, header.length);
      while (r.length < header.length) r.push('');
      keptRows.push(r);
    }
  }

  function padRow(rowArr) {
    while (rowArr.length < header.length) rowArr.push('');
    return rowArr.slice(0, header.length);
  }

  if (players.length === 0) {
    keptRows.push(padRow([
      matchId, dateRencontre, numeroEquipe, libelleHomologation, categorieAgeHomologation,
      sexeHomologation, clubAccueilNom, clubVisiteurNom, 'Logistique & Ordre', '', '', '', '', '', '',
      heureDebut, lieuRencontre, nombreCourts, dateValidation, valideParCapitaine, ordreJson, rotationsJson
    ]));
  } else {
    for (let p = 0; p < players.length; p++) {
      const pl = players[p];
      keptRows.push(padRow([
        matchId,
        dateRencontre,
        numeroEquipe,
        libelleHomologation,
        categorieAgeHomologation,
        sexeHomologation,
        clubAccueilNom,
        clubVisiteurNom,
        pl.poste || '',
        pl.nomPrenom || '',
        pl.licence || '',
        pl.classementGele || pl.dernierClassTennis || 'NC',
        pl.dateNaissance || '',
        pl.ageSportif || '',
        pl.typeLicence || '',
        heureDebut,
        lieuRencontre,
        nombreCourts,
        dateValidation,
        valideParCapitaine,
        ordreJson,
        rotationsJson
      ]));
    }
  }

  sheet.clearContents();
  sheet.getRange(1, 1, keptRows.length, header.length).setValues(keptRows);

  return { success: true, rowsSaved: players.length || 1 };
}

/**
 * =========================================================================
 * MODULE TROC & OCCASIONS (Onglet 'Troc_Annonces')
 * =========================================================================
 */

function ensureTrocSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_TROC);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_TROC);
    sheet.setTabColor('#E65100');
    sheet.appendRow([
      "ID",
      "Date Publication",
      "Titre",
      "Catégorie",
      "Taille / Pointure",
      "État",
      "Photo",
      "Prix (€)",
      "Contact Nom",
      "Téléphone",
      "Email",
      "Statut"
    ]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getTrocAnnonces() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_TROC);
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const list = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const id = String(row[0] || ('troc-' + i)).trim();
    const titre = String(row[2] || '').trim();
    if (!titre) continue;

    let dateStr = '';
    if (row[1] instanceof Date) {
      const d = ("0" + row[1].getDate()).slice(-2);
      const m = ("0" + (row[1].getMonth() + 1)).slice(-2);
      dateStr = d + "/" + m + "/" + row[1].getFullYear();
    } else {
      dateStr = String(row[1] || '').trim();
    }

    const rawPrix = String(row[7] || '0').replace('€', '').replace(',', '.').trim();
    const prix = parseFloat(rawPrix) || 0;
    const statut = String(row[11] || 'Disponible').trim();
    if (statut.toLowerCase() === 'supprimé' || statut.toLowerCase() === 'supprime') continue;

    list.push({
      id: id,
      datePublication: dateStr,
      titre: titre,
      categorie: String(row[3] || 'Raquettes').trim(),
      taillePointure: String(row[4] || '').trim(),
      etat: String(row[5] || 'Bon état').trim(),
      photoUrl: String(row[6] || '').trim(),
      prix: prix,
      contactNom: String(row[8] || '').trim(),
      contactTel: formatPhoneNumber(row[9] || ''),
      contactEmail: String(row[10] || '').trim(),
      statut: statut
    });
  }

  // Les plus récentes en premier
  return list.reverse();
}

function saveTrocAnnonce(payload) {
  const sheet = ensureTrocSheet();
  const a = payload.annonce || payload || {};

  if (!a.titre || !String(a.titre).trim()) {
    return { success: false, error: "Le titre de l'annonce est obligatoire." };
  }

  const nowDate = Utilities.formatDate(new Date(), "GMT+1", "dd/MM/yyyy");
  const id = a.id || ('troc-' + Date.now());
  const rawPrix = String(a.prix !== undefined ? a.prix : '0').replace('€', '').replace(',', '.').trim();
  const prixNum = parseFloat(rawPrix) || 0;

  sheet.appendRow([
    safeCellValue(id),
    safeCellValue(a.datePublication || nowDate),
    safeCellValue(String(a.titre).trim()),
    safeCellValue(String(a.categorie || 'Raquettes').trim()),
    safeCellValue(String(a.taillePointure || '').trim()),
    safeCellValue(String(a.etat || 'Bon état').trim()),
    safeCellValue(a.photoUrl || ''),
    prixNum,
    safeCellValue(String(a.contactNom || '').trim()),
    safeCellValue(formatPhoneNumber(a.contactTel || '')),
    safeCellValue(String(a.contactEmail || '').trim()),
    safeCellValue(a.statut || 'Disponible')
  ]);

  return { success: true, id: id };
}

function updateTrocStatut(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_TROC);
  if (!sheet) return { success: false, error: "Onglet Troc_Annonces introuvable." };

  const targetId = String(payload.id || payload.annonceId || '').trim();
  const newStatut = String(payload.statut || (payload.action === 'deleteTrocAnnonce' ? 'Supprimé' : 'Vendu')).trim();
  if (!targetId) return { success: false, error: "Identifiant d'annonce manquant." };

  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === targetId) {
      if (newStatut.toLowerCase() === 'supprimé' || newStatut.toLowerCase() === 'supprime') {
        sheet.deleteRow(i + 1);
      } else {
        sheet.getRange(i + 1, 12).setValue(newStatut);
      }
      return { success: true, id: targetId, statut: newStatut };
    }
  }

  return { success: false, error: "Annonce introuvable." };
}

/**
 * =========================================================================
 * MODULE PARTENAIRE GO SPORT MUZILLAC (Onglet 'Partenaire_GOSport')
 * Colonnes : ID, Nom_Produit, Categorie, Photo_URL, Tarif_Magasin,
 *            Prix_Promo, Tarif_Adherent, Exclu_Club, Tailles_Dispo, Description
 * =========================================================================
 */

function ensureGoSportSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_GOSPORT);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_GOSPORT);
    sheet.setTabColor('#0284C7');
    sheet.appendRow([
      "ID",
      "Référence",
      "Reference_Fabricant_Clean",
      "Nom_Produit",
      "Categorie",
      "Photo_URL",
      "Tarif_Magasin",
      "Prix_Promo",
      "Tarif_Adherent",
      "Exclu_Club",
      "Tailles_Dispo",
      "Description"
    ]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getGoSportColMap(headersRow) {
  const norm = headersRow.map(function(h) {
    return String(h || '').trim().toLowerCase();
  });
  function findCol(candidates, fallbackIdx) {
    for (let i = 0; i < norm.length; i++) {
      const h = norm[i];
      const compact = h.replace(/[\s_-]+/g, '');
      for (let c = 0; c < candidates.length; c++) {
        if (h === candidates[c] || compact === candidates[c].replace(/[\s_-]+/g, '')) {
          return i;
        }
      }
    }
    return fallbackIdx;
  }
  return {
    id: findCol(['id'], 0),
    reference: findCol(['référence', 'reference', 'ref', 'ref_magasin'], -1),
    referenceClean: findCol(['reference_fabricant_clean', 'référence_fabricant_clean', 'reference fabricant clean', 'reference_clean', 'ref_clean'], -1),
    nomProduit: findCol(['nom_produit', 'nom produit', 'nom'], 1),
    categorie: findCol(['categorie', 'catégorie'], 2),
    photoUrl: findCol(['photo_url', 'photo url', 'photo'], 3),
    tarifMagasin: findCol(['tarif_magasin', 'tarif magasin'], 4),
    prixPromo: findCol(['prix_promo', 'prix promo'], 5),
    tarifAdherent: findCol(['tarif_adherent', 'tarif adhérent', 'tarif adherent'], 6),
    excluClub: findCol(['exclu_club', 'exclu club'], 7),
    taillesDispo: findCol(['tailles_dispo', 'tailles dispo', 'tailles'], 8),
    description: findCol(['description'], 9)
  };
}

function parseGoSportNum(val) {
  if (val === null || val === undefined || val === '') return null;
  const s = String(val).replace(/€/g, '').replace(/\s+/g, '').replace(',', '.').trim();
  if (!s) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

function getGoSportOffres() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_GOSPORT);
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const cols = getGoSportColMap(values[0]);
  const list = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const nomProduit = cols.nomProduit >= 0 ? String(row[cols.nomProduit] || '').trim() : '';
    if (!nomProduit) continue;

    const rawId = cols.id >= 0 ? String(row[cols.id] || '').trim() : '';
    const refMag = cols.reference >= 0 ? String(row[cols.reference] || '').trim() : '';
    const refClean = cols.referenceClean >= 0 ? String(row[cols.referenceClean] || '').trim() : '';
    const id = rawId || (refMag ? ('ref-' + refMag + '-' + i) : ('gosport-' + i));
    const excluRaw = cols.excluClub >= 0 ? String(row[cols.excluClub] || '').trim().toUpperCase() : '';

    list.push({
      id: id,
      reference: refMag,
      referenceFabricantClean: refClean,
      nomProduit: nomProduit,
      categorie: cols.categorie >= 0 ? String(row[cols.categorie] || 'Équipement').trim() : 'Équipement',
      photoUrl: cols.photoUrl >= 0 ? String(row[cols.photoUrl] || '').trim() : '',
      tarifMagasin: cols.tarifMagasin >= 0 ? (parseGoSportNum(row[cols.tarifMagasin]) || 0) : 0,
      prixPromo: cols.prixPromo >= 0 ? parseGoSportNum(row[cols.prixPromo]) : null,
      tarifAdherent: cols.tarifAdherent >= 0 ? parseGoSportNum(row[cols.tarifAdherent]) : null,
      excluClub: excluRaw === 'OUI' || excluRaw === 'TRUE' || excluRaw === '1',
      taillesDispo: cols.taillesDispo >= 0 ? String(row[cols.taillesDispo] || '').trim() : '',
      description: cols.description >= 0 ? String(row[cols.description] || '').trim() : ''
    });
  }

  return list;
}

function saveGoSportOffre(payload) {
  const sheet = ensureGoSportSheet();
  const o = payload.offre || payload || {};

  if (!o.nomProduit || !String(o.nomProduit).trim()) {
    return { success: false, error: "Le nom du produit est obligatoire." };
  }

  const id = String(o.id || ('gosport-' + Date.now())).trim();
  const refMag = String(o.reference || '').trim();
  const refClean = String(o.referenceFabricantClean || '').trim();
  const nomTrim = String(o.nomProduit).trim();
  const tarifMagasin = parseGoSportNum(o.tarifMagasin);
  const prixPromo = parseGoSportNum(o.prixPromo);
  const tarifAdherent = parseGoSportNum(o.tarifAdherent);
  const excluFlag = (o.excluClub === true || String(o.excluClub || '').toUpperCase() === 'OUI') ? 'OUI' : 'NON';

  const rows = sheet.getDataRange().getValues();
  const cols = getGoSportColMap(rows[0] || []);
  const colCount = Math.max((rows[0] || []).length, 10);

  let matchRowIdx = -1;
  for (let i = 1; i < rows.length; i++) {
    const rId = cols.id >= 0 ? String(rows[i][cols.id] || '').trim() : '';
    const rRef = cols.reference >= 0 ? String(rows[i][cols.reference] || '').trim() : '';
    const rNom = cols.nomProduit >= 0 ? String(rows[i][cols.nomProduit] || '').trim() : '';
    if ((rId && rId === id) || (refMag && rRef && rRef === refMag && rNom === nomTrim) || (!rId && rNom === nomTrim && (!refMag || rRef === refMag))) {
      matchRowIdx = i;
      break;
    }
  }

  const rowArr = matchRowIdx >= 1 ? rows[matchRowIdx].slice() : new Array(colCount).fill('');
  while (rowArr.length < colCount) rowArr.push('');

  if (cols.id >= 0) rowArr[cols.id] = safeCellValue(id);
  if (cols.reference >= 0 && (refMag || matchRowIdx === -1)) rowArr[cols.reference] = safeCellValue(refMag);
  if (cols.referenceClean >= 0 && (refClean || matchRowIdx === -1)) rowArr[cols.referenceClean] = safeCellValue(refClean);
  if (cols.nomProduit >= 0) rowArr[cols.nomProduit] = safeCellValue(nomTrim);
  if (cols.categorie >= 0) rowArr[cols.categorie] = safeCellValue(String(o.categorie || 'Équipement').trim());
  if (cols.photoUrl >= 0) rowArr[cols.photoUrl] = safeCellValue(String(o.photoUrl || '').trim());
  if (cols.tarifMagasin >= 0) rowArr[cols.tarifMagasin] = tarifMagasin !== null ? tarifMagasin : 0;
  if (cols.prixPromo >= 0) rowArr[cols.prixPromo] = prixPromo !== null ? prixPromo : '';
  if (cols.tarifAdherent >= 0) rowArr[cols.tarifAdherent] = tarifAdherent !== null ? tarifAdherent : '';
  if (cols.excluClub >= 0) rowArr[cols.excluClub] = excluFlag;
  if (cols.taillesDispo >= 0) rowArr[cols.taillesDispo] = safeCellValue(String(o.taillesDispo || '').trim());
  if (cols.description >= 0) rowArr[cols.description] = safeCellValue(String(o.description || '').trim());

  if (matchRowIdx >= 1) {
    sheet.getRange(matchRowIdx + 1, 1, 1, rowArr.length).setValues([rowArr]);
    return { success: true, id: id, updated: true };
  }

  sheet.appendRow(rowArr);
  return { success: true, id: id, created: true };
}

function deleteGoSportOffre(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_GOSPORT);
  if (!sheet) return { success: false, error: "Onglet Partenaire_GOSport introuvable." };

  const targetId = String(payload.id || payload.offreId || '').trim();
  const targetRef = String(payload.reference || '').trim();
  if (!targetId && !targetRef) return { success: false, error: "Identifiant de produit manquant." };

  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return { success: false, error: "Produit GO Sport introuvable." };
  const cols = getGoSportColMap(rows[0]);

  for (let i = 1; i < rows.length; i++) {
    const rId = cols.id >= 0 ? String(rows[i][cols.id] || '').trim() : '';
    const rRef = cols.reference >= 0 ? String(rows[i][cols.reference] || '').trim() : '';
    if ((targetId && rId && rId === targetId) || (targetRef && rRef && rRef === targetRef)) {
      sheet.deleteRow(i + 1);
      return { success: true, id: targetId || targetRef };
    }
  }

  return { success: false, error: "Produit GO Sport introuvable." };
}

/**
 * =========================================================================
 * MODULE ESPACE ADHÉRENT (OTP par e-mail + Session familiale + Parent mineur)
 * =========================================================================
 */

function autoriserEnvoiEmails() {
  // Exécutez cette fonction 1 fois depuis l'éditeur Apps Script pour accorder la permission MailApp.
  Logger.log("Quota e-mail restant aujourd'hui : " + MailApp.getRemainingDailyQuota());
}

function normalizePortalLicence(val) {
  return String(val || '').trim().toUpperCase().replace(/[\s\-\.]+/g, '');
}

function extractPortalLicenceDigits(val) {
  return normalizePortalLicence(val).replace(/\D/g, '').replace(/^0+/, '');
}

function licencesMatchPortal(a, b) {
  const normA = normalizePortalLicence(a);
  const normB = normalizePortalLicence(b);
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  const digA = extractPortalLicenceDigits(normA);
  const digB = extractPortalLicenceDigits(normB);
  if (!digA || digA.length < 4 || digA !== digB) return false;
  const letterA = normA.replace(/[^A-Z]/g, '');
  const letterB = normB.replace(/[^A-Z]/g, '');
  if (letterA && letterB) return letterA === letterB;
  return true;
}

function getPortalOtpCacheKey(normLic) {
  const digits = extractPortalLicenceDigits(normLic);
  return digits.length >= 4 ? digits : normalizePortalLicence(normLic);
}

function normalizePortalEmail(val) {
  return String(val || '').trim().toLowerCase();
}

function maskPortalEmail(email) {
  const parts = normalizePortalEmail(email).split('@');
  if (parts.length !== 2) return '***';
  const local = parts[0];
  const domain = parts[1];
  const visible = local.length <= 2 ? local.charAt(0) : local.slice(0, 2);
  return visible + '***@' + domain;
}

function findAdherentsPortalCols(headersRow) {
  const norm = headersRow.map(function(h) {
    return String(h || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  });
  function findIdx(candidates, fallbackIdx) {
    for (var c = 0; c < candidates.length; c++) {
      var target = candidates[c];
      for (var i = 0; i < norm.length; i++) {
        if (norm[i] === target) return i;
      }
    }
    for (var c2 = 0; c2 < candidates.length; c2++) {
      var target2 = candidates[c2];
      for (var j = 0; j < norm.length; j++) {
        if (norm[j].indexOf(target2) !== -1) return j;
      }
    }
    return fallbackIdx;
  }
  return {
    nomPrenom: findIdx(['nom prenom', 'nom et prenom', 'adherent'], 0),
    dateNaiss: findIdx(['date naiss.', 'date naissance', 'naissance'], 6),
    representantLegal: findIdx(['statut representant legal', 'representant legal'], 8),
    email: findIdx(['email', 'mail'], 20),
    email2: findIdx(['2eme email', 'email 2'], -1),
    licence: findIdx(['licence', 'n° licence', 'n° de licence', 'numero licence', 'numero de licence', 'licence fft'], 22)
  };
}

function extractBirthYearForPortal(rawDate) {
  if (!rawDate) return null;
  if (Object.prototype.toString.call(rawDate) === '[object Date]' && !isNaN(rawDate.getTime())) {
    return rawDate.getFullYear();
  }
  const s = String(rawDate).trim();
  if (/^\d{4}$/.test(s)) return parseInt(s, 10);
  const frMatch = s.match(/\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.](\d{4})\b/);
  if (frMatch && frMatch[1]) return parseInt(frMatch[1], 10);
  const isoMatch = s.match(/\b(\d{4})[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}\b/);
  if (isoMatch && isoMatch[1]) return parseInt(isoMatch[1], 10);
  return null;
}

function findMatchingRowByLicencePortal(rows, cols, inputLic) {
  const normInput = normalizePortalLicence(inputLic);
  // 1. Priorité à la correspondance exacte (avec lettre si présente)
  for (let i = 1; i < rows.length; i++) {
    const rowLic = normalizePortalLicence(rows[i][cols.licence]);
    if (rowLic && rowLic === normInput) {
      return { rowIndex: i, rowLic: rowLic, row: rows[i] };
    }
  }
  // 2. Sinon correspondance tolérante (numéro saisi sans la lettre finale ou sans zéro initial)
  for (let i = 1; i < rows.length; i++) {
    const rowLic = normalizePortalLicence(rows[i][cols.licence]);
    if (rowLic && licencesMatchPortal(rowLic, normInput)) {
      return { rowIndex: i, rowLic: rowLic, row: rows[i] };
    }
  }
  return null;
}

function requestAdherentOtp(payload) {
  const normInputLic = normalizePortalLicence(payload && payload.licence);
  if (!normInputLic || normInputLic.length < 4) {
    return { success: false, error: "Veuillez saisir un numéro de licence valide." };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_ADHERENTS);
  if (!sheet) {
    return { success: false, error: "Onglet Adhérents introuvable dans le classeur." };
  }

  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) {
    return { success: false, error: "Aucun adhérent enregistré." };
  }

  const cols = findAdherentsPortalCols(rows[0]);
  const match = findMatchingRowByLicencePortal(rows, cols, normInputLic);
  if (!match) {
    return { success: false, error: "Numéro de licence introuvable dans la base du club." };
  }

  const foundLic = match.rowLic;
  const foundName = String(match.row[cols.nomPrenom] || '').trim();
  const mainEmail = normalizePortalEmail(match.row[cols.email]);
  const altEmail = cols.email2 >= 0 ? normalizePortalEmail(match.row[cols.email2]) : '';
  const foundEmail = mainEmail || altEmail;

  if (!foundEmail || foundEmail.indexOf('@') === -1) {
    return {
      success: false,
      error: "Aucune adresse e-mail valide n'est associée à cette licence. Contactez le bureau du club."
    };
  }

  const cache = CacheService.getScriptCache();
  const cacheStem = getPortalOtpCacheKey(foundLic);
  const cooldownKey = 'tcm_otp_cd_' + cacheStem;
  if (cache.get(cooldownKey)) {
    return {
      success: false,
      error: "Un code vient déjà d'être envoyé. Veuillez patienter 60 secondes avant de réessayer."
    };
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const record = {
    code: code,
    licence: foundLic,
    email: foundEmail,
    attempts: 0,
    expiresAt: Date.now() + 600000
  };

  cache.put('tcm_otp_' + cacheStem, JSON.stringify(record), 600);
  cache.put(cooldownKey, '1', 60);

  const clubInfo = getClubInfo();
  const clubName = (clubInfo && clubInfo.nom) ? clubInfo.nom : 'Muzillac Tennis Club';
  const subject = '[' + clubName + '] Votre code de connexion Espace Adhérent';
  const body =
    'Bonjour' + (foundName ? ' ' + foundName : '') + ',\n\n' +
    'Voici votre code unique pour accéder à votre Espace Adhérent (' + clubName + ') :\n\n' +
    '    CODE : ' + code + '\n\n' +
    'Ce code est valable pendant 10 minutes et concerne la licence n° ' + foundLic + '.\n' +
    'Si vous n\'êtes pas à l\'origine de cette demande, ignorez simplement ce message.\n\n' +
    'Bien sportivement,\n' +
    clubName;

  MailApp.sendEmail({
    to: foundEmail,
    subject: subject,
    body: body
  });

  return {
    success: true,
    maskedEmail: maskPortalEmail(foundEmail),
    expiresInSeconds: 600
  };
}

function verifyAdherentOtp(payload) {
  const normInputLic = normalizePortalLicence(payload && payload.licence);
  const cleanCode = String((payload && payload.code) || '').replace(/\D/g, '').trim();

  if (!normInputLic || !/^\d{6}$/.test(cleanCode)) {
    return { success: false, error: "Numéro de licence ou code à 6 chiffres invalide." };
  }

  const cache = CacheService.getScriptCache();
  const cacheStem = getPortalOtpCacheKey(normInputLic);
  const otpKey = 'tcm_otp_' + cacheStem;
  const rawRecord = cache.get(otpKey);
  if (!rawRecord) {
    return { success: false, error: "Code expiré ou introuvable. Veuillez demander un nouveau code." };
  }

  let record = null;
  try {
    record = JSON.parse(rawRecord);
  } catch (e) {
    cache.remove(otpKey);
    return { success: false, error: "Session OTP invalide. Demandez un nouveau code." };
  }

  if (!record || Date.now() > Number(record.expiresAt || 0)) {
    cache.remove(otpKey);
    return { success: false, error: "Ce code a expiré. Veuillez en demander un nouveau." };
  }

  if (!licencesMatchPortal(record.licence, normInputLic)) {
    return { success: false, error: "Ce code ne correspond pas au numéro de licence saisi." };
  }

  const attempts = Number(record.attempts || 0);
  if (attempts >= 5) {
    cache.remove(otpKey);
    return { success: false, error: "Trop de tentatives erronées. Veuillez demander un nouveau code." };
  }

  if (String(record.code) !== cleanCode) {
    record.attempts = attempts + 1;
    const remainingSec = Math.max(30, Math.floor((Number(record.expiresAt) - Date.now()) / 1000));
    if (record.attempts >= 5) {
      cache.remove(otpKey);
      return {
        success: false,
        attemptsRemaining: 0,
        error: "Code incorrect. Nombre maximal d'essais atteint, veuillez demander un nouveau code."
      };
    }
    cache.put(otpKey, JSON.stringify(record), remainingSec);
    return {
      success: false,
      attemptsRemaining: 5 - record.attempts,
      error: "Code incorrect. Il vous reste " + (5 - record.attempts) + " essai(s)."
    };
  }

  cache.remove(otpKey);
  cache.remove('tcm_otp_cd_' + cacheStem);

  const canonicalLic = record.licence || normInputLic;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_ADHERENTS);
  const familyLicences = [];

  if (sheet) {
    const rows = sheet.getDataRange().getValues();
    if (rows.length > 1) {
      const cols = findAdherentsPortalCols(rows[0]);
      for (let i = 1; i < rows.length; i++) {
        const rowLic = normalizePortalLicence(rows[i][cols.licence]);
        const rowEmail = normalizePortalEmail(rows[i][cols.email]);
        const rowEmail2 = cols.email2 >= 0 ? normalizePortalEmail(rows[i][cols.email2]) : '';
        if (rowLic && (rowEmail === record.email || (rowEmail2 && rowEmail2 === record.email))) {
          if (familyLicences.indexOf(rowLic) === -1) {
            familyLicences.push(rowLic);
          }
        }
      }
    }
  }

  if (familyLicences.indexOf(canonicalLic) === -1) {
    familyLicences.unshift(canonicalLic);
  }

  const PORTAL_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const expiresAt = now + PORTAL_SESSION_TTL_MS;
  const sessionToken = Utilities.getUuid() + '-' + Utilities.getUuid().slice(0, 8);
  const sessionData = {
    verifiedLicence: canonicalLic,
    verifiedEmail: record.email,
    familyLicences: familyLicences,
    createdAt: now,
    expiresAt: expiresAt
  };
  const sessionJson = JSON.stringify(sessionData);

  try {
    const props = PropertiesService.getScriptProperties();
    pruneExpiredPortalSessions(props);
    props.setProperty('tcm_sess_' + sessionToken, sessionJson);
  } catch (e) {}

  cache.put('tcm_adh_sess_' + sessionToken, sessionJson, 21600);

  return {
    success: true,
    sessionToken: sessionToken,
    verifiedLicence: canonicalLic,
    verifiedEmail: record.email,
    maskedEmail: maskPortalEmail(record.email),
    familyLicences: familyLicences,
    expiresAt: expiresAt
  };
}

function pruneExpiredPortalSessions(props) {
  try {
    const keys = props.getKeys();
    const now = Date.now();
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (k.indexOf('tcm_sess_') !== 0) continue;
      const raw = props.getProperty(k);
      if (!raw) {
        props.deleteProperty(k);
        continue;
      }
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || (parsed.expiresAt && now > Number(parsed.expiresAt))) {
          props.deleteProperty(k);
        }
      } catch (err) {
        props.deleteProperty(k);
      }
    }
  } catch (e) {}
}

function logoutAdherentSession(payload) {
  const sessionToken = String((payload && payload.sessionToken) || '').trim();
  if (!sessionToken) {
    return { success: true };
  }
  try {
    PropertiesService.getScriptProperties().deleteProperty('tcm_sess_' + sessionToken);
  } catch (e) {}
  try {
    CacheService.getScriptCache().remove('tcm_adh_sess_' + sessionToken);
  } catch (e) {}
  return { success: true };
}

function updateMinorParent(payload) {
  const sessionToken = String((payload && payload.sessionToken) || '').trim();
  const normInputLic = normalizePortalLicence(payload && payload.licence);
  const rawParent = String((payload && payload.representantLegal) || '')
    .trim()
    .replace(/^[=+\-@]+/, '')
    .slice(0, 120);

  if (!sessionToken) {
    return { success: false, error: "Session expirée ou non authentifiée." };
  }
  if (!normInputLic || !rawParent) {
    return { success: false, error: "Numéro de licence ou nom du parent manquant." };
  }

  let rawSession = null;
  let props = null;
  try {
    props = PropertiesService.getScriptProperties();
    rawSession = props.getProperty('tcm_sess_' + sessionToken);
  } catch (e) {}

  const cache = CacheService.getScriptCache();
  if (!rawSession) {
    rawSession = cache.get('tcm_adh_sess_' + sessionToken);
  }
  if (!rawSession) {
    return { success: false, error: "Votre session a expiré. Veuillez vous reconnecter." };
  }

  let session = null;
  try {
    session = JSON.parse(rawSession);
  } catch (e) {
    return { success: false, error: "Session invalide." };
  }

  if (session && session.expiresAt && Date.now() > Number(session.expiresAt)) {
    try { if (props) props.deleteProperty('tcm_sess_' + sessionToken); } catch (e) {}
    try { cache.remove('tcm_adh_sess_' + sessionToken); } catch (e) {}
    return { success: false, error: "Votre session a expiré. Veuillez vous reconnecter." };
  }

  const allowed = Array.isArray(session.familyLicences) ? session.familyLicences : [];
  const isAllowed = allowed.some(function(aLic) {
    return licencesMatchPortal(aLic, normInputLic);
  });
  if (!isAllowed) {
    return { success: false, error: "Accès non autorisé pour ce numéro de licence." };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_ADHERENTS);
  if (!sheet) {
    return { success: false, error: "Onglet Adhérents introuvable." };
  }

  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) {
    return { success: false, error: "Base adhérents vide." };
  }

  const cols = findAdherentsPortalCols(rows[0]);
  if (cols.representantLegal < 0) {
    return { success: false, error: "Colonne Représentant légal introuvable." };
  }

  const match = findMatchingRowByLicencePortal(rows, cols, normInputLic);
  if (match) {
    const birthYear = extractBirthYearForPortal(match.row[cols.dateNaiss]);
    const currentSeasonYear = Math.max(2027, new Date().getFullYear());
    if (birthYear && (currentSeasonYear - birthYear) >= 18) {
      return {
        success: false,
        error: "La modification du représentant légal est réservée aux adhérents mineurs."
      };
    }
    sheet.getRange(match.rowIndex + 1, cols.representantLegal + 1).setValue(rawParent);
    return {
      success: true,
      licence: match.rowLic,
      representantLegal: rawParent
    };
  }

  return { success: false, error: "Adhérent introuvable." };
}


