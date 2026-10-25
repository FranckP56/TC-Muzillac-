import React from 'react';
import { 
  Phone, 
  MessageSquare, 
  Mail, 
  ExternalLink, 
  Copy, 
  Check, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { Adherent } from '../types/tennis';
import { getRankingMeta } from '../utils/ranking';
import { extractBirthYear } from '../utils/fftEligibility';

interface AdherentCardProps {
  adherent: Adherent;
  onSelect: (adherent: Adherent) => void;
}

export const AdherentCard: React.FC<AdherentCardProps> = ({ adherent, onSelect }) => {
  const [copiedLicence, setCopiedLicence] = React.useState(false);
  const meta = getRankingMeta(adherent.dernierClassTennis);
  const isOwed = adherent.soldeDu < 0;
  const isCredit = adherent.soldeDu > 0;

  const rawLicenceType = (adherent.typeLicence || '').toUpperCase();
  const isLicenceCompValid = rawLicenceType === 'C' || rawLicenceType === 'W';
  const birthYear = extractBirthYear(adherent.dateNaissance);

  const handleCopyLicence = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (adherent.licence) {
      navigator.clipboard.writeText(adherent.licence);
      setCopiedLicence(true);
      setTimeout(() => setCopiedLicence(false), 2000);
    }
  };

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      onClick={() => onSelect(adherent)}
      className="group relative bg-[#171b22] hover:bg-[#1e232d] border border-[#272e3b] hover:border-[#E65100]/60 rounded-3xl p-4 sm:p-5 transition-all duration-200 shadow-md hover:shadow-xl hover:shadow-orange-950/20 cursor-pointer select-none"
    >
      {/* Ligne Principale : Classement, Identité, Statut Solde & Ten'Up */}
      <div className="flex items-start justify-between gap-3">
        
        {/* Identité et avatar de classement */}
        <div className="flex items-start space-x-3.5 min-w-0">
          {/* Badge Classement FFT */}
          <div className="flex flex-col items-center shrink-0">
            <div className={`w-13 h-13 sm:w-14 sm:h-14 rounded-2xl flex flex-col items-center justify-center font-heading font-black text-sm sm:text-base border ${meta.badgeBg} ${meta.badgeBorder} ${meta.badgeText} shadow-inner transition-transform group-hover:scale-105`}>
              <span className="leading-none">{adherent.dernierClassTennis || 'NC'}</span>
              <span className="text-[9px] font-bold uppercase tracking-wider opacity-75 mt-0.5">
                {meta.serie.replace(' Série', '')}
              </span>
            </div>
          </div>

          {/* Nom, Prénom, Licence, Catégorie */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-heading font-black text-white text-base sm:text-lg tracking-tight group-hover:text-orange-400 transition-colors truncate">
                {adherent.nomPrenom}
              </h3>

              {/* Badge Civilité & Type Licence */}
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
                {adherent.civilite === 'Madame' ? 'F' : 'H'}
              </span>

              {/* Statut ND : Reclassement FFT requis (Inéligible compétition) */}
              {meta.isND ? (
                <span 
                  className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/25 text-rose-200 border border-rose-500/60 flex items-center gap-1 shadow-sm"
                  title="Non Déterminé (ND) : Joueur ayant arrêté plusieurs années. Reclassement FFT obligatoire, inéligible en match par équipes."
                >
                  <ShieldAlert className="w-3 h-3 text-rose-400" />
                  ND - Reclassement requis (Inéligible)
                </span>
              ) : isLicenceCompValid ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1" title="Licence autorisée en compétition (C ou W)">
                  <ShieldCheck className="w-3 h-3" />
                  Licence {adherent.typeLicence}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1" title="Licence non autorisée en compétition officielle">
                  <ShieldAlert className="w-3 h-3 text-rose-400" />
                  Licence {adherent.typeLicence || 'Non C/W'}
                </span>
              )}

              {/* Badge Solde Dû / À Régulariser / À Jour */}
              {isOwed ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse" title="Solde négatif : reste dû au club">
                  <AlertCircle className="w-3 h-3 text-rose-400" />
                  Dû : {Math.abs(adherent.soldeDu)} €
                </span>
              ) : isCredit ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40" title="Solde positif : à régulariser (tarif famille ou avoir)">
                  <AlertCircle className="w-3 h-3 text-amber-400" />
                  À régul. : +{adherent.soldeDu} €
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  À jour (0 €)
                </span>
              )}
            </div>

            {/* Infos sportives, Année de naissance & Groupe */}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-400">
              <span className="font-semibold text-zinc-300">
                {adherent.groupeEnseignement || 'Pratique libre'}
              </span>
              <span className="text-zinc-600">•</span>
              <span>{birthYear ? `Né(e) en ${birthYear} (${2027 - birthYear} ans 2027)` : adherent.ageSportif}</span>
              {adherent.licence && (
                <>
                  <span className="text-zinc-600">•</span>
                  <button
                    onClick={handleCopyLicence}
                    className="inline-flex items-center gap-1 text-zinc-400 hover:text-orange-400 transition"
                    title="Copier le numéro de licence"
                  >
                    <span>N° {adherent.licence}</span>
                    {copiedLicence ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3 text-zinc-500" />
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Bouton Ten'Up Direct (Accès rapide sur la carte) */}
        <div className="flex items-center space-x-1 shrink-0" onClick={handleActionClick}>
          <a
            href="https://tenup.fft.fr"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#E65100]/20 to-[#FF6D00]/20 hover:from-[#E65100] hover:to-[#FF6D00] text-orange-400 hover:text-white border border-[#E65100]/40 text-xs font-bold transition-all duration-150 shadow-sm"
            title="Ouvrir dans l'application Ten'Up FFT"
          >
            <span>Ten'Up</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-orange-400 group-hover:translate-x-0.5 transition-all hidden sm:block" />
        </div>

      </div>

      {/* Barre d'actions rapides : Appel, SMS, Mail */}
      <div 
        onClick={handleActionClick}
        className="mt-4 pt-3.5 border-t border-[#232934] grid grid-cols-3 gap-2"
      >
        {/* Bouton Appel */}
        <a
          href={`tel:${adherent.telephonePortable}`}
          className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl bg-[#12151b] hover:bg-emerald-500/20 text-zinc-300 hover:text-emerald-400 border border-[#262c38] hover:border-emerald-500/40 text-xs font-bold transition-all"
          title={`Appeler ${adherent.telephonePortable}`}
        >
          <Phone className="w-3.5 h-3.5" />
          <span>Appel</span>
        </a>

        {/* Bouton SMS */}
        <a
          href={`sms:${adherent.telephonePortable}`}
          className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl bg-[#12151b] hover:bg-sky-500/20 text-zinc-300 hover:text-sky-400 border border-[#262c38] hover:border-sky-500/40 text-xs font-bold transition-all"
          title={`Envoyer un SMS au ${adherent.telephonePortable}`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>SMS</span>
        </a>

        {/* Bouton Mail */}
        <a
          href={`mailto:${adherent.email}?subject=Tennis%20Club%20Muzillac%20(TCM)`}
          className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl bg-[#12151b] hover:bg-orange-500/20 text-zinc-300 hover:text-orange-400 border border-[#262c38] hover:border-orange-500/40 text-xs font-bold transition-all"
          title={`Envoyer un mail à ${adherent.email}`}
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Mail</span>
        </a>
      </div>

    </div>
  );
};
