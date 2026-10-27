/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
import { initAuth } from './services/auth';
import { Adherent, Rencontre, ClubInfo, ClubTarif, UserRole } from './types/tennis';
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

const sanitizeLoadedTarifs = (info: ClubInfo): ClubInfo => {
  if (!info) return info;
  const fixedInfo = { ...info };
  if (!fixedInfo.modalitesPaiement || !fixedInfo.modalitesPaiement.includes('HelloAsso')) {
    fixedInfo.modalitesPaiement = "Paiement échelonné possible par chèque et par CB via HelloAsso. Chèques vacances ANCV et Pass'Sport acceptés.";
  }
  if (!fixedInfo.helloAssoUrl) {
    fixedInfo.helloAssoUrl = "https://helloasso.com";
  }
  if (fixedInfo.tarifs && Array.isArray(fixedInfo.tarifs)) {
    const fixedTarifs: ClubTarif[] = fixedInfo.tarifs.map((t: ClubTarif) => {
      if (t.categorie === 'jeune' && /adulte|senior|majeur/i.test(t.label)) {
        const fixedCat: ClubTarif['categorie'] = /adh[eé]sion/i.test(t.label) && !/cours|collectif|entrain/i.test(t.label) 
          ? 'adhesion' 
          : 'adulte';
        return { ...t, categorie: fixedCat };
      }
      return t;
    });
    fixedInfo.tarifs = fixedTarifs;
  }
  return fixedInfo;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'infos' | 'adherents' | 'rencontres' | 'licencies' | 'enseignants'>('rencontres');
  const [userRole, setUserRole] = useState<UserRole>(() => {
    try {
      const savedRole = localStorage.getItem('tcm_user_role') as UserRole;
      if (savedRole && ['adherent', 'capitaine', 'prof', 'bureau'].includes(savedRole)) return savedRole;
    } catch (e) { console.warn(e); }
    return 'bureau';
  });

  const handleUpdateRole = (newRole: UserRole) => {
    setUserRole(newRole);
    try { localStorage.setItem('tcm_user_role', newRole); } catch (e) { console.warn(e); }
  };

  const [adherents, setAdherents] = useState<Adherent[]>(() => {
    try {
      const saved = localStorage.getItem('tcm_adherents_v2');
      if (saved) return sortAdherentsByRankingDesc(JSON.parse(saved));
    } catch (e) { console.warn(e); }
    return sortAdherentsByRankingDesc(INITIAL_ADHERENTS);
  });

  const [rencontres, setRencontres] = useState<Rencontre[]>(() => {
    try {
      const saved = localStorage.getItem('tcm_rencontres_v3');
      if (saved) return JSON.parse(saved);
    } catch (e) { console.warn(e); }
    return INITIAL_RENCONTRES;
  });

  const [clubInfo, setClubInfo] = useState<ClubInfo>(() => {
    try {
      const saved = localStorage.getItem('tcm_club_info_v2');
      if (saved) return sanitizeLoadedTarifs(JSON.parse(saved));
    } catch (e) { console.warn(e); }
    return INITIAL_CLUB_INFO;
  });

  const [selectedAdherent, setSelectedAdherent] = useState<Adherent | null>(null);
  const [selectedRencontreForComposition, setSelectedRencontreForComposition] = useState<Rencontre | null>(null);
  const [selectedRencontreForSondage, setSelectedRencontreForSondage] = useState<Rencontre | null>(null);
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [isGsheetModalOpen, setIsGsheetModalOpen] = useState(false);
  const [isNewMemberModalOpen, setIsNewMemberModalOpen] = useState(false);
  const [isNewMatchModalOpen, setIsNewMatchModalOpen] = useState(false);
  const [isEditClubModalOpen, setIsEditClubModalOpen] = useState(false);
  const [googleUser, setGoogleUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = initAuth((user) => setGoogleUser(user), () => setGoogleUser(null));
    return () => { if (unsub) unsub(); };
  }, []);

  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [fileLoadError, setFileLoadError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => localStorage.getItem('tcm_last_sync_v2'));

  // 🛡️ FEUILLE DE PLANIFICATION ET LOGISTIQUE SÉCURISÉE EN DIRECT
  const handleLoadFromRealFile = async (isInitial = false) => {
    setIsLoadingFile(true);
    setFileLoadError(null);
    try {
      const currentTimestamp = Date.now();
      const targetSheetId = "1FTYPkFaQM-S4UN5i8dL2zKZM4qZqHmckx-RmFxTya80";
      
      const cleanAdherentsUrl = `https://google.com{targetSheetId}/gviz/tq?tqx=out:csv&sheet=Adherents&nocache=${currentTimestamp}`;
      const res = await fetch(cleanAdherentsUrl, { 
        method: "GET",
        headers: { "Cache-Control": "no-cache, no-store" },
        cache: "no-store" 
      });
      
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length > 0) {
          const parsed = parseAdherentsCsv(text);
          if (parsed && parsed.length > 0) {
            const sorted = sortAdherentsByRankingDesc(parsed);
            setAdherents(sorted);
            localStorage.setItem('tcm_adherents_v2', JSON.stringify(sorted));
          }
        }
      }

      const cleanRencontresUrl = `https://google.com{targetSheetId}/gviz/tq?tqx=out:csv&sheet=Rencontres&nocache=${currentTimestamp}`;
      const resRec = await fetch(cleanRencontresUrl, { 
        method: "GET",
        headers: { "Cache-Control": "no-cache, no-store" },
        cache: "no-store" 
      });
      
      if (resRec.ok) {
        const textRec = await resRec.text();
        if (textRec && textRec.trim().length > 0) {
          const parsedRec = parseRencontresCsv(textRec);
          if (parsedRec && parsedRec.length > 0) {
            setRencontres(parsedRec);
            localStorage.setItem('tcm_rencontres_v3', JSON.stringify(parsedRec));
            const syncStr = new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR');
            setLastSyncTime(syncStr);
            localStorage.setItem('tcm_last_sync_v2', syncStr);
          }
        }
      }
    } catch (error: any) {
      console.error("Erreur de synchronisation Google Sheets :", error);
      setFileLoadError(error.message || "Erreur de connexion aux serveurs Google");
    } finally {
      setIsLoadingFile(false);
    }
  };

  useEffect(() => {
    handleLoadFromRealFile(true);
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0f17] text-white flex flex-col font-sans selection:bg-[#E65100]/30 selection:text-orange-200 antialiased">
      <Header 
        userRole={userRole} 
        onUpdateRole={handleUpdateRole} 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        googleUser={googleUser}
        onOpenGsheetModal={() => { setIsGsheetModalOpen(true); }}
        onOpenScriptModal={() => setIsScriptModalOpen(true)}
        onOpenEditClubModal={() => setIsEditClubModalOpen(true)}
        lastSyncTime={lastSyncTime}
      />
      
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {fileLoadError && (
          <div className="mb-6 p-4 rounded-2xl bg-red-950/40 border border-red-500/30 text-red-200 text-sm flex items-center justify-between">
            <span>⚠️ Échec de connexion : {fileLoadError} (Affichage des données locales mises en cache)</span>
            <button onClick={() => handleLoadFromRealFile()} className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 font-bold transition text-xs">Réessayer</button>
          </div>
        )}

        {activeTab === 'infos' && (
          <InfosClubTab clubInfo={clubInfo} userRole={userRole} onOpenEditModal={() => setIsEditClubModalOpen(true)} />
        )}
        {activeTab === 'rencontres' && (
          <RencontresTab 
            rencontres={rencontres} 
            adherents={adherents} 
            userRole={userRole}
            onOpenCompositionModal={setSelectedRencontreForComposition}
            onOpenSondageModal={setSelectedRencontreForSondage}
            onRefreshData={() => handleLoadFromRealFile()}
            isAutoSyncing={isLoadingFile}
          />
        )}
        {activeTab === 'licencies' && <LicenciesTab />}
        {activeTab === 'enseignants' && <EnseignantsTab adherents={adherents} userRole={userRole} />}
        {activeTab === 'adherents' && (
          <AdherentsTab 
            adherents={adherents} 
            userRole={userRole} 
            onSelectAdherent={setSelectedAdherent}
            onOpenNewMemberModal={() => setIsNewMemberModalOpen(true)}
          />
        )}
      </main>

      {selectedAdherent && (
        <AdherentModal adherent={selectedAdherent} onClose={() => setSelectedAdherent(null)} userRole={userRole} />
      )}
      {selectedRencontreForComposition && (
        <CompositionModal rencontre={selectedRencontreForComposition} adherents={adherents} onClose={() => setSelectedRencontreForComposition(null)} />
      )}
{selectedRencontreForSondage && (
<SondageDisponibilitesModal rencontre={selectedRencontreForSondage} adherents={adherents} onClose={() => setSelectedRencontreForSondage(null)} />
)}
<AppsScriptModal isOpen={isScriptModalOpen} onClose={() => setIsScriptModalOpen(false)} />
<GsheetDataModal isOpen={isGsheetModalOpen} onClose={() => setIsGsheetModalOpen(false)} defaultTab="sync" adherents={adherents} rencontres={rencontres} />
<NewMemberModal isOpen={isNewMemberModalOpen} onClose={() => setIsNewMemberModalOpen(false)} onAddMember={(m) => setAdherents(prev => sortAdherentsByRankingDesc([...prev, m]))} />
<NewMatchModal isOpen={isNewMatchModalOpen} onClose={() => setIsNewMatchModalOpen(false)} onAddMatch={(m) => setRencontres(prev => [...prev, m])} />
<EditClubInfoModal isOpen={isEditClubModalOpen} onClose={() => setIsEditClubModalOpen(false)} clubInfo={clubInfo} onSave={setClubInfo} />

);
}
