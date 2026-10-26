// src/services/googleSheets.ts

/**
 * Service complet Google Sheets pour le TCM Muzillac
 * Intègre le système anti-cache Vercel et maintient les exports requis par les Modals
 */

const SHEET_ID = "1FTYPkFaQM-S4UN5i8dL2zKZM4qZqHmckx-RmFxTya80";
export const COMPOSITIONS_SHEET_TITLE = "Compo_Matchs";

/**
 * Fonction universelle anti-cache pour récupérer le flux CSV d'un onglet
 */
export async function fetchSheetTabValues(tabName: string): Promise<any[][]> {
  try {
    const timestamp = Date.now();
    const url = `https://google.com{SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}&t=${timestamp}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      },
      cache: "no-store"
    });

    if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
    const csvText = await response.text();
    return parseCSVToArray(csvText);
  } catch (error) {
    console.error(`[GoogleSheets] Échec sur l'onglet ${tabName}:`, error);
    return [];
  }
}

/**
 * Mappings pour correspondre aux fonctions attendues par GoogleSheetsSyncModal.tsx
 */
export async function readAdherentsFromSheet(): Promise<any[][]> {
  return await fetchSheetTabValues("Adhérents");
}

export async function readRencontresFromSheet(): Promise<any[][]> {
  return await fetchSheetTabValues("Rencontres");
}

export async function readCompositionsFromSheet(): Promise<any[][]> {
  return await fetchSheetTabValues(COMPOSITIONS_SHEET_TITLE);
}

/**
 * Simule la recherche de fichiers (requis par le modal de synchronisation)
 */
export async function searchDonneesAppliFiles(): Promise<Array<{ id: string; name: string }>> {
  return [{ id: SHEET_ID, name: "Données_appli" }];
}

/**
 * Simule la récupération des onglets disponibles (requis par le modal)
 */
export async function getSpreadsheetTabs(): Promise<string[]> {
  return ["Adhérents", "Rencontres", COMPOSITIONS_SHEET_TITLE];
}

/**
 * Sauvegarde des feuilles de compositions (requis par CompositionModal.tsx)
 */
export async function saveCompositionToSheet(idMatch: string | number, payload: any): Promise<{ success: boolean; error?: string }> {
  try {
    const googleMacroUrl = `https://google.com`;
    await fetch(googleMacroUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idMatch, ...payload })
    });
    return { success: true };
  } catch (error: any) {
    console.error("[GoogleSheets] Échec de la sauvegarde:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Parseur CSV robuste
 */
function parseCSVToArray(text: string): any[][] {
  if (!text) return [];
  const lines = text.split(/\r\n|\n/);
  return lines
    .filter(line => line.trim() !== "")
    .map(line => {
      const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
      return matches.map(val => val.replace(/^"|"$/g, '').trim());
    });
}
