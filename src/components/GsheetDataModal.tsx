import React, { useState } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  Check, 
  Copy, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  Info,
  Sliders,
  Database,
  Calendar,
  ShieldAlert,
  ShieldCheck,
  MapPin,
  ExternalLink
} from 'lucide-react';
import { 
  GSHEET_ADHERENTS_HEADERS, 
  GSHEET_RENCONTRES_HEADERS 
} from '../data/clubData';

interface GsheetDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalMembers: number;
  totalRencontres: number;
  defaultTab?: 'mapping' | 'soldes' | 'sync';
  onRefreshFromFile?: () => Promise<void> | void;
  isLoadingFile?: boolean;
}

export const GsheetDataModal: React.FC<GsheetDataModalProps> = ({
  isOpen,
  onClose,
  totalMembers,
  totalRencontres,
  defaultTab = 'mapping',
  onRefreshFromFile,
  isLoadingFile = false,
}) => {
  const [activeTab, setActiveTab] = useState<'mapping' | 'soldes' | 'sync'>(defaultTab);
  const [copiedType, setCopiedType] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-4xl bg-[#141820] border border-[#2b3342] rounded-3xl overflow-hidden shadow-2xl my-4 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="p-5 border-b border-[#252b37] bg-gradient-to-r from-[#1b202a] to-[#12151b] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-950/60 font-black">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-black text-white text-base sm:text-lg">
                Architecture Classeur GSheet (Données_appli)
              </h2>
              <p className="text-xs text-zinc-400">
                Liaison directe avec Google Sheets sans aucun import CSV • Données officielles FFT 2027
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation sous-onglets */}
        <div className="px-5 pt-3 pb-2 border-b border-[#252b37] flex items-center justify-between bg-[#101319] text-xs flex-wrap gap-2">
          <div className="flex space-x-2 flex-wrap gap-y-1">
            <button
              onClick={() => setActiveTab('mapping')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'mapping'
                  ? 'bg-[#E65100] text-white shadow'
                  : 'text-zinc-400 hover:text-white bg-[#191e28]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Cartographie Colonnes (66 & 41)</span>
            </button>

            <button
              onClick={() => setActiveTab('soldes')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'soldes'
                  ? 'bg-[#E65100] text-white shadow'
                  : 'text-zinc-400 hover:text-white bg-[#191e28]'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>Règles Soldes, Dettes & Attestations</span>
            </button>

            <button
              onClick={() => setActiveTab('sync')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'sync'
                  ? 'bg-[#E65100] text-white shadow'
                  : 'text-zinc-400 hover:text-white bg-[#191e28]'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Flux Direct GSheet (Zéro CSV)</span>
            </button>
          </div>

          <div className="text-[11px] text-zinc-400 flex items-center gap-2">
            <span>Adhérents : <strong className="text-white">{totalMembers}</strong></span>
            <span>•</span>
            <span>Rencontres : <strong className="text-white">{totalRencontres}</strong></span>
          </div>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-xs">
          
          {/* ==================== SOUS-ONGLET 1 : MAPPING ==================== */}
          {activeTab === 'mapping' && (
            <div className="space-y-6">
              
              {/* Onglet Adhérents (66 colonnes) */}
              <div className="p-4 rounded-2xl bg-[#161a22] border border-[#252b37] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                    <h3 className="font-heading font-black text-white text-sm">
                      Feuille 1 : 'Adhérents' — 66 colonnes officielles
                    </h3>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-bold">{totalMembers} membres connectés</span>
                </div>

                <p className="text-zinc-400 text-xs leading-relaxed">
                  Toutes les données de vos licenciés proviennent directement de votre classeur. Les soldes sont traités automatiquement :
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-2">
                  <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-800">
                    <span className="text-[10px] text-orange-400 font-bold block">Identité & Sexe FFT</span>
                    <strong className="text-white text-xs">Nom Prénom, Nom, Prénom, Civilité</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-800">
                    <span className="text-[10px] text-rose-400 font-bold block">Solde Club (&lt; 0 = Dû, &gt; 0 = Régul)</span>
                    <strong className="text-white text-xs">Solde, Échéances à venir</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-800">
                    <span className="text-[10px] text-amber-400 font-bold block">Âge & Millésime 2027</span>
                    <strong className="text-white text-xs">Date Naiss., Age., Age sportif</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-800">
                    <span className="text-[10px] text-emerald-400 font-bold block">Licence & Statut FFT</span>
                    <strong className="text-white text-xs">Licence, Millésime dernière Licence</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-800">
                    <span className="text-[10px] text-blue-400 font-bold block">Classements Officiels (et ND)</span>
                    <strong className="text-white text-xs">Dernier class. tennis, Meilleur class.</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-800">
                    <span className="text-[10px] text-purple-400 font-bold block">Contact & Enseignement</span>
                    <strong className="text-white text-xs">Téléphone Portable, Email, Groupe</strong>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => copyToClipboard(GSHEET_ADHERENTS_HEADERS.join('\t'), 'adh_headers')}
                    className="px-3 py-1.5 rounded-xl bg-[#202734] hover:bg-[#283243] text-zinc-300 hover:text-white transition flex items-center gap-1.5 cursor-pointer text-xs"
                  >
                    {copiedType === 'adh_headers' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-orange-400" />}
                    <span>Copier les 66 en-têtes officiels</span>
                  </button>
                </div>
              </div>

              {/* Onglet Rencontres (41 colonnes incluant AM-AO) */}
              <div className="p-4 rounded-2xl bg-[#161a22] border border-[#252b37] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#E65100]"></span>
                    <h3 className="font-heading font-black text-white text-sm">
                      Feuille 2 : 'Rencontres' — 41 colonnes (Adresses adverses AM à AO)
                    </h3>
                  </div>
                  <span className="text-[11px] text-orange-400 font-bold">{totalRencontres} rencontres synchronisées</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-2">
                  <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-800">
                    <span className="text-[10px] text-orange-400 font-bold block">Compétition & Catégorie</span>
                    <strong className="text-white text-xs">Niveau, Libellé, Sexe, Catégorie d'âge</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-800">
                    <span className="text-[10px] text-blue-400 font-bold block">Division, Poule & Date</span>
                    <strong className="text-white text-xs">Division, Poule, Date, Journée n°</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-800">
                    <span className="text-[10px] text-purple-400 font-bold block">Clubs Accueil & Visiteur</span>
                    <strong className="text-white text-xs">Club d'accueil, Club visiteur, Score</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-800 col-span-1 sm:col-span-2 md:col-span-3 border-emerald-500/40 bg-emerald-950/20">
                    <span className="text-[10px] text-emerald-400 font-bold block flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      Colonnes AM, AN, AO (Adresse automatique club adverse si déplacement)
                    </span>
                    <strong className="text-white text-xs block mt-1">
                      AM: adresse1Installation • AN: adresse2Installation • AO: codePostalInstallation / villeInstallation
                    </strong>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Lorsque TCM joue à l'extérieur, l'application extrait automatiquement cette adresse officielle pour guider les joueurs et le GPS via Waze/Google Maps.
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => copyToClipboard(GSHEET_RENCONTRES_HEADERS.join('\t'), 'ren_headers')}
                    className="px-3 py-1.5 rounded-xl bg-[#202734] hover:bg-[#283243] text-zinc-300 hover:text-white transition flex items-center gap-1.5 cursor-pointer text-xs"
                  >
                    {copiedType === 'ren_headers' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-orange-400" />}
                    <span>Copier les 41 en-têtes rencontres</span>
                  </button>
                </div>
              </div>

              {/* Onglet Compositions_Equipes (20 colonnes) */}
              <div className="p-4 rounded-2xl bg-[#161a22] border border-[#252b37] space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
                  <h3 className="font-heading font-black text-white text-sm">
                    Feuille 3 : 'Compositions_Equipes' — Sauvegarde 20 colonnes avec classements figés
                  </h3>
                </div>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  Toute feuille de match validée par un capitaine ou membre du bureau est enregistrée avec les classements officiels figés au jour J : ID Rencontre, Date, Simple 1 à 5, Double 1 (J1/J2), Double 2 (J1/J2), Capitaine, Lieu et Horaires de rotation.
                </p>
              </div>

            </div>
          )}

          {/* ==================== SOUS-ONGLET 2 : SOLDES ==================== */}
          {activeTab === 'soldes' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#161a22] border border-[#252b37] space-y-3">
                <h3 className="font-heading font-black text-white text-sm flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>Gestion des Soldes de Cotisation & Échéances</span>
                </h3>
                
                <div className="space-y-2 text-zinc-300">
                  <div className="p-3 bg-black/40 rounded-xl border border-rose-500/30 flex items-start space-x-3">
                    <span className="font-black text-rose-400 text-sm shrink-0">Solde &lt; 0 €</span>
                    <div className="space-y-0.5">
                      <strong className="text-white block">Cotisation ou cours non réglés (Dû au club)</strong>
                      <p className="text-zinc-400 text-[11px]">
                        L'onglet Enseignants permet aux professeurs d'envoyer en 1 clic un SMS ou email de relance personnalisé avec le montant exact dû et les coordonnées du club.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-black/40 rounded-xl border border-emerald-500/30 flex items-start space-x-3">
                    <span className="font-black text-emerald-400 text-sm shrink-0">Solde &ge; 0 €</span>
                    <div className="space-y-0.5">
                      <strong className="text-white block">Cotisation à jour</strong>
                      <p className="text-zinc-400 text-[11px]">
                        Débloque la génération automatique de l'attestation officielle de paiement pour employeur, CE, Pass'Sport ou CAF.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-black/40 rounded-xl border border-amber-500/30 flex items-start space-x-3">
                    <span className="font-black text-amber-400 text-sm shrink-0">Solde &gt; 0 €</span>
                    <div className="space-y-0.5">
                      <strong className="text-white block">Avoir en faveur de l'adhérent / Régularisation</strong>
                      <p className="text-zinc-400 text-[11px]">
                        Sur-paiement ou réduction famille nombreuse à déduire lors du renouvellement de la saison FFT suivante.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== SOUS-ONGLET 3 : SYNC DIRECT GSheet ==================== */}
          {activeTab === 'sync' && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-[#161a22] border border-[#252b37] space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#BF360C] to-[#E65100] text-white flex items-center justify-center font-bold">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-heading font-black text-white text-sm">
                      Zéro Fichier CSV — Connexion Directe au Classeur Google Sheets
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Conformément à vos directives, aucun import de fichier CSV n'est requis dans l'application.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 bg-black/50 rounded-2xl border border-zinc-800 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Toutes les données sont synchronisées en direct :</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-zinc-300 text-[11px]">
                    <li>Rechargement automatique lors de la reprise du focus navigateur.</li>
                    <li>Synchronisation instantanée avec votre Web App Google Apps Script ou l'API Google Drive.</li>
                    <li>Enregistrement direct des compositions et classements figés dans la feuille <code>Compositions_Equipes</code>.</li>
                  </ul>
                </div>

                {onRefreshFromFile && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-zinc-400 text-xs">
                      Recharger immédiatement les données du classeur :
                    </span>
                    <button
                      onClick={() => onRefreshFromFile()}
                      disabled={isLoadingFile}
                      className="px-4 py-2 rounded-xl bg-[#E65100] hover:bg-[#FF6D00] disabled:opacity-50 text-white font-bold transition flex items-center gap-2 cursor-pointer shadow-lg shadow-orange-950 text-xs"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFile ? 'animate-spin' : ''}`} />
                      <span>{isLoadingFile ? 'Synchronisation...' : 'Rafraîchir depuis Données_appli'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Pied de page */}
        <div className="p-4 border-t border-[#252b37] bg-[#11141a] flex items-center justify-between">
          <span className="text-[11px] text-zinc-500">
            Muzillac Tennis Club • Liaison native Google Sheets
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition cursor-pointer"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
};
