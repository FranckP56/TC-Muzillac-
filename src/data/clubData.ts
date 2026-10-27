// src/data/clubData.ts

import { Adherent, Rencontre, ClubInfo } from '../types/tennis';

const SHEET_ID = "1FTYPkFaQM-S4UN5i8dL2zKZM4qZqHmckx-RmFxTya80";
export const REAL_DATA_FILE_URL = `https://google.com{SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Adherents`;
export const REAL_RENCONTRES_FILE_URL = `https://google.com{SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Rencontres`;

export const INITIAL_ADHERENTS: Adherent[] = [
  { id: "adh-init", nomPrenom: "Chargement de la base club...", solde: 0, groupe: "Aucun", classement: "NC" }
];

export const INITIAL_RENCONTRES: Rencontre[] = [
  {
    id: "init-match",
    id_match: 0,
    date: "En cours",
    homologation: "Chargement...",
    categorieAge: "Senior",
    numeroEquipe: "1",
    clubAccueil: "TC Muzillac 1",
    clubVisiteur: "Club",
    score: "À venir",
    niveau: "Départemental",
    composition: null as any,
    clubAccueilNom: "TC Muzillac 1",
    clubVisiteurNom: "Club",
    dateRencontre: "En cours",
    libelleHomologation: "Chargement...",
    categorieAgeHomologation: "Senior",
    niveauHomologation: "Départemental"
  }
];

export const GSHEET_ADHERENTS_HEADERS = ["Nom Prénom", "Solde", "Téléphone Portable", "Email", "Dernier class. tennis", "Licence", "Groupe enseignement", "Date Naiss.", "Civilité"];
export const GSHEET_RENCONTRES_HEADERS = ["Date de la rencontre", "Libellé de l'homologation", "Catégorie d'âge de l'homologation", "Numéro de l'équipe", "Club d'accueil nom", "Club visiteur nom", "Score", "Niveau de l'homologation", "Nom capitaine"];

export const INITIAL_CLUB_INFO: ClubInfo = {
  nom: "Tennis Club Muzillac",
  adresse: "Complexe sportif du Chêne Rond, Rue du Stade, 56190 Muzillac",
  enseignants: [
    { nom: "Enseignant 1 (DE)", qualification: "Diplômé d'État" },
    { nom: "Enseignant 2 (BPJEPS)", qualification: "Moniteur CQP" }
  ],
  tarifs: [],
  installations: [
    { id: "inst-1", nom: "Courts extérieurs", type: "Quick" },
    { id: "inst-2", nom: "Salle omnisports", type: "Résine" }
  ],
  modalitesPaiement: "Paiement échelonné possible par chèque et CB via HelloAsso.",
  helloAssoUrl: "https://helloasso.com"
} as any;

function cleanHeaderCell(val: any): string {
  if (!val) return "";
  return String(val).toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function csvToArray(text: string): string[][] {
  if (!text) return [];
  const lines = text.split(/\r\n|\n/);
  const result: string[][] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const row: string[] = [];
    let inQuotes = false;
    let currentCell = "";

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(currentCell.trim());
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
    row.push(currentCell.trim());
    result.push(row);
  }
  return result;
}

export function parseAdherentsCsv(csvText: string): Adherent[] {
  const rows = csvToArray(csvText);
  if (!rows || rows.length <= 1) return [];
  
  // Normalisation tolérante de la ligne d'en-tête
  const headers = rows[0].map(h => cleanHeaderCell(h));
  
  // Recherche ultra-flexible des colonnes (gère "nom prenom", "nom", "prenom")
  const idxNom = headers.findIndex(h => h.includes("nom"));
  const idxSolde = headers.findIndex(h => h.includes("solde") || h.includes("due") || h.includes("compta"));
  const idxGroupe = headers.findIndex(h => h.includes("groupe") || h.includes("enseig"));
  const idxClass = headers.findIndex(h => h.includes("class") || h.includes("rang"));
  const idxLicence = headers.findIndex(h => h.includes("licence"));

  const list: Adherent[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || idxNom === -1 || !row[idxNom]) continue;
    
    const adherentObj: any = {
      id: idxLicence !== -1 && row[idxLicence] ? String(row[idxLicence]).trim() : `adh-${i}`,
      nomPrenom: row[idxNom],
      solde: idxSolde !== -1 && row[idxSolde] ? Number(row[idxSolde].replace(',', '.')) || 0 : 0,
      groupe: idxGroupe !== -1 ? row[idxGroupe] || "Aucun" : "Aucun",
      classement: idxClass !== -1 ? row[idxClass] || "NC" : "NC",
      licence: idxLicence !== -1 ? row[idxLicence] || "" : ""
    };
    
    // Injection des propriétés secondaires attendues par l'export des Licenciés
    headers.forEach((headerName, index) => {
      if (headerName && row[index] !== undefined) {
        adherentObj[headerName] = row[index];
      }
    });

    list.push(adherentObj as Adherent);
  }
  return list;
}

export function parseRencontresCsv(csvText: string): Rencontre[] {
  const rows = csvToArray(csvText);
  if (!rows || rows.length <= 1) return [];
  
  const headers = rows[0].map(h => cleanHeaderCell(h));
  
  const idxDate = headers.findIndex(h => h.includes("date"));
  const idxHomol = headers.findIndex(h => h.includes("homol") || h.includes("libelle"));
  const idxCat = headers.findIndex(h => h.includes("cat") || h.includes("age"));
  const idxEquipe = headers.findIndex(h => h.includes("equipe") || h.includes("num"));
  const idxAccueil = headers.findIndex(h => h.includes("acc") || h.includes("dom"));
  const idxVisiteur = headers.findIndex(h => h.includes("vis") || h.includes("ext"));
  const idxScore = headers.findIndex(h => h.includes("score"));
  const idxNiveau = headers.findIndex(h => h.includes("niv") || h.includes("div"));

  const list: Rencontre[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || idxDate === -1 || !row[idxDate]) continue;
    let rawEq = idxEquipe !== -1 ? String(row[idxEquipe] || "1") : "1";
    let cleanEquipeNumber = rawEq.replace(/[^0-9]/g, "").trim() || rawEq;

    const matchObj: any = {
      id: `rec-${i}`,
      id_match: i,
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

    headers.forEach((headerName, index) => {
      if (headerName && row[index] !== undefined) {
        matchObj[headerName] = row[index];
      }
    });

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
