import { Adherent, Rencontre, MatchComposition, FrozenPlayerSlot, Enseignant, ClubInfo, ClubTarif, TrocAnnonce, GoSportOffre, BureauMemberEntry, PartenaireLogo } from '../types/tennis';
import { parseAdherentRow, parseRencontreRow } from './sheetParsers';
import { cleanRanking, isValidTennisRanking } from '../utils/ranking';
import { normalizeDateString } from '../utils/dateUtils';
import { formatFrenchPhoneNumber } from '../utils/phoneUtils';
import { getCompetitionFormat, sanitizeCompositionForFormat } from '../utils/competitionFormats';

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
export const CLUB_INFO_SHEET_ALIASES = ['Club_Info', 'Club_infos', 'Club_Infos'];
export const TROC_SHEET_TITLE = 'Troc_Annonces';
export const GOSPORT_SHEET_TITLE = 'Partenaire_GOSport';
export const PARTENAIRES_SHEET_TITLE = 'Partenaires';

export const TCM_CACHE_KEY = 'tcm_google_sheets_dataset_v3';
export const TCM_LAST_SYNC_KEY = 'tcm_last_sync_timestamp';
export const TCM_CUSTOM_CLUB_INFO_KEY = 'tcm_custom_club_info_v3';
export const TCM_CUSTOM_COMPOSITIONS_KEY = 'tcm_custom_compositions_v3';
const LOCAL_COMPOSITION_TTL_MS = 20000;

interface LocalCompositionRecord {
  composition: MatchComposition;
  savedAt: number;
}

export function saveLocalComposition(matchId: string, comp: MatchComposition): void {
  try {
    const raw = localStorage.getItem(TCM_CUSTOM_COMPOSITIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const now = Date.now();
    const cleaned: Record<string, LocalCompositionRecord> = {};
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) {
        const rec = v as Partial<LocalCompositionRecord> | undefined;
        if (rec && typeof rec.savedAt === 'number' && rec.composition && now - rec.savedAt <= LOCAL_COMPOSITION_TTL_MS) {
          cleaned[k] = rec as LocalCompositionRecord;
        }
      }
    }
    const record: LocalCompositionRecord = { composition: comp, savedAt: now };
    cleaned[matchId] = record;
    cleaned[normalizeSheetMatchKey(matchId)] = record;
    localStorage.setItem(TCM_CUSTOM_COMPOSITIONS_KEY, JSON.stringify(cleaned));
  } catch (e) {
    console.warn("Erreur sauvegarde locale composition:", e);
  }
}

export function loadLocalCompositions(): Record<string, MatchComposition> {
  try {
    const raw = localStorage.getItem(TCM_CUSTOM_COMPOSITIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      localStorage.removeItem(TCM_CUSTOM_COMPOSITIONS_KEY);
      return {};
    }
    const now = Date.now();
    const activeRecords: Record<string, LocalCompositionRecord> = {};
    const activeComps: Record<string, MatchComposition> = {};
    let hasExpired = false;

    for (const [k, v] of Object.entries(parsed)) {
      const rec = v as Partial<LocalCompositionRecord> | undefined;
      if (rec && typeof rec.savedAt === 'number' && rec.composition && now - rec.savedAt <= LOCAL_COMPOSITION_TTL_MS) {
        activeRecords[k] = rec as LocalCompositionRecord;
        activeComps[k] = rec.composition;
      } else {
        hasExpired = true;
      }
    }

    if (hasExpired) {
      if (Object.keys(activeRecords).length === 0) {
        localStorage.removeItem(TCM_CUSTOM_COMPOSITIONS_KEY);
      } else {
        localStorage.setItem(TCM_CUSTOM_COMPOSITIONS_KEY, JSON.stringify(activeRecords));
      }
    }

    return activeComps;
  } catch {
    return {};
  }
}

export function clearLocalCompositions(): void {
  try {
    localStorage.removeItem(TCM_CUSTOM_COMPOSITIONS_KEY);
  } catch {
    // Ignorer
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
    membresBureau?: BureauMemberEntry[];
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
    membresBureau?: BureauMemberEntry[];
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
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s\/\-_]/g, '');
}

function normalizeSexKey(sexe?: string): string {
  const s = (sexe || '').trim().toUpperCase();
  if (!s) return '';
  if (s === 'F' || s.startsWith('F') || s.includes('DAME') || s.includes('FEM')) return 'f';
  if (s.includes('MIX')) return 'mix';
  return 'h';
}

function buildScopedCompKeys(
  dateStr: string,
  numEqStr: string,
  libelle?: string,
  categorie?: string,
  sexe?: string
): string[] {
  const normDate = normalizeSheetMatchKey(normalizeDateString(dateStr) || dateStr);
  const normEq = normalizeSheetMatchKey(numEqStr);
  const eqNumOnly = (numEqStr || '').replace(/\D/g, '');
  const normLib = normalizeSheetMatchKey(libelle || '');
  const normCat = normalizeSheetMatchKey(categorie || '');
  const normSex = normalizeSexKey(sexe);
  if (!normDate || !normEq || (!normLib && !normCat)) return [];

  const suffix = `lib_${normLib}_cat_${normCat}_sex_${normSex}`;
  const keys = [`scoped_${normDate}_eq_${normEq}_${suffix}`];
  if (eqNumOnly && eqNumOnly !== normEq) {
    keys.push(`scoped_${normDate}_eq_${eqNumOnly}_${suffix}`);
  }
  return keys;
}

type CompMapEntry = {
  composition: MatchComposition;
  frozenSlots: FrozenPlayerSlot[];
  meta?: {
    libelle?: string;
    categorie?: string;
    sexe?: string;
  };
};

/**
 * Parsing des compositions depuis les lignes brutes de l'onglet Compositions_Equipes
 */
function parseCompositionsRows(rawComps: any): Map<string, { composition: MatchComposition; frozenSlots: FrozenPlayerSlot[] }> {
  const map = new Map<string, CompMapEntry>();
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
      const libelleVal = String(v.libelleHomologation || '').trim();
      const catVal = String(v.categorieAgeHomologation || '').trim();
      const sexeVal = String(v.sexeHomologation || '').trim();

      const frozenSlots: FrozenPlayerSlot[] = Array.isArray(v.frozenPlayers) ? v.frozenPlayers : [];

      const rawRot = v.heuresRotations && typeof v.heuresRotations === 'object' ? { ...v.heuresRotations } : undefined;
      const rotFlags = rawRot && rawRot._flags && typeof rawRot._flags === 'object' ? rawRot._flags : undefined;
      if (rawRot && '_flags' in rawRot) delete rawRot._flags;

      const comp: MatchComposition = {
        valideParCapitaine: !!v.valideParCapitaine,
        dateValidation: String(v.dateValidation || ''),
        dateRencontreValidee: normDateVal || dateVal || undefined,
        heureDebut,
        lieuRencontre,
        nombreCourts,
        ordreMatchs: Array.isArray(v.ordreMatchs) ? v.ordreMatchs : undefined,
        heuresRotations: rawRot,
        logistiqueValidee: typeof v.logistiqueValidee === 'boolean'
          ? v.logistiqueValidee
          : typeof rotFlags?.logistiqueValidee === 'boolean'
            ? rotFlags.logistiqueValidee
            : undefined,
        ordreValide: typeof v.ordreValide === 'boolean'
          ? v.ordreValide
          : typeof rotFlags?.ordreValide === 'boolean'
            ? rotFlags.ordreValide
            : false,
        joueursValides: typeof v.joueursValides === 'boolean'
          ? v.joueursValides
          : typeof rotFlags?.joueursValides === 'boolean'
            ? rotFlags.joueursValides
            : undefined,
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

      const entry: CompMapEntry = {
        composition: comp,
        frozenSlots,
        meta: { libelle: libelleVal, categorie: catVal, sexe: sexeVal },
      };
      map.set(matchId, entry);
      map.set(normalizeSheetMatchKey(matchId), entry);
      buildScopedCompKeys(dateVal, numEqVal, libelleVal, catVal, sexeVal).forEach((sk) => {
        map.set(sk, entry);
      });
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
      const libelleVal = String(row[3] || '').trim();
      const catVal = String(row[4] || '').trim();
      const sexeVal = String(row[5] || '').trim();
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

      let ordreMatchs: string[] | undefined;
      if (row[20]) {
        try {
          const rawOrd = String(row[20]).trim();
          const parsedOrd = rawOrd.startsWith('[') ? JSON.parse(rawOrd) : rawOrd.split(',').map((s: string) => s.trim()).filter(Boolean);
          if (Array.isArray(parsedOrd) && parsedOrd.length > 0) ordreMatchs = parsedOrd;
        } catch { /* ignore */ }
      }

      let heuresRotations: Record<string, string> | undefined;
      let rotFlags: { logistiqueValidee?: boolean; ordreValide?: boolean; joueursValides?: boolean } | undefined;
      if (row[21]) {
        try {
          const parsedRot = JSON.parse(String(row[21]).trim());
          if (parsedRot && typeof parsedRot === 'object' && !Array.isArray(parsedRot)) {
            if (parsedRot._flags && typeof parsedRot._flags === 'object') {
              rotFlags = parsedRot._flags;
              delete parsedRot._flags;
            }
            heuresRotations = parsedRot;
          }
        } catch { /* ignore */ }
      }

      if (!matchId) continue;
      if (!poste && !nomPrenom && !ordreMatchs && !heuresRotations) continue;

      const normDateVal = normalizeDateString(dateVal);

      let entry = map.get(matchId);
      if (!entry) {
        const hasRealPlayer = Boolean(nomPrenom && poste !== 'Logistique & Ordre');
        const createdEntry: CompMapEntry = {
          composition: {
            valideParCapitaine: valide,
            dateValidation: dateEnreg,
            dateRencontreValidee: normDateVal || dateVal || undefined,
            heureDebut,
            lieuRencontre,
            nombreCourts,
            ordreMatchs,
            heuresRotations,
            logistiqueValidee: typeof rotFlags?.logistiqueValidee === 'boolean'
              ? rotFlags.logistiqueValidee
              : valide,
            ordreValide: typeof rotFlags?.ordreValide === 'boolean'
              ? rotFlags.ordreValide
              : false,
            joueursValides: typeof rotFlags?.joueursValides === 'boolean'
              ? rotFlags.joueursValides
              : (valide && hasRealPlayer),
            frozenPlayers: [],
          },
          frozenSlots: [],
          meta: { libelle: libelleVal, categorie: catVal, sexe: sexeVal },
        };
        entry = createdEntry;
        map.set(matchId, createdEntry);
        map.set(normalizeSheetMatchKey(matchId), createdEntry);
        buildScopedCompKeys(dateVal, numEqVal, libelleVal, catVal, sexeVal).forEach((sk) => {
          map.set(sk, createdEntry);
        });
      } else {
        if (ordreMatchs && !entry.composition.ordreMatchs) {
          entry.composition.ordreMatchs = ordreMatchs;
        }
        if (heuresRotations && !entry.composition.heuresRotations) {
          entry.composition.heuresRotations = heuresRotations;
        }
      }

      if (!nomPrenom || poste === 'Logistique & Ordre') {
        continue;
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

  // 3. Fusion courte durée uniquement pour les modifications locales récentes (< 20s)
  // afin d'éviter la résurrection de lignes supprimées dans Google Sheets
  try {
    const localMap = loadLocalCompositions();
    for (const [k, localComp] of Object.entries(localMap)) {
      if (!localComp) continue;
      const existing = map.get(k) || map.get(normalizeSheetMatchKey(k));
      if (!existing) {
        const entry: CompMapEntry = { composition: localComp, frozenSlots: localComp.frozenPlayers || [] };
        map.set(k, entry);
        map.set(normalizeSheetMatchKey(k), entry);
      } else {
        existing.composition = {
          ...existing.composition,
          ...localComp,
        };
        existing.frozenSlots = localComp.frozenPlayers || existing.frozenSlots;
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
  membresBureau: BureauMemberEntry[];
  enseignants: Enseignant[];
} {
  let president = { nom: '', tel: '', email: '' };
  let secretaire = { nom: '', tel: '', email: '' };
  let tresorier = { nom: '', tel: '', email: '' };
  const membresBureau: BureauMemberEntry[] = [];
  const enseignants: Enseignant[] = [];

  if (!rows || rows.length <= 1) {
    return { membresBureau, enseignants };
  }

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!Array.isArray(r) || r.length === 0) continue;
    const rawRole = String(r[0] || '').trim();
    const role = rawRole.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const nomPrenom = String(r[1] || '').trim();
    const diplome = String(r[2] || '').trim();
    const tel = formatFrenchPhoneNumber(r[3]);
    const email = String(r[4] || '').trim();
    const desc = String(r[5] || '').trim();

    if (!nomPrenom) continue;

    const combinedMeta = `${rawRole} ${diplome} ${desc}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const isNonJoueur =
      combinedMeta.includes('non joueur') ||
      combinedMeta.includes('non-joueur') ||
      combinedMeta.includes('ne joue pas');

    if (role.includes('presid') && !role.includes('vice')) {
      president = { nom: nomPrenom, tel, email };
      membresBureau.push({ id: `bureau-${i}`, nom: nomPrenom, role: rawRole || 'Président', telephone: tel || undefined, email: email || undefined, nonJoueur: isNonJoueur || undefined });
    } else if (role.includes('secr') && !role.includes('adjoint')) {
      secretaire = { nom: nomPrenom, tel, email };
      membresBureau.push({ id: `bureau-${i}`, nom: nomPrenom, role: rawRole || 'Secrétaire', telephone: tel || undefined, email: email || undefined, nonJoueur: isNonJoueur || undefined });
    } else if (role.includes('tresor') && !role.includes('adjoint')) {
      tresorier = { nom: nomPrenom, tel, email };
      membresBureau.push({ id: `bureau-${i}`, nom: nomPrenom, role: rawRole || 'Trésorier', telephone: tel || undefined, email: email || undefined, nonJoueur: isNonJoueur || undefined });
    } else if (
      role.includes('prof') ||
      role.includes('enseign') ||
      role.includes('coach') ||
      role.includes('moniteur') ||
      role.includes('initiateur') ||
      role.includes('bpjeps') ||
      role.includes('desjeps') ||
      role.includes('cqp') ||
      /\bDE\b/.test(rawRole) ||
      role.includes('dejeps')
    ) {
      enseignants.push({
        id: `enseignant-${i}`,
        nomPrenom,
        diplome: diplome || "Enseignant diplômé",
        telephone: tel || undefined,
        email: email || undefined,
        description: desc || undefined,
      });
    } else {
      // Tout autre membre du bureau (Vice-président, Membre du bureau, Trésorier adjoint, etc.)
      membresBureau.push({
        id: `bureau-${i}`,
        nom: nomPrenom,
        role: rawRole || 'Membre du bureau',
        telephone: tel || undefined,
        email: email || undefined,
        nonJoueur: isNonJoueur || undefined,
      });
    }
  }

  return {
    president: president.nom ? president : undefined,
    secretaire: secretaire.nom ? secretaire : undefined,
    tresorier: tresorier.nom ? tresorier : undefined,
    membresBureau,
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
      const normKey = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const val = String(row[1] ?? '').trim();
      if (!normKey || normKey === 'parametre' || normKey === 'cle' || normKey === 'propriete' || normKey === 'param') continue;

      if (normKey.includes('permanence visible') || normKey.includes('afficher permanence')) {
        result.permanencePedagogiqueVisible = !val.toLowerCase().includes('non') && !val.toLowerCase().includes('faux') && val !== 'false';
        continue;
      }
      if (normKey.includes('badge visible') || normKey.includes('afficher badge')) {
        result.badgeAccesVisible = !val.toLowerCase().includes('non') && !val.toLowerCase().includes('faux') && val !== 'false';
        continue;
      }

      if (!val) continue;

      // Priorité aux visuels & champs administratifs officiels pour éviter toute collision avec "président" (ex: "Signature du Président")
      if (normKey.includes('logo')) result.logoUrl = val;
      else if (normKey.includes('tampon') || normKey.includes('cachet')) result.tamponUrl = val;
      else if (normKey.includes('signature')) result.signatureUrl = val;
      else if (normKey.includes('signataire') && normKey.includes('fonction')) result.signataireFonction = val;
      else if (normKey.includes('signataire')) result.signataireNom = val;
      else if (normKey.includes('siret')) result.siret = val;
      else if (normKey.includes('rna')) result.rna = val;
      else if (normKey.includes('rib') || normKey.includes('iban')) result.ribIban = val;
      else if (normKey.includes('code club') || normKey === 'codeclub' || normKey.includes('affiliation fft')) result.codeClub = val;
      else if (normKey.includes('president') && (normKey.includes('tel') || normKey.includes('portable'))) result.presidentTelephone = formatFrenchPhoneNumber(val);
      else if (normKey.includes('president') && normKey.includes('mail')) result.presidentEmail = val;
      else if (normKey === 'president' || normKey.includes('nom president')) result.president = val;
      else if (normKey.includes('secretaire') && (normKey.includes('tel') || normKey.includes('portable'))) result.secretaireTelephone = formatFrenchPhoneNumber(val);
      else if (normKey.includes('secretaire') && normKey.includes('mail')) result.secretaireEmail = val;
      else if (normKey === 'secretaire' || normKey.includes('nom secretaire')) result.secretaire = val;
      else if (normKey.includes('tresorier') && (normKey.includes('tel') || normKey.includes('portable'))) result.tresorierTelephone = formatFrenchPhoneNumber(val);
      else if (normKey.includes('tresorier') && normKey.includes('mail')) result.tresorierEmail = val;
      else if (normKey === 'tresorier' || normKey.includes('nom tresorier')) result.tresorier = val;
      else if (normKey.includes('adress')) result.adresse = val;
      else if (normKey.includes('nom du club') || normKey === 'nom') result.nom = val;
      else if (normKey === 'telephone' || normKey === 'tel' || normKey.includes('telephone club')) result.telephone = formatFrenchPhoneNumber(val);
      else if (normKey === 'email' || normKey === 'mail' || normKey.includes('courriel') || normKey.includes('email club')) result.email = val;
      else if (normKey.includes('site') || normKey.includes('web')) result.siteWeb = val;
      else if (normKey.includes('helloasso')) result.helloAssoUrl = val;
      else if (normKey.includes('modalite') || normKey.includes('paiement')) result.modalitesPaiement = val;
      else if (normKey.includes('code postal') || normKey === 'cp') result.codePostal = val;
      else if (normKey.includes('ville')) result.ville = val;
      else if (normKey.includes('sigle')) result.sigle = val;
      else if (normKey.includes('ligue')) result.ligue = val;
      else if (normKey.includes('comite')) result.comite = val;
      else if (normKey.includes('libelle permanence') || normKey.includes('titre permanence')) result.permanencePedagogiqueLibelle = val;
      else if (normKey.includes('permanence') || normKey.includes('horaire')) result.horairesPermanence = val;
      else if (normKey.includes('badge') && (normKey.includes('message') || normKey.includes('texte') || normKey.includes('acces'))) result.badgeAccesMessage = val;
      else if (normKey.includes('ouverture') || normKey.includes('7/7') || normKey.includes('7j/7') || normKey.includes('court ouvert')) result.ouvertureCourtsMessage = val;
      else if (normKey.includes('membres non joueurs') || normKey === 'membresnonjoueurs' || normKey.includes('licencies non joueurs')) {
        try {
          const parsedNj = JSON.parse(val);
          if (Array.isArray(parsedNj)) result.membresNonJoueurs = parsedNj;
        } catch { /* ignore */ }
      }
      else if (normKey.includes('membres bureau') || normKey === 'membresbureau') {
        try {
          const parsedMb = JSON.parse(val);
          if (Array.isArray(parsedMb)) result.membresBureau = parsedMb;
        } catch { /* ignore */ }
      }
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
    if (Array.isArray(rawClubInfo.membresBureau)) result.membresBureau = rawClubInfo.membresBureau;
    if (Array.isArray(rawClubInfo.membresNonJoueurs)) result.membresNonJoueurs = rawClubInfo.membresNonJoueurs;
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
 * Invalide le cache mémoire Apps Script (à appeler après une écriture Club_Info)
 */
export function invalidateAppsScriptCache(): void {
  cachedRawData = null;
  lastFetchTime = 0;
}

/**
 * Parse la réponse texte JSONP Google Visualization (gviz/tq?tqx=out:json&headers=1&sheet=...)
 * en vérifiant strictement qu'il s'agit bien d'un onglet clé-valeur Club_Info / Club_infos
 * (Google Sheets renvoie sinon le 1er onglet Adhérents si le nom demandé n'existe pas).
 */
function parseClubInfoGvizResponse(rawText: string): Partial<ClubInfo> | undefined {
  if (!rawText) return undefined;
  const startIdx = rawText.indexOf('{');
  const endIdx = rawText.lastIndexOf('}');
  if (startIdx < 0 || endIdx <= startIdx) return undefined;

  let json: any;
  try {
    json = JSON.parse(rawText.slice(startIdx, endIdx + 1));
  } catch {
    return undefined;
  }

  const cols: any[] = json?.table?.cols || [];
  const rows: any[] = json?.table?.rows || [];
  // Club_Info / Club_infos est un tableau clé/valeur (2 colonnes, parfois 3). Adhérents en a > 10.
  if (cols.length < 2 || cols.length > 4 || rows.length === 0) return undefined;

  const col0Label = String(cols[0]?.label || '').toLowerCase();
  if (col0Label.includes('licence') || col0Label.includes('prénom') || col0Label.includes('prenom')) {
    return undefined;
  }

  const pairs: Array<[string, string]> = [];
  for (const r of rows) {
    const c = r?.c;
    if (!Array.isArray(c) || c.length < 2) continue;
    const k = String(c[0]?.v ?? c[0]?.f ?? '').trim();
    const v = String(c[1]?.v ?? c[1]?.f ?? '').trim();
    if (k) pairs.push([k, v]);
  }
  if (pairs.length === 0) return undefined;

  const matchedKnownKeys = pairs.filter(([k]) => {
    const nk = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return (
      nk.includes('nom du club') ||
      nk.includes('logo') ||
      nk.includes('tampon') ||
      nk.includes('cachet') ||
      nk.includes('signature') ||
      nk.includes('siret') ||
      nk.includes('rna') ||
      nk.includes('code club') ||
      nk.includes('signataire')
    );
  }).length;

  if (matchedKnownKeys < 2) return undefined;
  return parseClubInfoData(pairs);
}

/**
 * Fallback fiable de lecture de l'onglet Club_Info / Club_infos (Google Sheets API v4 ou gviz)
 * lorsque le Web App Apps Script déployé ne retourne pas encore l'attribut clubInfo dans action=getAll.
 */
export async function fetchClubInfoFallback(
  spreadsheetId?: string | null,
  accessToken?: string | null
): Promise<Partial<ClubInfo> | undefined> {
  const sheetId = spreadsheetId || TCM_DEFAULT_SHEET_ID;

  // 1. Google Sheets API directe si un jeton OAuth valide est déjà disponible
  if (sheetId && accessToken) {
    for (const alias of CLUB_INFO_SHEET_ALIASES) {
      try {
        const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(alias)}?valueRenderOption=UNFORMATTED_VALUE`;
        const res = await fetch(apiUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const json = await res.json();
          const parsed = parseClubInfoData(json?.values || []);
          if (parsed && Object.keys(parsed).length > 0) {
            return parsed;
          }
        }
      } catch {
        // Essayer l'alias suivant
      }
    }
  }

  // 2. Endpoint public Google Visualization (lecture seule, avec &headers=1) via proxy puis direct
  if (sheetId) {
    const ts = Date.now();
    for (const alias of CLUB_INFO_SHEET_ALIASES) {
      const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(alias)}&_t=${ts}`;
      try {
        const pRes = await fetch(`/api/gas-proxy?url=${encodeURIComponent(gvizUrl)}`);
        if (pRes.ok) {
          const text = await pRes.text();
          const parsed = parseClubInfoGvizResponse(text);
          if (parsed) return parsed;
        }
      } catch {
        // Fallback direct
      }

      try {
        const dRes = await fetch(gvizUrl, { method: 'GET', redirect: 'follow' });
        if (dRes.ok) {
          const text = await dRes.text();
          const parsed = parseClubInfoGvizResponse(text);
          if (parsed) return parsed;
        }
      } catch {
        // Essayer l'alias suivant
      }
    }
  }

  return undefined;
}

/**
 * Récupère l'intégralité des onglets en un seul appel anti-cache vers l'Apps Script
 * et retourne les données déjà typées et prêtes à l'emploi.
 */
export async function fetchAllDataFromAppsScript(
  appsScriptUrl?: string,
  spreadsheetId?: string | null,
  accessToken?: string | null
): Promise<AppsScriptDataResult> {
  const urlToUse = appsScriptUrl || APPS_SCRIPT_WEB_APP_URL;
  const now = Date.now();

  let rawJson: any = null;

  // Cache mémoire de 2 secondes
  if (cachedRawData && (now - lastFetchTime < 2000)) {
    rawJson = cachedRawData;
  } else {
    try {
      const url = `${urlToUse}?action=getAll&_t=${now}`;

      // 1. Priorité au proxy local (contourne les blocages CORS et restrictions d'iframe des navigateurs)
      try {
        const proxyUrl = `/api/gas-proxy?url=${encodeURIComponent(url)}`;
        const pRes = await fetch(proxyUrl, {
          method: "GET",
          headers: { 'Accept': 'application/json' },
        });
        const ct = pRes.headers.get('content-type') || '';
        if (pRes.ok && ct.includes('application/json')) {
          rawJson = await pRes.json();
        }
      } catch (proxyError) {
        console.warn("[AppsScript] Proxy local indisponible, bascule sur fetch direct :", proxyError);
      }

      // 2. Si le proxy n'a pas répondu ou n'a pas renvoyé de JSON valide, tentative directe
      if (!rawJson) {
        try {
          const directRes = await fetch(url, {
            method: "GET",
            redirect: "follow",
          });
          if (directRes.ok) {
            rawJson = await directRes.json();
          }
        } catch (directError) {
          console.warn("[AppsScript] Échec du fetch direct :", directError);
        }
      }

      if (!rawJson) {
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
  const attachComposition = (parsed: Rencontre) => {
    const compMap = compositionsMap as Map<string, CompMapEntry>;
    let compEntry: CompMapEntry | undefined =
      compMap.get(parsed.id) ||
      compMap.get(normalizeSheetMatchKey(parsed.id));

    if (compEntry?.meta && (compEntry.meta.categorie || compEntry.meta.libelle)) {
      const mCat = normalizeSheetMatchKey(compEntry.meta.categorie || '');
      const rCat = normalizeSheetMatchKey(parsed.categorieAgeHomologation || '');
      const mLib = normalizeSheetMatchKey(compEntry.meta.libelle || '');
      const rLib = normalizeSheetMatchKey(parsed.libelleHomologation || '');
      if ((mCat && rCat && mCat !== rCat) || (mLib && rLib && mLib !== rLib)) {
        compEntry = undefined;
      }
    }

    if (!compEntry && parsed.dateRencontre && parsed.numeroEquipe) {
      const scopedKeys = buildScopedCompKeys(
        parsed.dateRencontre,
        parsed.numeroEquipe,
        parsed.libelleHomologation,
        parsed.categorieAgeHomologation,
        parsed.sexeHomologation
      );
      for (const sk of scopedKeys) {
        const candidate = compMap.get(sk);
        if (candidate) {
          compEntry = candidate;
          break;
        }
      }
    }

    if (compEntry) {
      const fmt = getCompetitionFormat(parsed, { formatReduit: compEntry.composition.formatReduit });
      parsed.composition = sanitizeCompositionForFormat(compEntry.composition, fmt);
    }
  };

  const rencontres: Rencontre[] = [];
  const rawRen = rawJson?.rencontres || [];
  if (Array.isArray(rawRen) && rawRen.length > 1) {
    if (Array.isArray(rawRen[0])) {
      const headers = rawRen[0].map((h: any) => String(h || '').trim());
      for (let i = 1; i < rawRen.length; i++) {
        const parsed = parseRencontreRow(rawRen[i], headers, i);
        if (parsed) {
          attachComposition(parsed);
          rencontres.push(parsed);
        }
      }
    } else if (rawRen[0]?.numeroEquipe || rawRen[0]?.libelleHomologation) {
      for (const item of rawRen) {
        if (!item) continue;
        const parsed = { ...item };
        attachComposition(parsed);
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

  // 7. Parser Club Info (depuis Apps Script si disponible, sinon fallback direct Google Sheets Club_Info / Club_infos)
  const rawClubInfo = rawJson?.clubInfo || rawJson?.club_info || rawJson?.clubInfos || rawJson?.clubInfoRows;
  let clubInfo = parseClubInfoData(rawClubInfo);
  if (!clubInfo) {
    clubInfo = await fetchClubInfoFallback(spreadsheetId || TCM_DEFAULT_SHEET_ID, accessToken);
  }

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
  membresBureau?: BureauMemberEntry[];
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
  rawComposition: MatchComposition,
  adherentsById: Map<string, Adherent>,
  appsScriptUrl: string = APPS_SCRIPT_WEB_APP_URL
): Promise<{ success: boolean; rowsSaved?: number; error?: string }> {
  try {
    invalidateAppsScriptCache();
    const fmt = getCompetitionFormat(rencontre, { formatReduit: rawComposition.formatReduit });
    const composition = sanitizeCompositionForFormat(rawComposition, fmt);

    const slots: Array<{
      poste: string;
      nomPrenom: string;
      licence: string;
      classementGele: string;
      dateNaissance: string;
      ageSportif: string;
      typeLicence: string;
    }> = [];

    const slotDefinitions: Array<{ key: keyof MatchComposition; label: string }> = [];
    for (let i = 1; i <= fmt.numSingles; i++) {
      slotDefinitions.push({ key: `simple${i}Id` as keyof MatchComposition, label: `Simple ${i}` });
    }
    if (fmt.numDoubles >= 1) {
      slotDefinitions.push({ key: 'double1Player1Id', label: 'Double 1 (J1)' });
      slotDefinitions.push({ key: 'double1Player2Id', label: 'Double 1 (J2)' });
    }
    if (fmt.numDoubles >= 2) {
      slotDefinitions.push({ key: 'double2Player1Id', label: 'Double 2 (J1)' });
      slotDefinitions.push({ key: 'double2Player2Id', label: 'Double 2 (J2)' });
    }

    slotDefinitions.forEach(({ key, label }) => {
      const playerId = composition[key] as string | undefined;
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

    // Persistance locale courte durée (anti-flash post-sauvegarde)
    saveLocalComposition(rencontre.id, composition);

    const rotationsWithFlags: Record<string, unknown> = {
      ...(composition.heuresRotations || {}),
      _flags: {
        logistiqueValidee: Boolean(composition.logistiqueValidee),
        ordreValide: Boolean(composition.ordreValide),
        joueursValides: Boolean(composition.joueursValides),
      },
    };

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
      valideParCapitaine: Boolean(composition.valideParCapitaine),
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
        valideParCapitaine: Boolean(composition.valideParCapitaine),
        ordreMatchs: composition.ordreMatchs,
        heuresRotations: rotationsWithFlags,
        logistiqueValidee: Boolean(composition.logistiqueValidee),
        ordreValide: Boolean(composition.ordreValide),
        joueursValides: Boolean(composition.joueursValides),
      },
      ordreMatchs: composition.ordreMatchs || [],
      heuresRotations: rotationsWithFlags,
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
      const ct = pRes.headers.get('content-type') || '';
      if (pRes.ok && ct.includes('application/json')) {
        await pRes.json();
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
  // Sauvegarde locale immédiate et invalidation du cache mémoire
  invalidateAppsScriptCache();
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
        membresBureau: clubInfo.membresBureau || [],
        membresNonJoueurs: clubInfo.membresNonJoueurs || [],
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
      const ct = pRes.headers.get('content-type') || '';
      if (pRes.ok && ct.includes('application/json')) {
        await pRes.json();
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
  rawComposition: MatchComposition,
  adherentsById: Map<string, Adherent>,
  accessToken?: string | null
): Promise<{ success: boolean; rowsSaved: number }> {
  const fmt = getCompetitionFormat(rencontre, { formatReduit: rawComposition.formatReduit });
  const composition = sanitizeCompositionForFormat(rawComposition, fmt);
  const appsScriptRes = await saveCompositionViaAppsScript(rencontre, composition, adherentsById);

  if (spreadsheetId && accessToken) {
    try {
      const slotDefinitions: Array<{ key: keyof MatchComposition; label: string }> = [];
      for (let i = 1; i <= fmt.numSingles; i++) {
        slotDefinitions.push({ key: `simple${i}Id` as keyof MatchComposition, label: `Simple ${i}` });
      }
      if (fmt.numDoubles >= 1) {
        slotDefinitions.push({ key: 'double1Player1Id', label: 'Double 1 (J1)' });
        slotDefinitions.push({ key: 'double1Player2Id', label: 'Double 1 (J2)' });
      }
      if (fmt.numDoubles >= 2) {
        slotDefinitions.push({ key: 'double2Player1Id', label: 'Double 2 (J1)' });
        slotDefinitions.push({ key: 'double2Player2Id', label: 'Double 2 (J2)' });
      }

      const rowsToAppend: any[][] = [];
      const nowStr = composition.dateValidation || new Date().toLocaleDateString('fr-FR');
      const ordreJson = JSON.stringify(composition.ordreMatchs || []);
      const rotationsJson = JSON.stringify({
        ...(composition.heuresRotations || {}),
        _flags: {
          logistiqueValidee: Boolean(composition.logistiqueValidee),
          ordreValide: Boolean(composition.ordreValide),
          joueursValides: Boolean(composition.joueursValides),
        },
      });

      slotDefinitions.forEach(({ key, label }) => {
        const playerId = composition[key] as string | undefined;
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
            ordreJson,
            rotationsJson,
          ]);
        }
      });

      if (rowsToAppend.length === 0) {
        rowsToAppend.push([
          rencontre.id,
          composition.dateRencontreValidee || rencontre.dateRencontre,
          rencontre.numeroEquipe,
          rencontre.libelleHomologation,
          rencontre.categorieAgeHomologation,
          rencontre.sexeHomologation,
          rencontre.clubAccueilNom,
          rencontre.clubVisiteurNom,
          'Logistique & Ordre',
          '',
          '',
          '',
          '',
          '',
          '',
          composition.heureDebut || '09:00',
          composition.lieuRencontre || 'Clos des Moines (Muzillac)',
          composition.nombreCourts || 2,
          nowStr,
          composition.valideParCapitaine ? 'OUI' : 'NON',
          ordreJson,
          rotationsJson,
        ]);
      }

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
      (clubInfo.membresBureau || []).forEach(mb => {
        const mbRole = (mb.role || '').toLowerCase();
        if (mb.nom && !mbRole.includes('présid') && !mbRole.includes('presid') && !mbRole.includes('secr') && !mbRole.includes('trésor') && !mbRole.includes('tresor')) {
          bRows.push([mb.role || "Membre du bureau", mb.nom, "Dirigeant", formatFrenchPhoneNumber(mb.telephone) || "", mb.email || "", mb.nonJoueur ? "Non-joueur" : "Membre du bureau"]);
        }
      });
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

      // 2. Mise à jour ou création de l'onglet Club_Info / Club_infos si disponible
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
        ["Président", clubInfo.president || ""],
        ["Téléphone Président", formatFrenchPhoneNumber(clubInfo.presidentTelephone) || ""],
        ["Email Président", clubInfo.presidentEmail || ""],
        ["Secrétaire", clubInfo.secretaire || ""],
        ["Téléphone Secrétaire", formatFrenchPhoneNumber(clubInfo.secretaireTelephone) || ""],
        ["Email Secrétaire", clubInfo.secretaireEmail || ""],
        ["Trésorier", clubInfo.tresorier || ""],
        ["Téléphone Trésorier", formatFrenchPhoneNumber(clubInfo.tresorierTelephone) || ""],
        ["Email Trésorier", clubInfo.tresorierEmail || ""],
        ["Membres Bureau", JSON.stringify(clubInfo.membresBureau || [])],
        ["Membres Non Joueurs", JSON.stringify(clubInfo.membresNonJoueurs || [])],
        ["Logo URL", clubInfo.logoUrl || ""],
        ["Signature URL", clubInfo.signatureUrl || ""],
        ["Tampon Cachet URL", clubInfo.tamponUrl || ""],
        ["SIRET", clubInfo.siret || ""],
        ["Numéro RNA", clubInfo.rna || ""],
        ["Nom Signataire", clubInfo.signataireNom || clubInfo.president || ""],
        ["Fonction Signataire", clubInfo.signataireFonction || "Président"],
        ["IBAN / RIB", clubInfo.ribIban || ""],
      ];

      let targetClubTab = CLUB_INFO_SHEET_TITLE;
      try {
        const tabs = await getSpreadsheetTabs(spreadsheetId, accessToken);
        const existingTab = CLUB_INFO_SHEET_ALIASES.find(alias =>
          tabs.some(t => t.toLowerCase() === alias.toLowerCase())
        );
        if (existingTab) {
          targetClubTab = tabs.find(t => t.toLowerCase() === existingTab.toLowerCase()) || existingTab;
        } else if (tabs.length > 0) {
          await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              requests: [{ addSheet: { properties: { title: CLUB_INFO_SHEET_TITLE } } }],
            }),
          });
        }
      } catch {
        // Continuer avec CLUB_INFO_SHEET_TITLE
      }

      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(targetClubTab)}!A1:B${infoRows.length}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: infoRows }),
        }
      ).catch(() => {
        // Ignoré sans bloquer si la création/écriture échoue
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
        photoUrl: String(item.photoUrl || item.photo || item.Photo || '').trim() || undefined,
        photoUrl2: String(item.photoUrl2 || item.photo2 || item['Photo 2'] || item.Photo2 || '').trim() || undefined,
        photoUrl3: String(item.photoUrl3 || item.photo3 || item['Photo 3'] || item.Photo3 || '').trim() || undefined,
        prix: typeof item.prix === 'number' ? item.prix : (parseFloat(String(item.prix || '0').replace('€', '').replace(',', '.')) || 0),
        contactNom: String(item.contactNom || '').trim(),
        contactTel: formatFrenchPhoneNumber(item.contactTel || '') || undefined,
        contactEmail: String(item.contactEmail || '').trim() || undefined,
        statut: String(item.statut || 'Disponible').trim(),
      }));
  }

  // Cas 2 : tableau 2D de lignes Google Sheets (en-têtes en ligne 0)
  if (Array.isArray(raw[0])) {
    const headers = raw[0].map((h: any) => String(h || '').trim().toLowerCase());
    const findCol = (candidates: string[], fallbackIdx: number) => {
      const found = headers.findIndex((h: string) =>
        candidates.some((c) => h === c || h.replace(/[\s_-]+/g, '') === c.replace(/[\s_-]+/g, ''))
      );
      return found >= 0 ? found : fallbackIdx;
    };
    const idxPhoto2 = findCol(['photo 2', 'photo2', 'photo_2', 'photo_url_2', 'photourl2'], 12);
    const idxPhoto3 = findCol(['photo 3', 'photo3', 'photo_3', 'photo_url_3', 'photourl3'], 13);

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
        photoUrl2: String(row[idxPhoto2] || '').trim() || undefined,
        photoUrl3: String(row[idxPhoto3] || '').trim() || undefined,
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

  let json: any = null;
  try {
    const proxyUrl = `/api/gas-proxy?url=${encodeURIComponent(liveUrl)}`;
    const pRes = await fetch(proxyUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });
    const ct = pRes.headers.get('content-type') || '';
    if (pRes.ok && ct.includes('application/json')) {
      json = await pRes.json();
    }
  } catch (e) {
    console.warn("[Troc] Proxy indisponible, bascule directe:", e);
  }

  if (!json) {
    try {
      const directRes = await fetch(liveUrl, {
        method: 'GET',
        redirect: 'follow',
        cache: 'no-store',
      });
      if (!directRes.ok) {
        return {
          success: false,
          annonces: [],
          error: "Impossible de joindre l'API Apps Script pour lire Troc_Annonces.",
        };
      }
      json = await directRes.json();
    } catch (directErr: any) {
      return {
        success: false,
        annonces: [],
        error: `Connexion impossible au Google Sheet Troc_Annonces (${directErr?.message || 'réseau indisponible'}).`,
      };
    }
  }

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
    photoUrl2: annonce.photoUrl2?.trim() || '',
    photoUrl3: annonce.photoUrl3?.trim() || '',
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
    const ct = pRes.headers.get('content-type') || '';
    if (pRes.ok && ct.includes('application/json')) {
      const pJson = await pRes.json();
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
        cleanAnnonce.photoUrl2 || '',
        cleanAnnonce.photoUrl3 || '',
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
    const ct = pRes.headers.get('content-type') || '';
    if (pRes.ok && ct.includes('application/json')) {
      const pJson = await pRes.json();
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

/**
 * =========================================================================
 * MODULE PARTENAIRE GO SPORT MUZILLAC (Onglet 'Partenaire_GOSport')
 * Colonnes : ID, Nom_Produit, Categorie, Photo_URL, Tarif_Magasin,
 *            Prix_Promo, Tarif_Adherent, Exclu_Club, Tailles_Dispo, Description
 * =========================================================================
 */

function parseOptionalPrice(val: any): number | null {
  if (val === null || val === undefined) return null;
  const s = String(val).replace(/€/g, '').replace(/\s+/g, '').replace(',', '.').trim();
  if (!s) return null;
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

function parseExcluClubFlag(val: any): boolean {
  if (typeof val === 'boolean') return val;
  const s = String(val || '').trim().toUpperCase();
  return s === 'OUI' || s === 'YES' || s === 'TRUE' || s === '1';
}

function parseGoSportRowsOrObjects(raw: any): GoSportOffre[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  // Cas 1 : tableau d'objets JSON (renvoyé par Code.gs getGoSportOffres)
  if (!Array.isArray(raw[0]) && typeof raw[0] === 'object') {
    return raw
      .filter((item: any) => item && (item.nomProduit || item.Nom_Produit))
      .map((item: any, idx: number) => {
        const refMag = String(
          item.reference ?? item['Référence'] ?? item.Reference ?? ''
        ).trim();
        const refClean = String(
          item.referenceFabricantClean ??
            item.Reference_Fabricant_Clean ??
            item['Référence_Fabricant_Clean'] ??
            ''
        ).trim();
        const rawId = String(item.id ?? item.ID ?? '').trim();
        const safeId = rawId || (refMag ? `ref-${refMag}-${idx + 1}` : `gosport-${idx + 1}`);

        return {
          id: safeId,
          reference: refMag || undefined,
          referenceFabricantClean: refClean || undefined,
          nomProduit: String(item.nomProduit || item.Nom_Produit || '').trim(),
          categorie: String(item.categorie || item.Categorie || 'Équipement').trim(),
          photoUrl: String(item.photoUrl || item.Photo_URL || '').trim() || undefined,
          photoUrl2:
            String(
              item.photoUrl2 || item.Photo_URL_2 || item.Photo_URL2 || item.photo_url_2 || ''
            ).trim() || undefined,
          tarifMagasin: parseOptionalPrice(item.tarifMagasin ?? item.Tarif_Magasin) ?? 0,
          prixPromo: parseOptionalPrice(item.prixPromo ?? item.Prix_Promo),
          tarifAdherent: parseOptionalPrice(item.tarifAdherent ?? item.Tarif_Adherent),
          excluClub: parseExcluClubFlag(item.excluClub ?? item.Exclu_Club),
          taillesDispo: String(item.taillesDispo ?? item.Tailles_Dispo ?? '').trim(),
          description: String(item.description ?? item.Description ?? '').trim(),
        };
      });
  }

  // Cas 2 : tableau 2D de lignes Google Sheets (en-têtes en ligne 0)
  if (Array.isArray(raw[0])) {
    const headers = raw[0].map((h: any) => String(h || '').trim().toLowerCase());
    const findCol = (candidates: string[], fallbackIdx: number) => {
      const found = headers.findIndex((h: string) =>
        candidates.some((c) => h === c || h.replace(/[\s_-]+/g, '') === c.replace(/[\s_-]+/g, ''))
      );
      return found >= 0 ? found : fallbackIdx;
    };

    const idxId = findCol(['id'], 0);
    const idxRef = findCol(['référence', 'reference', 'ref', 'ref_magasin'], -1);
    const idxRefClean = findCol(
      [
        'reference_fabricant_clean',
        'référence_fabricant_clean',
        'reference fabricant clean',
        'reference_clean',
        'ref_clean',
      ],
      -1
    );
    const idxNom = findCol(['nom_produit', 'nom produit', 'nom'], 1);
    const idxCat = findCol(['categorie', 'catégorie'], 2);
    const idxPhoto = findCol(['photo_url', 'photo url', 'photo'], 3);
    const idxPhoto2 = findCol(['photo_url_2', 'photo_url2', 'photo url 2', 'photo_2', 'photo 2'], -1);
    const idxMag = findCol(['tarif_magasin', 'tarif magasin'], 4);
    const idxPromo = findCol(['prix_promo', 'prix promo'], 5);
    const idxAdh = findCol(['tarif_adherent', 'tarif adhérent', 'tarif adherent'], 6);
    const idxExclu = findCol(['exclu_club', 'exclu club'], 7);
    const idxTailles = findCol(['tailles_dispo', 'tailles dispo', 'tailles'], 8);
    const idxDesc = findCol(['description'], 9);

    const list: GoSportOffre[] = [];
    for (let i = 1; i < raw.length; i++) {
      const row = raw[i];
      if (!Array.isArray(row) || row.length === 0) continue;
      const nomProduit = String(row[idxNom] || '').trim();
      if (!nomProduit) continue;

      const rawId = idxId >= 0 ? String(row[idxId] || '').trim() : '';
      const reference = idxRef >= 0 ? String(row[idxRef] || '').trim() : '';
      const referenceFabricantClean = idxRefClean >= 0 ? String(row[idxRefClean] || '').trim() : '';
      const safeId = rawId || (reference ? `ref-${reference}-${i}` : `gosport-${i}`);

      list.push({
        id: safeId,
        reference: reference || undefined,
        referenceFabricantClean: referenceFabricantClean || undefined,
        nomProduit,
        categorie: String(row[idxCat] || 'Équipement').trim(),
        photoUrl: String(row[idxPhoto] || '').trim() || undefined,
        photoUrl2: idxPhoto2 >= 0 ? String(row[idxPhoto2] || '').trim() || undefined : undefined,
        tarifMagasin: parseOptionalPrice(row[idxMag]) ?? 0,
        prixPromo: parseOptionalPrice(row[idxPromo]),
        tarifAdherent: parseOptionalPrice(row[idxAdh]),
        excluClub: parseExcluClubFlag(row[idxExclu]),
        taillesDispo: String(row[idxTailles] || '').trim(),
        description: String(row[idxDesc] || '').trim(),
      });
    }
    return list;
  }

  return [];
}

/**
 * Lit les offres partenaire GO Sport Muzillac en direct depuis l'onglet Partenaire_GOSport.
 */
export async function fetchGoSportOffresLive(
  appsScriptUrl: string = APPS_SCRIPT_WEB_APP_URL,
  spreadsheetId?: string | null,
  accessToken?: string | null
): Promise<{
  success: boolean;
  offres: GoSportOffre[];
  error?: string;
  scriptUpdateNeeded?: boolean;
}> {
  if (spreadsheetId && accessToken) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(GOSPORT_SHEET_TITLE)}?valueRenderOption=UNFORMATTED_VALUE`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        const rows = json.values || [];
        return { success: true, offres: parseGoSportRowsOrObjects(rows) };
      }
    } catch (e) {
      console.warn("Erreur lecture directe Partenaire_GOSport via Sheets API:", e);
    }
  }

  const urlToUse = appsScriptUrl || APPS_SCRIPT_WEB_APP_URL;
  const liveUrl = `${urlToUse}?action=getGoSport&_t=${Date.now()}`;

  let json: any = null;
  try {
    const proxyUrl = `/api/gas-proxy?url=${encodeURIComponent(liveUrl)}`;
    const pRes = await fetch(proxyUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const ct = pRes.headers.get('content-type') || '';
    if (pRes.ok && ct.includes('application/json')) {
      json = await pRes.json();
    }
  } catch (e) {
    console.warn("[GO Sport] Proxy indisponible, bascule directe:", e);
  }

  if (!json) {
    try {
      const directRes = await fetch(liveUrl, {
        method: 'GET',
        redirect: 'follow',
        cache: 'no-store',
      });
      if (!directRes.ok) {
        return {
          success: false,
          offres: [],
          error: "Impossible de joindre l'API Apps Script pour lire Partenaire_GOSport.",
        };
      }
      json = await directRes.json();
    } catch (directErr: any) {
      return {
        success: false,
        offres: [],
        error: `Connexion impossible à l'onglet Partenaire_GOSport (${directErr?.message || 'réseau indisponible'}).`,
      };
    }
  }

  if (json && json.success === false) {
    const errMsg = String(json.error || '');
    const isUnknownAction =
      errMsg.toLowerCase().includes('action inconnue') ||
      errMsg.toLowerCase().includes('getgosport');
    return {
      success: false,
      offres: [],
      scriptUpdateNeeded: isUnknownAction,
      error: isUnknownAction
        ? "L'action 'getGoSport' n'est pas encore déployée dans votre Web App Google Apps Script (Code.gs)."
        : errMsg || "Erreur Apps Script lors de la lecture de Partenaire_GOSport.",
    };
  }

  const rawList = Array.isArray(json?.data)
    ? json.data
    : Array.isArray(json?.gosport)
      ? json.gosport
      : [];
  return {
    success: true,
    offres: parseGoSportRowsOrObjects(rawList),
  };
}

/**
 * Ajoute ou met à jour un produit dans l'onglet 'Partenaire_GOSport' via Apps Script.
 */
export async function saveGoSportOffreToSheet(
  offre: Omit<GoSportOffre, 'id'> & { id?: string },
  appsScriptUrl: string = APPS_SCRIPT_WEB_APP_URL
): Promise<{ success: boolean; id?: string; error?: string }> {
  const id = (offre.id || '').trim() || `gosport-${Date.now()}`;
  const targetUrl = appsScriptUrl || APPS_SCRIPT_WEB_APP_URL;

  const cleanOffre = {
    id,
    reference: (offre.reference || '').trim(),
    referenceFabricantClean: (offre.referenceFabricantClean || '').trim(),
    nomProduit: offre.nomProduit.trim(),
    categorie: (offre.categorie || 'Équipement').trim(),
    photoUrl: (offre.photoUrl || '').trim(),
    photoUrl2: (offre.photoUrl2 || '').trim(),
    tarifMagasin: Number(offre.tarifMagasin) || 0,
    prixPromo:
      offre.prixPromo !== null && offre.prixPromo !== undefined && !isNaN(Number(offre.prixPromo))
        ? Number(offre.prixPromo)
        : '',
    tarifAdherent:
      offre.tarifAdherent !== null &&
      offre.tarifAdherent !== undefined &&
      !isNaN(Number(offre.tarifAdherent))
        ? Number(offre.tarifAdherent)
        : '',
    excluClub: offre.excluClub ? 'OUI' : 'NON',
    taillesDispo: (offre.taillesDispo || '').trim(),
    description: (offre.description || '').trim(),
  };

  const payload = {
    action: 'saveGoSportOffre',
    offre: cleanOffre,
  };

  let appsScriptError: string | undefined;

  try {
    const proxyUrl = `/api/gas-proxy?url=${encodeURIComponent(targetUrl)}`;
    const pRes = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    const ct = pRes.headers.get('content-type') || '';
    if (pRes.ok && ct.includes('application/json')) {
      const pJson = await pRes.json();
      if (pJson && pJson.success === false) {
        appsScriptError =
          pJson.error || "Le script Google Sheets doit être mis à jour pour accepter 'saveGoSportOffre'.";
      } else {
        return { success: true, id: pJson.id || id };
      }
    }
  } catch {
    // Fallback direct
  }

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
        error: `Impossible d'enregistrer l'offre GO Sport (${netErr?.message || 'erreur réseau'}).`,
      };
    }
  }

  return { success: false, error: appsScriptError };
}

/**
 * Supprime un produit de l'onglet 'Partenaire_GOSport' via Apps Script.
 */
export async function deleteGoSportOffreInSheet(
  id: string,
  appsScriptUrl: string = APPS_SCRIPT_WEB_APP_URL,
  reference?: string
): Promise<{ success: boolean; error?: string }> {
  const targetUrl = appsScriptUrl || APPS_SCRIPT_WEB_APP_URL;
  const payload = {
    action: 'deleteGoSportOffre',
    id,
    reference: (reference || '').trim() || undefined,
  };

  try {
    const proxyUrl = `/api/gas-proxy?url=${encodeURIComponent(targetUrl)}`;
    const pRes = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    const ct = pRes.headers.get('content-type') || '';
    if (pRes.ok && ct.includes('application/json')) {
      const pJson = await pRes.json();
      if (pJson && pJson.success === false) {
        return { success: false, error: pJson.error || "Erreur lors de la suppression de l'offre." };
      }
      return { success: true };
    }
  } catch {
    // Fallback direct
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

/**
 * =========================================================================
 * MODULE LOGOS & PARTENAIRES (Onglet 'Partenaires')
 * Colonnes : ID, Nom, Rôle, Logo_URL, Site_URL, Ordre, Actif
 * =========================================================================
 */

function parsePartenairesRowsOrObjects(raw: any): PartenaireLogo[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const toActif = (val: any): boolean => {
    if (typeof val === 'boolean') return val;
    const s = String(val ?? 'OUI').trim().toUpperCase();
    if (!s) return true;
    return s !== 'NON' && s !== 'NO' && s !== 'FALSE' && s !== '0';
  };

  if (!Array.isArray(raw[0]) && typeof raw[0] === 'object') {
    return raw
      .filter((item: any) => item && (item.nom || item.Nom))
      .map((item: any, idx: number) => ({
        id: String(item.id || item.ID || `part-${idx + 1}`).trim(),
        nom: String(item.nom || item.Nom || '').trim(),
        role: String(item.role || item['Rôle'] || item.Role || item.categorie || 'club').trim(),
        logoUrl: String(item.logoUrl || item.Logo_URL || item.logo || '').trim(),
        siteUrl: String(item.siteUrl || item.Site_URL || item.site || '').trim() || undefined,
        ordre: Number(item.ordre ?? item.Ordre ?? idx + 1) || idx + 1,
        actif: toActif(item.actif ?? item.Actif),
      }))
      .sort((a, b) => (a.ordre ?? 999) - (b.ordre ?? 999));
  }

  if (Array.isArray(raw[0])) {
    const headers = raw[0].map((h: any) => String(h || '').trim().toLowerCase());
    const findCol = (candidates: string[], fallbackIdx: number) => {
      const found = headers.findIndex((h: string) =>
        candidates.some((c) => h === c || h.replace(/[\s_-]+/g, '') === c.replace(/[\s_-]+/g, ''))
      );
      return found >= 0 ? found : fallbackIdx;
    };

    const idxId = findCol(['id'], 0);
    const idxNom = findCol(['nom', 'partenaire'], 1);
    const idxRole = findCol(['rôle', 'role', 'categorie', 'catégorie', 'emplacement'], 2);
    const idxLogo = findCol(['logo_url', 'logo url', 'logo'], 3);
    const idxSite = findCol(['site_url', 'site url', 'site', 'lien', 'url'], 4);
    const idxOrdre = findCol(['ordre', 'order'], 5);
    const idxActif = findCol(['actif', 'active'], 6);

    const list: PartenaireLogo[] = [];
    for (let i = 1; i < raw.length; i++) {
      const row = raw[i];
      if (!Array.isArray(row) || row.length === 0) continue;
      const nom = String(row[idxNom] || '').trim();
      if (!nom) continue;
      list.push({
        id: String(row[idxId] || `part-${i}`).trim(),
        nom,
        role: String(row[idxRole] || 'club').trim(),
        logoUrl: String(row[idxLogo] || '').trim(),
        siteUrl: String(row[idxSite] || '').trim() || undefined,
        ordre: Number(row[idxOrdre] ?? i) || i,
        actif: toActif(row[idxActif]),
      });
    }
    return list.sort((a, b) => (a.ordre ?? 999) - (b.ordre ?? 999));
  }

  return [];
}

export async function fetchPartenairesLive(
  appsScriptUrl: string = APPS_SCRIPT_WEB_APP_URL,
  spreadsheetId?: string | null,
  accessToken?: string | null
): Promise<{
  success: boolean;
  partenaires: PartenaireLogo[];
  error?: string;
  scriptUpdateNeeded?: boolean;
}> {
  if (spreadsheetId && accessToken) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(PARTENAIRES_SHEET_TITLE)}?valueRenderOption=UNFORMATTED_VALUE`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        return { success: true, partenaires: parsePartenairesRowsOrObjects(json.values || []) };
      }
    } catch (e) {
      console.warn("Erreur lecture directe Partenaires via Sheets API:", e);
    }
  }

  const urlToUse = appsScriptUrl || APPS_SCRIPT_WEB_APP_URL;
  const liveUrl = `${urlToUse}?action=getPartenaires&_t=${Date.now()}`;

  let json: any = null;
  try {
    const proxyUrl = `/api/gas-proxy?url=${encodeURIComponent(liveUrl)}`;
    const pRes = await fetch(proxyUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const ct = pRes.headers.get('content-type') || '';
    if (pRes.ok && ct.includes('application/json')) {
      json = await pRes.json();
    }
  } catch {
    // Fallback direct
  }

  if (!json) {
    try {
      const directRes = await fetch(liveUrl, {
        method: 'GET',
        redirect: 'follow',
        cache: 'no-store',
      });
      if (directRes.ok) {
        json = await directRes.json();
      }
    } catch {
      return { success: false, partenaires: [] };
    }
  }

  if (json && json.success === false) {
    const errMsg = String(json.error || '');
    const isUnknownAction =
      errMsg.toLowerCase().includes('action inconnue') ||
      errMsg.toLowerCase().includes('getpartenaires');
    return {
      success: false,
      partenaires: [],
      scriptUpdateNeeded: isUnknownAction,
      error: isUnknownAction
        ? "L'action 'getPartenaires' n'est pas encore déployée dans votre Web App Google Apps Script (Code.gs)."
        : errMsg,
    };
  }

  const rawList = Array.isArray(json?.data)
    ? json.data
    : Array.isArray(json?.partenaires)
      ? json.partenaires
      : [];
  return {
    success: true,
    partenaires: parsePartenairesRowsOrObjects(rawList),
  };
}

export async function savePartenaireToSheet(
  partenaire: Omit<PartenaireLogo, 'id'> & { id?: string },
  appsScriptUrl: string = APPS_SCRIPT_WEB_APP_URL
): Promise<{ success: boolean; id?: string; error?: string }> {
  const id = (partenaire.id || '').trim() || `part-${Date.now()}`;
  const targetUrl = appsScriptUrl || APPS_SCRIPT_WEB_APP_URL;

  const cleanPartenaire = {
    id,
    nom: partenaire.nom.trim(),
    role: (partenaire.role || 'club').trim(),
    logoUrl: (partenaire.logoUrl || '').trim(),
    siteUrl: (partenaire.siteUrl || '').trim(),
    ordre: Number(partenaire.ordre ?? 1) || 1,
    actif: partenaire.actif !== false ? 'OUI' : 'NON',
  };

  const payload = {
    action: 'savePartenaire',
    partenaire: cleanPartenaire,
  };

  let appsScriptError: string | undefined;
  try {
    const proxyUrl = `/api/gas-proxy?url=${encodeURIComponent(targetUrl)}`;
    const pRes = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    const ct = pRes.headers.get('content-type') || '';
    if (pRes.ok && ct.includes('application/json')) {
      const pJson = await pRes.json();
      if (pJson && pJson.success === false) {
        appsScriptError =
          pJson.error || "Mettez à jour votre script Code.gs pour supporter 'savePartenaire'.";
      } else {
        return { success: true, id: pJson.id || id };
      }
    }
  } catch {
    // Fallback
  }

  if (!appsScriptError) {
    try {
      await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        mode: 'no-cors',
      });
      return { success: true, id };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Erreur réseau.' };
    }
  }

  return { success: false, error: appsScriptError };
}

export async function deletePartenaireInSheet(
  id: string,
  appsScriptUrl: string = APPS_SCRIPT_WEB_APP_URL
): Promise<{ success: boolean; error?: string }> {
  const targetUrl = appsScriptUrl || APPS_SCRIPT_WEB_APP_URL;
  const payload = { action: 'deletePartenaire', id };

  try {
    const proxyUrl = `/api/gas-proxy?url=${encodeURIComponent(targetUrl)}`;
    const pRes = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    const ct = pRes.headers.get('content-type') || '';
    if (pRes.ok && ct.includes('application/json')) {
      const pJson = await pRes.json();
      if (pJson && pJson.success === false) {
        return { success: false, error: pJson.error || 'Erreur lors de la suppression.' };
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