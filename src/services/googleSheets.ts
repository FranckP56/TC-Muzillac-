import { Adherent, Rencontre, MatchComposition, FrozenPlayerSlot, Enseignant, ClubInfo, ClubTarif } from '../types/tennis';
import { parseAdherentRow, parseRencontreRow } from './sheetParsers';

export interface GoogleDriveFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export const TCM_DEFAULT_SHEET_ID = "1FTYPkFaQM-S4UN5i8dL2zKZM4qZqHmckx-RmFxTya80";
export const ADHERENTS_SHEET_TITLE = 'Adhérents';
export const RENCONTRES_SHEET_TITLE = 'Rencontres';
export const COMPOSITIONS_SHEET_TITLE = 'Compositions_Equipes';
export const BUREAU_PROFS_SHEET_TITLE = 'Bureau_Profs';
export const INSTALLATIONS_SHEET_TITLE = 'Installations';
export const COTISATIONS_SHEET_TITLE = 'Cotisations_Tarifs';

export const COMPOSITIONS_HEADERS = [
  "ID Rencontre",
  "Date Rencontre",
  "Numéro Équipe",
  "Homologation",
  "Catégorie",
  "Sexe",
  "Club Accueil",
  "Club Visiteur",
  "Poste",
  "Nom Prénom Joueur",
  "N° Licence",
  "Classement Gelé au Match",
  "Date Naissance",
  "Âge Sportif",
  "Type Licence",
  "Heure Début",
  "Lieu Rencontre",
  "Nombre Courts",
  "Date Enregistrement",
  "Validé par Capitaine"
];

/**
 * Normalisation insensible aux espaces, slashes et tirets pour garantir le matching d'identifiants
 */
export function normalizeSheetMatchKey(str: string): string {
  return (str || '').toLowerCase().replace(/[\s\/\-_]/g, '');
}

/**
 * Parseur CSV robuste pour flux Google Sheets (GViz CSV)
 */
export function parseCSVToArray(text: string): string[][] {
  if (!text) return [];
  const lines = text.split(/\r\n|\n/);
  return lines
    .filter(line => line.trim() !== "")
    .map(line => {
      const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
      return matches.map(val => {
        return val
          .replace(/^"|"$/g, '')
          .replace(/""/g, '"')
          .trim();
      });
    });
}

/**
 * Fonction universelle anti-cache pour récupérer le flux CSV d'un onglet public ou partagé (Vercel & Next.js compliant)
 */
export async function fetchSheetTabValues(tabName: string, sheetId: string = TCM_DEFAULT_SHEET_ID): Promise<string[][]> {
  try {
    const timestamp = Date.now();
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}&_t=${timestamp}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0"
      },
      cache: "no-store",
      // @ts-ignore
      next: { revalidate: 0 }
    });

    if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
    const csvText = await response.text();
    return parseCSVToArray(csvText);
  } catch (error) {
    console.warn(`[GoogleSheets] Échec lecture CSV sur l'onglet ${tabName}:`, error);
    return [];
  }
}

/**
 * Recherche les classeurs Google Sheets correspondant à "Données_appli" sur Google Drive
 */
export async function searchDonneesAppliFiles(accessToken?: string): Promise<GoogleDriveFile[]> {
  if (!accessToken) {
    return [{ id: TCM_DEFAULT_SHEET_ID, name: "Données_appli" }];
  }

  try {
    const query = encodeURIComponent("name contains 'Données_appli' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime,webViewLink)&orderBy=modifiedTime desc&pageSize=10`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (res.ok) {
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        return data.files;
      }
    }

    const fallbackQuery = encodeURIComponent("name contains 'Donn' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
    const fallbackRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${fallbackQuery}&fields=files(id,name,modifiedTime,webViewLink)&orderBy=modifiedTime desc&pageSize=10`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (fallbackRes.ok) {
      const fallbackData = await fallbackRes.json();
      if (fallbackData.files && fallbackData.files.length > 0) {
        return fallbackData.files;
      }
    }

    return [{ id: TCM_DEFAULT_SHEET_ID, name: "Données_appli" }];
  } catch (error) {
    console.error('Erreur recherche Données_appli:', error);
    return [{ id: TCM_DEFAULT_SHEET_ID, name: "Données_appli" }];
  }
}

/**
 * Récupère la liste des onglets d'un tableur Google Sheets
 */
export async function getSpreadsheetTabs(spreadsheetId: string = TCM_DEFAULT_SHEET_ID, accessToken?: string): Promise<string[]> {
  if (!accessToken) {
    return ["Adhérents", "Rencontres", COMPOSITIONS_SHEET_TITLE, BUREAU_PROFS_SHEET_TITLE, INSTALLATIONS_SHEET_TITLE];
  }

  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!res.ok) {
      return ["Adhérents", "Rencontres", COMPOSITIONS_SHEET_TITLE, BUREAU_PROFS_SHEET_TITLE, INSTALLATIONS_SHEET_TITLE];
    }

    const data = await res.json();
    return (data.sheets || []).map((s: any) => s.properties?.title || '').filter(Boolean);
  } catch {
    return ["Adhérents", "Rencontres", COMPOSITIONS_SHEET_TITLE, BUREAU_PROFS_SHEET_TITLE, INSTALLATIONS_SHEET_TITLE];
  }
}

/**
 * Lit les adhérents directement dans l'onglet 'Adhérents'
 */
export async function readAdherentsFromSheet(
  spreadsheetId: string = TCM_DEFAULT_SHEET_ID, 
  accessToken?: string,
  sheetTitle: string = 'Adhérents'
): Promise<Adherent[]> {
  let rows: string[][] = [];

  if (accessToken) {
    try {
      const range = encodeURIComponent(`'${sheetTitle}'!A1:ZZ`);
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (res.ok) {
        const data = await res.json();
        rows = data.values || [];
      }
    } catch (e) {
      console.warn("Échec lecture adhérents via API, tentative GViz...", e);
    }
  }

  if (rows.length === 0) {
    rows = await fetchSheetTabValues(sheetTitle, spreadsheetId);
  }

  if (rows.length <= 1) return [];

  const headers = rows[0].map(h => String(h || '').trim());
  const adherents: Adherent[] = [];

  for (let i = 1; i < rows.length; i++) {
    const parsed = parseAdherentRow(rows[i], headers, i);
    if (parsed) adherents.push(parsed);
  }

  return adherents;
}

/**
 * Lit les rencontres directement dans l'onglet 'Rencontres'
 */
export async function readRencontresFromSheet(
  spreadsheetId: string = TCM_DEFAULT_SHEET_ID, 
  accessToken?: string,
  sheetTitle: string = 'Rencontres'
): Promise<Rencontre[]> {
  let rows: string[][] = [];

  if (accessToken) {
    try {
      const range = encodeURIComponent(`'${sheetTitle}'!A1:ZZ`);
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (res.ok) {
        const data = await res.json();
        rows = data.values || [];
      }
    } catch (e) {
      console.warn("Échec lecture rencontres via API, tentative GViz...", e);
    }
  }

  if (rows.length === 0) {
    rows = await fetchSheetTabValues(sheetTitle, spreadsheetId);
  }

  if (rows.length <= 1) return [];

  const headers = rows[0].map(h => String(h || '').trim());
  const rencontres: Rencontre[] = [];

  for (let i = 1; i < rows.length; i++) {
    const parsed = parseRencontreRow(rows[i], headers, i);
    if (parsed) rencontres.push(parsed);
  }

  return rencontres;
}

/**
 * S'assure qu'un onglet existe dans le Google Sheet
 */
export async function ensureSheetTab(spreadsheetId: string, sheetTitle: string, headers: string[], accessToken: string): Promise<void> {
  const tabs = await getSpreadsheetTabs(spreadsheetId, accessToken);
  if (tabs.includes(sheetTitle)) return;

  const addSheetRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetTitle,
                gridProperties: { frozenRowCount: 1 },
                tabColor: { red: 0.9, green: 0.32, blue: 0.0 },
              },
            },
          },
        ],
      }),
    }
  );

  if (addSheetRes.ok && headers.length > 0) {
    const range = encodeURIComponent(`'${sheetTitle}'!A1:ZZ1`);
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [headers] }),
      }
    );
  }
}

export async function ensureCompositionsSheet(spreadsheetId: string, accessToken: string): Promise<void> {
  return ensureSheetTab(spreadsheetId, COMPOSITIONS_SHEET_TITLE, COMPOSITIONS_HEADERS, accessToken);
}

/**
 * Lit les compositions enregistrées avec classements gelés (Totalement anti-cache)
 */
export async function readCompositionsFromSheet(
  spreadsheetId: string = TCM_DEFAULT_SHEET_ID,
  accessToken?: string
): Promise<Map<string, { composition: MatchComposition; frozenSlots: FrozenPlayerSlot[] }>> {
  const map = new Map<string, { composition: MatchComposition; frozenSlots: FrozenPlayerSlot[] }>();

  try {
    let rows: string[][] = [];
    if (accessToken) {
      const range = encodeURIComponent(`'${COMPOSITIONS_SHEET_TITLE}'!A1:T`);
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?_t=${Date.now()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
          cache: 'no-store',
          // @ts-ignore
          next: { revalidate: 0 },
        }
      );
      if (res.ok) {
        const data = await res.json();
        rows = data.values || [];
      }
    }

    if (rows.length === 0) {
      rows = await fetchSheetTabValues(COMPOSITIONS_SHEET_TITLE, spreadsheetId);
    }

    if (rows.length <= 1) return map;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
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
        // Indexation multiple pour matching immédiat et infaillible
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
        classementGele,
        dateNaissance,
        ageSportif,
        typeLicence,
      };

      entry.frozenSlots.push(slot);
      if (entry.composition.frozenPlayers) {
        entry.composition.frozenPlayers.push(slot);
      }

      // Assignation directe des slots sur l'objet composition
      const normPoste = poste.toLowerCase();
      if (normPoste.includes('simple 1') || normPoste === 's1') entry.composition.simple1Id = playerId;
      else if (normPoste.includes('simple 2') || normPoste === 's2') entry.composition.simple2Id = playerId;
      else if (normPoste.includes('simple 3') || normPoste === 's3') entry.composition.simple3Id = playerId;
      else if (normPoste.includes('simple 4') || normPoste === 's4') entry.composition.simple4Id = playerId;
      else if (normPoste.includes('simple 5') || normPoste === 's5') entry.composition.simple5Id = playerId;
      else if (normPoste.includes('double 1') && (normPoste.includes('j1') || normPoste.endsWith('(j1)') || normPoste.includes('1)'))) entry.composition.double1Player1Id = playerId;
      else if (normPoste.includes('double 1') && (normPoste.includes('j2') || normPoste.endsWith('(j2)') || normPoste.includes('2)'))) entry.composition.double1Player2Id = playerId;
      else if (normPoste.includes('double 2') && (normPoste.includes('j1') || normPoste.endsWith('(j1)') || normPoste.includes('1)'))) entry.composition.double2Player1Id = playerId;
      else if (normPoste.includes('double 2') && (normPoste.includes('j2') || normPoste.endsWith('(j2)') || normPoste.includes('2)'))) entry.composition.double2Player2Id = playerId;
    }
  } catch (err) {
    console.warn('Lecture compositions gelées:', err);
  }

  return map;
}

/**
 * Enregistre définitivement une composition d'équipe
 */
export async function saveCompositionToSheet(
  spreadsheetId: string = TCM_DEFAULT_SHEET_ID,
  rencontre: Rencontre,
  composition: MatchComposition,
  adherentsById: Map<string, Adherent>,
  accessToken?: string
): Promise<{ success: boolean; rowsSaved: number; error?: string }> {
  try {
    const now = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const slotsToSave: { poste: string; playerId?: string }[] = [
      { poste: 'Simple 1', playerId: composition.simple1Id },
      { poste: 'Simple 2', playerId: composition.simple2Id },
      { poste: 'Simple 3', playerId: composition.simple3Id },
      { poste: 'Simple 4', playerId: composition.simple4Id },
      { poste: 'Simple 5', playerId: composition.simple5Id },
      { poste: 'Double 1 (J1)', playerId: composition.double1Player1Id },
      { poste: 'Double 1 (J2)', playerId: composition.double1Player2Id },
      { poste: 'Double 2 (J1)', playerId: composition.double2Player1Id },
      { poste: 'Double 2 (J2)', playerId: composition.double2Player2Id },
    ];

    const newRows: any[][] = [];
    const frozenList: FrozenPlayerSlot[] = [];

    for (const item of slotsToSave) {
      if (!item.playerId) continue;
      const player = adherentsById.get(item.playerId);
      if (!player) continue;

      const classementGele = player.dernierClassTennis || 'NC';
      const licence = player.licence || '';
      const dateNaiss = player.dateNaissance || '';
      const ageSportif = player.ageSportif || '';
      const typeLicence = player.typeLicence || '';

      frozenList.push({
        poste: item.poste,
        adherentId: player.id,
        nomPrenom: player.nomPrenom,
        licence,
        classementGele,
        dateNaissance: dateNaiss,
        ageSportif,
        typeLicence,
      });

      newRows.push([
        rencontre.id,
        composition.dateRencontreValidee || rencontre.dateRencontre,
        rencontre.numeroEquipe,
        rencontre.libelleHomologation || '',
        rencontre.categorieAgeHomologation || '',
        rencontre.sexeHomologation || '',
        rencontre.clubAccueilNom || '',
        rencontre.clubVisiteurNom || '',
        item.poste,
        player.nomPrenom,
        licence,
        classementGele,
        dateNaiss,
        ageSportif,
        typeLicence,
        composition.heureDebut || '09:00',
        composition.lieuRencontre || 'Clos des Moines (Muzillac)',
        composition.nombreCourts || 2,
        composition.dateValidation || now,
        composition.valideParCapitaine ? 'OUI' : 'NON',
      ]);
    }

    if (newRows.length === 0) {
      return { success: false, rowsSaved: 0, error: 'Aucun joueur désigné' };
    }

    if (accessToken) {
      await ensureCompositionsSheet(spreadsheetId, accessToken);
      const readRange = encodeURIComponent(`'${COMPOSITIONS_SHEET_TITLE}'!A1:T`);
      const currentSheetRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${readRange}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      let existingRows: any[][] = [];
      if (currentSheetRes.ok) {
        const currentData = await currentSheetRes.json();
        existingRows = currentData.values || [];
      }

      const headerRow = existingRows.length > 0 ? existingRows[0] : COMPOSITIONS_HEADERS;
      const filteredRows = existingRows.slice(1).filter(r => String(r[0] || '').trim() !== String(rencontre.id).trim());
      const allUpdatedRows = [headerRow, ...filteredRows, ...newRows];

      const clearRange = encodeURIComponent(`'${COMPOSITIONS_SHEET_TITLE}'!A1:T`);
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${clearRange}:clear`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      );

      const writeRange = encodeURIComponent(`'${COMPOSITIONS_SHEET_TITLE}'!A1:T${allUpdatedRows.length}`);
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${writeRange}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: allUpdatedRows }),
        }
      );
    }

    composition.frozenPlayers = frozenList;
    return { success: true, rowsSaved: newRows.length };
  } catch (error: any) {
    console.error('[GoogleSheets] Erreur saveComposition:', error);
    return { success: false, rowsSaved: 0, error: error.message };
  }
}

/**
 * =========================================================================
 * NOUVEAUX ONGLETS DYNAMIQUES : BUREAU_PROFS & INSTALLATIONS
 * =========================================================================
 */

export const BUREAU_PROFS_HEADERS = [
  "Rôle / Fonction",
  "Nom Prénom",
  "Diplôme / Titre",
  "Téléphone",
  "Email",
  "Description / Missions"
];

export const INSTALLATIONS_HEADERS = [
  "Nom Installation",
  "Type Court",
  "Surface",
  "Éclairage",
  "Adresse / Lieu",
  "Détails / Remarques"
];

export const COTISATIONS_HEADERS = [
  "Catégorie",
  "Intitulé Formule / Tarif",
  "Montant (€)",
  "Description"
];

/**
 * Lit l'onglet 'Cotisations_Tarifs' (ou 'Tarifs') depuis le Google Sheet
 */
export async function readTarifsFromSheet(
  spreadsheetId: string = TCM_DEFAULT_SHEET_ID,
  accessToken?: string
): Promise<ClubTarif[] | null> {
  try {
    let rows = await fetchSheetTabValues(COTISATIONS_SHEET_TITLE, spreadsheetId);
    if (!rows || rows.length <= 1) {
      rows = await fetchSheetTabValues('Tarifs', spreadsheetId);
    }
    if (!rows || rows.length <= 1) return null;

    const list: ClubTarif[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const rawCat = (r[0] || '').toLowerCase().trim();
      const label = (r[1] || '').trim();
      const rawMontant = (r[2] || '').trim();
      const description = (r[3] || '').trim();

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
      } else {
        categorie = 'adulte';
      }

      // Règle de salubrité : si le libellé mentionne explicitement adulte/senior/majeur, ne jamais laisser 'jeune'
      if (categorie === 'jeune' && /adulte|senior|majeur/i.test(label)) {
        categorie = /adh[eé]sion/i.test(label) && !/cours|collectif|entrain/i.test(label) ? 'adhesion' : 'adulte';
      }

      list.push({
        id: `tarif-sheet-${i}`,
        label,
        montant,
        categorie,
        description: description || undefined,
      });
    }

    return list.length > 0 ? list : null;
  } catch (err) {
    console.warn("Erreur lecture Cotisations_Tarifs depuis Google Sheet:", err);
    return null;
  }
}

/**
 * Lit l'onglet 'Bureau_Profs' depuis le Google Sheet
 */
export async function readBureauProfsFromSheet(
  spreadsheetId: string = TCM_DEFAULT_SHEET_ID,
  accessToken?: string
): Promise<{
  president?: { nom: string; tel?: string; email?: string };
  secretaire?: { nom: string; tel?: string; email?: string };
  tresorier?: { nom: string; tel?: string; email?: string };
  enseignants: Enseignant[];
} | null> {
  try {
    const rows = await fetchSheetTabValues(BUREAU_PROFS_SHEET_TITLE, spreadsheetId);
    if (!rows || rows.length <= 1) return null;

    let president = { nom: '', tel: '', email: '' };
    let secretaire = { nom: '', tel: '', email: '' };
    let tresorier = { nom: '', tel: '', email: '' };
    const enseignants: Enseignant[] = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const role = (r[0] || '').toLowerCase().trim();
      const nomPrenom = (r[1] || '').trim();
      const diplome = (r[2] || '').trim();
      const tel = (r[3] || '').trim();
      const email = (r[4] || '').trim();
      const desc = (r[5] || '').trim();

      if (!nomPrenom) continue;

      if (role.includes('presid') || role.includes('présid')) {
        president = { nom: nomPrenom, tel, email };
      } else if (role.includes('secr')) {
        secretaire = { nom: nomPrenom, tel, email };
      } else if (role.includes('trésor') || role.includes('tresor')) {
        tresorier = { nom: nomPrenom, tel, email };
      } else if (role.includes('prof') || role.includes('enseign') || role.includes('coach') || diplome) {
        enseignants.push({
          id: `prof-${i}`,
          nomPrenom,
          diplome: diplome || "Diplômé d'État (DE)",
          telephone: tel,
          email,
          description: desc,
        });
      }
    }

    return {
      president: president.nom ? president : undefined,
      secretaire: secretaire.nom ? secretaire : undefined,
      tresorier: tresorier.nom ? tresorier : undefined,
      enseignants,
    };
  } catch (err) {
    console.warn("Erreur lecture Bureau_Profs depuis Google Sheet:", err);
    return null;
  }
}

/**
 * Lit l'onglet 'Installations' depuis le Google Sheet
 */
export async function readInstallationsFromSheet(
  spreadsheetId: string = TCM_DEFAULT_SHEET_ID,
  accessToken?: string
): Promise<string[] | null> {
  try {
    const rows = await fetchSheetTabValues(INSTALLATIONS_SHEET_TITLE, spreadsheetId);
    if (!rows || rows.length <= 1) return null;

    const list: string[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const nom = (r[0] || '').trim();
      const type = (r[1] || '').trim();
      const surface = (r[2] || '').trim();
      const lieu = (r[4] || '').trim();
      const details = (r[5] || '').trim();

      if (!nom) continue;

      let label = nom;
      if (surface || type) {
        label += ` (${[type, surface].filter(Boolean).join(', ')})`;
      }
      if (lieu) {
        label += ` - ${lieu}`;
      }
      if (details) {
        label += ` [${details}]`;
      }
      list.push(label);
    }

    return list.length > 0 ? list : null;
  } catch (err) {
    console.warn("Erreur lecture Installations depuis Google Sheet:", err);
    return null;
  }
}

/**
 * Enregistre les informations du club dans Google Sheets via API REST ou webhook Apps Script
 */
export async function saveClubInfoToSheet(
  clubInfo: ClubInfo,
  spreadsheetId: string = TCM_DEFAULT_SHEET_ID,
  accessToken?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!accessToken) {
      return { success: false, error: 'NO_AUTH' };
    }

    // 1. Sauvegarde dans l'onglet Bureau_Profs
    await ensureSheetTab(spreadsheetId, BUREAU_PROFS_SHEET_TITLE, BUREAU_PROFS_HEADERS, accessToken);
    const bureauRows: any[][] = [
      BUREAU_PROFS_HEADERS,
      ["Président", clubInfo.president, "Dirigeant", clubInfo.presidentTelephone || "", clubInfo.presidentEmail || "", "Direction du club"],
      ["Secrétaire", clubInfo.secretaire, "Dirigeante", clubInfo.secretaireTelephone || "", clubInfo.secretaireEmail || "", "Secrétariat et licences"],
      ["Trésorier", clubInfo.tresorier, "Dirigeant", clubInfo.tresorierTelephone || "", clubInfo.tresorierEmail || "", "Comptabilité et finances"],
      ...((clubInfo.enseignants || []).map(p => [
        "Enseignant",
        p.nomPrenom,
        p.diplome,
        p.telephone || "",
        p.email || "",
        p.description || ""
      ]))
    ];

    // Nettoyage préalable pour éviter les lignes résiduelles
    const clearBureau = encodeURIComponent(`'${BUREAU_PROFS_SHEET_TITLE}'!A1:Z`);
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${clearBureau}:clear`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }
    );

    const rangeBureau = encodeURIComponent(`'${BUREAU_PROFS_SHEET_TITLE}'!A1:F${bureauRows.length}`);
    const resBureau = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${rangeBureau}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: bureauRows }),
      }
    );
    if (!resBureau.ok) {
      const errText = await resBureau.text();
      throw new Error(`Erreur écriture Bureau_Profs : ${errText}`);
    }

    // 2. Sauvegarde dans l'onglet Installations
    await ensureSheetTab(spreadsheetId, INSTALLATIONS_SHEET_TITLE, INSTALLATIONS_HEADERS, accessToken);
    const installRows: any[][] = [
      INSTALLATIONS_HEADERS,
      ...((clubInfo.installations || []).map(inst => [
        inst,
        "Tennis",
        "Résine / Béton",
        "Oui",
        "Complexe Chêne Rond / Clos des Moines",
        ""
      ]))
    ];

    const clearInstall = encodeURIComponent(`'${INSTALLATIONS_SHEET_TITLE}'!A1:Z`);
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${clearInstall}:clear`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }
    );

    const rangeInstall = encodeURIComponent(`'${INSTALLATIONS_SHEET_TITLE}'!A1:F${installRows.length}`);
    const resInstall = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${rangeInstall}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: installRows }),
      }
    );
    if (!resInstall.ok) {
      const errText = await resInstall.text();
      throw new Error(`Erreur écriture Installations : ${errText}`);
    }

    // 3. Sauvegarde dans l'onglet Cotisations_Tarifs
    if (clubInfo.tarifs && clubInfo.tarifs.length > 0) {
      await ensureSheetTab(spreadsheetId, COTISATIONS_SHEET_TITLE, COTISATIONS_HEADERS, accessToken);
      const cotisRows: any[][] = [
        COTISATIONS_HEADERS,
        ...(clubInfo.tarifs.map(t => [
          t.categorie === 'jeune' ? 'Jeune' : t.categorie === 'competition' ? 'Compétition' : t.categorie === 'adhesion' ? 'Adhésion' : 'Adulte',
          t.label,
          t.montant,
          t.description || ""
        ]))
      ];

      const clearCotis = encodeURIComponent(`'${COTISATIONS_SHEET_TITLE}'!A1:Z`);
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${clearCotis}:clear`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      );

      const rangeCotis = encodeURIComponent(`'${COTISATIONS_SHEET_TITLE}'!A1:D${cotisRows.length}`);
      const resCotis = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${rangeCotis}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: cotisRows }),
        }
      );
      if (!resCotis.ok) {
        const errText = await resCotis.text();
        throw new Error(`Erreur écriture Cotisations_Tarifs : ${errText}`);
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error("Erreur saveClubInfoToSheet:", err);
    return { success: false, error: err.message };
  }
}
