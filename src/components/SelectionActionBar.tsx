import React from 'react';
import { createPortal } from 'react-dom';
import {
  CheckSquare,
  Square,
  MessageSquare,
  MessageCircle,
  AlertCircle,
  FileText,
  X,
} from 'lucide-react';
import { Adherent } from '../types/tennis';
import { toSmsRecipient } from '../utils/phoneUtils';

interface SelectionActionBarProps {
  selectedMembers: Adherent[];
  visibleIds: string[];
  canIssueAttestation: boolean;
  onSelectAllVisible: () => void;
  onDeselectAll: () => void;
  onExit: () => void;
  onOpenSms: () => void;
  onOpenWhatsApp: () => void;
  onOpenRelance: () => void;
  onOpenAttestations: () => void;
}

export const SelectionActionBar: React.FC<SelectionActionBarProps> = ({
  selectedMembers,
  visibleIds,
  canIssueAttestation,
  onSelectAllVisible,
  onDeselectAll,
  onExit,
  onOpenSms,
  onOpenWhatsApp,
  onOpenRelance,
  onOpenAttestations,
}) => {
  const count = selectedMembers.length;
  const phoneCount = selectedMembers.filter((m) => Boolean(toSmsRecipient(m.telephonePortable))).length;
  const dueCount = selectedMembers.filter((m) => m.soldeDu < 0).length;
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedMembers.some((m) => m.id === id));

  const barContent = (
    <div className="fixed bottom-[74px] md:bottom-5 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1rem)] max-w-4xl pointer-events-auto animate-fadeIn">
      <div className="bg-[#121722]/95 backdrop-blur-xl border-2 border-[#FF6D00]/70 rounded-2xl shadow-2xl shadow-black/80 px-3 py-2.5 sm:px-4 sm:py-3 space-y-2">
        {/* Ligne 1 : Compteur + Tout cocher / Décocher / Quitter */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-2.5 py-0.5 rounded-lg bg-[#E65100] text-white text-xs font-heading font-black tabular-nums shadow-sm">
              {count} sélectionné{count > 1 ? 's' : ''}
            </span>
            <span className="text-[11px] text-zinc-400 hidden sm:inline">
              Appuyez sur une carte pour cocher ou décocher
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px]">
            {visibleIds.length > 0 && (
              <button
                type="button"
                onClick={allVisibleSelected ? onDeselectAll : onSelectAllVisible}
                className="px-2.5 py-1 rounded-lg bg-[#1b2230] hover:bg-[#252f42] text-zinc-200 border border-zinc-700 font-bold transition flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                {allVisibleSelected ? (
                  <>
                    <Square className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Tout décocher</span>
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-3.5 h-3.5 text-[#FF6D00]" />
                    <span>Tout cocher ({visibleIds.length})</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onExit}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 font-bold transition flex items-center gap-1 cursor-pointer"
              title="Quitter le mode sélection"
            >
              <X className="w-3.5 h-3.5" />
              <span>Annuler</span>
            </button>
          </div>
        </div>

        {/* Ligne 2 : Boutons d'actions groupées */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            disabled={count === 0}
            onClick={onOpenSms}
            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-sky-600/20 hover:bg-sky-600/35 disabled:opacity-40 text-sky-200 border border-sky-500/40 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
            title="Envoyer un SMS groupé ou individuel identique à chacun"
          >
            <MessageSquare className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="truncate">SMS ({phoneCount})</span>
          </button>

          <button
            type="button"
            disabled={count === 0}
            onClick={onOpenWhatsApp}
            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/35 disabled:opacity-40 text-emerald-200 border border-emerald-500/40 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
            title="Envoyer via WhatsApp"
          >
            <MessageCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">WhatsApp ({phoneCount})</span>
          </button>

          <button
            type="button"
            disabled={count === 0}
            onClick={onOpenRelance}
            className={`min-h-[40px] px-3 py-1.5 rounded-xl disabled:opacity-40 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed border ${
              dueCount > 0
                ? 'bg-rose-600/25 hover:bg-rose-600/40 text-rose-200 border-rose-500/50'
                : 'bg-zinc-800/70 hover:bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}
            title="Rappel de cotisation personnalisé (envoi séparé par montant dû)"
          >
            <AlertCircle className={`w-4 h-4 shrink-0 ${dueCount > 0 ? 'text-rose-400' : 'text-zinc-500'}`} />
            <span className="truncate">Relance ({dueCount})</span>
          </button>

          {canIssueAttestation && (
            <button
              type="button"
              disabled={count === 0}
              onClick={onOpenAttestations}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 disabled:opacity-40 text-amber-200 border border-amber-500/45 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed sm:ml-auto"
              title="Préparer et envoyer les attestations PDF une par une avec paramètres personnels"
            >
              <FileText className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="truncate">Attestations ({count})</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(barContent, document.body);
  }
  return barContent;
};
