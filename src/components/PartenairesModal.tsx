import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Upload,
  ExternalLink,
  Sparkles,
  Link2,
} from 'lucide-react';
import { PartenaireLogo, PartenaireRole } from '../types/tennis';
import {
  savePartenaireToSheet,
  deletePartenaireInSheet,
  TCM_APPS_SCRIPT_URL,
} from '../services/googleSheets';
import {
  DEFAULT_PARTNER_LOGOS,
  compressLogoSourceToBase64,
  normalizePartnerSiteUrl,
} from '../utils/partnerLogos';

interface PartenairesModalProps {
  isOpen: boolean;
  onClose: () => void;
  partenaires: PartenaireLogo[];
  gasUrl?: string;
  onRefreshPartenaires: () => Promise<void>;
  defaultRole?: PartenaireRole;
}

const ROLE_LABELS: Record<string, string> = {
  boutique: 'Boutique Officielle (ProShop)',
  offre_magasin: 'Offre Magasin (ProShop)',
  club: 'Partenaire Club (Infos Club)',
};

export const PartenairesModal: React.FC<PartenairesModalProps> = ({
  isOpen,
  onClose,
  partenaires,
  gasUrl,
  onRefreshPartenaires,
  defaultRole = 'club',
}) => {
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [role, setRole] = useState<string>(defaultRole);
  const [logoUrl, setLogoUrl] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [ordre, setOrdre] = useState('1');
  const [actif, setActif] = useState(true);

  const [isSaving, setIsSaving] = useState(false);
  const [isSeedingDefaults, setIsSeedingDefaults] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [quickLinkId, setQuickLinkId] = useState<string | null>(null);
  const [quickLinkValue, setQuickLinkValue] = useState('');
  const [isSavingQuickLink, setIsSavingQuickLink] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || typeof document === 'undefined') return null;

  const activeUrl = gasUrl || TCM_APPS_SCRIPT_URL;

  const resetForm = () => {
    setEditingId(null);
    setNom('');
    setRole(defaultRole);
    setLogoUrl('');
    setSiteUrl('');
    setOrdre(String(partenaires.length + 1));
    setActif(true);
    setErrorMsg(null);
  };

  const openCreate = () => {
    resetForm();
    setView('form');
  };

  const openEdit = (p: PartenaireLogo) => {
    setEditingId(p.id);
    setNom(p.nom);
    setRole(p.role || 'club');
    setLogoUrl(p.logoUrl || '');
    setSiteUrl(p.siteUrl || '');
    setOrdre(String(p.ordre ?? 1));
    setActif(p.actif !== false);
    setErrorMsg(null);
    setView('form');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsCompressing(true);
    setErrorMsg(null);
    try {
      const compressed = await compressLogoSourceToBase64(file);
      setLogoUrl(compressed);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Impossible de compresser ce logo.');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!nom.trim()) {
      setErrorMsg('Le nom du partenaire est obligatoire.');
      return;
    }
    if (!logoUrl.trim()) {
      setErrorMsg('Veuillez importer un logo ou coller une URL.');
      return;
    }

    const normalizedSite = normalizePartnerSiteUrl(siteUrl);

    setIsSaving(true);
    const res = await savePartenaireToSheet(
      {
        id: editingId || undefined,
        nom: nom.trim(),
        role,
        logoUrl: logoUrl.trim(),
        siteUrl: normalizedSite || undefined,
        ordre: Number(ordre) || 1,
        actif,
      },
      activeUrl
    );
    setIsSaving(false);

    if (res.success) {
      await onRefreshPartenaires();
      setView('list');
      resetForm();
      setSuccessMsg('Logo enregistré dans l’onglet « Partenaires » du Google Sheet.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg(res.error || 'Échec de l’enregistrement dans Google Sheets.');
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setErrorMsg(null);
    const res = await deletePartenaireInSheet(id, activeUrl);
    setDeletingId(null);
    if (res.success) {
      await onRefreshPartenaires();
      setSuccessMsg('Partenaire supprimé de l’onglet « Partenaires ».');
      setTimeout(() => setSuccessMsg(null), 3500);
    } else {
      setErrorMsg(res.error || 'Impossible de supprimer ce partenaire.');
    }
  };

  const handleSyncThreeProShopLogos = async () => {
    setIsSeedingDefaults(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const defaults = [
        DEFAULT_PARTNER_LOGOS.gosport,
        DEFAULT_PARTNER_LOGOS.mizuno,
        DEFAULT_PARTNER_LOGOS.wilson,
      ];
      for (const item of defaults) {
        const existing = partenaires.find(
          (p) =>
            p.id.toLowerCase() === item.id.toLowerCase() ||
            p.nom.trim().toLowerCase() === item.nom.trim().toLowerCase()
        );
        const compressedLogo = await compressLogoSourceToBase64(item.logoUrl);
        const res = await savePartenaireToSheet(
          {
            id: existing?.id || item.id,
            nom: existing?.nom || item.nom,
            role: existing?.role || item.role,
            logoUrl: compressedLogo,
            siteUrl: existing?.siteUrl || undefined,
            ordre: existing?.ordre ?? item.ordre,
            actif: existing ? existing.actif : true,
          },
          activeUrl
        );
        if (!res.success) {
          throw new Error(res.error || `Erreur lors de l'enregistrement de ${item.nom}`);
        }
      }
      await onRefreshPartenaires();
      setSuccessMsg('Les 3 logos (GO Sport Muzillac, Mizuno, Wilson) sont enregistrés dans le Google Sheet.');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors de la synchronisation des logos.');
    } finally {
      setIsSeedingDefaults(false);
    }
  };

  const openQuickLinkEditor = (p: PartenaireLogo) => {
    if (quickLinkId === p.id) {
      setQuickLinkId(null);
      setQuickLinkValue('');
      return;
    }
    setQuickLinkId(p.id);
    setQuickLinkValue(p.siteUrl || '');
    setErrorMsg(null);
  };

  const handleSaveQuickLink = async (p: PartenaireLogo, nextRawUrl: string) => {
    const normalized = normalizePartnerSiteUrl(nextRawUrl);
    setIsSavingQuickLink(true);
    setErrorMsg(null);
    const res = await savePartenaireToSheet(
      {
        id: p.id,
        nom: p.nom,
        role: p.role,
        logoUrl: p.logoUrl,
        siteUrl: normalized || undefined,
        ordre: p.ordre ?? 1,
        actif: p.actif !== false,
      },
      activeUrl
    );
    setIsSavingQuickLink(false);

    if (res.success) {
      await onRefreshPartenaires();
      setQuickLinkId(null);
      setQuickLinkValue('');
      setSuccessMsg(
        normalized
          ? `Lien cliquable enregistré pour ${p.nom}.`
          : `Lien cliquable retiré pour ${p.nom}.`
      );
      setTimeout(() => setSuccessMsg(null), 3500);
    } else {
      setErrorMsg(res.error || 'Impossible de mettre à jour le lien cliquable.');
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Gérer les logos et partenaires"
      onClick={onClose}
      className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-sm animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#141820] border-t sm:border border-orange-500/40 rounded-t-3xl sm:rounded-3xl p-4 sm:p-6 w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div>
            <h2 className="font-heading font-black text-white text-base sm:text-lg">
              Logos & Partenaires (Google Sheet)
            </h2>
            <p className="text-[11px] text-zinc-400">
              Synchronisation directe avec l'onglet « Partenaires »
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="min-w-[44px] min-h-[44px] rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {view === 'list' ? (
          <div className="space-y-4">
            {/* Synchronisation rapide des 3 logos ProShop vers le Google Sheet */}
            <div className="p-3.5 rounded-2xl bg-[#0b0e14] border border-orange-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#FF6D00]" />
                  <span>Logos ProShop (GO Sport Muzillac, Mizuno, Wilson)</span>
                </p>
                <p className="text-[11px] text-zinc-400">
                  Enregistrez ces 3 logos directement dans votre onglet Google Sheet « Partenaires ».
                </p>
              </div>
              <button
                type="button"
                disabled={isSeedingDefaults}
                onClick={handleSyncThreeProShopLogos}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-200 text-xs font-black inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {isSeedingDefaults ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span>{isSeedingDefaults ? 'Enregistrement...' : 'Enregistrer les 3 logos'}</span>
              </button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-zinc-400">
                {partenaires.length} {partenaires.length > 1 ? 'logos enregistrés' : 'logo enregistré'}
              </p>
              <button
                type="button"
                onClick={openCreate}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Ajouter un partenaire</span>
              </button>
            </div>

            {partenaires.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#0b0e14] border border-zinc-800 text-center text-xs text-zinc-400">
                Aucun logo enregistré dans l'onglet « Partenaires » pour le moment. Cliquez sur « Enregistrer les 3 logos » ou ajoutez vos partenaires du club.
              </div>
            ) : (
              <div className="space-y-2">
                {partenaires.map((p) => {
                  const safeSiteUrl = normalizePartnerSiteUrl(p.siteUrl);
                  const isEditingLink = quickLinkId === p.id;
                  return (
                    <div
                      key={p.id}
                      className="p-3 rounded-2xl bg-[#0b0e14] border border-zinc-800 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-16 h-12 rounded-xl bg-white p-1.5 flex items-center justify-center shrink-0 overflow-hidden">
                            {p.logoUrl ? (
                              <img
                                src={p.logoUrl}
                                alt={p.nom}
                                referrerPolicy="no-referrer"
                                className="max-w-full max-h-full object-contain"
                              />
                            ) : (
                              <span className="text-[10px] text-zinc-500 font-bold">Logo</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-white text-sm truncate">
                              {p.nom}
                              {!p.actif && (
                                <span className="ml-2 text-[10px] text-zinc-500 font-normal">(Masqué)</span>
                              )}
                            </p>
                            <p className="text-[11px] text-zinc-400 truncate">
                              {ROLE_LABELS[p.role] || p.role} · Ordre {p.ordre ?? 1}
                            </p>
                            {safeSiteUrl ? (
                              <a
                                href={safeSiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-[#FF6D00] hover:underline inline-flex items-center gap-1 truncate max-w-full"
                              >
                                <ExternalLink className="w-3 h-3 shrink-0" />
                                <span className="truncate">{safeSiteUrl}</span>
                              </a>
                            ) : (
                              <span className="text-[11px] text-zinc-500 inline-block">
                                Aucun lien cliquable
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => openQuickLinkEditor(p)}
                            title={safeSiteUrl ? 'Modifier le lien cliquable' : 'Ajouter un lien cliquable'}
                            className={`min-h-[40px] px-2.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition ${
                              isEditingLink
                                ? 'bg-[#E65100]/20 border-[#FF6D00]/50 text-[#FF6D00]'
                                : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200'
                            }`}
                          >
                            <Link2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Lien</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(p)}
                            aria-label={`Modifier ${p.nom}`}
                            title="Modifier ce partenaire"
                            className="min-w-[40px] min-h-[40px] rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-300 flex items-center justify-center cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === p.id}
                            onClick={() => handleDelete(p.id)}
                            aria-label={`Supprimer ${p.nom}`}
                            title="Supprimer ce partenaire"
                            className="min-w-[40px] min-h-[40px] rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 flex items-center justify-center cursor-pointer disabled:opacity-50"
                          >
                            {deletingId === p.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {isEditingLink && (
                        <div className="pt-2 border-t border-zinc-800/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <input
                            type="text"
                            inputMode="url"
                            value={quickLinkValue}
                            onChange={(e) => setQuickLinkValue(e.target.value)}
                            placeholder="https://site-du-partenaire.fr"
                            aria-label={`Lien cliquable pour ${p.nom}`}
                            className="flex-1 min-h-[40px] px-3 py-1.5 rounded-xl bg-[#141820] border border-zinc-700 text-white placeholder-zinc-500 text-xs focus:border-[#FF6D00] focus:outline-none"
                          />
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={isSavingQuickLink}
                              onClick={() => handleSaveQuickLink(p, quickLinkValue)}
                              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white text-xs font-black inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              {isSavingQuickLink ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              <span>Valider</span>
                            </button>
                            {safeSiteUrl && (
                              <button
                                type="button"
                                disabled={isSavingQuickLink}
                                onClick={() => handleSaveQuickLink(p, '')}
                                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-200 text-xs font-bold cursor-pointer disabled:opacity-50"
                              >
                                Retirer lien
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setQuickLinkId(null);
                                setQuickLinkValue('');
                              }}
                              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold cursor-pointer"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-black text-white text-sm">
                {editingId ? 'Modifier le partenaire' : 'Nouveau partenaire'}
              </h3>
              <button
                type="button"
                onClick={() => setView('list')}
                className="text-xs font-bold text-zinc-400 hover:text-white cursor-pointer"
              >
                ← Retour à la liste
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Nom du partenaire *
                </label>
                <input
                  type="text"
                  required
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="Ex : Crédit Agricole, Intermarché..."
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#0b0e14] border border-zinc-700 text-white placeholder-zinc-500 text-xs focus:border-[#FF6D00] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Emplacement dans l'appli *
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[#0b0e14] border border-zinc-700 text-white text-xs focus:border-[#FF6D00] focus:outline-none"
                >
                  <option value="club">Partenaire Club (onglet Infos Club)</option>
                  <option value="boutique">Boutique Officielle (ProShop)</option>
                  <option value="offre_magasin">Offre Magasin (ProShop)</option>
                </select>
              </div>
            </div>

            {/* Upload logo + aperçu */}
            <div className="p-3 rounded-2xl bg-[#0b0e14] border border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Logo (fichier compressé automatiquement pour GSheet) *
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isCompressing}
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isCompressing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-400" />
                  ) : (
                    <Upload className="w-3.5 h-3.5 text-orange-400" />
                  )}
                  <span>{isCompressing ? 'Compression...' : 'Choisir un fichier'}</span>
                </button>
              </div>

              {logoUrl && (
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-zinc-300">
                  <img
                    src={logoUrl}
                    alt={nom || 'Aperçu logo'}
                    className="h-12 max-w-[160px] object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => setLogoUrl('')}
                    className="ml-auto px-2.5 py-1 rounded-lg bg-zinc-900 text-white text-xs font-bold cursor-pointer"
                  >
                    Retirer
                  </button>
                </div>
              )}

              <input
                type="text"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="Ou coller un lien d'image (https://...)"
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#141820] border border-zinc-700 text-white placeholder-zinc-500 text-xs focus:border-[#FF6D00] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Lien cliquable / site web (optionnel)
                </label>
                <input
                  type="text"
                  inputMode="url"
                  value={siteUrl}
                  onChange={(e) => setSiteUrl(e.target.value)}
                  placeholder="https://... (ou www.partenaire.fr)"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#0b0e14] border border-zinc-700 text-white placeholder-zinc-500 text-xs focus:border-[#FF6D00] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Ordre
                </label>
                <input
                  type="number"
                  min="1"
                  value={ordre}
                  onChange={(e) => setOrdre(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#0b0e14] border border-zinc-700 text-white text-xs font-mono focus:border-[#FF6D00] focus:outline-none"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={actif}
                onChange={(e) => setActif(e.target.checked)}
                className="rounded border-zinc-600"
              />
              <span>Afficher ce partenaire dans l'application</span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setView('list')}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSaving || isCompressing}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white text-xs font-black flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{isSaving ? 'Enregistrement...' : 'Enregistrer'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
};
