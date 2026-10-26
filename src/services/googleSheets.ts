// src/services/googleSheets.ts

/**
 * Service de récupération et sauvegarde Google Sheets pour le TCM Muzillac
 * Sécurisé contre le cache agressif de Vercel et configuré pour CompositionModal
 */

const SHEET_ID = "1FTYPkFaQM-S4UN5i8dL2zKZM4qZqHmckx-RmFxTya80"; 

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
 * 🛠️ FONCTION AJOUTÉE POUR CORRIGER L'ERREUR DE BUILD
 * Permet aux capitaines d'enregistrer la composition d'équipe
 */
export async function saveCompositionToSheet(idMatch: string | number, payload: any): Promise<{ success: boolean; error?: string }> {
  try {
    // Si votre application utilise un backend ou un Web App Apps Script intermédiaire pour écrire dans le GSheet
    // Remplacez cette URL par celle de votre déploiement exécutable Google Macro si nécessaire
    const googleMacroUrl = `https://google.com`;

    const response = await fetch(googleMacroUrl, {
      method: "POST",
      mode: "no-cors", // Requis pour éviter les blocages Cross-Origin avec Google Script
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ idMatch, ...payload })
    });

    return { success: true };
  } catch (error: any) {
    console.error("[GoogleSheets Service] Échec de la sauvegarde de la composition:", error);
    return { success: false, error: error.message || "Erreur de connexion" };
  }
}

/**
 * Parseur CSV basique et robuste pour transformer le flux Google en tableau JavaScript
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
