// src/services/googleSheets.ts

/**
 * Service de récupération des données Google Sheets pour le TCM Muzillac
 * Sécurisé contre le cache agressif de Vercel
 */

// Remplacez par votre ID de document si nécessaire
const SHEET_ID = "1FTYPkFaQM-S4UN5i8dL2zKZM4qZqHmckx-RmFxTya80"; 

export async function fetchSheetTabValues(tabName: string): Promise<any[][]> {
  try {
    // Élimination du cache : Génération d'un timestamp unique à chaque appel (ex: &t=1730000000)
    const timestamp = Date.now();
    
    // Construction de l'URL d'export CSV universelle de Google
    const url = `https://google.com{SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}&t=${timestamp}`;

    const response = await fetch(url, {
      method: "GET",
      // Force Vercel et le navigateur à ignorer le cache
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Erreur réseau lors de la récupération de l'onglet ${tabName}`);
    }

    const csvText = await response.text();
    return parseCSVToArray(csvText);
  } catch (error) {
    console.error(`[GoogleSheets Service] Échec sur l'onglet ${tabName}:`, error);
    return [];
  }
}

/**
 * Parseur CSV basique et robuste pour transformer le flux Google en tableau JavaScript
 */
function parseCSVToArray(text: string): any[][] {
  const lines = text.split(/\r\n|\n/);
  return lines.map(line => {
    // Gère les coupures par virgules ou points-virgules tout en nettoyant les guillemets de protection Google
    const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
    return matches.map(val => val.replace(/^"|"$/g, '').trim());
  });
}
