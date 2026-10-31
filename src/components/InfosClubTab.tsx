import React, { useState } from 'react';
import { 
  MapPin, 
  Phone, 
  Mail, 
  ExternalLink, 
  Clock, 
  Sparkles, 
  FileSpreadsheet, 
  Code2, 
  Layers, 
  CheckCircle, 
  ShieldCheck, 
  Download, 
  Upload, 
  RefreshCw,
  Copy,
  Check,
  MessageSquare,
  AlertCircle
} from 'lucide-react';
import { ClubInfo } from '../types/tennis';
import { getNextFftMonthlyRankingRelease, getWeeklyScheduleInfo } from '../utils/fftCalendar';
import { GraduationCap, Euro, Edit3, Building, CreditCard } from 'lucide-react';
import { getAccessToken, googleSignIn } from '../services/auth';
import { saveClubInfoToSheet, TCM_DEFAULT_SHEET_ID } from '../services/googleSheets';

interface InfosClubTabProps {
  clubInfo: ClubInfo;
  onOpenScriptModal: () => void;
  onOpenGsheetModal?: () => void;
  onSyncWithUrl: (url: string) => Promise<boolean>;
  onResetData: () => void;
  isSyncing: boolean;
  syncError: string | null;
  lastSyncTime: string | null;
  onRefreshFromFile?: () => Promise<void> | void;
  isLoadingFile?: boolean;
  totalMembers?: number;
  onOpenEditClubModal?: () => void;
  isBureauMember?: boolean;
  isAdmin?: boolean;
}

export const InfosClubTab: React.FC<InfosClubTabProps> = ({
  clubInfo,
  onOpenScriptModal,
  onOpenGsheetModal,
  onSyncWithUrl,
  onResetData,
  isSyncing,
  syncError,
  lastSyncTime,
  onRefreshFromFile,
  isLoadingFile = false,
  totalMembers = 159,
  onOpenEditClubModal,
  isBureauMember = true,
  isAdmin = false,
}) => {
  const [gasUrl, setGasUrl] = useState('');
  const [copiedAddress, setCopiedAddress] = useState(false);
  const nextRanking = getNextFftMonthlyRankingRelease();
  const weeklyInfo = getWeeklyScheduleInfo();

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(`${clubInfo.adresse}, ${clubInfo.codePostal} ${clubInfo.ville}`);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const [isPushingDirect, setIsPushingDirect] = useState(false);
  const [directPushStatus, setDirectPushStatus] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const handleConnectGas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gasUrl.trim()) return;
    await onSyncWithUrl(gasUrl.trim());
  };

  const handleDirectPush = async () => {
    setIsPushingDirect(true);
    setDirectPushStatus(null);
    try {
      let token = await getAccessToken();
      if (!token) {
        setDirectPushStatus({
          type: 'info',
          text: 'Connexion Google requise pour écrire dans votre classeur...',
        });
        const authRes = await googleSignIn();
        if (authRes && authRes.accessToken) {
          token = authRes.accessToken;
        } else {
          setDirectPushStatus({
            type: 'error',
            text: 'Connexion Google annulée.',
          });
          setIsPushingDirect(false);
          return;
        }
      }

      setDirectPushStatus({
        type: 'info',
        text: 'Écriture en cours dans votre Google Sheet (Bureau_Profs, Installations, Cotisations_Tarifs)...',
      });

      const res = await saveClubInfoToSheet(clubInfo, TCM_DEFAULT_SHEET_ID, token);
      if (res.success) {
        setDirectPushStatus({
          type: 'success',
          text: '✓ Vos données actuelles du club ont été écrites avec succès dans votre Google Sheet !',
        });
        setTimeout(() => setDirectPushStatus(null), 5000);
      } else {
        setDirectPushStatus({
          type: 'error',
          text: `Erreur d'écriture : ${res.error || 'Vérifiez les permissions du classeur'}`,
        });
      }
    } catch (err: any) {
      console.error(err);
      setDirectPushStatus({
        type: 'error',
        text: `Erreur : ${err.message || "Échec d'envoi vers Google Sheets"}`,
      });
    } finally {
      setIsPushingDirect(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Bannière Présentation Muzillac Tennis Club */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1c212a] via-[#141820] to-[#0c0e12] border border-[#272e3b] p-6 sm:p-8 shadow-xl">
        <div className="absolute -right-10 -top-10 w-60 h-60 bg-gradient-to-br from-orange-600/15 to-transparent rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-orange-700/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-start space-x-4 sm:space-x-5">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[#BF360C] via-[#E65100] to-[#FF6D00] flex items-center justify-center font-heading font-black text-white text-2xl sm:text-3xl shadow-2xl shadow-orange-950/80 border border-orange-400/40 shrink-0">
              TCM
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#E65100]/25 text-[#FF6D00] border border-[#E65100]/40">
                  Affilié FFT
                </span>
                <span className="text-xs text-zinc-400">
                  Code : {clubInfo.codeClub}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-heading font-black text-white mt-1">
                {clubInfo.nom}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-xl">
                Comité Départemental de Tennis du Morbihan • Ligue de Bretagne de Tennis.
                Pratique loisir, école de tennis pour les jeunes et équipes en championnats officiels.
              </p>
            </div>
          </div>

          {/* Actions : Ten'Up Direct & Modifier données (si bureau) */}
          <div className="shrink-0 flex flex-col gap-2">
            <a
              href="https://tenup.fft.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center space-x-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-[#BF360C] via-[#E65100] to-[#FF6D00] hover:brightness-110 active:scale-95 text-white text-xs sm:text-sm font-black transition shadow-lg shadow-orange-950/60"
            >
              <span>Réserver sur Ten'Up</span>
              <ExternalLink className="w-4 h-4" />
            </a>

            {isBureauMember && onOpenEditClubModal && (
              <button
                onClick={onOpenEditClubModal}
                className="inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700 text-xs font-bold transition cursor-pointer shadow-sm"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#FF6D00]" />
                <span>Modifier les données du club</span>
              </button>
            )}

            {isBureauMember && (
              <button
                onClick={handleDirectPush}
                disabled={isPushingDirect}
                className="inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 hover:text-orange-300 border border-orange-500/40 text-xs font-bold transition cursor-pointer shadow-sm"
                title="Pousser immédiatement les informations actuelles vers Google Sheets"
              >
                <Upload className={`w-3.5 h-3.5 ${isPushingDirect ? 'animate-bounce' : ''}`} />
                <span>{isPushingDirect ? 'Écriture en cours...' : 'Pousser vers Google Sheets'}</span>
              </button>
            )}
            <span className="text-[10px] text-zinc-500 text-center">Accès adhérents TCM FFT</span>
          </div>
        </div>

        {/* Message d'état pour la synchronisation directe Google Sheets */}
        {directPushStatus && (
          <div className={`mt-4 p-3 rounded-2xl text-xs flex items-center space-x-2 border animate-fadeIn ${
            directPushStatus.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
              : directPushStatus.type === 'error'
              ? 'bg-rose-950/80 border-rose-500/50 text-rose-300'
              : 'bg-orange-950/80 border-orange-500/50 text-orange-200'
          }`}>
            {directPushStatus.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : directPushStatus.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <RefreshCw className="w-4 h-4 text-orange-400 animate-spin shrink-0" />
            )}
            <span className="font-medium">{directPushStatus.text}</span>
          </div>
        )}
      </div>

      {/* Grille : Enseignants & Bureau */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        
        {/* Enseignants Qualifiés */}
        <div className="bg-[#161a22] p-5 sm:p-6 rounded-3xl border border-[#252b37] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-orange-500/15 text-[#FF6D00] flex items-center justify-center font-bold">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-heading font-black text-white text-base">
                  Enseignants Professionnels ({clubInfo.enseignants?.length || 0})
                </h2>
                <p className="text-[11px] text-zinc-400">Équipe pédagogique homologuée FFT</p>
              </div>
            </div>
            {isBureauMember && onOpenEditClubModal && (
              <button
                onClick={onOpenEditClubModal}
                className="text-xs text-orange-400 hover:text-orange-300 font-semibold cursor-pointer"
              >
                Gérer
              </button>
            )}
          </div>

          <div className="space-y-3">
            {(!clubInfo.enseignants || clubInfo.enseignants.length === 0) ? (
              <p className="text-xs text-zinc-500 py-3 text-center italic">Aucun enseignant renseigné dans le classeur</p>
            ) : (
              clubInfo.enseignants.map((ens) => (
              <div
                key={ens.id}
                className="p-3.5 bg-[#11141a] rounded-2xl border border-zinc-800/80 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-heading font-black text-white text-sm">
                    {ens.nomPrenom}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                    ens.diplome.includes('DE') || ens.diplome.includes('État')
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}>
                    {ens.diplome}
                  </span>
                </div>
                {ens.description && (
                  <p className="text-[11px] text-zinc-400">{ens.description}</p>
                )}
                <div className="flex items-center gap-3 pt-1 text-xs text-zinc-400">
                  {ens.telephone && (
                    <a href={`tel:${ens.telephone}`} className="flex items-center gap-1 hover:text-white transition">
                      <Phone className="w-3 h-3 text-[#FF6D00]" />
                      <span>{ens.telephone}</span>
                    </a>
                  )}
                  {ens.email && (
                    <a href={`mailto:${ens.email}`} className="flex items-center gap-1 hover:text-white transition truncate">
                      <Mail className="w-3 h-3 text-[#FF6D00]" />
                      <span>{ens.email}</span>
                    </a>
                  )}
                </div>
              </div>
            )))}
          </div>

          <div className="pt-2 border-t border-[#232934] flex items-center justify-between text-xs text-zinc-400">
            <span>Permanences pédagogiques</span>
            <span className="text-orange-400 font-bold">
              {clubInfo.horairesPermanence || 'Mercredi après-midi & Samedi matin'}
            </span>
          </div>
        </div>

        {/* Bureau & Localisation */}
        <div className="bg-[#161a22] p-5 sm:p-6 rounded-3xl border border-[#252b37] shadow-sm space-y-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-500/15 text-[#FF6D00] flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-heading font-black text-white text-base">
                Bureau & Siège du Club
              </h2>
              <p className="text-[11px] text-zinc-400">Membres élus du TCM</p>
            </div>
          </div>

          {/* Adresse avec bouton copier */}
          <div className="p-3 bg-[#11141a] rounded-xl border border-[#232934] flex items-center justify-between">
            <div className="text-xs">
              <p className="font-semibold text-white">{clubInfo.adresse}</p>
              <p className="text-zinc-400">{clubInfo.codePostal} {clubInfo.ville}</p>
            </div>
            <button
              onClick={handleCopyAddress}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
              title="Copier l'adresse"
            >
              {copiedAddress ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Liste des contacts du bureau avec portable et mail */}
          <div className="space-y-2.5">
            {/* 1. Président */}
            <div className="p-3 bg-[#11141a] rounded-2xl border border-zinc-800/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#FF6D00] bg-orange-500/10 px-2 py-0.5 rounded-md border border-orange-500/20">
                  Président
                </span>
                <span className="font-heading font-black text-white text-xs sm:text-sm">
                  {clubInfo.president}
                </span>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-zinc-800/80 text-[11px] flex-wrap justify-between">
                {clubInfo.presidentTelephone && (
                  <div className="flex items-center gap-1.5">
                    <a
                      href={`tel:${clubInfo.presidentTelephone}`}
                      className="flex items-center gap-1 text-zinc-300 hover:text-emerald-400 font-medium transition"
                      title="Appeler le président"
                    >
                      <Phone className="w-3 h-3 text-emerald-400" />
                      <span>{clubInfo.presidentTelephone}</span>
                    </a>
                    <a
                      href={`sms:${clubInfo.presidentTelephone}`}
                      className="px-1.5 py-0.2 rounded text-[10px] bg-sky-500/15 text-sky-300 border border-sky-500/30 hover:bg-sky-500/25 transition font-bold"
                      title="Envoyer un SMS"
                    >
                      SMS
                    </a>
                  </div>
                )}
                {clubInfo.presidentEmail && (
                  <a
                    href={`mailto:${clubInfo.presidentEmail}`}
                    className="flex items-center gap-1 text-zinc-300 hover:text-orange-400 font-medium transition truncate max-w-[210px]"
                    title="Envoyer un email au président"
                  >
                    <Mail className="w-3 h-3 text-orange-400 shrink-0" />
                    <span className="truncate">{clubInfo.presidentEmail}</span>
                  </a>
                )}
              </div>
            </div>

            {/* 2. Secrétaire */}
            <div className="p-3 bg-[#11141a] rounded-2xl border border-zinc-800/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                  Secrétaire
                </span>
                <span className="font-heading font-black text-white text-xs sm:text-sm">
                  {clubInfo.secretaire}
                </span>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-zinc-800/80 text-[11px] flex-wrap justify-between">
                {clubInfo.secretaireTelephone && (
                  <div className="flex items-center gap-1.5">
                    <a
                      href={`tel:${clubInfo.secretaireTelephone}`}
                      className="flex items-center gap-1 text-zinc-300 hover:text-emerald-400 font-medium transition"
                      title="Appeler la secrétaire"
                    >
                      <Phone className="w-3 h-3 text-emerald-400" />
                      <span>{clubInfo.secretaireTelephone}</span>
                    </a>
                    <a
                      href={`sms:${clubInfo.secretaireTelephone}`}
                      className="px-1.5 py-0.2 rounded text-[10px] bg-sky-500/15 text-sky-300 border border-sky-500/30 hover:bg-sky-500/25 transition font-bold"
                      title="Envoyer un SMS"
                    >
                      SMS
                    </a>
                  </div>
                )}
                {clubInfo.secretaireEmail && (
                  <a
                    href={`mailto:${clubInfo.secretaireEmail}`}
                    className="flex items-center gap-1 text-zinc-300 hover:text-purple-400 font-medium transition truncate max-w-[210px]"
                    title="Envoyer un email à la secrétaire"
                  >
                    <Mail className="w-3 h-3 text-purple-400 shrink-0" />
                    <span className="truncate">{clubInfo.secretaireEmail}</span>
                  </a>
                )}
              </div>
            </div>

            {/* 3. Trésorier */}
            <div className="p-3 bg-[#11141a] rounded-2xl border border-zinc-800/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  Trésorier
                </span>
                <span className="font-heading font-black text-white text-xs sm:text-sm">
                  {clubInfo.tresorier}
                </span>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-zinc-800/80 text-[11px] flex-wrap justify-between">
                {clubInfo.tresorierTelephone && (
                  <div className="flex items-center gap-1.5">
                    <a
                      href={`tel:${clubInfo.tresorierTelephone}`}
                      className="flex items-center gap-1 text-zinc-300 hover:text-emerald-400 font-medium transition"
                      title="Appeler le trésorier"
                    >
                      <Phone className="w-3 h-3 text-emerald-400" />
                      <span>{clubInfo.tresorierTelephone}</span>
                    </a>
                    <a
                      href={`sms:${clubInfo.tresorierTelephone}`}
                      className="px-1.5 py-0.2 rounded text-[10px] bg-sky-500/15 text-sky-300 border border-sky-500/30 hover:bg-sky-500/25 transition font-bold"
                      title="Envoyer un SMS"
                    >
                      SMS
                    </a>
                  </div>
                )}
                {clubInfo.tresorierEmail && (
                  <a
                    href={`mailto:${clubInfo.tresorierEmail}`}
                    className="flex items-center gap-1 text-zinc-300 hover:text-emerald-400 font-medium transition truncate max-w-[210px]"
                    title="Envoyer un email au trésorier"
                  >
                    <Mail className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span className="truncate">{clubInfo.tresorierEmail}</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <a
              href={`mailto:${clubInfo.email}`}
              className="flex-1 py-2 px-3 rounded-xl bg-[#1d222b] hover:bg-orange-500/20 text-zinc-200 hover:text-[#FF6D00] border border-[#282f3d] hover:border-orange-500/40 text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>{clubInfo.email}</span>
            </a>

            <a
              href={`tel:${clubInfo.telephone}`}
              className="flex-1 py-2 px-3 rounded-xl bg-[#1d222b] hover:bg-emerald-500/20 text-zinc-200 hover:text-emerald-400 border border-[#282f3d] hover:border-emerald-500/40 text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>{clubInfo.telephone}</span>
            </a>
          </div>
        </div>

      </div>

      {/* Grille : Installations & Tarifs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        
        {/* Installations & Terrains */}
        <div className="bg-[#161a22] p-5 sm:p-6 rounded-3xl border border-[#252b37] shadow-sm space-y-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-500/15 text-[#FF6D00] flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <h2 className="font-heading font-black text-white text-base">
              Infrastructures & Terrains ({clubInfo.installations.length})
            </h2>
          </div>

          {(!clubInfo.installations || clubInfo.installations.length === 0) ? (
            <p className="text-xs text-zinc-500 py-3 italic">Aucune infrastructure renseignée dans le classeur</p>
          ) : (
            <ul className="space-y-3 text-xs sm:text-sm text-zinc-300">
              {clubInfo.installations.map((item, idx) => (
                <li key={idx} className="flex items-start space-x-2.5">
                  <span className="text-[#FF6D00] font-bold mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="pt-3 border-t border-[#232934] flex items-center justify-between text-xs text-zinc-400">
            <span>Accès sécurisé par badge</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              Courts ouverts 7j/7
            </span>
          </div>
        </div>

        {/* Tarifs & Cotisations */}
        <div className="bg-[#161a22] p-5 sm:p-6 rounded-3xl border border-[#252b37] shadow-sm space-y-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold">
              <Euro className="w-4 h-4" />
            </div>
            <h2 className="font-heading font-black text-white text-base">
              Cotisations & Formules 2026/2027 ({clubInfo.tarifs?.length || 0})
            </h2>
          </div>

          <div className="space-y-2.5 text-xs">
            {(!clubInfo.tarifs || clubInfo.tarifs.length === 0) ? (
              <p className="text-xs text-zinc-500 py-3 italic">Aucun tarif renseigné dans le classeur</p>
            ) : (
              clubInfo.tarifs.map((t) => (
              <div
                key={t.id}
                className="p-2.5 bg-[#11141a] rounded-xl border border-zinc-800/80 flex items-center justify-between gap-2"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white">{t.label}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border uppercase tracking-wider ${
                      t.categorie === 'adulte'
                        ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                        : t.categorie === 'adhesion'
                        ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                        : t.categorie === 'competition'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    }`}>
                      {t.categorie === 'adulte' 
                        ? 'Adulte' 
                        : t.categorie === 'adhesion' 
                        ? 'Adhésion' 
                        : t.categorie === 'competition' 
                        ? 'Compétition' 
                        : 'Jeune'}
                    </span>
                  </div>
                  {t.description && <p className="text-[10px] text-zinc-400">{t.description}</p>}
                </div>
                <span className="font-heading font-black text-[#FF6D00] text-sm shrink-0">
                  {t.montant} €
                </span>
              </div>
            )))}
          </div>

          {/* Modalités & Facilités de paiement (Échelonnement, Chèque, HelloAsso via Ten'Up, ANCV) */}
          <div className="pt-3 border-t border-[#232934] space-y-2.5">
            <div className="flex items-start gap-2">
              <CreditCard className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1">
                <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                  {clubInfo.modalitesPaiement || "Paiement échelonné possible par chèque et par CB via HelloAsso (directement sur Ten'Up avec le montant dans votre panier). Chèques vacances ANCV et Pass'Sport acceptés."}
                </p>

                {/* Badges des moyens de règlement acceptés */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700/80">
                    ✉️ Chèque échelonné
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    💳 CB via HelloAsso sur Ten'Up
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                    🎟️ ANCV & Pass'Sport
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Module 1 : Synchronisation Systématique du Fichier Réel TCM (Données_appli) - Uniquement visible par l'Admin */}
      {isAdmin && (
        <div className="bg-[#161a22] p-5 sm:p-6 rounded-3xl border border-orange-500/30 shadow-lg shadow-black/40 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#BF360C] via-[#E65100] to-[#FF6D00] text-white flex items-center justify-center shadow-lg shadow-orange-950/60 font-black">
                TCM
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-heading font-black text-white text-base">
                    Fichier Réel Connecté (Données_appli)
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    {totalMembers} adhérents en direct
                  </span>
                </div>
                <p className="text-xs text-zinc-400">
                  Lecture systématique et sans cache du fichier officiel <code className="text-orange-400 bg-black/40 px-1 py-0.5 rounded">Donn_es_appli_dad0017a</code>.
                </p>
              </div>
            </div>

            {onRefreshFromFile && (
              <button
                onClick={() => onRefreshFromFile()}
                disabled={isLoadingFile}
                className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#BF360C] to-[#E65100] hover:brightness-110 active:scale-95 text-white text-xs font-bold transition shadow-md shadow-orange-950/50 disabled:opacity-50 cursor-pointer self-start sm:self-auto"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingFile ? 'animate-spin' : ''}`} />
                <span>{isLoadingFile ? 'Lecture en cours...' : 'Recharger le fichier maintenant'}</span>
              </button>
            )}
          </div>

          {/* Grille explicative des 2 cycles indispensables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-[#11141a] rounded-2xl border border-[#232934] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
                  Cycle Hebdomadaire : Résultats & Rencontres
                </span>
                <span className="text-[10px] text-blue-300 font-semibold px-2 py-0.5 bg-blue-500/10 rounded-full border border-blue-500/20">
                  Chaque Lundi
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Dès que les matchs du week-end sont terminés, les résultats et scores sont mis à jour dans le fichier. L'application met à jour les victoires, défaites et classements de division.
              </p>
            </div>

            <div className="p-4 bg-[#11141a] rounded-2xl border border-orange-500/30 bg-orange-950/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E65100]"></span>
                  Cycle Mensuel : Nouveaux Classements FFT
                </span>
                <span className="text-[10px] text-orange-300 font-semibold px-2 py-0.5 bg-orange-500/20 rounded-full border border-orange-500/30">
                  1er mardi du mois
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                La FFT révise les échelons le premier mardi de chaque mois. Prochaine parution : <strong className="text-white">{nextRanking.formattedDate}</strong>.
              </p>
              <div className="p-2 bg-black/40 rounded-xl text-[10px] text-orange-200">
                ⚡ <strong>Impact Équipes :</strong> En cas de montée/descente, le classement de chaque joueur est actualisé et l'ordre des simples (Simple 1 &ge; Simple 2) est recalculé pour les rencontres suivantes.
              </div>
            </div>
          </div>

          {lastSyncTime && (
            <p className="text-[11px] text-emerald-400 font-medium">
              ✓ Dernière lecture réussie depuis le fichier : {lastSyncTime}
            </p>
          )}
        </div>
      )}

    </div>
  );
};
