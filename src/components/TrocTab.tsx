import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ShoppingBag,
  Plus,
  RefreshCw,
  Search,
  Phone,
  Mail,
  MessageSquare,
  CheckCircle2,
  RotateCcw,
  Trash2,
  Camera,
  X,
  AlertTriangle,
  Tag,
  Image as ImageIcon,
  FileCode2,
  Loader2,
  Heart,
  ExternalLink,
  Award,
  PackageCheck,
  Pencil,
  Settings2,
  Store,
  ArrowLeft,
  Minus,
  MessageCircle,
  Check,
  Sparkles,
  Upload,
  ChevronLeft,
  ChevronRight,
  Info,
  ShieldCheck,
  LayoutGrid,
  Shirt,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  TrocAnnonce,
  TrocCategorie,
  TrocEtat,
  GoSportOffre,
  UserRole,
  PartenaireLogo,
} from '../types/tennis';
import {
  fetchTrocAnnoncesLive,
  saveTrocAnnonceToSheet,
  updateTrocStatutInSheet,
  fetchGoSportOffresLive,
  saveGoSportOffreToSheet,
  deleteGoSportOffreInSheet,
  TCM_APPS_SCRIPT_URL,
} from '../services/googleSheets';
import { getAccessToken } from '../services/auth';
import { resolvePartnerLogoUrl } from '../utils/partnerLogos';
import { PartenairesModal } from './PartenairesModal';

/**
 * URL de la boutique officielle du club
 */
export const OFFICIAL_SHOP_WORDPRESS_URL = 'https://monespaceclub.com/categorie/tennis/tennis-club-muzillac/';

const FAVORIS_STORAGE_KEY = 'club_tennis_favoris';
const MES_ANNONCES_STORAGE_KEY = 'club_tennis_mes_annonces';
const VENDEUR_PROFIL_STORAGE_KEY = 'club_tennis_vendeur_profil';

type ProShopSubTab = 'menu' | 'gosport' | 'annonces' | 'mes_annonces';

interface SellerProfile {
  nom?: string;
  tel?: string;
  email?: string;
}

interface TrocTabProps {
  gasUrl?: string;
  selectedSpreadsheetId?: string | null;
  googleUser?: User | null;
  userRole: UserRole;
  onOpenScriptModal?: () => void;
  partenaires?: PartenaireLogo[];
  onRefreshPartenaires?: () => Promise<void>;
}

const CATEGORIES: TrocCategorie[] = [
  'Raquettes',
  'Chaussures',
  'Tenues',
  'Sacs & Accessoires',
  'Balles & Cordages',
];

const ETATS: TrocEtat[] = [
  'Neuf',
  'Très bon état',
  'Bon état',
  'État correct',
];

const GOSPORT_CATEGORIES_SUGGESTIONS = [
  'Raquettes Adulte',
  'Raquettes Enfant',
  'Chaussures Homme',
  'Chaussures Femme',
  'Chaussures Enfant',
  'Sac à dos',
  'Thermobag',
  'Grip',
  'Surgrip',
  'Cordages',
  'Balles',
  'Antivibrateurs',
  'Bandeau',
  'Poignet',
  'Tenues',
  'Accessoires',
];

const GOSPORT_FAMILY_ORDER = [
  'Raquettes',
  'Chaussures',
  'Sacs',
  'Tenues',
  'Balles',
  'Cordages',
  'Grips & Surgrips',
  'Antivibrateurs',
  'Bandeau',
  'Poignet',
  'Casquettes',
  'Chaussettes',
  'Accessoires',
];

const GOSPORT_SUBCAT_ORDER: Record<string, string[]> = {
  Raquettes: ['Adulte', 'Enfant'],
  Chaussures: ['Homme', 'Femme', 'Enfant'],
  Sacs: ['Sac à dos', 'Thermobag'],
  'Grips & Surgrips': ['Grip', 'Surgrip'],
};

function getGoSportCategoryFamily(rawCategorie: string): string {
  const raw = (rawCategorie || '').trim();
  const s = raw.toLowerCase();
  if (!s) return 'Accessoires';
  if (s.includes('antivibrateur') || s.includes('anti-vibrateur') || s.includes('anti vibrateur')) {
    return 'Antivibrateurs';
  }
  if (s.includes('grip') || s.includes('surgrip') || s.includes('overgrip')) {
    return 'Grips & Surgrips';
  }
  if (s.includes('cordage') || s.includes('bobine')) {
    return 'Cordages';
  }
  if (s.includes('raquette')) {
    return 'Raquettes';
  }
  if (s.includes('chaussure') || s.includes('basket')) {
    return 'Chaussures';
  }
  if (s.includes('sac') || s.includes('housse') || s.includes('thermo') || s.includes('backpack')) {
    return 'Sacs';
  }
  if (s.includes('balle')) {
    return 'Balles';
  }
  if (s.includes('bandeau')) {
    return 'Bandeau';
  }
  if (s.includes('poignet')) {
    return 'Poignet';
  }
  if (
    s.includes('tenue') ||
    s.includes('textile') ||
    s.includes('polo') ||
    s.includes('short') ||
    s.includes('tee') ||
    s.includes('t-shirt') ||
    s.includes('jupe') ||
    s.includes('veste') ||
    s.includes('pantalon')
  ) {
    return 'Tenues';
  }
  if (s.includes('casquette') || s.includes('visiere') || s.includes('visière')) {
    return 'Casquettes';
  }
  if (s.includes('chaussette')) {
    return 'Chaussettes';
  }
  return raw;
}

function getGoSportSubCategory(offre: GoSportOffre, family: string): string {
  const rawCat = (offre.categorie || '').trim();
  const sCat = rawCat.toLowerCase();
  const sName = `${offre.nomProduit || ''} ${offre.description || ''}`.toLowerCase();
  const combined = `${sCat} ${sName}`;

  if (family === 'Raquettes') {
    if (/\b(enfant|enfants|junior|kid|kids|jr)\b/.test(`${combined} ${offre.taillesDispo || ''}`.toLowerCase())) {
      return 'Enfant';
    }
    return 'Adulte';
  }

  if (family === 'Chaussures') {
    if (/^\s*chaussures?\s*f[\/\b]/i.test(rawCat) || /\b(femme|femmes|women|woman|lady|ladies|wmns|fille|filles)\b/.test(combined)) {
      return 'Femme';
    }
    if (/^\s*chaussures?\s*e[\/\b]/i.test(rawCat) || /\b(enfant|enfants|junior|kid|kids|jr|gar[cç]on)\b/.test(combined)) {
      return 'Enfant';
    }
    if (/^\s*chaussures?\s*h[\/\b]/i.test(rawCat) || /\b(homme|hommes|men|man)\b/.test(combined)) {
      return 'Homme';
    }
    const nums = String(offre.taillesDispo || '')
      .match(/\b\d{2}\b/g)
      ?.map((n) => parseInt(n, 10))
      .filter((n) => n >= 24 && n <= 48) || [];
    if (nums.length > 0 && nums.every((n) => n <= 35)) {
      return 'Enfant';
    }
    return 'Homme';
  }

  if (family === 'Sacs') {
    if (/sac\s*[àa]\s*dos|backpack/i.test(combined)) {
      return 'Sac à dos';
    }
    if (/thermo|housse|\b(6|9|12|15)\s*(r|raquettes|pack)\b/i.test(combined)) {
      return 'Thermobag';
    }
    return rawCat || 'Thermobag';
  }

  if (family === 'Grips & Surgrips') {
    if (sCat.includes('surgrip') || sCat.includes('overgrip') || sName.includes('surgrip') || sName.includes('overgrip')) {
      return 'Surgrip';
    }
    return 'Grip';
  }

  return rawCat || family;
}

function renderAnnonceCategoryIcon(cat: string): React.ReactNode {
  const s = (cat || '').toLowerCase().trim();
  if (s === 'toutes' || s === 'tout') {
    return <LayoutGrid className="w-5 h-5 shrink-0" aria-hidden="true" />;
  }
  if (s.includes('antivibrateur') || s.includes('anti-vibrateur') || s.includes('anti vibrateur')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0" aria-hidden="true">
        <path d="M9.5 3.5v4M9.5 15.5v5" strokeWidth="1.45" opacity="0.8" />
        <path d="M14.5 3.5v4M14.5 15.5v5" strokeWidth="1.45" opacity="0.8" />
        <path d="M4.5 18h15" strokeWidth="1.45" opacity="0.7" />
        <rect x="6.5" y="7.5" width="11" height="8" rx="4" />
        <path d="M9.5 11.5h5" strokeWidth="1.6" />
        <path d="M3.5 9.5c-.6 1.2-.6 2.8 0 4M20.5 9.5c.6 1.2.6 2.8 0 4" strokeWidth="1.3" opacity="0.65" />
      </svg>
    );
  }
  if (s.includes('grip') || s.includes('surgrip') || s.includes('overgrip')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0" aria-hidden="true">
        <path d="M3.3 17.7 6.3 20.7a1 1 0 0 0 1.4 0l1.1-1.1-4.4-4.4-1.1 1.1a1 1 0 0 0 0 1.4Z" />
        <path d="M5.3 15.7 14.8 6.2l3 3-9.5 9.5" />
        <path d="M7.7 13.3 10.7 16.3M10.2 10.8 13.2 13.8M12.7 8.3 15.7 11.3" strokeWidth="1.4" />
        <path d="M14.8 6.2 16.5 3.6M17.8 9.2 20.4 7.5" opacity="0.85" />
      </svg>
    );
  }
  if (s.includes('raquette')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0" aria-hidden="true">
        <ellipse cx="14.5" cy="9.5" rx="5.5" ry="6.8" transform="rotate(45 14.5 9.5)" />
        <path d="M10.2 13.8 4.2 19.8" strokeWidth="2.4" />
        <path d="M12.2 7.2 16.8 11.8M11.6 10.6 16.6 5.6" strokeWidth="1.2" opacity="0.75" />
      </svg>
    );
  }
  if (s.includes('chaussure') || s.includes('basket')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0" aria-hidden="true">
        <path d="M3 16.5v-3.2c0-.6.4-1.1 1-1.3l3.2-.9L10.5 7c.5-.6 1.4-.5 1.8.1.9 1.5 2.4 2.6 4.4 3l3.2.8c1 .2 1.6 1 1.6 2v3.6c0 .8-.7 1.5-1.5 1.5H4.5C3.7 18 3 17.3 3 16.5Z" />
        <path d="M3 15.5h18.5" strokeWidth="1.4" opacity="0.7" />
      </svg>
    );
  }
  if (s.includes('bandeau')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0" aria-hidden="true">
        <path d="M3.5 13.5c0-4.2 3.8-7 8.5-7s8.5 2.8 8.5 7" />
        <path d="M3.5 13.5v3c0 .8.7 1.4 1.5 1.2 2-.6 4.4-.9 7-.9s5 .3 7 .9c.8.2 1.5-.4 1.5-1.2v-3" />
        <path d="M4.2 13.2c2.4-.8 5-1.2 7.8-1.2s5.4.4 7.8 1.2" strokeWidth="1.3" opacity="0.75" />
      </svg>
    );
  }
  if (s.includes('poignet')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0" aria-hidden="true">
        <rect x="6" y="5.5" width="12" height="13" rx="3" />
        <path d="M10 6v12M14 6v12" strokeWidth="1.3" opacity="0.7" />
        <path d="M6 9.5h12M6 14.5h12" strokeWidth="1.2" opacity="0.55" />
      </svg>
    );
  }
  if (s.includes('balle')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M6.2 6.2c3.2 3.2 3.2 8.4 0 11.6" />
        <path d="M17.8 6.2c-3.2 3.2-3.2 8.4 0 11.6" />
      </svg>
    );
  }
  if (s.includes('cordage') || s.includes('bobine')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="5" />
        <path d="M8.5 4.3v15.4M12 4v16M15.5 4.3v15.4" strokeWidth="1.35" opacity="0.88" />
        <path d="M4.3 8.5h15.4M4 12h16M4.3 15.5h15.4" strokeWidth="1.35" opacity="0.88" />
      </svg>
    );
  }
  if (s.includes('casquette') || s.includes('visiere') || s.includes('visière')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0" aria-hidden="true">
        <path d="M4 14a7 7 0 0 1 14 0" />
        <path d="M3 14h18c0 1.8-1.5 3-3.5 3H6.5C4.5 17 3 15.8 3 14Z" />
      </svg>
    );
  }
  if (s.includes('chaussette')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0" aria-hidden="true">
        <path d="M9 4h6v8.5l3.5 2.5a2.5 2.5 0 0 1-2.8 4.1L9.5 15.5A2 2 0 0 1 8.5 14V4.5c0-.3.2-.5.5-.5Z" />
        <path d="M9 7.5h6" strokeWidth="1.4" opacity="0.7" />
      </svg>
    );
  }
  if (s.includes('tenue') || s.includes('textile') || s.includes('polo') || s.includes('short') || s.includes('tee')) {
    return <Shirt className="w-5 h-5 shrink-0" aria-hidden="true" />;
  }
  if (s.includes('sac') || s.includes('housse') || s.includes('thermo') || s.includes('backpack')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0" aria-hidden="true">
        <rect x="3" y="9" width="18" height="10" rx="3" />
        <path d="M8 9V7a4 4 0 0 1 8 0v2" />
        <path d="M3 13.5h18" strokeWidth="1.4" opacity="0.75" />
      </svg>
    );
  }
  return <Tag className="w-5 h-5 shrink-0" aria-hidden="true" />;
}

function getCategoryGridClass(count: number): string {
  if (count <= 2) return 'grid-cols-2';
  if (count === 3) return 'grid-cols-3';
  if (count === 4) return 'grid-cols-4';
  if (count === 5) return 'grid-cols-5';
  if (count === 6) return 'grid-cols-6';
  if (count === 7) return 'grid-cols-4 sm:grid-cols-7';
  if (count === 8) return 'grid-cols-4 sm:grid-cols-8';
  if (count === 9) return 'grid-cols-5 sm:grid-cols-9';
  if (count === 10) return 'grid-cols-5 sm:grid-cols-10';
  return 'grid-cols-5 sm:grid-cols-6 lg:grid-cols-11';
}

function getSubCategorySingleRowGridClass(count: number): string {
  if (count <= 2) return 'grid-cols-2';
  if (count === 3) return 'grid-cols-3';
  if (count === 4) return 'grid-cols-4';
  return 'grid-cols-5';
}

const SHORT_CATEGORY_LABELS: Record<string, string> = {
  Toutes: 'Toutes',
  Raquettes: 'Raquettes',
  Chaussures: 'Chaussures',
  Sacs: 'Sacs',
  Tenues: 'Tenues',
  'Sacs & Accessoires': 'Sacs',
  'Balles & Cordages': 'Balles',
  'Grips & Surgrips': 'Grips',
  Cordages: 'Cordages',
  Antivibrateurs: 'Antivibr.',
};

function formatPriceEur(value: number): string {
  if (Number.isInteger(value)) return `${value} €`;
  return `${value.toFixed(2).replace('.', ',')} €`;
}

const GOSPORT_WHATSAPP_NUMBER = '33664491763';

interface GoSportSizeStock {
  name: string;
  qty: number;
  hasExplicitQty: boolean;
}

interface GoSportEditableStockItem {
  key: string;
  name: string;
  qty: number;
}

function parseGoSportTaillesDispo(raw: string): GoSportSizeStock[] {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(.*?)\s*\((-?\d+)\)\s*$/);
      if (match && match[1].trim()) {
        return {
          name: match[1].trim(),
          qty: Math.max(0, parseInt(match[2], 10)),
          hasExplicitQty: true,
        };
      }
      return {
        name: part,
        qty: 2, // Sans parenthèse : considéré en stock par défaut
        hasExplicitQty: false,
      };
    });
}

function isGoSportUnitaire(reference?: string, nomProduit?: string): boolean {
  const refStr = String(reference || '').trim();
  const nomStr = String(nomProduit || '').trim();
  return /\/u(?:\b|$)/i.test(refStr) || /\/u(?:\b|$)/i.test(nomStr);
}

function deriveCleanSupplierRef(rawRef: string): string {
  const s = rawRef.trim();
  if (!s) return '';
  const withoutUnit = s.replace(/\/u(?:\b|$)/gi, '').trim();
  const slashParts = withoutUnit
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean);
  const base = slashParts.length >= 2 ? slashParts[slashParts.length - 1] : withoutUnit;
  return base.replace(/\+$/, '').trim();
}

function formatGoSportStockItems(items: GoSportEditableStockItem[]): string {
  return items
    .filter((item) => item.name.trim())
    .map((item) => `${item.name.trim()} (${Math.max(0, Math.floor(Number(item.qty) || 0))})`)
    .join(', ');
}

function serializeGoSportSizesPreservingImplicit(sizes: GoSportSizeStock[]): string {
  return sizes
    .filter((s) => s.name.trim())
    .map((s) =>
      s.hasExplicitQty
        ? `${s.name.trim()} (${Math.max(0, Math.floor(s.qty))})`
        : s.name.trim()
    )
    .join(', ');
}

interface WhatsAppConfirmData {
  offre: GoSportOffre;
  tailleName: string;
  sizeIndex: number;
  hasExplicitQty: boolean;
  currentQty: number;
  clubPrice: number;
  whatsappHref: string;
}

function normalizePhoneCompare(phone?: string): string {
  return String(phone || '').replace(/\D/g, '');
}

function readStringArrayFromStorage(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
  } catch {
    return [];
  }
}

function writeStringArrayToStorage(key: string, values: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(values));
  } catch {
    // Ignorer quota storage
  }
}

function readSellerProfile(): SellerProfile {
  try {
    const raw = localStorage.getItem(VENDEUR_PROFIL_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function writeSellerProfile(profile: SellerProfile): void {
  try {
    localStorage.setItem(VENDEUR_PROFIL_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignorer quota storage
  }
}

/**
 * Compression côté client en JPEG < ~40 Ko pour respecter la limite de 50 000 caractères par cellule Google Sheets
 */
async function compressImageToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxSide = 480;
        let { width, height } = img;
        if (width > maxSide || height > maxSide) {
          if (width > height) {
            height = Math.round((height * maxSide) / width);
            width = maxSide;
          } else {
            width = Math.round((width * maxSide) / height);
            height = maxSide;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Canvas indisponible pour traiter l'image."));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        let quality = 0.72;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > 42000 && quality > 0.3) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Impossible de lire le fichier image."));
      img.src = String(reader.result || '');
    };
    reader.onerror = () => reject(new Error("Erreur lors de la lecture du fichier."));
    reader.readAsDataURL(file);
  });
}

function isTechnicalGoSportCategory(categorie: string): boolean {
  const s = (categorie || '').toLowerCase().trim();
  if (!s) return true;
  return (
    !s.includes('balle') &&
    !s.includes('cordage') &&
    !s.includes('accessoire') &&
    !s.includes('grip') &&
    !s.includes('surgrip') &&
    !s.includes('antivibrateur')
  );
}

function getGoSportPhotoSlotLabels(categorie: string): { slot1: string; slot2: string } {
  const s = (categorie || '').toLowerCase();
  if (s.includes('chaussure')) {
    return { slot1: 'Profil / Principale', slot2: 'Semelle / Autre angle' };
  }
  if (s.includes('raquette')) {
    return { slot1: 'Vue globale', slot2: 'Détail cadre / Cordage' };
  }
  if (s.includes('sac')) {
    return { slot1: 'Vue extérieure', slot2: 'Compartiments / Détail' };
  }
  if (s.includes('tenue')) {
    return { slot1: 'Face / Principale', slot2: 'Dos / Détail' };
  }
  return { slot1: 'Vue principale', slot2: 'Vue complémentaire' };
}

function isExternalHttpUrl(url?: string | null): boolean {
  const s = String(url || '').trim();
  return s.startsWith('https://') || s.startsWith('http://');
}

async function convertRemoteImageUrlToBase64(url: string): Promise<string> {
  const cleanUrl = String(url || '').trim();
  if (!cleanUrl) throw new Error("URL d'image vide.");
  if (cleanUrl.startsWith('data:image')) return cleanUrl;

  const tryFetchBlob = async (targetUrl: string): Promise<Blob> => {
    const res = await fetch(targetUrl, { signal: AbortSignal.timeout(7000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    if (!blob.type.startsWith('image/') && blob.size < 100) {
      throw new Error('Contenu non image');
    }
    return blob;
  };

  try {
    const proxyBlob = await tryFetchBlob(`/api/image-proxy?url=${encodeURIComponent(cleanUrl)}`);
    return await compressImageToBase64(proxyBlob);
  } catch {
    const directBlob = await tryFetchBlob(cleanUrl);
    return await compressImageToBase64(directBlob);
  }
}

export const TrocTab: React.FC<TrocTabProps> = ({
  gasUrl,
  selectedSpreadsheetId,
  userRole,
  onOpenScriptModal,
  partenaires = [],
  onRefreshPartenaires,
}) => {
  const [subTab, setSubTab] = useState<ProShopSubTab>('menu');
  const [isOfficialShopOpen, setIsOfficialShopOpen] = useState(false);
  const [isShopIframeLoading, setIsShopIframeLoading] = useState(true);
  const [isPartenairesModalOpen, setIsPartenairesModalOpen] = useState(false);

  const goSportLogoUrl = useMemo(
    () => resolvePartnerLogoUrl(partenaires, 'gosport'),
    [partenaires]
  );
  const mizunoLogoUrl = useMemo(
    () => resolvePartnerLogoUrl(partenaires, 'mizuno'),
    [partenaires]
  );
  const wilsonLogoUrl = useMemo(
    () => resolvePartnerLogoUrl(partenaires, 'wilson'),
    [partenaires]
  );

  const openOfficialShop = () => {
    setIsShopIframeLoading(true);
    setIsOfficialShopOpen(true);
  };

  // ==================== ÉTAT : OFFRES GO SPORT MUZILLAC ====================
  const [goSportOffres, setGoSportOffres] = useState<GoSportOffre[]>([]);
  const [isGoSportLoading, setIsGoSportLoading] = useState<boolean>(true);
  const [goSportError, setGoSportError] = useState<string | null>(null);
  const [goSportScriptNeeded, setGoSportScriptNeeded] = useState<boolean>(false);
  const [goSportSearch, setGoSportSearch] = useState('');
  const [goSportSelectedCat, setGoSportSelectedCat] = useState<string>('Toutes');
  const [goSportSelectedSubCat, setGoSportSelectedSubCat] = useState<string>('');
  const [goSportBrokenPhotos, setGoSportBrokenPhotos] = useState<Record<string, boolean>>({});
  const [selectedSizesByOffre, setSelectedSizesByOffre] = useState<Record<string, string>>({});
  const [sizeHintByOffre, setSizeHintByOffre] = useState<Record<string, boolean>>({});
  const [quickStockStatusByOffre, setQuickStockStatusByOffre] = useState<
    Record<string, 'idle' | 'saving' | 'saved' | 'error'>
  >({});
  const [whatsappConfirmData, setWhatsappConfirmData] = useState<WhatsAppConfirmData | null>(null);
  const [detailGoSportOffreId, setDetailGoSportOffreId] = useState<string | null>(null);
  const [detailPhotoIndex, setDetailPhotoIndex] = useState(0);
  const detailTouchStartXRef = useRef<number | null>(null);
  const goSportOffresRef = useRef<GoSportOffre[]>([]);
  const stockSaveChainRef = useRef<Record<string, Promise<void>>>({});

  const detailGoSportOffre = useMemo(
    () => goSportOffres.find((o) => o.id === detailGoSportOffreId) || null,
    [goSportOffres, detailGoSportOffreId]
  );

  useEffect(() => {
    setDetailPhotoIndex(0);
  }, [detailGoSportOffreId]);

  useEffect(() => {
    goSportOffresRef.current = goSportOffres;
  }, [goSportOffres]);

  // Modale Admin : Gérer les offres GO Sport
  const [isGoSportModalOpen, setIsGoSportModalOpen] = useState(false);
  const [goSportModalView, setGoSportModalView] = useState<'list' | 'form'>('list');
  const [editingGoSportId, setEditingGoSportId] = useState<string | null>(null);
  const [gsNomProduit, setGsNomProduit] = useState('');
  const [gsCategorie, setGsCategorie] = useState('Raquettes');
  const [gsPhotoUrl, setGsPhotoUrl] = useState('');
  const [gsPhotoUrl2, setGsPhotoUrl2] = useState('');
  const [gsActivePhotoSlot, setGsActivePhotoSlot] = useState<1 | 2>(1);
  const [gsShowExtraPhotoSlot, setGsShowExtraPhotoSlot] = useState(false);
  const [gsTarifMagasin, setGsTarifMagasin] = useState('');
  const [gsPrixPromo, setGsPrixPromo] = useState('');
  const [gsTarifAdherent, setGsTarifAdherent] = useState('');
  const [gsExcluClub, setGsExcluClub] = useState(false);
  const [gsStockItems, setGsStockItems] = useState<GoSportEditableStockItem[]>([]);
  const [gsNewSizeName, setGsNewSizeName] = useState('');
  const [gsNewSizeQty, setGsNewSizeQty] = useState('1');
  const [gsDescription, setGsDescription] = useState('');
  const [isSavingGoSport, setIsSavingGoSport] = useState(false);
  const [isCompressingGsPhoto, setIsCompressingGsPhoto] = useState(false);
  const [isConvertingUrlSlot, setIsConvertingUrlSlot] = useState<1 | 2 | null>(null);
  const [isBackingUpExternalPhotos, setIsBackingUpExternalPhotos] = useState(false);
  const [backupExternalProgress, setBackupExternalProgress] = useState<{ done: number; total: number } | null>(null);
  const [goSportFormError, setGoSportFormError] = useState<string | null>(null);
  const [goSportSuccessMsg, setGoSportSuccessMsg] = useState<string | null>(null);
  const [deletingGoSportId, setDeletingGoSportId] = useState<string | null>(null);
  const [confirmDeleteGoSportId, setConfirmDeleteGoSportId] = useState<string | null>(null);
  const [gsReference, setGsReference] = useState('');
  const [gsReferenceClean, setGsReferenceClean] = useState('');
  const [isLookingUpGoSport, setIsLookingUpGoSport] = useState(false);
  const [gsLookupError, setGsLookupError] = useState<string | null>(null);
  const [gsLookupWarning, setGsLookupWarning] = useState<string | null>(null);
  const [gsLookupPhotos, setGsLookupPhotos] = useState<
    Array<{ url: string; source: string; useProxy?: boolean; broken?: boolean }>
  >([]);
  const [gsSelectedCandidateUrl, setGsSelectedCandidateUrl] = useState<string | null>(null);
  const [gsSelectedCandidateUrl2, setGsSelectedCandidateUrl2] = useState<string | null>(null);
  const [gsValidatingPhotoUrl, setGsValidatingPhotoUrl] = useState<string | null>(null);
  const [gsLookupSuggestedDesc, setGsLookupSuggestedDesc] = useState('');
  const [gsLastLookedUpRef, setGsLastLookedUpRef] = useState('');
  const gsFileInputRef = useRef<HTMLInputElement>(null);
  const gsCameraInputRef = useRef<HTMLInputElement>(null);
  const gsUploadTargetSlotRef = useRef<1 | 2>(1);

  // ==================== ÉTAT : PETITES ANNONCES (Troc_Annonces) ====================
  const [annonces, setAnnonces] = useState<TrocAnnonce[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scriptUpdateNeeded, setScriptUpdateNeeded] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategorie, setSelectedCategorie] = useState<string>('Toutes');
  const [showSold, setShowSold] = useState<boolean>(false);
  const [showHeartedOnly, setShowHeartedOnly] = useState<boolean>(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccessMsg, setFormSuccessMsg] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ photos: string[]; index: number; titre: string } | null>(null);
  const [brokenPhotos, setBrokenPhotos] = useState<Record<string, boolean>>({});

  // Coups de coeur & Mes Annonces (localStorage)
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() =>
    readStringArrayFromStorage(FAVORIS_STORAGE_KEY)
  );
  const [myAnnonceIds, setMyAnnonceIds] = useState<string[]>(() =>
    readStringArrayFromStorage(MES_ANNONCES_STORAGE_KEY)
  );
  const [sellerProfile, setSellerProfile] = useState<SellerProfile>(() => readSellerProfile());
  const [lookupContact, setLookupContact] = useState('');

  // Champs du formulaire d'ajout Troc (1 photo obligatoire + 2 optionnelles)
  const [titre, setTitre] = useState('');
  const [categorie, setCategorie] = useState<TrocCategorie>('Raquettes');
  const [taillePointure, setTaillePointure] = useState('');
  const [etat, setEtat] = useState<TrocEtat>('Très bon état');
  const [prix, setPrix] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoUrl2, setPhotoUrl2] = useState('');
  const [photoUrl3, setPhotoUrl3] = useState('');
  const [compressingPhotoSlot, setCompressingPhotoSlot] = useState<1 | 2 | 3 | null>(null);
  const [contactNom, setContactNom] = useState(() => readSellerProfile().nom || '');
  const [contactTel, setContactTel] = useState(() => readSellerProfile().tel || '');
  const [contactEmail, setContactEmail] = useState(() => readSellerProfile().email || '');

  const fileInputRef1 = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);
  const fileInputRef3 = useRef<HTMLInputElement>(null);

  // ==================== CHARGEMENTS EN DIRECT ====================
  const loadGoSportLive = useCallback(async () => {
    setIsGoSportLoading(true);
    setGoSportError(null);
    setGoSportScriptNeeded(false);

    let token: string | null = null;
    try {
      token = await getAccessToken();
    } catch {
      token = null;
    }

    const res = await fetchGoSportOffresLive(
      gasUrl || TCM_APPS_SCRIPT_URL,
      selectedSpreadsheetId,
      token
    );

    if (res.success) {
      setGoSportOffres(res.offres);
      setGoSportError(null);
      setGoSportScriptNeeded(false);
    } else {
      setGoSportOffres([]);
      setGoSportError(res.error || "Impossible de charger les offres depuis « Partenaire_GOSport ».");
      setGoSportScriptNeeded(!!res.scriptUpdateNeeded);
    }
    setIsGoSportLoading(false);
  }, [gasUrl, selectedSpreadsheetId]);

  const loadAnnoncesLive = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    setScriptUpdateNeeded(false);

    let token: string | null = null;
    try {
      token = await getAccessToken();
    } catch {
      token = null;
    }

    const res = await fetchTrocAnnoncesLive(
      gasUrl || TCM_APPS_SCRIPT_URL,
      selectedSpreadsheetId,
      token
    );

    if (res.success) {
      setAnnonces(res.annonces);
      setLoadError(null);
      setScriptUpdateNeeded(false);
    } else {
      setAnnonces([]);
      setLoadError(res.error || "Impossible de charger les annonces depuis Google Sheets.");
      setScriptUpdateNeeded(!!res.scriptUpdateNeeded);
    }
    setIsLoading(false);
  }, [gasUrl, selectedSpreadsheetId]);

  useEffect(() => {
    loadGoSportLive();
    loadAnnoncesLive();
  }, [loadGoSportLive, loadAnnoncesLive]);

  // ==================== GESTION FAVORIS (club_tennis_favoris) ====================
  const toggleFavorite = useCallback((annonceId: string) => {
    setFavoriteIds((prev) => {
      const exists = prev.includes(annonceId);
      const next = exists ? prev.filter((id) => id !== annonceId) : [...prev, annonceId];
      writeStringArrayToStorage(FAVORIS_STORAGE_KEY, next);
      return next;
    });
  }, []);

  // ==================== AJUSTEMENT RAPIDE & DÉCRÉMENTATION AUTO STOCK GO SPORT ====================
  const applyGoSportStockDelta = useCallback(
    (offreId: string, sizeIndex: number, delta: -1 | 1, onlyIfExplicit = false) => {
      const current = goSportOffresRef.current.find((o) => o.id === offreId);
      if (!current) return null;

      const parsed = parseGoSportTaillesDispo(current.taillesDispo);
      const target = parsed[sizeIndex];
      if (!target) return null;
      if (onlyIfExplicit && !target.hasExplicitQty) return null;

      const nextQty = Math.max(0, target.qty + delta);
      if (nextQty === target.qty && target.hasExplicitQty) return null;

      const updatedSizes: GoSportSizeStock[] = parsed.map((s, idx) =>
        idx === sizeIndex ? { ...s, qty: nextQty, hasExplicitQty: true } : s
      );
      const nextTaillesDispo = serializeGoSportSizesPreservingImplicit(updatedSizes);
      const updatedOffre: GoSportOffre = { ...current, taillesDispo: nextTaillesDispo };

      // Mise à jour synchrone pour supporter les clics rapides en rafale (-1 / +1)
      goSportOffresRef.current = goSportOffresRef.current.map((o) =>
        o.id === offreId ? updatedOffre : o
      );
      setGoSportOffres(goSportOffresRef.current);

      if (nextQty === 0) {
        setSelectedSizesByOffre((prev) =>
          prev[offreId] === target.name ? { ...prev, [offreId]: '' } : prev
        );
      }

      setQuickStockStatusByOffre((prev) => ({ ...prev, [offreId]: 'saving' }));

      const prevChain = stockSaveChainRef.current[offreId] || Promise.resolve();
      const nextChain = prevChain.then(async () => {
        const res = await saveGoSportOffreToSheet(
          updatedOffre,
          gasUrl || TCM_APPS_SCRIPT_URL
        );
        if (res.success) {
          setQuickStockStatusByOffre((prev) => ({ ...prev, [offreId]: 'saved' }));
          setTimeout(() => {
            setQuickStockStatusByOffre((prev) =>
              prev[offreId] === 'saved' ? { ...prev, [offreId]: 'idle' } : prev
            );
          }, 2200);
        } else {
          setQuickStockStatusByOffre((prev) => ({ ...prev, [offreId]: 'error' }));
          setGoSportError(res.error || "Impossible d'enregistrer la mise à jour du stock.");
        }
      });
      stockSaveChainRef.current[offreId] = nextChain;

      return { updatedOffre, previousQty: target.qty, nextQty, tailleName: target.name };
    },
    [gasUrl]
  );

  const handleConfirmWhatsAppReservation = () => {
    if (!whatsappConfirmData) return;
    const { offre, tailleName, sizeIndex, hasExplicitQty, currentQty } = whatsappConfirmData;

    if (hasExplicitQty && currentQty > 0 && sizeIndex >= 0) {
      applyGoSportStockDelta(offre.id, sizeIndex, -1, true);
      setGoSportSuccessMsg(
        `Réservation confirmée ! Le stock de « ${offre.nomProduit} » (${tailleName}) a été mis à jour (-1).`
      );
    } else {
      setGoSportSuccessMsg(
        `Demande WhatsApp prête pour « ${offre.nomProduit} » (${tailleName}).`
      );
    }
    setTimeout(() => setGoSportSuccessMsg(null), 5000);
    setWhatsappConfirmData(null);
  };

  // ==================== FORMULAIRE GO SPORT ADMIN ====================
  const resetGoSportForm = () => {
    setEditingGoSportId(null);
    setGsReference('');
    setGsReferenceClean('');
    setIsLookingUpGoSport(false);
    setGsLookupError(null);
    setGsLookupWarning(null);
    setGsLookupPhotos([]);
    setGsSelectedCandidateUrl(null);
    setGsSelectedCandidateUrl2(null);
    setGsValidatingPhotoUrl(null);
    setGsLookupSuggestedDesc('');
    setGsLastLookedUpRef('');
    setGsNomProduit('');
    setGsCategorie('Raquettes');
    setGsPhotoUrl('');
    setGsPhotoUrl2('');
    setGsActivePhotoSlot(1);
    setGsShowExtraPhotoSlot(false);
    setGsTarifMagasin('');
    setGsPrixPromo('');
    setGsTarifAdherent('');
    setGsExcluClub(false);
    setGsStockItems([]);
    setGsNewSizeName('');
    setGsNewSizeQty('1');
    setGsDescription('');
    setGoSportFormError(null);
  };

  const openGoSportCreate = () => {
    resetGoSportForm();
    setGoSportModalView('form');
    setIsGoSportModalOpen(true);
  };

  const handleLookupGoSportByReference = async (override?: {
    query?: string;
    referenceMagasin?: string;
    referenceClean?: string;
    nomProduit?: string;
    categorie?: string;
    currentDesc?: string;
    isEdit?: boolean;
  }) => {
    const refMag = (override?.referenceMagasin ?? gsReference).trim();
    const refClean = (override?.referenceClean ?? gsReferenceClean).trim();
    const queryRef = (override?.query ?? (refClean || refMag)).trim();
    const fallbackNom = (override?.nomProduit ?? gsNomProduit).trim();
    const effectiveQuery = queryRef || fallbackNom;
    if (!effectiveQuery) {
      setGsLookupError('Saisissez une référence produit (ou un nom) avant de lancer la recherche.');
      return;
    }

    const effectiveCategorie = (override?.categorie ?? gsCategorie).trim();
    const effectiveCurrentDesc = (override?.currentDesc ?? gsDescription).trim();
    const effectiveIsEdit = override?.isEdit ?? !!editingGoSportId;

    setIsLookingUpGoSport(true);
    setGsLookupError(null);
    setGsLookupWarning(null);
    setGsLastLookedUpRef(effectiveQuery);

    try {
      const res = await fetch('/api/gosport-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: effectiveQuery,
          referenceMagasin: refMag || undefined,
          referenceClean: refClean || undefined,
          nomProduit: fallbackNom || undefined,
          categorie: effectiveCategorie || undefined,
        }),
      });
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        throw new Error(
          "Le service de recherche n'est pas joignable sur cet hébergement."
        );
      }
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Impossible de récupérer les infos produit.');
      }

      const foundPhotos = Array.isArray(data.photos)
        ? data.photos
            .filter((p: any) => p && typeof p.url === 'string' && p.url.startsWith('http'))
            .map((p: any) => ({
              url: String(p.url),
              source: String(p.source || 'Web'),
              useProxy: false,
              broken: false,
            }))
        : [];

      setGsLookupPhotos(foundPhotos);
      setGsLookupWarning(data.warning ? String(data.warning) : null);
      if (foundPhotos.length === 0) {
        setGsLookupError(
          "Aucune photo exploitable trouvée pour cette référence. Essayez d'ajouter la marque ou le modèle, ou importez une photo manuellement."
        );
      }

      if (!fallbackNom && data.nomProduit) {
        setGsNomProduit(String(data.nomProduit));
      }
      if (!effectiveIsEdit && data.categorie) {
        setGsCategorie(String(data.categorie));
      }
      if (!refClean && data.referenceClean) {
        setGsReferenceClean(String(data.referenceClean));
      }
      const suggestedDesc = String(data.description || '').trim();
      setGsLookupSuggestedDesc(suggestedDesc);
      if (!effectiveCurrentDesc && suggestedDesc) {
        setGsDescription(suggestedDesc);
      }
    } catch (err: any) {
      setGsLookupError(err?.message || 'Erreur lors de la recherche produit.');
    } finally {
      setIsLookingUpGoSport(false);
    }
  };

  const openGoSportEdit = (offre: GoSportOffre) => {
    const initialRefMag = (offre.reference || '').trim();
    const initialRefClean =
      (offre.referenceFabricantClean || '').trim() ||
      (initialRefMag ? deriveCleanSupplierRef(initialRefMag) : '');

    setEditingGoSportId(offre.id);
    setGsReference(initialRefMag);
    setGsReferenceClean(initialRefClean);
    setIsLookingUpGoSport(false);
    setGsLookupError(null);
    setGsLookupWarning(null);
    setGsLookupPhotos([]);
    setGsSelectedCandidateUrl(null);
    setGsSelectedCandidateUrl2(null);
    setGsValidatingPhotoUrl(null);
    setGsLookupSuggestedDesc('');
    setGsLastLookedUpRef('');
    setGsNomProduit(offre.nomProduit);
    setGsCategorie(offre.categorie || 'Équipement');
    setGsPhotoUrl(offre.photoUrl || '');
    setGsPhotoUrl2(offre.photoUrl2 || '');
    setGsActivePhotoSlot(offre.photoUrl && !offre.photoUrl2 && isTechnicalGoSportCategory(offre.categorie || '') ? 2 : 1);
    setGsShowExtraPhotoSlot(Boolean(offre.photoUrl2));
    setGsTarifMagasin(offre.tarifMagasin ? String(offre.tarifMagasin) : '');
    setGsPrixPromo(
      offre.prixPromo !== null && offre.prixPromo !== undefined ? String(offre.prixPromo) : ''
    );
    setGsTarifAdherent(
      offre.tarifAdherent !== null && offre.tarifAdherent !== undefined
        ? String(offre.tarifAdherent)
        : ''
    );
    setGsExcluClub(!!offre.excluClub);
    const parsedStock = parseGoSportTaillesDispo(offre.taillesDispo || '');
    setGsStockItems(
      parsedStock.map((item, idx) => ({
        key: `stock-${Date.now()}-${idx}`,
        name: item.name,
        qty: item.qty,
      }))
    );
    setGsNewSizeName('');
    setGsNewSizeQty('1');
    setGsDescription(offre.description || '');
    setGoSportFormError(null);
    setGoSportModalView('form');
    setIsGoSportModalOpen(true);

    // Si l'article importé depuis le logiciel magasin possède une référence mais pas encore de photo/description, lancer la recherche auto
    if ((initialRefClean || initialRefMag) && (!offre.photoUrl?.trim() || !offre.description?.trim())) {
      void handleLookupGoSportByReference({
        query: initialRefClean || initialRefMag,
        referenceMagasin: initialRefMag,
        referenceClean: initialRefClean,
        nomProduit: offre.nomProduit,
        categorie: offre.categorie || 'Équipement',
        currentDesc: offre.description || '',
        isEdit: true,
      });
    }
  };

  const handleSelectAndValidatePhoto = async (
    photo: {
      url: string;
      source: string;
      useProxy?: boolean;
    },
    slotOverride?: 1 | 2
  ) => {
    const targetSlot: 1 | 2 = slotOverride ?? gsActivePhotoSlot;
    if (targetSlot === 1) {
      setGsSelectedCandidateUrl(photo.url);
    } else {
      setGsSelectedCandidateUrl2(photo.url);
      setGsShowExtraPhotoSlot(true);
    }
    setGsLookupError(null);
    setGsLookupWarning(null);
    setGsValidatingPhotoUrl(photo.url);

    let finalValue = photo.url;
    try {
      // Sauvegarde systématique en local (proxy serveur + compression JPEG < 42 Ko) pour éviter tout lien cassé
      finalValue = await convertRemoteImageUrlToBase64(photo.url);
    } catch {
      setGsLookupWarning(
        "Impossible de copier automatiquement cette photo en local (site protégé) — le lien direct est conservé temporairement."
      );
    } finally {
      setGsValidatingPhotoUrl(null);
    }

    if (targetSlot === 1) {
      setGsPhotoUrl(finalValue);
      if (isTechnicalGoSportCategory(gsCategorie) && !gsPhotoUrl2.trim()) {
        setGsActivePhotoSlot(2);
      }
    } else {
      setGsPhotoUrl2(finalValue);
    }
  };

  const handleConvertManualUrlSlot = async (slot: 1 | 2) => {
    const rawUrl = (slot === 1 ? gsPhotoUrl : gsPhotoUrl2).trim();
    if (!isExternalHttpUrl(rawUrl)) return;
    setIsConvertingUrlSlot(slot);
    setGoSportFormError(null);
    try {
      const compressed = await convertRemoteImageUrlToBase64(rawUrl);
      if (slot === 1) setGsPhotoUrl(compressed);
      else setGsPhotoUrl2(compressed);
    } catch {
      setGoSportFormError(
        `Impossible de sauvegarder automatiquement le lien de la photo ${slot} (site externe bloqué).`
      );
    } finally {
      setIsConvertingUrlSlot(null);
    }
  };

  const handleBackupAllExternalGoSportPhotos = async () => {
    const targets = goSportOffresRef.current.filter(
      (o) => isExternalHttpUrl(o.photoUrl) || isExternalHttpUrl(o.photoUrl2)
    );
    if (targets.length === 0) return;

    setIsBackingUpExternalPhotos(true);
    setBackupExternalProgress({ done: 0, total: targets.length });
    setGoSportFormError(null);

    let convertedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < targets.length; i++) {
      const offre = targets[i];
      let nextPhoto1 = (offre.photoUrl || '').trim();
      let nextPhoto2 = (offre.photoUrl2 || '').trim();
      let changed = false;

      if (isExternalHttpUrl(nextPhoto1)) {
        try {
          nextPhoto1 = await convertRemoteImageUrlToBase64(nextPhoto1);
          changed = true;
        } catch {
          failedCount++;
        }
      }
      if (isExternalHttpUrl(nextPhoto2)) {
        try {
          nextPhoto2 = await convertRemoteImageUrlToBase64(nextPhoto2);
          changed = true;
        } catch {
          failedCount++;
        }
      }

      if (changed) {
        const res = await saveGoSportOffreToSheet(
          {
            ...offre,
            photoUrl: nextPhoto1,
            photoUrl2: nextPhoto2,
          },
          gasUrl || TCM_APPS_SCRIPT_URL
        );
        if (res.success) {
          convertedCount++;
        } else {
          failedCount++;
        }
      }

      setBackupExternalProgress({ done: i + 1, total: targets.length });
    }

    setIsBackingUpExternalPhotos(false);
    setBackupExternalProgress(null);
    await loadGoSportLive();

    if (convertedCount > 0) {
      setGoSportSuccessMsg(
        `${convertedCount} fiche(s) photo sauvegardée(s) localement dans Google Sheets.${
          failedCount > 0 ? ` (${failedCount} lien(s) inaccessible(s))` : ''
        }`
      );
      setTimeout(() => setGoSportSuccessMsg(null), 6000);
    } else if (failedCount > 0) {
      setGoSportFormError(
        "Certains liens externes n'ont pas pu être téléchargés (site source indisponible ou protégé)."
      );
    }
  };

  const handleAddGsStockRow = () => {
    const trimmed = gsNewSizeName.trim();
    if (!trimmed) return;
    const qtyNum = Math.max(0, parseInt(gsNewSizeQty, 10) || 0);
    setGsStockItems((prev) => [
      ...prev,
      { key: `stock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: trimmed, qty: qtyNum },
    ]);
    setGsNewSizeName('');
    setGsNewSizeQty('1');
  };

  const handleUpdateGsStockQty = (key: string, delta: number) => {
    setGsStockItems((prev) =>
      prev.map((item) =>
        item.key === key ? { ...item, qty: Math.max(0, item.qty + delta) } : item
      )
    );
  };

  const handleUpdateGsStockName = (key: string, name: string) => {
    setGsStockItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, name } : item))
    );
  };

  const handleRemoveGsStockRow = (key: string) => {
    setGsStockItems((prev) => prev.filter((item) => item.key !== key));
  };

  const triggerGsPhotoUpload = (mode: 'camera' | 'file', slot: 1 | 2) => {
    gsUploadTargetSlotRef.current = slot;
    if (mode === 'camera') {
      gsCameraInputRef.current?.click();
    } else {
      gsFileInputRef.current?.click();
    }
  };

  const handleGsPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const targetSlot = gsUploadTargetSlotRef.current;
    setIsCompressingGsPhoto(true);
    setGoSportFormError(null);
    try {
      const compressed = await compressImageToBase64(file);
      if (targetSlot === 1) {
        setGsPhotoUrl(compressed);
        setGsSelectedCandidateUrl(null);
        if (isTechnicalGoSportCategory(gsCategorie) && !gsPhotoUrl2.trim()) {
          setGsActivePhotoSlot(2);
        }
      } else {
        setGsPhotoUrl2(compressed);
        setGsSelectedCandidateUrl2(null);
        setGsShowExtraPhotoSlot(true);
      }
    } catch (err: any) {
      setGoSportFormError(err?.message || "Erreur lors du traitement de la photo.");
    } finally {
      setIsCompressingGsPhoto(false);
      e.target.value = '';
    }
  };

  const handleSaveGoSport = async (e: React.FormEvent) => {
    e.preventDefault();
    setGoSportFormError(null);

    if (!gsNomProduit.trim()) {
      setGoSportFormError('Veuillez renseigner le nom du produit.');
      return;
    }

    const magNum = parseFloat(gsTarifMagasin.replace(',', '.'));
    if (isNaN(magNum) || magNum < 0) {
      setGoSportFormError('Veuillez saisir un Tarif Magasin valide.');
      return;
    }

    const promoTrim = gsPrixPromo.trim();
    const promoNum = promoTrim ? parseFloat(promoTrim.replace(',', '.')) : null;
    if (promoTrim && (promoNum === null || isNaN(promoNum) || promoNum < 0)) {
      setGoSportFormError('Le Prix Promo est invalide.');
      return;
    }

    const adhTrim = gsTarifAdherent.trim();
    const adhNum = adhTrim ? parseFloat(adhTrim.replace(',', '.')) : null;
    if (adhTrim && (adhNum === null || isNaN(adhNum) || adhNum < 0)) {
      setGoSportFormError('Le Tarif Adhérent est invalide.');
      return;
    }

    const itemsToSave = [...gsStockItems];
    if (gsNewSizeName.trim()) {
      itemsToSave.push({
        key: `stock-pending-${Date.now()}`,
        name: gsNewSizeName.trim(),
        qty: Math.max(0, parseInt(gsNewSizeQty, 10) || 0),
      });
    }
    const serializedTailles = formatGoSportStockItems(itemsToSave);

    const finalRefMag = gsReference.trim();
    const finalRefClean =
      gsReferenceClean.trim() || (finalRefMag ? deriveCleanSupplierRef(finalRefMag) : '');

    setIsSavingGoSport(true);

    // Sauvegarde automatique en local si un lien externe http(s) reste dans Photo 1 ou Photo 2
    let finalPhoto1 = gsPhotoUrl.trim();
    let finalPhoto2 = gsPhotoUrl2.trim();
    if (isExternalHttpUrl(finalPhoto1)) {
      try {
        finalPhoto1 = await convertRemoteImageUrlToBase64(finalPhoto1);
      } catch {
        // Conserver l'URL si le serveur distant refuse le téléchargement
      }
    }
    if (isExternalHttpUrl(finalPhoto2)) {
      try {
        finalPhoto2 = await convertRemoteImageUrlToBase64(finalPhoto2);
      } catch {
        // Conserver l'URL si le serveur distant refuse le téléchargement
      }
    }

    const res = await saveGoSportOffreToSheet(
      {
        id: editingGoSportId || undefined,
        reference: finalRefMag || undefined,
        referenceFabricantClean: finalRefClean || undefined,
        nomProduit: gsNomProduit.trim(),
        categorie: gsCategorie.trim() || 'Équipement',
        photoUrl: finalPhoto1,
        photoUrl2: finalPhoto2,
        tarifMagasin: magNum,
        prixPromo: promoNum,
        tarifAdherent: adhNum,
        excluClub: gsExcluClub,
        taillesDispo: serializedTailles,
        description: gsDescription.trim(),
      },
      gasUrl || TCM_APPS_SCRIPT_URL
    );
    setIsSavingGoSport(false);

    if (res.success) {
      const wasEdit = !!editingGoSportId;
      resetGoSportForm();
      setGoSportModalView('list');
      setGoSportSuccessMsg(
        wasEdit
          ? "Produit mis à jour en direct dans « Partenaire_GOSport »."
          : "Nouvelle offre ajoutée en direct dans « Partenaire_GOSport »."
      );
      setTimeout(() => setGoSportSuccessMsg(null), 5000);
      await loadGoSportLive();
    } else {
      setGoSportFormError(res.error || "Impossible d'enregistrer l'offre GO Sport.");
    }
  };

  const handleDeleteGoSport = async (id: string) => {
    const targetOffre = goSportOffresRef.current.find((o) => o.id === id);
    setDeletingGoSportId(id);
    setGoSportFormError(null);
    setGoSportError(null);
    const res = await deleteGoSportOffreInSheet(
      id,
      gasUrl || TCM_APPS_SCRIPT_URL,
      targetOffre?.reference
    );
    setDeletingGoSportId(null);
    setConfirmDeleteGoSportId(null);
    if (res.success) {
      const next = goSportOffresRef.current.filter((o) => o.id !== id);
      goSportOffresRef.current = next;
      setGoSportOffres(next);
      if (editingGoSportId === id) {
        resetGoSportForm();
        setGoSportModalView('list');
      }
      setGoSportSuccessMsg("Article supprimé définitivement de « Partenaire_GOSport ».");
      setTimeout(() => setGoSportSuccessMsg(null), 4000);
      await loadGoSportLive();
    } else {
      const errMsg = res.error || "Impossible de supprimer cet article.";
      setGoSportFormError(errMsg);
      setGoSportError(errMsg);
    }
  };

  // ==================== FORMULAIRE PETITES ANNONCES ====================
  const handlePhotoFileChange = async (
    slot: 1 | 2 | 3,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCompressingPhotoSlot(slot);
    setFormError(null);
    try {
      const compressed = await compressImageToBase64(file);
      if (slot === 1) setPhotoUrl(compressed);
      else if (slot === 2) setPhotoUrl2(compressed);
      else setPhotoUrl3(compressed);
    } catch (err: any) {
      setFormError(err?.message || "Erreur lors du traitement de la photo.");
    } finally {
      setCompressingPhotoSlot(null);
    }
  };

  const resetForm = () => {
    setTitre('');
    setCategorie('Raquettes');
    setTaillePointure('');
    setEtat('Très bon état');
    setPrix('');
    setPhotoUrl('');
    setPhotoUrl2('');
    setPhotoUrl3('');
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!titre.trim()) {
      setFormError("Veuillez saisir le titre de l'annonce.");
      return;
    }
    if (!taillePointure.trim()) {
      setFormError("Veuillez préciser la taille, la pointure ou le manche.");
      return;
    }
    const numericPrice = parseFloat(prix.replace(',', '.'));
    if (isNaN(numericPrice) || numericPrice < 0) {
      setFormError("Veuillez saisir un prix valide en euros.");
      return;
    }
    if (!photoUrl.trim()) {
      setFormError("Veuillez ajouter la photo principale (Photo 1 obligatoire).");
      return;
    }
    if (!contactNom.trim()) {
      setFormError("Veuillez indiquer votre nom/prénom pour que les adhérents puissent vous joindre.");
      return;
    }
    if (!contactTel.trim() && !contactEmail.trim()) {
      setFormError("Veuillez indiquer au moins un moyen de contact (téléphone ou email).");
      return;
    }

    setIsSubmitting(true);
    let token: string | null = null;
    try {
      token = await getAccessToken();
    } catch {
      token = null;
    }

    const res = await saveTrocAnnonceToSheet(
      {
        titre,
        categorie,
        taillePointure,
        etat,
        photoUrl: photoUrl.trim(),
        photoUrl2: photoUrl2.trim() || undefined,
        photoUrl3: photoUrl3.trim() || undefined,
        prix: numericPrice,
        contactNom,
        contactTel,
        contactEmail,
      },
      gasUrl || TCM_APPS_SCRIPT_URL,
      selectedSpreadsheetId,
      token
    );

    setIsSubmitting(false);

    if (res.success) {
      if (res.id) {
        setMyAnnonceIds((prev) => {
          const next = prev.includes(res.id!) ? prev : [res.id!, ...prev];
          writeStringArrayToStorage(MES_ANNONCES_STORAGE_KEY, next);
          return next;
        });
      }
      const savedProfile: SellerProfile = {
        nom: contactNom.trim(),
        tel: contactTel.trim(),
        email: contactEmail.trim(),
      };
      setSellerProfile(savedProfile);
      writeSellerProfile(savedProfile);

      setIsFormOpen(false);
      resetForm();
      setFormSuccessMsg("Annonce publiée en direct dans « Troc_Annonces » et ajoutée à « Mes Annonces ».");
      setTimeout(() => setFormSuccessMsg(null), 5000);
      await loadAnnoncesLive();
    } else {
      setFormError(res.error || "Échec de l'enregistrement de l'annonce.");
    }
  };

  const handleChangeStatut = async (
    annonce: TrocAnnonce,
    nouveauStatut: 'Disponible' | 'Vendu' | 'Supprimé'
  ) => {
    setUpdatingId(annonce.id);
    const res = await updateTrocStatutInSheet(annonce.id, nouveauStatut, gasUrl || TCM_APPS_SCRIPT_URL);
    setUpdatingId(null);
    setConfirmDeleteId(null);
    if (res.success) {
      if (nouveauStatut === 'Supprimé') {
        setFavoriteIds((prev) => {
          const next = prev.filter((id) => id !== annonce.id);
          writeStringArrayToStorage(FAVORIS_STORAGE_KEY, next);
          return next;
        });
        setMyAnnonceIds((prev) => {
          const next = prev.filter((id) => id !== annonce.id);
          writeStringArrayToStorage(MES_ANNONCES_STORAGE_KEY, next);
          return next;
        });
      }
      await loadAnnoncesLive();
    } else {
      setLoadError(res.error || "Impossible de mettre à jour le statut de l'annonce.");
    }
  };

  const handleSaveLookupProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const val = lookupContact.trim();
    if (!val) return;
    const next: SellerProfile = val.includes('@')
      ? { ...sellerProfile, email: val }
      : { ...sellerProfile, tel: val };
    setSellerProfile(next);
    writeSellerProfile(next);
  };

  // ==================== DONNÉES FILTRÉES ====================
  const goSportCategories = useMemo(() => {
    const families = Array.from(
      new Set(goSportOffres.map((o) => getGoSportCategoryFamily(o.categorie)).filter(Boolean))
    );
    families.sort((a, b) => {
      const idxA = GOSPORT_FAMILY_ORDER.indexOf(a);
      const idxB = GOSPORT_FAMILY_ORDER.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b, 'fr');
    });
    return ['Toutes', ...families];
  }, [goSportOffres]);

  const goSportSubCategories = useMemo(() => {
    if (goSportSelectedCat === 'Toutes') return [];
    const familyOffres = goSportOffres.filter(
      (o) => getGoSportCategoryFamily(o.categorie) === goSportSelectedCat
    );
    const uniqueSubs = Array.from(
      new Set(
        familyOffres
          .map((o) => getGoSportSubCategory(o, goSportSelectedCat))
          .filter(Boolean)
      )
    );
    if (goSportSelectedCat === 'Chaussures') {
      return ['Homme', 'Femme', 'Enfant'];
    }
    if (uniqueSubs.length <= 1) return [];
    const preferredOrder = GOSPORT_SUBCAT_ORDER[goSportSelectedCat] || [];
    uniqueSubs.sort((a, b) => {
      const idxA = preferredOrder.indexOf(a);
      const idxB = preferredOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b, 'fr');
    });
    return uniqueSubs;
  }, [goSportOffres, goSportSelectedCat]);

  const filteredGoSportOffres = useMemo(() => {
    const q = goSportSearch.trim().toLowerCase();
    return goSportOffres.filter((o) => {
      const family = getGoSportCategoryFamily(o.categorie);
      if (goSportSelectedCat !== 'Toutes' && family !== goSportSelectedCat) return false;
      if (
        goSportSelectedCat !== 'Toutes' &&
        goSportSelectedSubCat &&
        goSportSubCategories.length > 1
      ) {
        if (getGoSportSubCategory(o, family) !== goSportSelectedSubCat) return false;
      }
      if (!q) return true;
      const hay = `${o.nomProduit} ${o.reference || ''} ${o.referenceFabricantClean || ''} ${o.categorie} ${o.description} ${o.taillesDispo}`.toLowerCase();
      return hay.includes(q);
    });
  }, [
    goSportOffres,
    goSportSearch,
    goSportSelectedCat,
    goSportSelectedSubCat,
    goSportSubCategories,
  ]);

  const filteredAnnonces = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return annonces.filter((a) => {
      if (!showSold && a.statut.toLowerCase() === 'vendu') return false;
      if (showHeartedOnly && !favoriteIds.includes(a.id)) return false;
      if (selectedCategorie !== 'Toutes' && a.categorie !== selectedCategorie) return false;
      if (!q) return true;
      const hay = `${a.titre} ${a.categorie} ${a.taillePointure} ${a.etat} ${a.contactNom}`.toLowerCase();
      return hay.includes(q);
    });
  }, [annonces, searchQuery, selectedCategorie, showSold, showHeartedOnly, favoriteIds]);

  const activeCount = useMemo(
    () => annonces.filter((a) => a.statut.toLowerCase() !== 'vendu').length,
    [annonces]
  );

  const heartedCount = useMemo(
    () => annonces.filter((a) => favoriteIds.includes(a.id)).length,
    [annonces, favoriteIds]
  );

  const isMyAnnonce = useCallback(
    (a: TrocAnnonce): boolean => {
      if (myAnnonceIds.includes(a.id)) return true;
      const storedEmail = (sellerProfile.email || '').trim().toLowerCase();
      const storedTel = normalizePhoneCompare(sellerProfile.tel);
      if (storedEmail && a.contactEmail && a.contactEmail.trim().toLowerCase() === storedEmail) {
        return true;
      }
      if (storedTel.length >= 8 && normalizePhoneCompare(a.contactTel) === storedTel) {
        return true;
      }
      return false;
    },
    [myAnnonceIds, sellerProfile]
  );

  const myAnnonces = useMemo(
    () => annonces.filter((a) => isMyAnnonce(a)),
    [annonces, isMyAnnonce]
  );

  // ==================== RENDU CARTE PETITE ANNONCE ====================
  const renderAnnonceCard = (annonce: TrocAnnonce, options?: { allowOwnerActions?: boolean }) => {
    const isSold = annonce.statut.toLowerCase() === 'vendu';
    const cardPhotoEntries = [
      annonce.photoUrl && !brokenPhotos[`${annonce.id}:1`]
        ? { slotKey: `${annonce.id}:1`, url: annonce.photoUrl }
        : null,
      annonce.photoUrl2 && !brokenPhotos[`${annonce.id}:2`]
        ? { slotKey: `${annonce.id}:2`, url: annonce.photoUrl2 }
        : null,
      annonce.photoUrl3 && !brokenPhotos[`${annonce.id}:3`]
        ? { slotKey: `${annonce.id}:3`, url: annonce.photoUrl3 }
        : null,
    ].filter((entry): entry is { slotKey: string; url: string } => Boolean(entry));
    const mainPhotoEntry = cardPhotoEntries[0] || null;
    const isUpdating = updatingId === annonce.id;
    const isFavorite = favoriteIds.includes(annonce.id);
    const canDelete =
      userRole === 'admin' ||
      userRole === 'bureau' ||
      options?.allowOwnerActions ||
      isMyAnnonce(annonce);
    const isConfirmingDelete = confirmDeleteId === annonce.id;

    return (
      <article
        key={annonce.id}
        className={`bg-[#141820] border rounded-3xl p-3.5 sm:p-4 shadow-xl flex flex-col justify-between gap-3 transition ${
          isSold ? 'border-zinc-800/80 opacity-80' : 'border-[#252b37] hover:border-orange-500/40'
        }`}
      >
        <div className="flex items-start gap-3.5">
          {/* Vignette agrandie pour smartphone + compteur multi-photos */}
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 shrink-0 rounded-2xl bg-[#0b0e14] border border-zinc-800 overflow-hidden">
            {mainPhotoEntry ? (
              <button
                type="button"
                onClick={() =>
                  setLightboxPhoto({
                    photos: cardPhotoEntries.map((p) => p.url),
                    index: 0,
                    titre: annonce.titre,
                  })
                }
                className="w-full h-full block cursor-zoom-in"
                title={
                  cardPhotoEntries.length > 1
                    ? `Voir les ${cardPhotoEntries.length} photos`
                    : 'Agrandir la photo'
                }
              >
                <img
                  src={mainPhotoEntry.url}
                  alt={annonce.titre}
                  referrerPolicy="no-referrer"
                  onError={() =>
                    setBrokenPhotos((prev) => ({ ...prev, [mainPhotoEntry.slotKey]: true }))
                  }
                  className="w-full h-full object-cover object-center"
                />
              </button>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-zinc-600">
                <Tag className="w-7 h-7 opacity-40" />
                <span className="text-[10px] font-semibold">Sans photo</span>
              </div>
            )}

            {cardPhotoEntries.length > 1 && !isSold && (
              <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-black/80 border border-white/15 text-white text-[9px] font-black inline-flex items-center gap-0.5 pointer-events-none">
                <Camera className="w-2.5 h-2.5 text-[#FF6D00]" />
                <span>{cardPhotoEntries.length}</span>
              </span>
            )}

            {isSold && (
              <div className="absolute inset-0 bg-black/65 flex items-center justify-center pointer-events-none">
                <span className="px-2 py-0.5 rounded-lg bg-zinc-900/95 border border-zinc-600 text-zinc-200 font-heading font-black text-[10px] uppercase tracking-wider">
                  Vendu
                </span>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-bold text-[#FF6D00] uppercase tracking-wide truncate">
                {annonce.categorie} · {annonce.etat}
              </p>
              <button
                type="button"
                onClick={() => toggleFavorite(annonce.id)}
                aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                className={`w-8 h-8 -mt-1 -mr-1 rounded-xl border flex items-center justify-center transition cursor-pointer shrink-0 ${
                  isFavorite
                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-500'
                    : 'bg-[#0b0e14] border-zinc-800 text-zinc-400 hover:text-rose-400'
                }`}
              >
                <Heart className={`w-4 h-4 transition-transform ${isFavorite ? 'fill-rose-500 text-rose-500 scale-110' : ''}`} />
              </button>
            </div>

            <h3 className="font-heading font-black text-white text-base sm:text-lg leading-snug line-clamp-2">
              {annonce.titre}
            </h3>

            <div className="flex flex-wrap items-baseline justify-between gap-2 pt-0.5">
              <span className="font-heading font-black text-[#FF6D00] text-xl sm:text-2xl tabular-nums">
                {annonce.prix === 0 ? 'Gratuit / Don' : `${annonce.prix} €`}
              </span>
              <span className="text-xs text-zinc-300 truncate">
                <strong className="text-white">{annonce.taillePointure}</strong>
              </span>
            </div>

            <p className="text-[11px] text-zinc-400 truncate">
              {annonce.datePublication} · <span className="text-zinc-200 font-semibold">{annonce.contactNom}</span>
            </p>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-end">

          <div className="space-y-2 pt-3 border-t border-zinc-800/80">
            {!isSold && !options?.allowOwnerActions && (
              <div className="grid grid-cols-2 gap-2">
                {annonce.contactTel && (
                  <a
                    href={`tel:${annonce.contactTel.replace(/\s+/g, '')}`}
                    className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition whitespace-nowrap"
                  >
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span>Appeler</span>
                  </a>
                )}
                {annonce.contactTel && (
                  <a
                    href={`sms:${annonce.contactTel.replace(/\s+/g, '')}`}
                    className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 text-xs font-bold transition whitespace-nowrap"
                  >
                    <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                    <span>SMS</span>
                  </a>
                )}
                {annonce.contactEmail && (
                  <a
                    href={`mailto:${annonce.contactEmail}?subject=${encodeURIComponent(`[TCM ProShop] ${annonce.titre}`)}`}
                    className="col-span-2 min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-300 text-xs font-bold transition whitespace-nowrap"
                  >
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{annonce.contactEmail}</span>
                  </a>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleChangeStatut(annonce, isSold ? 'Disponible' : 'Vendu')}
                className="min-h-[44px] flex-1 px-3 py-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
              >
                {isUpdating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isSold ? (
                  <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>{isSold ? 'Remettre en vente' : 'Marquer vendu'}</span>
              </button>

              {canDelete && !isConfirmingDelete && (
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => setConfirmDeleteId(annonce.id)}
                  title="Supprimer l'annonce"
                  aria-label="Supprimer l'annonce"
                  className="min-w-[44px] min-h-[44px] px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 flex items-center justify-center gap-1.5 text-xs font-bold transition cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                  {options?.allowOwnerActions && <span className="hidden sm:inline">Supprimer</span>}
                </button>
              )}

              {canDelete && isConfirmingDelete && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => handleChangeStatut(annonce, 'Supprimé')}
                    className="min-h-[44px] px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition cursor-pointer whitespace-nowrap"
                  >
                    Confirmer
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    className="min-h-[44px] px-2.5 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold transition cursor-pointer"
                  >
                    Annuler
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* ==================== MENU HUB PROSHOP (4 BANDEAUX COMPACTS SUR 1 ÉCRAN SMARTPHONE) ==================== */}
      {subTab === 'menu' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <h1 className="font-heading font-black text-white text-xl sm:text-2xl tracking-tight">
              ProShop
            </h1>
            {(userRole === 'admin' || userRole === 'bureau') && onRefreshPartenaires && (
              <button
                type="button"
                onClick={() => setIsPartenairesModalOpen(true)}
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#141820] hover:bg-zinc-800 border border-[#252b37] text-zinc-300 text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ImageIcon className="w-3.5 h-3.5 text-[#FF6D00]" />
                <span>Logos GSheet</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3.5">
            {/* BANDEAU 1 : BOUTIQUE OFFICIELLE DU CLUB */}
            <button
              type="button"
              onClick={openOfficialShop}
              className="group text-left rounded-2xl border border-orange-500/45 bg-gradient-to-r from-[#BF360C]/90 via-[#8C2609] to-[#141820] px-4 py-3 sm:p-5 shadow-lg hover:border-[#FF6D00] transition cursor-pointer flex items-center justify-between gap-3 min-h-[76px] sm:min-h-[110px]"
            >
              <div className="min-w-0">
                <h2 className="font-heading font-black text-white text-base sm:text-xl leading-tight">
                  Boutique officielle du Club
                </h2>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="bg-white rounded-xl px-2 py-1.5 flex items-center gap-2 shadow-sm">
                  <img
                    src={goSportLogoUrl}
                    alt="GO Sport Muzillac"
                    className="h-7 sm:h-9 w-auto max-w-[54px] object-contain"
                  />
                  <span className="h-5 w-px bg-zinc-200" aria-hidden="true" />
                  <img
                    src={mizunoLogoUrl}
                    alt="Mizuno"
                    className="h-6 sm:h-8 w-auto max-w-[68px] object-contain"
                  />
                </div>
                <ChevronRight className="w-4 h-4 text-orange-200 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>

            {/* BANDEAU 2 : OFFRE GO SPORT MUZILLAC */}
            <button
              type="button"
              onClick={() => setSubTab('gosport')}
              className="group text-left rounded-2xl border border-[#252b37] bg-[#141820] hover:border-orange-500/60 hover:bg-[#181d27] px-4 py-3 sm:p-5 shadow-lg transition cursor-pointer flex items-center justify-between gap-3 min-h-[76px] sm:min-h-[110px]"
            >
              <div className="min-w-0">
                <h2 className="font-heading font-black text-white text-base sm:text-xl leading-tight">
                  Offre GO Sport MUZILLAC
                </h2>
                <span className="text-[11px] font-mono font-bold text-[#FF6D00] tabular-nums">
                  {isGoSportLoading ? '...' : `${goSportOffres.length} produits`}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="bg-white rounded-xl px-2 py-1.5 flex items-center gap-2 shadow-sm">
                  <img
                    src={goSportLogoUrl}
                    alt="GO Sport Muzillac"
                    className="h-7 sm:h-9 w-auto max-w-[54px] object-contain"
                  />
                  <span className="h-5 w-px bg-zinc-200" aria-hidden="true" />
                  <img
                    src={wilsonLogoUrl}
                    alt="Wilson"
                    className="h-7 sm:h-9 w-auto max-w-[44px] object-contain rounded"
                  />
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-[#FF6D00] group-hover:translate-x-0.5 transition" />
              </div>
            </button>

            {/* BANDEAU 3 : PETITES ANNONCES */}
            <button
              type="button"
              onClick={() => setSubTab('annonces')}
              className="group text-left rounded-2xl border border-[#252b37] bg-[#141820] hover:border-orange-500/60 hover:bg-[#181d27] px-4 py-3 sm:p-5 shadow-lg transition cursor-pointer flex items-center justify-between gap-3 min-h-[72px] sm:min-h-[104px]"
            >
              <h2 className="font-heading font-black text-white text-base sm:text-xl leading-tight">
                Petites Annonces
              </h2>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-mono font-black text-emerald-400 tabular-nums">
                  {isLoading ? '...' : `${activeCount} dispo`}
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-[#FF6D00] group-hover:translate-x-0.5 transition" />
              </div>
            </button>

            {/* BANDEAU 4 : MES ANNONCES */}
            <button
              type="button"
              onClick={() => setSubTab('mes_annonces')}
              className="group text-left rounded-2xl border border-[#252b37] bg-[#141820] hover:border-orange-500/60 hover:bg-[#181d27] px-4 py-3 sm:p-5 shadow-lg transition cursor-pointer flex items-center justify-between gap-3 min-h-[72px] sm:min-h-[104px]"
            >
              <h2 className="font-heading font-black text-white text-base sm:text-xl leading-tight">
                Mes Annonces
              </h2>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-mono font-black text-zinc-300 tabular-nums">
                  {myAnnonces.length}
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-[#FF6D00] group-hover:translate-x-0.5 transition" />
              </div>
            </button>
          </div>
        </div>
      ) : null}

      {/* ==================== ONGLET 1 : OFFRES GO SPORT MUZILLAC ==================== */}
      {subTab === 'gosport' && (
        <div className="space-y-4 animate-fadeIn">
          {/* En-tête unique : Retour + Logos + Admin + Recherche & Catégories */}
          <div className="bg-[#141820] border border-[#252b37] rounded-3xl p-3.5 sm:p-5 shadow-xl space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={() => setSubTab('menu')}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#BF360C] to-[#E65100] hover:brightness-110 text-white text-xs sm:text-sm font-black inline-flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-orange-950/40 whitespace-nowrap"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
                <span>ProShop</span>
              </button>

              <div className="flex items-center gap-2.5">
                <div className="inline-flex items-center gap-2.5 bg-white rounded-xl px-3 py-1.5 shadow-sm">
                  <img
                    src={goSportLogoUrl}
                    alt="GO Sport Muzillac"
                    className="h-7 sm:h-9 w-auto object-contain"
                  />
                  <span className="h-5 w-px bg-zinc-200" aria-hidden="true" />
                  <img
                    src={wilsonLogoUrl}
                    alt="Wilson"
                    className="h-7 sm:h-9 w-auto object-contain rounded"
                  />
                </div>

                {userRole === 'admin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setGoSportModalView('list');
                      setIsGoSportModalOpen(true);
                    }}
                    aria-label="Gérer les offres GO Sport"
                    title="Gérer les offres GO Sport"
                    className="min-h-[42px] px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                  >
                    <Settings2 className="w-4 h-4 shrink-0" />
                    <span className="hidden sm:inline">Gérer</span>
                  </button>
                )}
              </div>
            </div>

            {/* Recherche + filtres catégorie */}
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                inputMode="search"
                value={goSportSearch}
                onChange={(e) => setGoSportSearch(e.target.value)}
                placeholder="Rechercher un produit, une référence, une taille, une catégorie..."
                className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl bg-[#0b0e14] border border-zinc-700/80 text-white placeholder-zinc-500 text-base sm:text-xs focus:border-[#FF6D00] focus:outline-none transition"
              />
            </div>

            {goSportCategories.length > 1 && (
              <div className="space-y-2">
                <div className={`grid ${getCategoryGridClass(goSportCategories.length)} gap-1.5 sm:gap-2 w-full`}>
                  {goSportCategories.map((cat) => {
                    const isSelected = goSportSelectedCat === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setGoSportSelectedCat(cat);
                          setGoSportSelectedSubCat('');
                        }}
                        aria-pressed={isSelected}
                        aria-label={cat}
                        title={cat}
                        className={`min-h-[44px] px-1.5 lg:px-2.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 min-w-0 ${
                          isSelected
                            ? 'bg-[#E65100] text-white shadow-md shadow-orange-950/40'
                            : 'bg-[#0b0e14] border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700'
                        }`}
                      >
                        {renderAnnonceCategoryIcon(cat)}
                        <span className="hidden lg:inline truncate">
                          {SHORT_CATEGORY_LABELS[cat] || cat}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {goSportSubCategories.length > 1 && (
                  <div
                    className={`pt-2 border-t border-zinc-800/80 grid ${getSubCategorySingleRowGridClass(
                      goSportSubCategories.length
                    )} gap-1.5 w-full`}
                  >
                    {goSportSubCategories.map((subCat) => {
                      const isSubSelected = goSportSelectedSubCat === subCat;
                      return (
                        <button
                          key={subCat}
                          type="button"
                          onClick={() =>
                            setGoSportSelectedSubCat((prev) => (prev === subCat ? '' : subCat))
                          }
                          aria-pressed={isSubSelected}
                          className={`min-h-[38px] px-2 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center whitespace-nowrap truncate min-w-0 ${
                            isSubSelected
                              ? 'bg-orange-500/20 border border-[#FF6D00] text-orange-200 shadow-sm'
                              : 'bg-[#0b0e14] border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700'
                          }`}
                        >
                          <span className="truncate">{subCat}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {goSportSuccessMsg && (
            <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-2xl p-4 text-emerald-200 text-xs sm:text-sm flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{goSportSuccessMsg}</span>
            </div>
          )}

          {goSportError && (
            <div className="bg-rose-500/15 border border-rose-500/40 rounded-3xl p-4 sm:p-5 text-rose-200 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1 space-y-1">
                  <h3 className="font-heading font-black text-white text-sm sm:text-base">
                    Synchronisation « Partenaire_GOSport » requise
                  </h3>
                  <p className="text-xs sm:text-sm text-rose-200/90 leading-relaxed">{goSportError}</p>
                  {goSportScriptNeeded && (
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      Déployez le Google Apps Script mis à jour pour activer la lecture et l'édition de « Partenaire_GOSport ».
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadGoSportLive()}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-500/25 hover:bg-rose-500/35 border border-rose-500/40 text-white text-xs font-bold transition cursor-pointer flex items-center gap-2 whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Réessayer</span>
                </button>
                {userRole === 'admin' && onOpenScriptModal && (
                  <button
                    type="button"
                    onClick={onOpenScriptModal}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-bold transition cursor-pointer flex items-center gap-2 whitespace-nowrap"
                  >
                    <FileCode2 className="w-3.5 h-3.5" />
                    <span>Voir Code.gs à redéployer</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {isGoSportLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="bg-[#141820] border border-[#252b37] rounded-3xl p-4 space-y-3 animate-pulse"
                >
                  <div className="h-48 bg-[#0b0e14] rounded-2xl" />
                  <div className="h-4 w-3/4 bg-zinc-800 rounded" />
                  <div className="h-3 w-1/2 bg-zinc-800/70 rounded" />
                  <div className="h-12 bg-zinc-800/50 rounded-xl" />
                </div>
              ))}
            </div>
          ) : filteredGoSportOffres.length === 0 ? (
            <div className="bg-[#141820] border border-[#252b37] rounded-3xl p-8 sm:p-10 text-center space-y-3">
              <div className="w-14 h-14 rounded-3xl bg-[#0b0e14] border border-zinc-800 mx-auto flex items-center justify-center text-zinc-500">
                <ShoppingBag className="w-7 h-7" />
              </div>
              <h3 className="font-heading font-black text-white text-base sm:text-lg">
                {goSportOffres.length === 0
                  ? 'Aucune offre GO Sport disponible pour le moment'
                  : 'Aucun produit ne correspond à votre recherche'}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
                {goSportOffres.length === 0
                  ? "Les produits partenaires ajoutés dans l'onglet « Partenaire_GOSport » apparaîtront ici avec le Tarif Adhérent Club."
                  : 'Modifiez votre recherche ou sélectionnez une autre catégorie.'}
              </p>
              {userRole === 'admin' && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={openGoSportCreate}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white text-xs font-black inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Ajouter un produit GO Sport</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredGoSportOffres.map((offre) => {
                const photo1Broken = !offre.photoUrl || goSportBrokenPhotos[`${offre.id}:1`];
                const photo2Broken = !offre.photoUrl2 || goSportBrokenPhotos[`${offre.id}:2`];
                const cardThumbUrl = !photo1Broken
                  ? offre.photoUrl
                  : !photo2Broken
                    ? offre.photoUrl2
                    : undefined;
                const cardThumbKey = !photo1Broken ? `${offre.id}:1` : `${offre.id}:2`;
                const validPhotoCount = (photo1Broken ? 0 : 1) + (photo2Broken ? 0 : 1);
                const hasPromo = offre.prixPromo !== null && offre.prixPromo !== undefined;
                const hasAdherent = offre.tarifAdherent !== null && offre.tarifAdherent !== undefined;
                const parsedSizes = parseGoSportTaillesDispo(offre.taillesDispo);
                const availableSizes = parsedSizes.filter((s) => s.qty > 0);
                const isAllOutOfStock = parsedSizes.length > 0 && availableSizes.length === 0;
                const storedSelection = selectedSizesByOffre[offre.id];
                const validSelectedSize =
                  storedSelection && availableSizes.some((s) => s.name === storedSelection)
                    ? storedSelection
                    : availableSizes.length === 1
                      ? availableSizes[0].name
                      : null;
                const effectiveTailleForWhatsApp =
                  validSelectedSize || (parsedSizes.length === 0 ? 'Unique' : null);
                const clubPriceForMessage =
                  offre.tarifAdherent ?? offre.prixPromo ?? offre.tarifMagasin;
                const whatsappMessage = effectiveTailleForWhatsApp
                  ? `Bonjour, je suis adhérent du Muzillac Tennis Club (TCM). Serait-il possible de me mettre de côté l'article suivant en magasin : ${offre.nomProduit} - Taille : ${effectiveTailleForWhatsApp} (Tarif Club : ${clubPriceForMessage} €) ? Merci !`
                  : '';
                const whatsappHref = effectiveTailleForWhatsApp
                  ? `https://wa.me/${GOSPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`
                  : '';
                const showSelectSizeHint = !!sizeHintByOffre[offre.id] && !validSelectedSize;

                return (
                  <article
                    key={offre.id}
                    className="bg-[#141820] border border-[#252b37] hover:border-orange-500/40 rounded-3xl p-3.5 sm:p-4 shadow-xl flex flex-col justify-between gap-3 transition"
                  >
                    {/* En-tête produit : grande vignette + infos & prix agrandis (clic ouvre la fiche) */}
                    <button
                      type="button"
                      onClick={() => setDetailGoSportOffreId(offre.id)}
                      className="w-full flex items-start gap-3.5 text-left group/card cursor-pointer"
                    >
                      <div className="relative w-24 h-24 sm:w-28 sm:h-28 shrink-0 rounded-2xl bg-[#0b0e14] border border-zinc-800 overflow-hidden">
                        {cardThumbUrl ? (
                          <img
                            src={cardThumbUrl}
                            alt={offre.nomProduit}
                            referrerPolicy="no-referrer"
                            onError={() =>
                              setGoSportBrokenPhotos((prev) => ({ ...prev, [cardThumbKey]: true }))
                            }
                            className="w-full h-full object-cover object-center group-hover/card:scale-105 transition-transform duration-200"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-zinc-600">
                            <ShoppingBag className="w-7 h-7 opacity-40" />
                            <span className="text-[10px] font-semibold">Visuel</span>
                          </div>
                        )}
                        {validPhotoCount > 1 && (
                          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-black/80 border border-white/15 text-white text-[9px] font-black inline-flex items-center gap-0.5 pointer-events-none">
                            <Camera className="w-2.5 h-2.5 text-[#FF6D00]" />
                            <span>{validPhotoCount}</span>
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-bold text-[#FF6D00] uppercase tracking-wide">
                            {offre.categorie}
                          </span>
                          {offre.excluClub && (
                            <span className="px-1.5 py-0.5 rounded-md bg-gradient-to-r from-amber-300 to-amber-500 text-zinc-950 font-heading font-black text-[9px] uppercase tracking-wider inline-flex items-center gap-0.5">
                              <Award className="w-2.5 h-2.5 shrink-0" />
                              <span>Exclu Club</span>
                            </span>
                          )}
                          {isGoSportUnitaire(offre.reference, offre.nomProduit) && (
                            <span className="px-1.5 py-0.5 rounded-md bg-sky-500/15 border border-sky-400/40 text-sky-300 text-[9px] font-black uppercase tracking-wide">
                              À l'unité
                            </span>
                          )}
                        </div>

                        <h3 className="font-heading font-black text-white text-base sm:text-lg leading-snug line-clamp-2 group-hover/card:text-orange-300 transition">
                          {offre.nomProduit}
                        </h3>

                        <div className="flex items-baseline gap-2.5 flex-wrap pt-0.5">
                          <span className="font-heading font-black text-xl sm:text-2xl text-[#FF6D00] tabular-nums">
                            {formatPriceEur(clubPriceForMessage)}
                          </span>
                          {(hasAdherent || hasPromo) && (
                            <span className="text-xs sm:text-sm line-through text-zinc-500 font-mono tabular-nums">
                              {formatPriceEur(offre.tarifMagasin)}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Tailles compactes & mise de côté WhatsApp */}
                    <div className="space-y-2.5 pt-2.5 border-t border-zinc-800/80">
                      {parsedSizes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {parsedSizes.map((item, idx) => {
                            const isSelected = validSelectedSize === item.name;
                            if (item.qty === 0) {
                              return (
                                <span
                                  key={`${offre.id}-taille-${idx}`}
                                  aria-disabled="true"
                                  className="min-h-[32px] px-2 py-1 rounded-xl bg-zinc-900/90 border border-zinc-800 text-zinc-500 text-[11px] font-semibold line-through cursor-not-allowed inline-flex items-center"
                                >
                                  {item.name} (Épuisé)
                                </span>
                              );
                            }

                            const isLastOne = item.qty === 1;
                            const labelQty = item.hasExplicitQty
                              ? isLastOne
                                ? 'Dernier !'
                                : `${item.qty}`
                              : 'Dispo';

                            return (
                              <button
                                key={`${offre.id}-taille-${idx}`}
                                type="button"
                                aria-pressed={isSelected}
                                onClick={() => {
                                  setSelectedSizesByOffre((prev) => ({
                                    ...prev,
                                    [offre.id]:
                                      prev[offre.id] === item.name && availableSizes.length > 1
                                        ? ''
                                        : item.name,
                                  }));
                                  setSizeHintByOffre((prev) => ({ ...prev, [offre.id]: false }));
                                }}
                                className={`min-h-[34px] px-2.5 py-1 rounded-xl border text-[11px] font-bold transition active:scale-95 cursor-pointer inline-flex items-center gap-1 tabular-nums select-none ${
                                  isLastOne
                                    ? isSelected
                                      ? 'bg-orange-500 border-white text-zinc-950 font-black ring-2 ring-orange-300'
                                      : 'bg-orange-500/15 hover:bg-orange-500/25 border-orange-500/50 text-orange-300'
                                    : isSelected
                                      ? 'bg-emerald-500 border-white text-zinc-950 font-black ring-2 ring-emerald-300'
                                      : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/45 text-emerald-300'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 shrink-0 stroke-[3]" />}
                                <span>
                                  {item.name} ({labelQty})
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {showSelectSizeHint && (
                        <p className="text-[11px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-2.5 py-1.5">
                          Sélectionnez d'abord une taille ci-dessus.
                        </p>
                      )}

                      <div className="flex items-center gap-2">
                        {isAllOutOfStock ? (
                          <div className="min-h-[40px] flex-1 px-3 py-2 rounded-xl bg-zinc-800/80 border border-zinc-700 text-zinc-400 text-xs font-bold flex items-center justify-center text-center">
                            Temporairement en rupture
                          </div>
                        ) : effectiveTailleForWhatsApp ? (
                          <button
                            type="button"
                            onClick={() => {
                              const matchedIdx = validSelectedSize
                                ? parsedSizes.findIndex((s) => s.name === validSelectedSize && s.qty > 0)
                                : -1;
                              const matchedItem = matchedIdx >= 0 ? parsedSizes[matchedIdx] : null;
                              setWhatsappConfirmData({
                                offre,
                                tailleName: effectiveTailleForWhatsApp,
                                sizeIndex: matchedIdx,
                                hasExplicitQty: !!matchedItem?.hasExplicitQty,
                                currentQty: matchedItem ? matchedItem.qty : 0,
                                clubPrice: clubPriceForMessage,
                                whatsappHref,
                              });
                            }}
                            className="min-h-[40px] flex-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md shadow-emerald-950/50 text-center"
                          >
                            <MessageCircle className="w-4 h-4 shrink-0" />
                            <span>Mettre de côté</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setSizeHintByOffre((prev) => ({ ...prev, [offre.id]: true }))
                            }
                            className="min-h-[40px] flex-1 px-3 py-2 rounded-xl bg-emerald-600/85 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md shadow-emerald-950/50 text-center"
                          >
                            <MessageCircle className="w-4 h-4 shrink-0" />
                            <span>Mettre de côté</span>
                          </button>
                        )}

                        {userRole === 'admin' && (
                          <button
                            type="button"
                            onClick={() => openGoSportEdit(offre)}
                            aria-label="Modifier l'offre"
                            title="Modifier tarifs / stock"
                            className="min-w-[40px] min-h-[40px] px-2.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-amber-300 flex items-center justify-center transition cursor-pointer shrink-0"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================== ONGLET 2 : PETITES ANNONCES (Troc_Annonces) ==================== */}
      {subTab === 'annonces' && (
        <div className="space-y-4 animate-fadeIn">
          {/* En-tête simplifié : Retour + Titre + Déposer une annonce */}
          <div className="bg-[#141820] border border-[#252b37] rounded-3xl p-3.5 sm:p-5 shadow-xl space-y-3.5">
            <div className="flex items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={() => setSubTab('menu')}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-xs sm:text-sm font-black inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
                <span>ProShop</span>
              </button>
              <div className="min-w-0 flex items-baseline gap-2">
                <h2 className="font-heading font-black text-white text-base sm:text-xl tracking-tight truncate">
                  Petites Annonces
                </h2>
                <span className="text-xs font-mono font-bold text-emerald-400 tabular-nums shrink-0">
                  {activeCount}
                </span>
              </div>
            </div>

            {/* 2 boutons pleine largeur sur tous les écrans, au-dessus de Rechercher */}
            <div className="grid grid-cols-2 gap-2 w-full">
              <button
                type="button"
                onClick={() => setShowSold((v) => !v)}
                className={`w-full min-h-[44px] px-3 py-2 rounded-xl border text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 ${
                  showSold
                    ? 'bg-orange-500/15 border-orange-500/40 text-orange-300'
                    : 'bg-[#0b0e14] border-zinc-800 text-zinc-300 hover:text-white'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{showSold ? 'Masquer vendus' : 'Afficher vendus'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsFormOpen(true)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-gradient-to-r from-[#BF360C] to-[#E65100] hover:brightness-110 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg shadow-orange-950/50 whitespace-nowrap"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Déposer</span>
              </button>
            </div>

            {/* Barre de recherche et filtre favoris */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  inputMode="search"
                  enterKeyHint="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher une raquette, pointure, taille..."
                  className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl bg-[#0b0e14] border border-zinc-700/80 text-white placeholder-zinc-500 text-base sm:text-xs focus:border-[#FF6D00] focus:outline-none transition"
                />
              </div>

              {heartedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHeartedOnly((v) => !v)}
                  aria-pressed={showHeartedOnly}
                  aria-label="Filtrer les annonces aimées"
                  title="Afficher uniquement les annonces avec un cœur"
                  className={`min-h-[44px] px-3 py-2.5 rounded-xl border text-xs font-bold transition cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 shrink-0 ${
                    showHeartedOnly
                      ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                      : 'bg-[#0b0e14] border-zinc-800 text-zinc-400 hover:text-rose-400'
                  }`}
                >
                  <Heart
                    className={`w-4 h-4 shrink-0 ${
                      showHeartedOnly ? 'fill-rose-500 text-rose-500' : 'text-rose-400'
                    }`}
                  />
                  <span className="font-mono tabular-nums">{heartedCount}</span>
                </button>
              )}
            </div>

            {/* Raccourcis catégories en icônes sur 1 seule ligne (sans ascenseur horizontal) */}
            <div className="grid grid-cols-6 gap-1.5 sm:gap-2 w-full">
              {['Toutes', ...CATEGORIES].map((cat) => {
                const isSelected = selectedCategorie === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategorie(cat)}
                    aria-pressed={isSelected}
                    aria-label={cat}
                    title={cat}
                    className={`min-h-[44px] px-1.5 lg:px-2.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#E65100] text-white shadow-md shadow-orange-950/40'
                        : 'bg-[#0b0e14] border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700'
                    }`}
                  >
                    {renderAnnonceCategoryIcon(cat)}
                    <span className="hidden lg:inline truncate">
                      {SHORT_CATEGORY_LABELS[cat] || cat}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {formSuccessMsg && (
            <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-2xl p-4 text-emerald-200 text-xs sm:text-sm flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{formSuccessMsg}</span>
            </div>
          )}

          {loadError && (
            <div className="bg-rose-500/15 border border-rose-500/40 rounded-3xl p-4 sm:p-5 text-rose-200 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1 space-y-1">
                  <h3 className="font-heading font-black text-white text-sm sm:text-base">
                    Synchronisation « Troc_Annonces » requise
                  </h3>
                  <p className="text-xs sm:text-sm text-rose-200/90 leading-relaxed">{loadError}</p>
                  {scriptUpdateNeeded && (
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      L'onglet « Troc_Annonces » nécessite la dernière version du script Google Apps Script (Code.gs) déployée sur votre Google Sheet.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadAnnoncesLive()}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-500/25 hover:bg-rose-500/35 border border-rose-500/40 text-white text-xs font-bold transition cursor-pointer flex items-center gap-2 whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Réessayer</span>
                </button>
                {userRole === 'admin' && onOpenScriptModal && (
                  <button
                    type="button"
                    onClick={onOpenScriptModal}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-bold transition cursor-pointer flex items-center gap-2 whitespace-nowrap"
                  >
                    <FileCode2 className="w-3.5 h-3.5" />
                    <span>Voir Code.gs à redéployer</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="bg-[#141820] border border-[#252b37] rounded-3xl p-4 space-y-3 animate-pulse"
                >
                  <div className="h-44 bg-[#0b0e14] rounded-2xl" />
                  <div className="h-4 w-3/4 bg-zinc-800 rounded" />
                  <div className="h-3 w-1/2 bg-zinc-800/70 rounded" />
                  <div className="h-10 bg-zinc-800/50 rounded-xl" />
                </div>
              ))}
            </div>
          ) : filteredAnnonces.length === 0 ? (
            <div className="bg-[#141820] border border-[#252b37] rounded-3xl p-8 sm:p-10 text-center space-y-3">
              <div className="w-14 h-14 rounded-3xl bg-[#0b0e14] border border-zinc-800 mx-auto flex items-center justify-center text-zinc-500">
                <ShoppingBag className="w-7 h-7" />
              </div>
              <h3 className="font-heading font-black text-white text-base sm:text-lg">
                {annonces.length === 0
                  ? 'Aucune annonce publiée pour le moment'
                  : 'Aucune annonce ne correspond à vos filtres'}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
                {annonces.length === 0
                  ? "Soyez le premier à proposer une raquette, paire de chaussures ou tenue de tennis aux membres du club."
                  : "Modifiez votre recherche ou affichez toutes les catégories pour voir les annonces disponibles."}
              </p>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                {annonces.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategorie('Toutes');
                      setShowSold(true);
                    }}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition cursor-pointer whitespace-nowrap"
                  >
                    Réinitialiser les filtres
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsFormOpen(true)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white text-xs font-black transition cursor-pointer flex items-center gap-2 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>Publier une annonce</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAnnonces.map((annonce) => renderAnnonceCard(annonce))}
            </div>
          )}
        </div>
      )}

      {/* ==================== ONGLET 3 : MES ANNONCES ==================== */}
      {subTab === 'mes_annonces' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="bg-[#141820] border border-[#252b37] rounded-3xl p-3.5 sm:p-5 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setSubTab('menu')}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-xs sm:text-sm font-black inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
                >
                  <ArrowLeft className="w-4 h-4 shrink-0" />
                  <span>ProShop</span>
                </button>
                <div className="min-w-0 flex items-baseline gap-2">
                  <h2 className="font-heading font-black text-white text-base sm:text-xl tracking-tight truncate">
                    Mes Annonces
                  </h2>
                  <span className="text-xs font-mono font-bold text-zinc-300 tabular-nums shrink-0">
                    {myAnnonces.length}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsFormOpen(true)}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white text-xs font-black inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Déposer</span>
              </button>
            </div>

            {/* Association optionnelle par email ou téléphone */}
            <form onSubmit={handleSaveLookupProfile} className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-zinc-800/80">
              <input
                type="text"
                value={lookupContact}
                onChange={(e) => setLookupContact(e.target.value)}
                placeholder="Retrouver mes annonces via mon email ou n° de téléphone..."
                className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-[#0b0e14] border border-zinc-700/80 text-white placeholder-zinc-500 text-base sm:text-xs focus:border-[#FF6D00] focus:outline-none"
              />
              <button
                type="submit"
                className="min-h-[44px] px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold cursor-pointer whitespace-nowrap"
              >
                Associer mes coordonnées
              </button>
            </form>
          </div>

          {myAnnonces.length === 0 ? (
            <div className="bg-[#141820] border border-[#252b37] rounded-3xl p-6 sm:p-8 text-center space-y-2">
              <p className="text-sm font-bold text-white">Vous n'avez aucune annonce déposée depuis cet appareil</p>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Déposez une annonce ou saisissez votre téléphone / email ci-dessus pour gérer vos annonces déjà en ligne.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myAnnonces.map((annonce) => renderAnnonceCard(annonce, { allowOwnerActions: true }))}
            </div>
          )}
        </div>
      )}

      {/* ==================== MODALE ADMIN : GÉRER LES OFFRES GO SPORT ==================== */}
      {isGoSportModalOpen && userRole === 'admin' && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#141820] border-t sm:border border-amber-500/40 rounded-t-3xl sm:rounded-3xl p-4 sm:p-6 w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
                  <Settings2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-heading font-black text-white text-base sm:text-lg">
                    Gérer les offres GO Sport Muzillac
                  </h2>
                  <p className="text-[11px] text-zinc-400">
                    Synchronisation directe avec l'onglet « Partenaire_GOSport »
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGoSportModalOpen(false)}
                aria-label="Fermer"
                className="min-w-[44px] min-h-[44px] rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {goSportFormError && (
              <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{goSportFormError}</span>
              </div>
            )}

            {goSportModalView === 'list' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-zinc-400">
                    {goSportOffres.length} {goSportOffres.length > 1 ? 'produits enregistrés' : 'produit enregistré'}
                  </p>
                  <button
                    type="button"
                    onClick={openGoSportCreate}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white text-xs font-black flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Ajouter un produit</span>
                  </button>
                </div>

                {(() => {
                  const externalOffresCount = goSportOffres.filter(
                    (o) => isExternalHttpUrl(o.photoUrl) || isExternalHttpUrl(o.photoUrl2)
                  ).length;
                  if (externalOffresCount === 0 && !isBackingUpExternalPhotos) return null;
                  return (
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-amber-200 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>
                            {externalOffresCount} fiche(s) utilise(nt) encore un lien photo externe
                          </span>
                        </p>
                        <p className="text-[11px] text-amber-200/80">
                          Sauvegardez-les en local dans le Google Sheet pour éviter tout lien cassé si un site marchand change ses URLs.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={isBackingUpExternalPhotos}
                        onClick={() => void handleBackupAllExternalGoSportPhotos()}
                        className="min-h-[40px] px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-60 shrink-0 whitespace-nowrap"
                      >
                        {isBackingUpExternalPhotos ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>
                              {backupExternalProgress
                                ? `${backupExternalProgress.done}/${backupExternalProgress.total}`
                                : 'Sauvegarde...'}
                            </span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Sauvegarder en local</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })()}

                {goSportOffres.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-[#0b0e14] border border-zinc-800 text-center text-xs text-zinc-400">
                    Aucun produit dans « Partenaire_GOSport ». Cliquez sur « Ajouter un produit » pour créer la première offre.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {goSportOffres.map((o) => {
                      const hasExternalLink =
                        isExternalHttpUrl(o.photoUrl) || isExternalHttpUrl(o.photoUrl2);
                      const photoCount = (o.photoUrl ? 1 : 0) + (o.photoUrl2 ? 1 : 0);
                      const needsSecondPhoto =
                        isTechnicalGoSportCategory(o.categorie) && photoCount < 2;

                      return (
                        <div
                          key={o.id}
                          className="p-3.5 rounded-2xl bg-[#0b0e14] border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-white text-sm truncate">{o.nomProduit}</span>
                              {isGoSportUnitaire(o.reference, o.nomProduit) && (
                                <span className="px-2 py-0.5 rounded-md bg-sky-500/15 border border-sky-400/40 text-sky-300 text-[10px] font-black uppercase">
                                  Unité (/U)
                                </span>
                              )}
                              {o.excluClub && (
                                <span className="px-2 py-0.5 rounded-md bg-amber-400 text-zinc-950 text-[10px] font-black uppercase">
                                  Exclu Club
                                </span>
                              )}
                              {photoCount >= 2 ? (
                                <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[10px] font-bold">
                                  2 photos
                                </span>
                              ) : needsSecondPhoto ? (
                                <span className="px-1.5 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px] font-semibold">
                                  {photoCount}/2 photo
                                </span>
                              ) : null}
                              {hasExternalLink && (
                                <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/35 text-amber-300 text-[10px] font-bold">
                                  Lien externe
                                </span>
                              )}
                            </div>
                            {(o.reference || o.referenceFabricantClean) && (
                              <p className="text-[11px] font-mono text-zinc-400">
                                {o.reference ? `Réf. magasin : ${o.reference}` : ''}
                                {o.reference &&
                                o.referenceFabricantClean &&
                                o.referenceFabricantClean !== o.reference
                                  ? ` · Réf. clean : ${o.referenceFabricantClean}`
                                  : !o.reference && o.referenceFabricantClean
                                    ? `Réf. fournisseur : ${o.referenceFabricantClean}`
                                    : ''}
                              </p>
                            )}
                            <p className="text-xs text-zinc-400 tabular-nums">
                              Magasin: {formatPriceEur(o.tarifMagasin)}
                              {o.prixPromo !== null && o.prixPromo !== undefined
                                ? ` · Promo: ${formatPriceEur(o.prixPromo)}`
                                : ''}
                              {o.tarifAdherent !== null && o.tarifAdherent !== undefined
                                ? ` · Adhérent: ${formatPriceEur(o.tarifAdherent)}`
                                : ''}
                            </p>
                            {o.taillesDispo && (
                              <p className="text-[11px] text-emerald-400">
                                Tailles : {o.taillesDispo}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => openGoSportEdit(o)}
                              className="min-h-[44px] px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5 text-amber-300" />
                              <span>Modifier</span>
                            </button>
                            <button
                              type="button"
                              disabled={deletingGoSportId === o.id}
                              onClick={() => handleDeleteGoSport(o.id)}
                              aria-label="Supprimer le produit"
                              className="min-w-[44px] min-h-[44px] px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 flex items-center justify-center cursor-pointer disabled:opacity-50"
                            >
                              {deletingGoSportId === o.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleSaveGoSport} className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading font-black text-white text-sm">
                    {editingGoSportId ? 'Modifier le produit' : 'Nouveau produit GO Sport'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setGoSportModalView('list')}
                    className="text-xs font-bold text-zinc-400 hover:text-white cursor-pointer"
                  >
                    ← Retour à la liste
                  </button>
                </div>

                {/* Références Google Sheet + Recherche automatique (≥ 3 photos à valider + description sommaire) */}
                <div className="p-3.5 rounded-2xl bg-[#0b0e14] border border-orange-500/35 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-orange-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#FF6D00]" />
                      <span>Références produit & recherche photos / description</span>
                    </label>
                    {isGoSportUnitaire(gsReference, gsNomProduit) ? (
                      <span className="px-2 py-0.5 rounded-md bg-sky-500/15 border border-sky-400/40 text-sky-300 text-[10px] font-black uppercase">
                        Déloté (/U) · Vendu à l'unité
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-zinc-400">
                        Col. Référence & Reference_Fabricant_Clean
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                        Référence logiciel magasin
                      </label>
                      <input
                        type="text"
                        value={gsReference}
                        onChange={(e) => {
                          const val = e.target.value;
                          const prevDerived = deriveCleanSupplierRef(gsReference);
                          setGsReference(val);
                          if (!gsReferenceClean.trim() || gsReferenceClean === prevDerived) {
                            setGsReferenceClean(deriveCleanSupplierRef(val));
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleLookupGoSportByReference();
                          }
                        }}
                        placeholder="Ex : WRT13730B/U, 1508397/WRT116400..."
                        className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#141820] border border-zinc-700 text-white placeholder-zinc-500 font-mono text-base sm:text-xs focus:border-[#FF6D00] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                        Référence fournisseur nettoyée
                      </label>
                      <input
                        type="text"
                        value={gsReferenceClean}
                        onChange={(e) => setGsReferenceClean(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleLookupGoSportByReference();
                          }
                        }}
                        onBlur={() => {
                          const trimmed = gsReferenceClean.trim() || gsReference.trim();
                          if (
                            !editingGoSportId &&
                            trimmed.length >= 3 &&
                            trimmed !== gsLastLookedUpRef &&
                            gsLookupPhotos.length === 0 &&
                            !isLookingUpGoSport
                          ) {
                            void handleLookupGoSportByReference({ query: trimmed });
                          }
                        }}
                        placeholder="Ex : WRT13730B, WRT116400..."
                        className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#141820] border border-zinc-700 text-white placeholder-zinc-500 font-mono text-base sm:text-xs focus:border-[#FF6D00] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <p className="text-[11px] text-zinc-400">
                      La recherche interroge prioritairement la référence fournisseur nettoyée
                      {isGoSportUnitaire(gsReference, gsNomProduit)
                        ? ' et précise « vendu à l’unité » (/U).'
                        : '.'}
                    </p>
                    <button
                      type="button"
                      disabled={isLookingUpGoSport}
                      onClick={() => void handleLookupGoSportByReference()}
                      className="min-h-[44px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#BF360C] to-[#E65100] hover:brightness-110 text-white text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    >
                      {isLookingUpGoSport ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                      <span>{isLookingUpGoSport ? 'Recherche...' : 'Chercher photos & infos'}</span>
                    </button>
                  </div>

                  {isLookingUpGoSport && (
                    <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/25 text-xs text-orange-200 flex items-center gap-2.5">
                      <Loader2 className="w-4 h-4 animate-spin text-[#FF6D00] shrink-0" />
                      <span>Recherche du produit, vérification des photos et rédaction de la description sommaire...</span>
                    </div>
                  )}

                  {gsLookupError && (
                    <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/35 text-xs text-rose-200 space-y-2.5">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <span>{gsLookupError}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={isCompressingGsPhoto}
                          onClick={() => triggerGsPhotoUpload('camera', gsActivePhotoSlot)}
                          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 border border-orange-400/45 text-orange-200 text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <Camera className="w-3.5 h-3.5 text-orange-400" />
                          <span>Prendre une photo</span>
                        </button>
                        <button
                          type="button"
                          disabled={isCompressingGsPhoto}
                          onClick={() => triggerGsPhotoUpload('file', gsActivePhotoSlot)}
                          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <Upload className="w-3.5 h-3.5 text-zinc-300" />
                          <span>Importer une photo</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {gsLookupWarning && !gsLookupError && (
                    <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/35 text-xs text-amber-200 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>{gsLookupWarning}</span>
                    </div>
                  )}

                  {gsLookupPhotos.filter((p) => !p.broken).length > 0 && (() => {
                    const isTechCat = isTechnicalGoSportCategory(gsCategorie);
                    const slotLabels = getGoSportPhotoSlotLabels(gsCategorie);
                    const showMultiPicker = isTechCat || gsShowExtraPhotoSlot || Boolean(gsPhotoUrl2);

                    return (
                      <div className="space-y-2.5 pt-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[11px] font-bold text-zinc-200">
                            Photos trouvées ({gsLookupPhotos.filter((p) => !p.broken).length}) — sauvegardées en local au clic :
                          </p>
                          <div className="flex items-center gap-2">
                            {gsPhotoUrl && (
                              <span className="text-[11px] font-bold text-emerald-400 inline-flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" />
                                <span>Photo 1</span>
                              </span>
                            )}
                            {gsPhotoUrl2 && (
                              <span className="text-[11px] font-bold text-sky-400 inline-flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" />
                                <span>Photo 2</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {showMultiPicker && (
                          <div className="flex flex-wrap items-center gap-2 p-2 rounded-xl bg-[#141820] border border-zinc-800">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mr-1">
                              Assigner à :
                            </span>
                            <button
                              type="button"
                              onClick={() => setGsActivePhotoSlot(1)}
                              className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer inline-flex items-center gap-1.5 ${
                                gsActivePhotoSlot === 1
                                  ? 'bg-emerald-500 text-zinc-950 font-black'
                                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                              }`}
                            >
                              <span>1 · {slotLabels.slot1}</span>
                              {gsPhotoUrl && <Check className="w-3 h-3" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => setGsActivePhotoSlot(2)}
                              className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer inline-flex items-center gap-1.5 ${
                                gsActivePhotoSlot === 2
                                  ? 'bg-sky-500 text-zinc-950 font-black'
                                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                              }`}
                            >
                              <span>2 · {slotLabels.slot2}</span>
                              {gsPhotoUrl2 && <Check className="w-3 h-3" />}
                            </button>
                          </div>
                        )}

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {gsLookupPhotos.map((photo, idx) => {
                            if (photo.broken) return null;
                            const isPhoto1 =
                              gsPhotoUrl === photo.url || gsSelectedCandidateUrl === photo.url;
                            const isPhoto2 =
                              gsPhotoUrl2 === photo.url || gsSelectedCandidateUrl2 === photo.url;
                            const isConverting = gsValidatingPhotoUrl === photo.url;
                            const displaySrc = photo.useProxy
                              ? `/api/image-proxy?url=${encodeURIComponent(photo.url)}`
                              : photo.url;

                            return (
                              <button
                                key={`${photo.url}-${idx}`}
                                type="button"
                                onClick={() => void handleSelectAndValidatePhoto(photo)}
                                className={`group relative rounded-xl overflow-hidden border-2 text-left transition cursor-pointer bg-white ${
                                  isPhoto1
                                    ? 'border-emerald-400 ring-2 ring-emerald-400/50 shadow-lg shadow-emerald-950/50'
                                    : isPhoto2
                                      ? 'border-sky-400 ring-2 ring-sky-400/50 shadow-lg shadow-sky-950/50'
                                      : 'border-zinc-700 hover:border-[#FF6D00]'
                                }`}
                              >
                                <div className="aspect-[4/3] w-full bg-white flex items-center justify-center overflow-hidden">
                                  <img
                                    src={displaySrc}
                                    alt={`Proposition ${idx + 1}`}
                                    referrerPolicy="no-referrer"
                                    onError={() => {
                                      setGsLookupPhotos((prev) =>
                                        prev.map((item, i) =>
                                          i === idx
                                            ? item.useProxy
                                              ? { ...item, broken: true }
                                              : { ...item, useProxy: true }
                                            : item
                                        )
                                      );
                                    }}
                                    className="w-full h-full object-contain p-1.5"
                                  />
                                </div>

                                <div className="px-2 py-1 bg-[#141820] border-t border-zinc-800 flex items-center justify-between gap-1">
                                  <span className="text-[10px] text-zinc-400 truncate">
                                    {photo.source}
                                  </span>
                                  {isConverting ? (
                                    <Loader2 className="w-3 h-3 animate-spin text-orange-400 shrink-0" />
                                  ) : isPhoto1 ? (
                                    <span className="text-[10px] font-black text-emerald-400 shrink-0 inline-flex items-center gap-0.5">
                                      <Check className="w-3 h-3" />
                                      Photo 1
                                    </span>
                                  ) : isPhoto2 ? (
                                    <span className="text-[10px] font-black text-sky-400 shrink-0 inline-flex items-center gap-0.5">
                                      <Check className="w-3 h-3" />
                                      Photo 2
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-orange-300 shrink-0">
                                      {showMultiPicker ? `→ Photo ${gsActivePhotoSlot}` : 'Choisir'}
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {gsLookupSuggestedDesc && (
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-emerald-300">
                          Description sommaire proposée
                        </span>
                        {gsDescription.trim() !== gsLookupSuggestedDesc && (
                          <button
                            type="button"
                            onClick={() => setGsDescription(gsLookupSuggestedDesc)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black cursor-pointer"
                          >
                            Utiliser cette description
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-zinc-200 leading-relaxed">
                        {gsLookupSuggestedDesc}
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                      Nom du produit *
                    </label>
                    <input
                      type="text"
                      required
                      value={gsNomProduit}
                      onChange={(e) => setGsNomProduit(e.target.value)}
                      placeholder="Ex : Chaussures Asics Gel Resolution 9"
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#0b0e14] border border-zinc-700 text-white placeholder-zinc-500 text-base sm:text-xs focus:border-[#FF6D00] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                      Catégorie *
                    </label>
                    <input
                      type="text"
                      list="gosport-categories-list"
                      required
                      value={gsCategorie}
                      onChange={(e) => setGsCategorie(e.target.value)}
                      placeholder="Ex : Chaussures"
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#0b0e14] border border-zinc-700 text-white placeholder-zinc-500 text-base sm:text-xs focus:border-[#FF6D00] focus:outline-none"
                    />
                    <datalist id="gosport-categories-list">
                      {GOSPORT_CATEGORIES_SUGGESTIONS.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* Les 3 tarifs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                      Tarif Magasin (€) *
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      required
                      value={gsTarifMagasin}
                      onChange={(e) => setGsTarifMagasin(e.target.value)}
                      placeholder="Ex : 140"
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#0b0e14] border border-zinc-700 text-white font-mono tabular-nums text-base sm:text-xs focus:border-[#FF6D00] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                      Prix Promo (€)
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={gsPrixPromo}
                      onChange={(e) => setGsPrixPromo(e.target.value)}
                      placeholder="Optionnel (ex : 119)"
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#0b0e14] border border-zinc-700 text-white font-mono tabular-nums text-base sm:text-xs focus:border-[#FF6D00] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-orange-300 mb-1">
                      Tarif Adhérent Club (€)
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={gsTarifAdherent}
                      onChange={(e) => setGsTarifAdherent(e.target.value)}
                      placeholder="Ex : 99"
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#0b0e14] border border-orange-500/40 text-white font-mono tabular-nums text-base sm:text-xs focus:border-[#FF6D00] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Exclu Club */}
                <div>
                  <label className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#0b0e14] border border-zinc-700 flex items-center justify-between gap-3 cursor-pointer">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Award className="w-4 h-4" />
                      <span>Badge doré « Exclu Club »</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={gsExcluClub}
                      onChange={(e) => setGsExcluClub(e.target.checked)}
                      className="w-5 h-5 accent-amber-400 cursor-pointer"
                    />
                  </label>
                </div>

                {/* Éditeur de stock interactif par taille */}
                <div className="p-3.5 rounded-2xl bg-[#0b0e14] border border-zinc-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <PackageCheck className="w-3.5 h-3.5" />
                      <span>Stock par taille (Muzillac)</span>
                    </label>
                    <span className="text-[11px] text-zinc-400">
                      0 = Épuisé · 1 = Dernier !
                    </span>
                  </div>

                  {gsStockItems.length > 0 && (
                    <div className="space-y-2">
                      {gsStockItems.map((item) => (
                        <div
                          key={item.key}
                          className="flex items-center gap-2 p-2 rounded-xl bg-[#141820] border border-zinc-800"
                        >
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleUpdateGsStockName(item.key, e.target.value)}
                            placeholder="Taille"
                            className="min-w-0 flex-1 min-h-[40px] px-3 py-1.5 rounded-lg bg-[#0b0e14] border border-zinc-700 text-white text-xs font-bold focus:border-[#FF6D00] focus:outline-none"
                          />

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleUpdateGsStockQty(item.key, -1)}
                              disabled={item.qty <= 0}
                              aria-label={`Diminuer le stock pour ${item.name}`}
                              className="min-w-[40px] min-h-[40px] rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white flex items-center justify-center transition cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>

                            <span
                              className={`min-w-[36px] text-center font-mono font-black text-sm tabular-nums ${
                                item.qty === 0
                                  ? 'text-zinc-500'
                                  : item.qty === 1
                                    ? 'text-orange-400'
                                    : 'text-emerald-400'
                              }`}
                            >
                              {item.qty}
                            </span>

                            <button
                              type="button"
                              onClick={() => handleUpdateGsStockQty(item.key, 1)}
                              aria-label={`Augmenter le stock pour ${item.name}`}
                              className="min-w-[40px] min-h-[40px] rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center transition cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveGsStockRow(item.key)}
                            aria-label={`Supprimer la taille ${item.name}`}
                            className="min-w-[40px] min-h-[40px] rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 flex items-center justify-center transition cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Ajout rapide d'une taille */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={gsNewSizeName}
                      onChange={(e) => setGsNewSizeName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddGsStockRow();
                        }
                      }}
                      placeholder="Ajouter taille (ex : S, 42, Manche 2)"
                      className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-[#141820] border border-zinc-700 text-white placeholder-zinc-500 text-base sm:text-xs focus:border-[#FF6D00] focus:outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={gsNewSizeQty}
                        onChange={(e) => setGsNewSizeQty(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddGsStockRow();
                          }
                        }}
                        aria-label="Quantité initiale"
                        className="w-20 min-h-[44px] px-3 py-2 rounded-xl bg-[#141820] border border-zinc-700 text-white font-mono tabular-nums text-center text-base sm:text-xs focus:border-[#FF6D00] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddGsStockRow}
                        className="min-h-[44px] flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Ajouter</span>
                      </button>
                    </div>
                  </div>

                  {gsStockItems.length > 0 && (
                    <p className="text-[11px] text-zinc-500 truncate">
                      Enregistré dans Google Sheet :{' '}
                      <span className="text-zinc-300 font-mono">
                        {formatGoSportStockItems(gsStockItems)}
                      </span>
                    </p>
                  )}
                </div>

                {/* Photos produit (2 angles pour produits techniques, 1 photo pour balles/accessoires) */}
                {(() => {
                  const isTechCat = isTechnicalGoSportCategory(gsCategorie);
                  const slotLabels = getGoSportPhotoSlotLabels(gsCategorie);
                  const showSlot2 = isTechCat || gsShowExtraPhotoSlot || Boolean(gsPhotoUrl2);

                  const renderPhotoSlotEditor = (slot: 1 | 2) => {
                    const currentVal = slot === 1 ? gsPhotoUrl : gsPhotoUrl2;
                    const setVal = slot === 1 ? setGsPhotoUrl : setGsPhotoUrl2;
                    const slotTitle = slot === 1 ? `Photo 1 · ${slotLabels.slot1}` : `Photo 2 · ${slotLabels.slot2}`;
                    const isLocalSaved = currentVal.startsWith('data:image');
                    const isExternalUrl = isExternalHttpUrl(currentVal);
                    const isConverting = isConvertingUrlSlot === slot;

                    return (
                      <div
                        key={`gs-photo-slot-${slot}`}
                        className={`p-3 rounded-xl bg-[#141820] border space-y-2.5 ${
                          slot === 1 ? 'border-zinc-800' : 'border-sky-500/25'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <span className="text-[11px] font-bold text-zinc-200">{slotTitle}</span>
                          {isLocalSaved ? (
                            <span className="text-[10px] font-bold text-emerald-400 inline-flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" />
                              Sauvegardée en local
                            </span>
                          ) : isExternalUrl ? (
                            <button
                              type="button"
                              disabled={isConverting}
                              onClick={() => void handleConvertManualUrlSlot(slot)}
                              className="text-[10px] font-bold text-amber-300 hover:text-amber-200 underline cursor-pointer inline-flex items-center gap-1"
                            >
                              {isConverting ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <ShieldCheck className="w-3 h-3" />
                              )}
                              <span>{isConverting ? 'Copie...' : 'Sauvegarder en local'}</span>
                            </button>
                          ) : null}
                        </div>

                        {currentVal ? (
                          <div className="space-y-2">
                            <div className="relative h-28 rounded-xl overflow-hidden border border-zinc-700 bg-white">
                              <img
                                src={currentVal}
                                alt={slotTitle}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-contain p-1.5"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setVal('');
                                  if (slot === 1) setGsSelectedCandidateUrl(null);
                                  else setGsSelectedCandidateUrl2(null);
                                }}
                                aria-label={`Retirer la photo ${slot}`}
                                className="min-w-[36px] min-h-[36px] absolute top-1.5 right-1.5 rounded-lg bg-black/75 text-white flex items-center justify-center cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            {!isLocalSaved && (
                              <input
                                type="url"
                                inputMode="url"
                                value={currentVal}
                                onChange={(e) => setVal(e.target.value)}
                                placeholder="URL de la photo (https://...)"
                                className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-[#0b0e14] border border-zinc-700 text-white placeholder-zinc-500 text-xs focus:border-[#FF6D00] focus:outline-none"
                              />
                            )}
                          </div>
                        ) : (
                          <input
                            type="url"
                            inputMode="url"
                            value={currentVal}
                            onChange={(e) => setVal(e.target.value)}
                            placeholder="Ou collez une URL d'image (https://...)"
                            className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-[#0b0e14] border border-zinc-700 text-white placeholder-zinc-500 text-xs focus:border-[#FF6D00] focus:outline-none"
                          />
                        )}

                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isCompressingGsPhoto}
                            onClick={() => triggerGsPhotoUpload('camera', slot)}
                            className="min-h-[38px] flex-1 px-2.5 py-1.5 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/35 text-orange-200 text-[11px] font-bold transition cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                          >
                            <Camera className="w-3.5 h-3.5 text-orange-400" />
                            <span>Prendre</span>
                          </button>
                          <button
                            type="button"
                            disabled={isCompressingGsPhoto}
                            onClick={() => triggerGsPhotoUpload('file', slot)}
                            className="min-h-[38px] flex-1 px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-[11px] font-bold transition cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                          >
                            <Upload className="w-3.5 h-3.5 text-orange-400" />
                            <span>Importer</span>
                          </button>
                        </div>
                      </div>
                    );
                  };

                  return (
                    <div className="p-3.5 rounded-2xl bg-[#0b0e14] border border-zinc-800 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-orange-400" />
                          <span>
                            {isTechCat
                              ? 'Photos du produit (2 vues conseillées)'
                              : 'Photo du produit'}
                          </span>
                        </label>
                        {!showSlot2 && (
                          <button
                            type="button"
                            onClick={() => {
                              setGsShowExtraPhotoSlot(true);
                              setGsActivePhotoSlot(2);
                            }}
                            className="text-[11px] font-bold text-sky-400 hover:text-sky-300 cursor-pointer inline-flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Ajouter une 2ᵉ photo</span>
                          </button>
                        )}
                      </div>

                      <input
                        ref={gsFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleGsPhotoChange}
                        className="hidden"
                      />
                      <input
                        ref={gsCameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleGsPhotoChange}
                        className="hidden"
                      />

                      <div className={`grid grid-cols-1 ${showSlot2 ? 'sm:grid-cols-2' : ''} gap-3`}>
                        {renderPhotoSlotEditor(1)}
                        {showSlot2 && renderPhotoSlotEditor(2)}
                      </div>

                      {isTechCat && gsPhotoUrl && !gsPhotoUrl2 && (
                        <p className="text-[11px] text-sky-300/90 flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5 shrink-0 text-sky-400" />
                          <span>
                            Produit technique : ajoutez une 2ᵉ vue ({slotLabels.slot2.toLowerCase()}) pour enrichir la fiche adhérent.
                          </span>
                        </p>
                      )}
                    </div>
                  );
                })()}

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={gsDescription}
                    onChange={(e) => setGsDescription(e.target.value)}
                    placeholder="Détails techniques, coloris, conditions en magasin..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0e14] border border-zinc-700 text-white placeholder-zinc-500 text-base sm:text-xs focus:border-[#FF6D00] focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-zinc-800">
                  {editingGoSportId ? (
                    confirmDeleteGoSportId === editingGoSportId ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleDeleteGoSport(editingGoSportId)}
                          disabled={deletingGoSportId === editingGoSportId}
                          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {deletingGoSportId === editingGoSportId ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          <span>Confirmer suppression</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteGoSportId(null)}
                          className="min-h-[44px] px-3 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold cursor-pointer"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteGoSportId(editingGoSportId)}
                        className="min-h-[44px] px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Supprimer l'article</span>
                      </button>
                    )
                  ) : (
                    <span />
                  )}

                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDeleteGoSportId(null);
                        setGoSportModalView('list');
                      }}
                      className="min-h-[44px] px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingGoSport || isCompressingGsPhoto}
                      className="min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#BF360C] to-[#E65100] hover:brightness-110 text-white text-xs font-black transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
                    >
                      {isSavingGoSport ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      <span>{isSavingGoSport ? 'Enregistrement...' : 'Enregistrer dans Partenaire_GOSport'}</span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ==================== MODALE D'AJOUT PETITE ANNONCE ==================== */}
      {isFormOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#141820] border-t sm:border border-orange-500/40 rounded-t-3xl sm:rounded-3xl p-4 sm:p-6 w-full sm:max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/20 text-[#FF6D00] flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-heading font-black text-white text-base sm:text-lg">
                    Déposer une annonce
                  </h2>
                  <p className="text-[11px] text-zinc-400">
                    Enregistrée en direct dans Google Sheet « Troc_Annonces »
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                aria-label="Fermer"
                className="min-w-[44px] min-h-[44px] rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Titre de l'annonce *
                </label>
                <input
                  type="text"
                  required
                  enterKeyHint="next"
                  value={titre}
                  onChange={(e) => setTitre(e.target.value)}
                  placeholder="Ex : Raquette Babolat Pure Drive 300g"
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#0b0e14] border border-zinc-700 text-white placeholder-zinc-500 text-base sm:text-xs focus:border-[#FF6D00] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Catégorie *
                  </label>
                  <select
                    value={categorie}
                    onChange={(e) => setCategorie(e.target.value as TrocCategorie)}
                    className="w-full min-h-[44px] px-3 py-2.5 rounded-xl bg-[#0b0e14] border border-zinc-700 text-white text-base sm:text-xs focus:border-[#FF6D00] focus:outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    État *
                  </label>
                  <select
                    value={etat}
                    onChange={(e) => setEtat(e.target.value as TrocEtat)}
                    className="w-full min-h-[44px] px-3 py-2.5 rounded-xl bg-[#0b0e14] border border-zinc-700 text-white text-base sm:text-xs focus:border-[#FF6D00] focus:outline-none"
                  >
                    {ETATS.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Taille / Pointure / Manche *
                  </label>
                  <input
                    type="text"
                    required
                    enterKeyHint="next"
                    value={taillePointure}
                    onChange={(e) => setTaillePointure(e.target.value)}
                    placeholder="Ex : Manche 2, 42, M, 26 pouces"
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#0b0e14] border border-zinc-700 text-white placeholder-zinc-500 text-base sm:text-xs focus:border-[#FF6D00] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Prix (€) *
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.5"
                    required
                    enterKeyHint="next"
                    value={prix}
                    onChange={(e) => setPrix(e.target.value)}
                    placeholder="Ex : 45 (ou 0 pour don)"
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#0b0e14] border border-zinc-700 text-white placeholder-zinc-500 text-base sm:text-xs font-mono tabular-nums focus:border-[#FF6D00] focus:outline-none"
                  />
                </div>
              </div>

              {/* Photos de l'annonce : Photo 1 obligatoire + Photo 2 & Photo 3 optionnelles */}
              <div className="p-3.5 rounded-2xl bg-[#0b0e14] border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-[#FF6D00]" />
                    <span>Photos de l'article (1 obligatoire, jusqu'à 3 max) *</span>
                  </label>
                </div>

                {/* Slot 1 : Photo obligatoire */}
                <div className="p-3 rounded-xl bg-[#141820] border border-zinc-700/80 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wide text-orange-300">
                      Photo 1 · Obligatoire *
                    </span>
                    <input
                      ref={fileInputRef1}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handlePhotoFileChange(1, e)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={compressingPhotoSlot !== null}
                      onClick={() => fileInputRef1.current?.click()}
                      className="min-h-[40px] px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                    >
                      {compressingPhotoSlot === 1 ? (
                        <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
                      ) : (
                        <Camera className="w-4 h-4 text-orange-400" />
                      )}
                      <span>
                        {compressingPhotoSlot === 1
                          ? 'Compression...'
                          : photoUrl
                            ? 'Changer'
                            : 'Prendre / choisir'}
                      </span>
                    </button>
                  </div>

                  {photoUrl ? (
                    <div className="relative h-32 rounded-xl overflow-hidden border border-zinc-700 bg-[#0b0e14]">
                      <img src={photoUrl} alt="Photo 1 principale" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        aria-label="Retirer la photo 1"
                        onClick={() => setPhotoUrl('')}
                        className="min-w-[36px] min-h-[36px] absolute top-1.5 right-1.5 rounded-xl bg-black/75 hover:bg-black text-white flex items-center justify-center cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <input
                      type="url"
                      inputMode="url"
                      value={photoUrl}
                      onChange={(e) => setPhotoUrl(e.target.value)}
                      placeholder="Ou coller un lien d'image (https://...)"
                      className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#0b0e14] border border-zinc-700 text-white placeholder-zinc-500 text-base sm:text-xs focus:border-[#FF6D00] focus:outline-none"
                    />
                  )}
                </div>

                {/* Slots 2 & 3 : Photos optionnelles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Photo 2 optionnelle */}
                  <div className="p-2.5 rounded-xl bg-[#141820] border border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                        Photo 2 (optionnelle)
                      </span>
                      <input
                        ref={fileInputRef2}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoFileChange(2, e)}
                        className="hidden"
                      />
                      <button
                        type="button"
                        disabled={compressingPhotoSlot !== null}
                        onClick={() => fileInputRef2.current?.click()}
                        className="min-h-[36px] px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-bold transition cursor-pointer flex items-center gap-1 whitespace-nowrap disabled:opacity-50"
                      >
                        {compressingPhotoSlot === 2 ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-400" />
                        ) : (
                          <Plus className="w-3.5 h-3.5 text-orange-400" />
                        )}
                        <span>{photoUrl2 ? 'Changer' : 'Ajouter'}</span>
                      </button>
                    </div>
                    {photoUrl2 ? (
                      <div className="relative h-24 rounded-lg overflow-hidden border border-zinc-700 bg-[#0b0e14]">
                        <img src={photoUrl2} alt="Photo 2" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          aria-label="Retirer la photo 2"
                          onClick={() => setPhotoUrl2('')}
                          className="min-w-[32px] min-h-[32px] absolute top-1 right-1 rounded-lg bg-black/75 hover:bg-black text-white flex items-center justify-center cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <input
                        type="url"
                        inputMode="url"
                        value={photoUrl2}
                        onChange={(e) => setPhotoUrl2(e.target.value)}
                        placeholder="Lien https://... (optionnel)"
                        className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg bg-[#0b0e14] border border-zinc-700/80 text-white placeholder-zinc-500 text-xs focus:border-[#FF6D00] focus:outline-none"
                      />
                    )}
                  </div>

                  {/* Photo 3 optionnelle */}
                  <div className="p-2.5 rounded-xl bg-[#141820] border border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                        Photo 3 (optionnelle)
                      </span>
                      <input
                        ref={fileInputRef3}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoFileChange(3, e)}
                        className="hidden"
                      />
                      <button
                        type="button"
                        disabled={compressingPhotoSlot !== null}
                        onClick={() => fileInputRef3.current?.click()}
                        className="min-h-[36px] px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-bold transition cursor-pointer flex items-center gap-1 whitespace-nowrap disabled:opacity-50"
                      >
                        {compressingPhotoSlot === 3 ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-400" />
                        ) : (
                          <Plus className="w-3.5 h-3.5 text-orange-400" />
                        )}
                        <span>{photoUrl3 ? 'Changer' : 'Ajouter'}</span>
                      </button>
                    </div>
                    {photoUrl3 ? (
                      <div className="relative h-24 rounded-lg overflow-hidden border border-zinc-700 bg-[#0b0e14]">
                        <img src={photoUrl3} alt="Photo 3" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          aria-label="Retirer la photo 3"
                          onClick={() => setPhotoUrl3('')}
                          className="min-w-[32px] min-h-[32px] absolute top-1 right-1 rounded-lg bg-black/75 hover:bg-black text-white flex items-center justify-center cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <input
                        type="url"
                        inputMode="url"
                        value={photoUrl3}
                        onChange={(e) => setPhotoUrl3(e.target.value)}
                        placeholder="Lien https://... (optionnel)"
                        className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg bg-[#0b0e14] border border-zinc-700/80 text-white placeholder-zinc-500 text-xs focus:border-[#FF6D00] focus:outline-none"
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Votre nom & prénom *
                  </label>
                  <input
                    type="text"
                    required
                    enterKeyHint="next"
                    value={contactNom}
                    onChange={(e) => setContactNom(e.target.value)}
                    placeholder="Ex : Camille LE GALL"
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#0b0e14] border border-zinc-700 text-white placeholder-zinc-500 text-base sm:text-xs focus:border-[#FF6D00] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                      Téléphone
                    </label>
                    <input
                      type="tel"
                      inputMode="tel"
                      enterKeyHint="next"
                      value={contactTel}
                      onChange={(e) => setContactTel(e.target.value)}
                      placeholder="06 12 34 56 78"
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#0b0e14] border border-zinc-700 text-white placeholder-zinc-500 text-base sm:text-xs focus:border-[#FF6D00] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      inputMode="email"
                      enterKeyHint="done"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="camille@exemple.fr"
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#0b0e14] border border-zinc-700 text-white placeholder-zinc-500 text-base sm:text-xs focus:border-[#FF6D00] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition cursor-pointer whitespace-nowrap"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || compressingPhotoSlot !== null}
                  className="min-h-[44px] flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#BF360C] to-[#E65100] hover:brightness-110 text-white text-xs font-black transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap shadow-lg shadow-orange-950/50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>{isSubmitting ? 'Publication...' : 'Publier en direct'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Lightbox photo (avec navigation multi-angles) */}
      {lightboxPhoto && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setLightboxPhoto(null)}
          className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
        >
          <div className="relative max-w-2xl w-full space-y-2.5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between text-white gap-2">
              <span className="font-heading font-bold text-sm truncate">
                {lightboxPhoto.titre}
                {lightboxPhoto.photos.length > 1
                  ? ` (${lightboxPhoto.index + 1}/${lightboxPhoto.photos.length})`
                  : ''}
              </span>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                aria-label="Fermer l'aperçu"
                className="min-w-[44px] min-h-[44px] rounded-xl bg-zinc-800 text-white flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative">
              <img
                src={lightboxPhoto.photos[lightboxPhoto.index]}
                alt={lightboxPhoto.titre}
                referrerPolicy="no-referrer"
                className="w-full max-h-[78vh] object-contain rounded-2xl border border-zinc-700 bg-white p-2"
              />
              {lightboxPhoto.photos.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Photo précédente"
                    onClick={() =>
                      setLightboxPhoto((prev) =>
                        prev
                          ? {
                              ...prev,
                              index: (prev.index - 1 + prev.photos.length) % prev.photos.length,
                            }
                          : null
                      )
                    }
                    className="min-w-[44px] min-h-[44px] absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/75 hover:bg-black text-white flex items-center justify-center cursor-pointer border border-white/20"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Photo suivante"
                    onClick={() =>
                      setLightboxPhoto((prev) =>
                        prev
                          ? {
                              ...prev,
                              index: (prev.index + 1) % prev.photos.length,
                            }
                          : null
                      )
                    }
                    className="min-w-[44px] min-h-[44px] absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/75 hover:bg-black text-white flex items-center justify-center cursor-pointer border border-white/20"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ==================== MODALE PLEIN ÉCRAN : BOUTIQUE OFFICIELLE TCM ==================== */}
      {isOfficialShopOpen && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Boutique Officielle TCM"
          className="fixed inset-0 z-[99999] bg-[#0b0e14] flex flex-col w-screen h-screen overflow-hidden animate-fadeIn"
        >
          {/* En-tête fixe ergonomique mobile (hauteur 56px mobile / 64px desktop) */}
          <header className="h-[56px] sm:h-[64px] shrink-0 bg-[#141820] border-b border-[#252b37] px-2 sm:px-5 flex items-center justify-between gap-1.5 sm:gap-3 shadow-lg">
            <button
              type="button"
              onClick={() => setIsOfficialShopOpen(false)}
              className="min-h-[44px] px-2.5 sm:px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#BF360C] to-[#E65100] hover:brightness-110 text-white text-[11px] sm:text-sm font-black inline-flex items-center gap-1 sm:gap-1.5 transition cursor-pointer shrink-0 shadow-md shadow-orange-950/50 whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>Retour au ProShop</span>
            </button>

            <h2 className="font-heading font-black text-white text-[11px] sm:text-base tracking-tight truncate text-center flex-1 min-w-0">
              Boutique Officielle TCM
            </h2>

            <a
              href={OFFICIAL_SHOP_WORDPRESS_URL}
              target="_blank"
              rel="noopener noreferrer"
              title="Ouvrir dans le navigateur externe"
              className="min-h-[44px] px-2.5 sm:px-3 py-2 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 hover:text-white text-[11px] sm:text-xs font-bold inline-flex items-center gap-1 sm:gap-1.5 transition shrink-0 whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span>Navigateur</span>
            </a>
          </header>

          {/* Conteneur iframe plein écran occupant toute la hauteur restante */}
          <div className="relative w-full h-[calc(100vh-56px)] sm:h-[calc(100vh-64px)] bg-white overflow-hidden">
            {isShopIframeLoading && (
              <div className="absolute inset-0 z-10 bg-[#0b0e14] flex flex-col items-center justify-center gap-3 p-6 text-center">
                <Loader2 className="w-10 h-10 text-[#FF6D00] animate-spin" />
                <p className="font-heading font-bold text-white text-sm sm:text-base">
                  Chargement de la Boutique Officielle TCM...
                </p>
                <p className="text-xs text-zinc-400 max-w-xs">
                  Connexion à la boutique en ligne en cours.
                </p>
              </div>
            )}

            <iframe
              src={OFFICIAL_SHOP_WORDPRESS_URL}
              title="Boutique Officielle TCM"
              onLoad={() => setIsShopIframeLoading(false)}
              className="w-full h-full border-0 block bg-white"
              allow="payment; fullscreen"
            />
          </div>
        </div>,
        document.body
      )}
      {/* ==================== MODALE CONFIRMATION MISE DE CÔTÉ WHATSAPP ==================== */}
      {whatsappConfirmData && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirmer la mise de côté"
          onClick={() => setWhatsappConfirmData(null)}
          className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-sm p-0 sm:p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#141820] border-t sm:border border-emerald-500/40 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 w-full sm:max-w-md shadow-2xl space-y-4"
          >
            <div className="flex items-start justify-between gap-3 border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-black text-white text-base sm:text-lg">
                    Confirmer la mise de côté
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    GO Sport Muzillac · Réservation WhatsApp
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWhatsappConfirmData(null)}
                aria-label="Fermer"
                className="min-w-[44px] min-h-[44px] rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#0b0e14] border border-zinc-800 space-y-1.5">
              <p className="font-heading font-black text-white text-sm">
                {whatsappConfirmData.offre.nomProduit}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-zinc-300">
                  Taille : <strong className="text-emerald-300">{whatsappConfirmData.tailleName}</strong>
                </span>
                <span className="font-mono font-black text-[#FF6D00] tabular-nums">
                  Tarif Club : {formatPriceEur(whatsappConfirmData.clubPrice)}
                </span>
              </div>
            </div>

            {whatsappConfirmData.hasExplicitQty && whatsappConfirmData.currentQty > 0 ? (
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 leading-relaxed">
                En confirmant, <strong>1 exemplaire</strong> sera automatiquement décompté du stock en ligne (
                <span className="font-mono font-bold tabular-nums">
                  {whatsappConfirmData.currentQty} → {whatsappConfirmData.currentQty - 1}
                </span>
                ), puis WhatsApp s'ouvrira avec votre message pré-rempli.
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-zinc-800/60 border border-zinc-700 text-xs text-zinc-300 leading-relaxed">
                WhatsApp va s'ouvrir avec votre demande de mise de côté pré-remplie pour GO Sport Muzillac.
              </div>
            )}

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setWhatsappConfirmData(null)}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition cursor-pointer"
              >
                Annuler
              </button>
              <a
                href={whatsappConfirmData.whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleConfirmWhatsAppReservation}
                className="min-h-[44px] flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-950/50 text-center"
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span>Confirmer & Ouvrir WhatsApp</span>
              </a>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* ==================== MODALE FICHE DÉTAILLÉE PRODUIT GO SPORT ==================== */}
      {detailGoSportOffre && typeof document !== 'undefined' && createPortal(
        (() => {
          const offre = detailGoSportOffre;
          const detailPhotoList: Array<{ key: string; url: string }> = [];
          if (offre.photoUrl && !goSportBrokenPhotos[`${offre.id}:1`]) {
            detailPhotoList.push({
              key: `${offre.id}:1`,
              url: offre.photoUrl,
            });
          }
          if (offre.photoUrl2 && !goSportBrokenPhotos[`${offre.id}:2`]) {
            detailPhotoList.push({
              key: `${offre.id}:2`,
              url: offre.photoUrl2,
            });
          }
          const safePhotoIdx =
            detailPhotoList.length > 0 ? Math.min(detailPhotoIndex, detailPhotoList.length - 1) : 0;
          const activeDetailPhoto = detailPhotoList[safePhotoIdx] || null;
          const hasPromo = offre.prixPromo !== null && offre.prixPromo !== undefined;
          const hasAdherent = offre.tarifAdherent !== null && offre.tarifAdherent !== undefined;
          const parsedSizes = parseGoSportTaillesDispo(offre.taillesDispo);
          const availableSizes = parsedSizes.filter((s) => s.qty > 0);
          const isAllOutOfStock = parsedSizes.length > 0 && availableSizes.length === 0;
          const storedSelection = selectedSizesByOffre[offre.id];
          const validSelectedSize =
            storedSelection && availableSizes.some((s) => s.name === storedSelection)
              ? storedSelection
              : availableSizes.length === 1
                ? availableSizes[0].name
                : null;
          const effectiveTailleForWhatsApp =
            validSelectedSize || (parsedSizes.length === 0 ? 'Unique' : null);
          const clubPriceForMessage =
            offre.tarifAdherent ?? offre.prixPromo ?? offre.tarifMagasin;
          const whatsappMessage = effectiveTailleForWhatsApp
            ? `Bonjour, je suis adhérent du Muzillac Tennis Club (TCM). Serait-il possible de me mettre de côté l'article suivant en magasin : ${offre.nomProduit} - Taille : ${effectiveTailleForWhatsApp} (Tarif Club : ${clubPriceForMessage} €) ? Merci !`
            : '';
          const whatsappHref = effectiveTailleForWhatsApp
            ? `https://wa.me/${GOSPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`
            : '';
          const showSelectSizeHint = !!sizeHintByOffre[offre.id] && !validSelectedSize;

          return (
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Fiche produit : ${offre.nomProduit}`}
              onClick={() => setDetailGoSportOffreId(null)}
              className="fixed inset-0 z-[99998] flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-sm p-0 sm:p-4 animate-fadeIn"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="bg-[#141820] border-t sm:border border-orange-500/40 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl p-4 sm:p-6 space-y-4"
              >
                <div className="flex items-start justify-between gap-3 border-b border-zinc-800 pb-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-bold text-[#FF6D00] uppercase tracking-wide">
                        {offre.categorie}
                      </span>
                      {offre.excluClub && (
                        <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-300 to-amber-500 text-zinc-950 font-heading font-black text-[10px] uppercase tracking-wider inline-flex items-center gap-1">
                          <Award className="w-3 h-3 shrink-0" />
                          <span>Exclu Club</span>
                        </span>
                      )}
                      {isGoSportUnitaire(offre.reference, offre.nomProduit) && (
                        <span className="px-2 py-0.5 rounded-md bg-sky-500/15 border border-sky-400/40 text-sky-300 text-[10px] font-black uppercase tracking-wide">
                          Vendu à l'unité
                        </span>
                      )}
                    </div>
                    <h3 className="font-heading font-black text-white text-lg sm:text-xl leading-snug">
                      {offre.nomProduit}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailGoSportOffreId(null)}
                    aria-label="Fermer la fiche"
                    className="min-w-[44px] min-h-[44px] rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Galerie photo tactile avec flèches et indicateur 1/2 - 2/2 */}
                <div
                  onTouchStart={(e) => {
                    detailTouchStartXRef.current = e.touches[0]?.clientX ?? null;
                  }}
                  onTouchEnd={(e) => {
                    if (detailPhotoList.length <= 1 || detailTouchStartXRef.current === null) return;
                    const endX = e.changedTouches[0]?.clientX;
                    if (typeof endX === 'number') {
                      const dx = endX - detailTouchStartXRef.current;
                      if (Math.abs(dx) > 40) {
                        setDetailPhotoIndex((prev) =>
                          dx < 0
                            ? (prev + 1) % detailPhotoList.length
                            : (prev - 1 + detailPhotoList.length) % detailPhotoList.length
                        );
                      }
                    }
                    detailTouchStartXRef.current = null;
                  }}
                  className="relative h-56 sm:h-60 rounded-2xl bg-[#0b0e14] border border-zinc-800 overflow-hidden"
                >
                  {activeDetailPhoto ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setLightboxPhoto({
                            photos: detailPhotoList.map((p) => p.url),
                            index: safePhotoIdx,
                            titre: offre.nomProduit,
                          })
                        }
                        className="w-full h-full block cursor-zoom-in"
                        title="Agrandir la photo"
                      >
                        <img
                          src={activeDetailPhoto.url}
                          alt={offre.nomProduit}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setGoSportBrokenPhotos((prev) => ({
                              ...prev,
                              [activeDetailPhoto.key]: true,
                            }))
                          }
                          className="w-full h-full object-contain p-2 bg-white"
                        />
                      </button>

                      {detailPhotoList.length > 1 && (
                        <>
                          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-black/75 border border-white/15 text-zinc-200 text-[10px] font-mono font-bold pointer-events-none">
                            {safePhotoIdx + 1}/{detailPhotoList.length}
                          </span>
                          <button
                            type="button"
                            aria-label="Vue précédente"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetailPhotoIndex(
                                (safePhotoIdx - 1 + detailPhotoList.length) % detailPhotoList.length
                              );
                            }}
                            className="min-w-[38px] min-h-[38px] absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center cursor-pointer border border-white/15 transition"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="Vue suivante"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetailPhotoIndex((safePhotoIdx + 1) % detailPhotoList.length);
                            }}
                            className="min-w-[38px] min-h-[38px] absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center cursor-pointer border border-white/15 transition"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-zinc-600">
                      <ShoppingBag className="w-10 h-10 opacity-40" />
                      <span className="text-xs font-semibold">Visuel produit indisponible</span>
                    </div>
                  )}
                </div>

                {/* Référence fournisseur & Référence magasin */}
                {(offre.reference || offre.referenceFabricantClean) && (
                  <div className="p-3 rounded-2xl bg-[#0b0e14] border border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                    {offre.referenceFabricantClean && (
                      <div>
                        <span className="text-zinc-400">Réf. fournisseur : </span>
                        <span className="font-mono font-bold text-white">
                          {offre.referenceFabricantClean}
                        </span>
                      </div>
                    )}
                    {offre.reference && (
                      <div>
                        <span className="text-zinc-400">Réf. magasin : </span>
                        <span className="font-mono font-semibold text-zinc-200">
                          {offre.reference}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Explication concise en français */}
                {offre.description ? (
                  <div className="p-3.5 rounded-2xl bg-[#0b0e14] border border-zinc-800 space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">
                      Présentation du produit
                    </span>
                    <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed">
                      {offre.description}
                    </p>
                  </div>
                ) : userRole === 'admin' && (offre.reference || offre.referenceFabricantClean) ? (
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
                    Aucune description enregistrée. Cliquez sur « Modifier tarifs / stock » pour rechercher automatiquement la fiche produit.
                  </div>
                ) : null}

                {/* Détail des 3 tarifs */}
                <div className="p-3.5 rounded-2xl bg-[#0b0e14] border border-zinc-800 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-zinc-400">
                      Tarif magasin :{' '}
                      <span className="line-through text-zinc-500 font-mono tabular-nums">
                        {formatPriceEur(offre.tarifMagasin)}
                      </span>
                    </span>

                    {hasPromo && (
                      <span className="text-zinc-300">
                        Prix promo :{' '}
                        <span
                          className={`font-mono font-bold tabular-nums ${
                            hasAdherent ? 'line-through text-zinc-500' : 'text-amber-300'
                          }`}
                        >
                          {formatPriceEur(offre.prixPromo!)}
                        </span>
                      </span>
                    )}
                  </div>

                  {hasAdherent && (
                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-zinc-800/80">
                      <span className="text-xs font-black text-orange-300 uppercase tracking-wide">
                        Tarif Adhérent Club
                      </span>
                      <span className="font-heading font-black text-xl text-[#FF6D00] tabular-nums">
                        {formatPriceEur(offre.tarifAdherent!)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Tailles & disponibilité + WhatsApp */}
                {parsedSizes.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                      <PackageCheck className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {isAllOutOfStock
                          ? 'Stock magasin Muzillac'
                          : availableSizes.length > 1
                            ? 'En stock à Muzillac · Choisissez votre taille :'
                            : 'En stock à Muzillac'}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {parsedSizes.map((item, idx) => {
                        const isSelected = validSelectedSize === item.name;
                        if (item.qty === 0) {
                          return (
                            <span
                              key={`${offre.id}-detail-taille-${idx}`}
                              aria-disabled="true"
                              className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-zinc-500 text-xs font-semibold line-through cursor-not-allowed inline-flex items-center"
                            >
                              {item.name} (Épuisé)
                            </span>
                          );
                        }

                        const isLastOne = item.qty === 1;
                        const labelQty = item.hasExplicitQty
                          ? isLastOne
                            ? 'Dernier !'
                            : `${item.qty} dispo`
                          : 'En stock';

                        return (
                          <button
                            key={`${offre.id}-detail-taille-${idx}`}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => {
                              setSelectedSizesByOffre((prev) => ({
                                ...prev,
                                [offre.id]:
                                  prev[offre.id] === item.name && availableSizes.length > 1
                                    ? ''
                                    : item.name,
                              }));
                              setSizeHintByOffre((prev) => ({ ...prev, [offre.id]: false }));
                            }}
                            className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-bold transition active:scale-95 cursor-pointer inline-flex items-center gap-1.5 tabular-nums select-none ${
                              isLastOne
                                ? isSelected
                                  ? 'bg-orange-500 border-white text-zinc-950 font-black ring-2 ring-orange-300'
                                  : 'bg-orange-500/15 hover:bg-orange-500/25 border-orange-500/50 text-orange-300'
                                : isSelected
                                  ? 'bg-emerald-500 border-white text-zinc-950 font-black ring-2 ring-emerald-300'
                                  : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/45 text-emerald-300'
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 shrink-0 stroke-[3]" />}
                            <span>
                              {item.name} ({labelQty})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {showSelectSizeHint && (
                  <p className="text-[11px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
                    Cliquez d'abord sur votre taille ci-dessus pour réserver en magasin.
                  </p>
                )}

                {isAllOutOfStock ? (
                  <div className="min-h-[44px] w-full px-3.5 py-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700 text-zinc-400 text-xs font-bold flex items-center justify-center text-center">
                    Temporairement en rupture à Muzillac
                  </div>
                ) : effectiveTailleForWhatsApp ? (
                  <button
                    type="button"
                    onClick={() => {
                      const matchedIdx = validSelectedSize
                        ? parsedSizes.findIndex((s) => s.name === validSelectedSize && s.qty > 0)
                        : -1;
                      const matchedItem = matchedIdx >= 0 ? parsedSizes[matchedIdx] : null;
                      setWhatsappConfirmData({
                        offre,
                        tailleName: effectiveTailleForWhatsApp,
                        sizeIndex: matchedIdx,
                        hasExplicitQty: !!matchedItem?.hasExplicitQty,
                        currentQty: matchedItem ? matchedItem.qty : 0,
                        clubPrice: clubPriceForMessage,
                        whatsappHref,
                      });
                    }}
                    className="min-h-[44px] w-full px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-emerald-950/50 text-center"
                  >
                    <MessageCircle className="w-4 h-4 shrink-0" />
                    <span>Mettre de côté à GO Sport Muzillac</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setSizeHintByOffre((prev) => ({ ...prev, [offre.id]: true }))
                    }
                    className="min-h-[44px] w-full px-3.5 py-2.5 rounded-xl bg-emerald-600/85 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-emerald-950/50 text-center"
                  >
                    <MessageCircle className="w-4 h-4 shrink-0" />
                    <span>Mettre de côté à GO Sport Muzillac</span>
                  </button>
                )}

                {/* Outils Admin complets dans la fiche détaillée */}
                {userRole === 'admin' && (
                  <div className="space-y-2.5 pt-3 border-t border-zinc-800">
                    {parsedSizes.length > 0 && (
                      <div className="p-3 rounded-2xl bg-[#0b0e14] border border-zinc-800 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                            Stock magasin (-1 / +1)
                          </span>
                          {quickStockStatusByOffre[offre.id] === 'saving' && (
                            <span className="text-[10px] font-bold text-amber-300 inline-flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Sync...</span>
                            </span>
                          )}
                          {quickStockStatusByOffre[offre.id] === 'saved' && (
                            <span className="text-[10px] font-bold text-emerald-400 inline-flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              <span>Enregistré</span>
                            </span>
                          )}
                          {quickStockStatusByOffre[offre.id] === 'error' && (
                            <span className="text-[10px] font-bold text-rose-400">
                              Erreur sync
                            </span>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          {parsedSizes.map((item, idx) => (
                            <div
                              key={`${offre.id}-detail-quick-${idx}`}
                              className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[#141820] border border-zinc-800/90"
                            >
                              <div className="min-w-0 flex items-center gap-2">
                                <span className="text-xs font-bold text-white truncate">
                                  {item.name}
                                </span>
                                {!item.hasExplicitQty && (
                                  <span className="text-[10px] text-zinc-500">(défaut)</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => applyGoSportStockDelta(offre.id, idx, -1)}
                                  disabled={item.qty <= 0}
                                  aria-label={`Diminuer le stock de ${item.name}`}
                                  className="min-w-[36px] min-h-[36px] rounded-lg bg-zinc-800 hover:bg-rose-500/25 hover:text-rose-200 border border-zinc-700 text-zinc-200 flex items-center justify-center transition cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span
                                  className={`min-w-[28px] text-center font-mono text-xs font-black tabular-nums ${
                                    item.qty === 0
                                      ? 'text-zinc-500'
                                      : item.qty === 1
                                        ? 'text-orange-300'
                                        : 'text-emerald-300'
                                  }`}
                                >
                                  {item.qty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => applyGoSportStockDelta(offre.id, idx, 1)}
                                  aria-label={`Augmenter le stock de ${item.name}`}
                                  className="min-w-[36px] min-h-[36px] rounded-lg bg-zinc-800 hover:bg-emerald-500/25 hover:text-emerald-200 border border-zinc-700 text-zinc-200 flex items-center justify-center transition cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {confirmDeleteGoSportId === offre.id ? (
                      <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/40 space-y-2">
                        <p className="text-[11px] font-bold text-rose-200 text-center">
                          Supprimer définitivement cet article ?
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteGoSportId(null)}
                            disabled={deletingGoSportId === offre.id}
                            className="min-h-[40px] flex-1 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold cursor-pointer disabled:opacity-50"
                          >
                            Annuler
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await handleDeleteGoSport(offre.id);
                              setDetailGoSportOffreId(null);
                            }}
                            disabled={deletingGoSportId === offre.id}
                            className="min-h-[40px] flex-1 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            {deletingGoSportId === offre.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                            <span>Confirmer</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setDetailGoSportOffreId(null);
                            openGoSportEdit(offre);
                          }}
                          className="min-h-[44px] flex-1 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5 text-amber-300" />
                          <span>Modifier tarifs / stock</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteGoSportId(offre.id)}
                          title="Supprimer cet article"
                          aria-label="Supprimer cet article"
                          className="min-w-[44px] min-h-[44px] px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 flex items-center justify-center transition cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })(),
        document.body
      )}

      {onRefreshPartenaires && (
        <PartenairesModal
          isOpen={isPartenairesModalOpen}
          onClose={() => setIsPartenairesModalOpen(false)}
          partenaires={partenaires}
          gasUrl={gasUrl}
          onRefreshPartenaires={onRefreshPartenaires}
          defaultRole="boutique"
        />
      )}
    </div>
  );
};

