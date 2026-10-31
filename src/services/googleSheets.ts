import { Adherent, Rencontre, MatchComposition, FrozenPlayerSlot, Enseignant, ClubInfo, ClubTarif } from '../types/tennis';
import { parseAdherentRow, parseRencontreRow } from './sheetParsers';

// URL Google Apps Script Web App (action=getAll / doPost)
export const APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbx5gTcxhLQ1i2ZksvPGzzmJC4YXVvZp5-Rm7C74WZserM5mooPsMB450m128QdHMAV_TQ/exec";
export const TCM_APPS_SCRIPT_URL = APPS_SCRIPT_WEB_APP_URL;

export const TCM_DEFAULT_SHEET_ID = "1FTYPkFaQM-S4UN5i8dL2zKZM4qZqHmckx-RmFxTya80";
export const ADHERENTS_SHEET_TITLE = 'Adhérents';
export const RENCONTRES_SHEET_TITLE = 'Rencontres';
export const COMPOSITIONS_SHEET_TITLE = 'Compositions_Equipes';
export const BUREAU_PROFS_SHEET_TITLE = 'Bureau_Profs';
export const INSTALLATIONS_SHEET_TITLE = 'Installations';
export const COTISATIONS_SHEET_TITLE = 'Cotisations_Tarifs';

export interface GoogleDriveFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface AppsScriptDataResult {
  success?: boolean;
  adherents: Adherent[];
  rencontres: Rencontre[];
  compositionsMap: Map<string, { composition: MatchComposition; frozenSlots: FrozenPlayerSlot[] }>;
  bureau?: {
    president?: { nom: string; tel?: string; email?: string };
    secretaire?: { nom: string; tel?: string; email?: string };
    tresorier?: { nom: string; tel?: string; email?: string };
    enseignants: Enseignant[];
  };
  installations?: string[];
  tarifs?: ClubTarif[];
  raw?: any;
}

// Cache court en mémoire pour éviter les rafales d'appels HTTP simultanés
let cachedRawData: any = null;
let lastFetchTime = 0;

/**
 * Normalisation insensible aux espaces et caractères spéciaux pour la clé de rencontre
 */
export function normalizeSheetMatchKey(str: string): string {
  return (str || '').toLowerCase().replace(/[\s\/\-_]/g, '');
}

/**
 * Parsing des compositions depuis les lignes brutes de l'onglet Compositions_Equipes
 */
function parseCompositionsRows(rows: any[][]): Map<string, { composition: MatchComposition; frozenSlots: FrozenPlayerSlot[] }> {
  const map = new Map<string, { composition: MatchComposition; frozenSlots: FrozenPlayerSlot[] }>();
  if (!rows || rows.length <= 1) return map;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row) || row.length === 0) continue;

    const matchId = String(row[0] || '').trim();
    const dateVal = String(row[1] || '').trim();
    const numEqVal = String(row[2] || '').trim();
    const poste = String(row[8] || '').trim();
    const nomPrenom = String(row[9] || '').trim();
    const licence = String(row[10] || '').trim();
    const classementGele = String(row[11] || '').trim();
    const dateNaissance = String(row[12] || '').trim();
    const ageSportif = String(row[13] || '').trim();
    const typeLicence = String(row[14] || '').trim();

    let heureDebut = '09:00';
    let lieuRencontre = 'Clos des Moines (Muzillac)';
    let nombreCourts = 2;
    let dateEnreg = '';
    let valide = false;

    if (row.length > 17) {
      heureDebut = String(row[15] || '09:00').trim();
      lieuRencontre = String(row[16] || 'Clos des Moines (Muzillac)').trim();
      nombreCourts = parseInt(String(row[17]), 10) || 2;
      dateEnreg = String(row[18] || '').trim();
      valide = String(row[19] || '').toLowerCase() === 'oui' || String(row[19] || '').toLowerCase() === 'true';
    } else {
      dateEnreg = String(row[15] || '').trim();
      valide = String(row[16] || '').toLowerCase() === 'oui' || String(row[16] || '').toLowerCase() === 'true';
    }

    if (!matchId || !poste || !nomPrenom) continue;

    let entry = map.get(matchId);
    if (!entry) {
      entry = {
        composition: {
          valideParCapitaine: valide,
          dateValidation: dateEnreg,
          dateRencontreValidee: dateVal || undefined,
          heureDebut,
          lieuRencontre,
          nombreCourts,
          frozenPlayers: [],
        },
        frozenSlots: [],
      };
      map.set(matchId, entry);
      map.set(normalizeSheetMatchKey(matchId), entry);
      if (dateVal && numEqVal) {
        map.set(`date_${normalizeSheetMatchKey(dateVal)}_eq_${normalizeSheetMatchKey(numEqVal)}`, entry);
      }
    }

    const playerId = licence || nomPrenom;
    const slot: FrozenPlayerSlot = {
      poste,
      adherentId: playerId,
      nomPrenom,
      licence,
      classementGele: classementGele || 'NC',
      dateNaissance,
      ageSportif,
      typeLicence,
    };

    entry.frozenSlots.push(slot);
    if (entry.composition.frozenPlayers) {
      entry.composition.frozenPlayers.push(slot);
    }
  }

  return map;
}

/**
 * Parsing des tarifs depuis les lignes de Cotisations_Tarifs
 */
function parseTarifsRows(rows: any[][]): ClubTarif[] {
  if (!rows || rows.length <= 1) return [];
  const list: ClubTarif[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!Array.isArray(r) || r.length === 0) continue;
    const rawCat = String(r[0] || '').toLowerCase().trim();
    const label = String(r[1] || '').trim();
    const rawMontant = String(r[2] || '').trim();
    const description = String(r[3] || '').trim();

    if (!label) continue;

    const cleanMontant = rawMontant.replace('€', '').replace(/\s+/g, '').replace(',', '.');
    const montant = parseFloat(cleanMontant) || 0;

    let categorie: ClubTarif['categorie'] = 'adulte';
    if (rawCat.includes('jeune') || rawCat.includes('enfant') || rawCat.includes('ado')) {
      categorie = 'jeune';
    } else if (rawCat.includes('compet') || rawCat.includes('compét')) {
      categorie = 'competition';
    } else if (rawCat.includes('adhes') || rawCat.includes('adhés') || rawCat.includes('libre')) {
      categorie = 'adhesion';
    }

    list.push({
      id: `tarif-sheet-${i}`,
      label,
      montant,
      categorie,
      description: description || undefined,
    });
  }
  return list;
}

/**
 * Parsing du Bureau & Enseignants depuis les lignes de Bureau_Profs
 */
function parseBureauRows(rows: any[][]): {
  president?: { nom: string; tel?: string; email?: string };
  secretaire?: { nom: string; tel?: string; email?: string };
  tresorier?: { nom: string; tel?: string; email?: string };
  enseignants: Enseignant[];
} {
  let president = { nom: '', tel: '', email: '' };
  let secretaire = { nom: '', tel: '', email: '' };
  let tresorier = { nom: '', tel: '', email: '' };
  const enseignants: Enseignant[] = [];

  if (!rows || rows.length <= 1) {
    return { enseignants };
  }

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!Array.isArray(r) || r.length === 0) continue;
    const role = String(r[0] || '').toLowerCase().trim();
    const nomPrenom = String(r[1] || '').trim();
    const diplome = String(r[2] || '').trim();
    const tel = String(r[3] || '').trim();
    const email = String(r[4] || '').trim();
    const desc = String(r[5] || '').trim();

    if (!nomPrenom) continue;

    if (role.includes('presid') || role.includes('présid')) {
      president = { nom: nomPrenom, tel, email };
    } else if (role.includes('secr')) {
      secretaire = { nom: nomPrenom, tel, email };
    } else if (role.includes('trésor') || role.includes('tresor')) {
      tresorier = { nom: nomPrenom, tel, email };
    } else if (role.includes('prof') || role.includes('enseign') || role.includes('coach') || role.includes('de') || role.includes('initiateur')) {
      enseignants.push({
        id: `enseignant-${i}`,
        nomPrenom,
        diplome: diplome || "Enseignant diplômé",
        telephone: tel || undefined,
        email: email || undefined,
        description: desc || undefined,
      });
    }
  }

  return {
    president: president.nom ? president : undefined,
    secretaire: secretaire.nom ? secretaire : undefined,
    tresorier: tresorier.nom ? tresorier : undefined,
    enseignants,
  };
}

/**
 * Parsing des installations depuis les lignes de Installations
 */
function parseInstallationsRows(rows: any[][]): string[] {
  if (!rows || rows.length <= 1) return [];
  const list: string[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row) || row.length === 0) continue;
    const label = String(row[0] || '').trim();
    const details = String(row[1] || '').trim();
    const courtStr = details ? `${label} - ${details}` : label;
    if (courtStr) {
      list.push(courtStr);
    }
  }
  return list;
}

/**
 * Récupère l'intégralité des onglets en un seul appel anti-cache vers l'Apps Script
 * et retourne les données déjà typées et prêtes à l'emploi.
 */
export async function fetchAllDataFromAppsScript(appsScriptUrl?: string): Promise<AppsScriptDataResult> {
  const urlToUse = appsScriptUrl || APPS_SCRIPT_WEB_APP_URL;
  const now = Date.now();

  let rawJson: any = null;

  // Cache mémoire de 2 secondes
  if (cachedRawData && (now - lastFetchTime < 2000)) {
    rawJson = cachedRawData;
  } else {
    try {
      const url = `${urlToUse}?action=getAll&_t=${now}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        },
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP Apps Script : ${response.status}`);
      }

      rawJson = await response.json();
      cachedRawData = rawJson;
      lastFetchTime = now;
    } catch (error) {
      console.error("[AppsScript] Erreur lors de la récupération globale :", error);
      return {
        success: false,
        adherents: [],
        rencontres: [],
        compositionsMap: new Map(),
      };
    }
  }

  // 1. Parser Compositions
  const rawComps = rawJson?.compositions || [];
  const compositionsMap = parseCompositionsRows(rawComps);

  // 2. Parser Adhérents
  const adherents: Adherent[] = [];
  const rawAdh = rawJson?.adherents || [];
  if (Array.isArray(rawAdh) && rawAdh.length > 1) {
    // Si c'est un tableau 2D [ [headers...], [row1...], ... ]
    if (Array.isArray(rawAdh[0])) {
      const headers = rawAdh[0].map((h: any) => String(h || '').trim());
      for (let i = 1; i < rawAdh.length; i++) {
        const parsed = parseAdherentRow(rawAdh[i], headers, i);
        if (parsed) adherents.push(parsed);
      }
    } else if (rawAdh[0]?.nomPrenom) {
      // Déjà des objets Adherent
      adherents.push(...rawAdh);
    }
  }

  // 3. Parser Rencontres et attacher les compositions
  const rencontres: Rencontre[] = [];
  const rawRen = rawJson?.rencontres || [];
  if (Array.isArray(rawRen) && rawRen.length > 1) {
    if (Array.isArray(rawRen[0])) {
      const headers = rawRen[0].map((h: any) => String(h || '').trim());
      for (let i = 1; i < rawRen.length; i++) {
        const parsed = parseRencontreRow(rawRen[i], headers, i);
        if (parsed) {
          const compEntry = compositionsMap.get(parsed.id) ||
            compositionsMap.get(normalizeSheetMatchKey(parsed.id)) ||
            (parsed.dateRencontre && parsed.numeroEquipe ? 
              compositionsMap.get(`date_${normalizeSheetMatchKey(parsed.dateRencontre)}_eq_${normalizeSheetMatchKey(parsed.numeroEquipe)}`) : 
              undefined);
          if (compEntry) {
            parsed.composition = compEntry.composition;
          }
          rencontres.push(parsed);
        }
      }
    } else if (rawRen[0]?.numeroEquipe || rawRen[0]?.libelleHomologation) {
      rencontres.push(...rawRen);
    }
  }

  // 4. Parser Bureau & Enseignants
  const rawBureau = rawJson?.bureau || [];
  const bureau = parseBureauRows(rawBureau);

  // 5. Parser Installations
  const rawInst = rawJson?.installations || [];
  const installations = parseInstallationsRows(rawInst);

  // 6. Parser Tarifs
  const rawTarifs = rawJson?.tarifs || [];
  const tarifs = parseTarifsRows(rawTarifs);

  return {
    success: true,
    adherents,
    rencontres,
    compositionsMap,
    bureau,
    installations: installations.length > 0 ? installations : undefined,
    tarifs: tarifs.length > 0 ? tarifs : undefined,
    raw: rawJson,
  };
}

/**
 * Lit les adhérents (via Apps Script ou via Google Sheets API directe si token fourni)
 */
export async function readAdherentsFromSheet(
  spreadsheetId?: string | null,
  accessToken?: string | null,
  sheetTitle: string = ADHERENTS_SHEET_TITLE
): Promise<Adherent[]> {
  if (spreadsheetId && accessToken) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetTitle)}?valueRenderOption=UNFORMATTED_VALUE`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const json = await res.json();
        const rows = json.values || [];
        if (rows.length > 1) {
          const headers = rows[0].map((h: any) => String(h || '').trim());
          const list: Adherent[] = [];
          for (let i = 1; i < rows.length; i++) {
            const p = parseAdherentRow(rows[i], headers, i);
            if (p) list.push(p);
          }
          return list;
        }
      }
    } catch (e) {
      console.warn("Erreur fetch Adhérents Google Sheets API:", e);
    }
  }

  const all = await fetchAllDataFromAppsScript();
  return all.adherents;
}

/**
 * Lit les rencontres (via Apps Script ou via Google Sheets API directe si token fourni)
 */
export async function readRencontresFromSheet(
  spreadsheetId?: string | null,
  accessToken?: string | null,
  sheetTitle: string = RENCONTRES_SHEET_TITLE
): Promise<Rencontre[]> {
  if (spreadsheetId && accessToken) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetTitle)}?valueRenderOption=UNFORMATTED_VALUE`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const json = await res.json();
        const rows = json.values || [];
        if (rows.length > 1) {
          const headers = rows[0].map((h: any) => String(h || '').trim());
          const list: Rencontre[] = [];
          for (let i = 1; i < rows.length; i++) {
            const p = parseRencontreRow(rows[i], headers, i);
            if (p) list.push(p);
          }
          return list;
        }
      }
    } catch (e) {
      console.warn("Erreur fetch Rencontres Google Sheets API:", e);
    }
  }

  const all = await fetchAllDataFromAppsScript();
  return all.rencontres;
}

/**
 * Lit les compositions d'équipes
 */
export async function readCompositionsFromSheet(
  spreadsheetId?: string | null,
  accessToken?: string | null
): Promise<Map<string, { composition: MatchComposition; frozenSlots: FrozenPlayerSlot[] }>> {
  if (spreadsheetId && accessToken) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(COMPOSITIONS_SHEET_TITLE)}?valueRenderOption=UNFORMATTED_VALUE`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const json = await res.json();
        const rows = json.values || [];
        return parseCompositionsRows(rows);
      }
    } catch (e) {
      console.warn("Erreur fetch Compositions Google Sheets API:", e);
    }
  }

  const all = await fetchAllDataFromAppsScript();
  return all.compositionsMap;
}

/**
 * Lit les tarifs
 */
export async function readTarifsFromSheet(): Promise<ClubTarif[] | null> {
  const all = await fetchAllDataFromAppsScript();
  return all.tarifs || null;
}

/**
 * Lit le bureau et les profs
 */
export async function readBureauProfsFromSheet(): Promise<{
  president?: { nom: string; tel?: string; email?: string };
  secretaire?: { nom: string; tel?: string; email?: string };
  tresorier?: { nom: string; tel?: string; email?: string };
  enseignants: Enseignant[];
} | null> {
  const all = await fetchAllDataFromAppsScript();
  return all.bureau || null;
}

/**
 * Lit les installations
 */
export async function readInstallationsFromSheet(): Promise<string[] | null> {
  const all = await fetchAllDataFromAppsScript();
  return all.installations || null;
}

/**
 * Sauvegarde une composition d'équipe vers le Web App Apps Script via HTTP POST JSON
 */
export async function saveCompositionViaAppsScript(
  rencontre: Rencontre,
  composition: MatchComposition,
  adherentsById: Map<string, Adherent>,
  appsScriptUrl: string = APPS_SCRIPT_WEB_APP_URL
): Promise<{ success: boolean; rowsSaved?: number; error?: string }> {
  try {
    const slots: Array<{
      poste: string;
      nomPrenom: string;
      licence: string;
      classementGele: string;
      dateNaissance: string;
      ageSportif: string;
      typeLicence: string;
    }> = [];

    const slotDefinitions = [
      { key: 'simple1Id', label: 'Simple 1' },
      { key: 'simple2Id', label: 'Simple 2' },
      { key: 'simple3Id', label: 'Simple 3' },
      { key: 'simple4Id', label: 'Simple 4' },
      { key: 'simple5Id', label: 'Simple 5' },
      { key: 'double1Player1Id', label: 'Double 1 (J1)' },
      { key: 'double1Player2Id', label: 'Double 1 (J2)' },
      { key: 'double2Player1Id', label: 'Double 2 (J1)' },
      { key: 'double2Player2Id', label: 'Double 2 (J2)' },
    ];

    slotDefinitions.forEach(({ key, label }) => {
      const playerId = (composition as any)[key];
      if (playerId) {
        const adh = adherentsById.get(playerId);
        slots.push({
          poste: label,
          nomPrenom: adh?.nomPrenom || playerId,
          licence: adh?.licence || '',
          classementGele: adh?.dernierClassTennis || 'NC',
          dateNaissance: adh?.dateNaissance || '',
          ageSportif: adh?.ageSportif || '',
          typeLicence: adh?.typeLicence || 'C',
        });
      }
    });

    // Si des slots gelés existent déjà dans la composition
    if (slots.length === 0 && composition.frozenPlayers && composition.frozenPlayers.length > 0) {
      composition.frozenPlayers.forEach(fp => {
        slots.push({
          poste: fp.poste,
          nomPrenom: fp.nomPrenom,
          licence: fp.licence || '',
          classementGele: fp.classementGele || 'NC',
          dateNaissance: fp.dateNaissance || '',
          ageSportif: fp.ageSportif || '',
          typeLicence: fp.typeLicence || 'C',
        });
      });
    }

    const payload = {
      action: 'saveComposition',
      rencontreId: rencontre.id,
      dateRencontre: composition.dateRencontreValidee || rencontre.dateRencontre,
      numeroEquipe: rencontre.numeroEquipe,
      libelleHomologation: rencontre.libelleHomologation,
      categorieAgeHomologation: rencontre.categorieAgeHomologation,
      sexeHomologation: rencontre.sexeHomologation,
      clubAccueilNom: rencontre.clubAccueilNom,
      clubVisiteurNom: rencontre.clubVisiteurNom,
      heureDebut: composition.heureDebut || '09:00',
      lieuRencontre: composition.lieuRencontre || 'Clos des Moines (Muzillac)',
      nombreCourts: composition.nombreCourts || 2,
      dateValidation: composition.dateValidation || new Date().toLocaleDateString('fr-FR'),
      valideParCapitaine: composition.valideParCapitaine ?? true,
      slots,
    };

    const targetUrl = appsScriptUrl || APPS_SCRIPT_WEB_APP_URL;
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Erreur HTTP lors de l'enregistrement Apps Script : ${res.status}`);
    }

    const result = await res.json().catch(() => ({ success: true, rowsSaved: slots.length }));
    return {
      success: true,
      rowsSaved: result?.rowsSaved ?? slots.length,
    };
  } catch (err: any) {
    console.error('Erreur saveCompositionViaAppsScript:', err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Sauvegarde des informations du club via HTTP POST vers Apps Script
 */
export async function saveClubInfoViaAppsScript(
  clubInfo: ClubInfo,
  appsScriptUrl: string = APPS_SCRIPT_WEB_APP_URL
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = {
      action: 'saveClubInfo',
      clubInfo: {
        president: clubInfo.president,
        presidentTelephone: clubInfo.presidentTelephone,
        presidentEmail: clubInfo.presidentEmail,
        secretaire: clubInfo.secretaire,
        secretaireTelephone: clubInfo.secretaireTelephone,
        secretaireEmail: clubInfo.secretaireEmail,
        tresorier: clubInfo.tresorier,
        tresorierTelephone: clubInfo.tresorierTelephone,
        tresorierEmail: clubInfo.tresorierEmail,
        enseignants: clubInfo.enseignants,
      },
    };

    const targetUrl = appsScriptUrl || APPS_SCRIPT_WEB_APP_URL;
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Erreur HTTP sauvegarde ClubInfo : ${res.status}`);
    }

    return { success: true };
  } catch (err: any) {
    console.error('Erreur saveClubInfoViaAppsScript:', err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Sauvegarde une composition dans la feuille Google Sheet (supporte Apps Script et Google Sheets API direct)
 */
export async function saveCompositionToSheet(
  spreadsheetId: string | null | undefined,
  rencontre: Rencontre,
  composition: MatchComposition,
  adherentsById: Map<string, Adherent>,
  accessToken?: string | null
): Promise<{ success: boolean; rowsSaved: number }> {
  // Envoi prioritaire ou parallèle vers l'Apps Script
  const appsScriptRes = await saveCompositionViaAppsScript(rencontre, composition, adherentsById);

  // Si on a un jeton Google Sheets API et un ID de feuille
  if (spreadsheetId && accessToken) {
    try {
      const slotDefinitions = [
        { key: 'simple1Id', label: 'Simple 1' },
        { key: 'simple2Id', label: 'Simple 2' },
        { key: 'simple3Id', label: 'Simple 3' },
        { key: 'simple4Id', label: 'Simple 4' },
        { key: 'simple5Id', label: 'Simple 5' },
        { key: 'double1Player1Id', label: 'Double 1 (J1)' },
        { key: 'double1Player2Id', label: 'Double 1 (J2)' },
        { key: 'double2Player1Id', label: 'Double 2 (J1)' },
        { key: 'double2Player2Id', label: 'Double 2 (J2)' },
      ];

      const rowsToAppend: any[][] = [];
      const nowStr = composition.dateValidation || new Date().toLocaleDateString('fr-FR');

      slotDefinitions.forEach(({ key, label }) => {
        const playerId = (composition as any)[key];
        if (playerId) {
          const adh = adherentsById.get(playerId);
          rowsToAppend.push([
            rencontre.id,
            composition.dateRencontreValidee || rencontre.dateRencontre,
            rencontre.numeroEquipe,
            rencontre.libelleHomologation,
            rencontre.categorieAgeHomologation,
            rencontre.sexeHomologation,
            rencontre.clubAccueilNom,
            rencontre.clubVisiteurNom,
            label,
            adh?.nomPrenom || playerId,
            adh?.licence || '',
            adh?.dernierClassTennis || 'NC',
            adh?.dateNaissance || '',
            adh?.ageSportif || '',
            adh?.typeLicence || 'C',
            composition.heureDebut || '09:00',
            composition.lieuRencontre || 'Clos des Moines (Muzillac)',
            composition.nombreCourts || 2,
            nowStr,
            composition.valideParCapitaine ? 'OUI' : 'NON',
          ]);
        }
      });

      if (rowsToAppend.length > 0) {
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(COMPOSITIONS_SHEET_TITLE)}:append?valueInputOption=USER_ENTERED`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ values: rowsToAppend }),
          }
        );
      }
    } catch (e) {
      console.warn("Erreur complémentaire direct GSheets API append:", e);
    }
  }

  return {
    success: true,
    rowsSaved: appsScriptRes.rowsSaved || 1,
  };
}

/**
 * Sauvegarde les infos du club (supporte Apps Script et Google Sheets API direct)
 */
export async function saveClubInfoToSheet(
  clubInfo: ClubInfo,
  spreadsheetId: string = TCM_DEFAULT_SHEET_ID,
  accessToken?: string | null
): Promise<{ success: boolean; error?: string }> {
  const scriptRes = await saveClubInfoViaAppsScript(clubInfo);

  if (spreadsheetId && accessToken) {
    try {
      const bRows = [
        ["Rôle / Fonction", "Nom Prénom", "Diplôme / Titre", "Téléphone", "Email", "Description / Missions"],
        ["Président", clubInfo.president || "", "Dirigeant", clubInfo.presidentTelephone || "", clubInfo.presidentEmail || "", "Direction du club"],
        ["Secrétaire", clubInfo.secretaire || "", "Dirigeante", clubInfo.secretaireTelephone || "", clubInfo.secretaireEmail || "", "Secrétariat et licences"],
        ["Trésorier", clubInfo.tresorier || "", "Dirigeant", clubInfo.tresorierTelephone || "", clubInfo.tresorierEmail || "", "Comptabilité et finances"],
      ];
      (clubInfo.enseignants || []).forEach(p => {
        bRows.push(["Enseignant", p.nomPrenom, p.diplome, p.telephone || "", p.email || "", p.description || ""]);
      });

      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(BUREAU_PROFS_SHEET_TITLE)}!A1:F${bRows.length}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: bRows }),
        }
      );
    } catch (e: any) {
      console.warn("Erreur mise à jour Bureau_Profs direct Sheets API:", e);
      return { success: false, error: e.message || String(e) };
    }
  }

  return scriptRes;
}

/**
 * Recherche les fichiers "Données_appli" sur le Google Drive de l'utilisateur
 */
export async function searchDonneesAppliFiles(accessToken: string): Promise<GoogleDriveFile[]> {
  try {
    const query = encodeURIComponent("name contains 'Données_appli' or name contains 'Donnees_appli' and mimeType = 'application/vnd.google-apps.spreadsheet'");
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime,webViewLink)&pageSize=20`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.files || [];
  } catch (err) {
    console.warn("Erreur recherche Drive:", err);
    return [];
  }
}

/**
 * Récupère la liste des onglets d'un classeur Google Sheets
 */
export async function getSpreadsheetTabs(spreadsheetId: string, accessToken: string): Promise<string[]> {
  try {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.sheets || []).map((s: any) => s.properties?.title || '').filter(Boolean);
  } catch (err) {
    console.warn("Erreur récupération onglets:", err);
    return [];
  }
}