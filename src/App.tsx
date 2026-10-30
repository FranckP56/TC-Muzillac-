/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { AdherentsTab } from './components/AdherentsTab';
import { RencontresTab } from './components/RencontresTab';
import { InfosClubTab } from './components/InfosClubTab';
import { EnseignantsTab } from './components/EnseignantsTab';
import { LicenciesTab } from './components/LicenciesTab';
import { AdherentModal } from './components/AdherentModal';
import { AppsScriptModal } from './components/AppsScriptModal';
import { NewMemberModal } from './components/NewMemberModal';
import { NewMatchModal } from './components/NewMatchModal';
import { CompositionModal } from './components/CompositionModal';
import { SondageDisponibilitesModal } from './components/SondageDisponibilitesModal';
import { GsheetDataModal } from './components/GsheetDataModal';
import { EditClubInfoModal } from './components/EditClubInfoModal';
import { User } from 'firebase/auth';
import { initAuth, getAccessToken } from './services/auth';
import { GoogleSheetsSyncModal } from './components/GoogleSheetsSyncModal';
import { 
  readBureauProfsFromSheet, 
  readInstallationsFromSheet, 
  readTarifsFromSheet,
  saveClubInfoToSheet, 
  TCM_DEFAULT_SHEET_ID 
} from './services/googleSheets';
import { Adherent, Rencontre, ClubInfo, ClubTarif, MatchComposition, UserRole, JoueurDisponibilite } from './types/tennis';
import { filterLicenciesMuzillac2027 } from './utils/licencies';
import { 
  INITIAL_ADHERENTS, 
  INITIAL_RENCONTRES, 
  INITIAL_CLUB_INFO, 
  REAL_DATA_FILE_URL, 
  REAL_RENCONTRES_FILE_URL,
  parseAdherentsCsv,
  parseRencontresCsv
} from './data/clubData';
import { sortAdherentsByRankingDesc } from './utils/ranking';

// Fonction de salubrité : s'assure qu'aucun tarif 'adulte' n'a la pastille 'jeune' par erreur et initialise les paiements échelonnés
const sanitizeLoadedTarifs = (info: ClubInfo): ClubInfo => {
  if (!info) return info;
  const fixedInfo = { ...info };
  if (!fixedInfo.modalitesPaiement || !fixedInfo.modalitesPaiement.includes('HelloAsso')) {
    fixedInfo.modalitesPaiement = "Paiement échelonné possible par chèque et par CB via HelloAsso. Chèques vacances ANCV et Pass'Sport acceptés.";
  }
  if (!fixedInfo.helloAssoUrl) {
    fixedInfo.helloAssoUrl = "https://www.helloasso.com/associations/tennis-club-muzillac";
  }
  if (fixedInfo.tarifs && Array.isArray(fixedInfo.tarifs)) {
    const fixedTarifs: ClubTarif[] = fixedInfo.tarifs.map((t: ClubTarif) => {
      if (t.categorie === 'jeune' && /adulte|senior|majeur/i.test(t.label)) {
        const fixedCat: ClubTarif['categorie'] = /adh[eé]sion/i.test(t.label) && !/cours|collectif|entrain/i.test(t.label) 
          ? 'adhesion' 
          : 'adulte';
        return { 
          ...t, 
          categorie: fixedCat,
        };
      }
      return t;
    });
    fixedInfo.tarifs = fixedTarifs;
  }
  return fixedInfo;
};

export default function App() {
  // Navigation avec les onglets : 'Infos Club', 'Rencontres', 'Licenciés', 'Enseignants', 'Adhérents'
  const [activeTab, setActiveTab] = useState<'infos' | 'adherents' | 'rencontres' | 'licencies' | 'enseignants'>('rencontres');

  // Rôle et permissions (5 profils : admin, bureau, prof, capitaine, adhérent)
  const [userRole, setUserRole] = useState<UserRole>(() => {
    try {
      const savedRole = localStorage.getItem('tcm_user_role') as UserRole;
      if (savedRole && ['admin', 'bureau', 'prof', 'capitaine', 'adherent'].includes(savedRole)) {
        return savedRole;
      }
    } catch (e) {
      console.warn(e);
    }
    return 'admin'; // Par défaut profil Admin pour configuration complète
  });

  // Saison sportive active (2027 par défaut, modifiable par l'Admin pour passer à 2028, etc.)
  const [saison, setSaison] = useState<string>(() => {
    try {
      return localStorage.getItem('tcm_saison_active') || '2027';
    } catch {
      return '2027';
    }
  });

  const handleUpdateSaison = (newSaison: string) => {
    setSaison(newSaison);
    try {
      localStorage.setItem('tcm_saison_active', newSaison);
    } catch (e) {
      console.warn(e);
    }
  };

  const handleUpdateRole = (newRole: UserRole) => {
    setUserRole(newRole);
    try {
      localStorage.setItem('tcm_user_role', newRole);
    } catch (e) {
      console.warn(e);
    }
  };

  // Données adhérents avec persistance locale
  const [adherents, setAdherents] = useState<Adherent[]>(() => {
    try {
      const saved = localStorage.getItem('tcm_adherents_v2');
      if (saved) {
        return sortAdherentsByRankingDesc(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Erreur chargement localStorage', e);
    }
    return sortAdherentsByRankingDesc(INITIAL_ADHERENTS);
  });

  // Données rencontres avec persistance locale
  const [rencontres, setRencontres] = useState<Rencontre[]>(() => {
    try {
      const saved = localStorage.getItem('tcm_rencontres_v3');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Erreur chargement localStorage', e);
    }
    return INITIAL_RENCONTRES;
  });

  // Données officielles du club (avec 2 enseignants DE et BPJEPS, installations, tarifs assainis)
  const [clubInfo, setClubInfo] = useState<ClubInfo>(() => {
    try {
      const saved = localStorage.getItem('tcm_club_info_v2');
      if (saved) {
        return sanitizeLoadedTarifs(JSON.parse(saved));
      }
    } catch (e) {
      console.warn(e);
    }
    return INITIAL_CLUB_INFO;
  });

  // Modales
  const [selectedAdherent, setSelectedAdherent] = useState<Adherent | null>(null);
  const [selectedRencontreForComposition, setSelectedRencontreForComposition] = useState<Rencontre | null>(null);
  const [selectedRencontreForSondage, setSelectedRencontreForSondage] = useState<Rencontre | null>(null);
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [isGsheetModalOpen, setIsGsheetModalOpen] = useState(false);
  const [gsheetModalDefaultTab, setGsheetModalDefaultTab] = useState<'mapping' | 'soldes' | 'sync'>('mapping');
  const [isNewMemberModalOpen, setIsNewMemberModalOpen] = useState(false);
  const [isNewMatchModalOpen, setIsNewMatchModalOpen] = useState(false);
  const [isEditClubModalOpen, setIsEditClubModalOpen] = useState(false);

  // Authentification Google & Données_appli Direct
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [isGoogleSyncModalOpen, setIsGoogleSyncModalOpen] = useState(false);
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState<string | null>(() => {
    return localStorage.getItem('tcm_spreadsheet_id') || null;
  });
  const [spreadsheetName, setSpreadsheetName] = useState<string>(() => {
    return localStorage.getItem('tcm_spreadsheet_name') || 'Données_appli';
  });

  // Écouteur d'authentification Google
  useEffect(() => {
    const unsub = initAuth(
      (user) => setGoogleUser(user),
      () => setGoogleUser(null)
    );
    return () => {
      if (unsub) unsub();
    };
  }, []);

  // État synchronisation Google Apps Script
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    return localStorage.getItem('tcm_last_sync_v2');
  });

  // État de chargement et lecture directe du fichier officiel Données_appli
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [fileLoadError, setFileLoadError] = useState<string | null>(null);

  // Fonction de lecture systématique sans cache du fichier local officiel Données_appli
  const handleLoadFromRealFile = async (isInitial = false) => {
    setIsLoadingFile(true);
    setFileLoadError(null);
    try {
      // 1. Chargement sans cache des adhérents
      const res = await fetch(`${REAL_DATA_FILE_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length > 0) {
          const parsed = parseAdherentsCsv(text);
          if (parsed.length > 0) {
            const sorted = sortAdherentsByRankingDesc(parsed);
            setAdherents(sorted);
            localStorage.setItem('tcm_adherents_v2', JSON.stringify(sorted));
          }
        }
      }

      // 2. Vérification présence éventuelle d'un fichier réel pour Rencontres
      try {
        const resRec = await fetch(`${REAL_RENCONTRES_FILE_URL}?t=${Date.now()}`, { cache: 'no-store' });
        if (resRec.ok) {
          const textRec = await resRec.text();
          if (textRec && textRec.trim().length > 0) {
            const parsedRec = parseRencontresCsv(textRec);
            if (parsedRec.length > 0) {
              setRencontres(parsedRec);
              localStorage.setItem('tcm_rencontres_v3', JSON.stringify(parsedRec));
            }
          }
        }
      } catch {
        // Optionnel si le fichier n'est pas encore téléversé séparément
      }

      // 3. Chargement dynamique éventuel depuis Google Sheets des onglets Bureau_Profs, Installations et Cotisations_Tarifs
      try {
        const currentSheetId = selectedSpreadsheetId || TCM_DEFAULT_SHEET_ID;
        const [bureauData, installData, tarifsData] = await Promise.all([
          readBureauProfsFromSheet(currentSheetId),
          readInstallationsFromSheet(currentSheetId),
          readTarifsFromSheet(currentSheetId)
        ]);

        if (bureauData || installData || tarifsData) {
          setClubInfo(prev => {
            const updated = { ...prev };
            if (bureauData) {
              if (bureauData.president?.nom) {
                updated.president = bureauData.president.nom;
                if (bureauData.president.tel) updated.presidentTelephone = bureauData.president.tel;
                if (bureauData.president.email) updated.presidentEmail = bureauData.president.email;
              }
              if (bureauData.secretaire?.nom) {
                updated.secretaire = bureauData.secretaire.nom;
                if (bureauData.secretaire.tel) updated.secretaireTelephone = bureauData.secretaire.tel;
                if (bureauData.secretaire.email) updated.secretaireEmail = bureauData.secretaire.email;
              }
              if (bureauData.tresorier?.nom) {
                updated.tresorier = bureauData.tresorier.nom;
                if (bureauData.tresorier.tel) updated.tresorierTelephone = bureauData.tresorier.tel;
                if (bureauData.tresorier.email) updated.tresorierEmail = bureauData.tresorier.email;
              }
              if (bureauData.enseignants && bureauData.enseignants.length > 0) {
                updated.enseignants = bureauData.enseignants;
                updated.enseignant = `${bureauData.enseignants[0].nomPrenom} (${bureauData.enseignants[0].diplome})`;
              }
            }
            if (installData && installData.length > 0) {
              updated.installations = installData;
            }
            if (tarifsData && tarifsData.length > 0) {
              updated.tarifs = tarifsData;
            }
            const sanitized = sanitizeLoadedTarifs(updated);
            localStorage.setItem('tcm_club_info_v2', JSON.stringify(sanitized));
            return sanitized;
          });
        }
      } catch (errDynamic) {
        console.warn('Lecture dynamique Bureau_Profs/Installations/Tarifs (optionnel):', errDynamic);
      }

      const now = new Date().toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      });
      setLastSyncTime(now);
      localStorage.setItem('tcm_last_sync_v2', now);
    } catch (err: any) {
      console.warn('Erreur lecture directe Données_appli:', err);
      setFileLoadError(err.message || 'Erreur inconnue');
    } finally {
      setIsLoadingFile(false);
    }
  };

  // Chargement systématique au montage + relecture automatique quand la fenêtre reprend le focus
  useEffect(() => {
    handleLoadFromRealFile(true);

    const handleWindowFocus = () => {
      handleLoadFromRealFile(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleLoadFromRealFile(false);
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Sauvegarde automatique locale
  useEffect(() => {
    try {
      localStorage.setItem('tcm_adherents_v2', JSON.stringify(adherents));
    } catch (e) {
      console.warn(e);
    }
  }, [adherents]);

  useEffect(() => {
    try {
      localStorage.setItem('tcm_rencontres_v3', JSON.stringify(rencontres));
    } catch (e) {
      console.warn(e);
    }
  }, [rencontres]);

  // Synchronisation en direct avec une URL Web App Google Apps Script
  const handleSyncWithUrl = async (url: string): Promise<boolean> => {
    setIsSyncing(true);
    setSyncError(null);

    try {
      const sep = url.includes('?') ? '&' : '?';
      const fetchUrl = `${url}${sep}action=getAll`;

      const res = await fetch(fetchUrl);
      if (!res.ok) {
        throw new Error(`Erreur réseau (${res.status} ${res.statusText})`);
      }

      const json = await res.json();
      if (!json || (!json.adherents && !json.data)) {
        throw new Error("Format de réponse inattendu depuis Google Apps Script.");
      }

      const fetchedAdherents = json.adherents || (Array.isArray(json.data) ? json.data : null);
      if (fetchedAdherents && Array.isArray(fetchedAdherents)) {
        setAdherents(sortAdherentsByRankingDesc(fetchedAdherents));
      }

      if (json.rencontres && Array.isArray(json.rencontres)) {
        setRencontres(json.rencontres);
      }

      const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      setLastSyncTime(now);
      localStorage.setItem('tcm_last_sync_v2', now);
      setIsSyncing(false);
      return true;
    } catch (err: any) {
      console.error(err);
      setSyncError(`Impossible de synchroniser : ${err.message || err}`);
      setIsSyncing(false);
      return false;
    }
  };

  // Réinitialiser les données aux valeurs de base Muzillac TC
  const handleResetData = () => {
    setAdherents(sortAdherentsByRankingDesc(INITIAL_ADHERENTS));
    setRencontres(INITIAL_RENCONTRES);
    setLastSyncTime(null);
    localStorage.removeItem('tcm_last_sync_v2');
    setSyncError(null);
  };

  // Modification du solde d'un adhérent (règlement en direct)
  const handleUpdateSolde = (id: string, newSolde: number) => {
    setAdherents(prev => prev.map(a => {
      if (a.id === id) {
        const updated = { ...a, soldeDu: newSolde };
        if (selectedAdherent && selectedAdherent.id === id) {
          setSelectedAdherent(updated);
        }
        return updated;
      }
      return a;
    }));
  };

  // Sauvegarde de la composition d'une rencontre (avec sauvegarde automatique 20 colonnes dans GSheet)
  const handleSaveComposition = (rencontreId: string, composition: MatchComposition) => {
    setRencontres(prev => prev.map(r => {
      if (r.id === rencontreId) {
        return { ...r, composition };
      }
      return r;
    }));

    if (selectedRencontreForComposition && selectedRencontreForComposition.id === rencontreId) {
      setSelectedRencontreForComposition(prev => prev ? { ...prev, composition } : null);
    }
  };

  // Modification de l'horaire d'une rencontre (9h00, 14h00 ou personnalisé)
  const handleUpdateMatchHour = (rencontreId: string, hour: string) => {
    setRencontres(prev => prev.map(r => {
      if (r.id === rencontreId) {
        return { ...r, heure: hour };
      }
      return r;
    }));
  };

  // Enregistrement des réponses de disponibilité des joueurs pour une rencontre
  const handleUpdateDisponibilites = (rencontreId: string, dispos: JoueurDisponibilite[]) => {
    setRencontres(prev => prev.map(r => {
      if (r.id === rencontreId) {
        return { ...r, disponibilites: dispos };
      }
      return r;
    }));
    if (selectedRencontreForSondage && selectedRencontreForSondage.id === rencontreId) {
      setSelectedRencontreForSondage(prev => prev ? { ...prev, disponibilites: dispos } : null);
    }
    if (selectedRencontreForComposition && selectedRencontreForComposition.id === rencontreId) {
      setSelectedRencontreForComposition(prev => prev ? { ...prev, disponibilites: dispos } : null);
    }
  };

  // Licenciés de la saison active officiels du club (Colonnes X = millésime et AB = 'MUZILLAC TENNIS CLUB')
  const licenciesActive = useMemo(() => {
    return filterLicenciesMuzillac2027(adherents, saison);
  }, [adherents, saison]);

  // Ajout d'un nouvel adhérent
  const handleAddMember = (newMember: Adherent) => {
    setAdherents(prev => sortAdherentsByRankingDesc([newMember, ...prev]));
  };

  // Ajout d'une nouvelle rencontre
  const handleAddMatch = (newMatch: Rencontre) => {
    setRencontres(prev => [newMatch, ...prev]);
  };

  // Sauvegarde des modifications du club (enseignants, installations, tarifs assainis, permanences)
  const handleSaveClubInfo = async (updatedInfo: ClubInfo) => {
    const sanitized = sanitizeLoadedTarifs(updatedInfo);
    setClubInfo(sanitized);
    try {
      localStorage.setItem('tcm_club_info_v2', JSON.stringify(sanitized));
      const token = await getAccessToken();
      await saveClubInfoToSheet(sanitized, selectedSpreadsheetId || TCM_DEFAULT_SHEET_ID, token || undefined);
    } catch (e) {
      console.warn('Erreur sauvegarde Google Sheets ClubInfo:', e);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0f12] text-zinc-100 flex flex-col antialiased selection:bg-[#E65100] selection:text-white">
      
      {/* 1. BARRE DE NAVIGATION FIXE EN HAUT AVEC LES ONGLETS ET SÉLECTEUR DE RÔLE */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userRole={userRole}
        setUserRole={handleUpdateRole}
        onOpenScriptModal={() => setIsScriptModalOpen(true)}
        onOpenGsheetModal={() => {
          setGsheetModalDefaultTab('mapping');
          setIsGsheetModalOpen(true);
        }}
        onOpenGoogleSyncModal={() => setIsGoogleSyncModalOpen(true)}
        isGoogleConnected={!!googleUser}
        googleUserEmail={googleUser?.email}
        totalAdherents={adherents.length}
        totalLicencies={licenciesActive.length}
        onRefreshFromFile={() => handleLoadFromRealFile(false)}
        isRefreshing={isLoadingFile}
        saison={saison}
        onUpdateSaison={handleUpdateSaison}
      />

      {/* 2. CONTENU PRINCIPAL (ESPACEMENT SOUS LA NAV FIXE SUR 2 LIGNES) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-16">
        
        {/* Onglet 'Rencontres' (Accessible à tous, avec boutons de composition pour Capitaines et Bureau) */}
        {activeTab === 'rencontres' && (
          <RencontresTab
            rencontres={rencontres}
            adherents={adherents}
            onOpenCompositionModal={(r) => setSelectedRencontreForComposition(r)}
            onOpenSondageModal={(r) => setSelectedRencontreForSondage(r)}
            onUpdateMatchHour={handleUpdateMatchHour}
            userRole={userRole}
            saison={saison}
            onRefreshData={() => handleLoadFromRealFile(false)}
            isAutoSyncing={isLoadingFile}
          />
        )}

        {/* Onglet 'Licenciés' (Officiels FFT Muzillac Tennis Club - Masqué pour les simples adhérents) */}
        {activeTab === 'licencies' && userRole !== 'adherent' && (
          <LicenciesTab
            adherents={adherents}
            userRole={userRole}
            saison={saison}
            onSelectAdherent={(adh) => setSelectedAdherent(adh)}
            onNavigateToRencontres={() => setActiveTab('rencontres')}
          />
        )}

        {/* Onglet 'Infos Club' (Accessible à tous, avec modification des données si Bureau ou Admin) */}
        {activeTab === 'infos' && (
          <InfosClubTab
            clubInfo={clubInfo}
            onOpenScriptModal={() => setIsScriptModalOpen(true)}
            onOpenGsheetModal={() => {
              setGsheetModalDefaultTab('mapping');
              setIsGsheetModalOpen(true);
            }}
            onSyncWithUrl={handleSyncWithUrl}
            onResetData={handleResetData}
            isSyncing={isSyncing}
            syncError={syncError}
            lastSyncTime={lastSyncTime}
            onRefreshFromFile={() => handleLoadFromRealFile(false)}
            isLoadingFile={isLoadingFile}
            totalMembers={adherents.length}
            onOpenEditClubModal={() => setIsEditClubModalOpen(true)}
            isBureauMember={userRole === 'admin' || userRole === 'bureau'}
            isAdmin={userRole === 'admin'}
          />
        )}

        {/* Onglet 'Enseignants' (Accessible uniquement aux Profs, Membres du Bureau et Admin) */}
        {activeTab === 'enseignants' && (userRole === 'admin' || userRole === 'prof' || userRole === 'bureau') && (
          <EnseignantsTab
            adherents={adherents}
            clubInfo={clubInfo}
            onSelectAdherent={(adh) => setSelectedAdherent(adh)}
          />
        )}

        {/* Onglet 'Adhérents' (Réservé aux Membres du Bureau et Admin) */}
        {activeTab === 'adherents' && (userRole === 'admin' || userRole === 'bureau') && (
          <AdherentsTab
            adherents={adherents}
            userRole={userRole}
            onSelectAdherent={(adh) => setSelectedAdherent(adh)}
            onOpenNewMemberModal={() => setIsNewMemberModalOpen(true)}
            onOpenGsheetModal={() => {
              setGsheetModalDefaultTab('mapping');
              setIsGsheetModalOpen(true);
            }}
            lastSyncTime={lastSyncTime}
            isLoadingFile={isLoadingFile}
            onRefreshFromFile={() => handleLoadFromRealFile(false)}
          />
        )}

      </main>

      {/* 3. MODALES */}
      
      {/* Fiche détaillée de l'adhérent */}
      <AdherentModal
        adherent={selectedAdherent}
        onClose={() => setSelectedAdherent(null)}
        onUpdateSolde={handleUpdateSolde}
      />

      {/* Module de composition d'équipe des capitaines (Éligibilité FFT Millésime 2027, rotations horaires & courts) */}
      <CompositionModal
        rencontre={selectedRencontreForComposition}
        adherents={adherents}
        allRencontres={rencontres}
        isOpen={!!selectedRencontreForComposition}
        onClose={() => setSelectedRencontreForComposition(null)}
        onSaveComposition={handleSaveComposition}
        selectedSpreadsheetId={selectedSpreadsheetId}
        spreadsheetName={spreadsheetName}
        onOpenGoogleSyncModal={() => setIsGoogleSyncModalOpen(true)}
        saison={saison}
      />

      {/* Sondage des disponibilités des joueurs (SMS/WhatsApp, jour, heure, Simple/Double) */}
      <SondageDisponibilitesModal
        rencontre={selectedRencontreForSondage}
        adherents={adherents}
        isOpen={!!selectedRencontreForSondage}
        onClose={() => setSelectedRencontreForSondage(null)}
        onUpdateDisponibilites={handleUpdateDisponibilites}
        onOpenComposition={(r) => {
          setSelectedRencontreForSondage(null);
          setSelectedRencontreForComposition(r);
        }}
        saison={saison}
      />

      {/* Synchronisation Directe Google Sheets (Données_appli) sans CSV */}
      <GoogleSheetsSyncModal
        isOpen={isGoogleSyncModalOpen}
        onClose={() => setIsGoogleSyncModalOpen(false)}
        currentUser={googleUser}
        onUserChange={(u) => setGoogleUser(u)}
        selectedSpreadsheetId={selectedSpreadsheetId}
        onSelectSpreadsheet={(id, name) => {
          setSelectedSpreadsheetId(id);
          setSpreadsheetName(name);
          localStorage.setItem('tcm_spreadsheet_id', id);
          localStorage.setItem('tcm_spreadsheet_name', name);
        }}
        spreadsheetName={spreadsheetName}
        onDataLoaded={(newAdh, newRen) => {
          const sorted = sortAdherentsByRankingDesc(newAdh);
          setAdherents(sorted);
          setRencontres(newRen);
          const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          setLastSyncTime(now);
          localStorage.setItem('tcm_last_sync_v2', now);
          localStorage.setItem('tcm_adherents_v2', JSON.stringify(sorted));
          localStorage.setItem('tcm_rencontres_v3', JSON.stringify(newRen));
        }}
      />

      {/* Cartographie et architecture des colonnes GSheet Données_appli (sans CSV) */}
      <GsheetDataModal
        isOpen={isGsheetModalOpen}
        onClose={() => setIsGsheetModalOpen(false)}
        totalMembers={adherents.length}
        totalRencontres={rencontres.length}
        defaultTab={gsheetModalDefaultTab}
        onRefreshFromFile={() => handleLoadFromRealFile(false)}
        isLoadingFile={isLoadingFile}
      />

      {/* Modal d'édition complète des informations du club (Enseignants DE/BPJEPS, installations, tarifs, permanences) */}
      <EditClubInfoModal
        isOpen={isEditClubModalOpen}
        onClose={() => setIsEditClubModalOpen(false)}
        clubInfo={clubInfo}
        onSave={handleSaveClubInfo}
        selectedSpreadsheetId={selectedSpreadsheetId}
      />

      {/* Visionneuse Code.gs Google Apps Script & Déploiement */}
      <AppsScriptModal
        isOpen={isScriptModalOpen}
        onClose={() => setIsScriptModalOpen(false)}
      />

      {/* Ajout d'un membre */}
      <NewMemberModal
        isOpen={isNewMemberModalOpen}
        onClose={() => setIsNewMemberModalOpen(false)}
        onAddMember={handleAddMember}
      />

      {/* Ajout d'une rencontre */}
      <NewMatchModal
        isOpen={isNewMatchModalOpen}
        onClose={() => setIsNewMatchModalOpen(false)}
        onAddMatch={handleAddMatch}
      />

      {/* 4. FOOTER DISCRET DU CLUB */}
      <footer className="border-t border-[#1e232d] bg-[#090b0e] py-6 px-4 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="font-heading font-black text-white text-sm">Muzillac Tennis Club (TCM)</span>
            <span>•</span>
            <span>Complexe du Chêne Rond & Clos des Moines</span>
          </div>

          <div className="flex items-center space-x-4 text-zinc-400">
            <button
              onClick={() => setIsGsheetModalOpen(true)}
              className="text-emerald-400 hover:text-emerald-300 font-semibold transition cursor-pointer"
            >
              Architecture GSheet (Données_appli)
            </button>
            <span>•</span>
            <button
              onClick={() => setIsScriptModalOpen(true)}
              className="hover:text-orange-400 transition cursor-pointer"
            >
              Fichiers Code.gs & Règles FFT 2027
            </button>
            <span>•</span>
            <a
              href="https://tenup.fft.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#FF6D00] hover:underline"
            >
              Portail FFT Ten'Up
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}
