import { MatchComposition, MatchSlotSchedule, Adherent, Rencontre } from '../types/tennis';
import { CompetitionFormatInfo } from './competitionFormats';

/**
 * Ajoute un nombre de minutes à une heure sous format "HH:MM"
 */
export function addMinutesToTime(timeStr: string, minutesToAdd: number): string {
  const parts = (timeStr || '14:00').split(':');
  let h = parseInt(parts[0], 10) || 14;
  let m = parseInt(parts[1], 10) || 0;

  const totalMin = h * 60 + m + minutesToAdd;
  const newH = Math.floor(totalMin / 60) % 24;
  const newM = totalMin % 60;

  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

export interface MatchRotationSlot {
  id: string;
  rotationNumber: number;
  timeSlot: string;
  courtNumber: number;
  courtName: string;
  surfaceType?: 'A' | 'B';
  matchType: 'simple' | 'double';
  slotNumber: number;
  matchLabel: string; // Ex: "Simple n°3", "Double n°1"
  orderDescription: string;
  playerName?: string;
  playerRank?: string;
}

export interface DoubleFatigueRisk {
  hasRisk: boolean;
  playerName?: string;
  slotLabel?: string;
  message?: string;
}

export interface SchedulingOptions {
  surfacesDifferentes?: boolean;
  surfaceANom?: string; // default: 'Court A (Résine dédié tennis)'
  surfaceBNom?: string; // default: 'Court B (Salle omnisport)'
  assignationSurfaces?: Record<string, 'A' | 'B'>; // ex: { s4: 'A', s2: 'A', s3: 'B', s1: 'B' }
  ordrePartiesOption?: 'desaccord_officiel' | 'visiteur_propose';
}

export interface MatchSchedulePlan {
  heureDebut: string;
  nombreCourts: number;
  dureeMoyenneMatchMin: number;
  deroulementASuivre: boolean;
  regleJeudi20hRappel: string;
  ordreOfficielApplique: string;
  fatigueRisk?: DoubleFatigueRisk;
  surfacesDifferentesActif: boolean;
  slots: MatchRotationSlot[];
  rotations: {
    rotationNumber: number;
    timeSlot: string;
    description: string;
    matches: MatchRotationSlot[];
  }[];
}

/**
 * Calcule l'ordonnancement officiel des matchs par rotation et par court
 * 
 * RÈGLES OFFICIELLES (Morbihan / Bretagne) :
 * 1. Déroulement à suivre à partir de 09H ou 14H (plus de convocation horaire stricte match par match).
 * 2. L'ordre des parties est proposé par le capitaine qui se déplace avant le jeudi 20H00 précédant la rencontre.
 * 3. En cas de désaccord entre les deux capitaines, l'ordre officiel suivant est impérativement appliqué :
 *    - Équipes féminines & masculines de Pré-Régional : 
 *        • Sur 2 courts : 4-2, 3-1, doubles
 *        • Sur 1 court : 4-2, Double 2, 3-1, Double 1 (2 simples / 1 double / 2 simples / 1 double)
 *    - Équipes masculines de D1 / D2 / D3 :
 *        • Ordre : 4-3-2-1-5 - double
 *        • Sur 2 courts : Le double se joue en même temps que le dernier simple programmé
 *    - Équipes féminines de D2 et D3 :
 *        • Ordre : 1-2-3 - double (sur 2 courts : Simple 3 & Double en même temps)
 * 4. Gestion de la fatigue : Les joueurs prévus en double ne sont pas mis en dernière rencontre de simple dans la mesure du possible.
 * 5. Cas particulier de 2 terrains de nature différente (ex: 1 résine dédié tennis + 1 salle omnisport) :
 *    Le capitaine qui reçoit propose au capitaine qui se déplace de choisir le terrain pour chacun des simples.
 */
export function computeMatchRotationSchedule(
  heureDebut: string = '14:00',
  nombreCourts: number = 2,
  formatInfo: CompetitionFormatInfo,
  composition?: MatchComposition,
  adherentsById?: Map<string, Adherent>,
  options?: SchedulingOptions
): MatchSchedulePlan {
  const courts = Math.max(1, Math.min(3, nombreCourts || 2));
  const start = heureDebut && heureDebut.includes(':') ? heureDebut : '14:00';
  const durationMin = 90; // Durée moyenne indicative de 1h30 (rencontres à suivre)

  const numSingles = formatInfo.numSingles;
  const numDoubles = formatInfo.numDoubles;

  const isPreRegionale = 
    formatInfo.divisionLabel.toLowerCase().includes('pré-rég') || 
    formatInfo.categoryLabel.toLowerCase().includes('pré-rég') ||
    formatInfo.type === 'seniors_regional';

  const isMasculinDept = formatInfo.type === 'seniors_dept_hommes';
  const isFemininDept = formatInfo.type === 'seniors_dept_dames';

  const surfacesDifferentes = !!options?.surfacesDifferentes || !!composition?.surfacesDifferentes;
  const surfaceAName = options?.surfaceANom || composition?.surfaceANom || 'Court A (Résine dédié tennis)';
  const surfaceBName = options?.surfaceBNom || composition?.surfaceBNom || 'Court B (Salle omnisport)';
  const surfaceAssignments = options?.assignationSurfaces || composition?.assignationSurfaces || {};

  const getCourtName = (courtNum: number, matchKey?: string): { name: string; surface?: 'A' | 'B' } => {
    if (surfacesDifferentes && courts >= 2) {
      if (matchKey && surfaceAssignments[matchKey]) {
        const assigned = surfaceAssignments[matchKey];
        return {
          name: assigned === 'A' ? surfaceAName : surfaceBName,
          surface: assigned
        };
      }
      return {
        name: courtNum === 1 ? surfaceAName : surfaceBName,
        surface: courtNum === 1 ? 'A' : 'B'
      };
    }

    if (courts === 1) {
      return { name: 'Court unique' };
    }
    return { name: `Court n°${courtNum} (Résine)` };
  };

  const getPlayerLabel = (playerId?: string): { name: string; rank: string } => {
    if (!playerId || !adherentsById) return { name: 'À désigner', rank: '-' };
    const p = adherentsById.get(playerId);
    return p ? { name: p.nomPrenom, rank: p.dernierClassTennis } : { name: 'À désigner', rank: '-' };
  };

  const getDoubleLabel = (p1Id?: string, p2Id?: string): { name: string; rank: string } => {
    if (!adherentsById) return { name: 'À désigner', rank: '-' };
    const p1 = p1Id ? adherentsById.get(p1Id) : null;
    const p2 = p2Id ? adherentsById.get(p2Id) : null;
    if (!p1 && !p2) return { name: 'À désigner', rank: '-' };
    const name = `${p1?.nomPrenom || '?'} & ${p2?.nomPrenom || '?'}`;
    const rank = `[${p1?.dernierClassTennis || '-'} / ${p2?.dernierClassTennis || '-'}]`;
    return { name, rank };
  };

  const slots: MatchRotationSlot[] = [];
  let ordreAppliqueTexte = '';

  // ==================== CONFIGURATION 2 COURTS ====================
  if (courts === 2) {
    if (isPreRegionale) {
      // PRE-REGIONALE (Féminine & Masculine) : Ordre en cas de désaccord = 4-2, 3-1, doubles
      ordreAppliqueTexte = 'Ordre officiel Pré-Régional (Désaccord capitaines) : 4-2, 3-1, puis doubles sur 2 courts';

      // Rotation 1 (14h00) : Simple 4 & Simple 2
      const c1R1 = getCourtName(1, 's4');
      const c2R1 = getCourtName(2, 's2');
      const p4 = getPlayerLabel(composition?.simple4Id);
      const p2 = getPlayerLabel(composition?.simple2Id);
      slots.push({
        id: 's4',
        rotationNumber: 1,
        timeSlot: start,
        courtNumber: 1,
        courtName: c1R1.name,
        surfaceType: c1R1.surface,
        matchType: 'simple',
        slotNumber: 4,
        matchLabel: 'Simple n°4',
        orderDescription: 'Lancement de la rencontre (Simples 4 & 2)',
        playerName: p4.name,
        playerRank: p4.rank,
      });
      slots.push({
        id: 's2',
        rotationNumber: 1,
        timeSlot: start,
        courtNumber: 2,
        courtName: c2R1.name,
        surfaceType: c2R1.surface,
        matchType: 'simple',
        slotNumber: 2,
        matchLabel: 'Simple n°2',
        orderDescription: 'Lancement de la rencontre (Simples 4 & 2)',
        playerName: p2.name,
        playerRank: p2.rank,
      });

      // Rotation 2 (15h30) : Simple 3 & Simple 1
      const timeR2 = addMinutesToTime(start, durationMin);
      const c1R2 = getCourtName(1, 's3');
      const c2R2 = getCourtName(2, 's1');
      const p3 = getPlayerLabel(composition?.simple3Id);
      const p1 = getPlayerLabel(composition?.simple1Id);
      slots.push({
        id: 's3',
        rotationNumber: 2,
        timeSlot: timeR2,
        courtNumber: 1,
        courtName: c1R2.name,
        surfaceType: c1R2.surface,
        matchType: 'simple',
        slotNumber: 3,
        matchLabel: 'Simple n°3',
        orderDescription: 'Deuxième rotation (Simples 3 & 1)',
        playerName: p3.name,
        playerRank: p3.rank,
      });
      slots.push({
        id: 's1',
        rotationNumber: 2,
        timeSlot: timeR2,
        courtNumber: 2,
        courtName: c2R2.name,
        surfaceType: c2R2.surface,
        matchType: 'simple',
        slotNumber: 1,
        matchLabel: 'Simple n°1',
        orderDescription: 'Deuxième rotation (Simples 3 & 1)',
        playerName: p1.name,
        playerRank: p1.rank,
      });

      // Rotation 3 (17h00) : Double 1 & Double 2
      const timeR3 = addMinutesToTime(start, durationMin * 2);
      const d1 = getDoubleLabel(composition?.double1Player1Id, composition?.double1Player2Id);
      const d2 = getDoubleLabel(composition?.double2Player1Id, composition?.double2Player2Id);
      slots.push({
        id: 'd1',
        rotationNumber: 3,
        timeSlot: timeR3,
        courtNumber: 1,
        courtName: getCourtName(1).name,
        matchType: 'double',
        slotNumber: 1,
        matchLabel: 'Double n°1',
        orderDescription: 'Double 1 (Poids D1 >= D2)',
        playerName: d1.name,
        playerRank: d1.rank,
      });
      slots.push({
        id: 'd2',
        rotationNumber: 3,
        timeSlot: timeR3,
        courtNumber: 2,
        courtName: getCourtName(2).name,
        matchType: 'double',
        slotNumber: 2,
        matchLabel: 'Double n°2',
        orderDescription: 'Double 2',
        playerName: d2.name,
        playerRank: d2.rank,
      });

    } else if (isMasculinDept) {
      // MASCULIN D1 / D2 / D3 : Ordre officiel = 4-3-2-1-5 - double
      // Sur deux courts : le double se joue en même temps que le dernier simple programmé
      if (numSingles >= 5) {
        ordreAppliqueTexte = 'Ordre officiel Hommes D2/D3 : 4-3, 2-1, puis 5 et Double en simultané sur 2 courts';

        // Rotation 1 (14h00) : Simple 4 & Simple 3
        const c1R1 = getCourtName(1, 's4');
        const c2R1 = getCourtName(2, 's3');
        const p4 = getPlayerLabel(composition?.simple4Id);
        const p3 = getPlayerLabel(composition?.simple3Id);
        slots.push({
          id: 's4',
          rotationNumber: 1,
          timeSlot: start,
          courtNumber: 1,
          courtName: c1R1.name,
          surfaceType: c1R1.surface,
          matchType: 'simple',
          slotNumber: 4,
          matchLabel: 'Simple n°4',
          orderDescription: 'Simples 4 & 3 en simultané',
          playerName: p4.name,
          playerRank: p4.rank,
        });
        slots.push({
          id: 's3',
          rotationNumber: 1,
          timeSlot: start,
          courtNumber: 2,
          courtName: c2R1.name,
          surfaceType: c2R1.surface,
          matchType: 'simple',
          slotNumber: 3,
          matchLabel: 'Simple n°3',
          orderDescription: 'Simples 4 & 3 en simultané',
          playerName: p3.name,
          playerRank: p3.rank,
        });

        // Rotation 2 (15h30) : Simple 2 & Simple 1
        const timeR2 = addMinutesToTime(start, durationMin);
        const c1R2 = getCourtName(1, 's2');
        const c2R2 = getCourtName(2, 's1');
        const p2 = getPlayerLabel(composition?.simple2Id);
        const p1 = getPlayerLabel(composition?.simple1Id);
        slots.push({
          id: 's2',
          rotationNumber: 2,
          timeSlot: timeR2,
          courtNumber: 1,
          courtName: c1R2.name,
          surfaceType: c1R2.surface,
          matchType: 'simple',
          slotNumber: 2,
          matchLabel: 'Simple n°2',
          orderDescription: 'Simples 2 & 1 en simultané',
          playerName: p2.name,
          playerRank: p2.rank,
        });
        slots.push({
          id: 's1',
          rotationNumber: 2,
          timeSlot: timeR2,
          courtNumber: 2,
          courtName: c2R2.name,
          surfaceType: c2R2.surface,
          matchType: 'simple',
          slotNumber: 1,
          matchLabel: 'Simple n°1',
          orderDescription: 'Simples 2 & 1 en simultané',
          playerName: p1.name,
          playerRank: p1.rank,
        });

        // Rotation 3 (17h00) : Simple 5 & Double 1 en simultané sur 2 courts !
        const timeR3 = addMinutesToTime(start, durationMin * 2);
        const p5 = getPlayerLabel(composition?.simple5Id);
        const d1 = getDoubleLabel(composition?.double1Player1Id, composition?.double1Player2Id);
        slots.push({
          id: 's5',
          rotationNumber: 3,
          timeSlot: timeR3,
          courtNumber: 1,
          courtName: getCourtName(1, 's5').name,
          surfaceType: getCourtName(1, 's5').surface,
          matchType: 'simple',
          slotNumber: 5,
          matchLabel: 'Simple n°5',
          orderDescription: 'Dernier simple (en parallèle du double)',
          playerName: p5.name,
          playerRank: p5.rank,
        });
        slots.push({
          id: 'd1',
          rotationNumber: 3,
          timeSlot: timeR3,
          courtNumber: 2,
          courtName: getCourtName(2).name,
          matchType: 'double',
          slotNumber: 1,
          matchLabel: 'Double n°1',
          orderDescription: 'Double décisif (en parallèle du Simple 5)',
          playerName: d1.name,
          playerRank: d1.rank,
        });

      } else if (numSingles === 4 && numDoubles === 2) {
        // D1 Messieurs 2027 : 4 simples + 2 doubles
        ordreAppliqueTexte = 'Ordre officiel Hommes D1 (2027) : 4-3, 2-1, puis Doubles 1 & 2';

        const c1R1 = getCourtName(1, 's4');
        const c2R1 = getCourtName(2, 's3');
        const p4 = getPlayerLabel(composition?.simple4Id);
        const p3 = getPlayerLabel(composition?.simple3Id);
        slots.push({
          id: 's4',
          rotationNumber: 1,
          timeSlot: start,
          courtNumber: 1,
          courtName: c1R1.name,
          surfaceType: c1R1.surface,
          matchType: 'simple',
          slotNumber: 4,
          matchLabel: 'Simple n°4',
          orderDescription: 'Simples 4 & 3 en simultané',
          playerName: p4.name,
          playerRank: p4.rank,
        });
        slots.push({
          id: 's3',
          rotationNumber: 1,
          timeSlot: start,
          courtNumber: 2,
          courtName: c2R1.name,
          surfaceType: c2R1.surface,
          matchType: 'simple',
          slotNumber: 3,
          matchLabel: 'Simple n°3',
          orderDescription: 'Simples 4 & 3 en simultané',
          playerName: p3.name,
          playerRank: p3.rank,
        });

        const timeR2 = addMinutesToTime(start, durationMin);
        const c1R2 = getCourtName(1, 's2');
        const c2R2 = getCourtName(2, 's1');
        const p2 = getPlayerLabel(composition?.simple2Id);
        const p1 = getPlayerLabel(composition?.simple1Id);
        slots.push({
          id: 's2',
          rotationNumber: 2,
          timeSlot: timeR2,
          courtNumber: 1,
          courtName: c1R2.name,
          surfaceType: c1R2.surface,
          matchType: 'simple',
          slotNumber: 2,
          matchLabel: 'Simple n°2',
          orderDescription: 'Simples 2 & 1 en simultané',
          playerName: p2.name,
          playerRank: p2.rank,
        });
        slots.push({
          id: 's1',
          rotationNumber: 2,
          timeSlot: timeR2,
          courtNumber: 2,
          courtName: c2R2.name,
          surfaceType: c2R2.surface,
          matchType: 'simple',
          slotNumber: 1,
          matchLabel: 'Simple n°1',
          orderDescription: 'Simples 2 & 1 en simultané',
          playerName: p1.name,
          playerRank: p1.rank,
        });

        const timeR3 = addMinutesToTime(start, durationMin * 2);
        const d1 = getDoubleLabel(composition?.double1Player1Id, composition?.double1Player2Id);
        const d2 = getDoubleLabel(composition?.double2Player1Id, composition?.double2Player2Id);
        slots.push({
          id: 'd1',
          rotationNumber: 3,
          timeSlot: timeR3,
          courtNumber: 1,
          courtName: getCourtName(1).name,
          matchType: 'double',
          slotNumber: 1,
          matchLabel: 'Double n°1',
          orderDescription: 'Double 1 (Poids D1 >= D2)',
          playerName: d1.name,
          playerRank: d1.rank,
        });
        slots.push({
          id: 'd2',
          rotationNumber: 3,
          timeSlot: timeR3,
          courtNumber: 2,
          courtName: getCourtName(2).name,
          matchType: 'double',
          slotNumber: 2,
          matchLabel: 'Double n°2',
          orderDescription: 'Double 2',
          playerName: d2.name,
          playerRank: d2.rank,
        });

      } else {
        // Format réduit Hommes (3 simples + 1 double)
        ordreAppliqueTexte = 'Ordre Hommes format réduit : 3-2, puis 1 et Double en simultané';
        const p3 = getPlayerLabel(composition?.simple3Id);
        const p2 = getPlayerLabel(composition?.simple2Id);
        slots.push({
          id: 's3',
          rotationNumber: 1,
          timeSlot: start,
          courtNumber: 1,
          courtName: getCourtName(1, 's3').name,
          matchType: 'simple',
          slotNumber: 3,
          matchLabel: 'Simple n°3',
          orderDescription: 'Simples 3 & 2 en simultané',
          playerName: p3.name,
          playerRank: p3.rank,
        });
        slots.push({
          id: 's2',
          rotationNumber: 1,
          timeSlot: start,
          courtNumber: 2,
          courtName: getCourtName(2, 's2').name,
          matchType: 'simple',
          slotNumber: 2,
          matchLabel: 'Simple n°2',
          orderDescription: 'Simples 3 & 2 en simultané',
          playerName: p2.name,
          playerRank: p2.rank,
        });

        const timeR2 = addMinutesToTime(start, durationMin);
        const p1 = getPlayerLabel(composition?.simple1Id);
        const d1 = getDoubleLabel(composition?.double1Player1Id, composition?.double1Player2Id);
        slots.push({
          id: 's1',
          rotationNumber: 2,
          timeSlot: timeR2,
          courtNumber: 1,
          courtName: getCourtName(1, 's1').name,
          matchType: 'simple',
          slotNumber: 1,
          matchLabel: 'Simple n°1',
          orderDescription: 'Simple 1 (en parallèle du Double)',
          playerName: p1.name,
          playerRank: p1.rank,
        });
        slots.push({
          id: 'd1',
          rotationNumber: 2,
          timeSlot: timeR2,
          courtNumber: 2,
          courtName: getCourtName(2).name,
          matchType: 'double',
          slotNumber: 1,
          matchLabel: 'Double n°1',
          orderDescription: 'Double (en parallèle du Simple 1)',
          playerName: d1.name,
          playerRank: d1.rank,
        });
      }

    } else if (isFemininDept && numSingles === 3) {
      // FEMININ D2 et D3 : Ordre officiel = 1-2-3 - double
      // Sur deux courts : Simple 3 & Double 1 en parallèle lors de la 2e rotation !
      ordreAppliqueTexte = 'Ordre officiel Dames D2/D3 : 1-2 en simultané, puis 3 et Double en simultané sur 2 courts';

      // Rotation 1 (14h00) : Simple 1 & Simple 2
      const c1R1 = getCourtName(1, 's1');
      const c2R1 = getCourtName(2, 's2');
      const p1 = getPlayerLabel(composition?.simple1Id);
      const p2 = getPlayerLabel(composition?.simple2Id);
      slots.push({
        id: 's1',
        rotationNumber: 1,
        timeSlot: start,
        courtNumber: 1,
        courtName: c1R1.name,
        surfaceType: c1R1.surface,
        matchType: 'simple',
        slotNumber: 1,
        matchLabel: 'Simple n°1',
        orderDescription: 'Match des numéros 1',
        playerName: p1.name,
        playerRank: p1.rank,
      });
      slots.push({
        id: 's2',
        rotationNumber: 1,
        timeSlot: start,
        courtNumber: 2,
        courtName: c2R1.name,
        surfaceType: c2R1.surface,
        matchType: 'simple',
        slotNumber: 2,
        matchLabel: 'Simple n°2',
        orderDescription: 'Match des numéros 2',
        playerName: p2.name,
        playerRank: p2.rank,
      });

      // Rotation 2 (15h30) : Simple 3 & Double 1 en simultané
      const timeR2 = addMinutesToTime(start, durationMin);
      const c1R2 = getCourtName(1, 's3');
      const p3 = getPlayerLabel(composition?.simple3Id);
      const d1 = getDoubleLabel(composition?.double1Player1Id, composition?.double1Player2Id);
      slots.push({
        id: 's3',
        rotationNumber: 2,
        timeSlot: timeR2,
        courtNumber: 1,
        courtName: c1R2.name,
        surfaceType: c1R2.surface,
        matchType: 'simple',
        slotNumber: 3,
        matchLabel: 'Simple n°3',
        orderDescription: 'Dernier simple (en parallèle du double)',
        playerName: p3.name,
        playerRank: p3.rank,
      });
      slots.push({
        id: 'd1',
        rotationNumber: 2,
        timeSlot: timeR2,
        courtNumber: 2,
        courtName: getCourtName(2).name,
        matchType: 'double',
        slotNumber: 1,
        matchLabel: 'Double n°1',
        orderDescription: 'Double décisif (en parallèle du Simple 3)',
        playerName: d1.name,
        playerRank: d1.rank,
      });

    } else if (isFemininDept && numSingles === 4) {
      // D1 Féminine : 4 simples + 1 double
      ordreAppliqueTexte = 'Ordre officiel Dames D1 : 4-2, 3-1, puis Double';
      const p4 = getPlayerLabel(composition?.simple4Id);
      const p2 = getPlayerLabel(composition?.simple2Id);
      slots.push({
        id: 's4',
        rotationNumber: 1,
        timeSlot: start,
        courtNumber: 1,
        courtName: getCourtName(1, 's4').name,
        matchType: 'simple',
        slotNumber: 4,
        matchLabel: 'Simple n°4',
        orderDescription: 'Simples 4 & 2 en simultané',
        playerName: p4.name,
        playerRank: p4.rank,
      });
      slots.push({
        id: 's2',
        rotationNumber: 1,
        timeSlot: start,
        courtNumber: 2,
        courtName: getCourtName(2, 's2').name,
        matchType: 'simple',
        slotNumber: 2,
        matchLabel: 'Simple n°2',
        orderDescription: 'Simples 4 & 2 en simultané',
        playerName: p2.name,
        playerRank: p2.rank,
      });

      const timeR2 = addMinutesToTime(start, durationMin);
      const p3 = getPlayerLabel(composition?.simple3Id);
      const p1 = getPlayerLabel(composition?.simple1Id);
      slots.push({
        id: 's3',
        rotationNumber: 2,
        timeSlot: timeR2,
        courtNumber: 1,
        courtName: getCourtName(1, 's3').name,
        matchType: 'simple',
        slotNumber: 3,
        matchLabel: 'Simple n°3',
        orderDescription: 'Simples 3 & 1 en simultané',
        playerName: p3.name,
        playerRank: p3.rank,
      });
      slots.push({
        id: 's1',
        rotationNumber: 2,
        timeSlot: timeR2,
        courtNumber: 2,
        courtName: getCourtName(2, 's1').name,
        matchType: 'simple',
        slotNumber: 1,
        matchLabel: 'Simple n°1',
        orderDescription: 'Simples 3 & 1 en simultané',
        playerName: p1.name,
        playerRank: p1.rank,
      });

      const timeR3 = addMinutesToTime(start, durationMin * 2);
      const d1 = getDoubleLabel(composition?.double1Player1Id, composition?.double1Player2Id);
      slots.push({
        id: 'd1',
        rotationNumber: 3,
        timeSlot: timeR3,
        courtNumber: 1,
        courtName: getCourtName(1).name,
        matchType: 'double',
        slotNumber: 1,
        matchLabel: 'Double n°1',
        orderDescription: 'Double décisif',
        playerName: d1.name,
        playerRank: d1.rank,
      });

    } else if (formatInfo.isSeniorsPlus) {
      // SENIORS+ (3 simples + 1 double)
      ordreAppliqueTexte = 'Ordre Seniors+ : Simples 2 & 3, puis Simple 1 & Double en simultané';
      const p2 = getPlayerLabel(composition?.simple2Id);
      const p3 = getPlayerLabel(composition?.simple3Id);
      slots.push({
        id: 's2',
        rotationNumber: 1,
        timeSlot: start,
        courtNumber: 1,
        courtName: getCourtName(1, 's2').name,
        matchType: 'simple',
        slotNumber: 2,
        matchLabel: 'Simple n°2',
        orderDescription: 'Simples 2 & 3 en simultané',
        playerName: p2.name,
        playerRank: p2.rank,
      });
      slots.push({
        id: 's3',
        rotationNumber: 1,
        timeSlot: start,
        courtNumber: 2,
        courtName: getCourtName(2, 's3').name,
        matchType: 'simple',
        slotNumber: 3,
        matchLabel: 'Simple n°3',
        orderDescription: 'Simples 2 & 3 en simultané',
        playerName: p3.name,
        playerRank: p3.rank,
      });

      const timeR2 = addMinutesToTime(start, durationMin);
      const p1 = getPlayerLabel(composition?.simple1Id);
      const d1 = getDoubleLabel(composition?.double1Player1Id, composition?.double1Player2Id);
      slots.push({
        id: 's1',
        rotationNumber: 2,
        timeSlot: timeR2,
        courtNumber: 1,
        courtName: getCourtName(1, 's1').name,
        matchType: 'simple',
        slotNumber: 1,
        matchLabel: 'Simple n°1',
        orderDescription: 'Simple 1 (en parallèle du Double)',
        playerName: p1.name,
        playerRank: p1.rank,
      });
      slots.push({
        id: 'd1',
        rotationNumber: 2,
        timeSlot: timeR2,
        courtNumber: 2,
        courtName: getCourtName(2).name,
        matchType: 'double',
        slotNumber: 1,
        matchLabel: 'Double n°1',
        orderDescription: 'Double (No-Ad & Super Tie-Break 10 pts)',
        playerName: d1.name,
        playerRank: d1.rank,
      });

    } else {
      // JEUNES (2 simples + 1 double)
      ordreAppliqueTexte = 'Ordre Jeunes : Simples 1 & 2 en simultané, puis Double';
      const p1 = getPlayerLabel(composition?.simple1Id);
      const p2 = getPlayerLabel(composition?.simple2Id);
      slots.push({
        id: 's1',
        rotationNumber: 1,
        timeSlot: start,
        courtNumber: 1,
        courtName: getCourtName(1, 's1').name,
        matchType: 'simple',
        slotNumber: 1,
        matchLabel: 'Simple n°1',
        orderDescription: 'Match des numéros 1',
        playerName: p1.name,
        playerRank: p1.rank,
      });
      slots.push({
        id: 's2',
        rotationNumber: 1,
        timeSlot: start,
        courtNumber: 2,
        courtName: getCourtName(2, 's2').name,
        matchType: 'simple',
        slotNumber: 2,
        matchLabel: 'Simple n°2',
        orderDescription: 'Match des numéros 2',
        playerName: p2.name,
        playerRank: p2.rank,
      });

      const timeR2 = addMinutesToTime(start, durationMin);
      const d1 = getDoubleLabel(composition?.double1Player1Id, composition?.double1Player2Id);
      slots.push({
        id: 'd1',
        rotationNumber: 2,
        timeSlot: timeR2,
        courtNumber: 1,
        courtName: getCourtName(1).name,
        matchType: 'double',
        slotNumber: 1,
        matchLabel: 'Double n°1',
        orderDescription: 'Double décisif jeunes',
        playerName: d1.name,
        playerRank: d1.rank,
      });
    }

  // ==================== CONFIGURATION 1 COURT UNIQUE ====================
  } else if (courts === 1) {
    if (isPreRegionale) {
      // PRE-REGIONALE SUR UN SEUL COURT :
      // Règle officielle en cas de désaccord : 4-2, Double 2, 3-1, Double 1
      // (possibilité de 2 simples / 1 double / 2 simples / 1 double)
      ordreAppliqueTexte = 'Ordre officiel Pré-Régional sur 1 court : 4-2, Double 2, 3-1, Double 1 (2S / 1D / 2S / 1D)';

      const matchSeq: { type: 'simple' | 'double'; slot: number; label: string; desc: string; pid?: string; p1?: string; p2?: string }[] = [
        { type: 'simple', slot: 4, label: 'Simple n°4', desc: '1er match : Simple 4', pid: composition?.simple4Id },
        { type: 'simple', slot: 2, label: 'Simple n°2', desc: '2e match : Simple 2', pid: composition?.simple2Id },
        { type: 'double', slot: 2, label: 'Double n°2', desc: '3e match : Double 2 (Intermédiaire)', p1: composition?.double2Player1Id, p2: composition?.double2Player2Id },
        { type: 'simple', slot: 3, label: 'Simple n°3', desc: '4e match : Simple 3', pid: composition?.simple3Id },
        { type: 'simple', slot: 1, label: 'Simple n°1', desc: '5e match : Simple 1', pid: composition?.simple1Id },
        { type: 'double', slot: 1, label: 'Double n°1', desc: '6e match : Double 1 (Décisif)', p1: composition?.double1Player1Id, p2: composition?.double1Player2Id },
      ];

      matchSeq.forEach((m, idx) => {
        const time = addMinutesToTime(start, durationMin * idx);
        const pData = m.type === 'simple' ? getPlayerLabel(m.pid) : getDoubleLabel(m.p1, m.p2);
        slots.push({
          id: `c1_m${idx + 1}`,
          rotationNumber: idx + 1,
          timeSlot: time,
          courtNumber: 1,
          courtName: 'Court Unique',
          matchType: m.type,
          slotNumber: m.slot,
          matchLabel: m.label,
          orderDescription: m.desc,
          playerName: pData.name,
          playerRank: pData.rank,
        });
      });

    } else if (isMasculinDept) {
      // HOMMES D1 / D2 / D3 SUR UN SEUL COURT :
      // Ordre officiel : 4-3-2-1-5 - double
      ordreAppliqueTexte = 'Ordre officiel Hommes D1/D2/D3 sur 1 court : 4, 3, 2, 1, 5, puis Double';

      const matchSeq: { type: 'simple' | 'double'; slot: number; label: string; desc: string; pid?: string; p1?: string; p2?: string }[] = [
        { type: 'simple', slot: 4, label: 'Simple n°4', desc: '1er match', pid: composition?.simple4Id },
        { type: 'simple', slot: 3, label: 'Simple n°3', desc: '2e match', pid: composition?.simple3Id },
        { type: 'simple', slot: 2, label: 'Simple n°2', desc: '3e match', pid: composition?.simple2Id },
        { type: 'simple', slot: 1, label: 'Simple n°1', desc: '4e match', pid: composition?.simple1Id },
      ];

      if (numSingles >= 5) {
        matchSeq.push({ type: 'simple', slot: 5, label: 'Simple n°5', desc: '5e match (Dernier simple)', pid: composition?.simple5Id });
      }

      matchSeq.push({ type: 'double', slot: 1, label: 'Double n°1', desc: 'Dernier match : Double décisif', p1: composition?.double1Player1Id, p2: composition?.double1Player2Id });

      if (numDoubles >= 2) {
        matchSeq.push({ type: 'double', slot: 2, label: 'Double n°2', desc: 'Double 2', p1: composition?.double2Player1Id, p2: composition?.double2Player2Id });
      }

      matchSeq.forEach((m, idx) => {
        const time = addMinutesToTime(start, durationMin * idx);
        const pData = m.type === 'simple' ? getPlayerLabel(m.pid) : getDoubleLabel(m.p1, m.p2);
        slots.push({
          id: `c1_m${idx + 1}`,
          rotationNumber: idx + 1,
          timeSlot: time,
          courtNumber: 1,
          courtName: 'Court Unique',
          matchType: m.type,
          slotNumber: m.slot,
          matchLabel: m.label,
          orderDescription: m.desc,
          playerName: pData.name,
          playerRank: pData.rank,
        });
      });

    } else if (isFemininDept && numSingles === 3) {
      // FEMMES D2 / D3 SUR UN SEUL COURT :
      // Ordre officiel : 1-2-3 - double
      ordreAppliqueTexte = 'Ordre officiel Dames D2/D3 sur 1 court : 1, 2, 3, puis Double';

      const matchSeq: { type: 'simple' | 'double'; slot: number; label: string; desc: string; pid?: string; p1?: string; p2?: string }[] = [
        { type: 'simple', slot: 1, label: 'Simple n°1', desc: '1er match : Simple 1', pid: composition?.simple1Id },
        { type: 'simple', slot: 2, label: 'Simple n°2', desc: '2e match : Simple 2', pid: composition?.simple2Id },
        { type: 'simple', slot: 3, label: 'Simple n°3', desc: '3e match : Simple 3', pid: composition?.simple3Id },
        { type: 'double', slot: 1, label: 'Double n°1', desc: '4e match : Double décisif', p1: composition?.double1Player1Id, p2: composition?.double1Player2Id },
      ];

      matchSeq.forEach((m, idx) => {
        const time = addMinutesToTime(start, durationMin * idx);
        const pData = m.type === 'simple' ? getPlayerLabel(m.pid) : getDoubleLabel(m.p1, m.p2);
        slots.push({
          id: `c1_m${idx + 1}`,
          rotationNumber: idx + 1,
          timeSlot: time,
          courtNumber: 1,
          courtName: 'Court Unique',
          matchType: m.type,
          slotNumber: m.slot,
          matchLabel: m.label,
          orderDescription: m.desc,
          playerName: pData.name,
          playerRank: pData.rank,
        });
      });

    } else {
      // Autres cas séquentiels
      ordreAppliqueTexte = 'Ordre séquentiel sur 1 court';
      const matchOrder: { type: 'simple' | 'double'; slot: number; label: string; desc: string; pid?: string; p1?: string; p2?: string }[] = [];

      for (let s = numSingles; s >= 1; s--) {
        const pid = (composition as any)?.[`simple${s}Id`];
        matchOrder.push({ type: 'simple', slot: s, label: `Simple n°${s}`, desc: `Simple n°${s}`, pid });
      }
      for (let d = 1; d <= numDoubles; d++) {
        const p1 = (composition as any)?.[`double${d}Player1Id`];
        const p2 = (composition as any)?.[`double${d}Player2Id`];
        matchOrder.push({ type: 'double', slot: d, label: `Double n°${d}`, desc: `Double n°${d}`, p1, p2 });
      }

      matchOrder.forEach((m, idx) => {
        const time = addMinutesToTime(start, durationMin * idx);
        const pData = m.type === 'simple' ? getPlayerLabel(m.pid) : getDoubleLabel(m.p1, m.p2);
        slots.push({
          id: `c1_m${idx + 1}`,
          rotationNumber: idx + 1,
          timeSlot: time,
          courtNumber: 1,
          courtName: 'Court Unique',
          matchType: m.type,
          slotNumber: m.slot,
          matchLabel: m.label,
          orderDescription: `Rotation ${idx + 1}`,
          playerName: pData.name,
          playerRank: pData.rank,
        });
      });
    }

  // ==================== CONFIGURATION 3 COURTS ====================
  } else {
    ordreAppliqueTexte = 'Ordre étalé sur 3 courts simultanés';
    const p3 = getPlayerLabel(composition?.simple3Id);
    const p4 = getPlayerLabel(composition?.simple4Id);
    const p5OrP2 = numSingles >= 5 ? getPlayerLabel(composition?.simple5Id) : getPlayerLabel(composition?.simple2Id);
    const labelCourt3 = numSingles >= 5 ? 'Simple n°5' : 'Simple n°2';

    slots.push({
      id: 'r1_c1',
      rotationNumber: 1,
      timeSlot: start,
      courtNumber: 1,
      courtName: 'Court n°1',
      matchType: 'simple',
      slotNumber: 3,
      matchLabel: 'Simple n°3',
      orderDescription: 'Lancement sur 3 courts',
      playerName: p3.name,
      playerRank: p3.rank,
    });
    slots.push({
      id: 'r1_c2',
      rotationNumber: 1,
      timeSlot: start,
      courtNumber: 2,
      courtName: 'Court n°2',
      matchType: 'simple',
      slotNumber: 4,
      matchLabel: 'Simple n°4',
      orderDescription: 'Lancement sur 3 courts',
      playerName: p4.name,
      playerRank: p4.rank,
    });
    slots.push({
      id: 'r1_c3',
      rotationNumber: 1,
      timeSlot: start,
      courtNumber: 3,
      courtName: 'Court n°3',
      matchType: 'simple',
      slotNumber: numSingles >= 5 ? 5 : 2,
      matchLabel: labelCourt3,
      orderDescription: 'Lancement sur 3 courts',
      playerName: p5OrP2.name,
      playerRank: p5OrP2.rank,
    });

    const timeR2 = addMinutesToTime(start, durationMin);
    const p1 = getPlayerLabel(composition?.simple1Id);
    slots.push({
      id: 'r2_c1',
      rotationNumber: 2,
      timeSlot: timeR2,
      courtNumber: 1,
      courtName: 'Court n°1',
      matchType: 'simple',
      slotNumber: 1,
      matchLabel: 'Simple n°1',
      orderDescription: 'Tête de série n°1',
      playerName: p1.name,
      playerRank: p1.rank,
    });

    if (numSingles >= 5) {
      const p2 = getPlayerLabel(composition?.simple2Id);
      slots.push({
        id: 'r2_c2',
        rotationNumber: 2,
        timeSlot: timeR2,
        courtNumber: 2,
        courtName: 'Court n°2',
        matchType: 'simple',
        slotNumber: 2,
        matchLabel: 'Simple n°2',
        orderDescription: 'Tête de série n°2',
        playerName: p2.name,
        playerRank: p2.rank,
      });
    }

    const d1 = getDoubleLabel(composition?.double1Player1Id, composition?.double1Player2Id);
    slots.push({
      id: 'r2_c3',
      rotationNumber: 2,
      timeSlot: timeR2,
      courtNumber: 3,
      courtName: 'Court n°3',
      matchType: 'double',
      slotNumber: 1,
      matchLabel: 'Double n°1',
      orderDescription: 'Double 1',
      playerName: d1.name,
      playerRank: d1.rank,
    });

    if (numDoubles >= 2) {
      const timeR3 = addMinutesToTime(start, durationMin * 2);
      const d2 = getDoubleLabel(composition?.double2Player1Id, composition?.double2Player2Id);
      slots.push({
        id: 'r3_c1',
        rotationNumber: 3,
        timeSlot: timeR3,
        courtNumber: 1,
        courtName: 'Court n°1',
        matchType: 'double',
        slotNumber: 2,
        matchLabel: 'Double n°2',
        orderDescription: 'Double 2',
        playerName: d2.name,
        playerRank: d2.rank,
      });
    }
  }

  // Regrouper par rotation
  const rotationMap = new Map<number, MatchRotationSlot[]>();
  slots.forEach(s => {
    if (!rotationMap.has(s.rotationNumber)) {
      rotationMap.set(s.rotationNumber, []);
    }
    rotationMap.get(s.rotationNumber)!.push(s);
  });

  const rotations = Array.from(rotationMap.entries()).map(([rotNum, matchSlots]) => {
    return {
      rotationNumber: rotNum,
      timeSlot: matchSlots[0]?.timeSlot || start,
      description: `Rotation ${rotNum} • à suivre à partir de ${matchSlots[0]?.timeSlot || start}`,
      matches: matchSlots,
    };
  });

  // Contrôle de la fatigue : un joueur de double est-il mis en dernier simple ?
  const fatigueRisk = checkDoubleFatigueRisk(slots, composition, adherentsById);

  return {
    heureDebut: start,
    nombreCourts: courts,
    dureeMoyenneMatchMin: durationMin,
    deroulementASuivre: true,
    regleJeudi20hRappel: 'L’ordre des parties est proposé par le capitaine qui se déplace avant le jeudi 20H00 précédant la rencontre.',
    ordreOfficielApplique: ordreAppliqueTexte,
    fatigueRisk,
    surfacesDifferentesActif: surfacesDifferentes,
    slots,
    rotations,
  };
}

/**
 * Vérification de la règle de fatigue pour le double :
 * "Dans la mesure du possible, les joueurs susceptibles de faire le double ne seront pas mis en dernière rencontre de simple.
 * Un capitaine peut demander d’attendre la fin du match d’un joueur prévu en double."
 */
export function checkDoubleFatigueRisk(
  slots: MatchRotationSlot[],
  composition?: MatchComposition,
  adherentsById?: Map<string, Adherent>
): DoubleFatigueRisk {
  if (!composition) return { hasRisk: false };

  // Trouver tous les joueurs prévus en doubles
  const doublePlayers = new Set<string>();
  if (composition.double1Player1Id) doublePlayers.add(composition.double1Player1Id);
  if (composition.double1Player2Id) doublePlayers.add(composition.double1Player2Id);
  if (composition.double2Player1Id) doublePlayers.add(composition.double2Player1Id);
  if (composition.double2Player2Id) doublePlayers.add(composition.double2Player2Id);

  if (doublePlayers.size === 0) return { hasRisk: false };

  // Trouver les simples qui jouent lors de la dernière rotation de simples
  const singleSlots = slots.filter(s => s.matchType === 'simple');
  if (singleSlots.length === 0) return { hasRisk: false };

  // Déterminer la rotation maximale des simples
  const maxSingleRot = Math.max(...singleSlots.map(s => s.rotationNumber));
  const lastSingleSlots = singleSlots.filter(s => s.rotationNumber === maxSingleRot);

  for (const slot of lastSingleSlots) {
    const pId = (composition as any)?.[`simple${slot.slotNumber}Id`];
    if (pId && doublePlayers.has(pId)) {
      const p = adherentsById?.get(pId);
      const pName = p ? p.nomPrenom : 'Le joueur';
      return {
        hasRisk: true,
        playerName: pName,
        slotLabel: slot.matchLabel,
        message: `Gestion de fatigue FFT : ${pName} est prévu en double tout en jouant la dernière rotation de simples (${slot.matchLabel}). Dans la mesure du possible, évitez de placer un joueur de double en dernière rencontre de simple, ou prévoyez un temps d'attente à la fin de son match.`
      };
    }
  }

  return { hasRisk: false };
}

/**
 * Récupère automatiquement l'adresse complète du club adverse depuis les colonnes AM à AO
 * Utilisée lorsque la rencontre est à l'extérieur.
 */
export function getAdverseClubFullAddress(rencontre: Rencontre): {
  venueLabel: string;
  shortLabel: string;
  hasAdverseAddress: boolean;
} {
  const clubNom = rencontre.clubAccueilNom || 'Club adverse';
  const parts: string[] = [];

  if (rencontre.adresse1Installation && rencontre.adresse1Installation.trim()) {
    parts.push(rencontre.adresse1Installation.trim());
  }
  if (rencontre.adresse2Installation && rencontre.adresse2Installation.trim()) {
    parts.push(rencontre.adresse2Installation.trim());
  }

  const cpVille: string[] = [];
  if (rencontre.codePostalInstallation && rencontre.codePostalInstallation.trim()) {
    cpVille.push(rencontre.codePostalInstallation.trim());
  }
  if (rencontre.villeInstallation && rencontre.villeInstallation.trim()) {
    cpVille.push(rencontre.villeInstallation.trim());
  }

  if (cpVille.length > 0) {
    parts.push(cpVille.join(' '));
  }

  const hasAdverseAddress = parts.length > 0;
  const addressStr = parts.join(', ');

  const venueLabel = hasAdverseAddress
    ? `${clubNom} - ${addressStr}`
    : `${clubNom} (Installations adverses)`;

  const shortLabel = hasAdverseAddress
    ? `${clubNom} (${rencontre.villeInstallation || rencontre.codePostalInstallation || ''})`
    : clubNom;

  return {
    venueLabel,
    shortLabel,
    hasAdverseAddress,
  };
}
