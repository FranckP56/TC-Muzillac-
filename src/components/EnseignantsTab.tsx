import React, { useState, useMemo } from 'react';
import { 
  GraduationCap, 
  Calendar, 
  Users, 
  CreditCard, 
  Phone, 
  MessageSquare, 
  Mail, 
  Send, 
  FileText, 
  Printer, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Filter, 
  Copy, 
  Check, 
  X, 
  Clock, 
  MapPin, 
  Download, 
  Award,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { Adherent, ClubInfo, Enseignant } from '../types/tennis';

interface EnseignantsTabProps {
  adherents: Adherent[];
  clubInfo: ClubInfo;
  onSelectAdherent?: (adh: Adherent) => void;
}

export interface CoursSlot {
  id: string;
  nom: string;
  jour: string;
  horaire: string;
  court: string;
  enseignantNom: string;
  diplome: string;
  publicCible: string;
  groupeMatcher: string; // Ex: "École de Tennis", "Galaxie", "Compétition", "Adultes"
}

export const COURS_PLANNING: CoursSlot[] = [
  {
    id: 'c1',
    nom: 'Galaxie Tennis (Moins de 10 ans)',
    jour: 'Mercredi',
    horaire: '14h00 - 15h15',
    court: 'Clos des Moines - Court n°1 résine',
    enseignantNom: 'Thomas Mercier',
    diplome: 'BPJEPS Tennis',
    publicCible: 'Niveaux Violet, Rouge, Orange (Terrains adaptés)',
    groupeMatcher: 'galaxie',
  },
  {
    id: 'c2',
    nom: 'École de Tennis Jeunes (11/14 ans)',
    jour: 'Mercredi',
    horaire: '15h15 - 16h45',
    court: 'Clos des Moines - Court n°1 & n°2',
    enseignantNom: 'Alexandre Rault',
    diplome: 'Diplômé d\'État (DE)',
    publicCible: 'Perfectionnement et apprentissage tactique',
    groupeMatcher: 'ecole',
  },
  {
    id: 'c3',
    nom: 'Pôle Compétition Jeunes (15/18 ans)',
    jour: 'Mardi',
    horaire: '18h00 - 19h30',
    court: 'Clos des Moines - Court n°1 résine',
    enseignantNom: 'Alexandre Rault',
    diplome: 'Diplômé d\'État (DE)',
    publicCible: 'Joueurs classés en championnats interclubs',
    groupeMatcher: 'competition',
  },
  {
    id: 'c4',
    nom: 'Cours Collectifs Adultes (Initiation & Loisir)',
    jour: 'Lundi',
    horaire: '19h00 - 20h30',
    court: 'Clos des Moines - Court n°1 & n°2',
    enseignantNom: 'Thomas Mercier',
    diplome: 'BPJEPS Tennis',
    publicCible: 'Adultes débutants et reprise d\'activité',
    groupeMatcher: 'adulte',
  },
  {
    id: 'c5',
    nom: 'Entraînement Équipes Seniors (Compétition)',
    jour: 'Vendredi',
    horaire: '19h00 - 21h00',
    court: 'Clos des Moines - 2 courts résine',
    enseignantNom: 'Alexandre Rault',
    diplome: 'Diplômé d\'État (DE)',
    publicCible: 'Équipes 1 & 2 Régionales et Départementales',
    groupeMatcher: 'equipe',
  },
  {
    id: 'c6',
    nom: 'École de Tennis Jeunes Samedi',
    jour: 'Samedi',
    horaire: '10h00 - 11h30',
    court: 'Clos des Moines - Court n°1',
    enseignantNom: 'Thomas Mercier',
    diplome: 'BPJEPS Tennis',
    publicCible: 'Enfants scolarisés en semaine',
    groupeMatcher: 'samedi',
  },
];

export const EnseignantsTab: React.FC<EnseignantsTabProps> = ({
  adherents,
  clubInfo,
  onSelectAdherent,
}) => {
  const [activeSubView, setActiveSubView] = useState<'eleves' | 'planning' | 'enseignants'>('eleves');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSolde, setFilterSolde] = useState<'all' | 'due' | 'uptodate' | 'credit'>('all');
  const [filterGroupe, setFilterGroupe] = useState<string>('all');

  // Modale de relance de paiement
  const [relanceAdherent, setRelanceAdherent] = useState<Adherent | null>(null);
  const [copiedRelanceSms, setCopiedRelanceSms] = useState(false);
  const [copiedRelanceMail, setCopiedRelanceMail] = useState(false);

  // Modale d'attestation de paiement & licence
  const [attestationAdherent, setAttestationAdherent] = useState<Adherent | null>(null);
  const [copiedAttestation, setCopiedAttestation] = useState(false);

  // Liste distincte des groupes d'enseignement présents dans le fichier
  const distinctGroupes = useMemo(() => {
    const set = new Set<string>();
    adherents.forEach(a => {
      if (a.groupeEnseignement && a.groupeEnseignement.trim() && a.groupeEnseignement !== 'Pratique libre') {
        set.add(a.groupeEnseignement.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [adherents]);

  // Filtrage des élèves
  const filteredEleves = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return adherents.filter(adh => {
      // Recherche textuelle
      const matchesSearch = 
        !q ||
        adh.nomPrenom.toLowerCase().includes(q) ||
        adh.licence.toLowerCase().includes(q) ||
        (adh.groupeEnseignement && adh.groupeEnseignement.toLowerCase().includes(q)) ||
        adh.telephonePortable.includes(q) ||
        adh.email.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      // Filtre Solde
      if (filterSolde === 'due' && adh.soldeDu >= 0) return false;
      if (filterSolde === 'uptodate' && adh.soldeDu !== 0) return false;
      if (filterSolde === 'credit' && adh.soldeDu <= 0) return false;

      // Filtre Groupe
      if (filterGroupe !== 'all') {
        if (!adh.groupeEnseignement || !adh.groupeEnseignement.includes(filterGroupe)) {
          return false;
        }
      }

      return true;
    });
  }, [adherents, searchQuery, filterSolde, filterGroupe]);

  // Statistiques financières de l'enseignement
  const stats = useMemo(() => {
    const total = adherents.length;
    const dueList = adherents.filter(a => a.soldeDu < 0);
    const totalDue = dueList.reduce((sum, a) => sum + Math.abs(a.soldeDu || 0), 0);
    const upToDateCount = adherents.filter(a => a.soldeDu === 0).length;
    const creditCount = adherents.filter(a => a.soldeDu > 0).length;

    return {
      total,
      dueCount: dueList.length,
      totalDue,
      upToDateCount,
      creditCount,
    };
  }, [adherents]);

  // Générateur du texte SMS de relance de paiement
  const generateRelanceSmsText = (adh: Adherent) => {
    const montantAbs = Math.abs(adh.soldeDu);
    return `Bonjour ${adh.nomPrenom}, le Tennis Club de Muzillac vous informe qu'un solde de ${montantAbs}€ reste dû pour votre inscription tennis saison 2026/2027. Merci de régulariser par virement ou chèque à l'ordre du TCM. Infos : ${clubInfo.telephone}. Sportivement, le TCM.`;
  };

  // Générateur du texte Email de relance de paiement
  const generateRelanceMailText = (adh: Adherent) => {
    const montantAbs = Math.abs(adh.soldeDu);
    return `Bonjour ${adh.nomPrenom},\n\nSauf erreur de notre part, votre compte adhérent au Tennis Club de Muzillac présente un solde restant dû de ${montantAbs} € pour votre inscription / cours de tennis de la saison sportive 2026/2027.\n\nNous vous remercions de bien vouloir procéder à la régularisation de ce montant :\n- Par virement bancaire sur le compte du TCM\n- Par chèque à l'ordre du Tennis Club de Muzillac déposé au club-house\n- En espèces lors des permanences du mercredi ou samedi\n\nSi vous avez déjà effectué ce règlement récemment, merci de ne pas tenir compte de ce message.\n\nRestant à votre disposition,\nBien sportivement,\n\nL'équipe des Enseignants et le Bureau du Tennis Club de Muzillac\n${clubInfo.telephone} • ${clubInfo.email}\n${clubInfo.adresse}, ${clubInfo.codePostal} ${clubInfo.ville}`;
  };

  // Générateur de l'attestation de paiement
  const generateAttestationContent = (adh: Adherent) => {
    const dateJour = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    return {
      clubNom: clubInfo.nom,
      codeClub: clubInfo.codeClub,
      dateJour,
      adherentNom: adh.nomPrenom,
      dateNaissance: adh.dateNaissance || 'Non renseignée',
      licence: adh.licence || 'Licence Club FFT',
      groupe: adh.groupeEnseignement || 'Cours collectifs / Adhésion',
      saison: '2026 / 2027',
      president: clubInfo.president,
    };
  };

  return (
    <div className="space-y-6">
      
      {/* En-tête Espace Enseignants */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1c212a] via-[#141820] to-[#0c0e12] border border-[#272e3b] p-5 sm:p-7 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5 sm:space-x-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-[#BF360C] to-[#FF6D00] flex items-center justify-center font-bold text-white shadow-lg shadow-orange-950/60 shrink-0">
              <GraduationCap className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-[#FF6D00] border border-orange-500/30">
                  Espace Réservé • Enseignants & Bureau
                </span>
                <span className="text-xs text-zinc-400">
                  {clubInfo.enseignants.length} enseignants en activité
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-heading font-black text-white mt-1">
                Gestion Pédagogique & Suivi des Élèves
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Planning des cours, suivi du solde dû par élève, relances de paiement et attestations officielles.
              </p>
            </div>
          </div>

          {/* Navigation interne sous-onglets */}
          <div className="flex items-center p-1 bg-[#090b0e] rounded-2xl border border-[#232934] shrink-0 self-start sm:self-auto text-xs">
            <button
              onClick={() => setActiveSubView('eleves')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeSubView === 'eleves'
                  ? 'bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Élèves & Soldes ({filteredEleves.length})</span>
            </button>
            <button
              onClick={() => setActiveSubView('planning')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeSubView === 'planning'
                  ? 'bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Planning des Cours</span>
            </button>
            <button
              onClick={() => setActiveSubView('enseignants')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeSubView === 'enseignants'
                  ? 'bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>Équipe Pédagogique</span>
            </button>
          </div>
        </div>

        {/* Chiffres clés de trésorerie & élèves */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-zinc-800/80">
          <div className="bg-[#12151b]/80 p-3 rounded-xl border border-zinc-800">
            <p className="text-[11px] text-zinc-400">Total Élèves / Adhérents</p>
            <p className="text-lg font-heading font-black text-white">{stats.total}</p>
          </div>

          <div className="bg-[#12151b]/80 p-3 rounded-xl border border-zinc-800">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-zinc-400">Soldes Dus (Impayés)</p>
              <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300">
                {stats.dueCount} élèves
              </span>
            </div>
            <p className="text-lg font-heading font-black text-rose-400">
              -{stats.totalDue.toLocaleString('fr-FR')} €
            </p>
          </div>

          <div className="bg-[#12151b]/80 p-3 rounded-xl border border-zinc-800">
            <p className="text-[11px] text-zinc-400">À Jour de Cotisation</p>
            <p className="text-lg font-heading font-black text-emerald-400">
              {stats.upToDateCount} élèves (0 €)
            </p>
          </div>

          <div className="bg-[#12151b]/80 p-3 rounded-xl border border-zinc-800">
            <p className="text-[11px] text-zinc-400">Avoirs / Trop-perçu</p>
            <p className="text-lg font-heading font-black text-amber-400">
              {stats.creditCount} élèves
            </p>
          </div>
        </div>
      </div>

      {/* ==================== VUE 1 : ÉLÈVES & SOLDES DUS ==================== */}
      {activeSubView === 'eleves' && (
        <div className="space-y-4">
          
          {/* Barre de recherche et filtres */}
          <div className="bg-[#141820] p-4 rounded-2xl border border-[#252b37] space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un élève par nom, prénom, licence ou téléphone..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#0e1116] border border-zinc-800 text-xs sm:text-sm text-white placeholder-zinc-500 focus:border-[#FF6D00] outline-none"
                />
              </div>

              {/* Filtre Solde */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
                <button
                  onClick={() => setFilterSolde('all')}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                    filterSolde === 'all'
                      ? 'bg-orange-600 text-white'
                      : 'bg-[#181d26] text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  Tous ({adherents.length})
                </button>
                <button
                  onClick={() => setFilterSolde('due')}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                    filterSolde === 'due'
                      ? 'bg-rose-600 text-white'
                      : 'bg-[#181d26] text-rose-400 hover:text-rose-300 border border-rose-500/30'
                  }`}
                >
                  Soldes Dus ({stats.dueCount})
                </button>
                <button
                  onClick={() => setFilterSolde('uptodate')}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                    filterSolde === 'uptodate'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#181d26] text-emerald-400 hover:text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  À Jour ({stats.upToDateCount})
                </button>
              </div>
            </div>

            {/* Filtre par groupe d'enseignement */}
            {distinctGroupes.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] pt-1 border-t border-zinc-800/80">
                <span className="text-zinc-500 font-semibold shrink-0">Groupe :</span>
                <button
                  onClick={() => setFilterGroupe('all')}
                  className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition cursor-pointer ${
                    filterGroupe === 'all'
                      ? 'bg-white/10 text-white border border-white/20'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Tous les groupes
                </button>
                {distinctGroupes.map((grp) => (
                  <button
                    key={grp}
                    onClick={() => setFilterGroupe(grp)}
                    className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition cursor-pointer ${
                      filterGroupe === grp
                        ? 'bg-[#FF6D00]/20 text-[#FF6D00] border border-[#FF6D00]/40'
                        : 'text-zinc-400 hover:text-zinc-200 bg-[#101319]'
                    }`}
                  >
                    {grp}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Liste des cartes élèves */}
          <div className="space-y-3">
            {filteredEleves.length > 0 ? (
              filteredEleves.map((eleve) => {
                const isDue = eleve.soldeDu < 0;
                const isUpToDate = eleve.soldeDu === 0;
                const isCredit = eleve.soldeDu > 0;

                return (
                  <div
                    key={eleve.id}
                    className="p-4 bg-[#161a22] rounded-2xl border border-[#252b37] hover:border-orange-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
                  >
                    {/* Infos élève */}
                    <div className="flex items-start space-x-3.5 min-w-0">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-heading font-black text-sm shrink-0 ${
                        isDue 
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' 
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}>
                        {eleve.nomPrenom.slice(0, 2).toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span 
                            onClick={() => onSelectAdherent && onSelectAdherent(eleve)}
                            className="font-heading font-black text-white text-sm hover:text-orange-400 transition cursor-pointer truncate"
                          >
                            {eleve.nomPrenom}
                          </span>
                          <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                            {eleve.dernierClassTennis || 'NC'}
                          </span>
                          {eleve.ageSportif && (
                            <span className="text-[10px] text-zinc-400 font-semibold">
                              {eleve.ageSportif} ans
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5 flex-wrap">
                          <span className="text-orange-300/90 font-medium">
                            {eleve.groupeEnseignement || 'Pratique libre'}
                          </span>
                          {eleve.licence && (
                            <>
                              <span className="text-zinc-600">•</span>
                              <span className="text-zinc-400 font-mono text-[11px]">
                                Lic. {eleve.licence}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bloc Solde & Actions Profs */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800">
                      
                      {/* Badge Solde Dû */}
                      <div className="text-right">
                        <div className={`px-3 py-1 rounded-xl text-xs font-heading font-black inline-flex items-center gap-1.5 border ${
                          isDue
                            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            : isUpToDate
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        }`}>
                          {isDue ? (
                            <>
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                              <span>Dû : {eleve.soldeDu} €</span>
                            </>
                          ) : isUpToDate ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>À jour (0 €)</span>
                            </>
                          ) : (
                            <span>Avoir : +{eleve.soldeDu} €</span>
                          )}
                        </div>
                      </div>

                      {/* Boutons d'actions rapides du prof */}
                      <div className="flex items-center space-x-1.5">
                        
                        {/* Appel téléphonique */}
                        {eleve.telephonePortable && (
                          <a
                            href={`tel:${eleve.telephonePortable}`}
                            className="p-2 rounded-xl bg-[#11141a] hover:bg-emerald-500/20 text-zinc-300 hover:text-emerald-400 border border-zinc-700 hover:border-emerald-500/40 transition cursor-pointer"
                            title={`Appeler ${eleve.nomPrenom} (${eleve.telephonePortable})`}
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        )}

                        {/* Envoi SMS direct */}
                        {eleve.telephonePortable && (
                          <a
                            href={`sms:${eleve.telephonePortable}`}
                            className="p-2 rounded-xl bg-[#11141a] hover:bg-sky-500/20 text-zinc-300 hover:text-sky-400 border border-zinc-700 hover:border-sky-500/40 transition cursor-pointer"
                            title={`Envoyer un SMS à ${eleve.nomPrenom}`}
                          >
                            <MessageSquare className="w-4 h-4" />
                          </a>
                        )}

                        {/* Relancer de paiement (si solde négatif) */}
                        {isDue && (
                          <button
                            onClick={() => setRelanceAdherent(eleve)}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                            title="Ouvrir la relance de paiement (SMS & Email)"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Relancer</span>
                          </button>
                        )}

                        {/* Attestation de paiement & Licence (si solde à jour >= 0) */}
                        {!isDue && (
                          <button
                            onClick={() => setAttestationAdherent(eleve)}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600 text-emerald-200 hover:text-white border border-emerald-500/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                            title="Générer l'attestation de cotisation pour CE / Pass'Sport"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Attestation</span>
                          </button>
                        )}

                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center bg-[#141820] rounded-2xl border border-zinc-800">
                <Users className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-white text-sm font-bold">Aucun élève trouvé</p>
                <p className="text-xs text-zinc-400">Modifiez votre recherche ou vos filtres.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== VUE 2 : PLANNING DES COURS ==================== */}
      {activeSubView === 'planning' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {COURS_PLANNING.map((cours) => (
              <div
                key={cours.id}
                className="p-5 bg-[#161a22] rounded-3xl border border-[#252b37] hover:border-orange-500/40 transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-[#FF6D00] border border-orange-500/30">
                      {cours.jour}
                    </span>
                    <h3 className="font-heading font-black text-white text-base">
                      {cours.nom}
                    </h3>
                  </div>

                  <span className="text-xs font-bold text-white px-2.5 py-1 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center gap-1 shrink-0">
                    <Clock className="w-3.5 h-3.5 text-orange-400" />
                    <span>{cours.horaire}</span>
                  </span>
                </div>

                <p className="text-xs text-zinc-300">
                  {cours.publicCible}
                </p>

                <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400 flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-[#FF6D00]" />
                    <span className="text-white font-bold">{cours.enseignantNom}</span>
                    <span className="text-[10px] text-zinc-400">({cours.diplome})</span>
                  </div>

                  <div className="flex items-center gap-1 text-zinc-400 text-[11px]">
                    <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{cours.court}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== VUE 3 : ÉQUIPE PÉDAGOGIQUE ==================== */}
      {activeSubView === 'enseignants' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {clubInfo.enseignants.map((ens) => (
              <div
                key={ens.id}
                className="p-6 bg-[#161a22] rounded-3xl border border-[#252b37] space-y-4 relative overflow-hidden"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#BF360C] to-[#E65100] text-white flex items-center justify-center font-bold text-lg shadow-md shadow-orange-950/60">
                      {ens.nomPrenom.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-heading font-black text-white text-base">
                        {ens.nomPrenom}
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {ens.diplome}
                      </span>
                    </div>
                  </div>
                </div>

                {ens.description && (
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {ens.description}
                  </p>
                )}

                <div className="pt-3 border-t border-zinc-800 space-y-2 text-xs">
                  {ens.telephone && (
                    <a
                      href={`tel:${ens.telephone}`}
                      className="flex items-center gap-2 text-zinc-300 hover:text-white transition"
                    >
                      <Phone className="w-3.5 h-3.5 text-[#FF6D00]" />
                      <span>{ens.telephone}</span>
                    </a>
                  )}
                  {ens.email && (
                    <a
                      href={`mailto:${ens.email}`}
                      className="flex items-center gap-2 text-zinc-300 hover:text-white transition"
                    >
                      <Mail className="w-3.5 h-3.5 text-[#FF6D00]" />
                      <span>{ens.email}</span>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== MODAL DE RELANCE DE PAIEMENT ==================== */}
      {relanceAdherent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-xl bg-[#141820] border border-[#272e3b] rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-heading font-black text-white text-base">
                    Relancer le Paiement
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {relanceAdherent.nomPrenom} • Solde dû : <strong className="text-rose-400">{Math.abs(relanceAdherent.soldeDu)} €</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRelanceAdherent(null)}
                className="p-1.5 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modèle SMS */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                  <span>Message SMS (Court & Efficace)</span>
                </span>
                {relanceAdherent.telephonePortable && (
                  <span className="text-[11px] text-zinc-400 font-mono">
                    {relanceAdherent.telephonePortable}
                  </span>
                )}
              </div>

              <div className="p-3 bg-[#0f1217] rounded-xl border border-zinc-800 text-xs text-zinc-300 leading-relaxed select-all">
                {generateRelanceSmsText(relanceAdherent)}
              </div>

              <div className="flex items-center gap-2">
                {relanceAdherent.telephonePortable && (
                  <a
                    href={`sms:${relanceAdherent.telephonePortable}?body=${encodeURIComponent(generateRelanceSmsText(relanceAdherent))}`}
                    className="flex-1 py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Ouvrir l'application SMS</span>
                  </a>
                )}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generateRelanceSmsText(relanceAdherent));
                    setCopiedRelanceSms(true);
                    setTimeout(() => setCopiedRelanceSms(false), 2000);
                  }}
                  className="py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  {copiedRelanceSms ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedRelanceSms ? 'Copié !' : 'Copier SMS'}</span>
                </button>
              </div>
            </div>

            {/* Modèle Email */}
            <div className="space-y-2 pt-2 border-t border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-amber-400" />
                  <span>Email de Relance Détaillé</span>
                </span>
                {relanceAdherent.email && (
                  <span className="text-[11px] text-zinc-400">
                    {relanceAdherent.email}
                  </span>
                )}
              </div>

              <div className="p-3 bg-[#0f1217] rounded-xl border border-zinc-800 text-[11px] text-zinc-300 leading-relaxed select-all whitespace-pre-wrap max-h-40 overflow-y-auto">
                {generateRelanceMailText(relanceAdherent)}
              </div>

              <div className="flex items-center gap-2">
                {relanceAdherent.email && (
                  <a
                    href={`mailto:${relanceAdherent.email}?subject=${encodeURIComponent('Tennis Club de Muzillac - Régularisation de votre cotisation 2026/2027')}&body=${encodeURIComponent(generateRelanceMailText(relanceAdherent))}`}
                    className="flex-1 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Ouvrir l'application Mail</span>
                  </a>
                )}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generateRelanceMailText(relanceAdherent));
                    setCopiedRelanceMail(true);
                    setTimeout(() => setCopiedRelanceMail(false), 2000);
                  }}
                  className="py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  {copiedRelanceMail ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedRelanceMail ? 'Copié !' : 'Copier Email'}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ==================== MODAL ATTESTATION DE PAIEMENT & LICENCE ==================== */}
      {attestationAdherent && (() => {
        const doc = generateAttestationContent(attestationAdherent);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-2xl bg-white text-zinc-900 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 max-h-[92vh] overflow-y-auto">
              
              {/* Header document */}
              <div className="flex items-start justify-between border-b-2 border-orange-500 pb-4">
                <div>
                  <h2 className="text-xl font-black font-heading tracking-tight text-orange-600">
                    TENNIS CLUB DE MUZILLAC (TCM)
                  </h2>
                  <p className="text-xs text-zinc-600">
                    Affilié FFT • Code Club : {doc.codeClub} • Ligue de Bretagne
                  </p>
                  <p className="text-xs text-zinc-500">
                    {clubInfo.adresse}, {clubInfo.codePostal} {clubInfo.ville}
                  </p>
                </div>

                <div className="text-right">
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                    SOLDE ACQUITTÉ
                  </span>
                  <p className="text-[11px] text-zinc-500 mt-1">Date : {doc.dateJour}</p>
                </div>
              </div>

              {/* Titre officiel */}
              <div className="text-center py-2">
                <h1 className="text-lg sm:text-xl font-heading font-black uppercase tracking-wider text-zinc-900">
                  ATTESTATION DE COTISATION & LICENCE FFT
                </h1>
                <p className="text-xs text-zinc-500 font-semibold mt-0.5">
                  Saison Sportive Officielle {doc.saison}
                </p>
              </div>

              {/* Corps de l'attestation */}
              <div className="space-y-4 text-xs sm:text-sm text-zinc-800 leading-relaxed">
                <p>
                  Je soussigné, <strong>{doc.president}</strong>, agissant en qualité de Président du <strong>{doc.clubNom}</strong>, certifie par la présente que :
                </p>

                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-zinc-500 text-xs block">Nom & Prénom de l'adhérent :</span>
                      <strong className="text-zinc-900 text-base">{doc.adherentNom}</strong>
                    </div>
                    <div>
                      <span className="text-zinc-500 text-xs block">Date de naissance :</span>
                      <strong className="text-zinc-900">{doc.dateNaissance}</strong>
                    </div>
                    <div>
                      <span className="text-zinc-500 text-xs block">Numéro de Licence FFT :</span>
                      <strong className="text-zinc-900 font-mono">{doc.licence}</strong>
                    </div>
                    <div>
                      <span className="text-zinc-500 text-xs block">Formule / Groupe :</span>
                      <strong className="text-zinc-900">{doc.groupe}</strong>
                    </div>
                  </div>
                </div>

                <p>
                  Est bien inscrit(e) et titulaire d'une licence au sein de notre association sportive pour la saison <strong>{doc.saison}</strong>, et s'est <strong>intégralement acquitté(e)</strong> du montant de sa cotisation et de ses cours de tennis.
                </p>

                <p className="text-xs text-zinc-600 italic">
                  Cette attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit (Comités d'entreprise, Pass'Sport, CAF, mutuelles ou participation employeur).
                </p>
              </div>

              {/* Signature & Cachet */}
              <div className="flex items-end justify-between pt-4 border-t border-zinc-200">
                <div className="text-xs text-zinc-500">
                  <p>Fait à Muzillac,</p>
                  <p>Le {doc.dateJour}</p>
                </div>

                <div className="text-right">
                  <p className="text-xs font-bold text-zinc-800">Pour le Tennis Club de Muzillac</p>
                  <p className="text-xs text-zinc-600">Le Bureau & la Direction Pédagogique</p>
                  <div className="w-28 h-12 border border-dashed border-zinc-300 rounded-lg mt-1 flex items-center justify-center text-[10px] text-zinc-400 uppercase font-bold">
                    Cachet TCM
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-4 border-t border-zinc-200 flex items-center justify-between no-print">
                <button
                  onClick={() => setAttestationAdherent(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-200 hover:bg-zinc-300 text-zinc-800 text-xs font-bold transition cursor-pointer"
                >
                  Fermer
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      const text = `ATTESTATION DE COTISATION TCM\nAdhérent : ${doc.adherentNom}\nLicence FFT : ${doc.licence}\nSaison : ${doc.saison}\nSolde : ACQUITTÉ\nFait à Muzillac le ${doc.dateJour}`;
                      navigator.clipboard.writeText(text);
                      setCopiedAttestation(true);
                      setTimeout(() => setCopiedAttestation(false), 2000);
                    }}
                    className="px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedAttestation ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedAttestation ? 'Copié !' : 'Copier'}</span>
                  </button>

                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Imprimer / Télécharger PDF</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
};
