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
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  TrocAnnonce,
  TrocCategorie,
  TrocEtat,
  UserRole,
} from '../types/tennis';
import {
  fetchTrocAnnoncesLive,
  saveTrocAnnonceToSheet,
  updateTrocStatutInSheet,
  TCM_APPS_SCRIPT_URL,
} from '../services/googleSheets';
import { getAccessToken } from '../services/auth';

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
  // AUCUN CACHE PERSISTANT (localStorage) : état strictement en mémoire vive, rechargé en direct à chaque ouverture
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
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; titre: string } | null>(null);
  const [brokenPhotos, setBrokenPhotos] = useState<Record<string, boolean>>({});

  // Champs du formulaire d'ajout
  const [titre, setTitre] = useState('');
  const [categorie, setCategorie] = useState<TrocCategorie>('Raquettes');
  const [taillePointure, setTaillePointure] = useState('');
  const [etat, setEtat] = useState<TrocEtat>('Très bon état');
  const [prix, setPrix] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [contactNom, setContactNom] = useState('');
  const [contactTel, setContactTel] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Chargement en direct systématique à chaque montage / ouverture de l'onglet
  useEffect(() => {
    loadAnnoncesLive();
  }, [loadAnnoncesLive]);

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
    setContactNom('');
    setContactTel('');
    setContactEmail('');
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
      setIsFormOpen(false);
      resetForm();
      setFormSuccessMsg("Annonce publiée en direct dans l'onglet Google Sheet « Troc_Annonces ».");
      setTimeout(() => setFormSuccessMsg(null), 5000);
      await loadAnnoncesLive();
    } else {
      setFormError(res.error || "Échec de l'enregistrement de l'annonce.");
    }
  };

  const handleChangeStatut = async (annonce: TrocAnnonce, nouveauStatut: 'Disponible' | 'Vendu' | 'Supprimé') => {
    setUpdatingId(annonce.id);
    const res = await updateTrocStatutInSheet(annonce.id, nouveauStatut, gasUrl || TCM_APPS_SCRIPT_URL);
    setUpdatingId(null);
    if (res.success) {
      await loadAnnoncesLive();
    } else {
      setLoadError(res.error || "Impossible de mettre à jour le statut de l'annonce.");
    }
  };

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

  return (
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
                <h1 className="font-heading font-black text-white text-xl sm:text-2xl tracking-tight">
                  Troc & Occasions TCM
                </h1>
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

      {/* Confirmation de publication */}
      {formSuccessMsg && (
        <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-2xl p-4 text-emerald-200 text-xs sm:text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{formSuccessMsg}</span>
        </div>
      )}

      {/* Bannière erreur / script Apps Script à redéployer */}
      {loadError && (
        <div className="bg-rose-500/15 border border-rose-500/40 rounded-3xl p-4 sm:p-5 text-rose-200 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1 space-y-1">
              <h3 className="font-heading font-black text-white text-sm sm:text-base">
                Synchronisation « Troc_Annonces » requise
              </h3>
              <p className="text-xs sm:text-sm text-rose-200/90 leading-relaxed">
                {loadError}
              </p>
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

      {/* État de chargement */}
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
        /* Grille mobile-first de cartes empilées verticalement */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAnnonces.map((annonce) => {
            const isSold = annonce.statut.toLowerCase() === 'vendu';
            const photoInvalid = !annonce.photoUrl || brokenPhotos[annonce.id];
            const isUpdating = updatingId === annonce.id;

            return (
              <article
                key={annonce.id}
                className={`bg-[#141820] border rounded-3xl overflow-hidden shadow-xl flex flex-col transition ${
                  isSold ? 'border-zinc-800/80 opacity-75' : 'border-[#252b37] hover:border-orange-500/40'
                }`}
              >
                {/* Photo ou visuel de secours */}
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

                  {/* Prix tabulaire & statut */}
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

                {/* Corps carte lisible mobile */}
                <div className="p-4 flex-1 flex flex-col justify-between gap-3.5">
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-[#FF6D00] uppercase tracking-wide">
                      {annonce.categorie} · {annonce.etat}
                    </p>
                    <h2 className="font-heading font-black text-white text-base sm:text-lg leading-snug">
                      {annonce.titre}
                    </h2>
                    <p className="text-xs text-zinc-300">
                      Taille / Pointure : <strong className="text-white">{annonce.taillePointure}</strong>
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      Publiée le {annonce.datePublication} · Vendeur : <span className="text-zinc-300 font-semibold">{annonce.contactNom}</span>
                    </p>
                  </div>

                  {/* Boutons de contact tactile >= 44px */}
                  <div className="space-y-2 pt-3 border-t border-zinc-800/80">
                    {!isSold && (
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
                            href={`mailto:${annonce.contactEmail}?subject=${encodeURIComponent(`[TCM Troc] ${annonce.titre}`)}`}
                            className={`min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-300 text-xs font-bold transition whitespace-nowrap ${
                              !annonce.contactTel ? 'col-span-2' : 'col-span-2'
                            }`}
                          >
                            <Mail className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{annonce.contactEmail}</span>
                          </a>
                        )}
                      </div>
                    )}

                    {/* Gestion statut annonce */}
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

                      {(userRole === 'admin' || userRole === 'bureau') && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleChangeStatut(annonce, 'Supprimé')}
                          title="Retirer l'annonce"
                          aria-label="Retirer l'annonce"
                          className="min-w-[44px] min-h-[44px] px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 flex items-center justify-center transition cursor-pointer disabled:opacity-50 shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ==================== MODALE / SHEET D'AJOUT D'ANNONCE ==================== */}
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
                    Déposer une annonce Troc
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

              {/* Photo : appareil photo mobile ou URL */}
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

              {/* Contact vendeur */}
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
    </div>
  );
};
