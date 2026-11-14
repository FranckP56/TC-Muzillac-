import React, { useState } from 'react';
import { 
  MapPin, 
  Phone, 
  Mail, 
  Layers, 
  CheckCircle, 
  RefreshCw,
  Copy,
  Check,
  GraduationCap,
  Euro,
  Settings,
  CreditCard
} from 'lucide-react';
import { ClubInfo } from '../types/tennis';
import { getNextFftMonthlyRankingRelease } from '../utils/fftCalendar';

interface InfosClubTabProps {
  clubInfo: ClubInfo;
  onOpenScriptModal?: () => void;
  onOpenGsheetModal?: () => void;
  onSyncWithUrl?: (url: string) => Promise<boolean>;
  onResetData?: () => void;
  isSyncing?: boolean;
  syncError?: string | null;
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
  lastSyncTime,
  onRefreshFromFile,
  isLoadingFile = false,
  totalMembers = 159,
  onOpenEditClubModal,
  isBureauMember = true,
  isAdmin = false,
}) => {
  const [copiedAddress, setCopiedAddress] = useState(false);
  const nextRanking = getNextFftMonthlyRankingRelease();

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(`${clubInfo.adresse}, ${clubInfo.codePostal} ${clubInfo.ville}`);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Bannière Présentation Muzillac Tennis Club */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1c212a] via-[#141820] to-[#0c0e12] border border-[#272e3b] p-6 sm:p-8 shadow-xl">
        <div className="absolute -right-10 -top-10 w-60 h-60 bg-gradient-to-br from-orange-600/15 to-transparent rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-orange-700/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-start space-x-4 sm:space-x-5">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[#BF360C] via-[#E65100] to-[#FF6D00] flex items-center justify-center font-heading font-black text-white text-2xl sm:text-3xl shadow-2xl shadow-orange-950/80 border border-orange-400/40 shrink-0 overflow-hidden">
              {clubInfo.logoUrl ? (
                <img src={clubInfo.logoUrl} alt="Logo TCM" className="w-full h-full object-contain p-1" />
              ) : (
                'TCM'
              )}
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

          {/* Actions : Roue crantée de modification (si bureau) */}
          {isBureauMember && onOpenEditClubModal && (
            <div className="shrink-0 flex items-center justify-end">
              <button
                type="button"
                onClick={onOpenEditClubModal}
                aria-label="Modifier les données du club"
                title="Modifier les données du club"
                className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-2xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-[#FF6D00] border border-zinc-700 flex items-center justify-center transition cursor-pointer shadow-sm"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Grille : Enseignants & Bureau */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        
        {/* Enseignants Qualifiés */}
        <div className="bg-[#161a22] p-5 sm:p-6 rounded-3xl border border-[#252b37] shadow-sm space-y-4">
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
                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 pt-1 text-xs text-zinc-400">
                  {ens.telephone && (
                    <a
                      href={`tel:${ens.telephone.replace(/\s+/g, '')}`}
                      className="inline-flex items-center gap-1.5 hover:text-white transition whitespace-nowrap shrink-0"
                    >
                      <Phone className="w-3.5 h-3.5 text-[#FF6D00] shrink-0" />
                      <span className="tabular-nums">{ens.telephone}</span>
                    </a>
                  )}
                  {ens.email && (
                    <a
                      href={`mailto:${ens.email}`}
                      className="inline-flex items-center gap-1.5 hover:text-white transition whitespace-nowrap overflow-x-auto no-scrollbar max-w-full min-w-0"
                    >
                      <Mail className="w-3.5 h-3.5 text-[#FF6D00] shrink-0" />
                      <span>{ens.email}</span>
                    </a>
                  )}
                </div>
              </div>
            )))}
          </div>

          {clubInfo.permanencePedagogiqueVisible !== false && (clubInfo.horairesPermanence || clubInfo.permanencePedagogiqueLibelle) && (
            <div className="pt-2 border-t border-[#232934] flex items-center justify-between text-xs text-zinc-400">
              <span>{clubInfo.permanencePedagogiqueLibelle || 'Permanences pédagogiques'}</span>
              <span className="text-orange-400 font-bold">
                {clubInfo.horairesPermanence || 'Mercredi après-midi & Samedi matin'}
              </span>
            </div>
          )}
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
              <div className="flex flex-col gap-1.5 pt-1.5 border-t border-zinc-800/80 text-xs">
                {clubInfo.presidentTelephone && (
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <a
                      href={`tel:${clubInfo.presidentTelephone.replace(/\s+/g, '')}`}
                      className="inline-flex items-center gap-1.5 text-zinc-300 hover:text-emerald-400 font-medium transition whitespace-nowrap shrink-0 tabular-nums"
                      title="Appeler le président"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{clubInfo.presidentTelephone}</span>
                    </a>
                    <a
                      href={`sms:${clubInfo.presidentTelephone.replace(/\s+/g, '')}`}
                      className="px-2 py-0.5 rounded text-[10px] bg-sky-500/15 text-sky-300 border border-sky-500/30 hover:bg-sky-500/25 transition font-bold shrink-0 whitespace-nowrap"
                      title="Envoyer un SMS"
                    >
                      SMS
                    </a>
                  </div>
                )}
                {clubInfo.presidentEmail && (
                  <a
                    href={`mailto:${clubInfo.presidentEmail}`}
                    className="inline-flex items-center gap-1.5 text-zinc-300 hover:text-orange-400 font-medium transition whitespace-nowrap overflow-x-auto no-scrollbar max-w-full min-w-0"
                    title="Envoyer un email au président"
                  >
                    <Mail className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    <span>{clubInfo.presidentEmail}</span>
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
              <div className="flex flex-col gap-1.5 pt-1.5 border-t border-zinc-800/80 text-xs">
                {clubInfo.secretaireTelephone && (
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <a
                      href={`tel:${clubInfo.secretaireTelephone.replace(/\s+/g, '')}`}
                      className="inline-flex items-center gap-1.5 text-zinc-300 hover:text-emerald-400 font-medium transition whitespace-nowrap shrink-0 tabular-nums"
                      title="Appeler la secrétaire"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{clubInfo.secretaireTelephone}</span>
                    </a>
                    <a
                      href={`sms:${clubInfo.secretaireTelephone.replace(/\s+/g, '')}`}
                      className="px-2 py-0.5 rounded text-[10px] bg-sky-500/15 text-sky-300 border border-sky-500/30 hover:bg-sky-500/25 transition font-bold shrink-0 whitespace-nowrap"
                      title="Envoyer un SMS"
                    >
                      SMS
                    </a>
                  </div>
                )}
                {clubInfo.secretaireEmail && (
                  <a
                    href={`mailto:${clubInfo.secretaireEmail}`}
                    className="inline-flex items-center gap-1.5 text-zinc-300 hover:text-purple-400 font-medium transition whitespace-nowrap overflow-x-auto no-scrollbar max-w-full min-w-0"
                    title="Envoyer un email à la secrétaire"
                  >
                    <Mail className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span>{clubInfo.secretaireEmail}</span>
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
              <div className="flex flex-col gap-1.5 pt-1.5 border-t border-zinc-800/80 text-xs">
                {clubInfo.tresorierTelephone && (
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <a
                      href={`tel:${clubInfo.tresorierTelephone.replace(/\s+/g, '')}`}
                      className="inline-flex items-center gap-1.5 text-zinc-300 hover:text-emerald-400 font-medium transition whitespace-nowrap shrink-0 tabular-nums"
                      title="Appeler le trésorier"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{clubInfo.tresorierTelephone}</span>
                    </a>
                    <a
                      href={`sms:${clubInfo.tresorierTelephone.replace(/\s+/g, '')}`}
                      className="px-2 py-0.5 rounded text-[10px] bg-sky-500/15 text-sky-300 border border-sky-500/30 hover:bg-sky-500/25 transition font-bold shrink-0 whitespace-nowrap"
                      title="Envoyer un SMS"
                    >
                      SMS
                    </a>
                  </div>
                )}
                {clubInfo.tresorierEmail && (
                  <a
                    href={`mailto:${clubInfo.tresorierEmail}`}
                    className="inline-flex items-center gap-1.5 text-zinc-300 hover:text-emerald-400 font-medium transition whitespace-nowrap overflow-x-auto no-scrollbar max-w-full min-w-0"
                    title="Envoyer un email au trésorier"
                  >
                    <Mail className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{clubInfo.tresorierEmail}</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {clubInfo.email && (
              <a
                href={`mailto:${clubInfo.email}`}
                className="min-h-[44px] flex-1 min-w-0 py-2.5 px-3.5 rounded-xl bg-[#1d222b] hover:bg-orange-500/20 text-zinc-200 hover:text-[#FF6D00] border border-[#282f3d] hover:border-orange-500/40 text-xs font-bold transition flex items-center justify-center gap-2 whitespace-nowrap overflow-x-auto no-scrollbar"
              >
                <Mail className="w-3.5 h-3.5 shrink-0" />
                <span>{clubInfo.email}</span>
              </a>
            )}

            {clubInfo.telephone && (
              <a
                href={`tel:${clubInfo.telephone.replace(/\s+/g, '')}`}
                className="min-h-[44px] sm:flex-initial py-2.5 px-4 rounded-xl bg-[#1d222b] hover:bg-emerald-500/20 text-zinc-200 hover:text-emerald-400 border border-[#282f3d] hover:border-emerald-500/40 text-xs font-bold transition flex items-center justify-center gap-2 whitespace-nowrap shrink-0 tabular-nums"
              >
                <Phone className="w-3.5 h-3.5 shrink-0" />
                <span>{clubInfo.telephone}</span>
              </a>
            )}
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
              Infrastructures & Terrains ({clubInfo.installations?.length || 0})
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

          {clubInfo.badgeAccesVisible !== false && (clubInfo.badgeAccesMessage || clubInfo.ouvertureCourtsMessage) && (
            <div className="pt-3 border-t border-[#232934] flex items-center justify-between text-xs text-zinc-400">
              <span>{clubInfo.badgeAccesMessage || 'Accès sécurisé par badge'}</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                {clubInfo.ouvertureCourtsMessage || 'Courts ouverts 7j/7'}
              </span>
            </div>
          )}
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
                  <span className="font-bold text-white">{t.label}</span>
                  {t.description && <p className="text-[11px] text-zinc-400">{t.description}</p>}
                </div>
                <span className="font-heading font-black text-[#FF6D00] text-sm shrink-0 tabular-nums whitespace-nowrap">
                  {t.montant} €
                </span>
              </div>
            )))}
          </div>

          {/* Modalités & Facilités de paiement (texte unique sans bulles redondantes) */}
          <div className="pt-3 border-t border-[#232934]">
            <div className="flex items-start gap-2">
              <CreditCard className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                {clubInfo.modalitesPaiement || "Paiement échelonné possible par chèque et par CB via HelloAsso (directement sur Ten'Up avec le montant dans votre panier). Chèques vacances ANCV et Pass'Sport acceptés."}
              </p>
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
