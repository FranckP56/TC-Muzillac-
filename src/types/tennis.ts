export type Civilite = 'Monsieur' | 'Madame';
export type SexeHomologation = 'Messieurs' | 'Dames' | 'Mixte';
export type TypeLicence = 'C' | 'W' | 'D' | 'S' | 'Non renouvelée' | string;
export type SoldeStatut = 'du' | 'a_regulariser' | 'a_jour';

export type DisponibiliteStatut = 'disponible' | 'indisponible' | 'incertain';
export type PreferenceJeu = 'simple_et_double' | 'simple_seul' | 'double_seul';
export type CreneauPrefere = 'journee' | 'matin_9h' | 'apres_midi_14h';

export interface JoueurDisponibilite {
  adherentId: string;
  nomPrenom: string;
  classement?: string;
  statut: DisponibiliteStatut;
  preferenceJeu: PreferenceJeu;
  creneauPrefere: CreneauPrefere;
  commentaire?: string;
  dateReponse?: string;
}

export interface Adherent {
  id: string;
  nomPrenom: string;
  nom?: string;
  prenom?: string;
  civilite: Civilite;
  dateNaissance: string; // ex: '15/04/1989'
  ageSportifAnnees?: number;
  typeLicence: TypeLicence; // C (Club/Compétition), W (Web/Multi-raquettes), D (Découverte), S (Scolaire)
  millesimeLicence?: string; // ex: '2027', '2026'
  soldeDu: number; // Négatif = DÛ au club, Positif = À régulariser (trop-perçu/tarif famille), 0 = À jour
  echeancesAVenir?: number;
  telephonePortable: string;
  telephoneSecondaire?: string;
  email: string;
  dernierClassTennis: string; // ex: '15/2', '30/2', 'NC'
  meilleurClassTennis?: string;
  licence: string;
  ageSportif: string; // ex: '51', '14', 'Senior'
  groupeEnseignement: string;
  compteTenUp: string; // 'Créé' | 'Non créé'
  ville?: string;
  codePostal?: string;
  clubRattachement?: string;
  commentaire?: string;
}

export interface FrozenPlayerSlot {
  poste: 'Simple 1' | 'Simple 2' | 'Simple 3' | 'Simple 4' | 'Double 1 (J1)' | 'Double 1 (J2)' | 'Double 2 (J1)' | 'Double 2 (J2)' | string;
  adherentId: string;
  nomPrenom: string;
  licence: string;
  classementGele: string; // Classement FFT gelé à la date de la rencontre (ne sera pas modifié le mois suivant)
  dateNaissance?: string;
  ageSportif?: string;
  typeLicence?: string;
}

export interface MatchComposition {
  simple1Id?: string;
  simple2Id?: string;
  simple3Id?: string;
  simple4Id?: string;
  simple5Id?: string; // Départemental Seniors Messieurs (5 simples)
  double1Player1Id?: string;
  double1Player2Id?: string;
  double2Player1Id?: string;
  double2Player2Id?: string;
  remplacantIds?: string[];
  dateValidation?: string;
  valideParCapitaine?: boolean;
  frozenPlayers?: FrozenPlayerSlot[];
  // Logistique TCM (demande club)
  dateRencontreValidee?: string;
  heureDebut?: string; // '09:00', '14:00'
  nombreCourts?: number; // 1, 2, 3
  lieuRencontre?: string; // 'Clos des Moines (Muzillac)', 'TC Nivillac (salle empruntée)', etc.
  formatDivision?: 'regional' | 'departemental';
  formatReduit?: boolean;
  poidsDouble1?: number;
  poidsDouble2?: number;
  poidsDoublesValide?: boolean;
  // Ordre des parties et circulation
  ordrePartiesOption?: 'desaccord_officiel' | 'visiteur_propose';
  deroulementASuivre?: boolean;
  surfacesDifferentes?: boolean;
  surfaceANom?: string; // Court A (Résine dédié tennis)
  surfaceBNom?: string; // Court B (Salle omnisport)
  assignationSurfaces?: Record<string, 'A' | 'B'>;
  isBarrage?: boolean;
  isEquipeSuperieureExempte?: boolean;
  regleNMoins1Activee?: boolean;
  regleNMoins1Info?: string;
}

export interface Rencontre {
  id: string;
  niveauHomologation?: string; // Niveau de l'homologation (Départemental, Régional, National)
  libelleHomologation: string; // Libellé de l'homologation
  sexeHomologation: SexeHomologation; // Sexe de l'homologation ('Messieurs', 'Dames', 'Mixte')
  categorieAgeHomologation: string; // Catégorie d'âge de l'homologation (Seniors, Seniors +35, etc.)
  division?: string; // Division
  poule?: string; // Poule
  numeroEquipe: string; // Numéro de l'équipe (Équipe 1, Équipe 2...)
  dateRencontre: string; // Date de la rencontre (JJ/MM/AAAA)
  journee?: string; // Journée n°
  clubAccueilCode?: string; // Club d'accueil code (ex: 52 56 0212)
  clubAccueilNom: string; // Club d'accueil nom
  clubVisiteurCode?: string; // Club visiteur code
  clubVisiteurNom: string; // Club visiteur nom
  vainqueur?: string; // Vainqueur
  score: string; // Score
  jugeArbitreNom?: string; // Juge-arbitre nom
  jugeArbitrePrenom?: string; // Juge-arbitre prénom
  nomCapitaine: string; // Nom capitaine
  prenomCapitaine?: string; // Prénom capitaine
  licenceCapitaine?: string; // Licence capitaine
  portableCapitaine: string; // Portable capitaine
  mailCapitaine: string; // Mail capitaine
  nomCapitaineAdverse?: string; // Nom capitaine adverse
  prenomCapitaineAdverse?: string; // Prénom capitaine adverse
  licenceCapitaineAdverse?: string; // Licence capitaine adverse
  portableCapitaineAdverse?: string; // Portable capitaine adverse
  mailCapitaineAdverse?: string; // Mail capitaine adverse
  nomCorrespondant?: string; // Nom correspondant
  prenomCorrespondant?: string; // Prénom correspondant
  licenceCorrespondant?: string; // Licence correspondant
  portableCorrespondant?: string; // Portable correspondant
  mailCorrespondant?: string; // Mail correspondant
  nomCorrespondantAdverse?: string; // Nom correspondant adverse
  prenomCorrespondantAdverse?: string; // Prénom correspondant adverse
  licenceCorrespondantAdverse?: string; // Licence correspondant adverse
  portableCorrespondantAdverse?: string; // Portable correspondant adverse
  mailCorrespondantAdverse?: string; // Mail correspondant adverse
  adresse1Installation?: string; // Adresse 1 installation
  adresse2Installation?: string; // Adresse 2 installation
  codePostalInstallation?: string; // Code postal installation
  villeInstallation?: string; // Ville installation
  composition?: MatchComposition;
  disponibilites?: JoueurDisponibilite[];
}

export type UserRole = 'admin' | 'bureau' | 'prof' | 'capitaine' | 'adherent';

export interface Enseignant {
  id: string;
  nomPrenom: string;
  diplome: string; // 'Diplômé d\'État (DE)' | 'BPJEPS' | 'CQP ET' etc.
  telephone?: string;
  email?: string;
  description?: string;
}

export interface ClubTarif {
  id: string;
  label: string;
  montant: number;
  categorie: 'jeune' | 'adulte' | 'competition' | 'adhesion';
  description?: string;
}

export interface MatchSlotSchedule {
  matchType: 'simple' | 'double';
  slotNumber: number;
  label: string; // 'Simple 3', 'Simple 4', 'Simple 1', 'Double 1', etc.
  rotation: number; // 1, 2, 3...
  heurePrevue: string; // '14:00', '15:30', '17:00'
  courtLabel: string; // 'Court 1 (Résine)', 'Court 2 (Résine)'
  joueursTcm?: string;
}

export interface ClubInfo {
  nom: string;
  sigle: string;
  ligue: string;
  comite: string;
  codeClub: string;
  adresse: string;
  codePostal: string;
  ville: string;
  email: string;
  telephone: string;
  siteWeb: string;
  president: string;
  presidentTelephone?: string;
  presidentEmail?: string;
  secretaire: string;
  secretaireTelephone?: string;
  secretaireEmail?: string;
  tresorier: string;
  tresorierTelephone?: string;
  tresorierEmail?: string;
  enseignant?: string;
  enseignants: Enseignant[];
  installations: string[];
  tarifs?: ClubTarif[];
  horairesPermanence?: string;
  modalitesPaiement?: string;
  helloAssoUrl?: string;
}

export interface EligibilityResult {
  isEligible: boolean;
  birthYear: number | null;
  ageSportif2027: number | null;
  licenceValid: boolean;
  licenceError?: string;
  sexeValid: boolean;
  sexeError?: string;
  ageValid: boolean;
  ageError?: string;
  rankingValid: boolean; // Statut FFT : les joueurs ND doivent demander un reclassement avant de jouer
  rankingError?: string;
  errors: string[];
}

export interface ColumnMapping {
  nomPrenom: string;
  solde: string;
  civilite: string;
  dateNaissance: string;
  licence: string;
  millesimeLicence: string;
  dernierClassement: string;
  telephone: string;
  email: string;
  groupe: string;
  compteTenUp: string;
  ville: string;
}
