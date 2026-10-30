import React, { useState, useMemo } from 'react';
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
  Sun
} from 'lucide-react';
import { Adherent, Rencontre, MatchComposition, FrozenPlayerSlot } from '../types/tennis';
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

interface CompositionModalProps {
  rencontre: Rencontre | null;
  adherents: Adherent[];
  allRencontres?: Rencontre[];
  isOpen: boolean;
  onClose: () => void;
  onSaveComposition: (rencontreId: string, composition: MatchComposition) => void;
  selectedSpreadsheetId?: string | null;
  spreadsheetName?: string;
  onOpenGoogleSyncModal?: () => void;
  saison?: string;
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
  adherents,
  allRencontres,
  isOpen,
  onClose,
  onSaveComposition,
  selectedSpreadsheetId,
  spreadsheetName = 'Données_appli',
  onOpenGoogleSyncModal,
  saison = '2027',
}) => {
  if (!isOpen || !rencontre) return null;

  // État local de la composition
  const [composition, setComposition] = useState<MatchComposition>(() => {
    return rencontre.composition || {
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

  const isHome = (rencontre.clubAccueilNom || '').toLowerCase().includes('muzillac');
  const adverseAddressInfo = useMemo(() => getAdverseClubFullAddress(rencontre), [rencontre]);

  // Logistique TCM (Validation Date, Heure, Courts, Lieu)
  const [matchDateInput, setMatchDateInput] = useState<string>(() => {
    return composition.dateRencontreValidee || rencontre.dateRencontre || '15/03/2026';
  });
  const [matchHourInput, setMatchHourInput] = useState<string>(() => {
    return composition.heureDebut || '14:00';
  });
  const [matchCourtsInput, setMatchCourtsInput] = useState<number>(() => {
    return composition.nombreCourts || 2;
  });
  const [matchVenueInput, setMatchVenueInput] = useState<string>(() => {
    if (composition.lieuRencontre) return composition.lieuRencontre;
    // Si à l'extérieur : le lieu est automatiquement le club adverse avec adresse colonnes AM à AO
    if (!isHome && adverseAddressInfo.hasAdverseAddress) {
      return adverseAddressInfo.venueLabel;
    }
    if (!isHome) {
      return `${rencontre.clubAccueilNom} (Installations adverses)`;
    }
    return 'Clos des Moines - 2 courts couverts résine (TCM)';
  });
  const [customVenueInput, setCustomVenueInput] = useState('');
  const [formatReduit, setFormatReduit] = useState<boolean>(() => {
    return !!composition.formatReduit;
  });

  // Slot en cours de sélection
  const [activeSlot, setActiveSlot] = useState<{
    key: SlotKey;
    label: string;
  } | null>(null);

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
🆚 Rencontre : ${rencontre.clubAccueilNom} vs ${rencontre.clubVisiteurNom}
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

  const renderSlotCard = (slotKey: SlotKey, label: string) => {
    const playerId = composition[slotKey];
    const player = playerId ? adherentsById.get(playerId) : null;
    const eligibility = player ? checkFFT2027Eligibility(player, rencontre) : null;
    const isSlotIneligible = eligibility && !eligibility.isEligible;

    return (
      <div 
        className={`p-3.5 rounded-2xl border transition-all ${
          isSlotIneligible 
            ? 'bg-rose-950/30 border-rose-500/60 shadow-lg shadow-rose-950/40' 
            : player 
              ? 'bg-[#1a1f29] border-[#2c3444]' 
              : 'bg-[#12151b] border-dashed border-[#282f3c] hover:border-[#E65100]/60'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-orange-400">
            {label}
          </span>
          {player && (
            <button
              onClick={() => handleClearSlot(slotKey)}
              className="text-zinc-500 hover:text-rose-400 text-xs px-1.5 py-0.5 rounded transition"
              title="Retirer le joueur"
            >
              Retirer
            </button>
          )}
        </div>

        {player ? (
          <div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-heading font-black text-white text-sm">
                  {player.nomPrenom}
                </p>
                <p className="text-[11px] text-zinc-400">
                  Licence : <span className="font-mono text-zinc-300">{player.licence}</span>
                </p>
              </div>

              <div className="text-right">
                <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-orange-500/15 border border-orange-500/30 text-orange-300">
                  {player.dernierClassTennis}
                </span>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  {player.ageSportif ? `${player.ageSportif} ans` : 'Senior'}
                </p>
              </div>
            </div>

            {/* Alerte si inéligible */}
            {isSlotIneligible && eligibility && (
              <div className="mt-2.5 p-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-[10px] text-rose-300 space-y-1">
                <p className="font-black flex items-center gap-1 text-rose-200">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  JOUEUR INÉLIGIBLE SUR CE MATCH :
                </p>
                {eligibility.errors.map((err, i) => (
                  <p key={i}>• {err}</p>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setActiveSlot({ key: slotKey, label })}
            className="w-full py-2.5 flex items-center justify-center gap-2 text-xs font-bold text-zinc-400 hover:text-white hover:bg-orange-600/10 rounded-xl transition cursor-pointer"
          >
            <UserCheck className="w-4 h-4 text-[#FF6D00]" />
            <span>Assigner un joueur éligible</span>
          </button>
        )}
      </div>
    );
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
        
        {/* ==================== EN-TÊTE MODALE ==================== */}
        <div className="p-5 sm:p-6 border-b border-[#252b37] bg-gradient-to-r from-[#1b202a] to-[#12151b] flex items-start justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#BF360C] to-[#E65100] flex items-center justify-center text-white shadow-lg shadow-orange-950/60 shrink-0">
              <Trophy className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#E65100]/25 text-[#FF6D00] border border-[#E65100]/40">
                  {rencontre.numeroEquipe}
                </span>
                <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${
                  reqSex === 'F' 
                    ? 'bg-pink-500/20 text-pink-300 border-pink-500/40' 
                    : reqSex === 'Mixte' 
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' 
                      : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                }`}>
                  {rencontre.categorieAgeHomologation} • {reqSex === 'F' ? 'Dames (F)' : reqSex === 'H' ? 'Messieurs (H)' : 'Mixte'}
                </span>
                <span className="text-xs text-orange-400 font-bold flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {scheduleCheck.dayName} {matchDateInput}
                </span>
              </div>

              <h2 className="text-lg sm:text-xl font-heading font-black text-white mt-1">
                Feuille de match & Composition d'équipe
              </h2>
              <p className="text-xs text-zinc-400">
                {rencontre.clubAccueilNom} <strong className="text-zinc-200">vs</strong> {rencontre.clubVisiteurNom} • {rencontre.libelleHomologation}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ==================== BANDEAU FORMAT OFFICIEL ==================== */}
        <div className="px-5 sm:px-6 py-2.5 bg-[#0d0f14] border-b border-[#232936] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2 text-zinc-300 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/40 font-black">
              {compFormat.numSingles} Simples + {compFormat.numDoubles} Double{compFormat.numDoubles > 1 ? 's' : ''}
            </span>
            <span className="font-bold text-white">{compFormat.categoryLabel}</span>
            <span className="text-zinc-500 hidden md:inline">• {compFormat.pointsSystem}</span>
          </div>

          {/* Toggle format réduit départemental (uniquement si 5 simples par défaut) */}
          {compFormat.numSingles >= 5 && (
            <div className="flex items-center space-x-2 shrink-0">
              <span className="text-[11px] text-zinc-400">Format :</span>
              <button
                onClick={() => setFormatReduit(!formatReduit)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                  formatReduit 
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' 
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'
                }`}
              >
                {formatReduit ? 'Format Réduit (3S + 1D)' : `Standard (${compFormat.numSingles}S + 1D)`}
              </button>
            </div>
          )}
        </div>

        {/* ==================== ALERTES & VALIDATIONS ==================== */}
        {/* Alerte si jour inhabituel ou alternance */}
        {scheduleCheck.warning && (
          <div className="mx-5 sm:mx-6 mt-3 p-3 rounded-2xl bg-amber-950/40 border border-amber-500/50 text-amber-200 text-xs flex items-start space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">{scheduleCheck.warning}</p>
              <p className="text-amber-300 text-[11px] mt-0.5">{scheduleCheck.alternationMessage}</p>
            </div>
          </div>
        )}

        {/* Alerte si infraction Poids des Doubles Régional FFT */}
        {compFormat.doubleWeightStrict && doublesWeightCheck.errorMessage && (
          <div className="mx-5 sm:mx-6 mt-3 p-3.5 rounded-2xl bg-rose-950/50 border border-rose-500/60 text-rose-200 text-xs flex items-start justify-between gap-3 shadow-lg shadow-rose-950/40">
            <div className="flex items-start space-x-2.5">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-heading font-black text-white text-xs">
                  INFRACTION FFT RÉGIONALE : POIDS DES DOUBLES
                </h4>
                <p className="text-rose-300 mt-1">
                  {doublesWeightCheck.errorMessage}
                </p>
              </div>
            </div>

            <button
              onClick={handleSwapDoubles}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 transition cursor-pointer shadow"
              title="Inverser automatiquement les deux paires de doubles"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Inverser D1 et D2</span>
            </button>
          </div>
        )}

        {/* Alerte bloquante si joueur inéligible */}
        {hasIneligiblePlayer && (
          <div className="mx-5 sm:mx-6 mt-3 p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/60 text-rose-200 text-xs flex items-start space-x-3 shadow-lg">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-heading font-black text-white text-xs">
                VALIDATION DE FEUILLE BLOQUÉE (Infraction FFT 2027)
              </h4>
              <ul className="mt-1 space-y-0.5 list-disc list-inside text-[11px] text-rose-200">
                {currentCompositionIssues.map((issue, idx) => (
                  <li key={idx}>
                    <strong className="text-white">{issue.player.nomPrenom}</strong> : {issue.errors.join(' | ')}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Alerte ordre des simples */}
        {!rankingOrderCheck.isValid && (
          <div className="mx-5 sm:mx-6 mt-3 p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/60 text-amber-200 text-xs flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-heading font-black text-white text-xs">
                HIÉRARCHIE DES CLASSEMENTS NON RESPECTÉE (Ordre des Simples FFT)
              </h4>
              <p className="text-amber-300 mt-0.5">{rankingOrderCheck.error}</p>
            </div>
          </div>
        )}

        {/* Messages toast succès */}
        {sheetSaveSuccess && (
          <div className="mx-5 sm:mx-6 mt-3 p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/50 text-emerald-200 text-xs flex items-center space-x-2 shadow-lg">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-bold">{sheetSaveSuccess}</span>
          </div>
        )}

        {validationSuccess && !sheetSaveSuccess && (
          <div className="mx-5 sm:mx-6 mt-3 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-200 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Feuille de match certifiée conforme et enregistrée avec succès !</span>
          </div>
        )}

        {/* Message d'alerte spécifique popup / toast */}
        {blockedAlertMessage && (
          <div className="mx-5 sm:mx-6 mt-3 p-3 rounded-xl bg-amber-950/40 border border-amber-500/50 text-amber-200 text-xs flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="whitespace-pre-line leading-relaxed">{blockedAlertMessage}</div>
            </div>
            <button onClick={() => setBlockedAlertMessage(null)} className="text-amber-400 hover:text-white font-bold px-1">✕</button>
          </div>
        )}

        {/* Rappel du Gel des Classements si des joueurs sont enregistrés */}
        {composition.frozenPlayers && composition.frozenPlayers.length > 0 && (
          <div className="mx-5 sm:mx-6 mt-3 p-3 rounded-2xl bg-orange-950/30 border border-orange-500/40 text-orange-200 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <Lock className="w-4 h-4 text-[#FF6D00] shrink-0" />
              <span>
                <strong>Classements officiellement gelés au match :</strong> {composition.frozenPlayers.map(p => `${p.nomPrenom} (${p.classementGele})`).join(' • ')}
              </span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-[#FF6D00] font-mono shrink-0">
              {composition.dateValidation || 'Données_appli'}
            </span>
          </div>
        )}

        {/* ==================== CORPS MODALE (LOGISTIQUE + GRILLES) ==================== */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          
          {/* ==================== SECTION LOGISTIQUE DU MATCH (DEMANDE TCM) ==================== */}
          <div className="p-4 sm:p-5 rounded-3xl bg-[#090b0e] border border-[#232934] space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e2430] pb-3">
              <div className="flex items-center space-x-2">
                <SlidersHorizontal className="w-4 h-4 text-[#FF6D00]" />
                <h3 className="font-heading font-black text-white text-sm">
                  Planification & Logistique TCM
                </h3>
              </div>
              <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                <Sun className="w-3 h-3 text-amber-400" />
                <span>{scheduleCheck.alternationMessage}</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              
              {/* 1. Date de la rencontre validée */}
              <div className="p-3 rounded-2xl bg-[#141820] border border-[#232934] space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                  <span>1. Date validée</span>
                  <span className={`px-1.5 py-0.2 rounded font-black ${
                    scheduleCheck.isSunday ? 'bg-emerald-500/20 text-emerald-400' :
                    scheduleCheck.isSaturday ? 'bg-sky-500/20 text-sky-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {scheduleCheck.dayName}
                  </span>
                </label>
                <div className="flex items-center space-x-1.5">
                  <Calendar className="w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    value={matchDateInput}
                    onChange={(e) => setMatchDateInput(e.target.value)}
                    placeholder="JJ/MM/AAAA"
                    className="w-full bg-black/40 border border-[#2a323f] rounded-xl px-2.5 py-1 text-xs text-white font-mono focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <p className="text-[10px] text-zinc-500">
                  {compFormat.expectedDay === 'Dimanche' ? 'Normalement le dimanche pour Seniors' : 'Normalement le samedi pour Jeunes'}
                </p>
              </div>

              {/* 2. Heure de démarrage (9h ou 14h) */}
              <div className="p-3 rounded-2xl bg-[#141820] border border-[#232934] space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-orange-400" />
                  <span>2. Heure de démarrage</span>
                </label>
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => setMatchHourInput('09:00')}
                    className={`flex-1 py-1 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      matchHourInput === '09:00'
                        ? 'bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white shadow'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    9h00 (Matin)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatchHourInput('14:00')}
                    className={`flex-1 py-1 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      matchHourInput === '14:00'
                        ? 'bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white shadow'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    14h00 (AM)
                  </button>
                </div>
                {matchHourInput !== '09:00' && matchHourInput !== '14:00' && (
                  <input
                    type="text"
                    value={matchHourInput}
                    onChange={(e) => setMatchHourInput(e.target.value)}
                    placeholder="Horaire libre (ex: 10h00)"
                    className="w-full bg-black/40 border border-[#2a323f] rounded-xl px-2 py-0.5 text-xs text-white font-mono mt-1"
                  />
                )}
              </div>

              {/* 3. Nombre de courts disponibles */}
              <div className="p-3 rounded-2xl bg-[#141820] border border-[#232934] space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-sky-400" />
                  <span>3. Courts disponibles</span>
                </label>
                <div className="flex items-center space-x-1">
                  {[1, 2, 3].map(cnt => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setMatchCourtsInput(cnt)}
                      className={`flex-1 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                        matchCourtsInput === cnt
                          ? 'bg-sky-600 text-white shadow'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                      }`}
                    >
                      {cnt} {cnt > 1 ? 'courts' : 'court'}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-500">
                  {matchCourtsInput === 2 ? 'Standard TCM (2 courts couverts résine)' : `${matchCourtsInput} court(s) alloué(s)`}
                </p>
              </div>

              {/* 4. Lieu de la rencontre (Clos des Moines / TC Nivillac) */}
              <div className="p-3 rounded-2xl bg-[#141820] border border-[#232934] space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span>4. Lieu du match</span>
                </label>
                <select
                  value={matchVenueInput}
                  onChange={(e) => setMatchVenueInput(e.target.value)}
                  className="w-full bg-black/50 border border-[#2a323f] rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none focus:border-orange-500"
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
                    onChange={(e) => setCustomVenueInput(e.target.value)}
                    placeholder="Nom ou adresse de la salle..."
                    className="w-full bg-black/40 border border-[#2a323f] rounded-xl px-2 py-0.5 text-xs text-white mt-1"
                  />
                )}
                
                {matchVenueInput.includes('Nivillac') && (
                  <p className="text-[10px] text-amber-300 font-semibold flex items-center gap-1">
                    <Building className="w-3 h-3 text-amber-400" />
                    <span>Salle de Nivillac réservée pour délester le Clos des Moines.</span>
                  </p>
                )}

                {!isHome && adverseAddressInfo.hasAdverseAddress && (
                  <p className="text-[10px] text-sky-300 font-semibold flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-sky-400 shrink-0" />
                    <span className="truncate">Adresse adverse (cols AM-AO) : {adverseAddressInfo.venueLabel}</span>
                  </p>
                )}
              </div>

            </div>

            {/* ==================== CRÉNEAUX & ORDRE DE PASSAGE DES MATCHS ==================== */}
            <div className="pt-3 border-t border-[#1e2430] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-orange-400" />
                  <span>Ordre de passage & Créneaux par match ({matchCourtsInput} court{matchCourtsInput > 1 ? 's' : ''} à partir de {matchHourInput})</span>
                </span>
                <span className="text-[10px] text-zinc-400">
                  Rotations de {schedulePlan.dureeMoyenneMatchMin} min
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {schedulePlan.rotations.map((rot) => (
                  <div 
                    key={rot.rotationNumber}
                    className="p-3 rounded-2xl bg-[#141820] border border-zinc-800 space-y-2 shadow-sm"
                  >
                    <div className="flex items-center justify-between text-xs pb-1.5 border-b border-zinc-800/80">
                      <span className="font-heading font-black text-orange-400">
                        Rotation {rot.rotationNumber}
                      </span>
                      <span className="font-mono font-black text-white px-2 py-0.5 rounded-lg bg-black/60 border border-zinc-700">
                        {rot.timeSlot}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {rot.matches.map((m) => (
                        <div 
                          key={m.id}
                          className="p-2 rounded-xl bg-black/30 border border-zinc-800/60 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-bold text-white block truncate">
                              {m.matchLabel}
                            </span>
                            <span className="text-[10px] text-zinc-500 block truncate">
                              {m.courtName}
                            </span>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-xs font-medium text-zinc-200 block truncate max-w-[110px]">
                              {m.playerName}
                            </span>
                            <span className="text-[10px] font-mono text-orange-300 font-bold">
                              {m.playerRank}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ==================== SECTION 1 : SIMPLES (DYNAMIQUES SELON FORMAT) ==================== */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading font-black text-white text-sm flex items-center gap-2">
                <span>Composition des Simples ({compFormat.numSingles} requis)</span>
                <span className="text-xs text-zinc-400 font-sans font-normal">
                  (Ordre strictement décroissant des classements FFT)
                </span>
              </h3>

              {teamStrength.count > 0 && (
                <span className="text-xs text-zinc-400">
                  {teamStrength.count}/{compFormat.numSingles} simples désignés • Classements : <strong className="text-orange-400">{teamStrength.ranks.join(', ')}</strong>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {renderSlotCard('simple1Id', 'Simple N°1 (Leader)')}
              {renderSlotCard('simple2Id', 'Simple N°2')}
              {compFormat.numSingles >= 3 && renderSlotCard('simple3Id', 'Simple N°3')}
              {compFormat.numSingles >= 4 && renderSlotCard('simple4Id', 'Simple N°4')}
              {compFormat.numSingles >= 5 && renderSlotCard('simple5Id', 'Simple N°5 (Départemental H)')}
            </div>
          </div>

          {/* ==================== SECTION 2 : DOUBLES (DYNAMIQUES SELON FORMAT) ==================== */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-heading font-black text-white text-sm flex items-center gap-2">
                  <span>Composition {compFormat.numDoubles === 1 ? 'du Double' : 'des Doubles (2 équipes)'}</span>
                  {compFormat.doubleWeightStrict && (
                    <span className="text-xs text-orange-400 font-bold">
                      • Règle Poids Double 1 ≥ Double 2
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-zinc-400">
                  {compFormat.doubleRules}
                </p>
              </div>

              {compFormat.doubleWeightStrict && doublesWeightCheck.isComplete && (
                <div className="flex items-center space-x-2">
                  <span className={`px-2.5 py-1 rounded-xl text-xs font-black border flex items-center gap-1.5 ${
                    doublesWeightCheck.isValid 
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  }`}>
                    {doublesWeightCheck.isValid ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
                    <span>D1 ({doublesWeightCheck.weightDouble1} pts) {doublesWeightCheck.isValid ? '≥' : '<'} D2 ({doublesWeightCheck.weightDouble2} pts)</span>
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {/* Double 1 */}
              <div className="p-3.5 rounded-2xl bg-[#090b0e] border border-[#232934] space-y-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-orange-400">
                  Paire Double 1 {compFormat.doubleWeightStrict ? '(Doit être la plus forte)' : ''}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {renderSlotCard('double1Player1Id', 'Double 1 - Joueur A')}
                  {renderSlotCard('double1Player2Id', 'Double 1 - Joueur B')}
                </div>
              </div>

              {/* Double 2 (si Championnat Régional) */}
              {compFormat.numDoubles >= 2 && (
                <div className="p-3.5 rounded-2xl bg-[#090b0e] border border-[#232934] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-orange-400">
                      Paire Double 2 (Poids inférieur ou égal au Double 1)
                    </span>
                    <button
                      onClick={handleSwapDoubles}
                      type="button"
                      className="text-xs text-orange-400 hover:text-white flex items-center gap-1 font-bold cursor-pointer"
                    >
                      <ArrowUpDown className="w-3 h-3" />
                      <span>Inverser D1 et D2</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {renderSlotCard('double2Player1Id', 'Double 2 - Joueur A')}
                    {renderSlotCard('double2Player2Id', 'Double 2 - Joueur B')}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ==================== TIROIR DE SÉLECTION D'UN JOUEUR ==================== */}
          {activeSlot && (
            <div className="p-5 rounded-3xl bg-[#101319] border-2 border-[#E65100]/60 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#232936] pb-3">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E65100]"></span>
                  <h4 className="font-heading font-black text-white text-sm">
                    Sélectionner un joueur pour : <span className="text-[#FF6D00]">{activeSlot.label}</span>
                  </h4>
                </div>
                
                <div className="flex items-center space-x-2">
                  <label className="text-xs text-zinc-400 flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterEligibleOnly}
                      onChange={(e) => setFilterEligibleOnly(e.target.checked)}
                      className="rounded accent-orange-500"
                    />
                    <span>Uniquement éligibles FFT</span>
                  </label>
                  <button
                    onClick={() => setActiveSlot(null)}
                    className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Rappel du barème pour cette sélection */}
              <div className="p-3 rounded-xl bg-[#171b24] border border-[#262c3b] text-xs text-zinc-300 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <span className="text-zinc-500 block text-[10px]">1. Règle Licence :</span>
                  <span className="font-bold text-white">Statut 'C' ou 'W' exigé</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px]">2. Règle Sexe :</span>
                  <span className="font-bold text-orange-400">{reqSex === 'H' ? 'Messieurs (H)' : reqSex === 'F' ? 'Dames (F)' : 'Mixte'}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px]">3. Règle Classement :</span>
                  <span className="font-bold text-emerald-400">Classement non ND</span>
                </div>
              </div>

              {/* Grille des adhérents avec statut */}
              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                {playersWithEligibility
                  .filter(item => !filterEligibleOnly || item.eligibility.isEligible)
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

          {/* ==================== CERTIFICATION DU CAPITAINE ==================== */}
          <div className="p-4 rounded-2xl bg-[#161a22] border border-[#252b37] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-orange-500/15 text-orange-400 flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-zinc-400">Capitaine référent :</p>
                <p className="font-heading font-black text-white text-sm">
                  {rencontre.nomCapitaine || 'Laurent Le Guennec'}
                </p>
              </div>
            </div>

            {composition.valideParCapitaine ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold self-start sm:self-auto">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Validée et certifiée FFT le {composition.dateValidation}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold self-start sm:self-auto">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Feuille de match en cours de composition
              </span>
            )}
          </div>

        </div>

        {/* ==================== PIED DE PAGE ET ACTIONS ==================== */}
        <div className="p-4 sm:p-5 border-t border-[#252b37] bg-[#11141a] flex flex-col sm:flex-row items-center justify-between gap-3">
          
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
};
