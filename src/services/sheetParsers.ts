// src/services/sheetParsers.ts

import { Rencontre, Adherent } from '../types/tennis';

/**
 * Fonction de nettoyage universelle pour les en-têtes complexes d'ADOC/FFT
 */
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Supprime les accents
    .replace(/[^a-z0-9]/g, "");     // Ne garde que les lettres et chiffres
}

/**
 * Parser pour l'onglet Rencontres (Structure ADOC FFT)
 * Mappe à la fois les clés camelCase de React et les clés normalisées d'ADOC
 */
export function parseRencontresTab(rows: any[][]): Rencontre[] {
  if (!rows || rows.length <= 1) return [];

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
  const idxCapNom = normalizedHeaders.findIndex(h => h.includes("nomcapitaine") || h.includes("capitaine"));

  const rencontres: Rencontre[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (idxDate === -1 || !row[idxDate]) continue;

    // 1. Structure stricte attendue par RencontresTab.tsx
    const matchObj: any = {
      id: String(i),
      date: row[idxDate],
      homologation: idxHomol !== -1 ? row[idxHomol] : "Championnat",
      categorieAge: idxCat !== -1 ? row[idxCat] : "Senior",
      numeroEquipe: idxEquipe !== -1 ? String(row[idxEquipe]) : "1",
      clubAccueil: idxAccueil !== -1 ? row[idxAccueil] : "TCM Muzillac",
      clubVisiteur: idxVisiteur !== -1 ? row[idxVisiteur] : "Adversaire",
      score: idxScore !== -1 ? row[idxScore] : "À venir",
      niveau: idxNiveau !== -1 ? String(row[idxNiveau]) : "Départemental",
      nomCapitaine: idxCapNom !== -1 ? row[idxCapNom] : "Non défini",
      composition: null // Évite le plantage du lookup r.composition
    };

    // 2. Rétrocompatibilité : On injecte aussi les variables brutes ADOC en minuscules
    normalizedHeaders.forEach((headerName, index) => {
      if (headerName && row[index] !== undefined) {
        matchObj[headerName] = row[index];
      }
    });

    rencontres.push(matchObj as Rencontre);
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
  const idxLicence = normalizedHeaders.findIndex(h => h.includes("licence"));

  const adherents: Adherent[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (idxNom === -1 || !row[idxNom]) continue;

    const adherentObj: any = {
      id: String(i),
      nomPrenom: row[idxNom],
      solde: idxSolde !== -1 ? Number(String(row[idxSolde]).replace(',', '.')) : 0,
      groupe: idxGroupe !== -1 ? row[idxGroupe] : "Aucun",
      classement: idxClass !== -1 ? row[idxClass] : "NC",
      licence: idxLicence !== -1 ? row[idxLicence] : ""
    };

    normalizedHeaders.forEach((headerName, index) => {
      if (headerName && row[index] !== undefined) {
        adherentObj[headerName] = row[index];
      }
    });

    adherents.push(adherentObj as Adherent);
  }

  return adherents;
}
