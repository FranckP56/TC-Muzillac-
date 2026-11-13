import { Adherent, Rencontre, MatchComposition, FrozenPlayerSlot, Enseignant, ClubInfo, ClubTarif, TrocAnnonce } from '../types/tennis';
import { parseAdherentRow, parseRencontreRow } from './sheetParsers';
import { cleanRanking, isValidTennisRanking } from '../utils/ranking';
import { normalizeDateString } from '../utils/dateUtils';
import { formatFrenchPhoneNumber } from '../utils/phoneUtils';

// URL Google Apps Script Web App (action=getAll / doPost)
export const APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbx5gTcxhLQ1i2ZksvPGzzmJC4YXVvZp5-Rm7C74WZserM5mooPsMB450m128QdHMAV_TQ/exec";
export const TCM_APPS_SCRIPT_URL = APPS_SCRIPT_WEB_APP_URL;

export const TCM_DEFAULT_SHEET_ID = "1FTYPkFaQM-S4UN5i8dL2zKZM4qZqHmckx-RmFxTya80";
export const ADHERENTS_SHEET_TITLE = 'Adhérents';
export const RENCONTRES_SHEET_TITLE = 'Rencontres';
export const COMPOSITIONS_SHEET_TITLE = 'Compositions_Equipes';
export const BUREAU_PROFS_SHEET_TITLE = 'Bureau_Profs';
export const INSTALLATIONS_SHEET_TITLE = 'Installations';
export const COTISATIONS_SHEET_TITLE = 'Cotisations_Tarifs';
export const CLUB_INFO_SHEET_TITLE = 'Club_Info';
export const TROC_SHEET_TITLE = 'Troc_Annonces';

export const TCM_CACHE_KEY = 'tcm_google_sheets_dataset_v3';
export const TCM_LAST_SYNC_KEY = 'tcm_last_sync_timestamp';
export const TCM_CUSTOM_CLUB_INFO_KEY = 'tcm_custom_club_info_v3';
export const TCM_CUSTOM_COMPOSITIONS_KEY = 'tcm_custom_compositions_v3';

export function saveLocalComposition(matchId: string, comp: MatchComposition): void {
  try {
    const raw = localStorage.getItem(TCM_CUSTOM_COMPOSITIONS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[matchId] = comp;
    map[normalizeSheetMatchKey(matchId)] = comp;
    localStorage.setItem(TCM_CUSTOM_COMPOSITIONS_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn("Erreur sauvegarde locale composition:", e);
  }
}

export function loadLocalCompositions(): Record<string, MatchComposition> {
  try {
    const raw = localStorage.getItem(TCM_CUSTOM_COMPOSITIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function cleanTimeValue(val: any, fallback = '14:00'): string {
  if (!val) return fallback;
  const s = String(val).trim();
  if (s.includes('T')) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    }
  }
  const match = s.match(/(\d{1,2})[:hH](\d{2})/);
  if (match) {
    return `${match[1].padStart(2, '0')}:${match[2]}`;
  }
  return s || fallback;
}

export function saveClubInfoToLocal(info: ClubInfo): void {
  try {
    localStorage.setItem(TCM_CUSTOM_CLUB_INFO_KEY, JSON.stringify(info));
  } catch (e) {
    console.warn("Erreur sauvegarde locale clubInfo:", e);
  }
}

export function loadClubInfoFromLocal(): Partial<ClubInfo> | null {
  try {
    const raw = localStorage.getItem(TCM_CUSTOM_CLUB_INFO_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface AppsScriptDataResult {
  success?: boolean;
  adherents: Adherent[];
  rencontres: Rencontre[];
  compositionsMap: Map<string, { composition: MatchComposition; frozenSlots: FrozenPlayerSlot[] }>;
  bureau?: {
    president?: { nom: string; tel?: string; email?: string };
    secretaire?: { nom: string; tel?: string; email?: string };
    tresorier?: { nom: string; tel?: string; email?: string };
    enseignants: Enseignant[];
  };
  installations?: string[];
  tarifs?: ClubTarif[];
  clubInfo?: Partial<ClubInfo>;
  raw?: any;
}

export interface CachedDataset {
  timestamp: number;
  adherents: Adherent[];
  rencontres: Rencontre[];
  bureau?: {
    president?: { nom: string; tel?: string; email?: string };
    secretaire?: { nom: string; tel?: string; email?: string };
    tresorier?: { nom: string; tel?: string; email?: string };
    enseignants: Enseignant[];
  };
  installations?: string[];
  tarifs?: ClubTarif[];
  clubInfo?: Partial<ClubInfo>;
}

export function saveDatasetToCache(data: AppsScriptDataResult): void {
  try {
    const dataset: CachedDataset = {
      timestamp: Date.now(),
      adherents: data.adherents,
      rencontres: data.rencontres,
      bureau: data.bureau,
      installations: data.installations,
      tarifs: data.tarifs,
      clubInfo: data.clubInfo,
    };
    localStorage.setItem(TCM_CACHE_KEY, JSON.stringify(dataset));
    localStorage.setItem(TCM_LAST_SYNC_KEY, String(dataset.timestamp));
  } catch (err) {
    console.warn("Erreur sauvegarde localStorage cache:", err);
  }
}

export function loadDatasetFromCache(): CachedDataset | null {
  try {
    const raw = localStorage.getItem(TCM_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.adherents) || !Array.isArray(parsed.rencontres)) {
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn("Erreur lecture localStorage cache:", err);
    return null;
  }
}

export function getLastSyncTimestamp(): number | null {
  try {
    const stored = localStorage.getItem(TCM_LAST_SYNC_KEY);
    if (stored) {
      const num = parseInt(stored, 10);
      if (!isNaN(num) && num > 0) return num;
    }
    const cache = loadDatasetFromCache();
    return cache?.timestamp || null;
  } catch {
    return null;
  }
}

// Cache court en mémoire pour éviter les rafales d'appels HTTP simultanés
let cachedRawData: any = null;
let lastFetchTime = 0;

/**
 * Normalisation insensible aux espaces et caractères spéciaux pour la clé de rencontre
 */
export function normalizeSheetMatchKey(str: string): string {
  return (str || '').toLowerCase().replace(/[\s\/\-_]/g, '');
}

/**
 * Parsing des compositions depuis les lignes brutes de l'onglet Compositions_Equipes
 */
function parseCompositionsRows(rawComps: any): Map<string, { composition: MatchComposition; frozenSlots: FrozenPlayerSlot[] }> {
  const map = new Map<string, { composition: MatchComposition; frozenSlots: FrozenPlayerSlot[] }>();
  if (!rawComps) return map;

  // 1. Cas où rawComps est un dictionnaire/objet renvoyé par Apps Script : { "rencontre-1": { matchId, ... } }
  if (typeof rawComps === 'object' && !Array.isArray(rawComps)) {
    for (const [key, val] of Object.entries(rawComps)) {
      if (!val || typeof val !== 'object') continue;
      const v = val as any;
      const matchId = String(v.matchId || key).trim();
      const heureDebut = cleanTimeValue(v.heureDebut, '14:00');
      const lieuRencontre = String(v.lieuRencontre || 'Clos des Moines (Muzillac)').trim();
      const nombreCourts = parseInt(String(v.nombreCourts), 10) || 2;
      const dateVal = String(v.dateRencontre || '').trim();
      const normDateVal = normalizeDateString(dateVal);
      const numEqVal = String(v.numeroEquipe || '').trim();

      const frozenSlots: FrozenPlayerSlot[] = Array.isArray(v.frozenPlayers) ? v.frozenPlayers : [];

      const comp: MatchComposition = {
        valideParCapitaine: !!v.valideParCapitaine,
        dateValidation: String(v.dateValidation || ''),
        dateRencontreValidee: normDateVal || dateVal || undefined,
        heureDebut,
        lieuRencontre,
        nombreCourts,
        frozenPlayers: frozenSlots,
      };

      // Assigner les clés de postes directes
      frozenSlots.forEach(s => {
        const cleanPoste = (s.poste || '').toLowerCase().trim();
        const pId = s.adherentId || s.licence || s.nomPrenom;
        if (cleanPoste.includes('simple 1') || cleanPoste === 's1') comp.simple1Id = pId;
        else if (cleanPoste.includes('simple 2') || cleanPoste === 's2') comp.simple2Id = pId;
        else if (cleanPoste.includes('simple 3') || cleanPoste === 's3') comp.simple3Id = pId;
        else if (cleanPoste.includes('simple 4') || cleanPoste === 's4') comp.simple4Id = pId;
        else if (cleanPoste.includes('simple 5') || cleanPoste === 's5') comp.simple5Id = pId;
        else if (cleanPoste.includes('double 1') && (cleanPoste.includes('j1') || cleanPoste.includes('1er') || cleanPoste.includes('joueur 1'))) comp.double1Player1Id = pId;
        else if (cleanPoste.includes('double 1') && (cleanPoste.includes('j2') || cleanPoste.includes('2eme') || cleanPoste.includes('joueur 2'))) comp.double1Player2Id = pId;
        else if (cleanPoste.includes('double 2') && (cleanPoste.includes('j1') || cleanPoste.includes('1er') || cleanPoste.includes('joueur 1'))) comp.double2Player1Id = pId;
        else if (cleanPoste.includes('double 2') && (cleanPoste.includes('j2') || cleanPoste.includes('2eme') || cleanPoste.includes('joueur 2'))) comp.double2Player2Id = pId;
      });

      const entry = { composition: comp, frozenSlots };
      map.set(matchId, entry);
      map.set(normalizeSheetMatchKey(matchId), entry);
      if (dateVal && numEqVal) {
        map.set(`date_${normalizeSheetMatchKey(dateVal)}_eq_${normalizeSheetMatchKey(numEqVal)}`, entry);
        if (normDateVal) {
          map.set(`date_${normalizeSheetMatchKey(normDateVal)}_eq_${normalizeSheetMatchKey(numEqVal)}`, entry);
        }
      }
    }
  }

  // 2. Cas où rawComps est un tableau de lignes 2D de l'onglet Compositions_Equipes
  else if (Array.isArray(rawComps) && rawComps.length > 1 && Array.isArray(rawComps[0])) {
    for (let i = 1; i < rawComps.length; i++) {
      const row = rawComps[i];
      if (!Array.isArray(row) || row.length === 0) continue;

      const matchId = String(row[0] || '').trim();
      const dateVal = String(row[1] || '').trim();
      const numEqVal = String(row[2] || '').trim();
      const poste = String(row[8] || '').trim();
      const nomPrenom = String(row[9] || '').trim();
      const licence = String(row[10] || '').trim();
      const rawClassementGele = String(row[11] || '').trim();
      const classementGele = cleanRanking(rawClassementGele);
      const dateNaissance = normalizeDateString(row[12] || '');
      const ageSportif = String(row[13] || '').trim();
      const typeLicence = String(row[14] || '').trim();

      let heureDebut = '14:00';
      let lieuRencontre = 'Clos des Moines (Muzillac)';
      let nombreCourts = 2;
      let dateEnreg = '';
      let valide = false;

      // Détection intelligente selon le contenu de row[15]
      if (row.length > 17 || (row[15] && String(row[15]).includes(':'))) {
        heureDebut = cleanTimeValue(row[15], '14:00');
        lieuRencontre = String(row[16] || 'Clos des Moines (Muzillac)').trim();
        nombreCourts = parseInt(String(row[17]), 10) || 2;
        dateEnreg = String(row[18] || row[15] || '').trim();
        valide = String(row[19] || row[16] || '').toLowerCase() === 'oui' || String(row[19] || row[16] || '').toLowerCase() === 'true';
      } else {
        dateEnreg = String(row[15] || '').trim();
        valide = String(row[16] || '').toLowerCase() === 'oui' || String(row[16] || '').toLowerCase() === 'true';
      }

      if (!matchId || !poste || !nomPrenom) continue;

      const normDateVal = normalizeDateString(dateVal);

      let entry = map.get(matchId);
      if (!entry) {
        entry = {
          composition: {
            valideParCapitaine: valide,
            dateValidation: dateEnreg,
            dateRencontreValidee: normDateVal || dateVal || undefined,
            heureDebut,
            lieuRencontre,
            nombreCourts,
            frozenPlayers: [],
          },
          frozenSlots: [],
        };
        map.set(matchId, entry);
        map.set(normalizeSheetMatchKey(matchId), entry);
        if (dateVal && numEqVal) {
          map.set(`date_${normalizeSheetMatchKey(dateVal)}_eq_${normalizeSheetMatchKey(numEqVal)}`, entry);
          if (normDateVal) {
            map.set(`date_${normalizeSheetMatchKey(normDateVal)}_eq_${normalizeSheetMatchKey(numEqVal)}`, entry);
          }
        }
      }

      const playerId = licence || nomPrenom;
      const slot: FrozenPlayerSlot = {
        poste,
        adherentId: playerId,
        nomPrenom,
        licence,
        classementGele: classementGele || 'NC',
        dateNaissance,
        ageSportif,
        typeLicence,
      };

      entry.frozenSlots.push(slot);
      if (entry.composition.frozenPlayers) {
        entry.composition.frozenPlayers.push(slot);
      }

      // Assigner les clés de postes directes
      const cleanPoste = poste.toLowerCase().trim();
      if (cleanPoste.includes('simple 1') || cleanPoste === 's1') {
        entry.composition.simple1Id = playerId;
      } else if (cleanPoste.includes('simple 2') || cleanPoste === 's2') {
        entry.composition.simple2Id = playerId;
      } else if (cleanPoste.includes('simple 3') || cleanPoste === 's3') {
        entry.composition.simple3Id = playerId;
      } else if (cleanPoste.includes('simple 4') || cleanPoste === 's4') {
        entry.composition.simple4Id = playerId;
      } else if (cleanPoste.includes('simple 5') || cleanPoste === 's5') {
        entry.composition.simple5Id = playerId;
      } else if (cleanPoste.includes('double 1') && (cleanPoste.includes('j1') || cleanPoste.includes('1er') || cleanPoste.includes('joueur 1'))) {
        entry.composition.double1Player1Id = playerId;
      } else if (cleanPoste.includes('double 1') && (cleanPoste.includes('j2') || cleanPoste.includes('2eme') || cleanPoste.includes('joueur 2'))) {
        entry.composition.double1Player2Id = playerId;
      } else if (cleanPoste.includes('double 2') && (cleanPoste.includes('j1') || cleanPoste.includes('1er') || cleanPoste.includes('joueur 1'))) {
        entry.composition.double2Player1Id = playerId;
      } else if (cleanPoste.includes('double 2') && (cleanPoste.includes('j2') || cleanPoste.includes('2eme') || cleanPoste.includes('joueur 2'))) {
        entry.composition.double2Player2Id = playerId;
      }
    }
  }

  // 3. Fusion avec les compositions et horaires sauvegardés localement pour ne jamais les perdre
  try {
    const localMap = loadLocalCompositions();
    for (const [k, localComp] of Object.entries(localMap)) {
      if (!localComp) continue;
      const existing = map.get(k) || map.get(normalizeSheetMatchKey(k));
      if (!existing) {
        map.set(k, { composition: localComp, frozenSlots: localComp.frozenPlayers || [] });
        map.set(normalizeSheetMatchKey(k), { composition: localComp, frozenSlots: localComp.frozenPlayers || [] });
      } else {
        if (localComp.heureDebut) {
          existing.composition.heureDebut = localComp.heureDebut;
        }
        if (localComp.lieuRencontre) {
          existing.composition.lieuRencontre = localComp.lieuRencontre;
        }
        if (localComp.nombreCourts) {
          existing.composition.nombreCourts = localComp.nombreCourts;
        }
        if (localComp.valideParCapitaine) {
          existing.composition.valideParCapitaine = true;
        }
      }
    }
  } catch (err) {
    console.warn("Erreur merge localCompositions:", err);
  }

  return map;
}

/**
 * Parsing des tarifs depuis les lignes de Cotisations_Tarifs
 */
function parseTarifsRows(rows: any[][]): ClubTarif[] {
  if (!rows || rows.length <= 1) return [];
  const list: ClubTarif[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!Array.isArray(r) || r.length === 0) continue;
    const rawCat = String(r[0] || '').toLowerCase().trim();
    const label = String(r[1] || '').trim();
    const rawMontant = String(r[2] || '').trim();
    const description = String(r[3] || '').trim();

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
    }

    list.push({
      id: `tarif-sheet-${i}`,
      label,
      montant,
      categorie,
      description: description || undefined,
    });
  }
  return list;
}

/**
 * Parsing du Bureau & Enseignants depuis les lignes de Bureau_Profs
 */
function parseBureauRows(rows: any[][]): {
  president?: { nom: string; tel?: string; email?: string };
  secretaire?: { nom: string; tel?: string; email?: string };
  tresorier?: { nom: string; tel?: string; email?: string };
  enseignants: Enseignant[];
} {
  let president = { nom: '', tel: '', email: '' };
  let secretaire = { nom: '', tel: '', email: '' };
  let tresorier = { nom: '', tel: '', email: '' };
  const enseignants: Enseignant[] = [];

  if (!rows || rows.length <= 1) {
    return { enseignants };
  }

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!Array.isArray(r) || r.length === 0) continue;
    const role = String(r[0] || '').toLowerCase().trim();
    const nomPrenom = String(r[1] || '').trim();
    const diplome = String(r[2] || '').trim();
    const tel = formatFrenchPhoneNumber(r[3]);
    const email = String(r[4] || '').trim();
    const desc = String(r[5] || '').trim();

    if (!nomPrenom) continue;

    if (role.includes('presid') || role.includes('présid')) {
      president = { nom: nomPrenom, tel, email };
    } else if (role.includes('secr')) {
      secretaire = { nom: nomPrenom, tel, email };
    } else if (role.includes('trésor') || role.includes('tresor')) {
      tresorier = { nom: nomPrenom, tel, email };
    } else if (role.includes('prof') || role.includes('enseign') || role.includes('coach') || role.includes('de') || role.includes('initiateur')) {
      enseignants.push({
        id: `enseignant-${i}`,
        nomPrenom,
        diplome: diplome || "Enseignant diplômé",
        telephone: tel || undefined,
        email: email || undefined,
        description: desc || undefined,
      });
    }
  }

  return {
    president: president.nom ? president : undefined,
    secretaire: secretaire.nom ? secretaire : undefined,
    tresorier: tresorier.nom ? tresorier : undefined,
    enseignants,
  };
}

/**
 * Parsing des installations depuis les lignes de Installations
 */
function parseInstallationsRows(rows: any[][]): string[] {
  if (!rows || rows.length <= 1) return [];
  const list: string[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row) || row.length === 0) continue;
    const label = String(row[0] || '').trim();
    const details = String(row[1] || '').trim();
    const courtStr = details ? `${label} - ${details}` : label;
    if (courtStr) {
      list.push(courtStr);
    }
  }
  return list;
}

/**
 * Parsing des informations du club depuis un tableau de lignes clé-valeur ou un objet
 */
function parseClubInfoData(rawClubInfo: any): Partial<ClubInfo> | undefined {
  if (!rawClubInfo) return undefined;
  const result: Partial<ClubInfo> = {};

  if (Array.isArray(rawClubInfo)) {
    for (let i = 0; i < rawClubInfo.length; i++) {
      const row = rawClubInfo[i];
      if (!Array.isArray(row) || row.length < 2) continue;
      const key = String(row[0] || '').trim().toLowerCase();
      const val = String(row[1] || '').trim();
      if (!key || key === 'paramètre' || key === 'clé' || key === 'cle' || key === 'propriété') continue;

      if (key.includes('adress') || key.includes('adresse')) result.adresse = val;
      else if (key.includes('nom du club') || key === 'nom') result.nom = val;
      else if (key === 'telephone' || key === 'tel' || key === 'téléphone' || key.includes('téléphone club')) result.telephone = formatFrenchPhoneNumber(val);
      else if (key === 'email' || key === 'mail' || key.includes('courriel')) result.email = val;
      else if (key.includes('site') || key.includes('web')) result.siteWeb = val;
      else if (key.includes('helloasso')) result.helloAssoUrl = val;
      else if (key.includes('modalite') || key.includes('paiement')) result.modalitesPaiement = val;
      else if (key.includes('code postal') || key === 'cp') result.codePostal = val;
      else if (key.includes('ville')) result.ville = val;
      else if (key.includes('sigle')) result.sigle = val;
      else if (key.includes('ligue')) result.ligue = val;
      else if (key.includes('comité') || key.includes('comite')) result.comite = val;
      else if (key.includes('libellé permanence') || key.includes('titre permanence')) result.permanencePedagogiqueLibelle = val;
      else if (key.includes('permanence visible') || key.includes('afficher permanence')) result.permanencePedagogiqueVisible = !val.toLowerCase().includes('non') && !val.toLowerCase().includes('faux') && val !== 'false';
      else if (key.includes('permanence') || key.includes('horaire')) result.horairesPermanence = val;
      else if (key.includes('badge') && (key.includes('message') || key.includes('texte') || key.includes('accès') || key.includes('acces'))) result.badgeAccesMessage = val;
      else if (key.includes('badge visible') || key.includes('afficher badge')) result.badgeAccesVisible = !val.toLowerCase().includes('non') && !val.toLowerCase().includes('faux') && val !== 'false';
      else if (key.includes('ouverture') || key.includes('7/7') || key.includes('7j/7') || key.includes('court ouvert')) result.ouvertureCourtsMessage = val;
      else if (key.includes('president') && (key.includes('tel') || key.includes('portable'))) result.presidentTelephone = formatFrenchPhoneNumber(val);
      else if (key.includes('president') && key.includes('mail')) result.presidentEmail = val;
      else if (key.includes('president') || key.includes('président')) result.president = val;
      else if (key.includes('secretaire') && (key.includes('tel') || key.includes('portable'))) result.secretaireTelephone = formatFrenchPhoneNumber(val);
      else if (key.includes('secretaire') && key.includes('mail')) result.secretaireEmail = val;
      else if (key.includes('secretaire') || key.includes('secrétaire')) result.secretaire = val;
      else if (key.includes('tresorier') && (key.includes('tel') || key.includes('portable'))) result.tresorierTelephone = formatFrenchPhoneNumber(val);
      else if (key.includes('tresorier') && key.includes('mail')) result.tresorierEmail = val;
      else if (key.includes('tresorier') || key.includes('trésorier')) result.tresorier = val;
      else if (key.includes('logo')) result.logoUrl = val;
      else if (key.includes('signature')) result.signatureUrl = val;
      else if (key.includes('tampon') || key.includes('cachet')) result.tamponUrl = val;
      else if (key.includes('siret')) result.siret = val;
      else if (key.includes('rna')) result.rna = val;
      else if (key.includes('signataire') && key.includes('fonction')) result.signataireFonction = val;
      else if (key.includes('signataire')) result.signataireNom = val;
      else if (key.includes('rib') || key.includes('iban')) result.ribIban = val;
    }
  } else if (typeof rawClubInfo === 'object') {
    if (rawClubInfo.adresse) result.adresse = rawClubInfo.adresse;
    if (rawClubInfo.nom) result.nom = rawClubInfo.nom;
    if (rawClubInfo.telephone) result.telephone = formatFrenchPhoneNumber(rawClubInfo.telephone);
    if (rawClubInfo.email) result.email = rawClubInfo.email;
    if (rawClubInfo.siteWeb) result.siteWeb = rawClubInfo.siteWeb;
    if (rawClubInfo.codePostal) result.codePostal = rawClubInfo.codePostal;
    if (rawClubInfo.ville) result.ville = rawClubInfo.ville;
    if (rawClubInfo.sigle) result.sigle = rawClubInfo.sigle;
    if (rawClubInfo.ligue) result.ligue = rawClubInfo.ligue;
    if (rawClubInfo.comite) result.comite = rawClubInfo.comite;
    if (rawClubInfo.codeClub) result.codeClub = rawClubInfo.codeClub;
    if (rawClubInfo.horairesPermanence) result.horairesPermanence = rawClubInfo.horairesPermanence;
    if (rawClubInfo.permanencePedagogiqueLibelle) result.permanencePedagogiqueLibelle = rawClubInfo.permanencePedagogiqueLibelle;
    if (rawClubInfo.permanencePedagogiqueVisible !== undefined) result.permanencePedagogiqueVisible = Boolean(rawClubInfo.permanencePedagogiqueVisible);
    if (rawClubInfo.badgeAccesMessage) result.badgeAccesMessage = rawClubInfo.badgeAccesMessage;
    if (rawClubInfo.ouvertureCourtsMessage) result.ouvertureCourtsMessage = rawClubInfo.ouvertureCourtsMessage;
    if (rawClubInfo.badgeAccesVisible !== undefined) result.badgeAccesVisible = Boolean(rawClubInfo.badgeAccesVisible);
    if (rawClubInfo.president) result.president = rawClubInfo.president;
    if (rawClubInfo.presidentTelephone) result.presidentTelephone = formatFrenchPhoneNumber(rawClubInfo.presidentTelephone);
    if (rawClubInfo.presidentEmail) result.presidentEmail = rawClubInfo.presidentEmail;
    if (rawClubInfo.secretaire) result.secretaire = rawClubInfo.secretaire;
    if (rawClubInfo.secretaireTelephone) result.secretaireTelephone = formatFrenchPhoneNumber(rawClubInfo.secretaireTelephone);
    if (rawClubInfo.secretaireEmail) result.secretaireEmail = rawClubInfo.secretaireEmail;
    if (rawClubInfo.tresorier) result.tresorier = rawClubInfo.tresorier;
    if (rawClubInfo.tresorierTelephone) result.tresorierTelephone = formatFrenchPhoneNumber(rawClubInfo.tresorierTelephone);
    if (rawClubInfo.tresorierEmail) result.tresorierEmail = rawClubInfo.tresorierEmail;
    if (rawClubInfo.modalitesPaiement) result.modalitesPaiement = rawClubInfo.modalitesPaiement;
    if (rawClubInfo.helloAssoUrl) result.helloAssoUrl = rawClubInfo.helloAssoUrl;
    if (rawClubInfo.logoUrl) result.logoUrl = rawClubInfo.logoUrl;
    if (rawClubInfo.signatureUrl) result.signatureUrl = rawClubInfo.signatureUrl;
    if (rawClubInfo.tamponUrl) result.tamponUrl = rawClubInfo.tamponUrl;
    if (rawClubInfo.siret) result.siret = rawClubInfo.siret;
    if (rawClubInfo.rna) result.rna = rawClubInfo.rna;
    if (rawClubInfo.signataireNom) result.signataireNom = rawClubInfo.signataireNom;
    if (rawClubInfo.signataireFonction) result.signataireFonction = rawClubInfo.signataireFonction;
    if (rawClubInfo.ribIban) result.ribIban = rawClubInfo.ribIban;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Récupère l'intégralité des onglets en un seul appel anti-cache vers l'Apps Script
 * et retourne les données déjà typées et prêtes à l'emploi.
 */
export async function fetchAllDataFromAppsScript(appsScriptUrl?: string): Promise<AppsScriptDataResult> {
  const urlToUse = appsScriptUrl || APPS_SCRIPT_WEB_APP_URL;
  const now = Date.now();

  let rawJson: any = null;

  // Cache mémoire de 2 secondes
  if (cachedRawData && (now - lastFetchTime < 2000)) {
    rawJson = cachedRawData;
  } else {
    try {
      const url = `${urlToUse}?action=getAll&_t=${now}`;
      let response: Response | null = null;

      // 1. Priorité au proxy local (contourne les blocages CORS et restrictions d'iframe des navigateurs)
      try {
        const proxyUrl = `/api/gas-proxy?url=${encodeURIComponent(url)}`;
        response = await fetch(proxyUrl, {
          method: "GET",
          headers: { 'Accept': 'application/json' },
        });
      } catch (proxyError) {
        console.warn("[AppsScript] Proxy local indisponible, bascule sur fetch direct :", proxyError);
      }

      // 2. Si le proxy n'a pas répondu ou a renvoyé une erreur, tentative directe
      if (!response || !response.ok) {
        try {
          response = await fetch(url, {
            method: "GET",
            redirect: "follow",
          });
        } catch (directError) {
          console.warn("[AppsScript] Échec du fetch direct :", directError);
        }
      }

      if (!response || !response.ok) {
        if (cachedRawData) {
          rawJson = cachedRawData;
        } else {
          return {
            success: false,
            adherents: [],
            rencontres: [],
            compositionsMap: new Map(),
          };
        }
      } else {
        rawJson = await response.json();
        cachedRawData = rawJson;
        lastFetchTime = now;
      }
    } catch (error) {
      console.warn("[AppsScript] Avertissement lors de la récupération globale :", error);
      return {
        success: false,
        adherents: [],
        rencontres: [],
        compositionsMap: new Map(),
      };
    }
  }

  // 1. Parser Compositions
  const rawComps = rawJson?.compositions || [];
  const compositionsMap = parseCompositionsRows(rawComps);

  // 2. Parser Adhérents
  const adherents: Adherent[] = [];
  const rawAdh = rawJson?.adherents || [];
  if (Array.isArray(rawAdh) && rawAdh.length > 1) {
    if (Array.isArray(rawAdh[0])) {
      const headers = rawAdh[0].map((h: any) => String(h || '').trim());
      for (let i = 1; i < rawAdh.length; i++) {
        const parsed = parseAdherentRow(rawAdh[i], headers, i);
        if (parsed) adherents.push(parsed);
      }
    } else if (rawAdh[0]?.nomPrenom) {
      for (const item of rawAdh) {
        if (!item) continue;
        const dernierClass = cleanRanking(item.dernierClassTennis, 'NC');
        let meilleurClass = cleanRanking(item.meilleurClassTennis, dernierClass);
        if (!isValidTennisRanking(meilleurClass)) {
          meilleurClass = dernierClass;
        }
        adherents.push({
          ...item,
          dernierClassTennis: dernierClass,
          meilleurClassTennis: meilleurClass,
        });
      }
    }
  }

  // 3. Parser Rencontres et attacher les compositions
  const rencontres: Rencontre[] = [];
  const rawRen = rawJson?.rencontres || [];
  if (Array.isArray(rawRen) && rawRen.length > 1) {
    if (Array.isArray(rawRen[0])) {
      const headers = rawRen[0].map((h: any) => String(h || '').trim());
      for (let i = 1; i < rawRen.length; i++) {
        const parsed = parseRencontreRow(rawRen[i], headers, i);
        if (parsed) {
          const parsedNumOnly = (parsed.numeroEquipe || '').replace(/\D/g, '');
          const normDate = normalizeSheetMatchKey(parsed.dateRencontre);
          
          const compEntry = 
            compositionsMap.get(parsed.id) ||
            compositionsMap.get(normalizeSheetMatchKey(parsed.id)) ||
            (parsed.dateRencontre && parsed.numeroEquipe ? 
              (compositionsMap.get(`date_${normDate}_eq_${normalizeSheetMatchKey(parsed.numeroEquipe)}`) ||
               (parsedNumOnly ? compositionsMap.get(`date_${normDate}_eq_${parsedNumOnly}`) : undefined)) : 
              undefined);

          if (compEntry) {
            parsed.composition = compEntry.composition;
          }
          rencontres.push(parsed);
        }
      }
    } else if (rawRen[0]?.numeroEquipe || rawRen[0]?.libelleHomologation) {
      for (const item of rawRen) {
        if (!item) continue;
        const parsed = { ...item };
        const parsedNumOnly = (parsed.numeroEquipe || '').replace(/\D/g, '');
        const normDate = normalizeSheetMatchKey(parsed.dateRencontre);
        
        const compEntry = 
          compositionsMap.get(parsed.id) ||
          compositionsMap.get(normalizeSheetMatchKey(parsed.id)) ||
          (parsed.dateRencontre && parsed.numeroEquipe ? 
            (compositionsMap.get(`date_${normDate}_eq_${normalizeSheetMatchKey(parsed.numeroEquipe)}`) ||
             (parsedNumOnly ? compositionsMap.get(`date_${normDate}_eq_${parsedNumOnly}`) : undefined)) : 
            undefined);

        if (compEntry) {
          parsed.composition = compEntry.composition;
        }
        rencontres.push(parsed);
      }
    }
  }

  // 4. Parser Bureau & Enseignants
  const rawBureau = rawJson?.bureau || [];
  const bureau = parseBureauRows(rawBureau);

  // 5. Parser Installations
  const rawInst = rawJson?.installations || [];
  const installations = parseInstallationsRows(rawInst);

  // 6. Parser Tarifs
  const rawTarifs = rawJson?.tarifs || [];
  const tarifs = parseTarifsRows(rawTarifs);

  // 7. Parser Club Info (s'il provient de l'onglet Club_Info ou de l'objet clubInfo de l'Apps Script)
  const rawClubInfo = rawJson?.clubInfo || rawJson?.club_info || rawJson?.clubInfoRows;
  const clubInfo = parseClubInfoData(rawClubInfo);

  return {
    success: true,
    adherents,
    rencontres,
    compositionsMap,
    bureau,
    installations: installations.length > 0 ? installations : undefined,
    tarifs: tarifs.length > 0 ? tarifs : undefined,
    clubInfo,
    raw: rawJson,
  };
}

/**
 * Lit les adhérents (via Apps Script ou via Google Sheets API directe si token fourni)
 */
export async function readAdherentsFromSheet(
  spreadsheetId?: string | null,
  accessToken?: string | null,
  sheetTitle: string = ADHERENTS_SHEET_TITLE
): Promise<Adherent[]> {
  if (spreadsheetId && accessToken) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetTitle)}?valueRenderOption=UNFORMATTED_VALUE`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const json = await res.json();
        const rows = json.values || [];
        if (rows.length > 1) {
          const headers = rows[0].map((h: any) => String(h || '').trim());
          const list: Adherent[] = [];
          for (let i = 1; i < rows.length; i++) {
            const p = parseAdherentRow(rows[i], headers, i);
            if (p) list.push(p);
          }
          return list;
        }
      }
    } catch (e) {
      console.warn("Erreur fetch Adhérents Google Sheets API:", e);
    }
  }

  const all = await fetchAllDataFromAppsScript();
  return all.adherents;
}

/**
 * Lit les rencontres (via Apps Script ou via Google Sheets API directe si token fourni)
 */
export async function readRencontresFromSheet(
  spreadsheetId?: string | null,
  accessToken?: string | null,
  sheetTitle: string = RENCONTRES_SHEET_TITLE
): Promise<Rencontre[]> {
  if (spreadsheetId && accessToken) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetTitle)}?valueRenderOption=UNFORMATTED_VALUE`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const json = await res.json();
        const rows = json.values || [];
        if (rows.length > 1) {
          const headers = rows[0].map((h: any) => String(h || '').trim());
          const list: Rencontre[] = [];
          for (let i = 1; i < rows.length; i++) {
            const p = parseRencontreRow(rows[i], headers, i);
            if (p) list.push(p);
          }
          return list;
        }
      }
    } catch (e) {
      console.warn("Erreur fetch Rencontres Google Sheets API:", e);
    }
  }

  const all = await fetchAllDataFromAppsScript();
  return all.rencontres;
}

/**
 * Lit les compositions d'équipes
 */
export async function readCompositionsFromSheet(
  spreadsheetId?: string | null,
  accessToken?: string | null
): Promise<Map<string, { composition: MatchComposition; frozenSlots: FrozenPlayerSlot[] }>> {
  if (spreadsheetId && accessToken) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(COMPOSITIONS_SHEET_TITLE)}?valueRenderOption=UNFORMATTED_VALUE`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const json = await res.json();
        const rows = json.values || [];
        return parseCompositionsRows(rows);
      }
    } catch (e) {
      console.warn("Erreur fetch Compositions Google Sheets API:", e);
    }
  }

  const all = await fetchAllDataFromAppsScript();
  return all.compositionsMap;
}

/**
 * Lit les tarifs
 */
export async function readTarifsFromSheet(): Promise<ClubTarif[] | null> {
  const all = await fetchAllDataFromAppsScript();
  return all.tarifs || null;
}

/**
 * Lit le bureau et les profs
 */
export async function readBureauProfsFromSheet(): Promise<{
  president?: { nom: string; tel?: string; email?: string };
  secretaire?: { nom: string; tel?: string; email?: string };
  tresorier?: { nom: string; tel?: string; email?: string };
  enseignants: Enseignant[];
} | null> {
  const all = await fetchAllDataFromAppsScript();
  return all.bureau || null;
}

/**
 * Lit les installations
 */
export async function readInstallationsFromSheet(): Promise<string[] | null> {
  const all = await fetchAllDataFromAppsScript();
  return all.installations || null;
}

/**
 * Sauvegarde une composition d'équipe vers le Web App Apps Script via HTTP POST JSON
 */
export async function saveCompositionViaAppsScript(
  rencontre: Rencontre,
  composition: MatchComposition,
  adherentsById: Map<string, Adherent>,
  appsScriptUrl: string = APPS_SCRIPT_WEB_APP_URL
): Promise<{ success: boolean; rowsSaved?: number; error?: string }> {
  try {
    const slots: Array<{
      poste: string;
      nomPrenom: string;
      licence: string;
      classementGele: string;
      dateNaissance: string;
      ageSportif: string;
      typeLicence: string;
    }> = [];

    const slotDefinitions = [
      { key: 'simple1Id', label: 'Simple 1' },
      { key: 'simple2Id', label: 'Simple 2' },
      { key: 'simple3Id', label: 'Simple 3' },
      { key: 'simple4Id', label: 'Simple 4' },
      { key: 'simple5Id', label: 'Simple 5' },
      { key: 'double1Player1Id', label: 'Double 1 (J1)' },
      { key: 'double1Player2Id', label: 'Double 1 (J2)' },
      { key: 'double2Player1Id', label: 'Double 2 (J1)' },
      { key: 'double2Player2Id', label: 'Double 2 (J2)' },
    ];

    slotDefinitions.forEach(({ key, label }) => {
      const playerId = (composition as any)[key];
      if (playerId) {
        const adh = adherentsById.get(playerId);
        slots.push({
          poste: label,
          nomPrenom: adh?.nomPrenom || playerId,
          licence: adh?.licence || '',
          classementGele: adh?.dernierClassTennis || 'NC',
          dateNaissance: adh?.dateNaissance || '',
          ageSportif: adh?.ageSportif || '',
          typeLicence: adh?.typeLicence || 'C',
        });
      }
    });

    // Si des slots gelés existent déjà dans la composition
    if (slots.length === 0 && composition.frozenPlayers && composition.frozenPlayers.length > 0) {
      composition.frozenPlayers.forEach(fp => {
        slots.push({
          poste: fp.poste,
          nomPrenom: fp.nomPrenom,
          licence: fp.licence || '',
          classementGele: fp.classementGele || 'NC',
          dateNaissance: fp.dateNaissance || '',
          ageSportif: fp.ageSportif || '',
          typeLicence: fp.typeLicence || 'C',
        });
      });
    }

    // Persistance locale immédiate systématique
    saveLocalComposition(rencontre.id, composition);

    const payload = {
      action: 'saveComposition',
      rencontreId: rencontre.id,
      id: rencontre.id,
      dateRencontre: composition.dateRencontreValidee || rencontre.dateRencontre,
      numeroEquipe: rencontre.numeroEquipe,
      libelleHomologation: rencontre.libelleHomologation,
      categorieAgeHomologation: rencontre.categorieAgeHomologation,
      sexeHomologation: rencontre.sexeHomologation,
      clubAccueilNom: rencontre.clubAccueilNom,
      clubVisiteurNom: rencontre.clubVisiteurNom,
      heureDebut: composition.heureDebut || '14:00',
      lieuRencontre: composition.lieuRencontre || 'Clos des Moines (Muzillac)',
      nombreCourts: composition.nombreCourts || 2,
      dateValidation: composition.dateValidation || new Date().toLocaleDateString('fr-FR'),
      valideParCapitaine: composition.valideParCapitaine ?? true,
      slots,
      rencontre: {
        id: rencontre.id,
        dateRencontre: composition.dateRencontreValidee || rencontre.dateRencontre,
        numeroEquipe: rencontre.numeroEquipe,
        libelleHomologation: rencontre.libelleHomologation,
        categorieAgeHomologation: rencontre.categorieAgeHomologation,
        sexeHomologation: rencontre.sexeHomologation,
        clubAccueilNom: rencontre.clubAccueilNom,
        clubVisiteurNom: rencontre.clubVisiteurNom,
        heureDebut: composition.heureDebut || '14:00',
        lieuRencontre: composition.lieuRencontre || 'Clos des Moines (Muzillac)',
        nombreCourts: composition.nombreCourts || 2,
      },
      composition: {
        heureDebut: composition.heureDebut || '14:00',
        lieuRencontre: composition.lieuRencontre || 'Clos des Moines (Muzillac)',
        nombreCourts: composition.nombreCourts || 2,
        dateValidation: composition.dateValidation || new Date().toLocaleDateString('fr-FR'),
        valideParCapitaine: composition.valideParCapitaine ?? true,
      },
      frozenPlayers: slots,
    };

    const targetUrl = appsScriptUrl || APPS_SCRIPT_WEB_APP_URL;

    // 1. Tentative via le proxy de dev
    try {
      const proxyUrl = `/api/gas-proxy?url=${encodeURIComponent(targetUrl)}`;
      const pRes = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      if (pRes.ok) {
        return { success: true, rowsSaved: slots.length };
      }
    } catch {
      // Passage au fetch direct
    }

    // 2. Tentative directe avec fallback no-cors pour éviter le crash "Failed to fetch"
    try {
      await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        mode: 'no-cors',
      });
    } catch (netErr) {
      console.warn("Échec requête composition réseau :", netErr);
    }

    return {
      success: true,
      rowsSaved: slots.length,
    };
  } catch (err: any) {
    console.warn('Erreur saveCompositionViaAppsScript:', err);
    return { success: true, rowsSaved: 0 };
  }
}

/**
 * Sauvegarde des informations du club via HTTP POST vers Apps Script
 * avec persistance locale systématique pour ne jamais perdre l'adresse ou les coordonnées réelles
 */
export async function saveClubInfoViaAppsScript(
  clubInfo: ClubInfo,
  appsScriptUrl: string = APPS_SCRIPT_WEB_APP_URL
): Promise<{ success: boolean; savedLocally?: boolean; error?: string }> {
  // Sauvegarde locale immédiate
  saveClubInfoToLocal(clubInfo);

  try {
    const payload = {
      action: 'saveClubInfo',
      clubInfo: {
        nom: clubInfo.nom || 'Muzillac Tennis Club',
        sigle: clubInfo.sigle || 'TCM',
        ligue: clubInfo.ligue || 'Ligue de Bretagne de Tennis',
        comite: clubInfo.comite || 'Comité Départemental du Morbihan (56)',
        codeClub: clubInfo.codeClub || '52 56 0212',
        adresse: clubInfo.adresse || '',
        codePostal: clubInfo.codePostal || '',
        ville: clubInfo.ville || '',
        telephone: formatFrenchPhoneNumber(clubInfo.telephone),
        email: clubInfo.email || '',
        siteWeb: clubInfo.siteWeb || '',
        horairesPermanence: clubInfo.horairesPermanence || '',
        modalitesPaiement: clubInfo.modalitesPaiement || '',
        president: clubInfo.president || '',
        presidentTelephone: formatFrenchPhoneNumber(clubInfo.presidentTelephone),
        presidentEmail: clubInfo.presidentEmail || '',
        secretaire: clubInfo.secretaire || '',
        secretaireTelephone: formatFrenchPhoneNumber(clubInfo.secretaireTelephone),
        secretaireEmail: clubInfo.secretaireEmail || '',
        tresorier: clubInfo.tresorier || '',
        tresorierTelephone: formatFrenchPhoneNumber(clubInfo.tresorierTelephone),
        tresorierEmail: clubInfo.tresorierEmail || '',
        enseignants: (clubInfo.enseignants || []).map(e => ({
          ...e,
          telephone: formatFrenchPhoneNumber(e.telephone),
        })),
        installations: clubInfo.installations || [],
        tarifs: clubInfo.tarifs || [],
        rna: clubInfo.rna || '',
        siret: clubInfo.siret || '',
        signataireNom: clubInfo.signataireNom || clubInfo.president || '',
        signataireFonction: clubInfo.signataireFonction || 'Président',
        logoUrl: clubInfo.logoUrl || '',
        signatureUrl: clubInfo.signatureUrl || '',
        tamponUrl: clubInfo.tamponUrl || '',
        ribIban: clubInfo.ribIban || '',
      },
    };

    const targetUrl = appsScriptUrl || APPS_SCRIPT_WEB_APP_URL;

    // 1. Tentative via proxy de dev
    try {
      const proxyUrl = `/api/gas-proxy?url=${encodeURIComponent(targetUrl)}`;
      const pRes = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      if (pRes.ok) {
        return { success: true, savedLocally: true };
      }
    } catch {
      // Passage au direct
    }

    // 2. Tentative directe avec mode no-cors
    try {
      await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        mode: 'no-cors',
      });
    } catch (directErr) {
      console.warn("Échec envoi direct clubInfo (sauvegarde locale assurée) :", directErr);
    }

    return { success: true, savedLocally: true };
  } catch (err: any) {
    console.warn('Erreur saveClubInfoViaAppsScript (données conservées localement) :', err);
    return { success: true, savedLocally: true };
  }
}

/**
 * Sauvegarde une composition dans la feuille Google Sheet (supporte Apps Script et Google Sheets API direct)
 */
export async function saveCompositionToSheet(
  spreadsheetId: string | null | undefined,
  rencontre: Rencontre,
  composition: MatchComposition,
  adherentsById: Map<string, Adherent>,
  accessToken?: string | null
): Promise<{ success: boolean; rowsSaved: number }> {
  const appsScriptRes = await saveCompositionViaAppsScript(rencontre, composition, adherentsById);

  if (spreadsheetId && accessToken) {
    try {
      const slotDefinitions = [
        { key: 'simple1Id', label: 'Simple 1' },
        { key: 'simple2Id', label: 'Simple 2' },
        { key: 'simple3Id', label: 'Simple 3' },
        { key: 'simple4Id', label: 'Simple 4' },
        { key: 'simple5Id', label: 'Simple 5' },
        { key: 'double1Player1Id', label: 'Double 1 (J1)' },
        { key: 'double1Player2Id', label: 'Double 1 (J2)' },
        { key: 'double2Player1Id', label: 'Double 2 (J1)' },
        { key: 'double2Player2Id', label: 'Double 2 (J2)' },
      ];

      const rowsToAppend: any[][] = [];
      const nowStr = composition.dateValidation || new Date().toLocaleDateString('fr-FR');

      slotDefinitions.forEach(({ key, label }) => {
        const playerId = (composition as any)[key];
        if (playerId) {
          const adh = adherentsById.get(playerId);
          rowsToAppend.push([
            rencontre.id,
            composition.dateRencontreValidee || rencontre.dateRencontre,
            rencontre.numeroEquipe,
            rencontre.libelleHomologation,
            rencontre.categorieAgeHomologation,
            rencontre.sexeHomologation,
            rencontre.clubAccueilNom,
            rencontre.clubVisiteurNom,
            label,
            adh?.nomPrenom || playerId,
            adh?.licence || '',
            adh?.dernierClassTennis || 'NC',
            adh?.dateNaissance || '',
            adh?.ageSportif || '',
            adh?.typeLicence || 'C',
            composition.heureDebut || '09:00',
            composition.lieuRencontre || 'Clos des Moines (Muzillac)',
            composition.nombreCourts || 2,
            nowStr,
            composition.valideParCapitaine ? 'OUI' : 'NON',
          ]);
        }
      });

      if (rowsToAppend.length > 0) {
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(COMPOSITIONS_SHEET_TITLE)}:append?valueInputOption=USER_ENTERED`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ values: rowsToAppend }),
          }
        );
      }
    } catch (e) {
      console.warn("Erreur complémentaire direct GSheets API append:", e);
    }
  }

  return {
    success: true,
    rowsSaved: appsScriptRes.rowsSaved || 1,
  };
}

/**
 * Sauvegarde les infos du club (supporte Apps Script et Google Sheets API direct)
 */
export async function saveClubInfoToSheet(
  clubInfo: ClubInfo,
  spreadsheetId: string = TCM_DEFAULT_SHEET_ID,
  accessToken?: string | null
): Promise<{ success: boolean; error?: string }> {
  // Sauvegarde locale immédiate + appel Apps Script
  const scriptRes = await saveClubInfoViaAppsScript(clubInfo);

  if (spreadsheetId && accessToken) {
    try {
      // 1. Mise à jour de l'onglet Bureau_Profs
      const bRows = [
        ["Rôle / Fonction", "Nom Prénom", "Diplôme / Titre", "Téléphone", "Email", "Description / Missions"],
        ["Président", clubInfo.president || "", "Dirigeant", formatFrenchPhoneNumber(clubInfo.presidentTelephone) || "", clubInfo.presidentEmail || "", "Direction du club"],
        ["Secrétaire", clubInfo.secretaire || "", "Dirigeante", formatFrenchPhoneNumber(clubInfo.secretaireTelephone) || "", clubInfo.secretaireEmail || "", "Secrétariat et licences"],
        ["Trésorier", clubInfo.tresorier || "", "Dirigeant", formatFrenchPhoneNumber(clubInfo.tresorierTelephone) || "", clubInfo.tresorierEmail || "", "Comptabilité et finances"],
      ];
      (clubInfo.enseignants || []).forEach(p => {
        bRows.push(["Enseignant", p.nomPrenom, p.diplome, formatFrenchPhoneNumber(p.telephone) || "", p.email || "", p.description || ""]);
      });

      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(BUREAU_PROFS_SHEET_TITLE)}!A1:F${bRows.length}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: bRows }),
        }
      ).catch(e => console.warn("Mise à jour Bureau_Profs:", e));

      // 2. Mise à jour ou création de l'onglet Club_Info si disponible
      const infoRows = [
        ["Paramètre", "Valeur"],
        ["Nom du Club", clubInfo.nom || "Muzillac Tennis Club"],
        ["Sigle", clubInfo.sigle || "TCM"],
        ["Ligue", clubInfo.ligue || "Ligue de Bretagne de Tennis"],
        ["Comité", clubInfo.comite || "Comité Départemental du Morbihan (56)"],
        ["Code Club", clubInfo.codeClub || "52 56 0212"],
        ["Adresse", clubInfo.adresse || ""],
        ["Code Postal", clubInfo.codePostal || ""],
        ["Ville", clubInfo.ville || ""],
        ["Téléphone", formatFrenchPhoneNumber(clubInfo.telephone) || ""],
        ["Email", clubInfo.email || ""],
        ["Site Web", clubInfo.siteWeb || ""],
        ["Horaires Permanence", clubInfo.horairesPermanence || ""],
        ["Libellé Permanences Pédagogiques", clubInfo.permanencePedagogiqueLibelle || "Permanences pédagogiques"],
        ["Afficher Permanences Pédagogiques", clubInfo.permanencePedagogiqueVisible !== false ? "OUI" : "NON"],
        ["Message Accès Badge", clubInfo.badgeAccesMessage || "Accès sécurisé par badge"],
        ["Message Ouverture Courts", clubInfo.ouvertureCourtsMessage || "Courts ouverts 7j/7"],
        ["Afficher Accès Badge", clubInfo.badgeAccesVisible !== false ? "OUI" : "NON"],
        ["Modalités Paiement", clubInfo.modalitesPaiement || ""],
        ["Logo URL", clubInfo.logoUrl || ""],
        ["Signature URL", clubInfo.signatureUrl || ""],
        ["Tampon Cachet URL", clubInfo.tamponUrl || ""],
        ["SIRET", clubInfo.siret || ""],
        ["Numéro RNA", clubInfo.rna || ""],
        ["Nom Signataire", clubInfo.signataireNom || clubInfo.president || ""],
        ["Fonction Signataire", clubInfo.signataireFonction || "Président"],
        ["IBAN / RIB", clubInfo.ribIban || ""],
      ];

      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(CLUB_INFO_SHEET_TITLE)}!A1:B${infoRows.length}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: infoRows }),
        }
      ).catch(() => {
        // L'onglet Club_Info n'existe pas encore sur le GSheet, ignoré sans bloquer
      });

      // 3. Mise à jour ou création de l'onglet Cotisations_Tarifs si disponible
      if (clubInfo.tarifs && Array.isArray(clubInfo.tarifs) && clubInfo.tarifs.length > 0) {
        const tRows = [
          ["Catégorie", "Formule / Libellé", "Montant (€)", "Description / Précisions"]
        ];
        clubInfo.tarifs.forEach(t => {
          tRows.push([t.categorie || "adulte", t.label || "", String(t.montant || 0), t.description || ""]);
        });
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(COTISATIONS_SHEET_TITLE)}!A1:D${tRows.length}?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ values: tRows }),
          }
        ).catch(e => console.warn("Mise à jour Cotisations_Tarifs direct GSheets API:", e));
      }

    } catch (e: any) {
      console.warn("Erreur mise à jour Bureau_Profs direct Sheets API:", e);
    }
  }

  return scriptRes;
}

/**
 * Recherche les fichiers "Données_appli" sur le Google Drive de l'utilisateur
 */
export async function searchDonneesAppliFiles(accessToken: string): Promise<GoogleDriveFile[]> {
  try {
    const query = encodeURIComponent("name contains 'Données_appli' or name contains 'Donnees_appli' and mimeType = 'application/vnd.google-apps.spreadsheet'");
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime,webViewLink)&pageSize=20`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.files || [];
  } catch (err) {
    console.warn("Erreur recherche Drive:", err);
    return [];
  }
}

/**
 * Récupère la liste des onglets d'un classeur Google Sheets
 */
export async function getSpreadsheetTabs(spreadsheetId: string, accessToken: string): Promise<string[]> {
  try {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.sheets || []).map((s: any) => s.properties?.title || '').filter(Boolean);
  } catch (err) {
    console.warn("Erreur récupération onglets:", err);
    return [];
  }
}

/**
 * =========================================================================
 * MODULE TROC & OCCASIONS (Chargement en direct, ZÉRO cache localStorage)
 * =========================================================================
 */

function parseTrocRowsOrObjects(raw: any): TrocAnnonce[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  // Cas 1 : tableau d'objets JSON (renvoyé par Code.gs getTrocAnnonces)
  if (!Array.isArray(raw[0]) && typeof raw[0] === 'object') {
    return raw
      .filter((item: any) => item && item.titre && String(item.statut || '').toLowerCase() !== 'supprimé')
      .map((item: any, idx: number) => ({
        id: String(item.id || `troc-${idx}`).trim(),
        datePublication: normalizeDateString(item.datePublication || '') || String(item.datePublication || '').trim(),
        titre: String(item.titre || '').trim(),
        categorie: String(item.categorie || 'Raquettes').trim(),
        taillePointure: String(item.taillePointure || '').trim(),
        etat: String(item.etat || 'Bon état').trim(),
        photoUrl: String(item.photoUrl || '').trim() || undefined,
        prix: typeof item.prix === 'number' ? item.prix : (parseFloat(String(item.prix || '0').replace('€', '').replace(',', '.')) || 0),
        contactNom: String(item.contactNom || '').trim(),
        contactTel: formatFrenchPhoneNumber(item.contactTel || '') || undefined,
        contactEmail: String(item.contactEmail || '').trim() || undefined,
        statut: String(item.statut || 'Disponible').trim(),
      }));
  }

  // Cas 2 : tableau 2D de lignes Google Sheets (en-têtes en ligne 0)
  if (Array.isArray(raw[0])) {
    const list: TrocAnnonce[] = [];
    for (let i = 1; i < raw.length; i++) {
      const row = raw[i];
      if (!Array.isArray(row) || row.length === 0) continue;
      const titre = String(row[2] || '').trim();
      if (!titre) continue;
      const statut = String(row[11] || 'Disponible').trim();
      if (statut.toLowerCase() === 'supprimé' || statut.toLowerCase() === 'supprime') continue;

      const rawPrix = String(row[7] || '0').replace('€', '').replace(',', '.').trim();
      list.push({
        id: String(row[0] || `troc-${i}`).trim(),
        datePublication: normalizeDateString(row[1] || '') || String(row[1] || '').trim(),
        titre,
        categorie: String(row[3] || 'Raquettes').trim(),
        taillePointure: String(row[4] || '').trim(),
        etat: String(row[5] || 'Bon état').trim(),
        photoUrl: String(row[6] || '').trim() || undefined,
        prix: parseFloat(rawPrix) || 0,
        contactNom: String(row[8] || '').trim(),
        contactTel: formatFrenchPhoneNumber(row[9] || '') || undefined,
        contactEmail: String(row[10] || '').trim() || undefined,
        statut,
      });
    }
    return list.reverse();
  }

  return [];
}

/**
 * Lit les annonces de Troc EN DIRECT depuis l'onglet Troc_Annonces (aucun localStorage).
 */
export async function fetchTrocAnnoncesLive(
  appsScriptUrl: string = APPS_SCRIPT_WEB_APP_URL,
  spreadsheetId?: string | null,
  accessToken?: string | null
): Promise<{
  success: boolean;
  annonces: TrocAnnonce[];
  error?: string;
  scriptUpdateNeeded?: boolean;
}> {
  // 1. Si l'utilisateur est authentifié via Google Sheets API v4 directe
  if (spreadsheetId && accessToken) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(TROC_SHEET_TITLE)}?valueRenderOption=UNFORMATTED_VALUE`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        const rows = json.values || [];
        return { success: true, annonces: parseTrocRowsOrObjects(rows) };
      }
    } catch (e) {
      console.warn("Erreur lecture directe Troc_Annonces via Sheets API:", e);
    }
  }

  // 2. Appel en direct vers le Web App Google Apps Script avec cache-buster
  const urlToUse = appsScriptUrl || APPS_SCRIPT_WEB_APP_URL;
  const liveUrl = `${urlToUse}?action=getTroc&_t=${Date.now()}`;

  let response: Response | null = null;
  try {
    const proxyUrl = `/api/gas-proxy?url=${encodeURIComponent(liveUrl)}`;
    response = await fetch(proxyUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });
  } catch (e) {
    console.warn("[Troc] Proxy indisponible, bascule directe:", e);
  }

  if (!response || !response.ok) {
    try {
      response = await fetch(liveUrl, {
        method: 'GET',
        redirect: 'follow',
        cache: 'no-store',
      });
    } catch (directErr: any) {
      return {
        success: false,
        annonces: [],
        error: `Connexion impossible au Google Sheet Troc_Annonces (${directErr?.message || 'réseau indisponible'}).`,
      };
    }
  }

  if (!response || !response.ok) {
    return {
      success: false,
      annonces: [],
      error: "Impossible de joindre l'API Apps Script pour lire Troc_Annonces.",
    };
  }

  try {
    const json = await response.json();
    if (json && json.success === false) {
      const errMsg = String(json.error || '');
      const isUnknownAction = errMsg.toLowerCase().includes('action inconnue') || errMsg.toLowerCase().includes('getTroc'.toLowerCase());
      return {
        success: false,
        annonces: [],
        scriptUpdateNeeded: isUnknownAction,
        error: isUnknownAction
          ? "L'action 'getTroc' n'est pas encore déployée dans votre Web App Google Apps Script (Code.gs)."
          : errMsg || "Erreur Apps Script lors de la lecture de Troc_Annonces.",
      };
    }

    const rawList = Array.isArray(json?.data) ? json.data : (Array.isArray(json?.troc) ? json.troc : []);
    return {
      success: true,
      annonces: parseTrocRowsOrObjects(rawList),
    };
  } catch (parseErr: any) {
    return {
      success: false,
      annonces: [],
      error: `Réponse invalide de Google Sheets (${parseErr?.message || 'JSON invalide'}).`,
    };
  }
}

/**
 * Enregistre une nouvelle annonce dans l'onglet Google Sheet 'Troc_Annonces'.
 */
export async function saveTrocAnnonceToSheet(
  annonce: Omit<TrocAnnonce, 'id' | 'datePublication' | 'statut'> & { id?: string; datePublication?: string; statut?: string },
  appsScriptUrl: string = APPS_SCRIPT_WEB_APP_URL,
  spreadsheetId?: string | null,
  accessToken?: string | null
): Promise<{ success: boolean; id?: string; error?: string }> {
  const id = annonce.id || `troc-${Date.now()}`;
  const datePublication = annonce.datePublication || new Date().toLocaleDateString('fr-FR');
  const statut = annonce.statut || 'Disponible';
  const cleanPhone = formatFrenchPhoneNumber(annonce.contactTel || '');

  const cleanAnnonce: TrocAnnonce = {
    id,
    datePublication,
    titre: annonce.titre.trim(),
    categorie: annonce.categorie,
    taillePointure: annonce.taillePointure.trim(),
    etat: annonce.etat,
    photoUrl: annonce.photoUrl?.trim() || '',
    prix: Number(annonce.prix) || 0,
    contactNom: annonce.contactNom.trim(),
    contactTel: cleanPhone,
    contactEmail: annonce.contactEmail?.trim() || '',
    statut,
  };

  // 1. Appel Apps Script doPost
  const targetUrl = appsScriptUrl || APPS_SCRIPT_WEB_APP_URL;
  const payload = {
    action: 'saveTrocAnnonce',
    annonce: cleanAnnonce,
  };

  let appsScriptOk = false;
  let appsScriptError: string | undefined;

  try {
    const proxyUrl = `/api/gas-proxy?url=${encodeURIComponent(targetUrl)}`;
    const pRes = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    if (pRes.ok) {
      const pJson = await pRes.json().catch(() => ({ success: true }));
      if (pJson && pJson.success === false) {
        appsScriptError = pJson.error || "Le script Google Sheets doit être mis à jour pour accepter 'saveTrocAnnonce'.";
      } else {
        appsScriptOk = true;
      }
    }
  } catch {
    // Fallback direct
  }

  // 2. Complément via Google Sheets API v4 directe si authentifié
  if (spreadsheetId && accessToken) {
    try {
      const rowValues = [[
        cleanAnnonce.id,
        cleanAnnonce.datePublication,
        cleanAnnonce.titre,
        cleanAnnonce.categorie,
        cleanAnnonce.taillePointure,
        cleanAnnonce.etat,
        cleanAnnonce.photoUrl || '',
        cleanAnnonce.prix,
        cleanAnnonce.contactNom,
        cleanAnnonce.contactTel || '',
        cleanAnnonce.contactEmail || '',
        cleanAnnonce.statut,
      ]];
      const apiRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(TROC_SHEET_TITLE)}:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: rowValues }),
        }
      );
      if (apiRes.ok) {
        return { success: true, id };
      }
    } catch (e) {
      console.warn("Erreur append Troc_Annonces via Sheets API:", e);
    }
  }

  if (appsScriptOk) {
    return { success: true, id };
  }

  // Tentative directe sans proxy
  if (!appsScriptError) {
    try {
      await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        mode: 'no-cors',
      });
      return { success: true, id };
    } catch (netErr: any) {
      return {
        success: false,
        error: `Impossible d'enregistrer l'annonce (${netErr?.message || 'erreur réseau'}).`,
      };
    }
  }

  return {
    success: false,
    error: appsScriptError,
  };
}

/**
 * Met à jour le statut d'une annonce ('Disponible', 'Vendu', 'Supprimé') dans 'Troc_Annonces'.
 */
export async function updateTrocStatutInSheet(
  id: string,
  statut: 'Disponible' | 'Vendu' | 'Supprimé',
  appsScriptUrl: string = APPS_SCRIPT_WEB_APP_URL
): Promise<{ success: boolean; error?: string }> {
  const targetUrl = appsScriptUrl || APPS_SCRIPT_WEB_APP_URL;
  const payload = {
    action: 'updateTrocStatut',
    id,
    statut,
  };

  try {
    const proxyUrl = `/api/gas-proxy?url=${encodeURIComponent(targetUrl)}`;
    const pRes = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    if (pRes.ok) {
      const pJson = await pRes.json().catch(() => ({ success: true }));
      if (pJson && pJson.success === false) {
        return { success: false, error: pJson.error || 'Erreur de mise à jour.' };
      }
      return { success: true };
    }
  } catch {
    // Fallback
  }

  try {
    await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      mode: 'no-cors',
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur réseau.' };
  }
}