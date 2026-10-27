// src/data/clubData.ts

import { Adherent, Rencontre, ClubInfo } from '../types/tennis';

// Liens d'exports directs CSV de votre Google Sheet (évite le cache Vercel)
const SHEET_ID = "1FTYPkFaQM-S4UN5i8dL2zKZM4qZqHmckx-RmFxTya80";
export const REAL_DATA_FILE_URL = `https://google.com{SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Adherents`;
export const REAL_RENCONTRES_FILE_URL = `https://google.com{SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Rencontres`;

export const INITIAL_ADHERENTS: Adherent[] = [];
export const INITIAL_RENCONTRES: Rencontre[] = [];

export const INITIAL_CLUB_INFO: ClubInfo = {
  nom: "Tennis Club Muzillac",
  adresse: "Complexe sportif du Chêne Rond, Rue du Stade, 56190 Muzillac",
  enseignants: [
    { nom: "Enseignant 1 (DE)", qualification: "Diplômé d'État" },
    { nom: "Enseignant 2 (BPJEPS)", qualification: "Moniteur CQP" }
  ],
  tarifs: [],
  modalitesPaiement: "Paiement échelonné possible par chèque et CB via HelloAsso.",
  helloAssoUrl: "https://www.helloasso.com/associations/tennis-club-muzillac"
};

/**
 * Fonction de nettoyage universelle pour les en-têtes complexes d'ADOC
 */
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Parseur CSV universel
 */
function csvToArray(text: string): string[][] {
  if (!text) return [];
  const lines = text.split(/\r\n|\n/);
  return lines
    .filter(line => line.trim() !== "")
    .map(line => {
      const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
      return matches.map(val => val.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
    });
}

/**
 * Parseur de l'onglet Adhérents
 */
export function parseAdherentsCsv(csvText: string): Adherent[] {
  const rows = csvToArray(csvText);
  if (rows.length <= 1) return [];

  const normalizedHeaders = rows[0].map(h => normalizeHeader(h));
  const idxNom = normalizedHeaders.findIndex(h => h.includes("nomprenom") || h.includes("nom"));
  const idxSolde = normalizedHeaders.findIndex(h => h.includes("solde") || h.includes("due"));
  const idxGroupe = normalizedHeaders.findIndex(h => h.includes("groupeenseignement") || h.includes("groupe"));
  const idxClass = normalizedHeaders.findIndex(h => h.includes("dernierclasstennis") || h.includes("class"));
  const idxLicence = normalizedHeaders.findIndex(h => h.includes("licence"));

  const list: Adherent[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (idxNom === -1 || !row[idxNom]) continue;

    const adherentObj: any = {
      id: `adh-${i}`,
      nomPrenom: row[idxNom],
      solde: idxSolde !== -1 ? Number(row[idxSolde].replace(',', '.')) || 0 : 0,
      groupe: idxGroupe !== -1 ? row[idxGroupe] : "Aucun",
      classement: idxClass !== -1 ? row[idxClass] : "NC",
      licence: idxLicence !== -1 ? row[idxLicence] : ""
    };

    normalizedHeaders.forEach((headerName, index) => {
      if (headerName && row[index] !== undefined) {
        adherentObj[headerName] = row[index];
      }
    });

    list.push(adherentObj as Adherent);
  }
  return list;
}

/**
 * Parseur de l'onglet Rencontres (Structure ADOC FFT)
 */
export function parseRencontresCsv(csvText: string): Rencontre[] {
  const rows = csvToArray(csvText);
  if (rows.length <= 1) return [];

  const normalizedHeaders = rows[0].map(h => normalizeHeader(h));
  const idxDate = normalizedHeaders.findIndex(h => h.includes("datedelarencontre") || h.includes("date"));
  const idxHomol = normalizedHeaders.findIndex(h => h.includes("libelledelehomologation") || h.includes("homol") || h.includes("libellehomologation"));
  const idxCat = normalizedHeaders.findIndex(h => h.includes("categoriedagedelehomologation") || h.includes("cat") || h.includes("categorieagehomologation"));
  const idxEquipe = normalizedHeaders.findIndex(h => h.includes("numerodelequipe") || h.includes("equipe") || h.includes("numeroequipe"));
  const idxAccueil = normalizedHeaders.findIndex(h => h.includes("clubdaccueilnom") || h.includes("accueil") || h.includes("clubaccueilnom"));
  const idxVisiteur = normalizedHeaders.findIndex(h => h.includes("clubvisiteurnom") || h.includes("visiteur") || h.includes("clubvisiteurnom"));
  const idxScore = normalizedHeaders.findIndex(h => h.includes("score"));
  const idxNiveau = normalizedHeaders.findIndex(h => h.includes("niveaudelehomologation") || h.includes("niveau") || h.includes("niveauhomologation"));

  const list: Rencontre[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (idxDate === -1 || !row[idxDate]) continue;

    let rawEq = idxEquipe !== -1 ? String(row[idxEquipe]) : "1";
    let cleanEquipeNumber = rawEq.replace(/[^0-9]/g, "").trim() || rawEq;

    const matchObj: any = {
      id: `rec-${i}`,
      date: row[idxDate],
      homologation: idxHomol !== -1 ? row[idxHomol] : "Championnat",
      categorieAge: idxCat !== -1 ? row[idxCat] : "Senior",
      numeroEquipe: cleanEquipeNumber,
      clubAccueil: idxAccueil !== -1 ? row[idxAccueil] : "TC Muzillac",
      clubVisiteur: idxVisiteur !== -1 ? row[idxVisiteur] : "Adversaire",
      score: idxScore !== -1 ? row[idxScore] : "À venir",
      niveau: idxNiveau !== -1 ? String(row[idxNiveau]) : "Départemental",
      composition: null
    };

    normalizedHeaders.forEach((headerName, index) => {
      if (headerName && row[index] !== undefined) {
        matchObj[headerName] = row[index];
      }
    });

    // Correspondance des variables d'origine pour RencontresTab
    matchObj.niveauHomologation = matchObj.niveau;
    matchObj.libelleHomologation = matchObj.homologation;
    matchObj.categorieAgeHomologation = matchObj.categorieAge;
    matchObj.dateRencontre = matchObj.date;
    matchObj.clubAccueilNom = matchObj.clubAccueil;
    matchObj.clubVisiteurNom = matchObj.clubVisiteur;

    list.push(matchObj as Rencontre);
  }
  return list;
}
