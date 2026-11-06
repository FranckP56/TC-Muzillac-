import React from 'react';
import { 
  X, 
  Phone, 
  MessageSquare, 
  Mail, 
  Copy, 
  Check, 
  CheckCircle2, 
  Calendar, 
  BookOpen, 
  CreditCard,
  ShieldAlert,
  Award,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { Adherent } from '../types/tennis';
import { getRankingMeta, cleanRanking, isValidTennisRanking } from '../utils/ranking';
import { extractBirthYear } from '../utils/fftEligibility';

interface AdherentModalProps {
  adherent: Adherent | null;
  onClose: () => void;
  onUpdateSolde?: (id: string, newSolde: number) => void;
  adherentsList?: Adherent[];
  onSelectAdherent?: (adherent: Adherent) => void;
}

export const AdherentModal: React.FC<AdherentModalProps> = ({
  adherent,
  onClose,
  adherentsList,
  onSelectAdherent,
}) => {
  const [copiedField, setCopiedField] = React.useState<string | null>(null);
  const [direction, setDirection] = React.useState<number>(1);

  // Valeurs animées pour le drag interactif en temps réel (déplacement & rotation angulaire)
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-250, 250], [-10, 10]);

  // Indexation pour la navigation / slider entre licenciés selon les filtres actifs
  const currentIndex = adherentsList && adherent
    ? adherentsList.findIndex((a) => a.id === adherent.id)
    : -1;
  const totalInList = adherentsList ? adherentsList.length : 0;
  const hasMultiple = totalInList > 1 && currentIndex !== -1;

  const handlePrev = React.useCallback(() => {
    if (!hasMultiple || !adherentsList || !onSelectAdherent) return;
    setDirection(-1);
    const prevIdx = (currentIndex - 1 + totalInList) % totalInList;
    onSelectAdherent(adherentsList[prevIdx]);
  }, [hasMultiple, adherentsList, currentIndex, totalInList, onSelectAdherent]);

  const handleNext = React.useCallback(() => {
    if (!hasMultiple || !adherentsList || !onSelectAdherent) return;
    setDirection(1);
    const nextIdx = (currentIndex + 1) % totalInList;
    onSelectAdherent(adherentsList[nextIdx]);
  }, [hasMultiple, adherentsList, currentIndex, totalInList, onSelectAdherent]);

  // Gestion du glissement tactile ou à la souris (Deck swipe avec inertie)
  const handleDragEnd = (_event: any, info: { offset: { x: number }; velocity: { x: number } }) => {
    const swipeThreshold = 55;
    if (info.offset.x < -swipeThreshold || info.velocity.x < -250) {
      handleNext();
    } else if (info.offset.x > swipeThreshold || info.velocity.x > 250) {
      handlePrev();
    }
  };

  // Raccourcis clavier (Flèches gauche / droite et touche Echap)
  React.useEffect(() => {
    if (!adherent) return;
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
  }, [handlePrev, handleNext, onClose, adherent]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Règle des hooks : l'early return est placé après tous les hooks
  if (!adherent) return null;

  const isFemme = adherent.civilite === 'Madame';
  const meta = getRankingMeta(adherent.dernierClassTennis);
  const birthYear = extractBirthYear(adherent.dateNaissance);
  const ageSportif2027 = birthYear ? 2027 - birthYear : null;
  const ageDisplay = adherent.ageSportif ? `${adherent.ageSportif} ans` : (ageSportif2027 ? `${ageSportif2027} ans` : null);

  // Thème contrasté selon le sexe pour ressortir nettement sur fond noir
  const theme = isFemme ? {
    containerBorder: 'border-[#752a6a]',
    containerBg: 'bg-[#190d1a]',
    headerBg: 'bg-gradient-to-b from-[#2d122f] via-[#200c22] to-[#170818]',
    headerBorder: 'border-[#752a6a]',
    glowBg: 'bg-pink-500/25',
    closeBtn: 'bg-[#3b153d] hover:bg-[#521c55] text-pink-200 hover:text-white border border-[#752a6a]',
    nameText: 'text-pink-50',
    actionBtn: 'bg-[#29112b] hover:bg-[#3d1740] border-[#752a6a] hover:border-pink-400 text-pink-200 hover:text-white',
    infoBoxBg: 'bg-[#120713]',
    infoBoxBorder: 'border-[#551d4d]',
    infoRowBorder: 'border-[#381233]',
  } : {
    containerBorder: 'border-[#2d5284]',
    containerBg: 'bg-[#0c1421]',
    headerBg: 'bg-gradient-to-b from-[#142642] via-[#0f1c30] to-[#0a121e]',
    headerBorder: 'border-[#2d5284]',
    glowBg: 'bg-blue-500/25',
    closeBtn: 'bg-[#1b3152] hover:bg-[#25436f] text-blue-200 hover:text-white border border-[#2d5284]',
    nameText: 'text-blue-50',
    actionBtn: 'bg-[#13233c] hover:bg-[#1a3154] border-[#2d5284] hover:border-blue-400 text-blue-200 hover:text-white',
    infoBoxBg: 'bg-[#070d17]',
    infoBoxBorder: 'border-[#1e385c]',
    infoRowBorder: 'border-[#172b47]',
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      {/* ==================== BOUTON FLÉCHÉS & COMPTEUR HORS DE LA BULLE (AU-DESSUS) ==================== */}
      {hasMultiple && (
        <div 
          className="shrink-0 mb-2.5 z-20 flex items-center justify-center animate-in fade-in slide-in-from-top-2 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`flex items-center gap-2 ${theme.containerBg} ${theme.containerBorder} border-2 rounded-full py-1.5 px-3.5 shadow-2xl shadow-black`}>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Licencié précédent"
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
              aria-label="Licencié suivant"
              title="Suivant (Flèche droite ou glissement)"
              className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ==================== BULLE PRINCIPALE DE LA FICHE (ANIMATION DECK & DRAG TACTILE) ==================== */}
      <div className="relative w-full max-w-lg flex items-center justify-center my-auto">
        {/* Silhouette de carte arrière pour l'effet "paquet de cartes" physique */}
        {hasMultiple && (
          <div 
            aria-hidden="true"
            className={`absolute inset-0 rounded-3xl border-2 ${theme.containerBorder} ${theme.containerBg} opacity-30 scale-[0.96] translate-y-2 pointer-events-none shadow-xl`}
          />
        )}

        <AnimatePresence mode="popLayout" custom={direction}>
          <motion.div
            key={adherent.id}
            custom={direction}
            variants={{
              enter: (dir: number) => ({
                x: dir > 0 ? 130 : -130,
                rotate: dir > 0 ? 5 : -5,
                opacity: 0,
                scale: 0.94,
              }),
              center: {
                x: 0,
                rotate: 0,
                opacity: 1,
                scale: 1,
              },
              exit: (dir: number) => ({
                x: dir > 0 ? -170 : 170,
                rotate: dir > 0 ? -7 : 7,
                opacity: 0,
                scale: 0.94,
              }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              type: "spring",
              stiffness: 340,
              damping: 28,
              mass: 0.8
            }}
            drag={hasMultiple ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.65}
            onDragEnd={handleDragEnd}
            style={{ x, rotate, touchAction: 'pan-y' }}
            className={`relative w-full max-h-[88dvh] sm:max-h-[85vh] flex flex-col rounded-3xl border-2 ${theme.containerBorder} ${theme.containerBg} shadow-2xl shadow-black overflow-hidden ${hasMultiple ? 'cursor-grab active:cursor-grabbing' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ==================== 1. CARTOUCHE D'EN-TÊTE ÉPURÉ ==================== */}
            <div className={`shrink-0 relative ${theme.headerBg} p-4 sm:p-5 border-b ${theme.headerBorder}`}>
              <div className={`absolute top-0 right-0 w-36 h-36 ${theme.glowBg} rounded-full blur-2xl pointer-events-none`} />

          {/* Ligne principale : Macaron Classement + Nom Prénom EN ENTIER + Croix de retour abaissée */}
          <div className="flex items-center justify-between gap-3 sm:gap-4 relative z-10">
            {/* Badge Classement FFT */}
            <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex flex-col items-center justify-center font-heading font-black border ${meta.badgeBg} ${meta.badgeBorder} ${meta.badgeText} shadow-md shrink-0`}>
              <span className="text-base sm:text-lg leading-tight">{adherent.dernierClassTennis || 'NC'}</span>
              <span className="text-[9px] font-bold uppercase tracking-wider opacity-85">
                {meta.serie}
              </span>
              {(() => {
                const maxRank = cleanRanking(adherent.meilleurClassTennis, '');
                if (maxRank && maxRank !== adherent.dernierClassTennis && isValidTennisRanking(maxRank)) {
                  return (
                    <span className="text-[8px] font-bold opacity-80 mt-0.5" title="Meilleur classement FFT">
                      Max {maxRank}
                    </span>
                  );
                }
                return null;
              })()}
            </div>

            {/* Nom & Prénom affichés EN ENTIER (sans troncature) */}
            <div className="min-w-0 flex-1">
              <h2 className={`text-base sm:text-lg font-heading font-black ${theme.nameText} leading-snug break-words`}>
                {adherent.nomPrenom}
              </h2>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-300 font-medium">
                {ageDisplay && (
                  <span>{ageDisplay}</span>
                )}
                {birthYear && (
                  <span className="text-zinc-400">• Né(e) en {birthYear}</span>
                )}
              </div>
            </div>

            {/* Bouton Fermer abaissé (centré verticalement dans le cartouche) */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer la fiche"
              className={`w-9 h-9 rounded-full ${theme.closeBtn} flex items-center justify-center transition cursor-pointer shrink-0`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ==================== 2. RACCOURCIS APPELS, SMS ET EMAIL ==================== */}
        {/* Placés directement sous le cartouche */}
        <div className={`shrink-0 grid grid-cols-3 gap-2 p-3 sm:px-5 border-b ${theme.headerBorder} bg-black/30`}>
          {/* Appel */}
          <a
            href={adherent.telephonePortable ? `tel:${adherent.telephonePortable}` : undefined}
            className={`flex items-center justify-center gap-2 py-2 px-2.5 rounded-xl text-xs font-bold transition border ${
              adherent.telephonePortable
                ? `${theme.actionBtn} hover:border-emerald-400 hover:text-emerald-300 cursor-pointer shadow-sm`
                : 'opacity-35 pointer-events-none border-transparent text-zinc-600'
            }`}
            title={adherent.telephonePortable ? `Appeler le ${adherent.telephonePortable}` : 'Téléphone non renseigné'}
          >
            <Phone className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            <span className="truncate">Appel</span>
          </a>

          {/* SMS */}
          <a
            href={adherent.telephonePortable ? `sms:${adherent.telephonePortable}` : undefined}
            className={`flex items-center justify-center gap-2 py-2 px-2.5 rounded-xl text-xs font-bold transition border ${
              adherent.telephonePortable
                ? `${theme.actionBtn} hover:border-sky-400 hover:text-sky-300 cursor-pointer shadow-sm`
                : 'opacity-35 pointer-events-none border-transparent text-zinc-600'
            }`}
            title={adherent.telephonePortable ? `Envoyer un SMS au ${adherent.telephonePortable}` : 'Téléphone non renseigné'}
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0 text-sky-400" />
            <span className="truncate">SMS</span>
          </a>

          {/* Email */}
          <a
            href={adherent.email ? `mailto:${adherent.email}?subject=Message%20Muzillac%20Tennis%20Club` : undefined}
            className={`flex items-center justify-center gap-2 py-2 px-2.5 rounded-xl text-xs font-bold transition border ${
              adherent.email
                ? `${theme.actionBtn} hover:border-orange-400 hover:text-orange-300 cursor-pointer shadow-sm`
                : 'opacity-35 pointer-events-none border-transparent text-zinc-600'
            }`}
            title={adherent.email ? `Écrire à ${adherent.email}` : 'Email non renseigné'}
          >
            <Mail className="w-3.5 h-3.5 shrink-0 text-orange-400" />
            <span className="truncate">Email</span>
          </a>
        </div>

        {/* ==================== 3. CORPS DE LA FICHE DÉTAILLÉE ==================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">

          {/* Alerte si Classement ND (Non Déterminé) */}
          {meta.isND && (
            <div className="p-3.5 rounded-2xl bg-rose-950/50 border border-rose-500/70 text-rose-200 text-xs space-y-1.5 shadow-lg">
              <div className="flex items-center space-x-2 text-rose-300 font-heading font-black text-xs">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>CLASSEMENT ND — RECLASSEMENT REQUIS</span>
              </div>
              <p className="text-zinc-200 leading-snug text-[11px]">
                Dernier classement FFT <strong>ND</strong>. Meilleur classement enregistré : <strong>{adherent.meilleurClassTennis || '15/3'}</strong>. Reclassement nécessaire auprès de la Ligue pour toute compétition officielle.
              </p>
            </div>
          )}

          {/* Grille des informations : Chaque ligne reste strictement sur une seule ligne */}
          <div className={`${theme.infoBoxBg} p-3.5 sm:p-4 rounded-2xl border ${theme.infoBoxBorder} text-xs space-y-2`}>
            
            {/* Téléphone sur une seule ligne */}
            <div className={`flex items-center justify-between gap-2 py-1.5 border-b ${theme.infoRowBorder}`}>
              <span className="text-zinc-400 flex items-center gap-2 shrink-0 font-medium">
                <Phone className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span>Téléphone</span>
              </span>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-mono font-semibold text-white truncate text-xs">
                  {adherent.telephonePortable || 'Non renseigné'}
                </span>
                {adherent.telephonePortable && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(adherent.telephonePortable, 'phone')}
                    className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer shrink-0"
                    title="Copier le numéro"
                  >
                    {copiedField === 'phone' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>

            {/* Email sur une seule ligne */}
            <div className={`flex items-center justify-between gap-2 py-1.5 border-b ${theme.infoRowBorder}`}>
              <span className="text-zinc-400 flex items-center gap-2 shrink-0 font-medium">
                <Mail className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span>Email</span>
              </span>
              <div className="flex items-center gap-1.5 min-w-0 max-w-[65%]">
                <span className="font-semibold text-white truncate text-xs" title={adherent.email}>
                  {adherent.email || 'Non renseigné'}
                </span>
                {adherent.email && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(adherent.email, 'email')}
                    className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer shrink-0"
                    title="Copier l'email"
                  >
                    {copiedField === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>

            {/* Numéro de Licence FFT & Statut sur une seule ligne */}
            <div className={`flex items-center justify-between gap-2 py-1.5 border-b ${theme.infoRowBorder}`}>
              <span className="text-zinc-400 flex items-center gap-2 shrink-0 font-medium">
                <CreditCard className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span>Licence FFT</span>
              </span>
              <div className="flex items-center gap-1.5 min-w-0">
                {adherent.licence ? (
                  <>
                    <span className="font-mono font-bold text-emerald-400 flex items-center gap-1 truncate text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{adherent.licence}</span>
                    </span>
                    {adherent.typeLicence && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700 shrink-0">
                        Type {adherent.typeLicence}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => copyToClipboard(adherent.licence, 'licence')}
                      className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer shrink-0"
                      title="Copier la licence"
                    >
                      {copiedField === 'licence' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </>
                ) : (
                  <span className="text-zinc-500 italic text-xs">
                    Sans licence (Parent / Adhésion libre)
                  </span>
                )}
              </div>
            </div>

            {/* Date de Naissance sur une seule ligne */}
            <div className={`flex items-center justify-between gap-2 py-1.5 border-b ${theme.infoRowBorder}`}>
              <span className="text-zinc-400 flex items-center gap-2 shrink-0 font-medium">
                <Calendar className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span>Naissance</span>
              </span>
              <div className="flex items-center gap-1.5 text-right truncate">
                <span className="font-semibold text-white text-xs">{adherent.dateNaissance || 'Non renseignée'}</span>
                {birthYear && (
                  <span className="text-[11px] text-orange-400 font-semibold shrink-0">
                    ({ageSportif2027} ans)
                  </span>
                )}
              </div>
            </div>

            {/* Groupe d'enseignement sur une seule ligne (si renseigné) */}
            {adherent.groupeEnseignement && (
              <div className={`flex items-center justify-between gap-2 py-1.5 border-b ${theme.infoRowBorder}`}>
                <span className="text-zinc-400 flex items-center gap-2 shrink-0 font-medium">
                  <BookOpen className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span>Groupe</span>
                </span>
                <span className="font-semibold text-white truncate text-xs">{adherent.groupeEnseignement}</span>
              </div>
            )}

            {/* Compte Ten'Up sur une seule ligne */}
            <div className="flex items-center justify-between gap-2 py-1.5">
              <span className="text-zinc-400 flex items-center gap-2 shrink-0 font-medium">
                <Award className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span>Compte Ten'Up</span>
              </span>
              <span className="font-bold text-emerald-400 flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="truncate">{adherent.compteTenUp || 'Actif'}</span>
              </span>
            </div>

          </div>

        </div>

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

