import React from 'react';
import { 
  X, 
  Lock, 
  FileSpreadsheet, 
  AlertTriangle, 
  Calendar, 
  CheckCircle2, 
  UserCheck, 
  ArrowRight,
  ShieldCheck,
  Clock,
  MapPin,
  Layers
} from 'lucide-react';
import { Adherent, Rencontre, MatchComposition } from '../types/tennis';

interface ConfirmSaveCompositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  rencontre: Rencontre;
  composition: MatchComposition;
  adherentsById: Map<string, Adherent>;
  spreadsheetName: string;
  isSaving: boolean;
}

export const ConfirmSaveCompositionModal: React.FC<ConfirmSaveCompositionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  rencontre,
  composition,
  adherentsById,
  spreadsheetName,
  isSaving,
}) => {
  if (!isOpen) return null;

  const slots = [
    { label: 'Simple 1', id: composition.simple1Id },
    { label: 'Simple 2', id: composition.simple2Id },
    { label: 'Simple 3', id: composition.simple3Id },
    { label: 'Simple 4', id: composition.simple4Id },
    { label: 'Simple 5', id: composition.simple5Id },
    { label: 'Double 1 (Joueur 1)', id: composition.double1Player1Id },
    { label: 'Double 1 (Joueur 2)', id: composition.double1Player2Id },
    { label: 'Double 2 (Joueur 1)', id: composition.double2Player1Id },
    { label: 'Double 2 (Joueur 2)', id: composition.double2Player2Id },
  ].filter(s => Boolean(s.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div 
        className="bg-[#12151b] border border-orange-500/40 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl shadow-orange-950/50 flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="p-5 sm:p-6 border-b border-[#252b36] bg-gradient-to-r from-orange-950/30 via-zinc-900 to-[#12151b] flex items-start justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#BF360C] to-[#E65100] border border-orange-400/30 flex items-center justify-center text-white shadow-lg shadow-orange-950/50">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-black text-white text-lg sm:text-xl">
                  Enregistrer dans Données_appli
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> Classement Figé
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Feuille de calcul : <span className="font-semibold text-zinc-200">{spreadsheetName}</span> • Onglet : <code className="text-[#FF6D00] bg-black/40 px-1.5 py-0.5 rounded font-mono">Compositions_Equipes</code>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-sm">
          
          {/* Récap rencontre & Logistique TCM */}
          <div className="p-4 rounded-2xl bg-[#090b0e] border border-[#232934] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold text-[#FF6D00] uppercase tracking-wider">
                  {rencontre.libelleHomologation}
                </span>
                <h4 className="font-heading font-black text-white text-base">
                  {rencontre.numeroEquipe} ({rencontre.sexeHomologation} - {rencontre.categorieAgeHomologation})
                </h4>
                <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Date validée : <strong className="text-zinc-200">{composition.dateRencontreValidee || rencontre.dateRencontre}</strong></span>
                </p>
              </div>
              <div className="text-right sm:border-l sm:border-[#232934] sm:pl-4">
                <span className="text-[11px] text-zinc-400">Match :</span>
                <p className="font-bold text-white text-xs sm:text-sm">
                  {rencontre.clubAccueilNom} <span className="text-orange-400">vs</span> {rencontre.clubVisiteurNom}
                </p>
              </div>
            </div>

            {/* Badges logistiques TCM (Heure, Lieu, Courts) */}
            <div className="pt-2.5 border-t border-[#1e2430] grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded-xl bg-black/40 border border-[#232934] flex items-center space-x-2">
                <Clock className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                <span className="text-zinc-400">Heure : <strong className="text-white">{composition.heureDebut || '09:00'}</strong></span>
              </div>

              <div className="p-2 rounded-xl bg-black/40 border border-[#232934] flex items-center space-x-2">
                <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-zinc-400 truncate">Lieu : <strong className="text-white truncate">{composition.lieuRencontre || 'Clos des Moines'}</strong></span>
              </div>

              <div className="p-2 rounded-xl bg-black/40 border border-[#232934] flex items-center space-x-2">
                <Layers className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="text-zinc-400">Courts : <strong className="text-white">{composition.nombreCourts || 2} court(s)</strong></span>
              </div>
            </div>
          </div>

          {/* Règle du Gel du Classement */}
          <div className="p-4 rounded-2xl bg-orange-950/20 border border-orange-500/30 flex items-start space-x-3">
            <Lock className="w-5 h-5 text-[#FF6D00] shrink-0 mt-0.5" />
            <div className="text-xs text-zinc-300 space-y-1">
              <p className="font-bold text-white text-sm">
                Garantie de non-altération rétroactive
              </p>
              <p className="text-zinc-300">
                Les classements et informations ci-dessous seront <strong>définitivement enregistrés tels quels</strong> pour cette date. Lors de la publication du prochain classement mensuel FFT, ces valeurs resteront figées pour préserver l'intégrité de la feuille de match officielle.
              </p>
            </div>
          </div>

          {/* Liste des Joueurs et Classements Gelés */}
          <div>
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-orange-400" />
              <span>Snapshot des {slots.length} joueur(s) retenus</span>
            </h4>

            <div className="rounded-2xl border border-[#232934] bg-[#090b0e] overflow-hidden divide-y divide-[#1e2430]">
              {slots.map((s, idx) => {
                const player = adherentsById.get(s.id!);
                return (
                  <div key={idx} className="p-3 sm:px-4 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center space-x-3">
                      <span className="w-6 h-6 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 font-extrabold flex items-center justify-center text-[11px]">
                        {idx + 1}
                      </span>
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 uppercase">
                          {s.label}
                        </span>
                        <p className="font-heading font-black text-white text-sm">
                          {player?.nomPrenom || 'Joueur inconnu'}
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          Licence : <span className="font-mono text-zinc-300">{player?.licence || 'N/A'}</span> • Catégorie : <span className="text-zinc-300">{player?.ageSportif || 'Senior'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="px-2.5 py-1 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-300 font-black text-xs flex items-center gap-1.5">
                        <Lock className="w-3 h-3 text-[#FF6D00]" />
                        <span>Classement gelé : {player?.dernierClassTennis || 'NC'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Pied de page avec actions */}
        <div className="p-5 sm:p-6 border-t border-[#252b36] bg-[#0a0d12] flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-zinc-700 hover:bg-zinc-800 text-zinc-300 font-bold text-xs transition cursor-pointer disabled:opacity-50"
          >
            Annuler
          </button>
          
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSaving}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#BF360C] to-[#E65100] hover:from-[#d84315] hover:to-[#f57c00] text-white font-black text-xs shadow-lg shadow-orange-950/50 transition cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                <span>Écriture dans Google Sheets...</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4" />
                <span>Confirmer et Enregistrer dans Données_appli</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
