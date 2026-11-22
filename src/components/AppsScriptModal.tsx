import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  FileCode2, 
  FileText, 
  ExternalLink, 
  HelpCircle,
  Shield,
  Download
} from 'lucide-react';

interface AppsScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppsScriptModal: React.FC<AppsScriptModalProps> = ({ isOpen, onClose }) => {
  const [activeFile, setActiveFile] = useState<'codegs' | 'guide' | 'bareme'>('codegs');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const CODE_GS_CONTENT = `/**
 * =========================================================================
 * MUZILLAC TENNIS CLUB (TCM) - GOOGLE APPS SCRIPT BACKEND
 * Fichier : Code.gs (Millésime FFT 2027)
 * =========================================================================
 */

const SHEET_ADHERENTS = 'Adhérents';
const SHEET_RENCONTRES = 'Rencontres';

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'getAll';
  var result = {};

  try {
    if (action === 'getAll' || action === 'all') {
      result = {
        success: true,
        adherents: getSheetRawValues('Adhérents'),
        rencontres: getSheetRawValues('Rencontres'),
        compositions: getSheetRawValues('Compositions_Equipes'),
        bureau: getSheetRawValues('Bureau_Profs'),
        installations: getSheetRawValues('Installations'),
        tarifs: getSheetRawValues('Cotisations_Tarifs'),
        troc: getSheetRawValues('Troc_Annonces'),
        gosport: getSheetRawValues('Partenaire_GOSport'),
        clubInfo: getClubInfoSheetValues()
      };
    } else if (action === 'getAdherents' || action === 'adherents') {
      result = { success: true, data: getSheetRawValues('Adhérents') };
    } else if (action === 'getRencontres' || action === 'rencontres') {
      result = { success: true, data: getSheetRawValues('Rencontres') };
    } else if (action === 'getTroc' || action === 'troc') {
      result = { success: true, data: getSheetRawValues('Troc_Annonces') };
    } else if (action === 'getGoSport' || action === 'gosport') {
      result = { success: true, data: getSheetRawValues('Partenaire_GOSport') };
    } else if (action === 'getClubInfo' || action === 'clubinfo') {
      result = { success: true, data: getClubInfoSheetValues() };
    } else {
      result = { success: false, error: "Action inconnue : " + action };
    }
  } catch (err) {
    result = { success: false, error: err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var raw = e && e.postData ? e.postData.contents : '';
    var json = raw ? JSON.parse(raw) : {};
    var action = json.action || (e && e.parameter ? e.parameter.action : '');

    if (action === 'saveComposition') {
      return handleSaveComposition(json);
    } else if (action === 'saveClubInfo') {
      return handleSaveClubInfo(json);
    } else if (action === 'saveTrocAnnonce') {
      return handleSaveTrocAnnonce(json);
    } else if (action === 'updateTrocStatut' || action === 'deleteTrocAnnonce') {
      return handleUpdateTrocStatut(json);
    } else if (action === 'saveGoSportOffre') {
      return handleSaveGoSportOffre(json);
    } else if (action === 'deleteGoSportOffre') {
      return handleDeleteGoSportOffre(json);
    } else if (action === 'requestAdherentOtp') {
      return handleRequestAdherentOtp(json);
    } else if (action === 'verifyAdherentOtp') {
      return handleVerifyAdherentOtp(json);
    } else if (action === 'updateMinorParent') {
      return handleUpdateMinorParent(json);
    } else {
      return createJsonResponse({ success: false, error: 'Action inconnue : ' + action });
    }
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheetRawValues(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  return sheet.getDataRange().getValues();
}

function getClubInfoSheet(ss) {
  var names = ['Club_Info', 'Club_infos', 'Club_Infos'];
  for (var i = 0; i < names.length; i++) {
    var s = ss.getSheetByName(names[i]);
    if (s) return s;
  }
  return null;
}

function getClubInfoSheetValues() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getClubInfoSheet(ss);
  if (!sheet) return [];
  return sheet.getDataRange().getValues();
}

function handleSaveComposition(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Compositions_Equipes');
  var expectedHeaders = [
    "ID Rencontre", "Date Rencontre", "Numéro Équipe", "Homologation", "Catégorie", "Sexe",
    "Club Accueil", "Club Visiteur", "Poste", "Nom Prénom Joueur", "N° Licence", "Classement Gelé au Match",
    "Date Naissance", "Âge Sportif", "Type Licence", "Heure Début", "Lieu Rencontre", "Nombre Courts",
    "Date Enregistrement", "Validé par Capitaine", "Ordre des Matchs", "Heures Rotations"
  ];
  if (!sheet) {
    sheet = ss.insertSheet('Compositions_Equipes');
    sheet.appendRow(expectedHeaders);
  }

  var matchId = payload.rencontreId;
  var rows = sheet.getDataRange().getValues();
  var keepRows = [];
  var headerRow = [];
  if (rows.length > 0) {
    headerRow = rows[0].slice();
    while (headerRow.length > 0 && String(headerRow[headerRow.length - 1] || '').trim() === '') {
      headerRow.pop();
    }
    while (headerRow.length < expectedHeaders.length) {
      headerRow.push(expectedHeaders[headerRow.length]);
    }
    headerRow[20] = expectedHeaders[20];
    headerRow[21] = expectedHeaders[21];
    keepRows.push(headerRow);
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || '').trim() !== String(matchId || '').trim()) {
        var r = rows[i].slice(0, headerRow.length);
        while (r.length < headerRow.length) r.push('');
        keepRows.push(r);
      }
    }
  } else {
    headerRow = expectedHeaders.slice();
    keepRows.push(headerRow);
  }

  var slots = payload.slots || [];
  var nowStr = payload.dateValidation || new Date().toISOString();
  var ordreJson = JSON.stringify(payload.ordreMatchs || (payload.composition && payload.composition.ordreMatchs) || []);
  var rotationsJson = JSON.stringify(payload.heuresRotations || (payload.composition && payload.composition.heuresRotations) || {});

  function padRow(rowArr) {
    while (rowArr.length < headerRow.length) rowArr.push('');
    return rowArr.slice(0, headerRow.length);
  }

  if (slots.length === 0) {
    keepRows.push(padRow([
      matchId,
      payload.dateRencontre || '',
      payload.numeroEquipe || '',
      payload.libelleHomologation || '',
      payload.categorieAgeHomologation || '',
      payload.sexeHomologation || '',
      payload.clubAccueilNom || '',
      payload.clubVisiteurNom || '',
      'Logistique & Ordre',
      '',
      '',
      '',
      '',
      '',
      '',
      payload.heureDebut || '09:00',
      payload.lieuRencontre || 'Clos des Moines (Muzillac)',
      payload.nombreCourts || 2,
      nowStr,
      payload.valideParCapitaine ? 'OUI' : 'NON',
      ordreJson,
      rotationsJson
    ]));
  } else {
    for (var j = 0; j < slots.length; j++) {
      var s = slots[j];
      keepRows.push(padRow([
        matchId,
        payload.dateRencontre || '',
        payload.numeroEquipe || '',
        payload.libelleHomologation || '',
        payload.categorieAgeHomologation || '',
        payload.sexeHomologation || '',
        payload.clubAccueilNom || '',
        payload.clubVisiteurNom || '',
        s.poste || '',
        s.nomPrenom || '',
        s.licence || '',
        s.classementGele || 'NC',
        s.dateNaissance || '',
        s.ageSportif || '',
        s.typeLicence || '',
        payload.heureDebut || '09:00',
        payload.lieuRencontre || 'Clos des Moines (Muzillac)',
        payload.nombreCourts || 2,
        nowStr,
        payload.valideParCapitaine ? 'OUI' : 'NON',
        ordreJson,
        rotationsJson
      ]));
    }
  }

  sheet.clearContents();
  sheet.getRange(1, 1, keepRows.length, headerRow.length).setValues(keepRows);
  return createJsonResponse({ success: true, rowsSaved: slots.length || 1 });
}

function safeCellValue(val) {
  if (val === null || val === undefined) return '';
  var s = String(val);
  return s.length > 48000 ? s.substring(0, 48000) : s;
}

function handleSaveClubInfo(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var info = payload.clubInfo || payload || {};

  // 1. Mise à jour ou création de l'onglet Club_Info / Club_infos
  var cSheet = getClubInfoSheet(ss);
  if (!cSheet) {
    cSheet = ss.insertSheet('Club_Info');
    cSheet.setTabColor('#0284C7');
  }
  var cRows = [
    ["Paramètre", "Valeur"],
    ["Nom du Club", info.nom || "Muzillac Tennis Club"],
    ["Sigle", info.sigle || "TCM"],
    ["Ligue", info.ligue || "Ligue de Bretagne de Tennis"],
    ["Comité", info.comite || "Comité Départemental du Morbihan (56)"],
    ["Code Club", info.codeClub || "52 56 0212"],
    ["Adresse", info.adresse || "Complexe du Clos des Moines, 56190 Muzillac"],
    ["Code Postal", info.codePostal || "56190"],
    ["Ville", info.ville || "Muzillac"],
    ["Téléphone", info.telephone || ""],
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
    ["Téléphone Président", info.presidentTelephone || ""],
    ["Email Président", info.presidentEmail || ""],
    ["Secrétaire", info.secretaire || ""],
    ["Téléphone Secrétaire", info.secretaireTelephone || ""],
    ["Email Secrétaire", info.secretaireEmail || ""],
    ["Trésorier", info.tresorier || ""],
    ["Téléphone Trésorier", info.tresorierTelephone || ""],
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
  var sanitizedCRows = cRows.map(function(r) {
    return [r[0], safeCellValue(r[1])];
  });
  cSheet.clearContents();
  cSheet.getRange(1, 1, sanitizedCRows.length, 2).setValues(sanitizedCRows);

  // 2. Mise à jour de Bureau_Profs si l'onglet existe
  var bSheet = ss.getSheetByName('Bureau_Profs');
  if (bSheet && (info.president || info.secretaire || info.tresorier)) {
    var bRows = [
      ["Rôle / Fonction", "Nom Prénom", "Diplôme / Titre", "Téléphone", "Email", "Description / Missions"],
      ["Président", info.president || "", "Dirigeant", info.presidentTelephone || "", info.presidentEmail || "", "Direction du club"],
      ["Secrétaire", info.secretaire || "", "Dirigeante", info.secretaireTelephone || "", info.secretaireEmail || "", "Secrétariat et licences"],
      ["Trésorier", info.tresorier || "", "Dirigeant", info.tresorierTelephone || "", info.tresorierEmail || "", "Comptabilité et finances"]
    ];
    var profs = info.enseignants || [];
    for (var p = 0; p < profs.length; p++) {
      bRows.push(["Enseignant", profs[p].nomPrenom, profs[p].diplome, profs[p].telephone || "", profs[p].email || "", profs[p].description || ""]);
    }
    bSheet.clearContents();
    bSheet.getRange(1, 1, bRows.length, bRows[0].length).setValues(bRows);
  }

  return createJsonResponse({ success: true, rowsSaved: cRows.length });
}

function handleSaveTrocAnnonce(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Troc_Annonces');
  if (!sheet) {
    sheet = ss.insertSheet('Troc_Annonces');
    sheet.setTabColor('#E65100');
    sheet.appendRow([
      "ID", "Date Publication", "Titre", "Catégorie", "Taille / Pointure",
      "État", "Photo", "Prix (€)", "Contact Nom", "Téléphone", "Email", "Statut"
    ]);
    sheet.setFrozenRows(1);
  }
  var a = payload.annonce || payload || {};
  var id = a.id || ('troc-' + new Date().getTime());
  var nowDate = Utilities.formatDate(new Date(), "GMT+1", "dd/MM/yyyy");
  sheet.appendRow([
    safeCellValue(id),
    safeCellValue(a.datePublication || nowDate),
    safeCellValue(a.titre || ''),
    safeCellValue(a.categorie || 'Raquettes'),
    safeCellValue(a.taillePointure || ''),
    safeCellValue(a.etat || 'Bon état'),
    safeCellValue(a.photoUrl || ''),
    Number(a.prix) || 0,
    safeCellValue(a.contactNom || ''),
    safeCellValue(a.contactTel || ''),
    safeCellValue(a.contactEmail || ''),
    safeCellValue(a.statut || 'Disponible')
  ]);
  return createJsonResponse({ success: true, id: id });
}

function handleUpdateTrocStatut(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Troc_Annonces');
  if (!sheet) return createJsonResponse({ success: false, error: 'Onglet Troc_Annonces introuvable.' });
  var id = String(payload.id || '').trim();
  var statut = String(payload.statut || 'Vendu').trim();
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0] || '').trim() === id) {
      if (statut.toLowerCase() === 'supprimé' || statut.toLowerCase() === 'supprime') {
        sheet.deleteRow(i + 1);
      } else {
        sheet.getRange(i + 1, 12).setValue(statut);
      }
      return createJsonResponse({ success: true, id: id, statut: statut });
    }
  }
  return createJsonResponse({ success: false, error: 'Annonce introuvable.' });
}

function getGoSportColMap(headersRow) {
  var norm = headersRow.map(function(h) {
    return String(h || '').trim().toLowerCase();
  });
  function findCol(candidates, fallbackIdx) {
    for (var i = 0; i < norm.length; i++) {
      var h = norm[i];
      var compact = h.replace(/[\s_-]+/g, '');
      for (var c = 0; c < candidates.length; c++) {
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
    photoUrl2: findCol(['photo_url_2', 'photo_url2', 'photo url 2', 'photo_2', 'photo 2'], -1),
    tarifMagasin: findCol(['tarif_magasin', 'tarif magasin'], 4),
    prixPromo: findCol(['prix_promo', 'prix promo'], 5),
    tarifAdherent: findCol(['tarif_adherent', 'tarif adhérent', 'tarif adherent'], 6),
    excluClub: findCol(['exclu_club', 'exclu club'], 7),
    taillesDispo: findCol(['tailles_dispo', 'tailles dispo', 'tailles'], 8),
    description: findCol(['description'], 9)
  };
}

function handleSaveGoSportOffre(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Partenaire_GOSport');
  if (!sheet) {
    sheet = ss.insertSheet('Partenaire_GOSport');
    sheet.setTabColor('#0284C7');
    sheet.appendRow([
      "ID", "Référence", "Reference_Fabricant_Clean", "Nom_Produit", "Categorie", "Photo_URL", "Photo_URL_2",
      "Tarif_Magasin", "Prix_Promo", "Tarif_Adherent", "Exclu_Club", "Tailles_Dispo", "Description"
    ]);
    sheet.setFrozenRows(1);
  }
  var o = payload.offre || payload || {};
  if (!o.nomProduit || !String(o.nomProduit).trim()) {
    return createJsonResponse({ success: false, error: 'Le nom du produit est obligatoire.' });
  }
  var id = String(o.id || ('gosport-' + new Date().getTime())).trim();
  var refMag = String(o.reference || '').trim();
  var refClean = String(o.referenceFabricantClean || '').trim();
  var nomTrim = String(o.nomProduit).trim();
  var excluFlag = (o.excluClub === true || String(o.excluClub || '').toUpperCase() === 'OUI') ? 'OUI' : 'NON';

  var rows = sheet.getDataRange().getValues();
  var headerRow = (rows[0] || []).slice();
  var cols = getGoSportColMap(headerRow);
  if (cols.photoUrl2 < 0 && o.photoUrl2 !== undefined && String(o.photoUrl2).trim() !== '') {
    var newColIdx = headerRow.length;
    headerRow.push('Photo_URL_2');
    sheet.getRange(1, newColIdx + 1).setValue('Photo_URL_2');
    cols.photoUrl2 = newColIdx;
  }
  var colCount = Math.max(headerRow.length, 10);

  var matchRowIdx = -1;
  for (var i = 1; i < rows.length; i++) {
    var rId = cols.id >= 0 ? String(rows[i][cols.id] || '').trim() : '';
    var rRef = cols.reference >= 0 ? String(rows[i][cols.reference] || '').trim() : '';
    var rNom = cols.nomProduit >= 0 ? String(rows[i][cols.nomProduit] || '').trim() : '';
    if ((rId && rId === id) || (refMag && rRef && rRef === refMag && rNom === nomTrim) || (!rId && rNom === nomTrim && (!refMag || rRef === refMag))) {
      matchRowIdx = i;
      break;
    }
  }

  var rowArr = matchRowIdx >= 1 ? rows[matchRowIdx].slice() : new Array(colCount).fill('');
  while (rowArr.length < colCount) rowArr.push('');

  if (cols.id >= 0) rowArr[cols.id] = safeCellValue(id);
  if (cols.reference >= 0 && (refMag || matchRowIdx === -1)) rowArr[cols.reference] = safeCellValue(refMag);
  if (cols.referenceClean >= 0 && (refClean || matchRowIdx === -1)) rowArr[cols.referenceClean] = safeCellValue(refClean);
  if (cols.nomProduit >= 0) rowArr[cols.nomProduit] = safeCellValue(nomTrim);
  if (cols.categorie >= 0) rowArr[cols.categorie] = safeCellValue(String(o.categorie || 'Équipement').trim());
  if (cols.photoUrl >= 0) rowArr[cols.photoUrl] = safeCellValue(String(o.photoUrl || '').trim());
  if (cols.photoUrl2 >= 0 && o.photoUrl2 !== undefined) rowArr[cols.photoUrl2] = safeCellValue(String(o.photoUrl2 || '').trim());
  if (cols.tarifMagasin >= 0) rowArr[cols.tarifMagasin] = o.tarifMagasin !== '' && o.tarifMagasin !== null && o.tarifMagasin !== undefined ? Number(o.tarifMagasin) : 0;
  if (cols.prixPromo >= 0) rowArr[cols.prixPromo] = o.prixPromo !== '' && o.prixPromo !== null && o.prixPromo !== undefined ? Number(o.prixPromo) : '';
  if (cols.tarifAdherent >= 0) rowArr[cols.tarifAdherent] = o.tarifAdherent !== '' && o.tarifAdherent !== null && o.tarifAdherent !== undefined ? Number(o.tarifAdherent) : '';
  if (cols.excluClub >= 0) rowArr[cols.excluClub] = excluFlag;
  if (cols.taillesDispo >= 0) rowArr[cols.taillesDispo] = safeCellValue(String(o.taillesDispo || '').trim());
  if (cols.description >= 0) rowArr[cols.description] = safeCellValue(String(o.description || '').trim());

  if (matchRowIdx >= 1) {
    sheet.getRange(matchRowIdx + 1, 1, 1, rowArr.length).setValues([rowArr]);
    return createJsonResponse({ success: true, id: id, updated: true });
  }
  sheet.appendRow(rowArr);
  return createJsonResponse({ success: true, id: id, created: true });
}

function handleDeleteGoSportOffre(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Partenaire_GOSport');
  if (!sheet) return createJsonResponse({ success: false, error: 'Onglet Partenaire_GOSport introuvable.' });
  var id = String(payload.id || '').trim();
  var ref = String(payload.reference || '').trim();
  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return createJsonResponse({ success: false, error: 'Produit GO Sport introuvable.' });
  var cols = getGoSportColMap(rows[0]);
  for (var i = 1; i < rows.length; i++) {
    var rId = cols.id >= 0 ? String(rows[i][cols.id] || '').trim() : '';
    var rRef = cols.reference >= 0 ? String(rows[i][cols.reference] || '').trim() : '';
    if ((id && rId && rId === id) || (ref && rRef && rRef === ref)) {
      sheet.deleteRow(i + 1);
      return createJsonResponse({ success: true, id: id || ref });
    }
  }
  return createJsonResponse({ success: false, error: 'Produit GO Sport introuvable.' });
}

function autoriserEnvoiEmails() {
  Logger.log("Quota e-mail restant aujourd'hui : " + MailApp.getRemainingDailyQuota());
}

function normalizePortalLicence(val) {
  return String(val || '').trim().toUpperCase().replace(/[\\s\\-\\.]+/g, '');
}

function extractPortalLicenceDigits(val) {
  return normalizePortalLicence(val).replace(/\\D/g, '').replace(/^0+/, '');
}

function licencesMatchPortal(a, b) {
  var normA = normalizePortalLicence(a);
  var normB = normalizePortalLicence(b);
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  var digA = extractPortalLicenceDigits(normA);
  var digB = extractPortalLicenceDigits(normB);
  if (!digA || digA.length < 4 || digA !== digB) return false;
  var letterA = normA.replace(/[^A-Z]/g, '');
  var letterB = normB.replace(/[^A-Z]/g, '');
  if (letterA && letterB) return letterA === letterB;
  return true;
}

function getPortalOtpCacheKey(normLic) {
  var digits = extractPortalLicenceDigits(normLic);
  return digits.length >= 4 ? digits : normalizePortalLicence(normLic);
}

function normalizePortalEmail(val) {
  return String(val || '').trim().toLowerCase();
}

function maskPortalEmail(email) {
  var parts = normalizePortalEmail(email).split('@');
  if (parts.length !== 2) return '***';
  var local = parts[0];
  var domain = parts[1];
  var visible = local.length <= 2 ? local.charAt(0) : local.slice(0, 2);
  return visible + '***@' + domain;
}

function findAdherentsPortalCols(headersRow) {
  var norm = headersRow.map(function(h) {
    return String(h || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\\u0300-\\u036f]/g, '')
      .trim();
  });
  function findIdx(candidates, fallbackIdx) {
    for (var c = 0; c < candidates.length; c++) {
      for (var i = 0; i < norm.length; i++) {
        if (norm[i] === candidates[c]) return i;
      }
    }
    for (var c2 = 0; c2 < candidates.length; c2++) {
      for (var j = 0; j < norm.length; j++) {
        if (norm[j].indexOf(candidates[c2]) !== -1) return j;
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
  var s = String(rawDate).trim();
  if (/^\\d{4}$/.test(s)) return parseInt(s, 10);
  var frMatch = s.match(/\\b\\d{1,2}[\\/\\-\\.]\\d{1,2}[\\/\\-\\.](\\d{4})\\b/);
  if (frMatch && frMatch[1]) return parseInt(frMatch[1], 10);
  var isoMatch = s.match(/\\b(\\d{4})[\\/\\-\\.]\\d{1,2}[\\/\\-\\.]\\d{1,2}\\b/);
  if (isoMatch && isoMatch[1]) return parseInt(isoMatch[1], 10);
  return null;
}

function findMatchingRowByLicencePortal(rows, cols, inputLic) {
  var normInput = normalizePortalLicence(inputLic);
  for (var i = 1; i < rows.length; i++) {
    var rowLic = normalizePortalLicence(rows[i][cols.licence]);
    if (rowLic && rowLic === normInput) {
      return { rowIndex: i, rowLic: rowLic, row: rows[i] };
    }
  }
  for (var j = 1; j < rows.length; j++) {
    var rowLic2 = normalizePortalLicence(rows[j][cols.licence]);
    if (rowLic2 && licencesMatchPortal(rowLic2, normInput)) {
      return { rowIndex: j, rowLic: rowLic2, row: rows[j] };
    }
  }
  return null;
}

function handleRequestAdherentOtp(payload) {
  var normInputLic = normalizePortalLicence(payload && payload.licence);
  if (!normInputLic || normInputLic.length < 4) {
    return createJsonResponse({ success: false, error: 'Veuillez saisir un numéro de licence valide.' });
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Adhérents');
  if (!sheet) {
    return createJsonResponse({ success: false, error: 'Onglet Adhérents introuvable.' });
  }

  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) {
    return createJsonResponse({ success: false, error: 'Aucun adhérent enregistré.' });
  }

  var cols = findAdherentsPortalCols(rows[0]);
  var match = findMatchingRowByLicencePortal(rows, cols, normInputLic);
  if (!match) {
    return createJsonResponse({ success: false, error: 'Numéro de licence introuvable dans la base du club.' });
  }

  var foundLic = match.rowLic;
  var foundName = String(match.row[cols.nomPrenom] || '').trim();
  var mainEmail = normalizePortalEmail(match.row[cols.email]);
  var altEmail = cols.email2 >= 0 ? normalizePortalEmail(match.row[cols.email2]) : '';
  var foundEmail = mainEmail || altEmail;

  if (!foundEmail || foundEmail.indexOf('@') === -1) {
    return createJsonResponse({
      success: false,
      error: "Aucune adresse e-mail valide n'est associée à cette licence. Contactez le bureau du club."
    });
  }

  var cache = CacheService.getScriptCache();
  var cacheStem = getPortalOtpCacheKey(foundLic);
  var cooldownKey = 'tcm_otp_cd_' + cacheStem;
  if (cache.get(cooldownKey)) {
    return createJsonResponse({
      success: false,
      error: "Un code vient déjà d'être envoyé. Veuillez patienter 60 secondes avant de réessayer."
    });
  }

  var code = String(Math.floor(100000 + Math.random() * 900000));
  var record = {
    code: code,
    licence: foundLic,
    email: foundEmail,
    attempts: 0,
    expiresAt: Date.now() + 600000
  };

  cache.put('tcm_otp_' + cacheStem, JSON.stringify(record), 600);
  cache.put(cooldownKey, '1', 60);

  var clubName = 'Muzillac Tennis Club';
  var cRows = getClubInfoSheetValues();
  for (var k = 1; k < cRows.length; k++) {
    var kStr = String(cRows[k][0] || '').toLowerCase();
    if (kStr === 'nom du club' || kStr === 'nom') {
      if (String(cRows[k][1] || '').trim()) clubName = String(cRows[k][1]).trim();
      break;
    }
  }

  MailApp.sendEmail({
    to: foundEmail,
    subject: '[' + clubName + '] Votre code de connexion Espace Adhérent',
    body:
      'Bonjour' + (foundName ? ' ' + foundName : '') + ',\\n\\n' +
      'Voici votre code unique pour accéder à votre Espace Adhérent (' + clubName + ') :\\n\\n' +
      '    CODE : ' + code + '\\n\\n' +
      'Ce code est valable pendant 10 minutes pour la licence n° ' + foundLic + '.\\n' +
      'Si vous n\\'êtes pas à l\\'origine de cette demande, ignorez ce message.\\n\\n' +
      'Bien sportivement,\\n' +
      clubName
  });

  return createJsonResponse({
    success: true,
    maskedEmail: maskPortalEmail(foundEmail),
    expiresInSeconds: 600
  });
}

function handleVerifyAdherentOtp(payload) {
  var normInputLic = normalizePortalLicence(payload && payload.licence);
  var cleanCode = String((payload && payload.code) || '').replace(/\\D/g, '').trim();

  if (!normInputLic || !/^\\d{6}$/.test(cleanCode)) {
    return createJsonResponse({ success: false, error: 'Numéro de licence ou code à 6 chiffres invalide.' });
  }

  var cache = CacheService.getScriptCache();
  var cacheStem = getPortalOtpCacheKey(normInputLic);
  var otpKey = 'tcm_otp_' + cacheStem;
  var rawRecord = cache.get(otpKey);
  if (!rawRecord) {
    return createJsonResponse({ success: false, error: 'Code expiré ou introuvable. Veuillez demander un nouveau code.' });
  }

  var record = null;
  try {
    record = JSON.parse(rawRecord);
  } catch (e) {
    cache.remove(otpKey);
    return createJsonResponse({ success: false, error: 'Session OTP invalide. Demandez un nouveau code.' });
  }

  if (!record || Date.now() > Number(record.expiresAt || 0)) {
    cache.remove(otpKey);
    return createJsonResponse({ success: false, error: 'Ce code a expiré. Veuillez en demander un nouveau.' });
  }

  if (!licencesMatchPortal(record.licence, normInputLic)) {
    return createJsonResponse({ success: false, error: 'Ce code ne correspond pas au numéro de licence saisi.' });
  }

  var attempts = Number(record.attempts || 0);
  if (attempts >= 5) {
    cache.remove(otpKey);
    return createJsonResponse({ success: false, error: 'Trop de tentatives erronées. Veuillez demander un nouveau code.' });
  }

  if (String(record.code) !== cleanCode) {
    record.attempts = attempts + 1;
    var remainingSec = Math.max(30, Math.floor((Number(record.expiresAt) - Date.now()) / 1000));
    if (record.attempts >= 5) {
      cache.remove(otpKey);
      return createJsonResponse({
        success: false,
        attemptsRemaining: 0,
        error: "Code incorrect. Nombre maximal d'essais atteint, veuillez demander un nouveau code."
      });
    }
    cache.put(otpKey, JSON.stringify(record), remainingSec);
    return createJsonResponse({
      success: false,
      attemptsRemaining: 5 - record.attempts,
      error: 'Code incorrect. Il vous reste ' + (5 - record.attempts) + ' essai(s).'
    });
  }

  cache.remove(otpKey);
  cache.remove('tcm_otp_cd_' + cacheStem);

  var canonicalLic = record.licence || normInputLic;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Adhérents');
  var familyLicences = [];

  if (sheet) {
    var rows = sheet.getDataRange().getValues();
    if (rows.length > 1) {
      var cols = findAdherentsPortalCols(rows[0]);
      for (var i = 1; i < rows.length; i++) {
        var rowLic = normalizePortalLicence(rows[i][cols.licence]);
        var rowEmail = normalizePortalEmail(rows[i][cols.email]);
        var rowEmail2 = cols.email2 >= 0 ? normalizePortalEmail(rows[i][cols.email2]) : '';
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

  var sessionToken = Utilities.getUuid() + '-' + Utilities.getUuid().slice(0, 8);
  var sessionData = {
    verifiedLicence: canonicalLic,
    verifiedEmail: record.email,
    familyLicences: familyLicences,
    createdAt: Date.now()
  };

  cache.put('tcm_adh_sess_' + sessionToken, JSON.stringify(sessionData), 7200);

  return createJsonResponse({
    success: true,
    sessionToken: sessionToken,
    verifiedLicence: canonicalLic,
    verifiedEmail: record.email,
    maskedEmail: maskPortalEmail(record.email),
    familyLicences: familyLicences
  });
}

function handleUpdateMinorParent(payload) {
  var sessionToken = String((payload && payload.sessionToken) || '').trim();
  var normInputLic = normalizePortalLicence(payload && payload.licence);
  var rawParent = String((payload && payload.representantLegal) || '')
    .trim()
    .replace(/^[=+\\-@]+/, '')
    .slice(0, 120);

  if (!sessionToken) {
    return createJsonResponse({ success: false, error: 'Session expirée ou non authentifiée.' });
  }
  if (!normInputLic || !rawParent) {
    return createJsonResponse({ success: false, error: 'Numéro de licence ou nom du parent manquant.' });
  }

  var cache = CacheService.getScriptCache();
  var rawSession = cache.get('tcm_adh_sess_' + sessionToken);
  if (!rawSession) {
    return createJsonResponse({ success: false, error: 'Votre session a expiré. Veuillez vous reconnecter.' });
  }

  var session = null;
  try {
    session = JSON.parse(rawSession);
  } catch (e) {
    return createJsonResponse({ success: false, error: 'Session invalide.' });
  }

  var allowed = Array.isArray(session.familyLicences) ? session.familyLicences : [];
  var isAllowed = allowed.some(function(aLic) {
    return licencesMatchPortal(aLic, normInputLic);
  });
  if (!isAllowed) {
    return createJsonResponse({ success: false, error: 'Accès non autorisé pour ce numéro de licence.' });
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Adhérents');
  if (!sheet) {
    return createJsonResponse({ success: false, error: 'Onglet Adhérents introuvable.' });
  }

  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) {
    return createJsonResponse({ success: false, error: 'Base adhérents vide.' });
  }

  var cols = findAdherentsPortalCols(rows[0]);
  if (cols.representantLegal < 0) {
    return createJsonResponse({ success: false, error: 'Colonne Représentant légal introuvable.' });
  }

  var match = findMatchingRowByLicencePortal(rows, cols, normInputLic);
  if (match) {
    var birthYear = extractBirthYearForPortal(match.row[cols.dateNaiss]);
    var currentSeasonYear = Math.max(2027, new Date().getFullYear());
    if (birthYear && (currentSeasonYear - birthYear) >= 18) {
      return createJsonResponse({
        success: false,
        error: 'La modification du représentant légal est réservée aux adhérents mineurs.'
      });
    }
    sheet.getRange(match.rowIndex + 1, cols.representantLegal + 1).setValue(rawParent);
    return createJsonResponse({
      success: true,
      licence: match.rowLic,
      representantLegal: rawParent
    });
  }

  return createJsonResponse({ success: false, error: 'Adhérent introuvable.' });
}`;

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-3xl bg-[#141820] border border-[#2b3342] rounded-3xl overflow-hidden shadow-2xl my-6 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="p-5 border-b border-[#252b37] flex items-center justify-between bg-[#191e28]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#E65100] text-white flex items-center justify-center shadow-lg shadow-orange-950/60 font-black">
              <FileCode2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-black text-white text-base sm:text-lg">
                Fichiers Google Apps Script & Règles FFT 2027
              </h2>
              <p className="text-xs text-zinc-400">
                Code backend Google Sheets avec module d'éligibilité pour les capitaines
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Onglets de sélection */}
        <div className="px-5 pt-3 pb-2 border-b border-[#252b37] flex items-center justify-between bg-[#11141a]">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveFile('codegs')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeFile === 'codegs'
                  ? 'bg-[#E65100] text-white'
                  : 'text-zinc-400 hover:text-white bg-[#191e28]'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>Code.gs</span>
            </button>

            <button
              onClick={() => setActiveFile('bareme')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeFile === 'bareme'
                  ? 'bg-[#E65100] text-white'
                  : 'text-zinc-400 hover:text-white bg-[#191e28]'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Barème FFT 2027</span>
            </button>

            <button
              onClick={() => setActiveFile('guide')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeFile === 'guide'
                  ? 'bg-[#E65100] text-white'
                  : 'text-zinc-400 hover:text-white bg-[#191e28]'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Guide Déploiement</span>
            </button>
          </div>

          {activeFile === 'codegs' && (
            <button
              onClick={() => handleCopy(CODE_GS_CONTENT)}
              className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-[#FF6D00] border border-orange-500/40 text-xs font-bold transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copié !' : 'Copier le code'}</span>
            </button>
          )}
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-5 text-xs">
          {activeFile === 'codegs' && (
            <pre className="font-mono text-[11px] text-zinc-300 bg-[#0c0e12] p-4 rounded-2xl border border-zinc-800/80 overflow-x-auto leading-relaxed">
              <code>{CODE_GS_CONTENT}</code>
            </pre>
          )}

          {activeFile === 'bareme' && (
            <div className="space-y-4 text-zinc-300">
              <div className="p-4 rounded-2xl bg-[#1a1f29] border border-[#2b3342] space-y-2">
                <h3 className="font-bold text-white text-sm">1. Règle Licence Officielle FFT</h3>
                <p className="text-xs text-zinc-400">
                  Seuls les statuts de licence <strong>C</strong> (Club / Compétition) et <strong>W</strong> (Web Compétition multi-raquettes) permettent d'aligner un joueur en rencontre officielle interclubs. Les licences D (Découverte), S (Scolaire) ou non renouvelées bloquent la sélection.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#1a1f29] border border-[#2b3342] space-y-2">
                <h3 className="font-bold text-white text-sm">2. Règle Sexe / Civilité</h3>
                <p className="text-xs text-zinc-400">
                  Correspondance stricte entre 'Civilité' (Monsieur = H, Madame = F) et 'Sexe de l'homologation' de la rencontre. Une joueuse Madame ne peut être alignée sur une feuille de match Messieurs et inversement (sauf épreuve Mixte).
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#1a1f29] border border-[#2b3342] space-y-2">
                <h3 className="font-bold text-white text-sm">3. Barème des Âges - Millésime FFT 2027</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-black/30 border border-zinc-800">
                    <strong className="text-white">11/12 ans :</strong> nés en 2015 et 2016
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/30 border border-zinc-800">
                    <strong className="text-white">13/14 ans :</strong> nés en 2013 et 2014
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/30 border border-zinc-800">
                    <strong className="text-white">15/16 ans :</strong> nés en 2011 et 2012
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/30 border border-zinc-800">
                    <strong className="text-white">17/18 ans :</strong> nés en 2009 et 2010
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/30 border border-zinc-800">
                    <strong className="text-white">Seniors :</strong> nés en 2008 et avant
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/30 border border-zinc-800">
                    <strong className="text-white">Seniors +35 :</strong> nés entre 1988 et 1992 (et avant)
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/30 border border-zinc-800">
                    <strong className="text-white">Seniors +45 :</strong> nés entre 1978 et 1982 (et avant)
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/30 border border-zinc-800">
                    <strong className="text-white">Seniors +55 :</strong> nés en 1972 et avant
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeFile === 'guide' && (
            <div className="space-y-4 text-zinc-300">
              <div className="p-4 rounded-2xl bg-[#1a1f29] border border-[#2b3342] space-y-2">
                <h3 className="font-bold text-white text-sm">Étape 1 : Préparer le Google Sheets</h3>
                <p className="text-xs text-zinc-400">
                  Dans votre classeur, assurez-vous d'avoir les 2 onglets :
                </p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li><strong className="text-white">Adhérents</strong> : avec colonnes <code>NOM Prénom, Civilité, Date Naiss., Type Licence, Solde dû, Téléphone Portable, Email, Dernier class. tennis, Licence, Age sportif, Groupe enseignement, Compte Ten'UP</code></li>
                  <li><strong className="text-white">Rencontres</strong> : avec colonnes <code>Date de la rencontre, Libellé de l'homologation, Catégorie d'âge de l'homologation, Sexe de l'homologation, Numéro de l'équipe, Club d'accueil nom, Club visiteur nom, Score, Nom capitaine, Portable capitaine, Mail capitaine</code></li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-[#1a1f29] border border-[#2b3342] space-y-2">
                <h3 className="font-bold text-white text-sm">Étape 2 : Coller le code</h3>
                <p className="text-xs text-zinc-400">
                  1. Cliquez sur <strong className="text-white">Extensions &gt; Apps Script</strong>.<br/>
                  2. Remplacez le contenu de <code>Code.gs</code> par le code ci-dessus.<br/>
                  3. Cliquez sur Enregistrer (icône disquette).
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#1a1f29] border border-[#2b3342] space-y-2">
                <h3 className="font-bold text-white text-sm">Étape 3 : Déployer la Web App</h3>
                <p className="text-xs text-zinc-400">
                  1. Cliquez sur <strong className="text-white">Déployer &gt; Nouveau déploiement &gt; Application Web</strong>.<br/>
                  2. Exécuter en tant que : <strong>Moi</strong>.<br/>
                  3. Qui a accès : <strong>Tout le monde</strong>.<br/>
                  4. Collez l'URL obtenue dans l'onglet <em>Infos Club</em> de l'application !
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#252b37] bg-[#11141a] flex items-center justify-between">
          <span className="text-[11px] text-zinc-500">
            Fichier physique sauvegardé sous <code>/Code.gs</code>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition cursor-pointer"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
};
