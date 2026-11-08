/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { AdherentsTab } from './components/AdherentsTab';
import { RencontresTab } from './components/RencontresTab';
import { InfosClubTab } from './components/InfosClubTab';
import { EnseignantsTab } from './components/EnseignantsTab';
import { LicenciesTab } from './components/LicenciesTab';
import { ReglementsTab } from './components/ReglementsTab';
import { AdherentModal } from './components/AdherentModal';
import { AppsScriptModal } from './components/AppsScriptModal';
import { NewMemberModal } from './components/NewMemberModal';
import { NewMatchModal } from './components/NewMatchModal';
import { CompositionModal } from './components/CompositionModal';
import { SondageDisponibilitesModal } from './components/SondageDisponibilitesModal';
import { GsheetDataModal } from './components/GsheetDataModal';
import { EditClubInfoModal } from './components/EditClubInfoModal';
import { ReglesFftModal } from './components/ReglesFftModal';
import { User } from 'firebase/auth';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { initAuth, getAccessToken } from './services/auth';
import { GoogleSheetsSyncModal } from './components/GoogleSheetsSyncModal';
import { 
  fetchAllDataFromAppsScript,
  saveCompositionViaAppsScript,
  saveClubInfoViaAppsScript,
  TCM_APPS_SCRIPT_URL,
  TCM_DEFAULT_SHEET_ID,
  saveDatasetToCache,
  loadDatasetFromCache,
  getLastSyncTimestamp,
  saveClubInfoToLocal,
  loadClubInfoFromLocal
} from './services/googleSheets';
import { Adherent, Rencontre, ClubInfo, ClubTarif, MatchComposition, UserRole, JoueurDisponibilite } from './types/tennis';
import { filterLicenciesMuzillac2027 } from './utils/licencies';
import { INITIAL_CLUB_INFO } from './data/clubData';
import { sortAdherentsByRankingDesc, cleanRanking, isValidTennisRanking } from './utils/ranking';
import { evaluateDataStaleness } from './utils/fftCalendar';
import { formatFrenchPhoneNumber } from './utils/phoneUtils';

// Assainissement des tarifs : catégories correctes et modalités de paiement
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
  // Navigation avec les onglets : 'Infos Club', 'Rencontres', 'Licenciés', 'Enseignants', 'Adhérents', 'Règlements'
  const [activeTab, setActiveTab] = useState<'infos' | 'adherents' | 'rencontres' | 'licencies' | 'enseignants' | 'reglements'>('rencontres');

  // Profils d'accès (admin, bureau, prof, capitaine, adherent)
  const [userRole, setUserRole] = useState<UserRole>(() => {
    try {
      const savedRole = localStorage.getItem('tcm_user_role') as UserRole;
      if (savedRole && ['admin', 'bureau', 'prof', 'capitaine', 'adherent'].includes(savedRole)) {
        return savedRole;
      }
    } catch (e) {
      console.warn(e);
    }
    return 'admin';
  });

  // Saison sportive active (2027 par défaut, modifiable par l'Admin)
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

  // URL du Web App Google Apps Script
  const [gasUrl, setGasUrl] = useState<string>(() => {
    try {
      const stored = localStorage.getItem('tcm_gas_url');
      if (stored && stored.includes('AKfycbwq9bSE7K0zujyK-zP3KdxMuHLfaFlnvRHwGPsO9MJ_C6KmuATVIPC7K6KToI_7mM7ZDA')) {
        localStorage.setItem('tcm_gas_url', TCM_APPS_SCRIPT_URL);
        return TCM_APPS_SCRIPT_URL;
      }
      return stored || TCM_APPS_SCRIPT_URL;
    } catch {
      return TCM_APPS_SCRIPT_URL;
    }
  });

  // RÈGLE : Données issues UNIQUEMENT du Google Sheet.
  // Initialisation depuis le cache localStorage s'il existe (avec suivi d'obsolescence), sinon tableau vide [] (zéro mock data).
  const initialCached = useMemo(() => loadDatasetFromCache(), []);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<number | null>(() => getLastSyncTimestamp());

  const [adherents, setAdherents] = useState<Adherent[]>(() => {
    if (initialCached?.adherents && initialCached.adherents.length > 0) {
      const sanitized = initialCached.adherents.map((a: Adherent) => {
        const dernierClass = cleanRanking(a.dernierClassTennis, 'NC');
        let meilleurClass = cleanRanking(a.meilleurClassTennis, dernierClass);
        if (!isValidTennisRanking(meilleurClass)) meilleurClass = dernierClass;
        return {
          ...a,
          dernierClassTennis: dernierClass,
          meilleurClassTennis: meilleurClass,
        };
      });
      return sortAdherentsByRankingDesc(sanitized);
    }
    return [];
  });
  const [rencontres, setRencontres] = useState<Rencontre[]>(() => {
    if (initialCached?.rencontres && initialCached.rencontres.length > 0) {
      return initialCached.rencontres;
    }
    return [];
  });
  const [clubInfo, setClubInfo] = useState<ClubInfo>(() => {
    const base = { ...INITIAL_CLUB_INFO };
    if (initialCached?.bureau) {
      if (initialCached.bureau.president?.nom) base.president = initialCached.bureau.president.nom;
      if (initialCached.bureau.secretaire?.nom) base.secretaire = initialCached.bureau.secretaire.nom;
      if (initialCached.bureau.tresorier?.nom) base.tresorier = initialCached.bureau.tresorier.nom;
      if (initialCached.bureau.enseignants && initialCached.bureau.enseignants.length > 0) {
        base.enseignants = initialCached.bureau.enseignants;
        base.enseignant = `${initialCached.bureau.enseignants[0].nomPrenom} (${initialCached.bureau.enseignants[0].diplome})`;
      }
    }
    if (initialCached?.installations && initialCached.installations.length > 0) {
      base.installations = initialCached.installations;
    }
    if (initialCached?.tarifs && initialCached.tarifs.length > 0) {
      base.tarifs = initialCached.tarifs;
    }
    if (initialCached?.clubInfo) {
      Object.assign(base, initialCached.clubInfo);
    }
    // Fusion des informations réelles saisies et sauvegardées localement
    const localCustom = loadClubInfoFromLocal();
    if (localCustom) {
      Object.assign(base, localCustom);
    }
    return sanitizeLoadedTarifs(base);
  });

  // Évaluation de l'obsolescence (plus d'une semaine OU passage du 1er mardi du mois)
  const staleness = useMemo(() => {
    return evaluateDataStaleness(lastSyncTimestamp);
  }, [lastSyncTimestamp]);

  // Nettoyage proactif immédiat de tout ancien cache obsolète ou incorrect
  useEffect(() => {
    try {
      localStorage.removeItem('tcm_adherents_v2');
      localStorage.removeItem('tcm_rencontres_v3');
      localStorage.removeItem('tcm_club_info_v2');
      const currentStored = localStorage.getItem('tcm_gas_url');
      if (currentStored && currentStored.includes('AKfycbwq9bSE7K0zujyK-zP3KdxMuHLfaFlnvRHwGPsO9MJ_C6KmuATVIPC7K6KToI_7mM7ZDA')) {
        localStorage.setItem('tcm_gas_url', TCM_APPS_SCRIPT_URL);
      }
    } catch {
      // Ignorer
    }
  }, []);

  // Modales
  const [selectedAdherent, setSelectedAdherent] = useState<Adherent | null>(null);
  const [modalAdherentList, setModalAdherentList] = useState<Adherent[] | null>(null);
  const [selectedRencontreForComposition, setSelectedRencontreForComposition] = useState<Rencontre | null>(null);
  const [modalRencontresList, setModalRencontresList] = useState<Rencontre[] | null>(null);
  const [selectedRencontreForSondage, setSelectedRencontreForSondage] = useState<Rencontre | null>(null);
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [isGsheetModalOpen, setIsGsheetModalOpen] = useState(false);
  const [gsheetModalDefaultTab, setGsheetModalDefaultTab] = useState<'mapping' | 'soldes' | 'sync'>('mapping');
  const [isNewMemberModalOpen, setIsNewMemberModalOpen] = useState(false);
  const [isNewMatchModalOpen, setIsNewMatchModalOpen] = useState(false);
  const [isEditClubModalOpen, setIsEditClubModalOpen] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

  // Authentification Google & Données_appli Direct
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [isGoogleSyncModalOpen, setIsGoogleSyncModalOpen] = useState(false);
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('tcm_spreadsheet_id') || TCM_DEFAULT_SHEET_ID;
    } catch {
      return TCM_DEFAULT_SHEET_ID;
    }
  });
  const [spreadsheetName, setSpreadsheetName] = useState<string>(() => {
    try {
      return localStorage.getItem('tcm_spreadsheet_name') || 'Données_appli';
    } catch {
      return 'Données_appli';
    }
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

  // État de chargement et erreurs
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    const ts = getLastSyncTimestamp();
    return ts ? new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null;
  });
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [fileLoadError, setFileLoadError] = useState<string | null>(null);

  /**
   * CHARGEMENT EN DIRECT VIA APPS SCRIPT ANTI-CACHE
   * GET direct vers TCM_APPS_SCRIPT_URL avec ?action=getAll&_t=Date.now()
   */
  const handleLoadFromRealFile = useCallback(async (isInitial = false) => {
    setIsLoadingFile(true);
    setFileLoadError(null);

    try {
      const activeUrl = gasUrl || TCM_APPS_SCRIPT_URL;

      // Requête directe sans cache vers le Web App Apps Script
      const data = await fetchAllDataFromAppsScript(activeUrl);

      if (data.success && ((data.adherents && data.adherents.length > 0) || (data.rencontres && data.rencontres.length > 0))) {
        // 1. Mise à jour des Adhérents réels
        if (data.adherents && data.adherents.length > 0) {
          setAdherents(sortAdherentsByRankingDesc(data.adherents));
        }

        // 2. Mise à jour des Rencontres réelles fusionnées avec les compositions
        if (data.rencontres && data.rencontres.length > 0) {
          setRencontres(data.rencontres);
        }

        // 3. Mise à jour des Infos Club réelles (Bureau, Enseignants, Installations, Tarifs, Club_Info)
        if (data.bureau || data.installations || data.tarifs || data.clubInfo) {
          setClubInfo(prev => {
            const updated = { ...prev };
            if (data.clubInfo) {
              Object.assign(updated, data.clubInfo);
            }
            if (data.bureau) {
              if (data.bureau.president?.nom) {
                updated.president = data.bureau.president.nom;
                if (data.bureau.president.tel) updated.presidentTelephone = formatFrenchPhoneNumber(data.bureau.president.tel);
                if (data.bureau.president.email) updated.presidentEmail = data.bureau.president.email;
              }
              if (data.bureau.secretaire?.nom) {
                updated.secretaire = data.bureau.secretaire.nom;
                if (data.bureau.secretaire.tel) updated.secretaireTelephone = formatFrenchPhoneNumber(data.bureau.secretaire.tel);
                if (data.bureau.secretaire.email) updated.secretaireEmail = data.bureau.secretaire.email;
              }
              if (data.bureau.tresorier?.nom) {
                updated.tresorier = data.bureau.tresorier.nom;
                if (data.bureau.tresorier.tel) updated.tresorierTelephone = formatFrenchPhoneNumber(data.bureau.tresorier.tel);
                if (data.bureau.tresorier.email) updated.tresorierEmail = data.bureau.tresorier.email;
              }
              if (data.bureau.enseignants && data.bureau.enseignants.length > 0) {
                updated.enseignants = data.bureau.enseignants;
                updated.enseignant = `${data.bureau.enseignants[0].nomPrenom} (${data.bureau.enseignants[0].diplome})`;
              }
            }
            if (data.installations && data.installations.length > 0) {
              updated.installations = data.installations;
            }
            if (data.tarifs && data.tarifs.length > 0) {
              updated.tarifs = data.tarifs;
            }
            // Conserver également l'adresse réelle ou les coordonnées locales personnalisées si le Sheet n'a pas encore l'onglet Club_Info
            const localCustom = loadClubInfoFromLocal();
            if (localCustom) {
              if (localCustom.adresse && (!data.clubInfo || !data.clubInfo.adresse)) updated.adresse = localCustom.adresse;
              if (localCustom.telephone && (!data.clubInfo || !data.clubInfo.telephone)) updated.telephone = localCustom.telephone;
              if (localCustom.email && (!data.clubInfo || !data.clubInfo.email)) updated.email = localCustom.email;
              if (localCustom.siteWeb && (!data.clubInfo || !data.clubInfo.siteWeb)) updated.siteWeb = localCustom.siteWeb;
              if (localCustom.permanencePedagogiqueLibelle && (!data.clubInfo || !data.clubInfo.permanencePedagogiqueLibelle)) updated.permanencePedagogiqueLibelle = localCustom.permanencePedagogiqueLibelle;
              if (localCustom.permanencePedagogiqueVisible !== undefined && (!data.clubInfo || data.clubInfo.permanencePedagogiqueVisible === undefined)) updated.permanencePedagogiqueVisible = localCustom.permanencePedagogiqueVisible;
              if (localCustom.horairesPermanence && (!data.clubInfo || !data.clubInfo.horairesPermanence)) updated.horairesPermanence = localCustom.horairesPermanence;
              if (localCustom.badgeAccesMessage && (!data.clubInfo || !data.clubInfo.badgeAccesMessage)) updated.badgeAccesMessage = localCustom.badgeAccesMessage;
              if (localCustom.ouvertureCourtsMessage && (!data.clubInfo || !data.clubInfo.ouvertureCourtsMessage)) updated.ouvertureCourtsMessage = localCustom.ouvertureCourtsMessage;
              if (localCustom.badgeAccesVisible !== undefined && (!data.clubInfo || data.clubInfo.badgeAccesVisible === undefined)) updated.badgeAccesVisible = localCustom.badgeAccesVisible;
            }
            return sanitizeLoadedTarifs(updated);
          });
        }

        // Enregistrement dans le cache localStorage
        saveDatasetToCache(data);
        const nowTs = Date.now();
        setLastSyncTimestamp(nowTs);
        setLastSyncTime(new Date(nowTs).toLocaleTimeString('fr-FR', { 
          hour: '2-digit', 
          minute: '2-digit',
          second: '2-digit'
        }));
        setFileLoadError(null);
      } else {
        if (adherents.length === 0 && rencontres.length === 0) {
          setFileLoadError("Erreur de connexion avec le tableur Google : aucune donnée reçue. Vérifiez le partage de votre tableur.");
        } else {
          setFileLoadError("Impossible d'actualiser les données depuis Google Sheets. Les données affichées proviennent de votre dernière extraction.");
        }
      }
    } catch (err: any) {
      console.warn('Erreur lecture Apps Script:', err);
      if (adherents.length === 0 && rencontres.length === 0) {
        setFileLoadError(`Erreur de connexion avec le tableur Google (${err.message || 'accès réseau indisponible'}). Aucune donnée fictive n'est affichée.`);
      } else {
        setFileLoadError(`Échec d'actualisation (${err.message || 'erreur réseau'}). Affichage des données de la dernière synchronisation.`);
      }
    } finally {
      setIsLoadingFile(false);
    }
  }, [gasUrl, adherents.length, rencontres.length]);

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
  }, [handleLoadFromRealFile]);

  // Synchronisation manuelle avec URL Web App Google Apps Script
  const handleSyncWithUrl = async (url: string): Promise<boolean> => {
    setIsSyncing(true);
    setSyncError(null);

    try {
      const trimmedUrl = url.trim() || TCM_APPS_SCRIPT_URL;
      const data = await fetchAllDataFromAppsScript(trimmedUrl);

      try {
        localStorage.setItem('tcm_gas_url', trimmedUrl);
      } catch (e) {
        console.warn(e);
      }
      setGasUrl(trimmedUrl);

      if (data.adherents && data.adherents.length > 0) {
        setAdherents(sortAdherentsByRankingDesc(data.adherents));
      } else {
        setAdherents([]);
      }

      if (data.rencontres && data.rencontres.length > 0) {
        setRencontres(data.rencontres);
      } else {
        setRencontres([]);
      }

      const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSyncTime(now);
      setFileLoadError(null);
      setIsSyncing(false);
      return true;
    } catch (err: any) {
      console.error(err);
      setSyncError(`Impossible de synchroniser : ${err.message || err}`);
      setIsSyncing(false);
      return false;
    }
  };

  // Réinitialiser les données (recharge les données en direct, zéro fallback fictif)
  const handleResetData = () => {
    setAdherents([]);
    setRencontres([]);
    setLastSyncTime(null);
    setSyncError(null);
    handleLoadFromRealFile(false);
  };

  // Modification du solde d'un adhérent en mémoire
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

  // RÈGLE 3 : Sauvegarde de la composition d'une rencontre via requête HTTP POST JSON
  const handleSaveComposition = async (rencontreId: string, composition: MatchComposition) => {
    setRencontres(prev => prev.map(r => {
      if (r.id === rencontreId) {
        return { ...r, composition };
      }
      return r;
    }));

    if (selectedRencontreForComposition && selectedRencontreForComposition.id === rencontreId) {
      setSelectedRencontreForComposition(prev => prev ? { ...prev, composition } : null);
    }

    const ren = rencontres.find(r => r.id === rencontreId) || selectedRencontreForComposition;
    if (ren) {
      const adherentsById = new Map<string, Adherent>();
      adherents.forEach(a => {
        adherentsById.set(a.id, a);
        if (a.licence) adherentsById.set(a.licence, a);
        adherentsById.set(a.nomPrenom, a);
      });
      try {
        await saveCompositionViaAppsScript(ren, composition, adherentsById, gasUrl || TCM_APPS_SCRIPT_URL);
      } catch (err) {
        console.warn('Erreur envoi POST composition vers Apps Script:', err);
      }
    }
  };

  // Modification de l'horaire d'une rencontre
  const handleUpdateMatchHour = (rencontreId: string, hour: string) => {
    setRencontres(prev => prev.map(r => {
      if (r.id === rencontreId) {
        return { ...r, heure: hour };
      }
      return r;
    }));
  };

  // Enregistrement des disponibilités
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

  // Licenciés officiels de la saison active
  const licenciesActive = useMemo(() => {
    return filterLicenciesMuzillac2027(adherents, saison);
  }, [adherents, saison]);

  // Ajout d'un nouvel adhérent en mémoire
  const handleAddMember = (newMember: Adherent) => {
    setAdherents(prev => sortAdherentsByRankingDesc([newMember, ...prev]));
  };

  // Ajout d'une nouvelle rencontre en mémoire
  const handleAddMatch = (newMatch: Rencontre) => {
    setRencontres(prev => [newMatch, ...prev]);
  };

  // RÈGLE 3 : Sauvegarde des informations du club via requête HTTP POST JSON
  const handleSaveClubInfo = async (updatedInfo: ClubInfo) => {
    const sanitized = sanitizeLoadedTarifs(updatedInfo);
    setClubInfo(sanitized);
    saveClubInfoToLocal(sanitized);
    try {
      await saveClubInfoViaAppsScript(sanitized, gasUrl || TCM_APPS_SCRIPT_URL);
    } catch (e) {
      console.warn('Erreur envoi POST ClubInfo vers Apps Script:', e);
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
        lastSyncFormatted={staleness.lastSyncFormatted}
        isStale={staleness.isStale}
      />

      {/* 2. CONTENU PRINCIPAL */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-16">
        
        {/* BANNIÈRE D'ERREUR EXPLICITE SI LA CONNEXION ÉCHOUE (AUCUNE DONNÉE FICTIVE) */}
        {fileLoadError && (
          <div className="mb-6 bg-rose-500/15 border-2 border-rose-500/40 rounded-2xl p-4 sm:p-5 text-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-start sm:items-center space-x-3.5">
              <div className="w-11 h-11 rounded-2xl bg-rose-500/25 border border-rose-500/40 flex items-center justify-center shrink-0 text-rose-400 font-bold">
                <AlertTriangle className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="font-heading font-black text-white text-base sm:text-lg flex items-center gap-2">
                  <span>Erreur de connexion avec le tableur Google</span>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-rose-500/25 text-rose-300 font-mono font-bold border border-rose-500/40">
                    Apps Script
                  </span>
                </h3>
                <p className="text-xs sm:text-sm text-rose-200/90 mt-0.5 leading-relaxed">
                  {fileLoadError}
                </p>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Les données fictives ont été totalement supprimées. Aucune information inventée n'est affichée.
                </p>
              </div>
            </div>
            <button
              onClick={() => handleLoadFromRealFile(false)}
              disabled={isLoadingFile}
              className="px-4 py-2.5 bg-gradient-to-r from-[#BF360C] to-[#E65100] hover:brightness-110 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 shrink-0 cursor-pointer shadow-md disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFile ? 'animate-spin' : ''}`} />
              <span>Réessayer la connexion</span>
            </button>
          </div>
        )}

        {/* AVERTISSEMENT : DONNÉES OBSOLÈTES (DATE > 7 JOURS OU 1ER MARDI DU MOIS DÉPASSÉ) */}
        {staleness.isStale && !fileLoadError && (adherents.length > 0 || rencontres.length > 0) && (
          <div className="mb-6 bg-amber-500/10 border-2 border-amber-500/35 rounded-2xl p-4 sm:p-5 text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl animate-fadeIn">
            <div className="flex items-start sm:items-center space-x-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-400 font-bold">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-heading font-black text-white text-base sm:text-lg">
                    Attention : données potentiellement obsolètes
                  </h3>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-500/40">
                    {staleness.lastSyncFormatted ? `Extraction du ${staleness.lastSyncFormatted}` : 'Non synchronisé'}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-amber-200/90 mt-1 leading-relaxed">
                  {staleness.reasons.join(' et ')}.
                  {' '}Les classements FFT officiels des licenciés ou les programmations de rencontres ont pu évoluer depuis.
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Cliquez sur "Actualiser" pour récupérer la version la plus fraîche directement depuis Google Sheets.
                </p>
              </div>
            </div>
            <button
              onClick={() => handleLoadFromRealFile(false)}
              disabled={isLoadingFile}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-zinc-950 font-black rounded-xl text-xs transition flex items-center space-x-2 shrink-0 cursor-pointer shadow-md disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFile ? 'animate-spin' : ''}`} />
              <span>Actualiser les données</span>
            </button>
          </div>
        )}
        
        {/* Onglet 'Rencontres' */}
        {activeTab === 'rencontres' && (
          <RencontresTab
            rencontres={rencontres}
            adherents={adherents}
            onOpenCompositionModal={(r, list) => {
              setSelectedRencontreForComposition(r);
              setModalRencontresList(list || null);
            }}
            onOpenSondageModal={(r) => setSelectedRencontreForSondage(r)}
            onUpdateMatchHour={handleUpdateMatchHour}
            userRole={userRole}
            saison={saison}
            onRefreshData={() => handleLoadFromRealFile(false)}
            isAutoSyncing={isLoadingFile}
          />
        )}

        {/* Onglet 'Licenciés' */}
        {activeTab === 'licencies' && userRole !== 'adherent' && (
          <LicenciesTab
            adherents={adherents}
            userRole={userRole}
            saison={saison}
            onSelectAdherent={(adh, list) => {
              setSelectedAdherent(adh);
              setModalAdherentList(list || null);
            }}
            onNavigateToRencontres={() => setActiveTab('rencontres')}
          />
        )}

        {/* Onglet 'Infos Club' */}
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

        {/* Onglet 'Enseignants' */}
        {activeTab === 'enseignants' && (userRole === 'admin' || userRole === 'prof' || userRole === 'bureau') && (
          <EnseignantsTab
            adherents={adherents}
            clubInfo={clubInfo}
            onSelectAdherent={(adh) => {
              setSelectedAdherent(adh);
              setModalAdherentList(adherents);
            }}
          />
        )}

        {/* Onglet 'Adhérents' */}
        {activeTab === 'adherents' && (userRole === 'admin' || userRole === 'bureau') && (
          <AdherentsTab
            adherents={adherents}
            userRole={userRole}
            onSelectAdherent={(adh, list) => {
              setSelectedAdherent(adh);
              setModalAdherentList(list || adherents);
            }}
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

        {/* Onglet 'Règlements & Formats des Championnats' */}
        {activeTab === 'reglements' && (
          <ReglementsTab userRole={userRole} />
        )}

      </main>

      {/* 3. MODALES */}
      
      {/* Fiche détaillée de l'adhérent avec support du slide/navigation */}
      {selectedAdherent && (
        <AdherentModal
          adherent={selectedAdherent}
          adherentsList={modalAdherentList || adherents}
          onSelectAdherent={(adh) => setSelectedAdherent(adh)}
          onClose={() => {
            setSelectedAdherent(null);
            setModalAdherentList(null);
          }}
          onUpdateSolde={handleUpdateSolde}
        />
      )}

      {/* Module de composition d'équipe des capitaines avec slide entre fiches rencontres */}
      {selectedRencontreForComposition && (
        <CompositionModal
          rencontre={selectedRencontreForComposition}
          rencontresList={modalRencontresList || rencontres}
          onSelectRencontre={(r) => setSelectedRencontreForComposition(r)}
          adherents={adherents}
          allRencontres={rencontres}
          isOpen={!!selectedRencontreForComposition}
          onClose={() => {
            setSelectedRencontreForComposition(null);
            setModalRencontresList(null);
          }}
          onSaveComposition={handleSaveComposition}
          selectedSpreadsheetId={selectedSpreadsheetId}
          spreadsheetName={spreadsheetName}
          onOpenGoogleSyncModal={() => setIsGoogleSyncModalOpen(true)}
          saison={saison}
        />
      )}

      {/* Sondage des disponibilités des joueurs */}
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

      {/* Synchronisation Directe Google Sheets */}
      <GoogleSheetsSyncModal
        isOpen={isGoogleSyncModalOpen}
        onClose={() => setIsGoogleSyncModalOpen(false)}
        currentUser={googleUser}
        onUserChange={(u) => setGoogleUser(u)}
        selectedSpreadsheetId={selectedSpreadsheetId}
        onSelectSpreadsheet={(id, name) => {
          setSelectedSpreadsheetId(id);
          setSpreadsheetName(name);
          try {
            localStorage.setItem('tcm_spreadsheet_id', id);
            localStorage.setItem('tcm_spreadsheet_name', name);
          } catch (e) {
            console.warn(e);
          }
        }}
        spreadsheetName={spreadsheetName}
        onDataLoaded={(newAdh, newRen) => {
          const sorted = sortAdherentsByRankingDesc(newAdh);
          setAdherents(sorted);
          setRencontres(newRen);
          const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          setLastSyncTime(now);
        }}
      />

      {/* Cartographie et architecture des colonnes GSheet (Réservé Admin) */}
      {userRole === 'admin' && (
        <GsheetDataModal
          isOpen={isGsheetModalOpen}
          onClose={() => setIsGsheetModalOpen(false)}
          totalMembers={adherents.length}
          totalRencontres={rencontres.length}
          defaultTab={gsheetModalDefaultTab}
          onRefreshFromFile={() => handleLoadFromRealFile(false)}
          isLoadingFile={isLoadingFile}
        />
      )}

      {/* Modal d'édition des informations du club */}
      <EditClubInfoModal
        isOpen={isEditClubModalOpen}
        onClose={() => setIsEditClubModalOpen(false)}
        clubInfo={clubInfo}
        onSave={handleSaveClubInfo}
        selectedSpreadsheetId={selectedSpreadsheetId}
      />

      {/* Visionneuse Code.gs Google Apps Script & Déploiement (Réservé Admin) */}
      {userRole === 'admin' && (
        <AppsScriptModal
          isOpen={isScriptModalOpen}
          onClose={() => setIsScriptModalOpen(false)}
        />
      )}

      {/* Modale des Règles FFT 2027 & Barème (Accessible à tous les accès) */}
      <ReglesFftModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
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

      {/* 4. FOOTER */}
      <footer className="border-t border-[#1e232d] bg-[#090b0e] py-6 px-4 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="font-heading font-black text-white text-sm">Muzillac Tennis Club (TCM)</span>
            <span>•</span>
            <span className="text-zinc-400">
              {clubInfo.adresse 
                ? `${clubInfo.adresse}${clubInfo.codePostal || clubInfo.ville ? `, ${clubInfo.codePostal || ''} ${clubInfo.ville || ''}` : ''}` 
                : 'Complexe du Clos des Moines, 56190 Muzillac'}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-x-3 gap-y-1.5 text-zinc-400">
            {/* Liens techniques d'administration réservés UNIQUEMENT au profil Admin */}
            {userRole === 'admin' && (
              <>
                <button
                  onClick={() => setIsGsheetModalOpen(true)}
                  className="text-emerald-400 hover:text-emerald-300 font-semibold transition cursor-pointer"
                  title="Réservé aux Administrateurs"
                >
                  Architecture GSheet (Données_appli)
                </button>
                <span>•</span>
                <button
                  onClick={() => setIsScriptModalOpen(true)}
                  className="text-amber-400 hover:text-amber-300 font-semibold transition cursor-pointer"
                  title="Réservé aux Administrateurs"
                >
                  Fichiers Code.gs
                </button>
                <span>•</span>
              </>
            )}

            {/* Règles FFT et Portail FFT accessibles à TOUS les accès */}
            <button
              onClick={() => setIsRulesModalOpen(true)}
              className="text-orange-400 hover:text-orange-300 font-semibold transition cursor-pointer"
            >
              Règles FFT 2027
            </button>
            <span>•</span>
            <a
              href="https://tenup.fft.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-300 hover:text-white transition font-medium"
            >
              Portail FFT Ten'Up
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}
