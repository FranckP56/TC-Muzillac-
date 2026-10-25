import { Adherent, Rencontre, MatchComposition, FrozenPlayerSlot } from '../types/tennis';
import { parseAdherentRow, parseRencontreRow } from './sheetParsers';

export interface GoogleDriveFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export const COMPOSITIONS_SHEET_TITLE = 'Compositions_Equipes';

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
 * Recherche les classeurs Google Sheets correspondant à "Données_appli" sur le Google Drive de l'utilisateur
 */
export async function searchDonneesAppliFiles(accessToken: string): Promise<GoogleDriveFile[]> {
  try {
    // 1. Recherche par nom exact ou partiel
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

    // 2. Recherche élargie si le nom comporte des variantes d'accents ou caractères spéciaux
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

    // 3. Fallback général : récupérer les derniers Google Sheets modifiés
    const recentRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&fields=files(id,name,modifiedTime,webViewLink)&orderBy=modifiedTime desc&pageSize=10`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (recentRes.ok) {
      const recentData = await recentRes.json();
      return recentData.files || [];
    }

    return [];
  } catch (error) {
    console.error('Erreur lors de la recherche du fichier Données_appli:', error);
    throw error;
  }
}

/**
 * Récupère la liste des onglets d'un tableur Google Sheets
 */
export async function getSpreadsheetTabs(spreadsheetId: string, accessToken: string): Promise<string[]> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Erreur accès Google Sheets (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return (data.sheets || []).map((s: any) => s.properties?.title || '').filter(Boolean);
}

/**
 * Lit les adhérents directement dans l'onglet 'Adhérents' du Google Sheet Données_appli
 */
export async function readAdherentsFromSheet(
  spreadsheetId: string, 
  accessToken: string,
  sheetTitle: string = 'Adhérents'
): Promise<Adherent[]> {
  const range = encodeURIComponent(`'${sheetTitle}'!A1:ZZ`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Impossible de lire l'onglet '${sheetTitle}' (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const rows: any[][] = data.values || [];

  if (rows.length <= 1) {
    return [];
  }

  const headers = rows[0].map(h => String(h || '').trim());
  const adherents: Adherent[] = [];

  for (let i = 1; i < rows.length; i++) {
    const parsed = parseAdherentRow(rows[i], headers, i);
    if (parsed) {
      adherents.push(parsed);
    }
  }

  return adherents;
}

/**
 * Lit les rencontres directement dans l'onglet 'Rencontres' du Google Sheet Données_appli
 */
export async function readRencontresFromSheet(
  spreadsheetId: string, 
  accessToken: string,
  sheetTitle: string = 'Rencontres'
): Promise<Rencontre[]> {
  const range = encodeURIComponent(`'${sheetTitle}'!A1:ZZ`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Impossible de lire l'onglet '${sheetTitle}' (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const rows: any[][] = data.values || [];

  if (rows.length <= 1) {
    return [];
  }

  const headers = rows[0].map(h => String(h || '').trim());
  const rencontres: Rencontre[] = [];

  for (let i = 1; i < rows.length; i++) {
    const parsed = parseRencontreRow(rows[i], headers, i);
    if (parsed) {
      rencontres.push(parsed);
    }
  }

  return rencontres;
}

/**
 * S'assure que l'onglet 'Compositions_Equipes' existe dans le Google Sheet Données_appli
 */
export async function ensureCompositionsSheet(spreadsheetId: string, accessToken: string): Promise<void> {
  const tabs = await getSpreadsheetTabs(spreadsheetId, accessToken);
  if (tabs.includes(COMPOSITIONS_SHEET_TITLE)) {
    return;
  }

  // Création de l'onglet via batchUpdate
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
                title: COMPOSITIONS_SHEET_TITLE,
                gridProperties: {
                  frozenRowCount: 1,
                },
                tabColor: {
                  red: 0.9,
                  green: 0.32,
                  blue: 0.0, // Couleur orange TCM
                },
              },
            },
          },
        ],
      }),
    }
  );

  if (!addSheetRes.ok) {
    const err = await addSheetRes.text();
    throw new Error(`Erreur lors de la création de l'onglet ${COMPOSITIONS_SHEET_TITLE}: ${err}`);
  }

  // Écriture de la ligne d'en-tête (20 colonnes A à T)
  const range = encodeURIComponent(`'${COMPOSITIONS_SHEET_TITLE}'!A1:T1`);
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [COMPOSITIONS_HEADERS],
      }),
    }
  );
}

/**
 * Charge les compositions enregistrées avec les classements gelés depuis l'onglet 'Compositions_Equipes'
 */
export async function readCompositionsFromSheet(
  spreadsheetId: string,
  accessToken: string
): Promise<Map<string, { composition: MatchComposition; frozenSlots: FrozenPlayerSlot[] }>> {
  const map = new Map<string, { composition: MatchComposition; frozenSlots: FrozenPlayerSlot[] }>();

  try {
    const tabs = await getSpreadsheetTabs(spreadsheetId, accessToken);
    if (!tabs.includes(COMPOSITIONS_SHEET_TITLE)) {
      return map;
    }

    const range = encodeURIComponent(`'${COMPOSITIONS_SHEET_TITLE}'!A1:T`);
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!res.ok) return map;

    const data = await res.json();
    const rows: any[][] = data.values || [];
    if (rows.length <= 1) return map;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const matchId = String(row[0] || '').trim();
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
            heureDebut,
            lieuRencontre,
            nombreCourts,
            frozenPlayers: [],
          },
          frozenSlots: [],
        };
        map.set(matchId, entry);
      }

      const slot: FrozenPlayerSlot = {
        poste,
        adherentId: licence || nomPrenom,
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
    }
  } catch (err) {
    console.warn('Lecture des compositions gelées depuis Google Sheets échouée:', err);
  }

  return map;
}

/**
 * Enregistre définitivement une composition d'équipe dans Données_appli avec les données gelées à la date de la rencontre
 */
export async function saveCompositionToSheet(
  spreadsheetId: string,
  rencontre: Rencontre,
  composition: MatchComposition,
  adherentsById: Map<string, Adherent>,
  accessToken: string
): Promise<{ success: boolean; rowsSaved: number }> {
  // 1. S'assurer de la présence de l'onglet Compositions_Equipes
  await ensureCompositionsSheet(spreadsheetId, accessToken);

  // 2. Préparer les données gelées pour chaque poste désigné
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

    // Fige les données exactes du joueur au jour de la rencontre
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
      classementGele, // <-- GEL DU CLASSEMENT
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
    throw new Error('Aucun joueur sélectionné à enregistrer.');
  }

  // 3. Lire l'onglet actuel pour remplacer les lignes de CETTE rencontre tout en conservant toutes les autres
  const readRange = encodeURIComponent(`'${COMPOSITIONS_SHEET_TITLE}'!A1:T`);
  const currentSheetRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${readRange}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  let existingRows: any[][] = [];
  if (currentSheetRes.ok) {
    const currentData = await currentSheetRes.json();
    existingRows = currentData.values || [];
  }

  // Filtrer les anciennes lignes relatives à cette rencontre spécifique
  const headerRow = existingRows.length > 0 ? existingRows[0] : COMPOSITIONS_HEADERS;
  const filteredRows = existingRows.slice(1).filter(r => String(r[0] || '').trim() !== String(rencontre.id).trim());

  // Assembler le contenu final complet
  const allUpdatedRows = [headerRow, ...filteredRows, ...newRows];

  // Effacer la plage et réécrire le contenu complet pour garantir une intégrité parfaite
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
  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${writeRange}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: allUpdatedRows,
      }),
    }
  );

  if (!writeRes.ok) {
    const errText = await writeRes.text();
    throw new Error(`Erreur lors de l'enregistrement dans Données_appli: ${errText}`);
  }

  // Mettre à jour l'objet composition local avec le snapshot gelé
  composition.frozenPlayers = frozenList;

  return {
    success: true,
    rowsSaved: newRows.length,
  };
}
