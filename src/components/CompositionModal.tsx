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
import { formatJourneeLabel, formatMuzillacClubName, isComiteMorbihanBye, getComiteByeScore } from './RencontresTab';
import { motion, AnimatePresence } from 'motion/react';
import { Adherent, Rencontre, MatchComposition, FrozenPlayerSlot, UserRole } from '../types/tennis';
import { checkFFT2027Eligibility, getRequiredSex } from '../utils/fftEligibility';
import { getRankingMeta, getRankingWeight, getDoubleRankingWeight, cleanRanking } from '../utils/ranking';
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
  addMinutesToTime,
  MatchSchedulePlan 
} from '../utils/matchScheduling';
import { ConfirmSaveCompositionModal } from './ConfirmSaveCompositionModal';
import { saveCompositionToSheet } from '../services/googleSheets';
import { getAccessToken } from '../services/auth';
import { isLicencieMuzillac } from '../utils/licencies';
import { isSameWeekend, isBadenCupMatch } from '../utils/dateUtils';

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
  const isComiteBye = rencontre ? isComiteMorbihanBye(rencontre) : false;
  const comiteByeScore = isComiteBye && rencontre ? getComiteByeScore(rencontre) : null;
  const adverseAddressInfo = useMemo(() => rencontre ? getAdverseClubFullAddress(rencontre) : { hasAdverseAddress: false, venueLabel: '' }, [rencontre]);

  // Logistique TCM (Validation Date, Heure, Courts, Lieu)
  const [matchDateInput, setMatchDateInput] = useState<string>(() => {
    return composition.dateRencontreValidee || rencontre?.dateRencontre || '15/03/2026';
  });
  const [matchHourInput, setMatchHourInput] = useState<string>(() => {
    return composition.heureDebut || '14:00';
  });
  const [isCustomHourMode, setIsCustomHourMode] = useState<boolean>(() => {
    const h = composition.heureDebut || '14:00';
    return h !== '09:00' && h !== '14:00';
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
    const nextHour = rencontre.composition?.heureDebut || '14:00';
    setMatchHourInput(nextHour);
    setIsCustomHourMode(nextHour !== '09:00' && nextHour !== '14:00');
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
    setValidationSuccess(null);
  }, [rencontre?.id]);

  // Slot en cours de sélection
  const [activeSlot, setActiveSlot] = useState<{
    key: SlotKey;
    label: string;
  } | null>(null);

  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const activeSlotRef = useRef<HTMLDivElement>(null);
  const modalBodyRef = useRef<HTMLDivElement>(null);

  // Défilement automatique fluide vers le tiroir de sélection de joueur lorsqu'un slot est cliqué
  useEffect(() => {
    if (activeSlot) {
      setPlayerSearchQuery('');
      setTimeout(() => {
        activeSlotRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, [activeSlot]);

  const [copiedPlayersSms, setCopiedPlayersSms] = useState(false);
  const [copiedOpponentSms, setCopiedOpponentSms] = useState(false);
  const [blockedAlertMessage, setBlockedAlertMessage] = useState<string | null>(null);
  const [validationSuccess, setValidationSuccess] = useState<string | null>(null);

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

  // Rôle et permissions : admin, capitaines et membres du bureau peuvent modifier la feuille
  const canEdit = userRole === 'admin' || userRole === 'capitaine' || userRole === 'bureau';

  // Analyse du format de championnat officiel (Jeunes, Seniors+, Régional, Départemental)
  const compFormat: CompetitionFormatInfo = useMemo(() => {
    return getCompetitionFormat(rencontre, { formatReduit });
  }, [rencontre, formatReduit]);

  // Ordre numérique par défaut tant que le capitaine n'a pas validé d'ordre : S1, S2, ..., Sn, D1, ...
  const defaultMatchOrder = useMemo(() => {
    const tokens: string[] = [];
    for (let i = 1; i <= compFormat.numSingles; i++) tokens.push(`S${i}`);
    for (let d = 1; d <= compFormat.numDoubles; d++) tokens.push(`D${d}`);
    return tokens;
  }, [compFormat.numSingles, compFormat.numDoubles]);

  const normalizeMatchOrder = useCallback((saved?: string[]): string[] => {
    if (!saved || saved.length === 0) return defaultMatchOrder;
    const validSet = new Set(defaultMatchOrder);
    const cleaned: string[] = [];
    saved.forEach(tok => {
      if (validSet.has(tok) && !cleaned.includes(tok)) {
        cleaned.push(tok);
      }
    });
    defaultMatchOrder.forEach(tok => {
      if (!cleaned.includes(tok)) cleaned.push(tok);
    });
    return cleaned;
  }, [defaultMatchOrder]);

  const computeRotationHours = useCallback((order: string[], startHour: string, courtsCount: number): Record<string, string> => {
    const courts = Math.max(1, courtsCount || 1);
    const map: Record<string, string> = {};
    order.forEach((tok, idx) => {
      const rotIdx = Math.floor(idx / courts);
      map[tok] = addMinutesToTime(startHour || '14:00', rotIdx * 90);
    });
    return map;
  }, []);

  const normalizeRotationHours = useCallback((
    saved: Record<string, string> | undefined,
    order: string[],
    startHour: string,
    courtsCount: number
  ): Record<string, string> => {
    const defaults = computeRotationHours(order, startHour, courtsCount);
    if (!saved) return defaults;
    const merged: Record<string, string> = { ...defaults };
    order.forEach(tok => {
      if (saved[tok] && /^\d{1,2}:\d{2}$/.test(saved[tok].trim())) {
        merged[tok] = saved[tok].trim();
      }
    });
    return merged;
  }, [computeRotationHours]);

  const [matchOrder, setMatchOrder] = useState<string[]>(() =>
    normalizeMatchOrder(rencontre?.composition?.ordreMatchs)
  );

  const [rotationHours, setRotationHours] = useState<Record<string, string>>(() =>
    normalizeRotationHours(
      rencontre?.composition?.heuresRotations,
      normalizeMatchOrder(rencontre?.composition?.ordreMatchs),
      rencontre?.composition?.heureDebut || '14:00',
      rencontre?.composition?.nombreCourts || 2
    )
  );

  useEffect(() => {
    const nextOrder = normalizeMatchOrder(rencontre?.composition?.ordreMatchs);
    const nextHour = rencontre?.composition?.heureDebut || '14:00';
    const nextCourts = rencontre?.composition?.nombreCourts || 2;
    setMatchOrder(nextOrder);
    setRotationHours(
      normalizeRotationHours(rencontre?.composition?.heuresRotations, nextOrder, nextHour, nextCourts)
    );
  }, [normalizeMatchOrder, normalizeRotationHours, rencontre?.id]);

  // États des 3 étapes de validation du capitaine : 1. Date/Heure/Lieu -> 2. Ordre -> 3. Joueurs
  const step1Done = Boolean(composition.logistiqueValidee || composition.valideParCapitaine);
  const step2Done = Boolean(composition.ordreValide || composition.valideParCapitaine);
  const step3Done = Boolean(composition.joueursValides || composition.valideParCapitaine);

  const moveMatchOrder = (indexA: number, indexB: number) => {
    if (
      indexA < 0 ||
      indexA >= matchOrder.length ||
      indexB < 0 ||
      indexB >= matchOrder.length
    ) return;
    const updated = [...matchOrder];
    const temp = updated[indexA];
    updated[indexA] = updated[indexB];
    updated[indexB] = temp;
    const updatedRotations = computeRotationHours(updated, matchHourInput, matchCourtsInput);
    setMatchOrder(updated);
    setRotationHours(updatedRotations);
    setComposition(prev => ({
      ...prev,
      ordreMatchs: updated,
      heuresRotations: updatedRotations,
      ordreValide: false,
      valideParCapitaine: false,
    }));
  };

  const swapSingleTokenInOrder = (currentIndex: number, targetSingleNum: number) => {
    const targetToken = `S${targetSingleNum}`;
    const otherIndex = matchOrder.indexOf(targetToken);
    if (otherIndex !== -1 && otherIndex !== currentIndex) {
      moveMatchOrder(currentIndex, otherIndex);
    }
  };

  const getMatchTimeSlot = (index: number, token?: string) => {
    if (token && rotationHours[token]) {
      return rotationHours[token];
    }
    const courts = Math.max(1, matchCourtsInput);
    const rotationIndex = Math.floor(index / courts);
    return addMinutesToTime(matchHourInput || '14:00', rotationIndex * 90);
  };

  const handleUpdateMatchRotationTime = (token: string, newTime: string) => {
    if (!newTime) return;
    const nextRot = { ...rotationHours, [token]: newTime };
    setRotationHours(nextRot);
    setComposition(prev => ({
      ...prev,
      heuresRotations: nextRot,
      ordreValide: false,
      valideParCapitaine: false,
    }));
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

  // Calcul systématique des poids de double FFT (échelle inversée : plus petit = meilleur)
  // Contrôle strict dès qu'il y a 2 doubles (Poids D1 <= Poids D2)
  const doublesWeightCheck: DoublesWeightCheckResult = useMemo(() => {
    const rawCheck = checkRegionalDoublesWeight(composition, adherentsById);
    const enforceStrict = compFormat.numDoubles >= 2 || compFormat.doubleWeightStrict;
    if (!enforceStrict) {
      return {
        ...rawCheck,
        isValid: true,
        errorMessage: undefined,
      };
    }
    return rawCheck;
  }, [compFormat, composition, adherentsById]);

  // Inverser les paires Double 1 et Double 2 en 1 clic
  const handleSwapDoubles = () => {
    setComposition(prev => ({
      ...prev,
      double1Player1Id: prev.double2Player1Id,
      double1Player2Id: prev.double2Player2Id,
      double2Player1Id: prev.double1Player1Id,
      double2Player2Id: prev.double1Player2Id,
      joueursValides: false,
      valideParCapitaine: false,
    }));
  };

  // Candidats éligibles pour CETTE rencontre :
  // RÈGLE ABSOLUE FFT : On ne propose JAMAIS d'hommes pour une épreuve Dames, ni de femmes pour une épreuve Messieurs
  // RÈGLE TCM : La liste ne doit comporter UNIQUEMENT que des joueurs éligibles avec une licence de l'année en cours au Tennis Club de Muzillac
  const playersWithEligibility = useMemo(() => {
    return adherents
      .filter(adh => {
        // 1. Sexe compatible avec l'épreuve
        const playerSex = (adh.civilite === 'Madame' ? 'F' : 'H');
        if (reqSex !== 'Mixte' && playerSex !== reqSex) return false;

        // 2. EXCLUSION STRICTE : Licence de l'année en cours au Tennis Club de Muzillac (exclut Vannes et autres clubs)
        if (!isLicencieMuzillac(adh, saison)) return false;

        // 3. EXCLUSION STRICTE : Éligibilité FFT (catégorie d'âge, licence C/W valide, classement non ND)
        const eligibility = checkFFT2027Eligibility(adh, rencontre, saison);
        if (!eligibility.isEligible) return false;

        return true;
      })
      .map(adh => {
        const eligibility = checkFFT2027Eligibility(adh, rencontre, saison);
        const dispo = (rencontre.disponibilites || []).find(d => d.adherentId === adh.id);
        return {
          adherent: adh,
          eligibility,
          meta: getRankingMeta(adh.dernierClassTennis),
          weight: getRankingWeight(adh.dernierClassTennis),
          dispo,
        };
      })
      .sort((a, b) => {
        // 1. Statut sondage de disponibilité (Dispo > Incertain > Non répondu > Indispo)
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

        // 2. Classement FFT décroissant
        return b.weight - a.weight;
      });
  }, [adherents, rencontre, reqSex, saison]);

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

  // Contrôle d'affectation : détecte si un joueur est déjà affecté dans cette équipe ou dans une autre équipe
  const getPlayerAssignment = useCallback((adherent: Adherent, slotKey: SlotKey | null) => {
    if (!slotKey) return null;

    // 1. Déjà assigné sur CE poste exact
    if (composition[slotKey] === adherent.id || (adherent.licence && composition[slotKey] === adherent.licence)) {
      return {
        isDisabled: false,
        isCurrentSlot: true,
        badge: 'Poste actuel',
        teamName: rencontre.numeroEquipe,
        details: 'Déjà assigné à ce poste',
      };
    }

    // 2. Déjà assigné sur un autre simple dans la même rencontre
    if (slotKey.startsWith('simple')) {
      const singleSlots: { key: SlotKey; label: string }[] = [
        { key: 'simple1Id', label: 'Simple 1' },
        { key: 'simple2Id', label: 'Simple 2' },
        { key: 'simple3Id', label: 'Simple 3' },
        { key: 'simple4Id', label: 'Simple 4' },
        { key: 'simple5Id', label: 'Simple 5' },
      ];
      for (const s of singleSlots) {
        if (s.key !== slotKey && (composition[s.key] === adherent.id || (adherent.licence && composition[s.key] === adherent.licence))) {
          return {
            isDisabled: true,
            isCurrentSlot: false,
            badge: `Affecté : ${s.label} (${rencontre.numeroEquipe})`,
            teamName: rencontre.numeroEquipe,
            details: `Déjà positionné en ${s.label} pour cette rencontre`,
          };
        }
      }
    }

    // 3. Déjà assigné sur un double dans la même rencontre
    if (slotKey.startsWith('double')) {
      const doubleSlots: { key: SlotKey; label: string }[] = [
        { key: 'double1Player1Id', label: 'Double 1 (J1)' },
        { key: 'double1Player2Id', label: 'Double 1 (J2)' },
        { key: 'double2Player1Id', label: 'Double 2 (J1)' },
        { key: 'double2Player2Id', label: 'Double 2 (J2)' },
      ];
      for (const d of doubleSlots) {
        if (d.key !== slotKey && (composition[d.key] === adherent.id || (adherent.licence && composition[d.key] === adherent.licence))) {
          return {
            isDisabled: true,
            isCurrentSlot: false,
            badge: `Affecté : ${d.label} (${rencontre.numeroEquipe})`,
            teamName: rencontre.numeroEquipe,
            details: `Déjà positionné en ${d.label} pour cette rencontre`,
          };
        }
      }
    }

    // 4. Déjà assigné dans UNE AUTRE ÉQUIPE du club le MÊME WEEK-END
    // RÈGLE FFT / TCM : Un joueur ne peut pas jouer dans 2 équipes différentes le même week-end (samedi/dimanche).
    // PRÉCISION BADEN CUP : L'équipe Baden Cup (+65 ans) se joue en semaine et n'affecte pas les championnats
    // du week-end (un joueur peut donc jouer en Baden Cup en semaine et en championnat le week-end sans aucun conflit).
    const isCurrentBaden = isBadenCupMatch(rencontre);
    const allMatches = allRencontres || rencontresList || [];
    const currentDateStr = composition.dateRencontreValidee || matchDateInput || rencontre.dateRencontre || '';

    for (const otherR of allMatches) {
      if (otherR.id === rencontre.id) continue;
      if (!otherR.composition) continue;

      // Si l'une des deux rencontres est la Baden Cup, PAS de conflit avec les championnats du week-end !
      const isOtherBaden = isBadenCupMatch(otherR);
      if (isCurrentBaden || isOtherBaden) {
        // La Baden Cup ne bloque pas et n'est pas bloquée par les championnats
        // Sauf si les deux sont la Baden Cup elle-même sur la même date
        if (!(isCurrentBaden && isOtherBaden)) {
          continue;
        }
      }

      const otherComp = otherR.composition;
      const matchSlots = [
        otherComp.simple1Id,
        otherComp.simple2Id,
        otherComp.simple3Id,
        otherComp.simple4Id,
        otherComp.simple5Id,
        otherComp.double1Player1Id,
        otherComp.double1Player2Id,
        otherComp.double2Player1Id,
        otherComp.double2Player2Id,
        ...(otherComp.frozenPlayers ? otherComp.frozenPlayers.map(fp => fp.adherentId || fp.licence) : [])
      ].filter(Boolean);

      const isAssignedInOther = matchSlots.some(id => 
        id === adherent.id || 
        (adherent.licence && id === adherent.licence) ||
        (adherent.nomPrenom && id?.toLowerCase().trim() === adherent.nomPrenom.toLowerCase().trim())
      );

      if (isAssignedInOther) {
        const otherDateStr = otherComp.dateRencontreValidee || otherR.dateRencontre || '';
        const sameWeekend = isSameWeekend(currentDateStr, otherDateStr);

        // Blocage UNIQUEMENT si les deux rencontres ont lieu le même week-end
        if (sameWeekend) {
          const teamLabel = otherR.numeroEquipe || 'Autre équipe';
          const journeeLabel = otherR.journee ? ` (J${otherR.journee})` : '';
          const dateLabel = otherR.dateRencontre ? ` le ${otherR.dateRencontre}` : '';

          return {
            isDisabled: true,
            isCurrentSlot: false,
            badge: `Affecté : ${teamLabel}${journeeLabel}`,
            teamName: teamLabel,
            details: `Déjà affecté à ${teamLabel} pour ce même week-end (${otherR.categorieAgeHomologation || otherR.libelleHomologation || 'Championnat'}${dateLabel})`,
          };
        }
      }
    }

    return null;
  }, [composition, rencontre, allRencontres, rencontresList]);

  // Assigner un joueur à un poste
  const handleAssignPlayer = (adherent: Adherent, slotKey: SlotKey) => {
    const eligibility = checkFFT2027Eligibility(adherent, rencontre);

    if (!eligibility.isEligible) {
      setBlockedAlertMessage(
        `Validation impossible pour ${adherent.nomPrenom} :\n• ` + eligibility.errors.join('\n• ')
      );
      return;
    }

    const assignment = getPlayerAssignment(adherent, slotKey);
    if (assignment?.isDisabled) {
      setBlockedAlertMessage(
        `Impossible d'affecter ${adherent.nomPrenom} : ${assignment.details}`
      );
      return;
    }

    setComposition(prev => ({
      ...prev,
      [slotKey]: adherent.id,
      joueursValides: false,
      valideParCapitaine: false,
    }));
    setActiveSlot(null);
    setBlockedAlertMessage(null);
  };

  const handleClearSlot = (slotKey: SlotKey) => {
    setComposition(prev => ({
      ...prev,
      [slotKey]: undefined,
      joueursValides: false,
      valideParCapitaine: false,
    }));
  };

  // Réordonner automatiquement les joueurs de simple par classement FFT décroissant (1er mardi du mois)
  const handleAutoReorderSingles = () => {
    const players: Adherent[] = [];
    for (let i = 1; i <= compFormat.numSingles; i++) {
      const key = `simple${i}Id` as SlotKey;
      const pId = composition[key];
      if (pId) {
        const p = adherentsById.get(pId);
        if (p) players.push(p);
      }
    }

    // Tri par poids de classement décroissant (meilleur classement en premier)
    players.sort((a, b) => getRankingWeight(b.dernierClassTennis) - getRankingWeight(a.dernierClassTennis));

    setComposition(prev => {
      const updated = { ...prev };
      for (let i = 1; i <= compFormat.numSingles; i++) {
        const key = `simple${i}Id` as SlotKey;
        if (i - 1 < players.length) {
          updated[key] = players[i - 1].id;
        } else {
          updated[key] = undefined;
        }
      }
      updated.joueursValides = false;
      updated.valideParCapitaine = false;
      return updated;
    });
    setBlockedAlertMessage(null);
  };

  // ÉTAPE 1 : Validation Date, Heure, Courts et Lieu
  const handleValidateStep1Logistics = () => {
    const effectiveVenue = matchVenueInput === 'autre' ? (customVenueInput.trim() || 'Lieu personnalisé') : matchVenueInput;
    const updated: MatchComposition = {
      ...composition,
      dateRencontreValidee: matchDateInput,
      heureDebut: matchHourInput,
      lieuRencontre: effectiveVenue,
      nombreCourts: matchCourtsInput,
      formatReduit,
      ordreMatchs: matchOrder,
      heuresRotations: rotationHours,
      logistiqueValidee: true,
    };
    setComposition(updated);
    onSaveComposition(rencontre.id, updated);
    setBlockedAlertMessage(null);
    setValidationSuccess('Étape 1 validée : Date, heure et lieu enregistrés.');
    setTimeout(() => setValidationSuccess(null), 3000);
  };

  // ÉTAPE 2 : Validation de l'ordre des rencontres et des heures de rotations
  const handleValidateStep2Order = () => {
    if (!step1Done) {
      setBlockedAlertMessage("Veuillez d'abord valider la date, l'heure et le lieu (Étape 1).");
      modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const effectiveVenue = matchVenueInput === 'autre' ? (customVenueInput.trim() || 'Lieu personnalisé') : matchVenueInput;
    const updated: MatchComposition = {
      ...composition,
      dateRencontreValidee: matchDateInput,
      heureDebut: matchHourInput,
      lieuRencontre: effectiveVenue,
      nombreCourts: matchCourtsInput,
      formatReduit,
      ordreMatchs: matchOrder,
      heuresRotations: rotationHours,
      logistiqueValidee: true,
      ordreValide: true,
    };
    setComposition(updated);
    onSaveComposition(rencontre.id, updated);
    setBlockedAlertMessage(null);
    setValidationSuccess('Étape 2 validée : Ordre et heures de rotations enregistrés.');
    setTimeout(() => setValidationSuccess(null), 3000);
  };

  // ÉTAPE 3 : Validation des joueurs
  const handleValidateStep3Players = () => {
    if (!step1Done) {
      setBlockedAlertMessage("Veuillez d'abord valider la date, l'heure et le lieu (Étape 1).");
      modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!step2Done) {
      setBlockedAlertMessage("Veuillez d'abord valider l'ordre des rencontres (Étape 2).");
      modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (hasIneligiblePlayer) {
      setBlockedAlertMessage(
        "Blocage FFT 2027 : La feuille de match contient un ou plusieurs joueurs non éligibles. Retirez-les avant de valider."
      );
      modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if ((compFormat.numDoubles >= 2 || compFormat.doubleWeightStrict) && doublesWeightCheck.errorMessage) {
      setBlockedAlertMessage(
        `Blocage Règle FFT (Poids des Doubles) :\n${doublesWeightCheck.errorMessage}`
      );
      modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const effectiveVenue = matchVenueInput === 'autre' ? (customVenueInput.trim() || 'Lieu personnalisé') : matchVenueInput;
    const updated: MatchComposition = {
      ...composition,
      dateRencontreValidee: matchDateInput,
      heureDebut: matchHourInput,
      lieuRencontre: effectiveVenue,
      nombreCourts: matchCourtsInput,
      formatReduit,
      ordreMatchs: matchOrder,
      heuresRotations: rotationHours,
      logistiqueValidee: true,
      ordreValide: true,
      joueursValides: true,
      valideParCapitaine: true,
      dateValidation: new Date().toLocaleDateString('fr-FR'),
      poidsDouble1: doublesWeightCheck.weightDouble1,
      poidsDouble2: doublesWeightCheck.weightDouble2,
      poidsDoublesValide: doublesWeightCheck.isValid,
    };
    setComposition(updated);
    onSaveComposition(rencontre.id, updated);
    setBlockedAlertMessage(null);
    setValidationSuccess('Étape 3 validée : Composition des joueurs confirmée !');
    setTimeout(() => setValidationSuccess(null), 3500);
  };

  // Enregistrement global de la feuille de match (ouvre toujours la modale de confirmation)
  const handleValidateMatchSheet = () => {
    if (hasIneligiblePlayer) {
      setBlockedAlertMessage(
        "Blocage FFT 2027 : La feuille de match contient un ou plusieurs joueurs non éligibles. Retirez-les avant d'enregistrer."
      );
      modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if ((compFormat.numDoubles >= 2 || compFormat.doubleWeightStrict) && doublesWeightCheck.errorMessage) {
      setBlockedAlertMessage(
        `Blocage Règle FFT (Poids des Doubles) :\n${doublesWeightCheck.errorMessage}`
      );
      modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const effectiveVenue = matchVenueInput === 'autre' ? (customVenueInput.trim() || 'Lieu personnalisé') : matchVenueInput;

    const updated: MatchComposition = {
      ...composition,
      valideParCapitaine: true,
      logistiqueValidee: true,
      ordreValide: true,
      joueursValides: selectedPlayerIds.length > 0 ? true : composition.joueursValides,
      ordreMatchs: matchOrder,
      heuresRotations: rotationHours,
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

    setBlockedAlertMessage(null);
    setComposition(updated);
    setIsConfirmGsheetOpen(true);
  };

  // Exécution de l'enregistrement après confirmation explicite
  const handleConfirmSaveToGsheet = async () => {
    if (!rencontre) return;
    setIsSavingToSheet(true);
    try {
      const effectiveVenue = matchVenueInput === 'autre' ? (customVenueInput.trim() || 'Lieu personnalisé') : matchVenueInput;

      const updated: MatchComposition = {
        ...composition,
        valideParCapitaine: true,
        logistiqueValidee: true,
        ordreValide: true,
        joueursValides: selectedPlayerIds.length > 0 ? true : composition.joueursValides,
        ordreMatchs: matchOrder,
        heuresRotations: rotationHours,
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

      if (selectedSpreadsheetId) {
        let token: string | null = null;
        try {
          token = await getAccessToken();
        } catch {
          token = null;
        }
        const result = await saveCompositionToSheet(
          selectedSpreadsheetId,
          rencontre,
          updated,
          adherentsById,
          token
        );
        setSheetSaveSuccess(`Feuille de match enregistrée (${result.rowsSaved} poste(s) enregistré(s)) !`);
      } else {
        setSheetSaveSuccess('Feuille de match enregistrée avec succès !');
      }

      setComposition(updated);
      onSaveComposition(rencontre.id, updated);
      setIsConfirmGsheetOpen(false);
      modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => setSheetSaveSuccess(null), 4500);
    } catch (err: any) {
      console.warn('Erreur enregistrement feuille de match:', err);
      setBlockedAlertMessage(`Erreur d'enregistrement : ${err.message || 'accès réseau indisponible'}`);
      setIsConfirmGsheetOpen(false);
      modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSavingToSheet(false);
    }
  };

  // Regroupement des matchs selon les rotations enregistrées et l'ordre défini
  const getRotationsFromMatchOrder = () => {
    const groupsMap = new Map<string, string[]>();
    matchOrder.forEach((token, idx) => {
      const time = getMatchTimeSlot(idx, token);
      if (!groupsMap.has(time)) {
        groupsMap.set(time, []);
      }
      groupsMap.get(time)!.push(token);
    });
    return Array.from(groupsMap.entries()).map(([time, items]) => ({ time, items }));
  };

  // Génération du texte SMS pour les joueurs de l'équipe (trame officielle sans icône, avec COMPOSITION & ORDRE)
  const buildPlayersSmsText = () => {
    const teamNum = (rencontre.numeroEquipe || '').replace(/^(?:équipe\s*|tcm\s*)/i, '').trim() || rencontre.numeroEquipe || '';
    const headerNum = teamNum ? ` - ${teamNum}` : '';
    const effectiveVenue = matchVenueInput === 'autre' ? (customVenueInput || 'Lieu personnalisé') : matchVenueInput;
    const capName = rencontre.prenomCapitaine
      ? `${rencontre.prenomCapitaine} ${rencontre.nomCapitaine}`.trim()
      : (rencontre.nomCapitaine || 'Non désigné');

    const lines: string[] = [
      `FEUILLE DE MATCH TCM${headerNum}`,
      `${rencontre.libelleHomologation || compFormat.categoryLabel}`,
      `Date : ${scheduleCheck.dayName} ${matchDateInput} à ${matchHourInput}`,
      `Lieu : ${effectiveVenue} (${matchCourtsInput} court(s))`,
      `Rencontre : ${formatMuzillacClubName(rencontre.clubAccueilNom, rencontre.numeroEquipe)} vs ${formatMuzillacClubName(rencontre.clubVisiteurNom, rencontre.numeroEquipe)}`,
      `Capitaine : ${capName}`,
      '',
      'COMPOSITION & ORDRE',
    ];

    const rotations = getRotationsFromMatchOrder();
    rotations.forEach(({ time, items }) => {
      lines.push(time);
      items.forEach((token) => {
        if (token.startsWith('S')) {
          const num = parseInt(token.slice(1), 10);
          const pId = (composition as any)[`simple${num}Id`] as string | undefined;
          const p = pId ? adherentsById.get(pId) : undefined;
          if (p) {
            const rank = cleanRanking(p.dernierClassTennis) || 'NC';
            const lic = (p.licence || '').trim();
            lines.push(`N°${num} ${rank} ${p.nomPrenom}${lic ? ` ${lic}` : ''}`);
          } else {
            lines.push(`N°${num} À désigner`);
          }
        } else if (token.startsWith('D')) {
          const dNum = parseInt(token.slice(1), 10);
          const p1Id = dNum === 1 ? composition.double1Player1Id : composition.double2Player1Id;
          const p2Id = dNum === 1 ? composition.double1Player2Id : composition.double2Player2Id;
          const p1 = p1Id ? adherentsById.get(p1Id) : undefined;
          const p2 = p2Id ? adherentsById.get(p2Id) : undefined;
          const w1 = p1 ? getDoubleRankingWeight(p1.dernierClassTennis) : null;
          const w2 = p2 ? getDoubleRankingWeight(p2.dernierClassTennis) : null;
          const totalW = w1 !== null && w2 !== null ? w1 + w2 : null;
          const doubleTitle = compFormat.numDoubles >= 2 ? `Double ${dNum}` : 'Double';
          lines.push(totalW !== null ? `${doubleTitle} (${totalW})` : doubleTitle);

          if (p1) {
            const lic1 = (p1.licence || '').trim();
            lines.push(`${w1} ${p1.nomPrenom}${lic1 ? ` ${lic1}` : ''}`);
          } else {
            lines.push('À désigner');
          }
          if (p2) {
            const lic2 = (p2.licence || '').trim();
            lines.push(`${w2} ${p2.nomPrenom}${lic2 ? ` ${lic2}` : ''}`);
          } else {
            lines.push('À désigner');
          }
        }
      });
    });

    return lines.join('\n');
  };

  // Génération du texte SMS pour l'équipe adversaire (uniquement les heures et les numéros des joueurs)
  const buildOpponentSmsText = () => {
    const teamNum = (rencontre.numeroEquipe || '').replace(/^(?:équipe\s*|tcm\s*)/i, '').trim() || rencontre.numeroEquipe || '';
    const headerNum = teamNum ? ` - ${teamNum}` : '';
    const effectiveVenue = matchVenueInput === 'autre' ? (customVenueInput || 'Lieu personnalisé') : matchVenueInput;

    const lines: string[] = [
      `ORDRE DES MATCHS TCM${headerNum}`,
      `${rencontre.libelleHomologation || compFormat.categoryLabel}`,
      `Date : ${scheduleCheck.dayName} ${matchDateInput} à ${matchHourInput}`,
      `Lieu : ${effectiveVenue} (${matchCourtsInput} court(s))`,
      `Rencontre : ${formatMuzillacClubName(rencontre.clubAccueilNom, rencontre.numeroEquipe)} vs ${formatMuzillacClubName(rencontre.clubVisiteurNom, rencontre.numeroEquipe)}`,
      '',
      'ORDRE DES RENCONTRES',
    ];

    const rotations = getRotationsFromMatchOrder();
    rotations.forEach(({ time, items }) => {
      lines.push(time);
      items.forEach((token) => {
        if (token.startsWith('S')) {
          const num = parseInt(token.slice(1), 10);
          lines.push(`N°${num}`);
        } else if (token.startsWith('D')) {
          const dNum = parseInt(token.slice(1), 10);
          lines.push(compFormat.numDoubles >= 2 ? `Double ${dNum}` : 'Double');
        }
      });
    });

    return lines.join('\n');
  };

  const playersSmsText = buildPlayersSmsText();
  const opponentSmsText = buildOpponentSmsText();
  const opponentSmsPhone = (rencontre.portableCapitaineAdverse || rencontre.portableCorrespondantAdverse || '').replace(/\s+/g, '');
  const playersSmsHref = `sms:?body=${encodeURIComponent(playersSmsText)}`;
  const opponentSmsHref = `sms:${opponentSmsPhone}?body=${encodeURIComponent(opponentSmsText)}`;

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
                    {isDouble
                      ? `Poids ${getDoubleRankingWeight(player.dernierClassTennis)}`
                      : player.ageSportif ? `${player.ageSportif} ans` : 'Senior'}
                  </p>
                </div>

                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleClearSlot(slotKey)}
                    className="text-zinc-500 hover:text-rose-400 text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/80 hover:bg-rose-950/40 border border-zinc-700 transition cursor-pointer"
                    title="Retirer ce joueur"
                  >
                    Retirer
                  </button>
                )}
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
        ) : canEdit ? (
          step2Done ? (
            <button
              type="button"
              onClick={() => setActiveSlot({ key: slotKey, label })}
              className="w-full py-2 flex items-center justify-center gap-2 rounded-lg transition cursor-pointer hover:bg-orange-600/10"
            >
              <UserCheck className="w-4 h-4 text-[#FF6D00]" />
              <span className="text-[#FF6D00] font-black text-xs">Assigner {label}</span>
            </button>
          ) : (
            <div className="w-full py-2 flex items-center justify-center gap-1.5 text-zinc-500 text-[11px] italic opacity-75">
              <Lock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span>Validez d&apos;abord l&apos;ordre des rencontres (Étape 2)</span>
            </div>
          )
        ) : (
          <div className="w-full py-2 flex items-center justify-center gap-1.5 text-zinc-500 text-xs italic">
            <span>Poste non assigné</span>
          </div>
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
                      {!isComiteBye && step1Done ? ` à ${matchHourInput || '14:00'}` : ''}
                    </span>
                    {isComiteBye && comiteByeScore && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        Victoire {comiteByeScore} (Journée off)
                      </span>
                    )}
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
            <div ref={modalBodyRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3.5 sm:p-6 space-y-4 sm:space-y-6 touch-pan-y">

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

                    {/* 2. Alerte Ordre des Simples (Non bloquante, recalculs mensuels FFT le 1er mardi du mois) */}
                    {!rankingOrderCheck.isValid && (
                      <div className="p-3 rounded-xl bg-black/40 border border-amber-500/50 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="space-y-1">
                          <p className="font-black text-amber-300 text-[11px] sm:text-xs flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>Alerte hiérarchie des classements (1er mardi du mois) :</span>
                          </p>
                          <p className="text-[11px] text-zinc-300 pl-1 leading-relaxed">
                            {rankingOrderCheck.error}. Les classements ayant pu évoluer après saisie, l'enregistrement reste autorisé ou cliquez ci-contre pour corriger l'ordre :
                          </p>
                        </div>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={handleAutoReorderSingles}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer self-start sm:self-center shrink-0 shadow"
                            title="Trier automatiquement les simples par classement FFT décroissant"
                          >
                            <ArrowUpDown className="w-3.5 h-3.5" />
                            <span>Réordonner les simples</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* 3. Alerte Poids des Doubles */}
                    {(compFormat.numDoubles >= 2 || compFormat.doubleWeightStrict) && doublesWeightCheck.errorMessage && (
                      <div className="p-2.5 rounded-xl bg-black/40 border border-purple-500/40 text-purple-200 flex items-start justify-between gap-2 flex-wrap">
                        <div className="space-y-1">
                          <p className="font-black text-purple-300 text-[11px] flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                            <span>Règle FFT du Poids des doubles (Poids D1 ≤ Poids D2) :</span>
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
                  <span>{validationSuccess}</span>
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

          {/* Progression des 3 étapes de validation du capitaine */}
          {canEdit && (
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div className={`p-2 rounded-xl border flex items-center gap-1.5 font-bold ${
                step1Done
                  ? 'bg-emerald-950/35 border-emerald-500/40 text-emerald-300'
                  : 'bg-orange-500/15 border-orange-500/40 text-orange-300'
              }`}>
                {step1Done ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <span className="w-4 h-4 rounded-full bg-orange-500 text-white text-[10px] font-black flex items-center justify-center shrink-0">1</span>}
                <span className="truncate">1. Date, heure &amp; lieu</span>
              </div>

              <div className={`p-2 rounded-xl border flex items-center gap-1.5 font-bold ${
                step2Done
                  ? 'bg-emerald-950/35 border-emerald-500/40 text-emerald-300'
                  : step1Done
                    ? 'bg-orange-500/15 border-orange-500/40 text-orange-300'
                    : 'bg-[#12151b] border-zinc-800 text-zinc-500'
              }`}>
                {step2Done ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <span className={`w-4 h-4 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${step1Done ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}>2</span>}
                <span className="truncate">2. Ordre des matchs</span>
              </div>

              <div className={`p-2 rounded-xl border flex items-center gap-1.5 font-bold ${
                step3Done
                  ? 'bg-emerald-950/35 border-emerald-500/40 text-emerald-300'
                  : step2Done
                    ? 'bg-orange-500/15 border-orange-500/40 text-orange-300'
                    : 'bg-[#12151b] border-zinc-800 text-zinc-500'
              }`}>
                {step3Done ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <span className={`w-4 h-4 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${step2Done ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}>3</span>}
                <span className="truncate">3. Joueurs</span>
              </div>
            </div>
          )}

          {/* Statut de la composition officielle */}
          {composition.valideParCapitaine && (
            <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-200 flex items-center justify-between gap-2 shadow-md">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-heading font-black text-white text-xs sm:text-sm">
                    Feuille de match validée
                  </h4>
                  <p className="text-[11px] text-emerald-300/80">
                    {composition.dateValidation ? `Validée le ${composition.dateValidation}` : 'Enregistrée'} • Visible par tous les adhérents
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                Validée
              </span>
            </div>
          )}

          {/* Bandeau spécifique : Journée Off (COMITÉ MORBIHAN TENNIS / Exempt) */}
          {isComiteBye && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-950/40 border-2 border-emerald-500/50 text-emerald-100 flex items-start justify-between gap-3 shadow-lg flex-wrap">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center justify-center shrink-0">
                  <Trophy className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="font-heading font-black text-white text-xs sm:text-sm">
                    Journée « off » (Exempt) — Pas de rencontre à disputer
                  </h4>
                  <p className="text-[11px] text-emerald-200/90 leading-relaxed">
                    Face au <strong>COMITÉ MORBIHAN TENNIS</strong> (poule avec un nombre impair de clubs), il n'y a pas de match à jouer : la rencontre est notée comme gagnée <strong>{comiteByeScore}</strong> ({compFormat.numSingles} simple{compFormat.numSingles > 1 ? 's' : ''} + {compFormat.numDoubles} double{compFormat.numDoubles > 1 ? 's' : ''}).
                  </p>
                </div>
              </div>
              {comiteByeScore && (
                <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-heading font-black text-sm shrink-0">
                  {comiteByeScore}
                </span>
              )}
            </div>
          )}

          {/* ==================== ÉTAPE 1 : LOGISTIQUE DU MATCH (DATE, HEURE, COURTS, LIEU) ==================== */}
          {!isComiteBye && (canEdit || step1Done) ? (
          <div className="p-3.5 sm:p-4 rounded-2xl bg-[#090b0e] border border-[#232934] space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              
              {/* 1. Date avec mini calendrier */}
              <div className="p-2.5 rounded-xl bg-[#141820] border border-[#232934] space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Date validée
                </label>
                {canEdit ? (
                  <div className="flex items-center space-x-1.5 bg-black/40 border border-[#2a323f] rounded-lg px-2 py-1 focus-within:border-orange-500">
                    <Calendar className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    <input
                      type="date"
                      value={toIsoDate(matchDateInput)}
                      onChange={(e) => {
                        if (e.target.value) {
                          setMatchDateInput(fromIsoDate(e.target.value));
                          setComposition(prev => ({ ...prev, logistiqueValidee: false, valideParCapitaine: false }));
                        }
                      }}
                      className="w-full bg-transparent text-xs text-white font-mono focus:outline-none cursor-pointer [color-scheme:dark]"
                      title="Cliquez pour ouvrir le mini calendrier"
                    />
                  </div>
                ) : (
                  <div className="flex items-center space-x-1.5 bg-black/40 border border-[#2a323f] rounded-lg px-2 py-1">
                    <Calendar className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    <span className="text-xs text-white font-mono font-bold">{matchDateInput || rencontre.dateRencontre}</span>
                  </div>
                )}
              </div>

              {/* 2. Horaire : Liste 9h, 14h (normaux) et heure paramétrable */}
              <div className="p-2.5 rounded-xl bg-[#141820] border border-[#232934] space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Horaire
                </label>
                {canEdit ? (
                  <div className="space-y-1">
                    <select
                      value={
                        isCustomHourMode || (matchHourInput !== '09:00' && matchHourInput !== '14:00')
                          ? 'autre'
                          : matchHourInput
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'autre') {
                          setIsCustomHourMode(true);
                          return;
                        }
                        setIsCustomHourMode(false);
                        const nextRot = computeRotationHours(matchOrder, val, matchCourtsInput);
                        setMatchHourInput(val);
                        setRotationHours(nextRot);
                        setComposition(prev => ({
                          ...prev,
                          heureDebut: val,
                          heuresRotations: nextRot,
                          logistiqueValidee: false,
                          valideParCapitaine: false,
                        }));
                      }}
                      className="w-full bg-black/50 border border-[#2a323f] rounded-lg px-2 py-1 text-xs text-white font-bold focus:outline-none focus:border-orange-500 cursor-pointer"
                    >
                      <option value="09:00">09:00 (Matin standard)</option>
                      <option value="14:00">14:00 (Après-midi standard)</option>
                      <option value="autre">⚙️ Autre heure paramétrable...</option>
                    </select>

                    {(isCustomHourMode || (matchHourInput !== '09:00' && matchHourInput !== '14:00')) && (
                      <div className="flex items-center space-x-1.5 bg-black/50 border border-orange-500/50 rounded-lg px-2 py-1">
                        <Clock className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                        <input
                          type="time"
                          value={matchHourInput}
                          onChange={(e) => {
                            const newHour = e.target.value;
                            setMatchHourInput(newHour);
                            if (newHour && /^\d{1,2}:\d{2}$/.test(newHour)) {
                              const nextRot = computeRotationHours(matchOrder, newHour, matchCourtsInput);
                              setRotationHours(nextRot);
                              setComposition(prev => ({
                                ...prev,
                                heureDebut: newHour,
                                heuresRotations: nextRot,
                                logistiqueValidee: false,
                                valideParCapitaine: false,
                              }));
                            }
                          }}
                          className="w-full bg-transparent text-xs text-orange-300 font-mono font-bold focus:outline-none [color-scheme:dark] cursor-pointer"
                          title="Saisir une heure personnalisée"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center space-x-1.5 bg-black/40 border border-[#2a323f] rounded-lg px-2 py-1">
                    <Clock className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    <span className="text-xs text-orange-300 font-mono font-bold">{matchHourInput || '09:00'}</span>
                  </div>
                )}
              </div>

              {/* 3. Courts disponibles */}
              <div className="p-2.5 rounded-xl bg-[#141820] border border-[#232934] space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Courts alloués
                </label>
                {canEdit ? (
                  <div className="flex items-center space-x-1">
                    {[1, 2, 3].map(cnt => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => {
                          const nextRot = computeRotationHours(matchOrder, matchHourInput, cnt);
                          setMatchCourtsInput(cnt);
                          setRotationHours(nextRot);
                          setComposition(prev => ({
                            ...prev,
                            nombreCourts: cnt,
                            heuresRotations: nextRot,
                            logistiqueValidee: false,
                            valideParCapitaine: false,
                          }));
                        }}
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
                ) : (
                  <div className="bg-black/40 border border-[#2a323f] rounded-lg px-2 py-1 text-xs text-sky-300 font-bold">
                    {matchCourtsInput} court{matchCourtsInput > 1 ? 's' : ''}
                  </div>
                )}
              </div>

              {/* 4. Lieu du match */}
              <div className="p-2.5 rounded-xl bg-[#141820] border border-[#232934] space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Lieu du match
                </label>
                {canEdit ? (
                  <div className="space-y-1">
                    <select
                      value={matchVenueInput}
                      onChange={(e) => {
                        setMatchVenueInput(e.target.value);
                        setComposition(prev => ({ ...prev, logistiqueValidee: false, valideParCapitaine: false }));
                      }}
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
                    {matchVenueInput === 'autre' && (
                      <input
                        type="text"
                        value={customVenueInput}
                        onChange={(e) => {
                          setCustomVenueInput(e.target.value);
                          setComposition(prev => ({ ...prev, logistiqueValidee: false, valideParCapitaine: false }));
                        }}
                        placeholder="Saisir le lieu..."
                        className="w-full bg-black/50 border border-orange-500/50 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                      />
                    )}
                  </div>
                ) : (
                  <div className="bg-black/40 border border-[#2a323f] rounded-lg px-2 py-1 text-xs text-zinc-200 truncate" title={matchVenueInput}>
                    {matchVenueInput}
                  </div>
                )}
              </div>

            </div>

            {canEdit && (
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#1e2430] flex-wrap">
                <span className="text-[11px] text-zinc-400">
                  {step1Done
                    ? '✓ Étape 1 validée (Date, heure, courts et lieu enregistrés)'
                    : 'Étape 1 : Validez d’abord la date, l’heure et le lieu de la rencontre'}
                </span>
                <button
                  type="button"
                  onClick={handleValidateStep1Logistics}
                  className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer ${
                    step1Done
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                      : 'bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white shadow-md hover:brightness-110'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{step1Done ? 'Date, heure et lieu validés' : '1. Valider date, heure et lieu'}</span>
                </button>
              </div>
            )}
          </div>
          ) : !isComiteBye ? (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-[#090b0e] border border-[#232934] flex items-center gap-2.5 text-xs text-zinc-400">
              <Clock className="w-4 h-4 text-zinc-500 shrink-0" />
              <span>Les horaires et le lieu de la rencontre seront affichés dès qu'ils seront validés par le capitaine.</span>
            </div>
          ) : null}

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
                    <p className="text-[11px] text-zinc-400 font-mono mt-0.5 whitespace-nowrap tabular-nums">
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
                        <p className="text-[11px] text-zinc-400 font-mono mt-0.5 whitespace-nowrap tabular-nums">
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

          {/* ==================== MATCHS OFFICIELS, RÈGLE SPÉCIFIQUE & ORDRE ==================== */}
          <div className="space-y-3">
            {/* Règle spécifique uniquement à CETTE rencontre */}
            <div className="p-3 rounded-2xl bg-[#0e1219] border border-[#232a37] text-xs space-y-1">
              <div className="flex items-center justify-between text-orange-400 font-bold gap-2">
                <span className="flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>Règle applicable à cette rencontre ({compFormat.divisionLabel})</span>
                </span>
                <span className="text-[10px] text-zinc-400 font-mono shrink-0">
                  {compFormat.numSingles}S + {compFormat.numDoubles}D
                </span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                {compFormat.orderOfPlay}
                {compFormat.doubleWeightStrict ? ' • Poids des doubles FFT (inversé) : Poids Double 1 ≤ Poids Double 2.' : ''}
              </p>
              {schedulePlan.surfacesDifferentesActif && (
                <p className="text-[10px] text-purple-300">
                  2 terrains de surfaces différentes : le capitaine visiteur choisit le terrain pour chacun des simples avant jeudi 20h00.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-400" />
                <h3 className="font-heading font-black text-white text-sm sm:text-base">
                  Matchs officiels &amp; Ordre des rencontres
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30 font-bold">
                  {compFormat.numSingles}S + {compFormat.numDoubles}D
                </span>
              </div>

              {canEdit && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleValidateStep2Order}
                    disabled={!step1Done}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
                      !step1Done
                        ? 'bg-zinc-800/80 text-zinc-500 border border-zinc-800 cursor-not-allowed'
                        : step2Done
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 cursor-pointer'
                          : 'bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white shadow hover:brightness-110 cursor-pointer'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{step2Done ? 'Ordre des rencontres validé' : "2. Valider l'ordre des rencontres"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleValidateStep3Players}
                    disabled={!step1Done || !step2Done || hasIneligiblePlayer || ((compFormat.numDoubles >= 2 || compFormat.doubleWeightStrict) && !doublesWeightCheck.isValid)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
                      !step1Done || !step2Done || hasIneligiblePlayer || ((compFormat.numDoubles >= 2 || compFormat.doubleWeightStrict) && !doublesWeightCheck.isValid)
                        ? 'bg-zinc-800/80 text-zinc-500 border border-zinc-800 cursor-not-allowed'
                        : step3Done
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 cursor-pointer'
                          : 'bg-sky-600 hover:bg-sky-500 text-white shadow cursor-pointer'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>{step3Done ? 'Joueurs validés' : '3. Valider les joueurs'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Liste ordonnée unifiée (Simples & Doubles en ordre numérique par défaut tant que le capitaine n'a pas validé) */}
            <div className="space-y-2.5">
              {matchOrder.map((token, matchIndex) => {
                const timeSlot = getMatchTimeSlot(matchIndex, token);

                if (token.startsWith('S')) {
                  const playerNum = parseInt(token.slice(1), 10);
                  const slotKey = `simple${playerNum}Id` as SlotKey;

                  return (
                    <div
                      key={`match-${token}`}
                      className="p-3 rounded-2xl bg-[#0d1016] border border-[#232936] space-y-2 transition hover:border-zinc-700 shadow-md"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-lg bg-black/70 border border-zinc-700 text-white font-mono font-black text-xs">
                            Match {matchIndex + 1}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-300 font-mono text-xs font-bold">
                            <Clock className="w-3 h-3 text-orange-400 shrink-0" />
                            {canEdit && step1Done ? (
                              <input
                                type="time"
                                value={timeSlot}
                                onChange={(e) => handleUpdateMatchRotationTime(token, e.target.value)}
                                className="bg-transparent text-orange-300 font-mono text-xs font-bold focus:outline-none [color-scheme:dark] cursor-pointer"
                                title="Heure de rotation de ce match"
                              />
                            ) : (
                              <span>{timeSlot}</span>
                            )}
                          </span>

                          <div className="flex items-center space-x-1.5">
                            <span className="text-[11px] text-zinc-400">Affectation :</span>
                            {canEdit && step1Done ? (
                              <select
                                value={playerNum}
                                onChange={(e) => {
                                  const targetNum = parseInt(e.target.value, 10);
                                  swapSingleTokenInOrder(matchIndex, targetNum);
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
                            ) : (
                              <span className="font-bold text-xs text-orange-300 bg-black/60 border border-orange-500/30 px-2 py-0.5 rounded-lg">
                                Joueur n°{playerNum} {playerNum === 1 ? '(Leader)' : ''}
                              </span>
                            )}
                          </div>
                        </div>

                        {canEdit && (
                          <div className="flex items-center space-x-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => moveMatchOrder(matchIndex, matchIndex - 1)}
                              disabled={!step1Done || matchIndex === 0}
                              className={`w-6 h-6 rounded-lg flex items-center justify-center border transition ${
                                !step1Done || matchIndex === 0
                                  ? 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed'
                                  : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300 hover:text-white cursor-pointer'
                              }`}
                              title="Monter ce match dans l'ordre"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveMatchOrder(matchIndex, matchIndex + 1)}
                              disabled={!step1Done || matchIndex === matchOrder.length - 1}
                              className={`w-6 h-6 rounded-lg flex items-center justify-center border transition ${
                                !step1Done || matchIndex === matchOrder.length - 1
                                  ? 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed'
                                  : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300 hover:text-white cursor-pointer'
                              }`}
                              title="Descendre ce match dans l'ordre"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div>
                        {renderSlotCard(slotKey, `Joueur n°${playerNum}`)}
                      </div>
                    </div>
                  );
                }

                // Double 1 ou Double 2
                const dNum = parseInt(token.slice(1), 10);
                const p1SlotKey: SlotKey = dNum === 1 ? 'double1Player1Id' : 'double2Player1Id';
                const p2SlotKey: SlotKey = dNum === 1 ? 'double1Player2Id' : 'double2Player2Id';
                const p1 = composition[p1SlotKey] ? adherentsById.get(composition[p1SlotKey]!) : null;
                const p2 = composition[p2SlotKey] ? adherentsById.get(composition[p2SlotKey]!) : null;
                const pairWeight = (p1 ? getDoubleRankingWeight(p1.dernierClassTennis) : 0) + (p2 ? getDoubleRankingWeight(p2.dernierClassTennis) : 0);
                const pairComplete = Boolean(p1 && p2);

                return (
                  <div
                    key={`match-${token}`}
                    className="p-3 rounded-2xl bg-[#0d1016] border border-[#232936] space-y-2 transition hover:border-zinc-700 shadow-md"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-lg bg-black/70 border border-zinc-700 text-white font-mono font-black text-xs">
                          Match {matchIndex + 1}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono text-xs font-bold">
                          <Clock className="w-3 h-3 text-purple-400 shrink-0" />
                          {canEdit && step1Done ? (
                            <input
                              type="time"
                              value={timeSlot}
                              onChange={(e) => handleUpdateMatchRotationTime(token, e.target.value)}
                              className="bg-transparent text-purple-300 font-mono text-xs font-bold focus:outline-none [color-scheme:dark] cursor-pointer"
                              title="Heure de rotation de ce double"
                            />
                          ) : (
                            <span>{timeSlot}</span>
                          )}
                        </span>
                        <span className="font-heading font-black text-white text-xs sm:text-sm">
                          {compFormat.numDoubles >= 2 ? `Double N°${dNum}` : 'Double'}
                        </span>
                        {dNum === 1 && compFormat.numDoubles >= 2 && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 font-bold">
                            Paire N°1 (Poids D1 ≤ D2)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {dNum === 2 && canEdit && step2Done && (
                          <button
                            type="button"
                            onClick={handleSwapDoubles}
                            className="text-xs text-orange-400 hover:text-white flex items-center gap-1 font-bold cursor-pointer mr-1"
                            title="Intervertir la paire D1 et la paire D2"
                          >
                            <ArrowUpDown className="w-3.5 h-3.5" />
                            <span>Inverser D1 et D2</span>
                          </button>
                        )}
                        {canEdit && (
                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => moveMatchOrder(matchIndex, matchIndex - 1)}
                              disabled={!step1Done || matchIndex === 0}
                              className={`w-6 h-6 rounded-lg flex items-center justify-center border transition ${
                                !step1Done || matchIndex === 0
                                  ? 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed'
                                  : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300 hover:text-white cursor-pointer'
                              }`}
                              title="Monter ce double dans l'ordre"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveMatchOrder(matchIndex, matchIndex + 1)}
                              disabled={!step1Done || matchIndex === matchOrder.length - 1}
                              className={`w-6 h-6 rounded-lg flex items-center justify-center border transition ${
                                !step1Done || matchIndex === matchOrder.length - 1
                                  ? 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed'
                                  : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300 hover:text-white cursor-pointer'
                              }`}
                              title="Descendre ce double dans l'ordre"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {renderSlotCard(p1SlotKey, compFormat.numDoubles >= 2 ? `Joueur 1 (Double ${dNum})` : 'Joueur 1 (Double)')}
                        {renderSlotCard(p2SlotKey, compFormat.numDoubles >= 2 ? `Joueur 2 (Double ${dNum})` : 'Joueur 2 (Double)')}
                      </div>
                      {pairComplete && (
                        <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-0.5">
                          <span>
                            Poids total {compFormat.numDoubles >= 2 ? `Double ${dNum}` : 'du Double'} :{' '}
                            <strong className="text-white font-mono">{pairWeight}</strong>
                            <span className="text-zinc-500 ml-1">
                              ({getDoubleRankingWeight(p1!.dernierClassTennis)} + {getDoubleRankingWeight(p2!.dernierClassTennis)})
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="hidden sm:inline">{playersWithEligibility.length} licenciés TCM éligibles</span>
                    <span className="sm:hidden">Licenciés TCM</span>
                  </span>
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
                  <span className="text-zinc-500 block text-[9px] sm:text-[10px]">1. Club &amp; Licence :</span>
                  <span className="font-bold text-emerald-400 text-[11px] sm:text-xs">TCM ({saison})</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[9px] sm:text-[10px]">2. Sexe épreuve :</span>
                  <span className="font-bold text-orange-400 text-[11px] sm:text-xs">{reqSex === 'H' ? 'Messieurs (H)' : reqSex === 'F' ? 'Dames (F)' : 'Mixte'}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[9px] sm:text-[10px]">3. Catégorie d'âge :</span>
                  <span className="font-bold text-white text-[11px] sm:text-xs">{rencontre.categorieAgeHomologation || 'TCM'}</span>
                </div>
              </div>

              {/* Grille des adhérents avec statut */}
              <div className="max-h-64 sm:max-h-72 overflow-y-auto space-y-1.5 pr-1 touch-pan-y">
                {playersWithEligibility
                  .filter(item => {
                    if (!playerSearchQuery.trim()) return true;
                    const q = playerSearchQuery.toLowerCase().trim();
                    const name = (item.adherent.nomPrenom || '').toLowerCase();
                    const rank = (item.adherent.dernierClassTennis || '').toLowerCase();
                    const lic = (item.adherent.licence || '').toLowerCase();
                    return name.includes(q) || rank.includes(q) || lic.includes(q);
                  })
                  .map(({ adherent, dispo }) => {
                    const assignment = getPlayerAssignment(adherent, activeSlot.key);
                    const isDisabled = !!assignment?.isDisabled;
                    const isCurrentSlot = !!assignment?.isCurrentSlot;

                    return (
                      <div
                        key={adherent.id}
                        onClick={() => {
                          if (isDisabled) return;
                          handleAssignPlayer(adherent, activeSlot.key);
                        }}
                        className={`p-3 rounded-2xl border transition flex items-center justify-between ${
                          isDisabled
                            ? 'bg-[#10131a] border-zinc-800/80 opacity-60 cursor-not-allowed select-none'
                            : isCurrentSlot
                              ? 'bg-emerald-950/20 border-emerald-500/40 text-white cursor-default'
                              : 'bg-[#181c25] border-[#262c3a] hover:border-orange-500/60 hover:bg-[#1d222e] cursor-pointer group'
                        }`}
                        title={isDisabled ? assignment.details : `Assigner ${adherent.nomPrenom} au ${activeSlot.label}`}
                      >
                        <div className="flex items-center space-x-3 min-w-0 flex-1 pr-2">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            isDisabled 
                              ? 'bg-zinc-800/80 text-zinc-500 border border-zinc-700' 
                              : isCurrentSlot
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          }`}>
                            {isDisabled ? <Lock className="w-3.5 h-3.5 text-zinc-400" /> : isCurrentSlot ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : '✓'}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                              <span className={`font-heading font-black text-xs sm:text-sm truncate ${isDisabled ? 'text-zinc-400' : 'text-white'}`}>
                                {adherent.nomPrenom}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 text-[10px] font-mono font-bold shrink-0">
                                {adherent.dernierClassTennis}
                              </span>
                              {dispo && (
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0 ${
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
                            </div>

                            {/* Ligne détails ou motif d'affectation */}
                            {isDisabled ? (
                              <p className="text-[11px] text-amber-400 font-medium flex items-center gap-1 mt-0.5 truncate">
                                <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                                <span className="truncate">{assignment.details}</span>
                              </p>
                            ) : (
                              <p className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5">
                                <span>Licence {adherent.licence} ({adherent.millesimeLicence || '2027'})</span>
                                <span>•</span>
                                <span>{adherent.ageSportif ? `${adherent.ageSportif} ans` : adherent.dateNaissance || 'TCM'}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Statut / Badge d'affectation à droite */}
                        <div className="shrink-0">
                          {isDisabled ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shadow-sm">
                              <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                              <span>{assignment.badge}</span>
                            </span>
                          ) : isCurrentSlot ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span>Actuellement assigné</span>
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-xl text-xs font-black bg-orange-500/20 text-orange-400 border border-orange-500/40 group-hover:bg-orange-500 group-hover:text-white transition">
                              Assigner
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
          
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            <a
              href={playersSmsHref}
              onClick={() => {
                navigator.clipboard?.writeText(playersSmsText).catch(() => {});
                setCopiedPlayersSms(true);
                setTimeout(() => setCopiedPlayersSms(false), 2000);
              }}
              className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-[#1a1f29] hover:bg-[#252c3a] border border-[#2c3444] text-zinc-200 hover:text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              title="Ouvrir l'application SMS avec la feuille de match complète pour les joueurs"
            >
              {copiedPlayersSms ? <Check className="w-4 h-4 text-emerald-400 shrink-0" /> : <MessageSquare className="w-4 h-4 text-orange-400 shrink-0" />}
              <span>{copiedPlayersSms ? 'SMS ouvert !' : 'SMS pour les joueurs'}</span>
            </a>

            <a
              href={opponentSmsHref}
              onClick={() => {
                navigator.clipboard?.writeText(opponentSmsText).catch(() => {});
                setCopiedOpponentSms(true);
                setTimeout(() => setCopiedOpponentSms(false), 2000);
              }}
              className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-[#1a1f29] hover:bg-[#252c3a] border border-[#2c3444] text-zinc-200 hover:text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              title="Ouvrir l'application SMS avec l'ordre et les horaires pour l'équipe adversaire"
            >
              {copiedOpponentSms ? <Check className="w-4 h-4 text-emerald-400 shrink-0" /> : <MessageSquare className="w-4 h-4 text-sky-400 shrink-0" />}
              <span>{copiedOpponentSms ? 'SMS ouvert !' : "SMS pour l'équipe adversaire"}</span>
            </a>
          </div>

          <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition cursor-pointer"
            >
              Fermer
            </button>

            {!canEdit ? (
              <div className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-bold shadow-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Mode consultation adhérent</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {!selectedSpreadsheetId && onOpenGoogleSyncModal && (
                  <button
                    onClick={onOpenGoogleSyncModal}
                    className="px-3.5 py-2.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/40 text-emerald-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    title="Connecter Google Sheets pour sauvegarder la feuille de match"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    <span>Lier Google Sheets</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleValidateMatchSheet}
                  disabled={hasIneligiblePlayer || ((compFormat.numDoubles >= 2 || compFormat.doubleWeightStrict) && !doublesWeightCheck.isValid)}
                  className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-heading font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-lg ${
                    hasIneligiblePlayer || ((compFormat.numDoubles >= 2 || compFormat.doubleWeightStrict) && !doublesWeightCheck.isValid)
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                      : 'bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 hover:brightness-110 active:scale-95 text-white shadow-emerald-950/60'
                  }`}
                >
                  {hasIneligiblePlayer ? (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Validation bloquée (FFT)</span>
                    </>
                  ) : (compFormat.numDoubles >= 2 || compFormat.doubleWeightStrict) && !doublesWeightCheck.isValid ? (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Inverser les doubles (FFT)</span>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Enregistrer</span>
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

      {/* Modale de Confirmation Explicite pour l'Enregistrement */}
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
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
