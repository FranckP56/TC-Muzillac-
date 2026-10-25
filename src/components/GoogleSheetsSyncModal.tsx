import React, { useState, useEffect } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Lock, 
  Check, 
  Database, 
  ArrowRight,
  LogOut,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { User } from 'firebase/auth';
import { googleSignIn, logout, getAccessToken } from '../services/auth';
import { 
  searchDonneesAppliFiles, 
  GoogleDriveFile, 
  getSpreadsheetTabs,
  readAdherentsFromSheet,
  readRencontresFromSheet,
  readCompositionsFromSheet,
  COMPOSITIONS_SHEET_TITLE
} from '../services/googleSheets';
import { Adherent, Rencontre, MatchComposition } from '../types/tennis';

interface GoogleSheetsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onUserChange: (user: User | null) => void;
  selectedSpreadsheetId: string | null;
  onSelectSpreadsheet: (id: string, name: string) => void;
  spreadsheetName: string;
  onDataLoaded: (adherents: Adherent[], rencontres: Rencontre[], compositionsMap?: Map<string, { composition: MatchComposition }>) => void;
}

export const GoogleSheetsSyncModal: React.FC<GoogleSheetsSyncModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserChange,
  selectedSpreadsheetId,
  onSelectSpreadsheet,
  spreadsheetName,
  onDataLoaded,
}) => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [isSearchingFiles, setIsSearchingFiles] = useState(false);
  const [foundFiles, setFoundFiles] = useState<GoogleDriveFile[]>([]);
  const [customIdInput, setCustomIdInput] = useState('');
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [detectedTabs, setDetectedTabs] = useState<string[]>([]);
  const [lastSyncResult, setLastSyncResult] = useState<{
    adherentsCount: number;
    rencontresCount: number;
    compositionsCount: number;
    timestamp: string;
  } | null>(null);

  // Recherche automatique des fichiers "Données_appli" dès qu'on est connecté
  useEffect(() => {
    if (isOpen && currentUser) {
      handleSearchSpreadsheets();
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const res = await googleSignIn();
      if (res) {
        onUserChange(res.user);
        await searchFilesWithToken(res.accessToken);
      }
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || 'Échec de connexion Google.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    onUserChange(null);
    setFoundFiles([]);
    setDetectedTabs([]);
  };

  const searchFilesWithToken = async (token: string) => {
    setIsSearchingFiles(true);
    try {
      const files = await searchDonneesAppliFiles(token);
      setFoundFiles(files);
      if (files.length > 0 && !selectedSpreadsheetId) {
        // Sélectionner par défaut le premier fichier "Données_appli"
        onSelectSpreadsheet(files[0].id, files[0].name);
        checkTabs(files[0].id, token);
      }
    } catch (e: any) {
      console.warn('Recherche drive échouée:', e);
    } finally {
      setIsSearchingFiles(false);
    }
  };

  const handleSearchSpreadsheets = async () => {
    const token = await getAccessToken();
    if (!token) return;
    await searchFilesWithToken(token);
  };

  const checkTabs = async (id: string, token: string) => {
    try {
      const tabs = await getSpreadsheetTabs(id, token);
      setDetectedTabs(tabs);
    } catch (e) {
      console.warn(e);
    }
  };

  const handleSelectFile = async (file: GoogleDriveFile) => {
    onSelectSpreadsheet(file.id, file.name);
    const token = await getAccessToken();
    if (token) {
      checkTabs(file.id, token);
    }
  };

  const handleApplyCustomId = async () => {
    if (!customIdInput.trim()) return;
    let cleanId = customIdInput.trim();
    if (cleanId.includes('/d/')) {
      cleanId = cleanId.split('/d/')[1].split('/')[0];
    }
    onSelectSpreadsheet(cleanId, 'Classeur Données_appli');
    const token = await getAccessToken();
    if (token) {
      checkTabs(cleanId, token);
    }
  };

  // Synchronisation directe sans CSV
  const handlePerformSync = async () => {
    if (!selectedSpreadsheetId) return;
    setIsSyncing(true);
    setSyncStatus('Connexion directe à Google Sheets...');

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Jeton d'accès Google expiré. Veuillez vous reconnecter.");
      }

      setSyncStatus("Lecture de l'onglet 'Adhérents'...");
      const adherents = await readAdherentsFromSheet(selectedSpreadsheetId, token, 'Adhérents');

      setSyncStatus("Lecture de l'onglet 'Rencontres'...");
      const rencontres = await readRencontresFromSheet(selectedSpreadsheetId, token, 'Rencontres');

      setSyncStatus("Lecture de l'onglet 'Compositions_Equipes'...");
      const compositionsMap = await readCompositionsFromSheet(selectedSpreadsheetId, token);

      // Associer les compositions gelées aux rencontres
      const enrichedRencontres = rencontres.map(r => {
        const saved = compositionsMap.get(r.id);
        if (saved) {
          return {
            ...r,
            composition: saved.composition,
          };
        }
        return r;
      });

      onDataLoaded(adherents, enrichedRencontres, compositionsMap as any);

      const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      setLastSyncResult({
        adherentsCount: adherents.length,
        rencontresCount: rencontres.length,
        compositionsCount: compositionsMap.size,
        timestamp: now,
      });

      setSyncStatus(`Synchronisation terminée avec succès ! (${adherents.length} adhérents, ${rencontres.length} rencontres)`);
      setTimeout(() => setSyncStatus(null), 4000);
    } catch (err: any) {
      console.error(err);
      setSyncStatus(`Erreur de synchronisation : ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div 
        className="bg-[#12151b] border border-orange-500/30 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl shadow-orange-950/50 flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* En-tête modal */}
        <div className="p-5 sm:p-6 border-b border-[#252b36] bg-gradient-to-r from-orange-950/20 via-zinc-900 to-[#12151b] flex items-start justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 border border-emerald-400/30 flex items-center justify-center text-white shadow-lg shadow-emerald-950/50">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-heading font-black text-white text-lg sm:text-xl">
                  Accès Direct Google Sheets
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#FF6D00]/15 text-[#FF6D00] border border-[#FF6D00]/30">
                  Sans import CSV
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Connexion directe au fichier <code className="text-emerald-400 font-mono">Données_appli</code> du TC Muzillac
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps modal */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
          
          {/* Étape 1 : Authentification Google */}
          {!currentUser ? (
            <div className="p-5 rounded-2xl bg-[#090b0e] border border-[#232934] text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-[#FF6D00]">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-heading font-black text-white text-base">
                  Connectez votre compte Google
                </h4>
                <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1">
                  Connectez l'adresse du club (<strong>tennisclubmuzillac@gmail.com</strong>) pour synchroniser en 1 clic les adhérents et rencontres, et enregistrer les feuilles d'équipes gelées.
                </p>
              </div>

              {/* Bouton officiel Sign in with Google (Google guidelines) */}
              <div className="flex justify-center pt-2">
                <button 
                  onClick={handleSignIn}
                  disabled={isSigningIn}
                  className="gsi-material-button inline-flex items-center justify-center bg-white hover:bg-zinc-100 text-zinc-900 font-semibold px-4 py-2.5 rounded-xl shadow transition cursor-pointer disabled:opacity-50"
                >
                  <div className="gsi-material-button-icon mr-3">
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                  </div>
                  <span className="text-sm font-bold">
                    {isSigningIn ? 'Connexion en cours...' : 'Se connecter avec Google'}
                  </span>
                </button>
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  {authError}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Profil connecté */}
              <div className="p-4 rounded-2xl bg-[#090b0e] border border-[#232934] flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold">
                    {currentUser.email ? currentUser.email[0].toUpperCase() : 'G'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs sm:text-sm">
                        {currentUser.displayName || 'Compte Google'}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        Connecté
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 font-mono">
                      {currentUser.email}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleSignOut}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-zinc-700 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold transition cursor-pointer"
                  title="Déconnexion"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Déconnexion</span>
                </button>
              </div>

              {/* Sélection du fichier Données_appli */}
              <div className="p-4 rounded-2xl bg-[#090b0e] border border-[#232934] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-[#FF6D00]" />
                    <span>Classeur Google Sheets associé</span>
                  </label>
                  
                  <button
                    onClick={handleSearchSpreadsheets}
                    disabled={isSearchingFiles}
                    className="text-[11px] text-orange-400 hover:text-orange-300 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSearchingFiles ? 'animate-spin' : ''}`} />
                    <span>Rechercher sur Drive</span>
                  </button>
                </div>

                {foundFiles.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-zinc-400">
                      Fichiers détectés automatiquement sur votre Drive :
                    </p>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {foundFiles.map(file => {
                        const isSelected = selectedSpreadsheetId === file.id;
                        return (
                          <div
                            key={file.id}
                            onClick={() => handleSelectFile(file)}
                            className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                              isSelected
                                ? 'bg-orange-500/15 border-orange-500/50 text-white'
                                : 'bg-black/30 border-[#232934] text-zinc-300 hover:border-zinc-700'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5 truncate">
                              <FileSpreadsheet className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[#FF6D00]' : 'text-zinc-500'}`} />
                              <span className="font-bold text-xs truncate">{file.name}</span>
                            </div>
                            <div className="flex items-center space-x-2 shrink-0">
                              {isSelected ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-orange-500 text-white">
                                  Sélectionné
                                </span>
                              ) : (
                                <span className="text-[10px] text-zinc-500">Choisir</span>
                              )}
                              {file.webViewLink && (
                                <a
                                  href={file.webViewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className="p-1 text-zinc-400 hover:text-white"
                                  title="Ouvrir dans Google Sheets"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-zinc-400">
                    {isSearchingFiles ? 'Recherche des fichiers Google Sheets en cours...' : 'Aucun fichier Données_appli trouvé automatiquement. Vous pouvez coller le lien ou ID ci-dessous.'}
                  </div>
                )}

                {/* Saisie manuelle de l'URL ou ID si besoin */}
                <div className="pt-2 border-t border-[#1e2430] flex items-center space-x-2">
                  <input
                    type="text"
                    value={customIdInput}
                    onChange={e => setCustomIdInput(e.target.value)}
                    placeholder="Coller l'ID ou l'URL du Google Sheet Données_appli..."
                    className="flex-1 bg-black/40 border border-[#2a323f] rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
                  />
                  <button
                    onClick={handleApplyCustomId}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Valider ID
                  </button>
                </div>
              </div>

              {/* Onglets Détectés dans Données_appli */}
              {selectedSpreadsheetId && (
                <div className="p-4 rounded-2xl bg-[#090b0e] border border-[#232934] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Onglets connectés</span>
                    </span>
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${selectedSpreadsheetId}/edit`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                    >
                      <span>Ouvrir le classeur</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                    <div className="p-2 rounded-xl bg-black/30 border border-[#232934] flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        <span className="font-semibold text-zinc-200">Adhérents</span>
                      </div>
                      <span className="text-[10px] text-zinc-500">66 col.</span>
                    </div>

                    <div className="p-2 rounded-xl bg-black/30 border border-[#232934] flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        <span className="font-semibold text-zinc-200">Rencontres</span>
                      </div>
                      <span className="text-[10px] text-zinc-500">41 col.</span>
                    </div>

                    <div className="p-2 rounded-xl bg-black/30 border border-orange-500/30 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Lock className="w-3 h-3 text-[#FF6D00]" />
                        <span className="font-semibold text-orange-200">{COMPOSITIONS_SHEET_TITLE}</span>
                      </div>
                      <span className="text-[10px] text-orange-400">Gelé</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Statut ou message d'action */}
              {syncStatus && (
                <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-300 text-xs flex items-center gap-2">
                  <RefreshCw className={`w-4 h-4 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{syncStatus}</span>
                </div>
              )}

              {/* Résumé de dernière synchro */}
              {lastSyncResult && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>
                      Dernière lecture : <strong>{lastSyncResult.adherentsCount}</strong> adhérents et <strong>{lastSyncResult.rencontresCount}</strong> rencontres chargées à {lastSyncResult.timestamp}.
                    </span>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Pied de page modal */}
        <div className="p-5 sm:p-6 border-t border-[#252b36] bg-[#0a0d12] flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-zinc-700 hover:bg-zinc-800 text-zinc-300 font-bold text-xs transition cursor-pointer"
          >
            Fermer
          </button>
          
          {currentUser && (
            <button
              type="button"
              onClick={handlePerformSync}
              disabled={isSyncing || !selectedSpreadsheetId}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-black text-xs shadow-lg shadow-emerald-950/50 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>
                {isSyncing ? 'Lecture en cours...' : 'Synchroniser Données_appli (sans CSV)'}
              </span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
