import React from 'react';
import { 
  X, 
  Phone, 
  MessageSquare, 
  Mail, 
  ExternalLink, 
  Copy, 
  Check, 
  AlertCircle, 
  CheckCircle2, 
  Award, 
  Calendar, 
  BookOpen, 
  CreditCard,
  ShieldCheck,
  ShieldAlert,
  User
} from 'lucide-react';
import { Adherent } from '../types/tennis';
import { getRankingMeta } from '../utils/ranking';
import { extractBirthYear } from '../utils/fftEligibility';

interface AdherentModalProps {
  adherent: Adherent | null;
  onClose: () => void;
  onUpdateSolde?: (id: string, newSolde: number) => void;
}

export const AdherentModal: React.FC<AdherentModalProps> = ({
  adherent,
  onClose,
  onUpdateSolde,
}) => {
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  if (!adherent) return null;

  const meta = getRankingMeta(adherent.dernierClassTennis);
  const isOwed = adherent.soldeDu < 0;
  const isCredit = adherent.soldeDu > 0;
  const rawLicenceType = (adherent.typeLicence || '').toUpperCase();
  const isLicenceCompValid = rawLicenceType === 'C' || rawLicenceType === 'W';
  const birthYear = extractBirthYear(adherent.dateNaissance);
  const ageSportif2027 = birthYear ? 2027 - birthYear : null;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleToggleSolde = () => {
    if (!onUpdateSolde) return;
    if (isOwed || isCredit) {
      onUpdateSolde(adherent.id, 0);
    } else {
      // Définir un solde dû d'exemple (-35 €)
      onUpdateSolde(adherent.id, -35);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-lg bg-[#161a22] border border-[#2b3342] rounded-3xl overflow-hidden shadow-2xl shadow-black/80 my-8 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête décoratif */}
        <div className="relative bg-gradient-to-br from-[#1f242e] to-[#12151b] p-6 border-b border-[#2b3342]">
          <div className="absolute top-0 right-0 w-40 h-40 bg-orange-600/10 rounded-full blur-2xl pointer-events-none"></div>

          {/* Bouton Fermer */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-[#262c38] hover:bg-[#343b4c] text-zinc-300 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Identité principale */}
          <div className="flex items-center space-x-4">
            <div className={`w-16 h-16 sm:w-18 sm:h-18 rounded-2xl flex flex-col items-center justify-center font-heading font-black text-lg sm:text-xl border ${meta.badgeBg} ${meta.badgeBorder} ${meta.badgeText} shadow-lg shrink-0`}>
              <span>{adherent.dernierClassTennis || 'NC'}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                {meta.serie}
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide bg-[#E65100]/25 text-[#FF6D00] border border-[#E65100]/40">
                  Adhérent TCM
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {adherent.civilite === 'Madame' ? 'Madame (F)' : 'Monsieur (H)'}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-heading font-black text-white mt-1">
                {adherent.nomPrenom}
              </h2>
              <p className="text-xs text-zinc-400">
                Groupe : <strong className="text-zinc-200">{adherent.groupeEnseignement || 'Pratique libre'}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Corps de la fiche */}
        <div className="p-6 space-y-5">
          
          {/* Alerte spécifique Classement ND (Non Déterminé) */}
          {meta.isND && (
            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/60 text-rose-200 text-xs space-y-2 shadow-lg shadow-rose-950/50">
              <div className="flex items-center space-x-2 text-rose-300 font-heading font-black text-sm">
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                <span>CLASSEMENT NON DÉTERMINÉ (ND) — RECLASSEMENT FFT REQUIS</span>
              </div>
              <p className="text-zinc-200 leading-relaxed text-[11px]">
                Ce joueur a interrompu la compétition officielle pendant plusieurs années. Son dernier classement FFT est <strong>ND</strong> (Non Déterminé), alors que son meilleur classement enregistré est <strong>{adherent.meilleurClassTennis || '15/3'}</strong>.
              </p>
              <div className="p-2.5 rounded-xl bg-black/40 border border-rose-800/40 text-[11px] text-rose-300">
                ⚠️ <strong>Règle FFT Compétition :</strong> Il est strictement interdit d'inscrire un joueur ND sur une feuille de match par équipes ou dans un tournoi officiel. Le joueur doit d'abord formuler une <em>demande de reclassement</em> auprès de la Commission de Classement de la Ligue de Bretagne.
              </div>
            </div>
          )}

          {/* Badge Statut Homologation FFT 2027 */}
          <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${
            isLicenceCompValid && !meta.isND
              ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300' 
              : 'bg-rose-950/25 border-rose-500/40 text-rose-300'
          }`}>
            <div className="flex items-center space-x-2.5">
              {isLicenceCompValid && !meta.isND ? (
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
              )}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Éligibilité Compétition FFT</p>
                <p className="text-xs font-black text-white">
                  {meta.isND
                    ? 'Inéligible : Classement ND (Reclassement en attente)'
                    : isLicenceCompValid
                      ? `Type ${adherent.typeLicence} : Autorisé en Championnat (C/W)`
                      : `Type ${adherent.typeLicence || 'Invalide'} : Non autorisé en compétition officielle`}
                </p>
              </div>
            </div>
            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
              isLicenceCompValid && !meta.isND ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
            }`}>
              {isLicenceCompValid && !meta.isND ? 'Éligible' : 'Inéligible'}
            </span>
          </div>

          {/* État financier / Solde dû / À régulariser */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between ${
            isOwed 
              ? 'bg-rose-950/20 border-rose-500/40 text-rose-300' 
              : isCredit
                ? 'bg-amber-950/20 border-amber-500/40 text-amber-300'
                : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
          }`}>
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isOwed 
                  ? 'bg-rose-500/20 text-rose-400' 
                  : isCredit
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                {isOwed ? <AlertCircle className="w-5 h-5" /> : isCredit ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
              </div>
              <div>
                <p className="text-xs text-zinc-400">
                  {isOwed ? 'Solde Restant Dû (Impayé)' : isCredit ? 'Solde Positif (À régulariser)' : 'Cotisation & Solde Club'}
                </p>
                <p className="text-sm font-black font-heading text-white">
                  {isOwed 
                    ? `Solde restant dû : ${Math.abs(adherent.soldeDu)} €` 
                    : isCredit 
                      ? `Crédit / Avoir : +${adherent.soldeDu} €` 
                      : 'Compte club à jour (0 €)'}
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {isOwed 
                    ? 'Cotisation ou cours en attente de règlement' 
                    : isCredit 
                      ? 'Tarif famille non déduit ou avoir en attente de régularisation' 
                      : 'Règlement complet pour la saison en cours'}
                </p>
              </div>
            </div>

            {onUpdateSolde && (
              <button
                onClick={handleToggleSolde}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition border border-zinc-700 cursor-pointer shrink-0 ml-2"
              >
                {isOwed ? 'Marquer réglé' : isCredit ? 'Régulariser à 0 €' : 'Définir impayé'}
              </button>
            )}
          </div>

          {/* Grille des informations */}
          <div className="space-y-3 bg-[#11141a] p-4 rounded-2xl border border-[#232934] text-xs">
            
            {/* Téléphone */}
            <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/80">
              <span className="text-zinc-400 flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-zinc-500" />
                Téléphone Portable
              </span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">{adherent.telephonePortable || 'Non renseigné'}</span>
                {adherent.telephonePortable && (
                  <button
                    onClick={() => copyToClipboard(adherent.telephonePortable, 'phone')}
                    className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
                    title="Copier le numéro"
                  >
                    {copiedField === 'phone' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>

            {/* Email */}
            <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/80">
              <span className="text-zinc-400 flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-zinc-500" />
                Email
              </span>
              <div className="flex items-center gap-2 max-w-[65%]">
                <span className="font-semibold text-white truncate">{adherent.email || 'Non renseigné'}</span>
                {adherent.email && (
                  <button
                    onClick={() => copyToClipboard(adherent.email, 'email')}
                    className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition shrink-0 cursor-pointer"
                    title="Copier l'email"
                  >
                    {copiedField === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>

            {/* Numéro de Licence & Statut Type */}
            <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/80">
              <span className="text-zinc-400 flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5 text-zinc-500" />
                Licence FFT & Type
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-[#FF6D00]">{adherent.licence || 'Non renseignée'}</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-zinc-800 text-white">
                  Type {adherent.typeLicence}
                </span>
                {adherent.licence && (
                  <button
                    onClick={() => copyToClipboard(adherent.licence, 'licence')}
                    className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
                    title="Copier le numéro de licence"
                  >
                    {copiedField === 'licence' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>

            {/* Date Naissance & Millésime 2027 */}
            <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/80">
              <span className="text-zinc-400 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                Date de Naissance
              </span>
              <div className="text-right">
                <span className="font-semibold text-white">{adherent.dateNaissance}</span>
                {birthYear && (
                  <span className="block text-[10px] text-orange-400">
                    Né en {birthYear} ({ageSportif2027} ans - Millésime 2027)
                  </span>
                )}
              </div>
            </div>

            {/* Groupe */}
            <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/80">
              <span className="text-zinc-400 flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-zinc-500" />
                Groupe d'enseignement
              </span>
              <span className="font-semibold text-white">{adherent.groupeEnseignement || 'Loisir'}</span>
            </div>

            {/* Compte Ten'Up */}
            <div className="flex items-center justify-between py-1.5">
              <span className="text-zinc-400 flex items-center gap-2">
                <Award className="w-3.5 h-3.5 text-zinc-500" />
                Statut Compte Ten'Up
              </span>
              <span className="font-bold text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                {adherent.compteTenUp || 'Actif'}
              </span>
            </div>

          </div>

          {/* Boutons d'action rapide dans la modale */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Actions directes</p>
            <div className="grid grid-cols-3 gap-2.5">
              <a
                href={`tel:${adherent.telephonePortable}`}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[#1d222b] hover:bg-emerald-600/20 border border-[#2b3342] hover:border-emerald-500/40 text-zinc-200 hover:text-emerald-400 transition group"
              >
                <Phone className="w-5 h-5 mb-1 group-hover:scale-110 transition" />
                <span className="text-xs font-bold">Appeler</span>
              </a>

              <a
                href={`sms:${adherent.telephonePortable}`}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[#1d222b] hover:bg-sky-600/20 border border-[#2b3342] hover:border-sky-500/40 text-zinc-200 hover:text-sky-400 transition group"
              >
                <MessageSquare className="w-5 h-5 mb-1 group-hover:scale-110 transition" />
                <span className="text-xs font-bold">SMS</span>
              </a>

              <a
                href={`mailto:${adherent.email}?subject=Message%20Muzillac%20Tennis%20Club`}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[#1d222b] hover:bg-orange-600/20 border border-[#2b3342] hover:border-orange-500/40 text-zinc-200 hover:text-orange-400 transition group"
              >
                <Mail className="w-5 h-5 mb-1 group-hover:scale-110 transition" />
                <span className="text-xs font-bold">Email</span>
              </a>
            </div>

            {/* Bouton Ten'Up Principal */}
            <a
              href="https://tenup.fft.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#BF360C] via-[#E65100] to-[#FF6D00] hover:brightness-110 active:scale-[0.99] text-white text-center font-heading font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-orange-950/60 transition"
            >
              <span>Consulter sur l'application Ten'Up FFT</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

        </div>

      </div>
    </div>
  );
};
