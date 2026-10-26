// src/services/sheetParsers.ts

/**
 * Parser de données typé et universel pour le TCM Muzillac
 * Version de secours hautement compatible avec les composants d'origine
 */

export interface Adherent {
  id_ligne: number;
  nomPrenom: string;
  solde: number;
  groupe: string;
  classement: string;
  // Propriétés secondaires pour compatibilité ascendante
  [key: string]: any;
}

export interface Rencontre {
  id_match: number;
  date: string;
  homologation: string;
  categorieAge: string;
  numeroEquipe: string;
  clubAccueil: string;
  clubVisiteur: string;
  score: string;
  niveau: string;
  // Propriétés secondaires pour compatibilité ascendante
  [key: string]: any;
}

/**
 * Fonction de nettoyage universelle pour les en-têtes complexes d'ADOC/FFT
 */
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Supprime les accents
    .replace(/[^a-z0-9]/g, "");     // Ne garde que lettres et chiffres
}

/**
 * Parser pour l'onglet Rencontres (Structure ADOC FFT)
 */
export function parseRencontresTab(rows: any[][]): Rencontre[] {
  if (!rows || rows.length <= 1) return [];

  // Extraction et normalisation de la ligne d'en-tête
  const rawHeaders = rows[0];
  const normalizedHeaders = rawHeaders.map(h => normalizeHeader(String(h)));

  const idxDate = normalizedHeaders.findIndex(h => h.includes("datedelarencontre") || h.includes("date"));
  const idxHomol = normalizedHeaders.findIndex(h => h.includes("libelledelehomologation") || h.includes("homol"));
  const idxCat = normalizedHeaders.findIndex(h => h.includes("categoriedagedelehomologation") || h.includes("cat"));
  const idxEquipe = normalizedHeaders.findIndex(h => h.includes("numerodelequipe") || h.includes("equipe"));
  const idxAccueil = normalizedHeaders.findIndex(h => h.includes("clubdaccueilnom") || h.includes("accueil"));
  const idxVisiteur = normalizedHeaders.findIndex(h => h.includes("clubvisiteurnom") || h.includes("visiteur"));
  const idxScore = normalizedHeaders.findIndex(h => h.includes("score"));
  const idxNiveau = normalizedHeaders.findIndex(h => h.includes("niveaudelehomologation") || h.includes("niveau"));

  const rencontres: Rencontre[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (idxDate === -1 || !row[idxDate]) continue;

    // Construction de l'objet de base compatible
    const matchObj: Rencontre = {
      id_match: i,
      date: row[idxDate],
      homologation: idxHomol !== -1 ? row[idxHomol] : "Championnat",
      categorieAge: idxCat !== -1 ? row[idxCat] : "Senior",
      numeroEquipe: idxEquipe !== -1 ? row[idxEquipe] : "1",
      clubAccueil: idxAccueil !== -1 ? row[idxAccueil] : "TCM Muzillac",
      clubVisiteur: idxVisiteur !== -1 ? row[idxVisiteur] : "Adversaire",
      score: idxScore !== -1 ? row[idxScore] : "A venir",
      niveau: idxNiveau !== -1 ? String(row[idxNiveau]).toLowerCase() : "départemental"
    };

    // FILET DE SÉCURITÉ : On réinjecte aussi TOUTES les colonnes brutes indexées par leur nom normalisé
    // Cela permet aux anciens composants de retrouver instantanément leurs clés (ex: match.datedelarencontre)
    normalizedHeaders.forEach((headerName, index) => {
      if (headerName && row[index] !== undefined) {
        (matchObj as any)[headerName] = row[index];
      }
    });

    rencontres.push(matchObj);
  }

  return rencontres;
}

/**
 * Parser pour l'onglet Adhérents
 */
export function parseAdherentsTab(rows: any[][]): Adherent[] {
  if (!rows || rows.length <= 1) return [];

  const rawHeaders = rows[0];
  const normalizedHeaders = rawHeaders.map(h => normalizeHeader(String(h)));

  const idxNom = normalizedHeaders.findIndex(h => h.includes("nomprenom") || h.includes("nom"));
  const idxSolde = normalizedHeaders.findIndex(h => h.includes("solde") || h.includes("due"));
  const idxGroupe = normalizedHeaders.findIndex(h => h.includes("groupeenseignement") || h.includes("groupe"));
  const idxClass = normalizedHeaders.findIndex(h => h.includes("dernierclasstennis") || h.includes("class"));

  const adherents: Adherent[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (idxNom === -1 || !row[idxNom]) continue;

    const adherentObj: Adherent = {
      id_ligne: i,
      nomPrenom: row[idxNom],
      solde: idxSolde !== -1 ? Number(String(row[idxSolde]).replace(',', '.')) : 0,
      groupe: idxGroupe !== -1 ? row[idxGroupe] : "Aucun",
      classement: idxClass !== -1 ? row[idxClass] : "NC"
    };

    // On réinjecte également toutes les colonnes brutes nettoyées pour la rétrocompatibilité (ex: player.telephoneportable)
    normalizedHeaders.forEach((headerName, index) => {
      if (headerName && row[index] !== undefined) {
        (adherentObj as any)[headerName] = row[index];
      }
    });

    adherents.push(adherentObj);
  }

  return adherents;
}
