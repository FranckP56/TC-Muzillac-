// src/services/sheetParsers.ts

/**
 * Fonction de nettoyage universelle pour les en-têtes complexes d'ADOC/FFT
 * Supprime les espaces, les majuscules, les accents et les caractères spéciaux
 */
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Enlève tous les accents
    .replace(/[^a-z0-9]/g, "");     // Ne garde strictement que les lettres et chiffres
}

/**
 * Parser pour l'onglet Rencontres (Structure ADOC FFT)
 */
export function parseRencontresTab(rows: any[][]): any[] {
  if (rows.length <= 1) return [];

  // On extrait et normalise la première ligne (les en-têtes)
  const rawHeaders = rows[0];
  const normalizedHeaders = rawHeaders.map(h => normalizeHeader(String(h)));

  // Recherche des index via les en-têtes normalisés
  const idxDate = normalizedHeaders.findIndex(h => h.includes("datedelarencontre") || h.includes("date"));
  const idxHomol = normalizedHeaders.findIndex(h => h.includes("libelledelehomologation") || h.includes("homol"));
  const idxCat = normalizedHeaders.findIndex(h => h.includes("categoriedagedelehomologation") || h.includes("cat"));
  const idxEquipe = normalizedHeaders.findIndex(h => h.includes("numerodelequipe") || h.includes("equipe"));
  const idxAccueil = normalizedHeaders.findIndex(h => h.includes("clubdaccueilnom") || h.includes("accueil"));
  const idxVisiteur = normalizedHeaders.findIndex(h => h.includes("clubvisiteurnom") || h.includes("visiteur"));
  const idxScore = normalizedHeaders.findIndex(h => h.includes("score"));
  const idxNiveau = normalizedHeaders.findIndex(h => h.includes("niveaudelehomologation") || h.includes("niveau"));

  const rencontres: any[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // Sécurité : si la ligne n'a pas de date, on l'ignore
    if (idxDate === -1 || !row[idxDate]) continue;

    rencontres.push({
      id_match: i,
      date: row[idxDate],
      homologation: idxHomol !== -1 ? row[idxHomol] : "Championnat",
      categorieAge: idxCat !== -1 ? row[idxCat] : "Senior",
      numeroEquipe: idxEquipe !== -1 ? row[idxEquipe] : "1",
      clubAccueil: idxAccueil !== -1 ? row[idxAccueil] : "TCM Muzillac",
      clubVisiteur: idxVisiteur !== -1 ? row[idxVisiteur] : "Adversaire",
      score: idxScore !== -1 ? row[idxScore] : "A venir",
      niveau: idxNiveau !== -1 ? String(row[idxNiveau]).toLowerCase() : "départemental"
    });
  }

  return rencontres;
}

/**
 * Parser pour l'onglet Adhérents
 */
export function parseAdherentsTab(rows: any[][]): any[] {
  if (rows.length <= 1) return [];

  const rawHeaders = rows[0];
  const normalizedHeaders = rawHeaders.map(h => normalizeHeader(String(h)));

  const idxNom = normalizedHeaders.findIndex(h => h.includes("nomprenom") || h.includes("nom"));
  const idxSolde = normalizedHeaders.findIndex(h => h.includes("solde") || h.includes("due"));
  const idxGroupe = normalizedHeaders.findIndex(h => h.includes("groupeenseignement") || h.includes("groupe"));
  const idxClass = normalizedHeaders.findIndex(h => h.includes("dernierclasstennis") || h.includes("class"));

  const adherents: any[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (idxNom === -1 || !row[idxNom]) continue;

    adherents.push({
      id_ligne: i,
      nomPrenom: row[idxNom],
      solde: idxSolde !== -1 ? Number(String(row[idxSolde]).replace(',', '.')) : 0, // Gère les décimales à la française
      groupe: idxGroupe !== -1 ? row[idxGroupe] : "Aucun",
      classement: idxClass !== -1 ? row[idxClass] : "NC"
    });
  }

  return adherents;
}
