export type GameFormatId = 'format_1' | 'format_2' | 'format_3' | 'format_4' | 'format_5' | 'format_6' | 'format_7' | 'format_libre';

export interface GameFormatOption {
  id: GameFormatId;
  label: string;
  description: string;
}

export const OFFICIAL_GAME_FORMATS: GameFormatOption[] = [
  {
    id: 'format_1',
    label: 'Format 1 (Traditionnel)',
    description: '3 sets à 6 jeux avec avantage (Simples Régional & Pré-Régional)',
  },
  {
    id: 'format_2',
    label: 'Format 2 (Super Tie-Break)',
    description: '2 sets à 6 jeux, 3e set Super Tie-Break en 10 points (Départemental & Jeunes)',
  },
  {
    id: 'format_3',
    label: 'Format 3 (Sets courts)',
    description: '2 sets à 4 jeux (point décisif No-Ad), 3e set Super Tie-Break 10 pts',
  },
  {
    id: 'format_4',
    label: 'Format 4 (Doubles FFT standard)',
    description: '2 sets à 6 jeux avec No-Ad, 3e set Super Tie-Break en 10 points (Obligatoire Doubles)',
  },
  {
    id: 'format_5',
    label: 'Format 5 (Galaxie Orange)',
    description: '2 sets à 3 jeux, point décisif No-Ad, jeu décisif à 2-2, 3e set tie-break 7 pts',
  },
  {
    id: 'format_6',
    label: 'Format 6 (Galaxie Vert)',
    description: '2 sets à 4 jeux, point décisif No-Ad, 3e set super tie-break 10 pts',
  },
  {
    id: 'format_7',
    label: 'Format 7 (Galaxie Rouge/Violet)',
    description: 'Format très court (1 set de 5 points ou 10 points pour les moins de 8 ans)',
  },
  {
    id: 'format_libre',
    label: 'Format personnalisé',
    description: 'Format spécifique défini par le comité ou la ligue',
  },
];

export interface ChampionshipRule {
  id: string; // Ex: 'seniors_regional', 'seniors_preregionale', 'seniors_d1_m', 'seniors_d1_f', etc.
  title: string;
  categoryAge: string; // 'Seniors', 'Seniors +35 / +45 / +55', 'Jeunes 11-18 ans', 'Moins de 10 ans'
  sexe: 'Messieurs' | 'Dames' | 'Mixte' | 'Tous';
  division: string; // 'Régionale (PN, R1, R2, R3)', 'Pré-Régionale', 'D1', 'D2', 'D3'
  level: 'Régional' | 'Départemental' | 'National' | 'Galaxie';
  expectedDay: 'Samedi' | 'Dimanche';
  numSingles: number;
  singlesGameFormat: string;
  numDoubles: number;
  doublesGameFormat: string;
  doubleWeightStrict: boolean; // Double 1 >= Double 2 strict
  pointsSystem: string;
  minPlayers: number;
  maxPlayers: number;
  orderOfPlay: string;
  notes?: string;
  isCustomized?: boolean;
  updatedAt?: string;
}
