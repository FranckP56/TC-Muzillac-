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
    fixedInfo.tarifs = fixedInfo.tarifs.map((t: ClubTarif) => {
      if (t.categorie === 'jeune' && /adulte|senior|majeur/i.test(t.label)) {
        const fixedCat: ClubTarif['categorie'] = /adh[eé]sion/i.test(t.label) && !/cours|collectif|entrain/i.test(t.label) ? 'adhesion' : 'adulte';
        return { ...t, categorie: fixedCat };
      }
      return t;
    });
  }
  return fixedInfo;
};

async function executerTelechargementGSheet(): Promise<{ adherents: Adherent[]; rencontres: Rencontre[] } | null> {
  try {
    const currentTimestamp = Date.now();
    const targetSheetId = "1FTYPkFaQM-S4UN5i8dL2zKZM4qZqHmckx-RmFxTya80";
    let adherentsResultats: Adherent[] = [];
    let rencontresResultats: Rencontre[] = [];
    
    const cleanAdherentsUrl = `https://google.com{targetSheetId}/gviz/tq?tqx=out:csv&sheet=Adherents&nocache=${currentTimestamp}`;
    const res = await fetch(cleanAdherentsUrl, { method: "GET", headers: { "Cache-Control": "no-cache, no-store" }, cache: "no-store" });
    
    if (res.ok) {
      const text = await res.text();
      if (text && text.trim().length > 0) {
        const parsed = parseAdherentsCsv(text);
        if (parsed && parsed.length > 0) adherentsResultats = sortAdherentsByRankingDesc(parsed);
      }
    }

    const cleanRencontresUrl = `https://google.com{targetSheetId}/gviz/tq?tqx=out:csv&sheet=Rencontres&nocache=${currentTimestamp}`;
    const resRec = await fetch(cleanRencontresUrl, { method: "GET", headers: { "Cache-Control": "no-cache, no-store" }, cache: "no-store" });
    
    if (resRec.ok) {
      const textRec = await resRec.text();
      if (textRec && textRec.trim().length > 0) {
        const parsedRec = parseRencontresCsv(textRec);
        if (parsedRec && parsedRec.length > 0) rencontresResultats = parsedRec;
      }
    }
    return { adherents: adherentsResultats, rencontres: rencontresResultats };
  } catch (error) {
    console.error("Erreur réseau isolée :", error);
    return null;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'infos' | 'adherents' | 'rencontres' | 'licencies' | 'enseignants'>('rencontres');
  const [userRole, setUserRole] = useState<UserRole>(() => {
    try {
      const savedRole = localStorage.getItem('tcm_user_role') as UserRole;
      if (savedRole && ['adherent', 'capitaine', 'prof', 'bureau'].includes(savedRole)) return savedRole;
    } catch (e) { console.warn(e); }
    return 'bureau';
  });

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
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [fileLoadError, setFileLoadError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => localStorage.getItem('tcm_last_sync_v2'));

  const handleUpdateRole = (newRole: UserRole) => {
    setUserRole(newRole);
    try { localStorage.setItem('tcm_user_role', newRole); } catch (e) { console.warn(e); }
  };

  const handleLoadFromRealFile = async () => {
    setIsLoadingFile(true);
    setFileLoadError(null);
    const donneesTelechargees = await executerTelechargementGSheet();
    if (donneesTelechargees) {
      if (donneesTelechargees.adherents.length > 0) {
        setAdherents(donneesTelechargees.adherents);
        localStorage.setItem('tcm_adherents_v2', JSON.stringify(donneesTelechargees.adherents));
      }
      if (donneesTelechargees.rencontres.length > 0) {
        setRencontres(donneesTelechargees.rencontres);
        localStorage.setItem('tcm_rencontres_v3', JSON.stringify(donneesTelechargees.rencontres));
        const syncStr = new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR');
        setLastSyncTime(syncStr);
        localStorage.setItem('tcm_last_sync_v2', syncStr);
      }
    } else {
      setFileLoadError("Erreur d'accès aux tables de la Google Sheet.");
    }
    setIsLoadingFile(false);
  };

  useEffect(() => {
    initAuth((user) => setGoogleUser(user), () => setGoogleUser(null));
    handleLoadFromRealFile();
  }, []);

  // Extraction logique linéaire du panneau principal pour éliminer les jetons inattendus
  let blocContenuPrincipal = null;
  if (activeTab === 'infos') {
    blocContenuPrincipal = <InfosClubTab clubInfo={clubInfo} userRole={userRole} onOpenEditModal={() => setIsEditClubModalOpen(true)} />;
  } else if (activeTab === 'rencontres') {
    blocContenuPrincipal = <RencontresTab rencontres={rencontres} adherents={adherents} userRole={userRole} onOpenCompositionModal={setSelectedRencontreForComposition} onOpenSondageModal={setSelectedRencontreForSondage} onRefreshData={handleLoadFromRealFile} isAutoSyncing={isLoadingFile} />;
  } else if (activeTab === 'licencies') {
    blocContenuPrincipal = <LicenciesTab />;
  } else if (activeTab === 'enseignants') {
    blocContenuPrincipal = <EnseignantsTab adherents={adherents} userRole={userRole} />;
  } else if (activeTab === 'adherents') {
    blocContenuPrincipal = <AdherentsTab adherents={adherents} userRole={userRole} onSelectAdherent={setSelectedAdherent} onOpenNewMemberModal={() => setIsNewMemberModalOpen(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#0b0f17] text-white flex flex-col font-sans selection:bg-[#E65100]/30 selection:text-orange-200 antialiased">
      <Header userRole={userRole} onUpdateRole={handleUpdateRole} activeTab={activeTab} onTabChange={setActiveTab} googleUser={googleUser} onOpenGsheetModal={() => setIsGsheetModalOpen(true)} onOpenScriptModal={() => setIsScriptModalOpen(true)} onOpenEditClubModal={() => setIsEditClubModalOpen(true)} lastSyncTime={lastSyncTime} />
      
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {fileLoadError && (
          <div className="mb-6 p-4 rounded-2xl bg-red-950/40 border border-red-500/30 text-red-200 text-sm flex items-center justify-between">
            <span>⚠️ Échec de connexion : {fileLoadError} (Affichage des données locales mises en cache)</span>
            <button onClick={handleLoadFromRealFile} className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 font-bold transition text-xs">Réessayer</button>
          </div>
        )}
        {blocContenuPrincipal}
      </main>

      {selectedAdherent && <AdherentModal adherent={selectedAdherent} onClose={() => setSelectedAdherent(null)} userRole={userRole} />}
{selectedRencontreForComposition && <CompositionModal rencontre={selectedRencontreForComposition} adherents={adherents} onClose={() => setSelectedRencontreForComposition(null)} />}
{selectedRencontreForSondage && <SondageDisponibilitesModal rencontre={selectedRencontreForSondage} adherents={adherents} onClose={() => setSelectedRencontreForSondage(null)} />}
<AppsScriptModal isOpen={isScriptModalOpen} onClose={() => setIsScriptModalOpen(false)} />
<GsheetDataModal isOpen={isGsheetModalOpen} onClose={() => setIsGsheetModalOpen(false)} defaultTab="sync" adherents={adherents} rencontres={rencontres} />
<NewMemberModal isOpen={isNewMemberModalOpen} onClose={() => setIsNewMemberModalOpen(false)} onAddMember={(m) => setAdherents(prev => sortAdherentsByRankingDesc([...prev, m]))} />
<NewMatchModal isOpen={isNewMatchModalOpen} onClose={() => setIsNewMatchModalOpen(false)} onAddMatch={(m) => setRencontres(prev => [...prev, m])} />
<EditClubInfoModal isOpen={isEditClubModalOpen} onClose={() => setIsEditClubModalOpen(false)} clubInfo={clubInfo} onSave={setClubInfo} />

);
}
