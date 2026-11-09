import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  ShieldAlert, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  UserCheck, 
  Calendar, 
  Trophy, 
  Users, 
  Info, 
  Lock, 
  Unlock, 
  Copy, 
  Check, 
  FileSpreadsheet, 
  Clock, 
  MapPin, 
  Layers, 
  ArrowUpDown, 
  Sparkles, 
  SlidersHorizontal, 
  Building, 
  Sun, 
  ChevronLeft, 
  ChevronRight,
  Search,
  Phone,
  Mail,
  MessageSquare,
  ArrowUp,
  ArrowDown,
  ClipboardCheck
} from 'lucide-react';
import { formatJourneeLabel, formatMuzillacClubName } from './RencontresTab';
import { motion, AnimatePresence } from 'motion/react';
import { Adherent, Rencontre, MatchComposition, FrozenPlayerSlot, UserRole } from '../types/tennis';
import { checkFFT2027Eligibility, getRequiredSex } from '../utils/fftEligibility';
import { getRankingMeta, getRankingWeight } from '../utils/ranking';
import { checkSinglesRankingOrder, getNextFftMonthlyRankingRelease } from '../utils/fftCalendar';
import { 
  getCompetitionFormat, 
  validateMatchDateAndSchedule, 
  checkRegionalDoublesWeight, 
  TCM_VENUES, 
  STANDARD_HOURS,
  CompetitionFormatInfo,
  DoublesWeightCheckResult
} from '../utils/competitionFormats';
import { 
  computeMatchRotationSchedule, 
  getAdverseClubFullAddress, 
  MatchSchedulePlan 
} from '../utils/matchScheduling';
import { ConfirmSaveCompositionModal } from './ConfirmSaveCompositionModal';
import { saveCompositionToSheet } from '../services/googleSheets';
import { getAccessToken } from '../services/auth';
import { isLicencieMuzillac } from '../utils/licencies';

/**
 * Convertit JJ/MM/AAAA en AAAA-MM-JJ pour input type="date"
 */
export function toIsoDate(dStr?: string): string {
  if (!dStr) return '';
  const parts = dStr.split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return dStr;
}

/**
 * Convertit AAAA-MM-JJ en JJ/MM/AAAA
 */
export function fromIsoDate(isoStr?: string): string {
  if (!isoStr) return '';
  const parts = isoStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoStr;
}

interface CompositionModalProps {
  rencontre: Rencontre;
  rencontresList?: Rencontre[];
  onSelectRencontre?: (rencontre: Rencontre) => void;
  adherents: Adherent[];
  allRencontres?: Rencontre[];
  isOpen: boolean;
  onClose: () => void;
  onSaveComposition: (rencontreId: string, composition: MatchComposition) => void;
  selectedSpreadsheetId?: string | null;
  spreadsheetName?: string;
  onOpenGoogleSyncModal?: () => void;
  saison?: string;
  onOpenSondageModal?: (rencontre: Rencontre) => void;
  userRole?: UserRole;
}

type SlotKey = 
  | 'simple1Id' 
  | 'simple2Id' 
  | 'simple3Id' 
  | 'simple4Id' 
  | 'simple5Id' 
  | 'double1Player1Id' 
  | 'double1Player2Id' 
  | 'double2Player1Id' 
  | 'double2Player2Id';

export const CompositionModal: React.FC<CompositionModalProps> = ({
  rencontre,
  rencontresList,
  onSelectRencontre,
  adherents,
  allRencontres,
  isOpen,
  onClose,
  onSaveComposition,
  selectedSpreadsheetId,
  spreadsheetName = 'Données_appli',
  onOpenGoogleSyncModal,
  saison = '2027',
  onOpenSondageModal,
  userRole = 'adherent',
}) => {
  // Navigation / Slider entre rencontres selon les critères actifs
  const [direction, setDirection] = useState<number>(1);
  const currentIndex = rencontresList && rencontre
    ? rencontresList.findIndex(r => r.id === rencontre.id)
    : -1;
  const totalInList = rencontresList ? rencontresList.length : 0;
  const hasMultiple = totalInList > 1 && currentIndex !== -1;

  const handlePrev = useCallback(() => {
    if (!hasMultiple || !rencontresList || !onSelectRencontre) return;
    setDirection(-1);
    const prevIdx = (currentIndex - 1 + totalInList) % totalInList;
    onSelectRencontre(rencontresList[prevIdx]);
  }, [hasMultiple, rencontresList, currentIndex, totalInList, onSelectRencontre]);

  const handleNext = useCallback(() => {
    if (!hasMultiple || !rencontresList || !onSelectRencontre) return;
    setDirection(1);
    const nextIdx = (currentIndex + 1) % totalInList;
    onSelectRencontre(rencontresList[nextIdx]);
  }, [hasMultiple, rencontresList, currentIndex, totalInList, onSelectRencontre]);

  // Support tactile Swipe robuste
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    // Seuil de 60px avec confirmation de glissement principalement horizontal (2x le mouvement vertical)
    if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 2.0) {
      if (deltaX < 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Raccourcis clavier (Flèches et Echap)
  useEffect(() => {
    if (!rencontre || !isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrev, handleNext, onClose, rencontre, isOpen]);

  // État local de la composition
  const [composition, setComposition] = useState<MatchComposition>(() => {
    return rencontre?.composition || {
      simple1Id: undefined,
      simple2Id: undefined,
      simple3Id: undefined,
      simple4Id: undefined,
      simple5Id: undefined,
      double1Player1Id: undefined,
      double1Player2Id: undefined,
      double2Player1Id: undefined,
      double2Player2Id: undefined,
      valideParCapitaine: false,
    };
  });

  const isHome = (rencontre?.clubAccueilNom || '').toLowerCase().includes('muzillac');
  const adverseAddressInfo = useMemo(() => rencontre ? getAdverseClubFullAddress(rencontre) : { hasAdverseAddress: false, venueLabel: '' }, [rencontre]);

  // Logistique TCM (Validation Date, Heure, Courts, Lieu)
  const [matchDateInput, setMatchDateInput] = useState<string>(() => {
    return composition.dateRencontreValidee || rencontre?.dateRencontre || '15/03/2026';
  });
  const [matchHourInput, setMatchHourInput] = useState<string>(() => {
    return composition.heureDebut || '14:00';
  });
  const [matchCourtsInput, setMatchCourtsInput] = useState<number>(() => {
    return composition.nombreCourts || 2;
  });
  const [matchVenueInput, setMatchVenueInput] = useState<string>(() => {
    if (composition.lieuRencontre) return composition.lieuRencontre;
    if (!isHome && adverseAddressInfo.hasAdverseAddress) {
      return adverseAddressInfo.venueLabel;
    }
    if (!isHome && rencontre) {
      return `${rencontre.clubAccueilNom} (Installations adverses)`;
    }
    return 'Clos des Moines - 2 courts couverts résine (TCM)';
  });
  const [customVenueInput, setCustomVenueInput] = useState('');
  const [formatReduit, setFormatReduit] = useState<boolean>(() => {
    return !!composition.formatReduit;
  });

  // Réinitialisation de l'état local quand on change de rencontre (slide)
  useEffect(() => {
    if (!rencontre) return;
    setComposition(rencontre.composition || {
      simple1Id: undefined,
      simple2Id: undefined,
      simple3Id: undefined,
      simple4Id: undefined,
      simple5Id: undefined,
      double1Player1Id: undefined,
      double1Player2Id: undefined,
      double2Player1Id: undefined,
      double2Player2Id: undefined,
      valideParCapitaine: false,
    });
    setMatchDateInput(rencontre.composition?.dateRencontreValidee || rencontre.dateRencontre || '15/03/2026');
    setMatchHourInput(rencontre.composition?.heureDebut || '14:00');
    setMatchCourtsInput(rencontre.composition?.nombreCourts || 2);
    
    const isH = (rencontre.clubAccueilNom || '').toLowerCase().includes('muzillac');
    const adv = getAdverseClubFullAddress(rencontre);
    if (rencontre.composition?.lieuRencontre) {
      setMatchVenueInput(rencontre.composition.lieuRencontre);
    } else if (!isH && adv.hasAdverseAddress) {
      setMatchVenueInput(adv.venueLabel);
    } else if (!isH) {
      setMatchVenueInput(`${rencontre.clubAccueilNom} (Installations adverses)`);
    } else {
      setMatchVenueInput('Clos des Moines - 2 courts couverts résine (TCM)');
    }
    setFormatReduit(!!rencontre.composition?.formatReduit);
    setActiveSlot(null);
    setBlockedAlertMessage(null);
    setValidationSuccess(false);
  }, [rencontre?.id]);

  // Slot en cours de sélection
  const [activeSlot, setActiveSlot] = useState<{
    key: SlotKey;
    label: string;
  } | null>(null);

  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const activeSlotRef = useRef<HTMLDivElement>(null);

  // Défilement automatique fluide vers le tiroir de sélection de joueur lorsqu'un slot est cliqué
  useEffect(() => {
    if (activeSlot) {
      setPlayerSearchQuery('');
      setTimeout(() => {
        activeSlotRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, [activeSlot]);

  const [filterEligibleOnly, setFilterEligibleOnly] = useState(true);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [blockedAlertMessage, setBlockedAlertMessage] = useState<string | null>(null);
  const [validationSuccess, setValidationSuccess] = useState(false);

  // État Google Sheets & Gel des classements
  const [isConfirmGsheetOpen, setIsConfirmGsheetOpen] = useState(false);
  const [isSavingToSheet, setIsSavingToSheet] = useState(false);
  const [sheetSaveSuccess, setSheetSaveSuccess] = useState<string | null>(null);

  const reqSex = getRequiredSex(rencontre);

  // Dictionnaire des adhérents pour lookup rapide (par ID, licence, nom et joueurs gelés)
  const adherentsById = useMemo(() => {
    const map = new Map<string, Adherent>();
    
    adherents.forEach(a => {
      map.set(a.id, a);
      if (a.licence) {
        map.set(a.licence.trim(), a);
        map.set(a.licence.replace(/\s+/g, ''), a);
      }
      if (a.nomPrenom) {
        map.set(a.nomPrenom.trim(), a);
        map.set(a.nomPrenom.toLowerCase().trim(), a);
      }
    });

    // Ingestion des joueurs gelés dans la composition de cette rencontre
    if (rencontre.composition?.frozenPlayers) {
      rencontre.composition.frozenPlayers.forEach(fp => {
        if (!map.has(fp.adherentId) && !map.has(fp.licence || '') && !map.has(fp.nomPrenom)) {
          const synth: Adherent = {
            id: fp.adherentId || fp.licence || fp.nomPrenom,
            nomPrenom: fp.nomPrenom,
            civilite: 'Monsieur',
            dateNaissance: fp.dateNaissance || '',
            typeLicence: fp.typeLicence || 'Licence C',
            millesimeLicence: '2027',
            soldeDu: 0,
            telephonePortable: '',
            email: '',
            dernierClassTennis: fp.classementGele || 'NC',
            meilleurClassTennis: fp.classementGele || 'NC',
            licence: fp.licence || '',
            ageSportif: fp.ageSportif || '',
            groupeEnseignement: 'Compétition',
            compteTenUp: 'Actif',
            ville: 'Muzillac',
            clubRattachement: 'MUZILLAC TENNIS CLUB',
          };
          map.set(synth.id, synth);
          if (synth.licence) {
            map.set(synth.licence.trim(), synth);
            map.set(synth.licence.replace(/\s+/g, ''), synth);
          }
          map.set(synth.nomPrenom.trim(), synth);
        }
      });
    }

    return map;
  }, [adherents, rencontre]);

  // Analyse du format de championnat officiel (Jeunes, Seniors+, Régional, Départemental)
  const compFormat: CompetitionFormatInfo = useMemo(() => {
    return getCompetitionFormat(rencontre, { formatReduit });
  }, [rencontre, formatReduit]);

  // Numéros des joueurs de simple assignés à chaque match chronologique
  // Ex: pour 4 simples, les matchs 1, 2, 3, 4 peuvent avoir comme joueurs [4, 2, 3, 1] ou [2, 3, 1, 4]
  const defaultSinglesPlayerNumbers = useMemo(() => {
    const n = compFormat.numSingles;
    if (n === 4) return [4, 2, 3, 1];
    if (n === 3) return [3, 2, 1];
    if (n === 5) return [4, 3, 2, 1, 5];
    const list: number[] = [];
    for (let i = 1; i <= n; i++) list.push(i);
    return list;
  }, [compFormat.numSingles]);

  const [singlesPlayerNumbers, setSinglesPlayerNumbers] = useState<number[]>(defaultSinglesPlayerNumbers);

  useEffect(() => {
    setSinglesPlayerNumbers(defaultSinglesPlayerNumbers);
  }, [defaultSinglesPlayerNumbers, rencontre?.id]);

  const swapSinglesPlayerNumbers = (indexA: number, indexB: number) => {
    if (
      indexA < 0 || 
      indexA >= singlesPlayerNumbers.length || 
      indexB < 0 || 
      indexB >= singlesPlayerNumbers.length
    ) return;
    const newOrder = [...singlesPlayerNumbers];
    const temp = newOrder[indexA];
    newOrder[indexA] = newOrder[indexB];
    newOrder[indexB] = temp;
    setSinglesPlayerNumbers(newOrder);
  };

  const getMatchTimeSlot = (index: number) => {
    const courts = Math.max(1, matchCourtsInput);
    const rotationIndex = Math.floor(index / courts);
    const [hStr, mStr] = (matchHourInput || '09:00').split(':');
    const h = parseInt(hStr, 10) || 9;
    const m = parseInt(mStr, 10) || 0;
    const totalMinutes = h * 60 + m + rotationIndex * 90;
    const newH = Math.floor(totalMinutes / 60) % 24;
    const newM = totalMinutes % 60;
    return `${String(newH).padStart(2, '0')}h${String(newM).padStart(2, '0')}`;
  };

  // Calcul du planning des créneaux et des rotations par court
  const schedulePlan: MatchSchedulePlan = useMemo(() => {
    return computeMatchRotationSchedule(
      matchHourInput,
      matchCourtsInput,
      compFormat,
      composition,
      adherentsById
    );
  }, [matchHourInput, matchCourtsInput, compFormat, composition, adherentsById]);

  // Contrôle du jour de la semaine et de l'alternance (Dimanche Seniors vs Samedi Jeunes)
  const scheduleCheck = useMemo(() => {
    return validateMatchDateAndSchedule(matchDateInput, compFormat, rencontre.sexeHomologation);
  }, [matchDateInput, compFormat, rencontre.sexeHomologation]);

  // Contrôle de la règle obligatoire FFT du poids des doubles en Régional (Double 1 >= Double 2)
  const doublesWeightCheck: DoublesWeightCheckResult = useMemo(() => {
    if (!compFormat.doubleWeightStrict) {
      return { 
        isValid: true, 
        weightDouble1: 0, 
        weightDouble2: 0, 
        p1Rank: '-',
        p2Rank: '-',
        p3Rank: '-',
        p4Rank: '-',
        errorMessage: undefined,
        isComplete: false 
      };
    }
    return checkRegionalDoublesWeight(composition, adherentsById);
  }, [compFormat, composition, adherentsById]);

  // Inverser les paires Double 1 et Double 2 en 1 clic
  const handleSwapDoubles = () => {
    setComposition(prev => ({
      ...prev,
      double1Player1Id: prev.double2Player1Id,
      double1Player2Id: prev.double2Player2Id,
      double2Player1Id: prev.double1Player1Id,
      double2Player2Id: prev.double1Player2Id,
      valideParCapitaine: false,
    }));
  };

  // Candidats éligibles pour CETTE rencontre :
  // RÈGLE ABSOLUE FFT : On ne propose JAMAIS d'hommes pour une épreuve Dames, ni de femmes pour une épreuve Messieurs
  // RÈGLE TCM : Les joueurs à affecter sont prioritairement les licenciés 2027 du club (cols X & AB)
  const playersWithEligibility = useMemo(() => {
    return adherents
      .filter(adh => {
        const playerSex = (adh.civilite === 'Madame' ? 'F' : 'H');
        if (reqSex === 'Mixte') return true;
        return playerSex === reqSex;
      })
      .map(adh => {
        const eligibility = checkFFT2027Eligibility(adh, rencontre, saison);
        const isLicencie = isLicencieMuzillac(adh, saison);
        const dispo = (rencontre.disponibilites || []).find(d => d.adherentId === adh.id);
        return {
          adherent: adh,
          eligibility,
          meta: getRankingMeta(adh.dernierClassTennis),
          weight: getRankingWeight(adh.dernierClassTennis),
          isLicencie,
          dispo,
        };
      })
      .sort((a, b) => {
        // 1. Licencié TCM en priorité
        if (a.isLicencie && !b.isLicencie) return -1;
        if (!a.isLicencie && b.isLicencie) return 1;

        // 2. Éligibilité FFT
        if (a.eligibility.isEligible && !b.eligibility.isEligible) return -1;
        if (!a.eligibility.isEligible && b.eligibility.isEligible) return 1;

        // 3. Statut sondage de disponibilité (Dispo > Incertain > Non répondu > Indispo)
        const getScore = (d?: typeof a.dispo) => {
          if (!d) return 0;
          if (d.statut === 'disponible') return 2;
          if (d.statut === 'incertain') return 1;
          if (d.statut === 'indisponible') return -2;
          return 0;
        };
        const scoreA = getScore(a.dispo);
        const scoreB = getScore(b.dispo);
        if (scoreA !== scoreB) return scoreB - scoreA;

        // 4. Classement FFT décroissant
        return b.weight - a.weight;
      });
  }, [adherents, rencontre, reqSex]);

  // Vérifier les joueurs sélectionnés dans le format actif
  const selectedPlayerIds = useMemo(() => {
    const ids: string[] = [];
    if (composition.simple1Id) ids.push(composition.simple1Id);
    if (composition.simple2Id) ids.push(composition.simple2Id);
    if (composition.simple3Id && compFormat.numSingles >= 3) ids.push(composition.simple3Id);
    if (composition.simple4Id && compFormat.numSingles >= 4) ids.push(composition.simple4Id);
    if (composition.simple5Id && compFormat.numSingles >= 5) ids.push(composition.simple5Id);
    if (composition.double1Player1Id) ids.push(composition.double1Player1Id);
    if (composition.double1Player2Id) ids.push(composition.double1Player2Id);
    if (composition.double2Player1Id && compFormat.numDoubles >= 2) ids.push(composition.double2Player1Id);
    if (composition.double2Player2Id && compFormat.numDoubles >= 2) ids.push(composition.double2Player2Id);
    return ids;
  }, [composition, compFormat]);

  // Validation globale de la composition
  const currentCompositionIssues = useMemo(() => {
    const issues: { player: Adherent; errors: string[] }[] = [];
    selectedPlayerIds.forEach(id => {
      const p = adherentsById.get(id);
      if (p) {
        const check = checkFFT2027Eligibility(p, rencontre);
        if (!check.isEligible) {
          issues.push({ player: p, errors: check.errors });
        }
      }
    });
    return issues;
  }, [selectedPlayerIds, adherentsById, rencontre]);

  const hasIneligiblePlayer = currentCompositionIssues.length > 0;

  // Contrôle de l'ordre officiel FFT des classements en simple
  const rankingOrderCheck = useMemo(() => {
    return checkSinglesRankingOrder(composition, adherentsById);
  }, [composition, adherentsById]);

  // Calcul du poids de l'équipe (classements cumulés)
  const teamStrength = useMemo(() => {
    let count = 0;
    const ranks: string[] = [];
    const activeSingleIds = [
      composition.simple1Id,
      composition.simple2Id,
      compFormat.numSingles >= 3 ? composition.simple3Id : undefined,
      compFormat.numSingles >= 4 ? composition.simple4Id : undefined,
      compFormat.numSingles >= 5 ? composition.simple5Id : undefined,
    ].filter(Boolean);

    activeSingleIds.forEach(id => {
      if (id) {
        const p = adherentsById.get(id);
        if (p) {
          count++;
          ranks.push(p.dernierClassTennis);
        }
      }
    });
    return { count, ranks };
  }, [composition, compFormat, adherentsById]);

  // Assigner un joueur à un poste
  const handleAssignPlayer = (adherent: Adherent, slotKey: SlotKey) => {
    const eligibility = checkFFT2027Eligibility(adherent, rencontre);

    if (!eligibility.isEligible) {
      setBlockedAlertMessage(
        `Validation impossible pour ${adherent.nomPrenom} :\n• ` + eligibility.errors.join('\n• ')
      );
      return;
    }

    setComposition(prev => ({
      ...prev,
      [slotKey]: adherent.id,
      valideParCapitaine: false,
    }));
    setActiveSlot(null);
    setBlockedAlertMessage(null);
  };

  const handleClearSlot = (slotKey: SlotKey) => {
    setComposition(prev => ({
      ...prev,
      [slotKey]: undefined,
      valideParCapitaine: false,
    }));
  };

  // Validation définitive de la feuille de match
  const handleValidateMatchSheet = () => {
    if (hasIneligiblePlayer) {
      setBlockedAlertMessage(
        "Blocage FFT 2027 : La feuille de match contient un ou plusieurs joueurs non éligibles. Retirez-les avant de valider la composition officielle."
      );
      return;
    }

    if (!rankingOrderCheck.isValid) {
      setBlockedAlertMessage(
        `Blocage Ordre des Classements FFT (1er mardi du mois) :\n${rankingOrderCheck.error}\n\nEn compétition officielle par équipe, les joueurs de simple doivent être ordonnés par classement strictement décroissant.`
      );
      return;
    }

    if (compFormat.doubleWeightStrict && doublesWeightCheck.errorMessage) {
      setBlockedAlertMessage(
        `Blocage Règle Régionale FFT (Poids des Doubles) :\n${doublesWeightCheck.errorMessage}`
      );
      return;
    }

    if (selectedPlayerIds.length === 0) {
      setBlockedAlertMessage("Veuillez désigner au moins un joueur sur la feuille de match.");
      return;
    }

    const effectiveVenue = matchVenueInput === 'autre' ? customVenueInput || 'Lieu personnalisé' : matchVenueInput;

    const updated: MatchComposition = {
      ...composition,
      valideParCapitaine: true,
      dateValidation: new Date().toLocaleDateString('fr-FR'),
      dateRencontreValidee: matchDateInput,
      heureDebut: matchHourInput,
      lieuRencontre: effectiveVenue,
      nombreCourts: matchCourtsInput,
      formatReduit,
      poidsDouble1: doublesWeightCheck.weightDouble1,
      poidsDouble2: doublesWeightCheck.weightDouble2,
      poidsDoublesValide: doublesWeightCheck.isValid,
    };

    // Si connecté à Google Sheets, afficher la boîte de dialogue de confirmation explicite
    if (selectedSpreadsheetId) {
      setComposition(updated);
      setIsConfirmGsheetOpen(true);
      return;
    }

    // Sinon validation locale
    setComposition(updated);
    onSaveComposition(rencontre.id, updated);
    setValidationSuccess(true);
    setTimeout(() => setValidationSuccess(false), 3500);
  };

  // Exécution de l'enregistrement dans Google Sheets Données_appli après confirmation explicite
  const handleConfirmSaveToGsheet = async () => {
    if (!selectedSpreadsheetId || !rencontre) return;
    setIsSavingToSheet(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Jeton d'accès Google expiré. Veuillez reconnecter votre compte Google.");
      }

      const effectiveVenue = matchVenueInput === 'autre' ? customVenueInput || 'Lieu personnalisé' : matchVenueInput;

      const updated: MatchComposition = {
        ...composition,
        valideParCapitaine: true,
        dateValidation: new Date().toLocaleDateString('fr-FR'),
        dateRencontreValidee: matchDateInput,
        heureDebut: matchHourInput,
        lieuRencontre: effectiveVenue,
        nombreCourts: matchCourtsInput,
        formatReduit,
        poidsDouble1: doublesWeightCheck.weightDouble1,
        poidsDouble2: doublesWeightCheck.weightDouble2,
        poidsDoublesValide: doublesWeightCheck.isValid,
      };

      const result = await saveCompositionToSheet(
        selectedSpreadsheetId,
        rencontre,
        updated,
        adherentsById,
        token
      );

      setComposition(updated);
      onSaveComposition(rencontre.id, updated);
      setIsConfirmGsheetOpen(false);
      setSheetSaveSuccess(`Composition enregistrée dans Données_appli (${result.rowsSaved} postes figés) !`);
      setTimeout(() => setSheetSaveSuccess(null), 4500);
    } catch (err: any) {
      console.error(err);
      setBlockedAlertMessage(`Erreur d'enregistrement Google Sheets : ${err.message}`);
      setIsConfirmGsheetOpen(false);
    } finally {
      setIsSavingToSheet(false);
    }
  };

  // Copier le résumé pour envoi WhatsApp / SMS
  const handleCopySummary = () => {
    const p1 = composition.simple1Id ? adherentsById.get(composition.simple1Id)?.nomPrenom : 'Non désigné';
    const p2 = composition.simple2Id ? adherentsById.get(composition.simple2Id)?.nomPrenom : 'Non désigné';
    const p3 = composition.simple3Id ? adherentsById.get(composition.simple3Id)?.nomPrenom : 'Non désigné';
    const p4 = composition.simple4Id ? adherentsById.get(composition.simple4Id)?.nomPrenom : 'Non désigné';
    const p5 = composition.simple5Id ? adherentsById.get(composition.simple5Id)?.nomPrenom : 'Non désigné';

    const d1_1 = composition.double1Player1Id ? adherentsById.get(composition.double1Player1Id)?.nomPrenom : 'Non désigné';
    const d1_2 = composition.double1Player2Id ? adherentsById.get(composition.double1Player2Id)?.nomPrenom : 'Non désigné';

    const d2_1 = composition.double2Player1Id ? adherentsById.get(composition.double2Player1Id)?.nomPrenom : 'Non désigné';
    const d2_2 = composition.double2Player2Id ? adherentsById.get(composition.double2Player2Id)?.nomPrenom : 'Non désigné';

    const effectiveVenue = matchVenueInput === 'autre' ? customVenueInput || 'Lieu personnalisé' : matchVenueInput;

    let text = `🎾 FEUILLE DE MATCH TCM - ${rencontre.numeroEquipe}
🏆 ${rencontre.libelleHomologation} (${rencontre.categorieAgeHomologation} - ${rencontre.sexeHomologation})
📅 Date : ${scheduleCheck.dayName} ${matchDateInput} à ${matchHourInput}
📍 Lieu : ${effectiveVenue} (${matchCourtsInput} court(s))
🆚 Rencontre : ${formatMuzillacClubName(rencontre.clubAccueilNom, rencontre.numeroEquipe)} vs ${formatMuzillacClubName(rencontre.clubVisiteurNom, rencontre.numeroEquipe)}
👤 Capitaine : ${rencontre.nomCapitaine}

COMPOSITION OFFICIELLE (${compFormat.categoryLabel}) :
• Simple 1 : ${p1}
• Simple 2 : ${p2}`;

    if (compFormat.numSingles >= 3) text += `\n• Simple 3 : ${p3}`;
    if (compFormat.numSingles >= 4) text += `\n• Simple 4 : ${p4}`;
    if (compFormat.numSingles >= 5) text += `\n• Simple 5 : ${p5}`;

    text += `\n• Double 1 : ${d1_1} & ${d1_2}`;
    if (compFormat.numDoubles >= 2) {
      text += `\n• Double 2 : ${d2_1} & ${d2_2}`;
    }

    // Ajout des créneaux horaires prévisionnels par rotation
    text += `\n\n⏰ CRÉNEAUX ET ORDRE DE PASSAGE (${matchCourtsInput} court${matchCourtsInput > 1 ? 's' : ''}) :`;
    schedulePlan.rotations.forEach(rot => {
      text += `\n• Rotation ${rot.rotationNumber} à ${rot.timeSlot} : ` +
        rot.matches.map(m => `${m.matchLabel} (${m.playerName || '?'}) sur ${m.courtName}`).join(', ');
    });

    text += `\n\n📌 Règle : ${compFormat.pointsSystem}
Statut FFT : Conforme aux règlements 2027 ✅`;

    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const getScheduleSlotFor = (slotKey: SlotKey) => {
    if (slotKey.startsWith('simple')) {
      const num = parseInt(slotKey.replace('simple', '').replace('Id', ''), 10);
      return schedulePlan.slots.find(s => s.matchType === 'simple' && s.slotNumber === num);
    }
    if (slotKey.startsWith('double1')) {
      return schedulePlan.slots.find(s => s.matchType === 'double' && s.slotNumber === 1);
    }
    if (slotKey.startsWith('double2')) {
      return schedulePlan.slots.find(s => s.matchType === 'double' && s.slotNumber === 2);
    }
    return undefined;
  };

  const renderSlotCard = (slotKey: SlotKey, label: string) => {
    const playerId = composition[slotKey];
    const player = playerId ? adherentsById.get(playerId) : null;
    const eligibility = player ? checkFFT2027Eligibility(player, rencontre) : null;
    const isSlotIneligible = eligibility && !eligibility.isEligible;
    const isDouble = slotKey.startsWith('double');

    return (
      <div 
        className={`p-2.5 rounded-xl border transition-all ${
          isSlotIneligible 
            ? 'bg-rose-950/30 border-rose-500/60 shadow-lg shadow-rose-950/40' 
            : player 
              ? 'bg-[#181d26] border-[#293140]' 
              : 'bg-[#12151b] border-dashed border-[#282f3c] hover:border-[#E65100]/60'
        }`}
      >
        {player ? (
          <div>
            {isDouble && (
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-orange-400">
                  {label}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-heading font-black text-white text-xs sm:text-sm truncate leading-tight">
                  {player.nomPrenom}
                </p>
                <p className="text-[10px] text-zinc-400">
                  Licence : <span className="font-mono text-zinc-300">{player.licence}</span>
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-orange-500/15 border border-orange-500/30 text-orange-300 font-mono">
                    {player.dernierClassTennis}
                  </span>
                  <p className="text-[9px] text-zinc-500 mt-0.5">
                    {player.ageSportif ? `${player.ageSportif} ans` : 'Senior'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleClearSlot(slotKey)}
                  className="text-zinc-500 hover:text-rose-400 text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/80 hover:bg-rose-950/40 border border-zinc-700 transition cursor-pointer"
                  title="Retirer ce joueur"
                >
                  Retirer
                </button>
              </div>
            </div>

            {/* Alerte si inéligible */}
            {isSlotIneligible && eligibility && (
              <div className="mt-1.5 p-1.5 rounded-lg bg-rose-500/20 border border-rose-500/40 text-[10px] text-rose-300 space-y-0.5">
                <p className="font-black flex items-center gap-1 text-rose-200">
                  <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                  JOUEUR INÉLIGIBLE :
                </p>
                {eligibility.errors.map((err, i) => (
                  <p key={i}>• {err}</p>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setActiveSlot({ key: slotKey, label })}
            className="w-full py-2 flex items-center justify-center gap-2 rounded-lg transition cursor-pointer hover:bg-orange-600/10"
          >
            <UserCheck className="w-4 h-4 text-[#FF6D00]" />
            <span className="text-[#FF6D00] font-black text-xs">Assigner {label}</span>
          </button>
        )}
      </div>
    );
  };

  if (!isOpen || !rencontre) return null;

  const s = (rencontre.sexeHomologation || '').toUpperCase();
  const isFemme = s.includes('F') || s.includes('DAME');
  const isMixte = s.includes('MIX');

  // Thème contrasté selon le sexe pour ressortir nettement sur fond noir (identique aux fiches licenciés)
  const theme = isFemme ? {
    containerBorder: 'border-[#752a6a]',
    containerBg: 'bg-[#190d1a]',
    headerBg: 'bg-gradient-to-b from-[#2d122f] via-[#200c22] to-[#170818]',
    headerBorder: 'border-[#752a6a]',
    glowBg: 'bg-pink-500/25',
    closeBtn: 'bg-[#3b153d] hover:bg-[#521c55] text-pink-200 hover:text-white border border-[#752a6a]',
    nameText: 'text-pink-50',
    badgeBg: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
  } : isMixte ? {
    containerBorder: 'border-[#62287a]',
    containerBg: 'bg-[#160c21]',
    headerBg: 'bg-gradient-to-b from-[#29103b] via-[#1c0a2a] to-[#13071c]',
    headerBorder: 'border-[#62287a]',
    glowBg: 'bg-purple-500/25',
    closeBtn: 'bg-[#35164d] hover:bg-[#4b1d6e] text-purple-200 hover:text-white border border-[#62287a]',
    nameText: 'text-purple-50',
    badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  } : {
    containerBorder: 'border-[#2d5284]',
    containerBg: 'bg-[#0c1421]',
    headerBg: 'bg-gradient-to-b from-[#142642] via-[#0f1c30] to-[#0a121e]',
    headerBorder: 'border-[#2d5284]',
    glowBg: 'bg-blue-500/25',
    closeBtn: 'bg-[#1b3152] hover:bg-[#25436f] text-blue-200 hover:text-white border border-[#2d5284]',
    nameText: 'text-blue-50',
    badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  };

  // Variantes d'animation : Slide horizontal directionnel pur sans déformation ni écrasement
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 110 : -110,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -110 : 110,
      opacity: 0,
    }),
  };

  const modalContent = (
    <div 
      className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-2 sm:p-4 overflow-hidden"
      onClick={onClose}
    >
      {/* ==================== BOUTON FLÉCHÉS & COMPTEUR HORS DE LA BULLE (AU-DESSUS) ==================== */}
      {hasMultiple && (
        <div 
          className="shrink-0 mb-1.5 sm:mb-2.5 z-20 flex items-center justify-center animate-in fade-in slide-in-from-top-2 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`flex items-center gap-2 ${theme.containerBg} ${theme.containerBorder} border-2 rounded-full py-1.5 px-3.5 shadow-2xl shadow-black`}>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Rencontre précédente"
              title="Précédent (Flèche gauche ou glissement)"
              className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-black text-zinc-200 px-2 select-none tracking-wider">
              {currentIndex + 1} / {totalInList}
            </span>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Rencontre suivante"
              title="Suivant (Flèche droite ou glissement)"
              className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bulle principale animée */}
      <div 
        className="w-full max-w-4xl flex-1 flex flex-col min-h-0 my-auto h-[calc(100dvh-55px)] sm:h-[88vh] max-h-[calc(100dvh-55px)] sm:max-h-[88vh] overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div 
            key={rencontre.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: 'spring', stiffness: 320, damping: 32, mass: 0.7 },
              opacity: { duration: 0.16 },
            }}
            className={`relative w-full h-full flex-1 flex flex-col min-h-0 ${theme.containerBg} border-2 ${theme.containerBorder} rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl`}
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* ==================== EN-TÊTE MODALE ==================== */}
            <div className={`shrink-0 p-3.5 sm:p-6 border-b ${theme.headerBorder} ${theme.headerBg} flex items-start justify-between gap-3 relative`}>
              <div className={`absolute top-0 right-0 w-36 h-36 ${theme.glowBg} rounded-full blur-2xl pointer-events-none`} />

              <div className="flex items-start space-x-3 relative z-10">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-[#BF360C] to-[#E65100] flex items-center justify-center text-white shadow-lg shadow-orange-950/60 shrink-0">
                  <Trophy className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>

                <div>
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    {rencontre.journee && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-zinc-800 text-amber-300 border border-zinc-700">
                        {formatJourneeLabel(rencontre.journee)}
                      </span>
                    )}
                    <span className={`text-[11px] sm:text-xs font-black px-2.5 py-0.5 rounded-full border ${theme.badgeBg}`}>
                      {rencontre.categorieAgeHomologation}{isMixte ? ' • Mixte' : ''}
                    </span>
                    {rencontre.division && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-800/80 text-zinc-200 border border-zinc-700">
                        {rencontre.division}
                      </span>
                    )}
                    {rencontre.poule && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-800/80 text-orange-300 border border-zinc-700">
                        Poule {rencontre.poule.replace(/poule/i, '').trim()}
                      </span>
                    )}
                    <span className="text-[11px] sm:text-xs text-orange-400 font-bold flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {scheduleCheck.dayName} {matchDateInput}
                    </span>
                  </div>

                  <h2 className={`text-xl sm:text-2xl font-heading font-black ${theme.nameText} mt-1.5 leading-snug`}>
                    {formatMuzillacClubName(rencontre.clubAccueilNom, rencontre.numeroEquipe)}{' '}
                    <span className="text-orange-400 font-normal">vs</span>{' '}
                    {formatMuzillacClubName(rencontre.clubVisiteurNom, rencontre.numeroEquipe)}
                  </h2>
                </div>
              </div>

              <button
                onClick={onClose}
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full ${theme.closeBtn} flex items-center justify-center transition cursor-pointer shrink-0 relative z-10`}
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* ==================== CORPS MODALE AVEC DÉFILEMENT VERTICAL STRICT ==================== */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3.5 sm:p-6 space-y-4 sm:space-y-6 touch-pan-y">

              {/* ==================== BULLE DE RAPPEL DU RÈGLEMENT FFT ==================== */}
              {(hasIneligiblePlayer || !rankingOrderCheck.isValid || (compFormat.doubleWeightStrict && !!doublesWeightCheck.errorMessage) || !!scheduleCheck.warning) && (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-[#290d14] via-[#1f0b14] to-[#170a14] border-2 border-rose-500/70 shadow-xl shadow-rose-950/50 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                      <h4 className="font-heading font-black text-rose-100 text-xs sm:text-sm tracking-wide flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>Bulle de rappel : Règlement FFT non respecté</span>
                      </h4>
                    </div>
                    <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-rose-500/25 text-rose-300 border border-rose-500/40">
                      Règles officielles 2027
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    {/* 1. Alerte Inéligibilité */}
                    {hasIneligiblePlayer && (
                      <div className="p-2.5 rounded-xl bg-black/40 border border-rose-500/40 text-rose-200 space-y-1">
                        <p className="font-black text-rose-300 text-[11px] flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>Joueur non qualifié ou non éligible :</span>
                        </p>
                        <ul className="space-y-0.5 list-disc list-inside text-[11px] text-zinc-300 pl-1">
                          {currentCompositionIssues.map((issue, idx) => (
                            <li key={idx}>
                              <strong className="text-white">{issue.player.nomPrenom}</strong> : {issue.errors.join(' | ')}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 2. Alerte Ordre des Simples */}
                    {!rankingOrderCheck.isValid && (
                      <div className="p-2.5 rounded-xl bg-black/40 border border-amber-500/40 text-amber-200 space-y-1">
                        <p className="font-black text-amber-300 text-[11px] flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>Hiérarchie des classements (Ordre de force des simples) :</span>
                        </p>
                        <p className="text-[11px] text-zinc-300 pl-1">
                          {rankingOrderCheck.error} (Le joueur le mieux classé doit impérativement figurer en Simple 1).
                        </p>
                      </div>
                    )}

                    {/* 3. Alerte Poids des Doubles */}
                    {compFormat.doubleWeightStrict && doublesWeightCheck.errorMessage && (
                      <div className="p-2.5 rounded-xl bg-black/40 border border-purple-500/40 text-purple-200 flex items-start justify-between gap-2 flex-wrap">
                        <div className="space-y-1">
                          <p className="font-black text-purple-300 text-[11px] flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                            <span>Règle régionale du Poids des doubles (D1 ≤ D2) :</span>
                          </p>
                          <p className="text-[11px] text-zinc-300 pl-1">
                            {doublesWeightCheck.errorMessage}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleSwapDoubles}
                          className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] flex items-center gap-1 transition cursor-pointer self-center"
                        >
                          <ArrowUpDown className="w-3 h-3" />
                          <span>Inverser D1 et D2</span>
                        </button>
                      </div>
                    )}

                    {/* 4. Alerte Jour de programmation */}
                    {scheduleCheck.warning && (
                      <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-700 text-zinc-300 text-[11px]">
                        <strong className="text-amber-300 font-bold">{scheduleCheck.warning} : </strong>
                        <span>{scheduleCheck.alternationMessage}</span>
                      </div>
                    )}
                  </div>

                  <p className="text-[10px] text-zinc-400 italic pt-0.5">
                    💡 Consultez l'onglet <strong className="text-orange-400 not-italic">« Règlements »</strong> pour consulter le texte officiel intégral de chaque directive.
                  </p>
                </div>
              )}

              {/* Messages toast succès */}
              {sheetSaveSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/50 text-emerald-200 text-xs flex items-center space-x-2 shadow-lg">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-bold">{sheetSaveSuccess}</span>
                </div>
              )}

              {validationSuccess && !sheetSaveSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-200 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Feuille de match certifiée conforme et enregistrée avec succès !</span>
                </div>
              )}

              {/* Message d'alerte spécifique popup / toast */}
              {blockedAlertMessage && (
                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/50 text-amber-200 text-xs flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="whitespace-pre-line leading-relaxed">{blockedAlertMessage}</div>
                  </div>
                  <button onClick={() => setBlockedAlertMessage(null)} className="text-amber-400 hover:text-white font-bold px-1">✕</button>
                </div>
              )}

          {/* ==================== SECTION LOGISTIQUE DU MATCH ÉPURÉE ==================== */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-[#090b0e] border border-[#232934]">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              
              {/* 1. Date avec mini calendrier */}
              <div className="p-2.5 rounded-xl bg-[#141820] border border-[#232934] space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Date validée
                </label>
                <div className="flex items-center space-x-1.5 bg-black/40 border border-[#2a323f] rounded-lg px-2 py-1 focus-within:border-orange-500">
                  <Calendar className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  <input
                    type="date"
                    value={toIsoDate(matchDateInput)}
                    onChange={(e) => {
                      if (e.target.value) {
                        setMatchDateInput(fromIsoDate(e.target.value));
                      }
                    }}
                    className="w-full bg-transparent text-xs text-white font-mono focus:outline-none cursor-pointer [color-scheme:dark]"
                    title="Cliquez pour ouvrir le mini calendrier"
                  />
                </div>
              </div>

              {/* 2. Horaire : Liste 9h, 14h (normaux) et heure paramétrable */}
              <div className="p-2.5 rounded-xl bg-[#141820] border border-[#232934] space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Horaire
                </label>
                <div className="space-y-1">
                  <select
                    value={
                      matchHourInput === '09:00' || matchHourInput === '14:00'
                        ? matchHourInput
                        : 'autre'
                    }
                    onChange={(e) => {
                      if (e.target.value !== 'autre') {
                        setMatchHourInput(e.target.value);
                      }
                    }}
                    className="w-full bg-black/50 border border-[#2a323f] rounded-lg px-2 py-1 text-xs text-white font-bold focus:outline-none focus:border-orange-500 cursor-pointer"
                  >
                    <option value="09:00">09:00 (Matin standard)</option>
                    <option value="14:00">14:00 (Après-midi standard)</option>
                    <option value="autre">⚙️ Autre heure paramétrable...</option>
                  </select>

                  {matchHourInput !== '09:00' && matchHourInput !== '14:00' && (
                    <div className="flex items-center space-x-1 bg-black/50 border border-orange-500/50 rounded-lg px-2 py-0.5">
                      <Clock className="w-3 h-3 text-orange-400 shrink-0" />
                      <input
                        type="time"
                        value={matchHourInput}
                        onChange={(e) => setMatchHourInput(e.target.value)}
                        className="w-full bg-transparent text-xs text-orange-300 font-mono font-bold focus:outline-none [color-scheme:dark]"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Courts disponibles */}
              <div className="p-2.5 rounded-xl bg-[#141820] border border-[#232934] space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Courts alloués
                </label>
                <div className="flex items-center space-x-1">
                  {[1, 2, 3].map(cnt => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setMatchCourtsInput(cnt)}
                      className={`flex-1 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        matchCourtsInput === cnt
                          ? 'bg-sky-600 text-white shadow'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                      }`}
                    >
                      {cnt} {cnt > 1 ? 'courts' : 'court'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Lieu du match */}
              <div className="p-2.5 rounded-xl bg-[#141820] border border-[#232934] space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Lieu du match
                </label>
                <select
                  value={matchVenueInput}
                  onChange={(e) => setMatchVenueInput(e.target.value)}
                  className="w-full bg-black/50 border border-[#2a323f] rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-orange-500 truncate"
                >
                  {!isHome && adverseAddressInfo.hasAdverseAddress && (
                    <option value={adverseAddressInfo.venueLabel}>
                      🚗 {adverseAddressInfo.venueLabel}
                    </option>
                  )}
                  <option value="Clos des Moines - 2 courts couverts résine (TCM)">
                    Clos des Moines (Résine TCM)
                  </option>
                  <option value="Salle du TC Nivillac (Emprunt TCM 3 équipes)">
                    Salle TC Nivillac (Emprunt 3 équipes)
                  </option>
                  <option value="Clos des Moines - 2 courts extérieurs (Béton poreux)">
                    Clos des Moines (Extérieurs TCM)
                  </option>
                  {!isHome && (
                    <option value={`${rencontre.clubAccueilNom} (Installations adverses)`}>
                      {rencontre.clubAccueilNom} (Déplacement)
                    </option>
                  )}
                  <option value="Salle omnisports municipale (Repli)">
                    Salle omnisports municipale (Repli)
                  </option>
                  <option value="autre">Autre lieu personnalisé...</option>
                </select>
              </div>

            </div>
          </div>

          {/* ==================== CONTACTS DES CAPITAINES ==================== */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-[#0d1016] border border-[#232934] space-y-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              
              {/* Capitaine TCM */}
              <div className="p-3 rounded-xl bg-[#141822] border border-[#232936] flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-orange-400 text-[10px] font-black uppercase tracking-wider">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Capitaine Muzillac TC</span>
                  </div>
                  <p className="font-heading font-black text-white text-sm truncate mt-0.5">
                    {rencontre.prenomCapitaine ? `${rencontre.prenomCapitaine} ${rencontre.nomCapitaine}` : (rencontre.nomCapitaine || 'Non désigné')}
                  </p>
                  {rencontre.portableCapitaine && (
                    <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                      {rencontre.portableCapitaine}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {rencontre.portableCapitaine && (
                    <>
                      <a
                        href={`tel:${rencontre.portableCapitaine}`}
                        className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition flex items-center gap-1 text-[11px] font-bold"
                        title="Appeler le capitaine TCM"
                      >
                        <Phone className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="hidden sm:inline">Appel</span>
                      </a>
                      <a
                        href={`sms:${rencontre.portableCapitaine}`}
                        className="p-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 transition flex items-center gap-1 text-[11px] font-bold"
                        title="SMS au capitaine TCM"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                        <span className="hidden sm:inline">SMS</span>
                      </a>
                    </>
                  )}
                  {rencontre.mailCapitaine && (
                    <a
                      href={`mailto:${rencontre.mailCapitaine}`}
                      className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition flex items-center gap-1 text-[11px] font-bold"
                      title="Email au capitaine TCM"
                    >
                      <Mail className="w-3.5 h-3.5 text-amber-400" />
                      <span className="hidden sm:inline">Mail</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Capitaine Adverse */}
              {(() => {
                const advNom = rencontre.nomCapitaineAdverse || rencontre.nomCorrespondantAdverse;
                const advPrenom = rencontre.prenomCapitaineAdverse || rencontre.prenomCorrespondantAdverse || '';
                const advTel = rencontre.portableCapitaineAdverse || rencontre.portableCorrespondantAdverse;
                const advMail = rencontre.mailCapitaineAdverse || rencontre.mailCorrespondantAdverse;
                const advFullName = advNom ? `${advPrenom} ${advNom}`.trim() : null;

                return (
                  <div className="p-3 rounded-xl bg-[#141822] border border-[#232936] flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-sky-400 text-[10px] font-black uppercase tracking-wider">
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Capitaine Adverse ({!isHome ? rencontre.clubAccueilNom : rencontre.clubVisiteurNom})</span>
                      </div>
                      <p className="font-heading font-black text-sky-100 text-sm truncate mt-0.5">
                        {advFullName || 'Non communiqué'}
                      </p>
                      {advTel && (
                        <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                          {advTel}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {advTel && (
                        <>
                          <a
                            href={`tel:${advTel}`}
                            className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition flex items-center gap-1 text-[11px] font-bold"
                            title="Appeler le capitaine adverse"
                          >
                            <Phone className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="hidden sm:inline">Appel</span>
                          </a>
                          <a
                            href={`sms:${advTel}`}
                            className="p-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 transition flex items-center gap-1 text-[11px] font-bold"
                            title="SMS au capitaine adverse"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                            <span className="hidden sm:inline">SMS</span>
                          </a>
                        </>
                      )}
                      {advMail && (
                        <a
                          href={`mailto:${advMail}`}
                          className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition flex items-center gap-1 text-[11px] font-bold"
                          title="Email au capitaine adverse"
                        >
                          <Mail className="w-3.5 h-3.5 text-amber-400" />
                          <span className="hidden sm:inline">Mail</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })()}

            </div>
          </div>

          {/* ==================== SONDAGE DES DISPONIBILITÉS DU MATCH ==================== */}
          {onOpenSondageModal && userRole !== 'adherent' && (() => {
            const dispoResponses = rencontre.disponibilites || [];
            const dispoCount = dispoResponses.filter(d => d.statut === 'disponible').length;
            const incertainCount = dispoResponses.filter(d => d.statut === 'incertain').length;
            const indispoCount = dispoResponses.filter(d => d.statut === 'indisponible').length;

            return (
              <div className="p-3.5 sm:p-4 rounded-2xl bg-[#0e131d] border border-orange-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/40 flex items-center justify-center shrink-0">
                    <ClipboardCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-heading font-black text-white text-xs sm:text-sm">
                        Sondage des disponibilités de l'équipe
                      </span>
                      {dispoCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          {dispoCount} disponible{dispoCount > 1 ? 's' : ''}
                        </span>
                      )}
                      {incertainCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          {incertainCount} incertain{incertainCount > 1 ? 's' : ''}
                        </span>
                      )}
                      {indispoCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          {indispoCount} indispo
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Les disponibilités renseignées par les adhérents s'affichent automatiquement en tête de liste pour l'affectation aux simples et doubles.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenSondageModal(rencontre)}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#BF360C] to-[#E65100] hover:brightness-110 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 transition cursor-pointer shadow-md self-start sm:self-auto"
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  <span>Consulter le sondage</span>
                </button>
              </div>
            );
          })()}

          {/* ==================== MATCHS OFFICIELS & ORDRE DES PARTIES ==================== */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-400" />
                <h3 className="font-heading font-black text-white text-sm sm:text-base">
                  Matchs officiels &amp; Ordre des joueurs
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30 font-bold">
                  {compFormat.numSingles}S + {compFormat.numDoubles}D
                </span>
              </div>

              {/* Boutons pour réinitialiser l'ordre des numéros de joueurs */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSinglesPlayerNumbers(defaultSinglesPlayerNumbers);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold border border-zinc-700 transition cursor-pointer"
                  title="Ordre FFT classique (4-2 puis 3-1)"
                >
                  Ordre FFT ({defaultSinglesPlayerNumbers.join('-')})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const list: number[] = [];
                    for (let i = 1; i <= compFormat.numSingles; i++) list.push(i);
                    setSinglesPlayerNumbers(list);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold border border-zinc-700 transition cursor-pointer"
                  title="Ordre numérique (1, 2, 3...)"
                >
                  Numérique (1 à {compFormat.numSingles})
                </button>
              </div>
            </div>

            {/* Liste des matchs : Les matchs 1..N restent dans l'ordre chronologique fixe, on permute les numéros de joueurs */}
            <div className="space-y-2.5">
              
              {/* 1. MATCHS DE SIMPLES (Match 1 à compFormat.numSingles) */}
              {singlesPlayerNumbers.map((playerNum, matchIndex) => {
                const timeSlot = getMatchTimeSlot(matchIndex);
                const slotKey = `simple${playerNum}Id` as SlotKey;

                return (
                  <div
                    key={`match-simple-${matchIndex}`}
                    className="p-3 rounded-2xl bg-[#0d1016] border border-[#232936] space-y-2 transition hover:border-zinc-700 shadow-md"
                  >
                    {/* En-tête du match chronologique avec heure fixe et sélecteur de joueur permutable */}
                    <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-lg bg-black/70 border border-zinc-700 text-white font-mono font-black text-xs">
                          Match {matchIndex + 1}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-300 font-mono text-xs font-bold">
                          <Clock className="w-3 h-3 text-orange-400" />
                          <span>{timeSlot}</span>
                        </span>

                        {/* Sélecteur direct du numéro de joueur pour ce match */}
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[11px] text-zinc-400">Affectation :</span>
                          <select
                            value={playerNum}
                            onChange={(e) => {
                              const targetNum = parseInt(e.target.value, 10);
                              const otherIndex = singlesPlayerNumbers.indexOf(targetNum);
                              if (otherIndex !== -1) {
                                swapSinglesPlayerNumbers(matchIndex, otherIndex);
                              }
                            }}
                            className="bg-black/60 border border-orange-500/40 text-orange-300 font-bold text-xs rounded-lg px-2 py-0.5 focus:outline-none focus:border-orange-500 cursor-pointer"
                            title="Choisir quel numéro de joueur dispute ce créneau"
                          >
                            {Array.from({ length: compFormat.numSingles }, (_, i) => i + 1).map((num) => (
                              <option key={num} value={num}>
                                Joueur n°{num} {num === 1 ? '(Leader)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Flèches de permutation avec le match précédent / suivant */}
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => swapSinglesPlayerNumbers(matchIndex, matchIndex - 1)}
                          disabled={matchIndex === 0}
                          className={`w-6 h-6 rounded-lg flex items-center justify-center border transition ${
                            matchIndex === 0
                              ? 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed'
                              : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300 hover:text-white cursor-pointer'
                          }`}
                          title="Permuter avec le match précédent (▲)"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => swapSinglesPlayerNumbers(matchIndex, matchIndex + 1)}
                          disabled={matchIndex === compFormat.numSingles - 1}
                          className={`w-6 h-6 rounded-lg flex items-center justify-center border transition ${
                            matchIndex === compFormat.numSingles - 1
                              ? 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed'
                              : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300 hover:text-white cursor-pointer'
                          }`}
                          title="Permuter avec le match suivant (▼)"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Bulle compacte Joueur n°X */}
                    <div>
                      {renderSlotCard(slotKey, `Joueur n°${playerNum}`)}
                    </div>
                  </div>
                );
              })}

              {/* 2. MATCHS DE DOUBLES */}
              {/* Double 1 */}
              <div className="p-3 rounded-2xl bg-[#0d1016] border border-[#232936] space-y-2 transition hover:border-zinc-700 shadow-md">
                <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-lg bg-black/70 border border-zinc-700 text-white font-mono font-black text-xs">
                      Match {compFormat.numSingles + 1}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono text-xs font-bold">
                      <Clock className="w-3 h-3 text-purple-400" />
                      <span>{getMatchTimeSlot(compFormat.numSingles)}</span>
                    </span>
                    <span className="font-heading font-black text-white text-xs sm:text-sm">
                      Double N°1
                    </span>
                    {compFormat.doubleWeightStrict && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 font-bold">
                        Paire N°1 (Poids ≥ D2)
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {renderSlotCard('double1Player1Id', 'Joueur 1 (Double 1)')}
                    {renderSlotCard('double1Player2Id', 'Joueur 2 (Double 1)')}
                  </div>
                  {doublesWeightCheck.isComplete && (
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-0.5">
                      <span>Poids total D1 : <strong className="text-white font-mono">{doublesWeightCheck.weightDouble1} pts</strong></span>
                    </div>
                  )}
                </div>
              </div>

              {/* Double 2 (si applicable) */}
              {compFormat.numDoubles >= 2 && (
                <div className="p-3 rounded-2xl bg-[#0d1016] border border-[#232936] space-y-2 transition hover:border-zinc-700 shadow-md">
                  <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-lg bg-black/70 border border-zinc-700 text-white font-mono font-black text-xs">
                        Match {compFormat.numSingles + 2}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono text-xs font-bold">
                        <Clock className="w-3 h-3 text-purple-400" />
                        <span>{getMatchTimeSlot(compFormat.numSingles + 1)}</span>
                      </span>
                      <span className="font-heading font-black text-white text-xs sm:text-sm">
                        Double N°2
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleSwapDoubles}
                      className="text-xs text-orange-400 hover:text-white flex items-center gap-1 font-bold cursor-pointer"
                      title="Intervertir la paire D1 et la paire D2"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                      <span>Inverser D1 et D2</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {renderSlotCard('double2Player1Id', 'Joueur 1 (Double 2)')}
                      {renderSlotCard('double2Player2Id', 'Joueur 2 (Double 2)')}
                    </div>
                    {doublesWeightCheck.isComplete && (
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-0.5">
                        <span>Poids total D2 : <strong className="text-white font-mono">{doublesWeightCheck.weightDouble2} pts</strong></span>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* ==================== TIROIR DE SÉLECTION D'UN JOUEUR ==================== */}
          {activeSlot && (
            <div ref={activeSlotRef} className="p-4 sm:p-5 rounded-3xl bg-[#101319] border-2 border-[#E65100]/60 shadow-2xl space-y-3.5 scroll-mt-4">
              <div className="flex items-center justify-between border-b border-[#232936] pb-3 gap-2 flex-wrap">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E65100] shrink-0"></span>
                  <h4 className="font-heading font-black text-white text-xs sm:text-sm">
                    Assigner un joueur : <span className="text-[#FF6D00]">{activeSlot.label}</span>
                  </h4>
                </div>
                
                <div className="flex items-center space-x-2">
                  <label className="text-[11px] sm:text-xs text-zinc-400 flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterEligibleOnly}
                      onChange={(e) => setFilterEligibleOnly(e.target.checked)}
                      className="rounded accent-orange-500"
                    />
                    <span className="hidden sm:inline">Uniquement éligibles FFT</span>
                    <span className="sm:hidden">Éligibles</span>
                  </label>
                  <button
                    onClick={() => setActiveSlot(null)}
                    className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Champ de recherche instantanée par nom ou classement */}
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={playerSearchQuery}
                  onChange={(e) => setPlayerSearchQuery(e.target.value)}
                  placeholder="Rechercher par nom, prénom ou classement (ex: 15/4)..."
                  className="w-full bg-[#0b0e14] border border-zinc-700 focus:border-orange-500 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-zinc-500 outline-none"
                />
                {playerSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setPlayerSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Rappel du barème pour cette sélection */}
              <div className="p-2.5 sm:p-3 rounded-xl bg-[#171b24] border border-[#262c3b] text-xs text-zinc-300 grid grid-cols-3 gap-1.5 text-center sm:text-left">
                <div>
                  <span className="text-zinc-500 block text-[9px] sm:text-[10px]">1. Règle Licence :</span>
                  <span className="font-bold text-white text-[11px] sm:text-xs">Statut 'C' ou 'W'</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[9px] sm:text-[10px]">2. Règle Sexe :</span>
                  <span className="font-bold text-orange-400 text-[11px] sm:text-xs">{reqSex === 'H' ? 'Messieurs (H)' : reqSex === 'F' ? 'Dames (F)' : 'Mixte'}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[9px] sm:text-[10px]">3. Règle Classement :</span>
                  <span className="font-bold text-emerald-400 text-[11px] sm:text-xs">Non ND</span>
                </div>
              </div>

              {/* Grille des adhérents avec statut */}
              <div className="max-h-64 sm:max-h-72 overflow-y-auto space-y-1.5 pr-1 touch-pan-y">
                {playersWithEligibility
                  .filter(item => {
                    if (filterEligibleOnly && !item.eligibility.isEligible) return false;
                    if (!playerSearchQuery.trim()) return true;
                    const q = playerSearchQuery.toLowerCase().trim();
                    const name = (item.adherent.nomPrenom || '').toLowerCase();
                    const rank = (item.adherent.dernierClassTennis || '').toLowerCase();
                    const lic = (item.adherent.licence || '').toLowerCase();
                    return name.includes(q) || rank.includes(q) || lic.includes(q);
                  })
                  .map(({ adherent, eligibility, isLicencie, dispo }) => {
                    const isAlreadySelected = selectedPlayerIds.includes(adherent.id);

                    return (
                      <div
                        key={adherent.id}
                        onClick={() => handleAssignPlayer(adherent, activeSlot.key)}
                        className={`p-3 rounded-2xl border transition flex items-center justify-between cursor-pointer ${
                          !eligibility.isEligible
                            ? 'bg-rose-950/20 border-rose-900/40 hover:border-rose-500 opacity-70'
                            : isAlreadySelected
                              ? 'bg-orange-950/30 border-orange-500/50 text-white'
                              : 'bg-[#181c25] border-[#262c3a] hover:border-orange-500/60'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                            eligibility.isEligible ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                          }`}>
                            {eligibility.isEligible ? '✓' : '✕'}
                          </div>

                          <div>
                            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                              <span className="font-heading font-black text-white text-xs sm:text-sm">
                                {adherent.nomPrenom}
                              </span>
                              <span className="px-2 py-0.2 rounded-md bg-zinc-800 text-zinc-300 text-[10px] font-bold">
                                {adherent.dernierClassTennis}
                              </span>
                              {isLicencie && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/35">
                                  Licencié 2027 TCM
                                </span>
                              )}
                              {dispo && (
                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                                  dispo.statut === 'disponible'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : dispo.statut === 'incertain'
                                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                }`}>
                                  {dispo.statut === 'disponible' 
                                    ? `🟢 Dispo (${dispo.preferenceJeu === 'simple_et_double' ? 'S+D' : dispo.preferenceJeu === 'simple_seul' ? 'S' : 'D'})`
                                    : dispo.statut === 'incertain' ? '🟡 Incertain' : '🔴 Indispo'}
                                </span>
                              )}
                              {isAlreadySelected && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-orange-500 text-white">
                                  Déjà assigné
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5">
                              <span>Licence {adherent.licence} ({adherent.millesimeLicence || '2027'})</span>
                              <span>•</span>
                              <span>{adherent.civilite === 'Monsieur' ? 'Homme' : 'Femme'}</span>
                              <span>•</span>
                              <span>{adherent.dateNaissance || 'Date N/A'}</span>
                            </p>
                          </div>
                        </div>

                        {/* Statut Éligibilité */}
                        <div>
                          {eligibility.isEligible ? (
                            <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Éligible</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-rose-400 font-semibold max-w-[180px] text-right block truncate" title={eligibility.errors.join(' | ')}>
                              {eligibility.errors[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

        </div>

        {/* ==================== PIED DE PAGE ET ACTIONS ==================== */}
        <div className="shrink-0 p-3 sm:p-5 border-t border-[#252b37] bg-[#11141a] flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3">
          
          <button
            onClick={handleCopySummary}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#1a1f29] hover:bg-[#252c3a] border border-[#2c3444] text-zinc-300 hover:text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
          >
            {copiedSummary ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-orange-400" />}
            <span>{copiedSummary ? 'Feuille copiée !' : 'Copier résumé (SMS / Mail)'}</span>
          </button>

          <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition cursor-pointer"
            >
              Fermer
            </button>

            {selectedSpreadsheetId ? (
              <button
                onClick={handleValidateMatchSheet}
                disabled={hasIneligiblePlayer || (compFormat.doubleWeightStrict && !doublesWeightCheck.isValid)}
                className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-heading font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-lg ${
                  hasIneligiblePlayer || (compFormat.doubleWeightStrict && !doublesWeightCheck.isValid)
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                    : 'bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 hover:brightness-110 active:scale-95 text-white shadow-emerald-950/60'
                }`}
              >
                {hasIneligiblePlayer ? (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Validation bloquée (FFT)</span>
                  </>
                ) : compFormat.doubleWeightStrict && !doublesWeightCheck.isValid ? (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Inverser les doubles (FFT)</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Enregistrer dans Données_appli</span>
                  </>
                )}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                {onOpenGoogleSyncModal && (
                  <button
                    onClick={onOpenGoogleSyncModal}
                    className="px-3.5 py-2.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/40 text-emerald-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    title="Connecter Google Sheets pour sauvegarder directement dans Données_appli"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    <span>Lier Google Sheets</span>
                  </button>
                )}

                <button
                  onClick={handleValidateMatchSheet}
                  disabled={hasIneligiblePlayer || (compFormat.doubleWeightStrict && !doublesWeightCheck.isValid)}
                  className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-heading font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-lg ${
                    hasIneligiblePlayer || (compFormat.doubleWeightStrict && !doublesWeightCheck.isValid)
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                      : 'bg-gradient-to-r from-[#BF360C] via-[#E65100] to-[#FF6D00] hover:brightness-110 active:scale-95 text-white shadow-orange-950/60'
                  }`}
                >
                  {hasIneligiblePlayer ? (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Validation bloquée (FFT)</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Valider la composition</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

        </div>

      </motion.div>
    </AnimatePresence>
  </div>

      {/* Modale de Confirmation Explicite pour l'Enregistrement dans Données_appli */}
      {selectedSpreadsheetId && (
        <ConfirmSaveCompositionModal
          isOpen={isConfirmGsheetOpen}
          onClose={() => setIsConfirmGsheetOpen(false)}
          onConfirm={handleConfirmSaveToGsheet}
          rencontre={rencontre}
          composition={composition}
          adherentsById={adherentsById}
          spreadsheetName={spreadsheetName}
          isSaving={isSavingToSheet}
        />
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
