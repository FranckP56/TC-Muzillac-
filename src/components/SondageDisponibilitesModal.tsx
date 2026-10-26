import React, { useState, useMemo } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  MapPin, 
  MessageSquare, 
  Phone, 
  Mail, 
  Copy, 
  Check, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  Users, 
  Search, 
  Plus, 
  Sparkles,
  ClipboardCheck,
  Send,
  UserCheck
} from 'lucide-react';
import { Rencontre, Adherent, JoueurDisponibilite, DisponibiliteStatut, PreferenceJeu, CreneauPrefere } from '../types/tennis';
import { filterLicenciesMuzillac2027 } from '../utils/licencies';

interface SondageDisponibilitesModalProps {
  rencontre: Rencontre | null;
  adherents: Adherent[];
  isOpen: boolean;
  onClose: () => void;
  onUpdateDisponibilites: (rencontreId: string, disponibilites: JoueurDisponibilite[]) => void;
  onOpenComposition?: (rencontre: Rencontre) => void;
}

export const SondageDisponibilitesModal: React.FC<SondageDisponibilitesModalProps> = ({
  rencontre,
  adherents,
  isOpen,
  onClose,
  onUpdateDisponibilites,
  onOpenComposition,
}) => {
  if (!isOpen || !rencontre) return null;

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatut, setFilterStatut] = useState<'all' | DisponibiliteStatut | 'sans_reponse'>('all');
  const [copiedSms, setCopiedSms] = useState(false);

  // État local des réponses
  const [disponibilites, setDisponibilites] = useState<JoueurDisponibilite[]>(() => {
    return rencontre.disponibilites || [];
  });

  // Base des licenciés 2027 du club éligibles pour cette catégorie
  const licencies2027 = useMemo(() => {
    const list = filterLicenciesMuzillac2027(adherents);
    const reqSex = rencontre.sexeHomologation;
    return list.filter(adh => {
      if (reqSex === 'Mixte') return true;
      const adhSex = adh.civilite === 'Madame' ? 'Dames' : 'Messieurs';
      return adhSex === reqSex;
    });
  }, [adherents, rencontre]);

  // Map des réponses par ID adhérent
  const dispoByAdhId = useMemo(() => {
    const map = new Map<string, JoueurDisponibilite>();
    disponibilites.forEach(d => map.set(d.adherentId, d));
    return map;
  }, [disponibilites]);

  // Statistiques de réponses
  const stats = useMemo(() => {
    let dispoCount = 0;
    let indispoCount = 0;
    let incertainCount = 0;
    let simpleEtDouble = 0;
    let simpleSeul = 0;
    let doubleSeul = 0;

    disponibilites.forEach(d => {
      if (d.statut === 'disponible') {
        dispoCount++;
        if (d.preferenceJeu === 'simple_et_double') simpleEtDouble++;
        else if (d.preferenceJeu === 'simple_seul') simpleSeul++;
        else if (d.preferenceJeu === 'double_seul') doubleSeul++;
      } else if (d.statut === 'indisponible') {
        indispoCount++;
      } else if (d.statut === 'incertain') {
        incertainCount++;
      }
    });

    const sansReponse = Math.max(0, licencies2027.length - disponibilites.length);

    return {
      dispoCount,
      indispoCount,
      incertainCount,
      sansReponse,
      simpleEtDouble,
      simpleSeul,
      doubleSeul,
    };
  }, [disponibilites, licencies2027]);

  // Mise à jour ou création d'une réponse
  const handleSetStatut = (
    adherent: Adherent, 
    statut: DisponibiliteStatut,
    pref: PreferenceJeu = 'simple_et_double',
    creneau: CreneauPrefere = 'journee',
    commentaire: string = ''
  ) => {
    const existing = dispoByAdhId.get(adherent.id);
    const updated: JoueurDisponibilite = {
      adherentId: adherent.id,
      nomPrenom: adherent.nomPrenom,
      classement: adherent.dernierClassTennis,
      statut,
      preferenceJeu: existing?.preferenceJeu || pref,
      creneauPrefere: existing?.creneauPrefere || creneau,
      commentaire: existing?.commentaire || commentaire,
      dateReponse: new Date().toLocaleDateString('fr-FR'),
    };

    const newDispos = disponibilites.filter(d => d.adherentId !== adherent.id);
    newDispos.push(updated);
    setDisponibilites(newDispos);
    onUpdateDisponibilites(rencontre.id, newDispos);
  };

  const handleUpdateOption = (
    adherentId: string, 
    field: 'preferenceJeu' | 'creneauPrefere' | 'commentaire',
    value: any
  ) => {
    const newDispos = disponibilites.map(d => {
      if (d.adherentId === adherentId) {
        return { ...d, [field]: value };
      }
      return d;
    });
    setDisponibilites(newDispos);
    onUpdateDisponibilites(rencontre.id, newDispos);
  };

  const handleRemoveDispo = (adherentId: string) => {
    const newDispos = disponibilites.filter(d => d.adherentId !== adherentId);
    setDisponibilites(newDispos);
    onUpdateDisponibilites(rencontre.id, newDispos);
  };

  // Génération du texte de message type (SMS / WhatsApp / Mail)
  const invitationMessage = useMemo(() => {
    const heure = rencontre.composition?.heureDebut || '14:00';
    const lieu = rencontre.composition?.lieuRencontre || (rencontre.clubAccueilNom.toLowerCase().includes('muzillac') ? 'Clos des Moines (Muzillac)' : `${rencontre.clubAccueilNom} (Déplacement)`);
    return `🎾 SONDAGE INTERCLUBS TCM 🎾\nRencontre : ${rencontre.numeroEquipe} vs ${rencontre.clubVisiteurNom}\n📅 Date : ${rencontre.dateRencontre} à partir de ${heure}\n📍 Lieu : ${lieu}\n\nMerci de répondre rapidement pour tes disponibilités :\n1. Dispo ? (Oui / Non / Incertain)\n2. Prêt pour : Simple seul, Double seul ou Simple & Double ?\n3. Créneaux : Matin (9h) ou Après-midi (14h) ?\n\nMerci d'avance pour l'équipe !`;
  }, [rencontre]);

  const handleCopyInvitation = () => {
    navigator.clipboard.writeText(invitationMessage);
    setCopiedSms(true);
    setTimeout(() => setCopiedSms(false), 2500);
  };

  // Filtrage des licenciés pour la liste
  const filteredLicencies = useMemo(() => {
    return licencies2027.filter(adh => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q || adh.nomPrenom.toLowerCase().includes(q) || adh.dernierClassTennis.toLowerCase().includes(q);
      if (!matchQuery) return false;

      const resp = dispoByAdhId.get(adh.id);
      if (filterStatut === 'all') return true;
      if (filterStatut === 'sans_reponse') return !resp;
      return resp?.statut === filterStatut;
    });
  }, [licencies2027, searchQuery, filterStatut, dispoByAdhId]);

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-4xl bg-[#141820] border border-[#2b3342] rounded-3xl overflow-hidden shadow-2xl my-4 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* ==================== EN-TÊTE ==================== */}
        <div className="p-5 sm:p-6 border-b border-[#252b37] bg-gradient-to-r from-[#1c222e] to-[#12151b] flex items-start justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E65100] to-[#FF6D00] flex items-center justify-center text-white shadow-lg shadow-orange-950/60 shrink-0">
              <ClipboardCheck className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#E65100]/25 text-[#FF6D00] border border-[#E65100]/40">
                  {rencontre.numeroEquipe}
                </span>
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/40">
                  {rencontre.categorieAgeHomologation} • {rencontre.sexeHomologation}
                </span>
                <span className="text-xs text-orange-400 font-bold flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {rencontre.dateRencontre}
                </span>
                <span className="text-xs text-zinc-300 font-bold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  dès {rencontre.composition?.heureDebut || '14:00'}
                </span>
              </div>

              <h2 className="text-lg sm:text-xl font-heading font-black text-white mt-1">
                Sondage des Disponibilités Joueurs
              </h2>
              <p className="text-xs text-zinc-400 flex items-center gap-2 flex-wrap">
                <span>{rencontre.clubAccueilNom} vs {rencontre.clubVisiteurNom}</span>
                <span>•</span>
                <span className="flex items-center gap-1 text-zinc-300">
                  <MapPin className="w-3 h-3 text-orange-400" />
                  {rencontre.composition?.lieuRencontre || 'Muzillac'}
                </span>
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

        {/* ==================== BANDEAU RÉCAPITULATIF & SONDAGE SMS ==================== */}
        <div className="px-5 sm:px-6 py-3 bg-[#0d0f14] border-b border-[#232936] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          
          {/* Compteurs rapides */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-xl font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{stats.dispoCount} Disponible{stats.dispoCount > 1 ? 's' : ''}</span>
            </span>

            <span className="px-2.5 py-1 rounded-xl font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" />
              <span>{stats.indispoCount} Indisponible{stats.indispoCount > 1 ? 's' : ''}</span>
            </span>

            {stats.incertainCount > 0 && (
              <span className="px-2.5 py-1 rounded-xl font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>{stats.incertainCount} Incertain{stats.incertainCount > 1 ? 's' : ''}</span>
              </span>
            )}

            <span className="px-2.5 py-1 rounded-xl font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
              {stats.sansReponse} en attente
            </span>
          </div>

          {/* Boutons d'envoi du sondage aux licenciés */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyInvitation}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm ${
                copiedSms 
                  ? 'bg-emerald-600 border-emerald-400 text-white' 
                  : 'bg-orange-950/40 hover:bg-orange-900/50 border-orange-500/50 text-orange-300 hover:text-white'
              }`}
              title="Copier le message complet de convocation/sondage pour SMS ou WhatsApp"
            >
              {copiedSms ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSms ? 'Copié dans le presse-papier !' : 'Copier SMS / WhatsApp de sondage'}</span>
            </button>

            {onOpenComposition && (
              <button
                onClick={() => {
                  onClose();
                  onOpenComposition(rencontre);
                }}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#BF360C] to-[#E65100] text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm hover:brightness-110"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Aller à la composition</span>
              </button>
            )}
          </div>
        </div>

        {/* ==================== FILTRES & RECHERCHE ==================== */}
        <div className="p-4 bg-[#101319] border-b border-[#232936] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          {/* Recherche joueur */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un licencié 2027..."
              className="w-full bg-[#181d26] border border-[#27303f] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* Filtres par statut */}
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <button
              onClick={() => setFilterStatut('all')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                filterStatut === 'all'
                  ? 'bg-orange-500/25 text-orange-400 border border-orange-500/40'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              Tous ({licencies2027.length})
            </button>
            <button
              onClick={() => setFilterStatut('disponible')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                filterStatut === 'disponible'
                  ? 'bg-emerald-500/25 text-emerald-400 border border-emerald-500/40'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              Disponibles ({stats.dispoCount})
            </button>
            <button
              onClick={() => setFilterStatut('indisponible')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                filterStatut === 'indisponible'
                  ? 'bg-rose-500/25 text-rose-400 border border-rose-500/40'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              Indisponibles ({stats.indispoCount})
            </button>
            <button
              onClick={() => setFilterStatut('incertain')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                filterStatut === 'incertain'
                  ? 'bg-amber-500/25 text-amber-400 border border-amber-500/40'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              Incertains ({stats.incertainCount})
            </button>
            <button
              onClick={() => setFilterStatut('sans_reponse')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                filterStatut === 'sans_reponse'
                  ? 'bg-zinc-700 text-white border border-zinc-600'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              Sans réponse ({stats.sansReponse})
            </button>
          </div>
        </div>

        {/* ==================== LISTE DES JOUEURS & RÉPONSES ==================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5">
          {filteredLicencies.length > 0 ? (
            filteredLicencies.map((adherent) => {
              const dispo = dispoByAdhId.get(adherent.id);
              const statut = dispo?.statut;

              return (
                <div
                  key={adherent.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    statut === 'disponible'
                      ? 'bg-emerald-950/20 border-emerald-500/40 shadow-sm'
                      : statut === 'indisponible'
                        ? 'bg-rose-950/15 border-rose-900/30 opacity-75'
                        : statut === 'incertain'
                          ? 'bg-amber-950/20 border-amber-500/30'
                          : 'bg-[#151921] border-[#252b37] hover:border-zinc-700'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                    
                    {/* Infos Joueur */}
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                        statut === 'disponible'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : statut === 'indisponible'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                            : statut === 'incertain'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                              : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      }`}>
                        {statut === 'disponible' ? '✓' : statut === 'indisponible' ? '✕' : statut === 'incertain' ? '?' : '—'}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-heading font-black text-white text-sm truncate">
                            {adherent.nomPrenom}
                          </span>
                          <span className="px-2 py-0.2 rounded font-black bg-orange-500/15 text-orange-400 border border-orange-500/30 text-[10px]">
                            {adherent.dernierClassTennis}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5">
                          <span>Licence {adherent.licence}</span>
                          <span>•</span>
                          <span>{adherent.ageSportif ? `${adherent.ageSportif} ans` : 'Senior'}</span>
                          {adherent.telephonePortable && (
                            <>
                              <span>•</span>
                              <a href={`tel:${adherent.telephonePortable}`} className="text-zinc-300 hover:text-white flex items-center gap-1 font-mono">
                                <Phone className="w-3 h-3 text-emerald-400" />
                                <span>{adherent.telephonePortable}</span>
                              </a>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Boutons d'état Disponibilité */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleSetStatut(adherent, 'disponible')}
                        className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer ${
                          statut === 'disponible'
                            ? 'bg-emerald-600 text-white shadow'
                            : 'bg-[#1e2430] hover:bg-emerald-950/40 hover:text-emerald-300 text-zinc-400 border border-zinc-700'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Dispo</span>
                      </button>

                      <button
                        onClick={() => handleSetStatut(adherent, 'indisponible')}
                        className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer ${
                          statut === 'indisponible'
                            ? 'bg-rose-600 text-white shadow'
                            : 'bg-[#1e2430] hover:bg-rose-950/40 hover:text-rose-300 text-zinc-400 border border-zinc-700'
                        }`}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Indispo</span>
                      </button>

                      <button
                        onClick={() => handleSetStatut(adherent, 'incertain')}
                        className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer ${
                          statut === 'incertain'
                            ? 'bg-amber-600 text-white shadow'
                            : 'bg-[#1e2430] hover:bg-amber-950/40 hover:text-amber-300 text-zinc-400 border border-zinc-700'
                        }`}
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>Incertain</span>
                      </button>

                      {dispo && (
                        <button
                          onClick={() => handleRemoveDispo(adherent.id)}
                          className="p-1.5 text-zinc-500 hover:text-rose-400 rounded-lg hover:bg-zinc-800 transition"
                          title="Réinitialiser la réponse"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                  </div>

                  {/* Options de jeu si DISPONIBLE */}
                  {statut === 'disponible' && dispo && (
                    <div className="mt-3 pt-2.5 border-t border-emerald-500/20 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
                      
                      {/* 1. Préférence Simple / Double */}
                      <div>
                        <label className="text-zinc-400 font-bold block mb-1">Préférence de jeu :</label>
                        <select
                          value={dispo.preferenceJeu || 'simple_et_double'}
                          onChange={(e) => handleUpdateOption(adherent.id, 'preferenceJeu', e.target.value as PreferenceJeu)}
                          className="w-full bg-black/50 border border-emerald-500/40 rounded-xl px-2 py-1 text-emerald-200 focus:outline-none"
                        >
                          <option value="simple_et_double">🎾 Simple ET Double (Les 2)</option>
                          <option value="simple_seul">👤 Simple seul</option>
                          <option value="double_seul">👥 Double seul</option>
                        </select>
                      </div>

                      {/* 2. Créneau accepté */}
                      <div>
                        <label className="text-zinc-400 font-bold block mb-1">Créneau horaire :</label>
                        <select
                          value={dispo.creneauPrefere || 'journee'}
                          onChange={(e) => handleUpdateOption(adherent.id, 'creneauPrefere', e.target.value as CreneauPrefere)}
                          className="w-full bg-black/50 border border-emerald-500/40 rounded-xl px-2 py-1 text-emerald-200 focus:outline-none"
                        >
                          <option value="journee">☀️ Journée entière</option>
                          <option value="matin_9h">🌅 Matin uniquement (9h)</option>
                          <option value="apres_midi_14h">🌇 Après-midi uniquement (14h)</option>
                        </select>
                      </div>

                      {/* 3. Note ou contrainte */}
                      <div>
                        <label className="text-zinc-400 font-bold block mb-1">Remarque / Covoiturage :</label>
                        <input
                          type="text"
                          value={dispo.commentaire || ''}
                          onChange={(e) => handleUpdateOption(adherent.id, 'commentaire', e.target.value)}
                          placeholder="Ex: Doit partir à 17h, covoiturage..."
                          className="w-full bg-black/50 border border-emerald-500/40 rounded-xl px-2.5 py-1 text-white placeholder-zinc-500 focus:outline-none"
                        />
                      </div>

                    </div>
                  )}

                  {/* Commentaire si incertain */}
                  {statut === 'incertain' && dispo && (
                    <div className="mt-2.5 pt-2 border-t border-amber-500/20 text-[11px]">
                      <input
                        type="text"
                        value={dispo.commentaire || ''}
                        onChange={(e) => handleUpdateOption(adherent.id, 'commentaire', e.target.value)}
                        placeholder="Raison de l'incertitude (ex: attente planning pro, blessure...)"
                        className="w-full bg-black/40 border border-amber-500/40 rounded-xl px-2.5 py-1 text-amber-200 placeholder-zinc-500 focus:outline-none"
                      />
                    </div>
                  )}

                </div>
              );
            })
          ) : (
            <div className="p-8 text-center bg-[#101319] rounded-2xl border border-zinc-800 text-xs text-zinc-400">
              Aucun licencié ne correspond à votre recherche.
            </div>
          )}
        </div>

        {/* ==================== PIED DE PAGE ==================== */}
        <div className="p-4 bg-[#0d0f14] border-t border-[#232936] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <p className="text-zinc-400 text-[11px]">
            {stats.dispoCount} joueur{stats.dispoCount > 1 ? 's' : ''} disponible{stats.dispoCount > 1 ? 's' : ''} pour cette rencontre ({stats.simpleEtDouble} pour Simple & Double, {stats.simpleSeul} Simple seul, {stats.doubleSeul} Double seul).
          </p>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold transition cursor-pointer shadow"
          >
            Fermer le sondage
          </button>
        </div>

      </div>
    </div>
  );
};
