import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  MessageSquare,
  MessageCircle,
  AlertCircle,
  Mail,
  Copy,
  Check,
  Send,
  ChevronLeft,
  ChevronRight,
  SkipForward,
  Users,
  User,
  ExternalLink,
  RotateCcw,
  CheckCircle2,
  PhoneOff,
  Sparkles,
} from 'lucide-react';
import { Adherent, ClubInfo } from '../types/tennis';
import {
  formatFrenchPhoneNumber,
  toSmsRecipient,
  toWhatsAppPhone,
  buildSmsHref,
  buildWhatsAppHref,
} from '../utils/phoneUtils';

export type BatchModalMode = 'sms' | 'whatsapp' | 'relance';

interface BatchMessageModalProps {
  initialMode: BatchModalMode;
  selectedMembers: Adherent[];
  clubInfo: ClubInfo;
  onClose: () => void;
}

function extractFirstName(adh: Adherent): string {
  if (adh.prenom && adh.prenom.trim()) return adh.prenom.trim();
  const raw = (adh.nomPrenom || '').trim();
  if (!raw) return 'Adhérent';
  const parts = raw.split(/\s+/);
  if (parts.length === 1) return parts[0];
  // Format fréquent "NOM Prénom" : chercher le token avec des minuscules
  const mixedCasePart = parts.find((p) => /[a-zàâäéèêëîïôöùûüç]/.test(p));
  if (mixedCasePart) return mixedCasePart;
  return parts[parts.length - 1];
}

function personalizeMessage(template: string, adh: Adherent): string {
  const prenom = extractFirstName(adh);
  return template
    .replace(/\{prenom\}/gi, prenom)
    .replace(/\{nom\}/gi, adh.nomPrenom || prenom);
}

function buildDefaultRelanceSms(adh: Adherent, clubInfo: ClubInfo): string {
  const montantAbs = Math.abs(adh.soldeDu || 0);
  return `Bonjour ${adh.nomPrenom},
Le Tennis Club de Muzillac (TCM) vous informe qu'un solde restant dû de ${montantAbs} € est en attente pour votre adhésion / cours de tennis de la saison 2026/2027.
Merci de bien vouloir procéder à son règlement au club-house (permanences mercredi & samedi) ou par virement bancaire.
Sportivement, Le TCM (${clubInfo.telephone || '06 62 43 24 64'})`;
}

function buildDefaultRelanceEmail(adh: Adherent, clubInfo: ClubInfo): string {
  const montantAbs = Math.abs(adh.soldeDu || 0);
  return `Bonjour ${adh.nomPrenom},

Sauf erreur de notre part, votre compte adhérent au Tennis Club de Muzillac présente un solde restant dû de ${montantAbs} € pour votre inscription et/ou cours de tennis de la saison sportive 2026/2027 (${adh.groupeEnseignement || 'Formule TCM'}).

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
}

export const BatchMessageModal: React.FC<BatchMessageModalProps> = ({
  initialMode,
  selectedMembers,
  clubInfo,
  onClose,
}) => {
  const [mode, setMode] = useState<BatchModalMode>(initialMode);
  const [smsSubMode, setSmsSubMode] = useState<'groupe' | 'individuel'>('groupe');
  const [sharedMessage, setSharedMessage] = useState<string>(
    'Bonjour,\n\n[Votre message du Tennis Club de Muzillac]\n\nSportivement,\nLe TCM'
  );
  const [copiedInfo, setCopiedInfo] = useState<string | null>(null);

  // Suivi de file d'attente pour les envois individuels (SMS chacun / WhatsApp chacun / Relances)
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sentMap, setSentMap] = useState<Record<string, 'sent' | 'skipped'>>({});

  // Relance : canal choisi + textes modifiés individuellement
  const [relanceChannel, setRelanceChannel] = useState<'sms' | 'whatsapp' | 'email'>('sms');
  const [relanceCustomTexts, setRelanceCustomTexts] = useState<Record<string, string>>({});

  const debtors = useMemo(
    () => selectedMembers.filter((m) => m.soldeDu < 0),
    [selectedMembers]
  );
  const nonDebtors = useMemo(
    () => selectedMembers.filter((m) => m.soldeDu >= 0),
    [selectedMembers]
  );

  const membersWithPhone = useMemo(
    () => selectedMembers.filter((m) => Boolean(toSmsRecipient(m.telephonePortable))),
    [selectedMembers]
  );
  const membersWithoutPhone = useMemo(
    () => selectedMembers.filter((m) => !toSmsRecipient(m.telephonePortable)),
    [selectedMembers]
  );

  // Liste active pour la file pas-à-pas
  const queueList = mode === 'relance' ? debtors : selectedMembers;

  // Remettre l'index dans les bornes si on change de mode
  useEffect(() => {
    setCurrentIndex(0);
    setSentMap({});
  }, [mode, smsSubMode]);

  const safeIndex = queueList.length > 0 ? Math.min(currentIndex, queueList.length - 1) : 0;
  const currentMember = queueList[safeIndex] || null;

  const sentCount = useMemo(
    () => queueList.filter((m) => sentMap[`${mode}:${m.id}`] === 'sent').length,
    [queueList, sentMap, mode]
  );

  const triggerCopy = (text: string, label: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedInfo(label);
    setTimeout(() => setCopiedInfo(null), 2200);
  };

  const markStatusAndAdvance = (memberId: string, status: 'sent' | 'skipped') => {
    setSentMap((prev) => ({ ...prev, [`${mode}:${memberId}`]: status }));
    if (safeIndex < queueList.length - 1) {
      setTimeout(() => {
        setCurrentIndex((prev) => Math.min(prev + 1, queueList.length - 1));
      }, 250);
    }
  };

  const insertToken = (token: string) => {
    setSharedMessage((prev) => {
      const sep = prev.endsWith(' ') || prev.endsWith('\n') || prev === '' ? '' : ' ';
      return `${prev}${sep}${token}`;
    });
  };

  // Texte effectif de relance pour le débiteur courant
  const getRelanceText = (adh: Adherent, channel: 'sms' | 'whatsapp' | 'email') => {
    const key = `${adh.id}:${channel}`;
    if (relanceCustomTexts[key] !== undefined) {
      return relanceCustomTexts[key];
    }
    return channel === 'email'
      ? buildDefaultRelanceEmail(adh, clubInfo)
      : buildDefaultRelanceSms(adh, clubInfo);
  };

  const handleRelanceTextChange = (adhId: string, channel: 'sms' | 'whatsapp' | 'email', val: string) => {
    setRelanceCustomTexts((prev) => ({ ...prev, [`${adhId}:${channel}`]: val }));
  };

  const resetRelanceText = (adhId: string, channel: 'sms' | 'whatsapp' | 'email') => {
    setRelanceCustomTexts((prev) => {
      const next = { ...prev };
      delete next[`${adhId}:${channel}`];
      return next;
    });
  };

  const allPhoneNumbersFormatted = membersWithPhone
    .map((m) => formatFrenchPhoneNumber(m.telephonePortable) || toSmsRecipient(m.telephonePortable))
    .filter(Boolean);

  const groupSmsHref = buildSmsHref(
    membersWithPhone.map((m) => m.telephonePortable),
    sharedMessage
  );

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#141820] text-zinc-100 rounded-3xl border border-[#272e3b] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* En-tête */}
        <div className="p-4 sm:p-5 bg-[#171c26] border-b border-[#252c3a] flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-heading font-black text-white text-base sm:text-lg">
                Envoi multiple • {selectedMembers.length} personne{selectedMembers.length > 1 ? 's' : ''}
              </h2>
              {copiedInfo && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  {copiedInfo}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 truncate mt-0.5">
              {selectedMembers.slice(0, 4).map((m) => m.nomPrenom).join(', ')}
              {selectedMembers.length > 4 ? ` +${selectedMembers.length - 4} autres` : ''}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sélecteur de canal principal */}
        <div className="px-4 py-2.5 bg-[#11141c] border-b border-[#212734] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 text-xs">
          <button
            type="button"
            onClick={() => setMode('sms')}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap border ${
              mode === 'sms'
                ? 'bg-sky-500/20 text-sky-200 border-sky-400/50'
                : 'bg-[#181d27] text-zinc-400 border-zinc-800 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
            <span>SMS ({membersWithPhone.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('whatsapp')}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap border ${
              mode === 'whatsapp'
                ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/50'
                : 'bg-[#181d27] text-zinc-400 border-zinc-800 hover:text-white'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>WhatsApp ({membersWithPhone.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('relance')}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap border ${
              mode === 'relance'
                ? 'bg-rose-500/20 text-rose-200 border-rose-400/50'
                : 'bg-[#181d27] text-zinc-400 border-zinc-800 hover:text-white'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>Rappel cotisation ({debtors.length})</span>
          </button>
        </div>

        {/* Corps scrollable */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* ========================================================== */}
          {/* MODE 1 : SMS (GROUPÉ OU INDIVIDUEL IDENTIQUE)              */}
          {/* ========================================================== */}
          {mode === 'sms' && (
            <>
              {/* Choix SMS groupé vs SMS identique chacun */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-[#0e1118] rounded-2xl border border-zinc-800 text-xs">
                <button
                  type="button"
                  onClick={() => setSmsSubMode('groupe')}
                  className={`py-2 px-3 rounded-xl font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    smsSubMode === 'groupe'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>SMS groupé (1 fil)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSmsSubMode('individuel')}
                  className={`py-2 px-3 rounded-xl font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    smsSubMode === 'individuel'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>SMS identique chacun</span>
                </button>
              </div>

              {membersWithoutPhone.length > 0 && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 flex items-start gap-2">
                  <PhoneOff className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    {membersWithoutPhone.length} personne(s) sans numéro de portable renseigné :{' '}
                    <strong>{membersWithoutPhone.map((m) => m.nomPrenom).join(', ')}</strong>
                  </span>
                </div>
              )}

              {/* Rédaction du message */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-xs font-bold text-zinc-300">
                    {smsSubMode === 'groupe'
                      ? 'Message du SMS groupé :'
                      : 'Message identique envoyé à chacun :'}
                  </label>
                  {smsSubMode === 'individuel' && (
                    <button
                      type="button"
                      onClick={() => insertToken('{prenom}')}
                      className="px-2 py-0.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>+ Insérer {'{prenom}'}</span>
                    </button>
                  )}
                </div>
                <textarea
                  rows={4}
                  value={sharedMessage}
                  onChange={(e) => setSharedMessage(e.target.value)}
                  className="w-full bg-[#0d1016] border border-zinc-700 focus:border-sky-500 rounded-2xl p-3 text-xs sm:text-sm text-white outline-none leading-relaxed"
                  placeholder="Rédigez votre SMS..."
                />
              </div>

              {/* Sous-mode SMS groupé */}
              {smsSubMode === 'groupe' && (
                <div className="space-y-3">
                  <div className="p-3 bg-[#10131b] rounded-2xl border border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-zinc-300">
                        Destinataires ({membersWithPhone.length})
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          triggerCopy(allPhoneNumbersFormatted.join(', '), 'Numéros copiés')
                        }
                        disabled={membersWithPhone.length === 0}
                        className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copier les numéros</span>
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                      {membersWithPhone.map((m) => (
                        <span
                          key={m.id}
                          className="px-2 py-0.5 rounded-lg bg-sky-500/10 text-sky-200 border border-sky-500/25 text-[11px]"
                        >
                          {m.nomPrenom}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    {membersWithPhone.length > 0 && (
                      <a
                        href={groupSmsHref}
                        className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 shadow-lg shadow-sky-950/40"
                      >
                        <Send className="w-4 h-4" />
                        <span>Ouvrir l&apos;appli SMS ({membersWithPhone.length} destinataires)</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => triggerCopy(sharedMessage, 'Message copié')}
                      className="min-h-[44px] px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-4 h-4" />
                      <span>Copier le texte</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Sous-mode SMS identique chacun */}
              {smsSubMode === 'individuel' && currentMember && (
                <IndividualQueuePanel
                  queueList={queueList}
                  currentIndex={safeIndex}
                  sentMap={sentMap}
                  modeKey={mode}
                  sentCount={sentCount}
                  onSelectIndex={setCurrentIndex}
                  renderAction={(member) => {
                    const smsPhone = toSmsRecipient(member.telephonePortable);
                    const finalMsg = personalizeMessage(sharedMessage, member);
                    return (
                      <div className="space-y-3">
                        <div className="p-3 bg-[#0c0f15] rounded-xl border border-zinc-800 text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                          {finalMsg}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {smsPhone ? (
                            <a
                              href={buildSmsHref([smsPhone], finalMsg)}
                              onClick={() => markStatusAndAdvance(member.id, 'sent')}
                              className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 shadow-md shadow-sky-950/40"
                            >
                              <MessageSquare className="w-4 h-4" />
                              <span>Ouvrir SMS ({formatFrenchPhoneNumber(member.telephonePortable) || smsPhone})</span>
                            </a>
                          ) : (
                            <span className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-zinc-800 text-zinc-400 text-xs font-bold flex items-center justify-center gap-2">
                              <PhoneOff className="w-4 h-4 text-amber-400" />
                              <span>Aucun numéro de portable</span>
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => triggerCopy(finalMsg, 'Message copié')}
                            className="min-h-[44px] px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copier</span>
                          </button>
                        </div>
                      </div>
                    );
                  }}
                  onMarkSent={() => markStatusAndAdvance(currentMember.id, 'sent')}
                  onSkip={() => markStatusAndAdvance(currentMember.id, 'skipped')}
                />
              )}
            </>
          )}

          {/* ========================================================== */}
          {/* MODE 2 : WHATSAPP (ENVOIS INDIVIDUELS + COPIE NUMÉROS)     */}
          {/* ========================================================== */}
          {mode === 'whatsapp' && (
            <>
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-[11px] text-emerald-200 flex items-center justify-between gap-2 flex-wrap">
                <span>
                  WhatsApp ouvre chaque conversation individuellement avec le message pré-rempli.
                </span>
                {allPhoneNumbersFormatted.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      triggerCopy(allPhoneNumbersFormatted.join(', '), 'Numéros copiés')
                    }
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 border border-emerald-500/40 font-bold flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copier les numéros</span>
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-zinc-300">Message WhatsApp :</label>
                  <button
                    type="button"
                    onClick={() => insertToken('{prenom}')}
                    className="px-2 py-0.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>+ Insérer {'{prenom}'}</span>
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={sharedMessage}
                  onChange={(e) => setSharedMessage(e.target.value)}
                  className="w-full bg-[#0d1016] border border-zinc-700 focus:border-emerald-500 rounded-2xl p-3 text-xs sm:text-sm text-white outline-none leading-relaxed"
                  placeholder="Rédigez votre message WhatsApp..."
                />
              </div>

              {currentMember && (
                <IndividualQueuePanel
                  queueList={queueList}
                  currentIndex={safeIndex}
                  sentMap={sentMap}
                  modeKey={mode}
                  sentCount={sentCount}
                  onSelectIndex={setCurrentIndex}
                  renderAction={(member) => {
                    const waPhone = toWhatsAppPhone(member.telephonePortable);
                    const finalMsg = personalizeMessage(sharedMessage, member);
                    return (
                      <div className="space-y-3">
                        <div className="p-3 bg-[#0c0f15] rounded-xl border border-zinc-800 text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                          {finalMsg}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {waPhone ? (
                            <a
                              href={buildWhatsAppHref(member.telephonePortable, finalMsg)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => markStatusAndAdvance(member.id, 'sent')}
                              className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 shadow-md shadow-emerald-950/40"
                            >
                              <MessageCircle className="w-4 h-4" />
                              <span>Ouvrir WhatsApp ({formatFrenchPhoneNumber(member.telephonePortable)})</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          ) : (
                            <span className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-zinc-800 text-zinc-400 text-xs font-bold flex items-center justify-center gap-2">
                              <PhoneOff className="w-4 h-4 text-amber-400" />
                              <span>Aucun numéro valide pour WhatsApp</span>
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => triggerCopy(finalMsg, 'Message copié')}
                            className="min-h-[44px] px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copier</span>
                          </button>
                        </div>
                      </div>
                    );
                  }}
                  onMarkSent={() => markStatusAndAdvance(currentMember.id, 'sent')}
                  onSkip={() => markStatusAndAdvance(currentMember.id, 'skipped')}
                />
              )}
            </>
          )}

          {/* ========================================================== */}
          {/* MODE 3 : RAPPEL DE COTISATION (ENVOIS SÉPARÉS PAR MONTANT) */}
          {/* ========================================================== */}
          {mode === 'relance' && (
            <>
              {nonDebtors.length > 0 && (
                <div className="p-2.5 rounded-xl bg-zinc-800/70 border border-zinc-700/80 text-[11px] text-zinc-300">
                  {nonDebtors.length} personne(s) sélectionnée(s) sont déjà à jour ou en avoir et ne sont pas incluses dans les relances.
                </div>
              )}

              {debtors.length === 0 ? (
                <div className="p-8 text-center bg-[#10131a] rounded-2xl border border-zinc-800 space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                  <h3 className="font-heading font-black text-white text-sm">
                    Aucun solde dû dans votre sélection
                  </h3>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    Tous les membres sélectionnés ont un solde à jour (0 €) ou un avoir.
                  </p>
                </div>
              ) : (
                currentMember && (
                  <div className="space-y-3">
                    {/* Choix du canal pour les relances */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-bold text-zinc-300">
                        Canal de relance :
                      </span>
                      <div className="flex items-center bg-[#0e1118] p-1 rounded-xl border border-zinc-800 text-xs">
                        <button
                          type="button"
                          onClick={() => setRelanceChannel('sms')}
                          className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                            relanceChannel === 'sms' ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>SMS</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRelanceChannel('whatsapp')}
                          className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                            relanceChannel === 'whatsapp' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRelanceChannel('email')}
                          className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                            relanceChannel === 'email' ? 'bg-orange-600 text-white' : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>Email</span>
                        </button>
                      </div>
                    </div>

                    <IndividualQueuePanel
                      queueList={debtors}
                      currentIndex={safeIndex}
                      sentMap={sentMap}
                      modeKey={mode}
                      sentCount={sentCount}
                      showAmountBadge
                      onSelectIndex={setCurrentIndex}
                      renderAction={(member) => {
                        const montantAbs = Math.abs(member.soldeDu || 0);
                        const relanceText = getRelanceText(member, relanceChannel);
                        const smsPhone = toSmsRecipient(member.telephonePortable);
                        const waPhone = toWhatsAppPhone(member.telephonePortable);
                        const hasEmail = Boolean(member.email && member.email.includes('@'));
                        const mailSubject = `Tennis Club de Muzillac (TCM) - Régularisation de votre cotisation 2026/2027`;

                        return (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="px-2.5 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-black tabular-nums">
                                Montant personnalisé : {montantAbs} €
                              </span>
                              <button
                                type="button"
                                onClick={() => resetRelanceText(member.id, relanceChannel)}
                                className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Texte par défaut</span>
                              </button>
                            </div>

                            <textarea
                              rows={relanceChannel === 'email' ? 7 : 5}
                              value={relanceText}
                              onChange={(e) =>
                                handleRelanceTextChange(member.id, relanceChannel, e.target.value)
                              }
                              className="w-full bg-[#0c0f15] border border-zinc-700 focus:border-rose-500 rounded-xl p-3 text-xs text-zinc-200 font-mono leading-relaxed outline-none"
                            />

                            <div className="flex flex-wrap items-center gap-2">
                              {relanceChannel === 'sms' && (
                                smsPhone ? (
                                  <a
                                    href={buildSmsHref([smsPhone], relanceText)}
                                    onClick={() => markStatusAndAdvance(member.id, 'sent')}
                                    className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 shadow-md shadow-sky-950/40"
                                  >
                                    <MessageSquare className="w-4 h-4" />
                                    <span>SMS à {member.nomPrenom} ({montantAbs} €)</span>
                                  </a>
                                ) : (
                                  <span className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-zinc-800 text-zinc-400 text-xs font-bold flex items-center justify-center gap-2">
                                    <PhoneOff className="w-4 h-4 text-amber-400" />
                                    <span>Pas de mobile — essayez l&apos;onglet Email</span>
                                  </span>
                                )
                              )}

                              {relanceChannel === 'whatsapp' && (
                                waPhone ? (
                                  <a
                                    href={buildWhatsAppHref(member.telephonePortable, relanceText)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => markStatusAndAdvance(member.id, 'sent')}
                                    className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 shadow-md shadow-emerald-950/40"
                                  >
                                    <MessageCircle className="w-4 h-4" />
                                    <span>WhatsApp ({montantAbs} €)</span>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                ) : (
                                  <span className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-zinc-800 text-zinc-400 text-xs font-bold flex items-center justify-center gap-2">
                                    <PhoneOff className="w-4 h-4 text-amber-400" />
                                    <span>Pas de mobile valide</span>
                                  </span>
                                )
                              )}

                              {relanceChannel === 'email' && (
                                hasEmail ? (
                                  <a
                                    href={`mailto:${member.email}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(relanceText)}`}
                                    onClick={() => markStatusAndAdvance(member.id, 'sent')}
                                    className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 shadow-md shadow-orange-950/40"
                                  >
                                    <Mail className="w-4 h-4" />
                                    <span>Email à {member.email} ({montantAbs} €)</span>
                                  </a>
                                ) : (
                                  <span className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-zinc-800 text-zinc-400 text-xs font-bold flex items-center justify-center gap-2">
                                    <Mail className="w-4 h-4 text-amber-400" />
                                    <span>Adresse email manquante</span>
                                  </span>
                                )
                              )}

                              <button
                                type="button"
                                onClick={() => triggerCopy(relanceText, 'Relance copiée')}
                                className="min-h-[44px] px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copier</span>
                              </button>
                            </div>
                          </div>
                        );
                      }}
                      onMarkSent={() => markStatusAndAdvance(currentMember.id, 'sent')}
                      onSkip={() => markStatusAndAdvance(currentMember.id, 'skipped')}
                    />
                  </div>
                )
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 bg-[#171c26] border-t border-[#252c3a] flex items-center justify-between gap-2 shrink-0 text-xs">
          <span className="text-zinc-400">
            {mode === 'sms' && smsSubMode === 'groupe'
              ? `${membersWithPhone.length} numéro(s) prêt(s)`
              : queueList.length > 0
                ? `${sentCount} / ${queueList.length} marqué(s) envoyé(s)`
                : 'Aucun envoi requis'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold transition cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
};

interface IndividualQueuePanelProps {
  queueList: Adherent[];
  currentIndex: number;
  sentMap: Record<string, 'sent' | 'skipped'>;
  modeKey: string;
  sentCount: number;
  showAmountBadge?: boolean;
  onSelectIndex: (idx: number) => void;
  renderAction: (member: Adherent) => React.ReactNode;
  onMarkSent: () => void;
  onSkip: () => void;
}

const IndividualQueuePanel: React.FC<IndividualQueuePanelProps> = ({
  queueList,
  currentIndex,
  sentMap,
  modeKey,
  sentCount,
  showAmountBadge = false,
  onSelectIndex,
  renderAction,
  onMarkSent,
  onSkip,
}) => {
  const current = queueList[currentIndex];
  if (!current) return null;

  const progressPct = queueList.length > 0 ? Math.round((sentCount / queueList.length) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Barre de progression & liste cliquable des destinataires */}
      <div className="p-3 bg-[#10131b] rounded-2xl border border-zinc-800 space-y-2.5">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-bold text-zinc-300">
            Envoi individuel : <span className="text-white font-black">{currentIndex + 1} / {queueList.length}</span>
          </span>
          <span className="text-[11px] font-bold text-emerald-400">
            {sentCount}/{queueList.length} envoyé{sentCount > 1 ? 's' : ''} ({progressPct}%)
          </span>
        </div>

        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#E65100] to-emerald-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
          {queueList.map((m, idx) => {
            const st = sentMap[`${modeKey}:${m.id}`];
            const isCurrent = idx === currentIndex;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelectIndex(idx)}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                  isCurrent
                    ? 'bg-[#E65100]/30 text-white border-[#FF6D00] ring-1 ring-[#FF6D00]'
                    : st === 'sent'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                      : st === 'skipped'
                        ? 'bg-zinc-800/80 text-zinc-500 border-zinc-700 line-through'
                        : 'bg-[#171c26] text-zinc-300 border-zinc-700 hover:border-zinc-500'
                }`}
              >
                {st === 'sent' && <Check className="w-3 h-3 text-emerald-400" />}
                <span>{m.nomPrenom}</span>
                {showAmountBadge && (
                  <span className="text-rose-300 font-mono">({Math.abs(m.soldeDu)}€)</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Carte du destinataire actif */}
      <div className="p-3.5 bg-[#171c26] rounded-2xl border border-[#2c3547] space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-heading font-black text-white text-sm sm:text-base truncate">
              {current.nomPrenom}
            </h3>
            <p className="text-[11px] text-zinc-400 truncate">
              {current.groupeEnseignement || current.formuleCours || 'Adhérent TCM'}
              {current.telephonePortable
                ? ` • ${formatFrenchPhoneNumber(current.telephonePortable)}`
                : ''}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => onSelectIndex(Math.max(0, currentIndex - 1))}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-300 cursor-pointer disabled:cursor-not-allowed"
              title="Précédent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={currentIndex >= queueList.length - 1}
              onClick={() => onSelectIndex(Math.min(queueList.length - 1, currentIndex + 1))}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-300 cursor-pointer disabled:cursor-not-allowed"
              title="Suivant"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {renderAction(current)}

        {/* Contrôles d'avancement */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800/80 text-xs">
          <button
            type="button"
            onClick={onSkip}
            className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <SkipForward className="w-3.5 h-3.5" />
            <span>Passer</span>
          </button>

          <button
            type="button"
            onClick={onMarkSent}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-500/40 font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {currentIndex < queueList.length - 1 ? 'Marquer envoyé & suivant' : 'Marquer envoyé'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
