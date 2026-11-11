import React, { useState } from 'react';
import { 
  X, 
  MessageSquare, 
  Mail, 
  Copy, 
  Check, 
  AlertCircle, 
  CreditCard, 
  Building, 
  ExternalLink,
  Phone
} from 'lucide-react';
import { Adherent, ClubInfo } from '../types/tennis';

interface RelanceModalProps {
  adherent: Adherent;
  clubInfo: ClubInfo;
  onClose: () => void;
}

export const RelanceModal: React.FC<RelanceModalProps> = ({
  adherent,
  clubInfo,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'sms' | 'email'>('sms');
  const [copied, setCopied] = useState(false);

  const montantAbs = Math.abs(adherent.soldeDu || 0);

  // Texte du SMS
  const smsText = `Bonjour ${adherent.nomPrenom},
Le Tennis Club de Muzillac (TCM) vous informe qu'un solde restant dû de ${montantAbs} € est en attente pour votre adhésion / cours de tennis de la saison 2026/2027.
Merci de bien vouloir procéder à son règlement au club-house (permanences mercredi & samedi) ou par virement bancaire.
Sportivement, Le TCM (${clubInfo.telephone || '06 62 43 24 64'})`;

  // Objet et corps de l'Email
  const mailSubject = `Tennis Club de Muzillac (TCM) - Régularisation de votre cotisation 2026/2027`;
  const mailBody = `Bonjour ${adherent.nomPrenom},

Sauf erreur de notre part, votre compte adhérent au Tennis Club de Muzillac présente un solde restant dû de ${montantAbs} € pour votre inscription et/ou cours de tennis de la saison sportive 2026/2027 (${adherent.groupeEnseignement || 'Formule TCM'}).

Nous vous remercions de bien vouloir régulariser ce montant selon votre convenance :
- Par chèque à l'ordre du "Tennis Club de Muzillac" déposé dans la boîte aux lettres du club-house
- En espèces lors des permanences (mercredi après-midi & samedi matin)
- Par virement bancaire sur le compte du TCM${clubInfo.ribIban ? ` (IBAN : ${clubInfo.ribIban})` : ''}
${clubInfo.helloAssoUrl ? `- En ligne par carte bancaire via notre page HelloAsso : ${clubInfo.helloAssoUrl}\n` : ''}
Si vous avez déjà effectué votre paiement ces derniers jours, nous vous remercions de ne pas tenir compte de cette relance.

Restant à votre disposition pour toute question,
Bien sportivement,

Le Bureau du Tennis Club de Muzillac (TCM)
${clubInfo.telephone || '06 62 43 24 64'} • ${clubInfo.email || 'tennisclubmuzillac@gmail.com'}
${clubInfo.adresse || 'Complexe du Clos des Moines, Rue du Stade'}, ${clubInfo.codePostal || '56190'} ${clubInfo.ville || 'Muzillac'}`;

  const currentText = activeTab === 'sms' ? smsText : mailBody;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const encodedSms = encodeURIComponent(smsText);
  const encodedMailSubject = encodeURIComponent(mailSubject);
  const encodedMailBody = encodeURIComponent(mailBody);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl bg-[#141820] text-zinc-100 rounded-3xl border border-[#272e3b] shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-5 bg-[#171c26] border-b border-[#252c3a] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center font-bold shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading font-black text-white text-base sm:text-lg">
                  Relance de Cotisation
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  Dû : {montantAbs} €
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                {adherent.nomPrenom} • {adherent.groupeEnseignement || 'Adhérent TCM'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Onglets SMS / Email */}
        <div className="p-4 bg-[#11141c] border-b border-[#212734] flex items-center justify-between gap-2 flex-wrap">
          <div className="flex bg-[#191e29] p-1 rounded-xl border border-zinc-800">
            <button
              onClick={() => setActiveTab('sms')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'sms' 
                  ? 'bg-sky-500/25 text-sky-200 border border-sky-400/50 shadow-sm' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
              <span>SMS ({adherent.telephonePortable || 'Non renseigné'})</span>
            </button>
            <button
              onClick={() => setActiveTab('email')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'email' 
                  ? 'bg-orange-500/25 text-orange-200 border border-orange-400/50 shadow-sm' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Mail className="w-3.5 h-3.5 text-orange-400" />
              <span>Email ({adherent.email || 'Non renseigné'})</span>
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
            <span>{copied ? 'Texte copié !' : 'Copier'}</span>
          </button>
        </div>

        {/* Aperçu du message */}
        <div className="p-5 flex-1 space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
              {activeTab === 'sms' ? 'Message SMS prêt à l\'envoi :' : 'Objet et corps du message email :'}
            </label>
            <div className="w-full bg-[#0d0f14] border border-zinc-800 rounded-2xl p-4 text-xs sm:text-sm text-zinc-200 font-mono leading-relaxed whitespace-pre-wrap select-all">
              {currentText}
            </div>
          </div>

          {/* Coordonnées de paiement du club */}
          <div className="p-3.5 bg-[#171c26] rounded-xl border border-zinc-800/80 text-xs text-zinc-400 space-y-1">
            <div className="flex items-center gap-2 text-zinc-200 font-bold">
              <Building className="w-3.5 h-3.5 text-orange-400" />
              <span>Rappel modalités club TCM :</span>
            </div>
            <p className="text-[11px]">
              Chèques à l'ordre de <strong>Muzillac Tennis Club</strong>. Chèques vacances ANCV et Pass'Sport acceptés.
            </p>
            {clubInfo.helloAssoUrl && (
              <a
                href={clubInfo.helloAssoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-orange-400 hover:text-orange-300 font-semibold underline"
              >
                <span>Lien de paiement HelloAsso</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#171c26] border-t border-[#252c3a] flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition cursor-pointer"
          >
            Fermer
          </button>

          <div className="flex items-center gap-2">
            {activeTab === 'sms' && adherent.telephonePortable && (
              <a
                href={`sms:${adherent.telephonePortable}?body=${encodedSms}`}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black transition flex items-center gap-1.5 shadow-md shadow-sky-950/40 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Ouvrir appli SMS</span>
              </a>
            )}

            {activeTab === 'email' && adherent.email && (
              <a
                href={`mailto:${adherent.email}?subject=${encodedMailSubject}&body=${encodedMailBody}`}
                className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-black transition flex items-center gap-1.5 shadow-md shadow-orange-950/40 cursor-pointer"
              >
                <Mail className="w-4 h-4" />
                <span>Ouvrir client Mail</span>
              </a>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
