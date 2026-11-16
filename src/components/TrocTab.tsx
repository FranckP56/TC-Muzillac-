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
  UserCheck,
  ArrowLeft,
  Minus,
  MessageCircle,
  Check,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  TrocAnnonce,
  TrocCategorie,
  TrocEtat,
  GoSportOffre,
  UserRole,
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

/**
 * URL de la boutique officielle du club
 */
export const OFFICIAL_SHOP_WORDPRESS_URL = 'https://monespaceclub.com/categorie/tennis/tennis-club-muzillac/';

const FAVORIS_STORAGE_KEY = 'club_tennis_favoris';
const MES_ANNONCES_STORAGE_KEY = 'club_tennis_mes_annonces';
const VENDEUR_PROFIL_STORAGE_KEY = 'club_tennis_vendeur_profil';

type ProShopSubTab = 'gosport' | 'annonces' | 'mes_annonces';

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
  'Raquettes',
  'Chaussures',
  'Tenues',
  'Sacs',
  'Balles & Cordages',
  'Accessoires',
];

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
      const match = part.match(/^(.*?)\s*\((\d+)\)\s*$/);
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
async function compressImageToBase64(file: File): Promise<string> {
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

export const TrocTab: React.FC<TrocTabProps> = ({
  gasUrl,
  selectedSpreadsheetId,
  userRole,
  onOpenScriptModal,
}) => {
  const [subTab, setSubTab] = useState<ProShopSubTab>('gosport');
  const [isOfficialShopOpen, setIsOfficialShopOpen] = useState(false);
  const [isShopIframeLoading, setIsShopIframeLoading] = useState(true);

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
  const [goSportBrokenPhotos, setGoSportBrokenPhotos] = useState<Record<string, boolean>>({});
  const [selectedSizesByOffre, setSelectedSizesByOffre] = useState<Record<string, string>>({});
  const [sizeHintByOffre, setSizeHintByOffre] = useState<Record<string, boolean>>({});
  const [quickStockStatusByOffre, setQuickStockStatusByOffre] = useState<
    Record<string, 'idle' | 'saving' | 'saved' | 'error'>
  >({});
  const [whatsappConfirmData, setWhatsappConfirmData] = useState<WhatsAppConfirmData | null>(null);
  const goSportOffresRef = useRef<GoSportOffre[]>([]);
  const stockSaveChainRef = useRef<Record<string, Promise<void>>>({});

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
  const [goSportFormError, setGoSportFormError] = useState<string | null>(null);
  const [goSportSuccessMsg, setGoSportSuccessMsg] = useState<string | null>(null);
  const [deletingGoSportId, setDeletingGoSportId] = useState<string | null>(null);
  const [confirmDeleteGoSportId, setConfirmDeleteGoSportId] = useState<string | null>(null);
  const gsFileInputRef = useRef<HTMLInputElement>(null);

  // ==================== ÉTAT : PETITES ANNONCES (Troc_Annonces) ====================
  const [annonces, setAnnonces] = useState<TrocAnnonce[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scriptUpdateNeeded, setScriptUpdateNeeded] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategorie, setSelectedCategorie] = useState<string>('Toutes');
  const [showSold, setShowSold] = useState<boolean>(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccessMsg, setFormSuccessMsg] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; titre: string } | null>(null);
  const [brokenPhotos, setBrokenPhotos] = useState<Record<string, boolean>>({});

  // Favoris & Mes Annonces (localStorage)
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() =>
    readStringArrayFromStorage(FAVORIS_STORAGE_KEY)
  );
  const [myAnnonceIds, setMyAnnonceIds] = useState<string[]>(() =>
    readStringArrayFromStorage(MES_ANNONCES_STORAGE_KEY)
  );
  const [sellerProfile, setSellerProfile] = useState<SellerProfile>(() => readSellerProfile());
  const [lookupContact, setLookupContact] = useState('');

  // Champs du formulaire d'ajout Troc
  const [titre, setTitre] = useState('');
  const [categorie, setCategorie] = useState<TrocCategorie>('Raquettes');
  const [taillePointure, setTaillePointure] = useState('');
  const [etat, setEtat] = useState<TrocEtat>('Très bon état');
  const [prix, setPrix] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [contactNom, setContactNom] = useState(() => readSellerProfile().nom || '');
  const [contactTel, setContactTel] = useState(() => readSellerProfile().tel || '');
  const [contactEmail, setContactEmail] = useState(() => readSellerProfile().email || '');

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setGsNomProduit('');
    setGsCategorie('Raquettes');
    setGsPhotoUrl('');
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

  const openGoSportEdit = (offre: GoSportOffre) => {
    setEditingGoSportId(offre.id);
    setGsNomProduit(offre.nomProduit);
    setGsCategorie(offre.categorie || 'Équipement');
    setGsPhotoUrl(offre.photoUrl || '');
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

  const handleGsPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCompressingGsPhoto(true);
    setGoSportFormError(null);
    try {
      const compressed = await compressImageToBase64(file);
      setGsPhotoUrl(compressed);
    } catch (err: any) {
      setGoSportFormError(err?.message || "Erreur lors du traitement de la photo.");
    } finally {
      setIsCompressingGsPhoto(false);
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

    setIsSavingGoSport(true);
    const res = await saveGoSportOffreToSheet(
      {
        id: editingGoSportId || undefined,
        nomProduit: gsNomProduit.trim(),
        categorie: gsCategorie.trim() || 'Équipement',
        photoUrl: gsPhotoUrl.trim(),
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
    setDeletingGoSportId(id);
    setGoSportFormError(null);
    setGoSportError(null);
    const res = await deleteGoSportOffreInSheet(id, gasUrl || TCM_APPS_SCRIPT_URL);
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
  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCompressingPhoto(true);
    setFormError(null);
    try {
      const compressed = await compressImageToBase64(file);
      setPhotoUrl(compressed);
    } catch (err: any) {
      setFormError(err?.message || "Erreur lors du traitement de la photo.");
    } finally {
      setIsCompressingPhoto(false);
    }
  };

  const resetForm = () => {
    setTitre('');
    setCategorie('Raquettes');
    setTaillePointure('');
    setEtat('Très bon état');
    setPrix('');
    setPhotoUrl('');
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
        photoUrl,
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
    const cats = Array.from(new Set(goSportOffres.map((o) => o.categorie).filter(Boolean)));
    return ['Toutes', ...cats];
  }, [goSportOffres]);

  const filteredGoSportOffres = useMemo(() => {
    const q = goSportSearch.trim().toLowerCase();
    return goSportOffres.filter((o) => {
      if (goSportSelectedCat !== 'Toutes' && o.categorie !== goSportSelectedCat) return false;
      if (!q) return true;
      const hay = `${o.nomProduit} ${o.categorie} ${o.description} ${o.taillesDispo}`.toLowerCase();
      return hay.includes(q);
    });
  }, [goSportOffres, goSportSearch, goSportSelectedCat]);

  const filteredAnnonces = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return annonces.filter((a) => {
      if (!showSold && a.statut.toLowerCase() === 'vendu') return false;
      if (selectedCategorie !== 'Toutes' && a.categorie !== selectedCategorie) return false;
      if (!q) return true;
      const hay = `${a.titre} ${a.categorie} ${a.taillePointure} ${a.etat} ${a.contactNom}`.toLowerCase();
      return hay.includes(q);
    });
  }, [annonces, searchQuery, selectedCategorie, showSold]);

  const activeCount = useMemo(
    () => annonces.filter((a) => a.statut.toLowerCase() !== 'vendu').length,
    [annonces]
  );

  const favoriteAnnonces = useMemo(
    () => annonces.filter((a) => favoriteIds.includes(a.id)),
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
    const photoInvalid = !annonce.photoUrl || brokenPhotos[annonce.id];
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
        className={`bg-[#141820] border rounded-3xl overflow-hidden shadow-xl flex flex-col transition ${
          isSold ? 'border-zinc-800/80 opacity-80' : 'border-[#252b37] hover:border-orange-500/40'
        }`}
      >
        <div className="relative h-48 bg-[#0b0e14] border-b border-zinc-800/80 overflow-hidden">
          {!photoInvalid ? (
            <button
              type="button"
              onClick={() => setLightboxPhoto({ url: annonce.photoUrl!, titre: annonce.titre })}
              className="w-full h-full block cursor-zoom-in"
              title="Agrandir la photo"
            >
              <img
                src={annonce.photoUrl}
                alt={annonce.titre}
                referrerPolicy="no-referrer"
                onError={() => setBrokenPhotos((prev) => ({ ...prev, [annonce.id]: true }))}
                className="w-full h-full object-cover"
              />
            </button>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-zinc-600">
              <Tag className="w-10 h-10 opacity-40" />
              <span className="text-[11px] font-semibold">Sans photo</span>
            </div>
          )}

          {/* Bouton Cœur Favori (localStorage : club_tennis_favoris) */}
          <button
            type="button"
            onClick={() => toggleFavorite(annonce.id)}
            aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            className={`absolute top-2.5 left-2.5 min-w-[44px] min-h-[44px] rounded-2xl backdrop-blur-md border flex items-center justify-center transition cursor-pointer ${
              isFavorite
                ? 'bg-rose-500/20 border-rose-500/60 text-rose-500 shadow-lg shadow-rose-950/50'
                : 'bg-black/70 border-white/15 text-zinc-200 hover:text-rose-400 hover:border-rose-400/50'
            }`}
          >
            <Heart className={`w-5 h-5 transition-transform ${isFavorite ? 'fill-rose-500 text-rose-500 scale-110' : ''}`} />
          </button>

          {/* Prix tabulaire */}
          <div className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-black/80 backdrop-blur-sm border border-white/15 font-heading font-black text-white text-base tabular-nums">
            {annonce.prix === 0 ? 'Gratuit / Don' : `${annonce.prix} €`}
          </div>

          {isSold && (
            <div className="absolute inset-0 bg-black/55 flex items-center justify-center pointer-events-none">
              <span className="px-4 py-1.5 rounded-xl bg-zinc-900/95 border border-zinc-600 text-zinc-200 font-heading font-black text-sm uppercase tracking-wider">
                Vendu
              </span>
            </div>
          )}
        </div>

        <div className="p-4 flex-1 flex flex-col justify-between gap-3.5">
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-[#FF6D00] uppercase tracking-wide">
              {annonce.categorie} · {annonce.etat}
            </p>
            <h3 className="font-heading font-black text-white text-base sm:text-lg leading-snug">
              {annonce.titre}
            </h3>
            <p className="text-xs text-zinc-300">
              Taille / Pointure : <strong className="text-white">{annonce.taillePointure}</strong>
            </p>
            <p className="text-[11px] text-zinc-500">
              Publiée le {annonce.datePublication} · Vendeur :{' '}
              <span className="text-zinc-300 font-semibold">{annonce.contactNom}</span>
            </p>
          </div>

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
    <div className="space-y-5 animate-fadeIn">
      {/* ==================== 1. BANNIÈRE FIXE BOUTIQUE OFFICIELLE DU CLUB ==================== */}
      <section
        aria-label="Boutique Officielle du Club"
        className="relative overflow-hidden rounded-3xl border border-orange-500/40 bg-gradient-to-br from-[#BF360C] via-[#9B2908] to-[#141820] p-5 sm:p-7 shadow-2xl"
      >
        <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-orange-400/15 blur-2xl pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-orange-200">
              <Store className="w-4 h-4 text-amber-300 shrink-0" />
              <span>ProShop · Muzillac Tennis Club</span>
            </div>
            <h1 className="font-heading font-black text-white text-2xl sm:text-3xl tracking-tight">
              Boutique Officielle du Club
            </h1>
            <p className="text-xs sm:text-sm text-orange-100/90 leading-relaxed">
              Équipez-vous aux couleurs du TCM : t-shirts d'équipe, sweats, vestes et tenues officielles du club disponibles en commande en ligne sur notre boutique partenaire.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={openOfficialShop}
              className="min-h-[48px] px-5 py-3 rounded-2xl bg-white text-[#9B2908] hover:bg-orange-50 font-heading font-black text-xs sm:text-sm inline-flex items-center justify-center gap-2.5 shadow-xl transition cursor-pointer whitespace-nowrap"
            >
              <ShoppingBag className="w-4 h-4 shrink-0" />
              <span>Accéder à la boutique officielle</span>
            </button>
          </div>
        </div>
      </section>

      {/* ==================== 2. BARRE DE SOUS-ONGLETS PROSHOP (3 VUES) ==================== */}
      <div
        role="tablist"
        aria-label="Sections ProShop"
        className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-[#141820] border border-[#252b37] p-2 rounded-2xl shadow-lg"
      >
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'gosport'}
          onClick={() => setSubTab('gosport')}
          className={`min-h-[46px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center justify-center gap-2 ${
            subTab === 'gosport'
              ? 'bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white shadow-md shadow-orange-950/50'
              : 'text-zinc-400 hover:text-white hover:bg-[#191e28]'
          }`}
        >
          <Award className="w-4 h-4 shrink-0" />
          <span className="truncate">Offres GO Sport Muzillac</span>
          <span className="text-[11px] font-mono tabular-nums opacity-85">
            ({goSportOffres.length})
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'annonces'}
          onClick={() => setSubTab('annonces')}
          className={`min-h-[46px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center justify-center gap-2 ${
            subTab === 'annonces'
              ? 'bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white shadow-md shadow-orange-950/50'
              : 'text-zinc-400 hover:text-white hover:bg-[#191e28]'
          }`}
        >
          <Tag className="w-4 h-4 shrink-0" />
          <span className="truncate">Petites Annonces</span>
          <span className="text-[11px] font-mono tabular-nums opacity-85">
            ({activeCount})
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'mes_annonces'}
          onClick={() => setSubTab('mes_annonces')}
          className={`min-h-[46px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center justify-center gap-2 ${
            subTab === 'mes_annonces'
              ? 'bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white shadow-md shadow-orange-950/50'
              : 'text-zinc-400 hover:text-white hover:bg-[#191e28]'
          }`}
        >
          <Heart className="w-4 h-4 shrink-0" />
          <span className="truncate">Mes Annonces / Favoris</span>
          <span className="text-[11px] font-mono tabular-nums opacity-85">
            ({favoriteAnnonces.length + myAnnonces.length})
          </span>
        </button>
      </div>

      {/* ==================== ONGLET 1 : OFFRES GO SPORT MUZILLAC ==================== */}
      {subTab === 'gosport' && (
        <div className="space-y-5 animate-fadeIn">
          {/* En-tête filtres + bouton admin */}
          <div className="bg-[#141820] border border-[#252b37] rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-heading font-black text-white text-lg sm:text-xl tracking-tight">
                  Offres Partenaire GO Sport Muzillac
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                  Tarifs négociés et exclusivités réservées aux licenciés du club · En stock au magasin de Muzillac
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadGoSportLive()}
                  disabled={isGoSportLoading}
                  className="min-w-[44px] min-h-[44px] px-3 py-2.5 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  <RefreshCw className={`w-4 h-4 ${isGoSportLoading ? 'animate-spin text-orange-400' : ''}`} />
                  <span>Actualiser</span>
                </button>

                {userRole === 'admin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setGoSportModalView('list');
                      setIsGoSportModalOpen(true);
                    }}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap"
                  >
                    <Settings2 className="w-4 h-4 shrink-0" />
                    <span>Gérer les offres GO Sport</span>
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
                placeholder="Rechercher un produit, une taille, une catégorie..."
                className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl bg-[#0b0e14] border border-zinc-700/80 text-white placeholder-zinc-500 text-base sm:text-xs focus:border-[#FF6D00] focus:outline-none transition"
              />
            </div>

            {goSportCategories.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {goSportCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setGoSportSelectedCat(cat)}
                    className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition cursor-pointer ${
                      goSportSelectedCat === cat
                        ? 'bg-[#E65100] text-white shadow-md shadow-orange-950/40'
                        : 'bg-[#0b0e14] border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGoSportOffres.map((offre) => {
                const photoInvalid = !offre.photoUrl || goSportBrokenPhotos[offre.id];
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
                    className="bg-[#141820] border border-[#252b37] hover:border-orange-500/40 rounded-3xl overflow-hidden shadow-xl flex flex-col transition"
                  >
                    {/* Photo produit */}
                    <div className="relative h-52 bg-[#0b0e14] border-b border-zinc-800/80 overflow-hidden">
                      {!photoInvalid ? (
                        <button
                          type="button"
                          onClick={() => setLightboxPhoto({ url: offre.photoUrl!, titre: offre.nomProduit })}
                          className="w-full h-full block cursor-zoom-in"
                          title="Agrandir la photo"
                        >
                          <img
                            src={offre.photoUrl}
                            alt={offre.nomProduit}
                            referrerPolicy="no-referrer"
                            onError={() =>
                              setGoSportBrokenPhotos((prev) => ({ ...prev, [offre.id]: true }))
                            }
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-zinc-600">
                          <ShoppingBag className="w-10 h-10 opacity-40" />
                          <span className="text-[11px] font-semibold">Visuel produit</span>
                        </div>
                      )}

                      {/* Badge doré Exclu Club si Exclu_Club === OUI */}
                      {offre.excluClub && (
                        <div className="absolute top-3 left-3 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 text-zinc-950 font-heading font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 shrink-0" />
                          <span>Exclu Club</span>
                        </div>
                      )}
                    </div>

                    {/* Corps carte GO Sport */}
                    <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                      <div className="space-y-2">
                        <p className="text-[11px] font-bold text-[#FF6D00] uppercase tracking-wide">
                          {offre.categorie}
                        </p>
                        <h3 className="font-heading font-black text-white text-base sm:text-lg leading-snug">
                          {offre.nomProduit}
                        </h3>
                        {offre.description && (
                          <p className="text-xs text-zinc-300 leading-relaxed">
                            {offre.description}
                          </p>
                        )}
                      </div>

                      <div className="space-y-3 pt-3 border-t border-zinc-800/80">
                        {/* Bloc des 3 tarifs */}
                        <div className="p-3 rounded-2xl bg-[#0b0e14] border border-zinc-800 space-y-2">
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

                        {/* Gestion des stocks & tailles interactives */}
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
                                      key={`${offre.id}-taille-${idx}`}
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
                                    className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-bold transition active:scale-95 cursor-pointer inline-flex items-center gap-1.5 tabular-nums select-none ${
                                      isLastOne
                                        ? isSelected
                                          ? 'bg-orange-500 border-white text-zinc-950 font-black shadow-lg shadow-orange-500/30 ring-2 ring-orange-300'
                                          : 'bg-orange-500/15 hover:bg-orange-500/25 border-orange-500/50 text-orange-300'
                                        : isSelected
                                          ? 'bg-emerald-500 border-white text-zinc-950 font-black shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-300'
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

                            {validSelectedSize && (
                              <p className="text-[11px] font-bold text-emerald-300 flex items-center gap-1">
                                <Check className="w-3.5 h-3.5 shrink-0" />
                                <span>Taille sélectionnée : {validSelectedSize}</span>
                              </p>
                            )}
                          </div>
                        )}

                        {/* Message d'invitation si plusieurs tailles et aucune sélectionnée */}
                        {showSelectSizeHint && (
                          <p className="text-[11px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
                            Cliquez d'abord sur votre taille ci-dessus pour réserver en magasin.
                          </p>
                        )}

                        {/* Bouton WhatsApp (avec confirmation + décrémentation auto) ou Bandeau Rupture */}
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

                        {/* Actions rapides Admin / GO Sport directement sur la carte */}
                        {userRole === 'admin' && (
                          <div className="space-y-2 pt-2 border-t border-zinc-800/70">
                            {parsedSizes.length > 0 && (
                              <div className="p-2.5 rounded-2xl bg-[#0b0e14] border border-zinc-800 space-y-2">
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
                                      key={`${offre.id}-quick-${idx}`}
                                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[#141820] border border-zinc-800/90"
                                    >
                                      <div className="min-w-0 flex items-center gap-2">
                                        <span className="text-xs font-bold text-white truncate">
                                          {item.name}
                                        </span>
                                        {!item.hasExplicitQty && (
                                          <span className="text-[10px] text-zinc-500">
                                            (défaut)
                                          </span>
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
                                    onClick={() => handleDeleteGoSport(offre.id)}
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
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openGoSportEdit(offre)}
                                    className="min-h-[44px] flex-1 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                                  >
                                    <Pencil className="w-3.5 h-3.5 text-amber-300" />
                                    <span>Modifier tarifs / stock</span>
                                  </button>
                                  {!isAllOutOfStock && (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteGoSportId(offre.id)}
                                      title="Supprimer cet article"
                                      aria-label="Supprimer cet article"
                                      className="min-w-[44px] min-h-[44px] px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 flex items-center justify-center transition cursor-pointer shrink-0"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                                {isAllOutOfStock && (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteGoSportId(offre.id)}
                                    className="min-h-[44px] w-full px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/45 text-rose-200 text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Retirer cet article épuisé</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
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
        <div className="space-y-5 animate-fadeIn">
          {/* En-tête mobile-first */}
          <div className="bg-[#141820] border border-[#252b37] rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#BF360C] to-[#FF6D00] flex items-center justify-center shrink-0 shadow-lg shadow-orange-950/40">
                  <ShoppingBag className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-heading font-black text-white text-xl sm:text-2xl tracking-tight">
                      Petites Annonces TCM
                    </h2>
                    <span className="text-xs font-bold text-emerald-400 tabular-nums">
                      {activeCount} {activeCount > 1 ? 'disponibles' : 'disponible'}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                    Bourse au matériel entre adhérents · Chargement en direct depuis « Troc_Annonces »
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => loadAnnoncesLive()}
                  disabled={isLoading}
                  title="Recharger en direct depuis Google Sheets"
                  className="min-w-[44px] min-h-[44px] px-3 py-2.5 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-orange-400' : ''}`} />
                  <span className="hidden sm:inline">Actualiser</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsFormOpen(true)}
                  className="min-h-[44px] flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#BF360C] to-[#E65100] hover:brightness-110 text-white text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-orange-950/50 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span>Déposer une annonce</span>
                </button>
              </div>
            </div>

            {/* Barre de recherche et filtres */}
            <div className="flex flex-col sm:flex-row gap-3">
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

              <button
                type="button"
                onClick={() => setShowSold((v) => !v)}
                className={`min-h-[44px] px-3.5 py-2.5 rounded-xl border text-xs font-bold transition cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 ${
                  showSold
                    ? 'bg-orange-500/15 border-orange-500/40 text-orange-300'
                    : 'bg-[#0b0e14] border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{showSold ? 'Masquer vendus' : 'Afficher vendus'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {['Toutes', ...CATEGORIES].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategorie(cat)}
                  className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition cursor-pointer ${
                    selectedCategorie === cat
                      ? 'bg-[#E65100] text-white shadow-md shadow-orange-950/40'
                      : 'bg-[#0b0e14] border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
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

      {/* ==================== ONGLET 3 : MES ANNONCES / FAVORIS ==================== */}
      {subTab === 'mes_annonces' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Section 1 : Mes Favoris */}
          <section className="space-y-4">
            <div className="bg-[#141820] border border-[#252b37] rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <Heart className="w-5 h-5 fill-rose-500 text-rose-500" />
                </div>
                <div>
                  <h2 className="font-heading font-black text-white text-lg">
                    Mes Favoris ({favoriteAnnonces.length})
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Annonces sauvegardées sur cet appareil · Cliquez sur le cœur rouge pour retirer
                  </p>
                </div>
              </div>
            </div>

            {favoriteAnnonces.length === 0 ? (
              <div className="bg-[#141820] border border-[#252b37] rounded-3xl p-6 sm:p-8 text-center space-y-3">
                <p className="text-sm font-bold text-white">Aucun favori enregistré pour le moment</p>
                <p className="text-xs text-zinc-400 max-w-md mx-auto">
                  Parcourez les petites annonces et cliquez sur l'icône Cœur pour retrouver vos articles favoris ici.
                </p>
                <button
                  type="button"
                  onClick={() => setSubTab('annonces')}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold cursor-pointer"
                >
                  Voir les petites annonces
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {favoriteAnnonces.map((annonce) => renderAnnonceCard(annonce))}
              </div>
            )}
          </section>

          {/* Section 2 : Mes Annonces déposées */}
          <section className="space-y-4">
            <div className="bg-[#141820] border border-[#252b37] rounded-3xl p-4 sm:p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-[#FF6D00] shrink-0">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-heading font-black text-white text-lg">
                      Mes Annonces déposées ({myAnnonces.length})
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Passez vos articles en « Vendu » ou supprimez-les directement dans « Troc_Annonces »
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsFormOpen(true)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white text-xs font-black inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>Déposer une annonce</span>
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
          </section>
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

                {goSportOffres.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-[#0b0e14] border border-zinc-800 text-center text-xs text-zinc-400">
                    Aucun produit dans « Partenaire_GOSport ». Cliquez sur « Ajouter un produit » pour créer la première offre.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {goSportOffres.map((o) => (
                      <div
                        key={o.id}
                        className="p-3.5 rounded-2xl bg-[#0b0e14] border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-white text-sm truncate">{o.nomProduit}</span>
                            {o.excluClub && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-400 text-zinc-950 text-[10px] font-black uppercase">
                                Exclu Club
                              </span>
                            )}
                          </div>
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
                    ))}
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

                {/* Photo */}
                <div className="p-3.5 rounded-2xl bg-[#0b0e14] border border-zinc-800 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-orange-400" />
                      <span>Photo du produit</span>
                    </label>
                    <input
                      ref={gsFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleGsPhotoChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isCompressingGsPhoto}
                      onClick={() => gsFileInputRef.current?.click()}
                      className="min-h-[44px] px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                    >
                      {isCompressingGsPhoto ? (
                        <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
                      ) : (
                        <Camera className="w-4 h-4 text-orange-400" />
                      )}
                      <span>{isCompressingGsPhoto ? 'Compression...' : 'Importer photo'}</span>
                    </button>
                  </div>

                  {gsPhotoUrl && gsPhotoUrl.startsWith('data:image') ? (
                    <div className="relative h-28 rounded-xl overflow-hidden border border-zinc-700">
                      <img src={gsPhotoUrl} alt="Aperçu" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setGsPhotoUrl('')}
                        className="min-w-[44px] min-h-[44px] absolute top-1.5 right-1.5 rounded-xl bg-black/75 text-white flex items-center justify-center cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <input
                      type="url"
                      inputMode="url"
                      value={gsPhotoUrl}
                      onChange={(e) => setGsPhotoUrl(e.target.value)}
                      placeholder="Ou collez une URL d'image (https://...)"
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[#141820] border border-zinc-700 text-white placeholder-zinc-500 text-base sm:text-xs focus:border-[#FF6D00] focus:outline-none"
                    />
                  )}
                </div>

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

              <div className="p-3.5 rounded-2xl bg-[#0b0e14] border border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-orange-400" />
                    <span>Photo (optionnelle)</span>
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isCompressingPhoto}
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[44px] px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                  >
                    {isCompressingPhoto ? (
                      <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
                    ) : (
                      <Camera className="w-4 h-4 text-orange-400" />
                    )}
                    <span>{isCompressingPhoto ? 'Compression...' : 'Prendre / choisir photo'}</span>
                  </button>
                </div>

                {photoUrl && photoUrl.startsWith('data:image') ? (
                  <div className="relative h-32 rounded-xl overflow-hidden border border-zinc-700">
                    <img src={photoUrl} alt="Aperçu" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      className="min-w-[44px] min-h-[44px] absolute top-1.5 right-1.5 rounded-xl bg-black/75 text-white flex items-center justify-center cursor-pointer"
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
                    placeholder="Ou collez un lien d'image (https://...)"
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[#141820] border border-zinc-700 text-white placeholder-zinc-500 text-base sm:text-xs focus:border-[#FF6D00] focus:outline-none"
                  />
                )}
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
                  disabled={isSubmitting || isCompressingPhoto}
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

      {/* Lightbox photo */}
      {lightboxPhoto && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setLightboxPhoto(null)}
          className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
        >
          <div className="relative max-w-2xl w-full space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between text-white">
              <span className="font-heading font-bold text-sm truncate pr-4">{lightboxPhoto.titre}</span>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="min-w-[44px] min-h-[44px] rounded-xl bg-zinc-800 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={lightboxPhoto.url}
              alt={lightboxPhoto.titre}
              referrerPolicy="no-referrer"
              className="w-full max-h-[80vh] object-contain rounded-2xl border border-zinc-700 bg-black"
            />
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
    </div>
  );
};

