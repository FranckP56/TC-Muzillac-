/**
 * =========================================================================
 * MUZILLAC TENNIS CLUB (TCM) - GOOGLE APPS SCRIPT BACKEND
 * Fichier : Code.gs (Millésime FFT 2027)
 * Description : Script pour servir la Web App et synchroniser les données
 *               des onglets du Google Sheet ('Adhérents', 'Rencontres',
 *               'Compositions_Equipes', 'Bureau_Profs', 'Installations',
 *               'Cotisations_Tarifs', 'Club_Info').
 * =========================================================================
 */

const SHEET_ADHERENTS = 'Adhérents';
const SHEET_RENCONTRES = 'Rencontres';
const SHEET_COMPOSITIONS = 'Compositions_Equipes';
const SHEET_BUREAU = 'Bureau_Profs';
const SHEET_INSTALLATIONS = 'Installations';
const SHEET_TARIFS = 'Cotisations_Tarifs';
const SHEET_CLUB_INFO = 'Club_Info';

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
      } else if (action === 'getAll' || action === 'all') {
        result = { 
          success: true, 
          adherents: getAdherents(),
          rencontres: getRencontres(),
          compositions: getSavedCompositions(),
          clubInfo: getClubInfo(),
          bureau: getBureauData(),
          installations: getInstallationsData(),
          tarifs: getTarifsData()
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

      result[matchId] = {
        matchId: matchId,
        dateRencontre: String(row[1] || ''),
        numeroEquipe: String(row[2] || ''),
        heureDebut: hDeb,
        lieuRencontre: lieu,
        nombreCourts: nCourts,
        dateValidation: dateVal,
        valideParCapitaine: valCap,
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
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_COMPOSITIONS);
    sheet.setTabColor('#E65100');
    sheet.appendRow([
      "ID Rencontre", "Date Rencontre", "Numéro Équipe", "Homologation", "Catégorie", "Sexe",
      "Club Accueil", "Club Visiteur", "Poste", "Nom Prénom Joueur", "N° Licence",
      "Classement Gelé au Match", "Date Naissance", "Âge Sportif", "Type Licence",
      "Heure Début", "Lieu Rencontre", "Nombre Courts", "Date Enregistrement", "Validé par Capitaine"
    ]);
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

  const players = payload.slots || payload.frozenPlayers || [];

  if (!matchId || players.length === 0) {
    return { success: false, error: "Données de rencontre ou joueurs manquants." };
  }

  const existingValues = sheet.getDataRange().getValues();
  const keptRows = [];
  const header = existingValues[0];
  keptRows.push(header);

  for (let i = 1; i < existingValues.length; i++) {
    if (String(existingValues[i][0]).trim() !== String(matchId).trim()) {
      keptRows.push(existingValues[i]);
    }
  }

  for (let p = 0; p < players.length; p++) {
    const pl = players[p];
    keptRows.push([
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
      valideParCapitaine
    ]);
  }

  sheet.clearContents();
  sheet.getRange(1, 1, keptRows.length, keptRows[0].length).setValues(keptRows);

  return { success: true, rowsSaved: players.length };
}
