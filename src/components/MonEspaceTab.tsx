import React, { useState, useEffect, useMemo } from 'react';
import {
  KeyRound,
  Mail,
  ShieldCheck,
  UserCheck,
  FileText,
  Trophy,
  Download,
  Loader2,
  LogOut,
  AlertTriangle,
  Lock,
  CheckCircle2,
  ExternalLink,
  Phone,
  MessageSquare,
  MapPin,
  Calendar,
  Clock,
  Users,
  Save,
  Check,
  RefreshCw,
  ArrowLeft,
  CreditCard,
} from 'lucide-react';
import { Adherent, AdherentSession, ClubInfo, Rencontre } from '../types/tennis';
import {
  licencesMatch,
  logoutAdherentSessionRemote,
  normalizeEmailKey,
  normalizeLicenceKey,
  requestAdherentOtp,
  updateMinorParentRemote,
  verifyAdherentOtp,
} from '../services/adherentPortal';
import {
  buildAttestationPdfFile,
  computeDeterministicAttestationPricing,
} from '../utils/attestationUtils';
import { parseDateToJs } from '../utils/dateUtils';
import { AttestationDocument } from './AttestationDocument';

type EspaceSubTab = 'fiche' | 'attestation' | 'convocations';

interface MonEspaceTabProps {
  adherents: Adherent[];
  rencontres: Rencontre[];
  clubInfo: ClubInfo;
  saison: string;
  gasUrl: string;
  session: AdherentSession | null;
  onSessionChange: (session: AdherentSession | null) => void;
  onUpdateMinorParentLocal: (licence: string, representantLegal: string) => void;
  onRefreshData?: () => Promise<void> | void;
  isLoadingData?: boolean;
}

interface PlayerConvocationItem {
  rencontre: Rencontre;
  roleLabel: string;
  slotKey?: string;
  isSubstitute: boolean;
  isValidated: boolean;
  dateObj: Date | null;
  isPast: boolean;
  dateDisplay: string;
  heureDebut: string;
  heureRotation?: string;
  lieuDisplay: string;
  isHome: boolean;
  opponentName: string;
  mapsUrl?: string;
  teammates: { poste: string; nomPrenom: string }[];
}

export const MonEspaceTab: React.FC<MonEspaceTabProps> = ({
  adherents,
  rencontres,
  clubInfo,
  saison,
  gasUrl,
  session,
  onSessionChange,
  onUpdateMinorParentLocal,
  onRefreshData,
  isLoadingData = false,
}) => {
  // Étapes d'authentification
  const [licenceInput, setLicenceInput] = useState<string>('');
  const [otpStep, setOtpStep] = useState<'licence' | 'code'>('licence');
  const [otpCode, setOtpCode] = useState<string>('');
  const [maskedEmail, setMaskedEmail] = useState<string>('');
  const [cooldownSec, setCooldownSec] = useState<number>(0);
  const [rememberDevice, setRememberDevice] = useState<boolean>(true);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);

  // Navigation interne une fois connecté
  const [activeSubTab, setActiveSubTab] = useState<EspaceSubTab>('fiche');
  const [selectedLicence, setSelectedLicence] = useState<string>('');

  // Édition unique du représentant légal (mineur uniquement)
  const [parentInput, setParentInput] = useState<string>('');
  const [isSavingParent, setIsSavingParent] = useState<boolean>(false);
  const [parentFeedback, setParentFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Génération PDF
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfFeedback, setPdfFeedback] = useState<string | null>(null);
  const [showPastConvocations, setShowPastConvocations] = useState<boolean>(false);

  // Décompte anti-spam renvoi de code
  useEffect(() => {
    if (cooldownSec <= 0) return;
    const timer = setInterval(() => {
      setCooldownSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSec]);

  // Résolution des profils familiaux liés à l'e-mail vérifié
  const familyProfiles = useMemo(() => {
    if (!session) return [];
    const allowedLics = session.familyLicences || [];
    const verifiedEmail = normalizeEmailKey(session.verifiedEmail);

    const matched = adherents.filter((a) => {
      const aMail = normalizeEmailKey(a.email);
      const licOk = allowedLics.some((l) => licencesMatch(a.licence, l));
      return licOk || (verifiedEmail && aMail === verifiedEmail);
    });

    // Déduplication et priorité au n° de licence utilisé à la connexion
    const seen = new Set<string>();
    const unique: Adherent[] = [];
    for (const a of matched) {
      const key = normalizeLicenceKey(a.licence) || a.id;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(a);
    }

    unique.sort((a, b) => {
      const aPrimary = licencesMatch(a.licence, session.verifiedLicence) ? 0 : 1;
      const bPrimary = licencesMatch(b.licence, session.verifiedLicence) ? 0 : 1;
      if (aPrimary !== bPrimary) return aPrimary - bPrimary;
      return (a.nomPrenom || '').localeCompare(b.nomPrenom || '', 'fr');
    });

    return unique;
  }, [adherents, session]);

  // Sélection par défaut du profil actif
  useEffect(() => {
    if (!session) {
      setSelectedLicence('');
      return;
    }
    if (familyProfiles.length > 0) {
      const stillValid = familyProfiles.some((p) =>
        licencesMatch(p.licence, selectedLicence)
      );
      if (!stillValid) {
        setSelectedLicence(familyProfiles[0].licence || '');
      }
    }
  }, [session, familyProfiles, selectedLicence]);

  const activeProfile: Adherent | null = useMemo(() => {
    if (familyProfiles.length === 0) return null;
    const found = familyProfiles.find((p) =>
      licencesMatch(p.licence, selectedLicence)
    );
    return found || familyProfiles[0];
  }, [familyProfiles, selectedLicence]);

  // Synchroniser le champ parent lors du changement de profil familial
  useEffect(() => {
    setParentInput(activeProfile?.representantLegal || '');
    setParentFeedback(null);
    setPdfFeedback(null);
  }, [activeProfile?.id, activeProfile?.licence, activeProfile?.representantLegal]);

  const pricing = useMemo(() => {
    if (!activeProfile) return null;
    return computeDeterministicAttestationPricing(activeProfile, clubInfo, saison);
  }, [activeProfile, clubInfo, saison]);

  // Calcul des convocations d'équipe du profil actif
  const { upcomingConvocations, pastConvocations } = useMemo(() => {
    if (!activeProfile) {
      return { upcomingConvocations: [] as PlayerConvocationItem[], pastConvocations: [] as PlayerConvocationItem[] };
    }

    const pId = activeProfile.id;
    const pLic = normalizeLicenceKey(activeProfile.licence);
    const pName = (activeProfile.nomPrenom || '').trim().toLowerCase();

    const matchesPlayer = (candidate?: string | null): boolean => {
      if (!candidate) return false;
      const raw = String(candidate).trim();
      if (!raw) return false;
      if (raw === pId) return true;
      if (pLic && licencesMatch(raw, pLic)) return true;
      if (pName && raw.toLowerCase() === pName) return true;
      return false;
    };

    const resolvePlayerName = (candidateId?: string): string => {
      if (!candidateId) return '';
      const found = adherents.find(
        (a) =>
          a.id === candidateId ||
          (a.licence && normalizeLicenceKey(a.licence) === normalizeLicenceKey(candidateId))
      );
      return found ? found.nomPrenom : candidateId;
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const items: PlayerConvocationItem[] = [];

    for (const r of rencontres) {
      const comp = r.composition;
      if (!comp) continue;

      let roleLabel = '';
      let slotKey: string | undefined;
      let isSubstitute = false;

      // 1. Vérifier frozenPlayers en priorité
      const frozenSlot = (comp.frozenPlayers || []).find(
        (fp) =>
          matchesPlayer(fp.adherentId) ||
          matchesPlayer(fp.licence) ||
          matchesPlayer(fp.nomPrenom)
      );
      if (frozenSlot) {
        roleLabel = frozenSlot.poste || 'Titulaire';
        const lp = roleLabel.toLowerCase();
        if (lp.includes('simple 1') || lp === 's1') slotKey = 'S1';
        else if (lp.includes('simple 2') || lp === 's2') slotKey = 'S2';
        else if (lp.includes('simple 3') || lp === 's3') slotKey = 'S3';
        else if (lp.includes('simple 4') || lp === 's4') slotKey = 'S4';
        else if (lp.includes('simple 5') || lp === 's5') slotKey = 'S5';
        else if (lp.includes('double 1')) slotKey = 'D1';
        else if (lp.includes('double 2')) slotKey = 'D2';
      }

      // 2. Sinon vérifier les emplacements directs
      if (!roleLabel) {
        if (matchesPlayer(comp.simple1Id)) {
          roleLabel = 'Simple 1';
          slotKey = 'S1';
        } else if (matchesPlayer(comp.simple2Id)) {
          roleLabel = 'Simple 2';
          slotKey = 'S2';
        } else if (matchesPlayer(comp.simple3Id)) {
          roleLabel = 'Simple 3';
          slotKey = 'S3';
        } else if (matchesPlayer(comp.simple4Id)) {
          roleLabel = 'Simple 4';
          slotKey = 'S4';
        } else if (matchesPlayer(comp.simple5Id)) {
          roleLabel = 'Simple 5';
          slotKey = 'S5';
        } else if (matchesPlayer(comp.double1Player1Id) || matchesPlayer(comp.double1Player2Id)) {
          roleLabel = 'Double 1';
          slotKey = 'D1';
        } else if (matchesPlayer(comp.double2Player1Id) || matchesPlayer(comp.double2Player2Id)) {
          roleLabel = 'Double 2';
          slotKey = 'D2';
        } else if ((comp.remplacantIds || []).some((id) => matchesPlayer(id))) {
          roleLabel = 'Remplaçant(e)';
          isSubstitute = true;
        }
      }

      if (!roleLabel) continue;

      // Liste publique des coéquipiers (noms et postes uniquement)
      const teammatesMap = new Map<string, { poste: string; nomPrenom: string }>();
      (comp.frozenPlayers || []).forEach((fp) => {
        if (fp.nomPrenom) {
          teammatesMap.set(`${fp.poste}-${fp.nomPrenom}`, {
            poste: fp.poste,
            nomPrenom: fp.nomPrenom,
          });
        }
      });
      if (teammatesMap.size === 0) {
        const directSlots: [string, string | undefined][] = [
          ['Simple 1', comp.simple1Id],
          ['Simple 2', comp.simple2Id],
          ['Simple 3', comp.simple3Id],
          ['Simple 4', comp.simple4Id],
          ['Simple 5', comp.simple5Id],
          ['Double 1', comp.double1Player1Id],
          ['Double 1', comp.double1Player2Id],
          ['Double 2', comp.double2Player1Id],
          ['Double 2', comp.double2Player2Id],
        ];
        directSlots.forEach(([pLabel, cid]) => {
          const name = resolvePlayerName(cid);
          if (name) {
            teammatesMap.set(`${pLabel}-${name}`, { poste: pLabel, nomPrenom: name });
          }
        });
      }

      const dateDisplay = comp.dateRencontreValidee || r.dateRencontre;
      const dateObj = parseDateToJs(dateDisplay);
      const scoreLower = (r.score || '').toLowerCase();
      const hasScore =
        scoreLower !== '' &&
        !scoreLower.includes('jouer') &&
        !scoreLower.includes('avenir') &&
        !scoreLower.includes('à venir');

      const isPast = Boolean(hasScore || (dateObj && dateObj.getTime() < today.getTime()));

      const isHome = (r.clubAccueilNom || '').toLowerCase().includes('muzillac');
      const opponentName = isHome ? r.clubVisiteurNom : r.clubAccueilNom;

      const installAddr = [
        r.adresse1Installation,
        r.adresse2Installation,
        r.codePostalInstallation,
        r.villeInstallation,
      ]
        .filter(Boolean)
        .join(' ');

      const lieuDisplay =
        comp.lieuRencontre ||
        (isHome ? 'Complexe du Clos des Moines, Muzillac' : installAddr || r.clubAccueilNom);

      const mapsQuery = isHome
        ? `${clubInfo.adresse || 'Complexe du Clos des Moines'}, ${clubInfo.codePostal || '56190'} ${clubInfo.ville || 'Muzillac'}`
        : installAddr || r.clubAccueilNom;

      const heureDebut = comp.heureDebut || '09:00';
      const heureRotation =
        slotKey && comp.heuresRotations ? comp.heuresRotations[slotKey] : undefined;

      items.push({
        rencontre: r,
        roleLabel,
        slotKey,
        isSubstitute,
        isValidated: Boolean(comp.valideParCapitaine || comp.joueursValides),
        dateObj,
        isPast,
        dateDisplay,
        heureDebut,
        heureRotation,
        lieuDisplay,
        isHome,
        opponentName,
        mapsUrl: mapsQuery
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`
          : undefined,
        teammates: Array.from(teammatesMap.values()),
      });
    }

    const upcoming = items
      .filter((i) => !i.isPast)
      .sort((a, b) => (a.dateObj?.getTime() || 0) - (b.dateObj?.getTime() || 0));

    const past = items
      .filter((i) => i.isPast)
      .sort((a, b) => (b.dateObj?.getTime() || 0) - (a.dateObj?.getTime() || 0));

    return { upcomingConvocations: upcoming, pastConvocations: past };
  }, [activeProfile, rencontres, adherents, clubInfo]);

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError(null);
    setAuthInfo(null);

    const cleanLic = normalizeLicenceKey(licenceInput);
    if (!cleanLic || cleanLic.length < 4) {
      setAuthError('Veuillez saisir votre numéro de licence FFT.');
      return;
    }

    setAuthLoading(true);
    try {
      const res = await requestAdherentOtp(cleanLic, gasUrl);
      if (!res.success) {
        setAuthError(res.error || "Impossible d'envoyer le code de vérification.");
        return;
      }
      setMaskedEmail(res.maskedEmail || 'votre adresse e-mail');
      setOtpStep('code');
      setOtpCode('');
      setCooldownSec(60);
      setAuthInfo(
        `Un code unique à 6 chiffres vient d'être envoyé à ${res.maskedEmail || 'votre messagerie'} (valable 10 minutes).`
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthInfo(null);

    setAuthLoading(true);
    try {
      const res = await verifyAdherentOtp(licenceInput, otpCode, gasUrl);
      if (!res.success || !res.session) {
        setAuthError(res.error || 'Code de vérification invalide ou expiré.');
        return;
      }
      onSessionChange({
        ...res.session,
        rememberDevice,
      });
      setSelectedLicence(res.session.verifiedLicence);
      setActiveSubTab('fiche');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    if (session?.sessionToken) {
      void logoutAdherentSessionRemote(session.sessionToken, gasUrl);
    }
    onSessionChange(null);
    setOtpStep('licence');
    setOtpCode('');
    setAuthError(null);
    setAuthInfo(null);
    setPdfFeedback(null);
    setParentFeedback(null);
  };

  const handleSaveMinorParent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfile || !session || !pricing?.isMinor) return;
    setParentFeedback(null);

    const cleaned = parentInput.trim().replace(/^[=+\-@]+/, '');
    if (!cleaned) {
      setParentFeedback({
        type: 'error',
        message: 'Veuillez saisir le nom et le prénom du parent ou représentant légal.',
      });
      return;
    }

    setIsSavingParent(true);
    try {
      const res = await updateMinorParentRemote(
        activeProfile.licence,
        session.sessionToken,
        cleaned,
        gasUrl
      );
      if (!res.success) {
        setParentFeedback({
          type: 'error',
          message:
            res.error || "Impossible d'enregistrer sur Google Sheets pour le moment.",
        });
        return;
      }
      onUpdateMinorParentLocal(activeProfile.licence, cleaned);
      setParentInput(cleaned);
      setParentFeedback({
        type: 'success',
        message: 'Représentant légal enregistré pour votre attestation.',
      });
    } finally {
      setIsSavingParent(false);
    }
  };

  const handleDownloadAttestation = async () => {
    if (!activeProfile || !pricing || activeProfile.soldeDu < 0) return;
    setIsGeneratingPdf(true);
    setPdfFeedback(null);
    try {
      const built = await buildAttestationPdfFile(
        activeProfile.nomPrenom,
        'adherent-attestation-printable-card'
      );
      if (!built) {
        setPdfFeedback("Impossible de préparer le document d'attestation.");
        return;
      }
      built.pdf.save(built.fileName);
      setPdfFeedback(`Attestation PDF "${built.fileName}" téléchargée.`);
    } catch {
      setPdfFeedback('Erreur lors de la génération du PDF. Veuillez réessayer.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // ============================================================================
  // 1. VUE NON CONNECTÉE : AUTHENTIFICATION SÉCURISÉE N° LICENCE + OTP E-MAIL
  // ============================================================================
  if (!session) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Colonne gauche : Présentation claire des 3 services */}
          <div className="lg:col-span-5 bg-[#141820] border border-[#252b37] rounded-3xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Accès Personnel Sécurisé</span>
              </div>

              <h1 className="font-heading font-black text-white text-2xl sm:text-3xl tracking-tight leading-tight">
                Mon Espace Adhérent
              </h1>

              <p className="text-sm text-zinc-400 leading-relaxed">
                Connectez-vous avec votre numéro de licence FFT et le code unique envoyé à
                l&apos;adresse e-mail enregistrée sur votre compte Ten&apos;Up / TCM.
              </p>

              <div className="space-y-3 pt-2 border-t border-zinc-800/80">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 text-orange-400 flex items-center justify-center shrink-0">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Fiche personnelle & foyer</p>
                    <p className="text-xs text-zinc-400">
                      Consultez votre licence, classement, cours et profils familiaux liés au même e-mail.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 text-emerald-400 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Attestation de paiement PDF</p>
                    <p className="text-xs text-zinc-400">
                      Téléchargement immédiat dès que votre compte est à jour (CSE, mutuelle, Pass&apos;Sport).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 text-amber-400 flex items-center justify-center shrink-0">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Convocations d&apos;équipe</p>
                    <p className="text-xs text-zinc-400">
                      Retrouvez vos matchs, horaires validés, terrains et coordonnées de votre capitaine.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800/80 text-xs text-zinc-500">
              <span>Problème de connexion ou e-mail non renseigné ? </span>
              <span className="text-zinc-300 font-medium">
                Contactez le bureau à {clubInfo.email || 'tennisclubmuzillac@gmail.com'}
              </span>
            </div>
          </div>

          {/* Colonne droite : Formulaire 2 étapes */}
          <div className="lg:col-span-7 bg-[#141820] border border-[#2b3342] rounded-3xl p-6 sm:p-8 flex flex-col justify-center">
            {otpStep === 'licence' ? (
              <form onSubmit={handleRequestOtp} className="space-y-5">
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    Étape 1 sur 2
                  </span>
                  <h2 className="font-heading font-black text-white text-xl">
                    Identifiez-vous avec votre n° de licence
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Saisissez le numéro figurant sur votre attestation FFT / Ten&apos;Up (avec ou sans la lettre finale).
                  </p>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="adherent-licence-input"
                    className="block text-xs font-bold text-zinc-300"
                  >
                    Numéro de licence FFT
                  </label>
                  <input
                    id="adherent-licence-input"
                    type="text"
                    value={licenceInput}
                    onChange={(e) => setLicenceInput(e.target.value.toUpperCase())}
                    placeholder="Ex : 1234567"
                    autoComplete="off"
                    className="w-full min-h-[48px] bg-[#0b0e14] border border-zinc-700 focus:border-[#FF6D00] rounded-2xl px-4 py-3 text-white font-mono tabular-nums text-base tracking-wider outline-none transition"
                  />
                </div>

                <label className="min-h-[44px] flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-[#0b0e14] border border-zinc-800 hover:border-zinc-700 cursor-pointer transition select-none">
                  <input
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={(e) => setRememberDevice(e.target.checked)}
                    className="w-4 h-4 accent-[#FF6D00] rounded cursor-pointer shrink-0"
                  />
                  <span className="text-xs text-zinc-300 leading-snug">
                    Rester connecté sur cet appareil <span className="text-zinc-500">(30 jours)</span>
                  </span>
                </label>

                {authError && (
                  <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-[#E65100] to-[#FF6D00] hover:brightness-110 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-950/50 transition cursor-pointer disabled:opacity-60"
                >
                  {authLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Vérification et envoi par e-mail...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>Recevoir mon code par e-mail</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOtpStep('licence');
                      setAuthError(null);
                      setAuthInfo(null);
                    }}
                    className="min-h-[44px] inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white transition cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Changer de n° de licence</span>
                  </button>
                  <span className="text-[11px] font-mono tabular-nums text-zinc-400">
                    Licence {normalizeLicenceKey(licenceInput)}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                    Étape 2 sur 2 · E-mail envoyé
                  </span>
                  <h2 className="font-heading font-black text-white text-xl">
                    Saisissez votre code à 6 chiffres
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Envoyé à <strong className="text-white">{maskedEmail}</strong> (pensez à
                    vérifier vos spams si besoin).
                  </p>
                </div>

                {authInfo && (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{authInfo}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <label
                    htmlFor="adherent-otp-input"
                    className="block text-xs font-bold text-zinc-300"
                  >
                    Code de vérification (6 chiffres)
                  </label>
                  <input
                    id="adherent-otp-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••"
                    className="w-full min-h-[54px] bg-[#0b0e14] border border-zinc-700 focus:border-[#FF6D00] rounded-2xl px-4 py-3 text-white font-mono tabular-nums text-center text-2xl tracking-[0.4em] outline-none transition"
                  />
                </div>

                <label className="min-h-[44px] flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-[#0b0e14] border border-zinc-800 hover:border-zinc-700 cursor-pointer transition select-none">
                  <input
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={(e) => setRememberDevice(e.target.checked)}
                    className="w-4 h-4 accent-[#FF6D00] rounded cursor-pointer shrink-0"
                  />
                  <span className="text-xs text-zinc-300 leading-snug">
                    Rester connecté sur cet appareil <span className="text-zinc-500">(30 jours)</span>
                  </span>
                </label>

                {authError && (
                  <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="submit"
                    disabled={authLoading || otpCode.length !== 6}
                    className="flex-1 min-h-[48px] rounded-2xl bg-gradient-to-r from-[#E65100] to-[#FF6D00] hover:brightness-110 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-950/50 transition cursor-pointer disabled:opacity-50"
                  >
                    {authLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Validation...</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        <span>Accéder à mon espace</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={authLoading || cooldownSec > 0}
                    onClick={() => handleRequestOtp()}
                    className="min-h-[48px] px-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    {cooldownSec > 0 ? `Renvoyer (${cooldownSec}s)` : 'Renvoyer un code'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 2. SESSION ACTIVE MAIS PROFIL NON TROUVÉ DANS LES DONNÉES LOCALES
  // ============================================================================
  if (!activeProfile || !pricing) {
    return (
      <div className="max-w-3xl mx-auto bg-[#141820] border border-[#252b37] rounded-3xl p-6 sm:p-8 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
        <h2 className="font-heading font-black text-white text-lg">
          Profil adhérent en cours de synchronisation
        </h2>
        <p className="text-sm text-zinc-400">
          Votre session est bien validée ({session.maskedEmail}), mais la liste des adhérents
          n&apos;a pas encore été chargée sur cet appareil.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          {onRefreshData && (
            <button
              type="button"
              onClick={() => onRefreshData()}
              disabled={isLoadingData}
              className="min-h-[44px] px-5 rounded-2xl bg-[#FF6D00] hover:brightness-110 text-white font-bold text-sm flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingData ? 'animate-spin' : ''}`} />
              <span>Actualiser les données</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="min-h-[44px] px-5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-sm cursor-pointer"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  const isSoldeOk = activeProfile.soldeDu >= 0;
  const adresseComplete =
    [
      activeProfile.adresse,
      activeProfile.codePostal || clubInfo.codePostal || '56190',
      activeProfile.ville || clubInfo.ville || 'Muzillac',
    ]
      .filter(Boolean)
      .join(', ') || 'Muzillac (56190)';

  const officialSignataireNom = clubInfo.signataireNom || clubInfo.president || 'Raphaël EVAIN';
  const officialSignataireFonction = clubInfo.signataireFonction || 'Président du TCM';
  const dateJourStr = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // ============================================================================
  // 3. ESPACE PERSONNEL CONNECTÉ
  // ============================================================================
  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fadeIn">
      {/* Bandeau Identité & Déconnexion */}
      <div className="bg-[#141820] border border-[#252b37] rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-emerald-400">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Espace vérifié · {session.maskedEmail}</span>
              <span className="text-zinc-500 font-medium">
                · {session.rememberDevice !== false ? 'Appareil mémorisé (30 j)' : 'Session temporaire'}
              </span>
            </div>
            <h1 className="font-heading font-black text-white text-xl sm:text-2xl tracking-tight truncate">
              {activeProfile.nomPrenom}
            </h1>
            <p className="text-xs text-zinc-400 font-mono tabular-nums flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>Licence {activeProfile.licence || 'Non renseignée'}</span>
              <span>·</span>
              <span>Saison {saison}</span>
              <span>·</span>
              <span>Classement {activeProfile.dernierClassTennis || 'NC'}</span>
              {pricing.isMinor && (
                <>
                  <span>·</span>
                  <span className="text-amber-300 font-sans font-semibold">Adhérent mineur</span>
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onRefreshData && (
              <button
                type="button"
                onClick={() => onRefreshData()}
                disabled={isLoadingData}
                className="min-h-[44px] px-3.5 rounded-2xl bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Actualiser</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="min-h-[44px] px-3.5 rounded-2xl bg-zinc-900 hover:bg-rose-950/50 border border-zinc-700 hover:border-rose-500/40 text-zinc-300 hover:text-rose-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Déconnexion</span>
            </button>
          </div>
        </div>

        {/* Sélecteur de profils familiaux lorsque plusieurs fiches partagent le même e-mail */}
        {familyProfiles.length > 1 && (
          <div className="pt-3 border-t border-zinc-800/80 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Profils liés à votre adresse e-mail ({familyProfiles.length})
            </p>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {familyProfiles.map((prof) => {
                const isSelected = prof.id === activeProfile.id;
                const profPricing = computeDeterministicAttestationPricing(prof, clubInfo, saison);
                return (
                  <button
                    key={prof.id}
                    type="button"
                    onClick={() => setSelectedLicence(prof.licence)}
                    className={`min-h-[44px] px-3.5 py-2 rounded-2xl border text-left transition shrink-0 cursor-pointer flex items-center gap-2.5 ${
                      isSelected
                        ? 'bg-orange-500/15 border-orange-500/50 text-white'
                        : 'bg-[#0b0e14] border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold leading-tight whitespace-nowrap">
                        {prof.nomPrenom}
                      </p>
                      <p className="text-[10px] opacity-80 font-mono tabular-nums whitespace-nowrap">
                        {prof.licence || 'Sans licence'}
                        {profPricing.isMinor ? ' · Mineur' : ''}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Navigation interne des 3 volets */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-800/80">
          <button
            type="button"
            onClick={() => setActiveSubTab('fiche')}
            className={`min-h-[44px] px-3 py-2 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
              activeSubTab === 'fiche'
                ? 'bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white shadow-md shadow-orange-950/40'
                : 'bg-[#0b0e14] text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            <UserCheck className="w-4 h-4 shrink-0" />
            <span className="truncate">Ma Fiche</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('attestation')}
            className={`min-h-[44px] px-3 py-2 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
              activeSubTab === 'attestation'
                ? 'bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white shadow-md shadow-orange-950/40'
                : 'bg-[#0b0e14] text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span className="truncate">Attestation PDF</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('convocations')}
            className={`min-h-[44px] px-3 py-2 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
              activeSubTab === 'convocations'
                ? 'bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white shadow-md shadow-orange-950/40'
                : 'bg-[#0b0e14] text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            <Trophy className="w-4 h-4 shrink-0" />
            <span className="truncate">Convocations</span>
            {upcomingConvocations.length > 0 && (
              <span className="font-mono tabular-nums text-[11px] font-black px-1.5 py-0.5 rounded-md bg-black/30">
                {upcomingConvocations.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* VOLET 1 : MA FICHE PERSO (LECTURE SEULE)                             */}
      {/* ==================================================================== */}
      {activeSubTab === 'fiche' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-[#141820] border border-[#252b37] rounded-3xl p-5 sm:p-6 space-y-4">
            <h2 className="font-heading font-black text-white text-base border-b border-zinc-800 pb-3">
              Identité & Licence FFT
            </h2>

            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-400">Nom complet</dt>
                <dd className="text-white font-bold text-right">{activeProfile.nomPrenom}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-400">Date de naissance</dt>
                <dd className="text-white font-mono tabular-nums text-right">
                  {activeProfile.dateNaissance || 'Non renseignée'}
                  {pricing.ageSportif !== null && (
                    <span className="text-zinc-400 font-sans text-xs ml-1.5">
                      ({pricing.ageSportif} ans)
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-400">Licence FFT</dt>
                <dd className="text-white font-mono tabular-nums text-right">
                  {activeProfile.licence || 'Aucune'} ·{' '}
                  <span className="text-zinc-300 font-sans">
                    {activeProfile.millesimeLicence || saison}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-400">Classement actuel / Meilleur</dt>
                <dd className="text-white font-mono tabular-nums text-right">
                  {activeProfile.dernierClassTennis || 'NC'} /{' '}
                  {activeProfile.meilleurClassTennis || activeProfile.dernierClassTennis || 'NC'}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-400">Compte Ten&apos;Up</dt>
                <dd
                  className={`font-semibold text-right ${
                    (activeProfile.compteTenUp || '').toLowerCase().includes('cré')
                      ? 'text-emerald-400'
                      : 'text-amber-300'
                  }`}
                >
                  {activeProfile.compteTenUp || 'Non renseigné'}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-400">Adresse</dt>
                <dd className="text-zinc-200 text-right max-w-[60%]">{adresseComplete}</dd>
              </div>
              {pricing.isMinor && (
                <div className="flex justify-between gap-4 pt-2 border-t border-zinc-800/80">
                  <dt className="text-zinc-400">Représentant légal</dt>
                  <dd className="text-white font-semibold text-right">
                    {activeProfile.representantLegal || 'À renseigner dans Attestation'}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="bg-[#141820] border border-[#252b37] rounded-3xl p-5 sm:p-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <h2 className="font-heading font-black text-white text-base border-b border-zinc-800 pb-3">
                Inscription & Solde Club
              </h2>

              {/* Statut financier clair */}
              <div
                className={`p-4 rounded-2xl border ${
                  isSoldeOk
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-rose-500/10 border-rose-500/35'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Situation du compte
                  </span>
                  <span
                    className={`font-mono tabular-nums font-black text-lg ${
                      isSoldeOk ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {activeProfile.soldeDu === 0
                      ? '0,00 € · À jour'
                      : activeProfile.soldeDu > 0
                        ? `+${activeProfile.soldeDu.toFixed(2).replace('.', ',')} €`
                        : `${activeProfile.soldeDu.toFixed(2).replace('.', ',')} € dû`}
                  </span>
                </div>
                <p className="text-xs text-zinc-300 mt-1.5">
                  {isSoldeOk
                    ? 'Votre compte est à jour : votre attestation de paiement PDF est disponible.'
                    : `Un solde de ${Math.abs(activeProfile.soldeDu).toFixed(2).replace('.', ',')} € reste à régler pour débloquer votre attestation PDF.`}
                </p>
              </div>

              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-400">Formule / Cours</dt>
                  <dd className="text-white font-semibold text-right">
                    {activeProfile.groupeEnseignement || 'Pratique libre'}
                  </dd>
                </div>
                {activeProfile.badge && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-400">Badge d&apos;accès courts</dt>
                    <dd className="text-zinc-200 font-mono tabular-nums text-right">
                      {activeProfile.badge}
                    </dd>
                  </div>
                )}
                {activeProfile.ticketsRestants && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-400">Tickets invités restants</dt>
                    <dd className="text-zinc-200 font-mono tabular-nums text-right">
                      {activeProfile.ticketsRestants}
                    </dd>
                  </div>
                )}
                {activeProfile.nbReservationsAnnee && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-400">Réservations année en cours</dt>
                    <dd className="text-zinc-200 font-mono tabular-nums text-right">
                      {activeProfile.nbReservationsAnnee}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="pt-3 border-t border-zinc-800/80 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveSubTab('attestation')}
                className="flex-1 min-h-[44px] px-4 rounded-2xl bg-[#FF6D00] hover:brightness-110 text-white text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>
                  {isSoldeOk ? 'Accéder à mon attestation PDF' : 'Voir le statut attestation'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* VOLET 2 : MON ATTESTATION PDF (VERROUILLÉE SI SOLDE < 0)            */}
      {/* ==================================================================== */}
      {activeSubTab === 'attestation' && (
        <div className="space-y-4">
          {!isSoldeOk ? (
            /* Cas 1 : Compte non à jour -> Accès bloqué + solution de paiement */
            <div className="bg-[#141820] border border-rose-500/40 rounded-3xl p-6 sm:p-8 space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
                  <Lock className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="font-heading font-black text-white text-lg sm:text-xl">
                    Attestation bloquée : compte non à jour
                  </h2>
                  <p className="text-sm text-zinc-300">
                    Le téléchargement de l&apos;attestation officielle de paiement est réservé aux
                    comptes dont la cotisation est intégralement réglée.
                  </p>
                  <p className="text-sm font-bold text-rose-400 font-mono tabular-nums pt-1">
                    Solde restant dû au club :{' '}
                    {Math.abs(activeProfile.soldeDu).toFixed(2).replace('.', ',')} €
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#0b0e14] border border-zinc-800 space-y-2 text-xs text-zinc-300">
                <p className="font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-orange-400" />
                  <span>Comment régulariser votre cotisation ?</span>
                </p>
                <p>
                  {clubInfo.modalitesPaiement ||
                    "Paiement possible par CB via HelloAsso, chèque, virement, chèques vacances ANCV ou Pass'Sport."}
                </p>
                {clubInfo.tresorier && (
                  <p className="text-zinc-400">
                    Contact Trésorerie : <strong className="text-zinc-200">{clubInfo.tresorier}</strong>
                    {clubInfo.tresorierEmail ? ` · ${clubInfo.tresorierEmail}` : ''}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                {clubInfo.helloAssoUrl && (
                  <a
                    href={clubInfo.helloAssoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] px-5 rounded-2xl bg-[#FF6D00] hover:brightness-110 text-white text-xs font-black inline-flex items-center gap-2 transition"
                  >
                    <span>Régler en ligne sur HelloAsso</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <a
                  href={`mailto:${clubInfo.tresorierEmail || clubInfo.email || 'tennisclubmuzillac@gmail.com'}?subject=${encodeURIComponent(
                    `Régularisation solde cotisation - ${activeProfile.nomPrenom} (Licence ${activeProfile.licence})`
                  )}`}
                  className="min-h-[44px] px-5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold inline-flex items-center gap-2 transition"
                >
                  <Mail className="w-4 h-4" />
                  <span>Contacter le trésorier</span>
                </a>
              </div>
            </div>
          ) : !pricing.hasActiveRegistration ? (
            /* Cas 2 : Solde à 0 mais profil sans licence / sans inscription (ex: parent non joueur) */
            <div className="bg-[#141820] border border-amber-500/35 rounded-3xl p-6 sm:p-8 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <h2 className="font-heading font-black text-white text-lg">
                    Aucune cotisation ou licence active sur ce profil
                  </h2>
                  <p className="text-sm text-zinc-300">
                    Le profil <strong>{activeProfile.nomPrenom}</strong> ne comporte pas de licence
                    FFT ni d&apos;inscription en cours pour la saison {saison}.
                    {familyProfiles.length > 1 &&
                      ' Sélectionnez le profil de votre enfant ci-dessus pour télécharger son attestation.'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Cas 3 : Compte à jour et inscription valide -> Attestation PDF verrouillée + parent mineur modifiable */
            <>
              <div className="bg-[#141820] border border-[#252b37] rounded-3xl p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Compte à jour · Attestation prête</span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Formule retenue :{' '}
                      <strong className="text-zinc-200">
                        {pricing.formulaType === 'cours'
                          ? 'Cours collectifs (adhésion incluse)'
                          : 'Cotisation club seule'}
                      </strong>{' '}
                      · Total officiel :{' '}
                      <strong className="text-white font-mono tabular-nums">
                        {pricing.totalPercu} € TTC
                      </strong>{' '}
                      <span className="text-zinc-500">(montants verrouillés par le club)</span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadAttestation}
                    disabled={isGeneratingPdf}
                    className="min-h-[48px] px-5 rounded-2xl bg-gradient-to-r from-[#E65100] to-[#FF6D00] hover:brightness-110 text-white text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-orange-950/50 transition cursor-pointer disabled:opacity-60 shrink-0"
                  >
                    {isGeneratingPdf ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Génération PDF...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Télécharger mon attestation PDF</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Unique champ modifiable : Représentant légal si adhérent mineur */}
                {pricing.isMinor && (
                  <form
                    onSubmit={handleSaveMinorParent}
                    className="pt-4 border-t border-zinc-800/80 space-y-2.5"
                  >
                    <label
                      htmlFor="minor-parent-input"
                      className="block text-xs font-bold text-zinc-300"
                    >
                      Nom & Prénom du parent / représentant légal (adhérent mineur)
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input
                        id="minor-parent-input"
                        type="text"
                        value={parentInput}
                        onChange={(e) => setParentInput(e.target.value)}
                        placeholder="Ex : Prénom NOM du parent payeur"
                        className="flex-1 min-h-[44px] bg-[#0b0e14] border border-zinc-700 focus:border-[#FF6D00] rounded-2xl px-4 py-2 text-sm text-white outline-none transition"
                      />
                      <button
                        type="submit"
                        disabled={isSavingParent}
                        className="min-h-[44px] px-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 shrink-0"
                      >
                        {isSavingParent ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 text-orange-400" />
                        )}
                        <span>Enregistrer le représentant légal</span>
                      </button>
                    </div>
                    {parentFeedback && (
                      <p
                        className={`text-xs flex items-center gap-1.5 ${
                          parentFeedback.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {parentFeedback.type === 'success' ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        )}
                        <span>{parentFeedback.message}</span>
                      </p>
                    )}
                  </form>
                )}

                {pdfFeedback && (
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
                    {pdfFeedback}
                  </div>
                )}
              </div>

              {/* Aperçu fidèle A4 */}
              <div className="bg-zinc-200 rounded-3xl p-3 sm:p-6 overflow-x-auto">
                <div className="mx-auto w-full max-w-2xl">
                  <AttestationDocument
                  id="adherent-attestation-printable-card"
                  adherent={activeProfile}
                  clubInfo={clubInfo}
                  birthYear={pricing.birthYear}
                  adresseAdherent={adresseComplete}
                  representantLegal={pricing.isMinor ? parentInput : ''}
                  isMinor={pricing.isMinor}
                  formulaType={pricing.formulaType}
                  partClub={pricing.partClub}
                  licenceFft={pricing.licenceFft}
                  totalPercu={pricing.totalPercu}
                  signataireFormule="Je soussigné"
                  signataireNom={officialSignataireNom}
                  signataireFonction={officialSignataireFonction}
                  signatureUrl={clubInfo.signatureUrl}
                  dateJourStr={dateJourStr}
                />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* VOLET 3 : MES CONVOCATIONS D'ÉQUIPE                                  */}
      {/* ==================================================================== */}
      {activeSubTab === 'convocations' && (
        <div className="space-y-4">
          {upcomingConvocations.length === 0 && pastConvocations.length === 0 ? (
            <div className="bg-[#141820] border border-[#252b37] rounded-3xl p-8 text-center space-y-2">
              <Trophy className="w-10 h-10 text-zinc-600 mx-auto" />
              <h2 className="font-heading font-black text-white text-base">
                Aucune convocation d&apos;équipe enregistrée
              </h2>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Dès qu&apos;un capitaine vous intégrera dans la composition d&apos;une rencontre
                interclubs, tous les détails (horaire, lieu, coéquipiers) apparaîtront ici.
              </p>
            </div>
          ) : (
            <>
              {upcomingConvocations.length > 0 && (
                <div className="space-y-3">
                  <h2 className="font-heading font-black text-white text-base px-1">
                    Prochaines convocations ({upcomingConvocations.length})
                  </h2>

                  {upcomingConvocations.map((item) => (
                    <ConvocationCard key={item.rencontre.id} item={item} />
                  ))}
                </div>
              )}

              {pastConvocations.length > 0 && (
                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPastConvocations((v) => !v)}
                    className="min-h-[44px] w-full sm:w-auto px-4 py-2 rounded-2xl bg-[#141820] border border-[#252b37] text-xs font-bold text-zinc-300 hover:text-white transition cursor-pointer"
                  >
                    {showPastConvocations
                      ? `Masquer l'historique (${pastConvocations.length})`
                      : `Voir les rencontres passées (${pastConvocations.length})`}
                  </button>

                  {showPastConvocations && (
                    <div className="space-y-3">
                      {pastConvocations.map((item) => (
                        <ConvocationCard key={item.rencontre.id} item={item} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

const ConvocationCard: React.FC<{ item: PlayerConvocationItem }> = ({ item }) => {
  const { rencontre: r } = item;
  const capitaineNom = [r.prenomCapitaine, r.nomCapitaine].filter(Boolean).join(' ').trim();

  return (
    <div
      className={`bg-[#141820] border rounded-3xl p-5 space-y-4 ${
        item.isPast ? 'border-zinc-800/80 opacity-85' : 'border-[#2b3342]'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`font-bold ${
                item.isValidated ? 'text-emerald-400' : 'text-amber-300'
              }`}
            >
              {item.isValidated ? 'Convocation validée' : 'Composition prévisionnelle'}
            </span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-300 font-semibold">
              {r.numeroEquipe} ({r.sexeHomologation})
            </span>
            {r.division && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-400">{r.division}</span>
              </>
            )}
          </div>

          <h3 className="font-heading font-black text-white text-base sm:text-lg">
            {item.isHome ? `Domicile vs ${item.opponentName}` : `Déplacement chez ${item.opponentName}`}
          </h3>

          <p className="text-xs text-zinc-400">{r.libelleHomologation}</p>
        </div>

        <div className="shrink-0 text-left sm:text-right space-y-0.5">
          <p className="text-xs text-zinc-400">Poste attribué</p>
          <p className="text-sm font-black text-orange-400">{item.roleLabel}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-zinc-800/80 text-xs">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-zinc-200">
            <Calendar className="w-4 h-4 text-orange-400 shrink-0" />
            <span className="font-mono tabular-nums font-bold">{item.dateDisplay}</span>
            {r.score && item.isPast && (
              <span className="text-zinc-400">· Score : {r.score}</span>
            )}
          </div>

          <div className="flex items-center gap-2 text-zinc-200">
            <Clock className="w-4 h-4 text-orange-400 shrink-0" />
            <span>
              Rendez-vous équipe :{' '}
              <strong className="font-mono tabular-nums text-white">{item.heureDebut}</strong>
              {item.heureRotation && (
                <span className="text-emerald-400 font-mono tabular-nums ml-2">
                  (Votre match : {item.heureRotation})
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-start gap-2 text-zinc-200">
            <MapPin className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>{item.lieuDisplay}</p>
              {item.mapsUrl && (
                <a
                  href={item.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-orange-400 hover:text-orange-300 font-bold"
                >
                  <span>Ouvrir l&apos;itinéraire</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Coéquipiers & Capitaine */}
      <div className="pt-3 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-2 text-zinc-300 min-w-0">
          <Users className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="text-zinc-400">Équipe convoquée : </span>
            <span className="text-zinc-200">
              {item.teammates.map((t) => `${t.nomPrenom} (${t.poste})`).join(' · ')}
            </span>
          </div>
        </div>

        {capitaineNom && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <span className="text-zinc-400">
              Cap. <strong className="text-zinc-200">{capitaineNom}</strong>
            </span>
            {r.portableCapitaine && (
              <>
                <a
                  href={`tel:${r.portableCapitaine.replace(/\s+/g, '')}`}
                  className="min-h-[36px] px-2.5 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold inline-flex items-center gap-1 transition"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Appeler</span>
                </a>
                <a
                  href={`sms:${r.portableCapitaine.replace(/\s+/g, '')}`}
                  className="min-h-[36px] px-2.5 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold inline-flex items-center gap-1 transition"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-orange-400" />
                  <span>SMS</span>
                </a>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
