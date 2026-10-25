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
  Check
} from 'lucide-react';
import { ClubInfo } from '../types/tennis';
import { getNextFftMonthlyRankingRelease, getWeeklyScheduleInfo } from '../utils/fftCalendar';
import { GraduationCap, Euro, Edit3, Building } from 'lucide-react';

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

  const handleConnectGas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gasUrl.trim()) return;
    await onSyncWithUrl(gasUrl.trim());
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
            <span className="text-[10px] text-zinc-500 text-center">Accès adhérents TCM FFT</span>
          </div>
        </div>
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
                  Enseignants Professionnels ({clubInfo.enseignants?.length || 2})
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
            {(clubInfo.enseignants || []).map((ens) => (
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
            ))}
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

          {/* Liste des contacts bureau */}
          <div className="space-y-2 text-xs text-zinc-300">
            <div className="flex justify-between py-1.5 border-b border-zinc-800/80">
              <span className="text-zinc-400">Président</span>
              <span className="font-bold text-white">{clubInfo.president}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-zinc-800/80">
              <span className="text-zinc-400">Secrétaire</span>
              <span className="font-bold text-white">{clubInfo.secretaire}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-zinc-800/80">
              <span className="text-zinc-400">Trésorier</span>
              <span className="font-bold text-white">{clubInfo.tresorier}</span>
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

          <ul className="space-y-3 text-xs sm:text-sm text-zinc-300">
            {clubInfo.installations.map((item, idx) => (
              <li key={idx} className="flex items-start space-x-2.5">
                <span className="text-[#FF6D00] font-bold mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>

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
              Cotisations & Formules 2026/2027
            </h2>
          </div>

          <div className="space-y-2.5 text-xs">
            {(clubInfo.tarifs || []).map((t) => (
              <div
                key={t.id}
                className="p-2.5 bg-[#11141a] rounded-xl border border-zinc-800/80 flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-white">{t.label}</span>
                  {t.description && <p className="text-[10px] text-zinc-400">{t.description}</p>}
                </div>
                <span className="font-heading font-black text-[#FF6D00] text-sm shrink-0">
                  {t.montant} €
                </span>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-[#232934] text-[11px] text-zinc-400">
            Paiement échelonné possible, chèques vacances ANCV et Pass'Sport acceptés.
          </div>
        </div>

      </div>

      {/* Module 1 : Synchronisation Systématique du Fichier Réel TCM (Données_appli) */}
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

      {/* Module Hub Google Apps Script & Google Sheets */}
      <div className="bg-[#161a22] p-5 sm:p-6 rounded-3xl border border-[#252b37] shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-950/50">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-black text-white text-base">
                Connexion Google Sheets & Apps Script (Code.gs)
              </h2>
              <p className="text-xs text-zinc-400">
                Synchronisez l'application avec votre classeur Google Sheets <code>Données_appli</code> (onglets 'Adhérents' et 'Rencontres').
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-start sm:self-auto flex-wrap">
            {onOpenGsheetModal && (
              <button
                onClick={onOpenGsheetModal}
                className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Valider Colonnes GSheet</span>
              </button>
            )}

            <button
              onClick={onOpenScriptModal}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-[#FF6D00] border border-orange-500/40 text-xs font-bold transition cursor-pointer"
            >
              <Code2 className="w-4 h-4" />
              <span>Voir & Copier Code.gs</span>
            </button>
          </div>
        </div>

        {/* Structure officielle du classeur Données_appli */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-[#11141a] rounded-2xl border border-[#232934] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <h3 className="font-bold text-white text-xs">Onglet 1 : 'Adhérents' (66 colonnes)</h3>
              </div>
              <span className="text-[10px] text-zinc-400">GSheet Données_appli</span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Extraction automatique des colonnes clés : <em>Nom Prénom, Solde (&lt; 0 = dû), Civilité, Date Naiss., Licence, Millésime 2027, Dernier class., Tel, Email, Groupe</em>.
            </p>
            <div className="p-2.5 bg-black/40 rounded-xl text-[10px] font-mono text-zinc-300 leading-relaxed overflow-x-auto max-h-20 scrollbar-none">
              Nom Prénom, Solde, Famille, Nom, Prénom, Civilité, Date Naiss., Age., Statut représentant légal, Nationalité, Adresse, CP, Ville, Pays, Téléphone Portable, Email, Licence, Millésime dernière Licence, Dernier class. tennis, Groupe enseignement, Compte Ten'UP...
            </div>
          </div>

          <div className="p-4 bg-[#11141a] rounded-2xl border border-[#232934] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-[#E65100]"></span>
                <h3 className="font-bold text-white text-xs">Onglet 2 : 'Rencontres' (41 colonnes)</h3>
              </div>
              <span className="text-[10px] text-zinc-400">GSheet Données_appli</span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Croisement officiel FFT 2027 : <em>Libellé & Sexe homologation, Catégorie d'âge (Seniors, +35, +45...), Équipe, Clubs, Score, Capitaine</em>.
            </p>
            <div className="p-2.5 bg-black/40 rounded-xl text-[10px] font-mono text-zinc-300 leading-relaxed overflow-x-auto max-h-20 scrollbar-none">
              Niveau de l'homologation, Libellé de l'homologation, Sexe de l'homologation, Catégorie d'âge de l'homologation, Division, Poule, Numéro de l'équipe, Date de la rencontre, Journée n°, Club d'accueil nom, Club visiteur nom, Score, Nom capitaine, Portable capitaine, Mail capitaine...
            </div>
          </div>
        </div>

        {/* Formulaire de connexion dynamique avec l'URL déployée Apps Script */}
        <form onSubmit={handleConnectGas} className="p-4 bg-[#11141a] rounded-2xl border border-[#232934] space-y-3">
          <label className="block text-xs font-bold text-white">
            Connecter une Web App Google Apps Script en direct
          </label>
          <p className="text-[11px] text-zinc-400">
            Collez l'URL de votre Web App déployée (ex: <code>https://script.google.com/macros/s/.../exec</code>) pour charger vos adhérents et rencontres en direct :
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={gasUrl}
              onChange={(e) => setGasUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="flex-1 px-3.5 py-2 bg-[#181d26] text-xs text-white placeholder-zinc-500 rounded-xl border border-[#282f3d] focus:outline-none focus:border-[#E65100]"
            />
            <button
              type="submit"
              disabled={isSyncing || !gasUrl.trim()}
              className="px-4 py-2 bg-[#E65100] hover:bg-[#FF6D00] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Synchronisation...' : 'Synchroniser'}</span>
            </button>
          </div>

          {syncError && (
            <p className="text-xs text-rose-400 font-semibold">{syncError}</p>
          )}

          {lastSyncTime && (
            <p className="text-[11px] text-emerald-400 font-medium">
              ✓ Données synchronisées avec succès le {lastSyncTime}
            </p>
          )}
        </form>

        <div className="flex justify-end">
          <button
            onClick={onResetData}
            className="text-xs text-zinc-400 hover:text-orange-400 underline transition cursor-pointer"
          >
            Réinitialiser avec les données d'exemple Muzillac TC
          </button>
        </div>

      </div>

    </div>
  );
};
