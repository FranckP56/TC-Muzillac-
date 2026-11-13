import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Search,
  ExternalLink,
  Smartphone,
  CalendarCheck,
  CreditCard,
  Trophy,
  ChevronDown,
  ChevronUp,
  MapPin,
  Clock,
  KeyRound,
  ArrowRight,
  Phone,
  Mail,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { ClubInfo } from '../types/tennis';
import imgTenUp from '../assets/images/tuto_tenup_account_1794587046768.jpg';
import imgCourt from '../assets/images/tuto_court_booking_1794587048637.jpg';
import imgPayment from '../assets/images/tuto_payment_options_1794587048297.jpg';
import imgCompetitions from '../assets/images/tuto_team_competitions_1794587049768.jpg';

interface TutosInfosTabProps {
  clubInfo: ClubInfo;
  onNavigateToRencontres: () => void;
  onNavigateToInfos: () => void;
}

interface TutoStep {
  num: string;
  titre: string;
  detail: string;
  conseil?: string;
}

interface TutoGuide {
  id: 'tenup' | 'reservation' | 'paiement' | 'competitions';
  categorie: string;
  titre: string;
  sousTitre: string;
  dureeEstimee: string;
  image: string;
  imageAlt: string;
  accentBorder: string;
  accentBg: string;
  accentText: string;
  icon: React.ReactNode;
  etapes: TutoStep[];
  ctaLabel?: string;
  ctaHref?: string;
  onCtaClick?: () => void;
  secondaryCtaLabel?: string;
  onSecondaryCtaClick?: () => void;
}

export const TutosInfosTab: React.FC<TutosInfosTabProps> = ({
  clubInfo,
  onNavigateToRencontres,
  onNavigateToInfos,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGuideFilter, setActiveGuideFilter] = useState<'all' | TutoGuide['id']>('all');
  const [expandedGuides, setExpandedGuides] = useState<Record<string, boolean>>({
    tenup: true,
    reservation: true,
    paiement: true,
    competitions: true,
  });
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const toggleGuide = (id: string) => {
    setExpandedGuides((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const guides: TutoGuide[] = useMemo(() => {
    const codeClub = clubInfo.codeClub || '52 56 0212';
    const clubNom = clubInfo.nom || 'Tennis Club de Muzillac';

    return [
      {
        id: 'tenup',
        categorie: "Compte FFT & Application",
        titre: "Créer et utiliser son compte Ten'Up",
        sousTitre: "Accédez à votre licence numérique, votre attestation FFT et réservez vos créneaux.",
        dureeEstimee: "4 étapes · 3 min",
        image: imgTenUp,
        imageAlt: "Illustration application mobile Ten'Up",
        accentBorder: "border-orange-500/35",
        accentBg: "bg-orange-500/15",
        accentText: "text-[#FF6D00]",
        icon: <Smartphone className="w-5 h-5 text-[#FF6D00]" />,
        etapes: [
          {
            num: '01',
            titre: "Télécharger Ten'Up ou ouvrir le portail web",
            detail: "Rendez-vous sur tenup.fft.fr depuis votre navigateur ou installez l'application gratuite Ten'Up (App Store / Google Play).",
          },
          {
            num: '02',
            titre: "Créer un compte ou rattacher votre licence",
            detail: "Cliquez sur « Se connecter » puis « Créer un compte ». Utilisez exactement le même email et la même date de naissance que lors de votre inscription au TCM pour lier votre numéro de licence FFT.",
            conseil: "Si vous ne connaissez pas votre numéro de licence ou l'email enregistré, contactez le bureau du club.",
          },
          {
            num: '03',
            titre: "Vérifier votre affiliation au club",
            detail: `Dans votre profil Ten'Up, contrôlez que le club rattaché correspond bien à ${clubNom} (${codeClub}) et que le millésime de licence est actif.`,
          },
          {
            num: '04',
            titre: "Télécharger votre attestation de licence FFT",
            detail: "Depuis « Mon espace > Ma licence », téléchargez votre carte licencié numérique ou suivez l'évolution de votre classement mensuel FFT.",
          },
        ],
        ctaLabel: "Ouvrir Ten'Up",
        ctaHref: "https://tenup.fft.fr",
      },
      {
        id: 'reservation',
        categorie: "Pratique Libre",
        titre: "Réserver un court au club",
        sousTitre: "Planifiez une partie en quelques secondes et accédez aux installations.",
        dureeEstimee: "4 étapes · 2 min",
        image: imgCourt,
        imageAlt: "Illustration réservation de court de tennis",
        accentBorder: "border-emerald-500/35",
        accentBg: "bg-emerald-500/15",
        accentText: "text-emerald-400",
        icon: <CalendarCheck className="w-5 h-5 text-emerald-400" />,
        etapes: [
          {
            num: '01',
            titre: "Ouvrir l'onglet « Jouer / Réserver un court » sur Ten'Up",
            detail: `Connectez-vous à Ten'Up avec votre compte licencié ${clubNom}, puis sélectionnez « Réserver dans mon club ».`,
          },
          {
            num: '02',
            titre: "Choisir le court, la date et le créneau horaire",
            detail: "Sélectionnez le terrain disponible (1h par réservation standard) en tenant compte des créneaux d'école de tennis ou de rencontres par équipes.",
          },
          {
            num: '03',
            titre: "Indiquer votre partenaire de jeu",
            detail: "Saisissez le nom de votre partenaire (membre du club ou invitation selon la formule souscrite) avant de valider définitivement le créneau.",
            conseil: "En cas d'empêchement, annulez votre réservation dès que possible sur Ten'Up pour libérer le terrain aux autres adhérents.",
          },
          {
            num: '04',
            titre: "Accéder aux terrains avec votre badge",
            detail: clubInfo.badgeAccesMessage
              ? `${clubInfo.badgeAccesMessage}${clubInfo.ouvertureCourtsMessage ? ` (${clubInfo.ouvertureCourtsMessage})` : ''}. Présentez votre badge personnel devant le lecteur à l'entrée.`
              : "Présentez votre badge d'accès personnel devant le lecteur de porte à l'entrée du complexe.",
          },
        ],
        ctaLabel: "Réserver sur Ten'Up",
        ctaHref: "https://tenup.fft.fr",
        secondaryCtaLabel: "Voir les installations",
        onSecondaryCtaClick: onNavigateToInfos,
      },
      {
        id: 'paiement',
        categorie: "Adhésions & Cotisations",
        titre: "Régler son adhésion ou ses cours",
        sousTitre: "HelloAsso, chèques échelonnés, Pass'Sport et chèques vacances ANCV.",
        dureeEstimee: "4 étapes · 3 min",
        image: imgPayment,
        imageAlt: "Illustration modalités de paiement adhésion",
        accentBorder: "border-sky-500/35",
        accentBg: "bg-sky-500/15",
        accentText: "text-sky-400",
        icon: <CreditCard className="w-5 h-5 text-sky-400" />,
        etapes: [
          {
            num: '01',
            titre: "Paiement en ligne sécurisé via HelloAsso",
            detail: "Le règlement par carte bancaire (comptant ou en plusieurs échéances selon la formule) s'effectue directement depuis la page HelloAsso officielle du club.",
            conseil: "Lors du récapitulatif HelloAsso, le don volontaire à la plateforme est facultatif et modifiable avant validation.",
          },
          {
            num: '02',
            titre: "Règlement par chèque (1 à 3 fois sans frais)",
            detail: `Vous pouvez déposer un ou plusieurs chèques à l'ordre du « ${clubNom} » lors des permanences au club-house (encaissements échelonnés possibles en début de saison).`,
          },
          {
            num: '03',
            titre: "Utiliser le dispositif Pass'Sport ou ANCV",
            detail: "Transmettez votre code personnel Pass'Sport (reçu par email/SMS de l'État) ou vos chèques vacances ANCV au bureau/enseignant pour déduction immédiate sur votre solde.",
          },
          {
            num: '04',
            titre: "Obtenir une attestation de paiement (CSE / Employeur)",
            detail: "Une fois votre cotisation à jour, demandez votre attestation nominative auprès d'un membre du bureau ou de votre enseignant.",
          },
        ],
        ctaLabel: clubInfo.helloAssoUrl ? "Accéder à HelloAsso" : undefined,
        ctaHref: clubInfo.helloAssoUrl || undefined,
      },
      {
        id: 'competitions',
        categorie: "Interclubs & Tournois",
        titre: "S'inscrire et suivre les compétitions par équipes",
        sousTitre: "Condition de licence, sondages de disponibilité et déroulé des rencontres.",
        dureeEstimee: "4 étapes · 3 min",
        image: imgCompetitions,
        imageAlt: "Illustration compétitions par équipes de tennis",
        accentBorder: "border-amber-500/35",
        accentBg: "bg-amber-500/15",
        accentText: "text-amber-400",
        icon: <Trophy className="w-5 h-5 text-amber-400" />,
        etapes: [
          {
            num: '01',
            titre: "Vérifier votre licence compétition (type C ou W)",
            detail: "Pour disputer les championnats interclubs FFT ou les tournois homologués, votre licence de la saison active doit être validée avec l'attestation médicale / QS-Sport à jour.",
          },
          {
            num: '02',
            titre: "Consulter le calendrier dans l'onglet « Rencontres »",
            detail: "Retrouvez toutes les équipes engagées par le club (Seniors, Vétérans +35/+45/+65, Baden Cup, Jeunes), les dates, les adversaires et les lieux des matchs.",
          },
          {
            num: '03',
            titre: "Répondre aux disponibilités avant le jeudi",
            detail: "Indiquez à votre capitaine vos disponibilités (matin 9h / après-midi 14h / journée) afin qu'il valide la composition officielle et l'ordre des matchs avant le jeudi 20h00.",
          },
          {
            num: '04',
            titre: "Jour J : feuille de match et saisie des scores sur Ten'Up",
            detail: "Présentez votre pièce d'identité ou licence Ten'Up avant le début des simples. Les résultats validés par les deux capitaines comptent pour le classement mensuel FFT.",
          },
        ],
        ctaLabel: "Voir les Rencontres",
        onCtaClick: onNavigateToRencontres,
      },
    ];
  }, [clubInfo, onNavigateToInfos, onNavigateToRencontres]);

  const filteredGuides = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return guides.filter((g) => {
      if (activeGuideFilter !== 'all' && g.id !== activeGuideFilter) return false;
      if (!q) return true;
      const hay = [
        g.titre,
        g.sousTitre,
        g.categorie,
        ...g.etapes.map((e) => `${e.titre} ${e.detail} ${e.conseil || ''}`),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [guides, searchQuery, activeGuideFilter]);

  const hasInstallations = Array.isArray(clubInfo.installations) && clubInfo.installations.length > 0;
  const hasTarifs = Array.isArray(clubInfo.tarifs) && clubInfo.tarifs.length > 0;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* En-tête compact + Recherche mobile-first */}
      <div className="bg-[#141820] border border-[#252b37] rounded-3xl p-4 sm:p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#BF360C] to-[#FF6D00] flex items-center justify-center shrink-0 shadow-lg shadow-orange-950/40">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-heading font-black text-white text-xl sm:text-2xl tracking-tight">
                Tutos & Infos Pratiques
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 mt-0.5 leading-relaxed">
                Guides pas à pas pour utiliser Ten'Up, réserver un court, régler votre cotisation et jouer en équipe.
              </p>
            </div>
          </div>

          <div className="relative w-full md:w-72 shrink-0">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              inputMode="search"
              enterKeyHint="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un tuto (Ten'Up, Pass'Sport...)"
              className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl bg-[#0b0e14] border border-zinc-700/80 text-white placeholder-zinc-500 text-base sm:text-xs focus:border-[#FF6D00] focus:outline-none transition"
            />
          </div>
        </div>

        {/* Filtres rapides single-line scrollables sur mobile */}
        <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'all' as const, label: 'Tous les guides' },
            { id: 'tenup' as const, label: "Compte Ten'Up" },
            { id: 'reservation' as const, label: 'Réserver un court' },
            { id: 'paiement' as const, label: 'Paiements & Aides' },
            { id: 'competitions' as const, label: 'Compétitions' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveGuideFilter(tab.id)}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition cursor-pointer ${
                activeGuideFilter === tab.id
                  ? 'bg-[#E65100] text-white shadow-md shadow-orange-950/40'
                  : 'bg-[#0b0e14] border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* État vide si la recherche ne retourne aucun tutoriel */}
      {filteredGuides.length === 0 ? (
        <div className="bg-[#141820] border border-[#252b37] rounded-3xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 border border-zinc-700 mx-auto flex items-center justify-center text-zinc-400">
            <HelpCircle className="w-6 h-6" />
          </div>
          <h3 className="font-heading font-bold text-white text-base">
            Aucun tutoriel ne correspond à « {searchQuery} »
          </h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Essayez un autre mot-clé (ex. : Ten'Up, badge, HelloAsso, licence, équipe) ou réinitialisez les filtres.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setActiveGuideFilter('all');
            }}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition cursor-pointer whitespace-nowrap"
          >
            Afficher tous les tutoriels
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredGuides.map((guide) => {
            const isExpanded = expandedGuides[guide.id] ?? true;
            const imgBroken = brokenImages[guide.id];

            return (
              <article
                key={guide.id}
                className={`bg-[#141820] border ${guide.accentBorder} rounded-3xl overflow-hidden shadow-xl flex flex-col`}
              >
                {/* Bandeau visuel illustré */}
                <div className="relative h-44 sm:h-48 bg-[#0b0e14] overflow-hidden border-b border-zinc-800/80">
                  {!imgBroken ? (
                    <img
                      src={guide.image}
                      alt={guide.imageAlt}
                      referrerPolicy="no-referrer"
                      onError={() => setBrokenImages((prev) => ({ ...prev, [guide.id]: true }))}
                      className="w-full h-full object-cover opacity-85"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#141820] to-[#0b0e14]">
                      <div className={`w-16 h-16 rounded-3xl ${guide.accentBg} flex items-center justify-center`}>
                        {guide.icon}
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#141820] via-[#141820]/45 to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`text-[11px] font-bold uppercase tracking-wider ${guide.accentText}`}>
                        {guide.categorie} · {guide.dureeEstimee}
                      </p>
                      <h2 className="font-heading font-black text-white text-lg sm:text-xl leading-snug mt-0.5">
                        {guide.titre}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleGuide(guide.id)}
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? 'Replier les étapes' : 'Déplier les étapes'}
                      className="min-w-[44px] min-h-[44px] rounded-xl bg-black/50 hover:bg-black/75 border border-white/15 text-white flex items-center justify-center shrink-0 transition cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Description & Étapes numérotées */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-4">
                  <div className="space-y-4">
                    <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                      {guide.sousTitre}
                    </p>

                    {isExpanded && (
                      <ol className="space-y-3">
                        {guide.etapes.map((step) => (
                          <li
                            key={step.num}
                            className="flex items-start gap-3 p-3 rounded-2xl bg-[#0b0e14] border border-zinc-800/80"
                          >
                            <span
                              className={`w-8 h-8 rounded-xl ${guide.accentBg} ${guide.accentText} font-mono font-black text-xs tabular-nums flex items-center justify-center shrink-0 mt-0.5`}
                            >
                              {step.num}
                            </span>
                            <div className="min-w-0 flex-1 space-y-1">
                              <h3 className="font-bold text-white text-xs sm:text-sm leading-snug">
                                {step.titre}
                              </h3>
                              <p className="text-xs text-zinc-400 leading-relaxed">
                                {step.detail}
                              </p>
                              {step.conseil && (
                                <p className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-xl px-2.5 py-1.5 mt-1.5 leading-relaxed">
                                  Astuce : {step.conseil}
                                </p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>

                  {/* Actions du guide */}
                  {(guide.ctaLabel || guide.secondaryCtaLabel) && (
                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-zinc-800/80">
                      {guide.ctaLabel && guide.ctaHref && (
                        <a
                          href={guide.ctaHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[44px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#BF360C] to-[#E65100] hover:brightness-110 text-white text-xs font-bold transition whitespace-nowrap shadow-md shadow-orange-950/40"
                        >
                          <span>{guide.ctaLabel}</span>
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        </a>
                      )}
                      {guide.ctaLabel && guide.onCtaClick && (
                        <button
                          type="button"
                          onClick={guide.onCtaClick}
                          className="min-h-[44px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#BF360C] to-[#E65100] hover:brightness-110 text-white text-xs font-bold transition cursor-pointer whitespace-nowrap shadow-md shadow-orange-950/40"
                        >
                          <span>{guide.ctaLabel}</span>
                          <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                        </button>
                      )}
                      {guide.secondaryCtaLabel && guide.onSecondaryCtaClick && (
                        <button
                          type="button"
                          onClick={guide.onSecondaryCtaClick}
                          className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-bold transition cursor-pointer whitespace-nowrap"
                        >
                          <span>{guide.secondaryCtaLabel}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Données réelles synchronisées depuis le Google Sheet (Courts, Tarifs & Contacts) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Installations & Accès réels */}
        <section className="bg-[#141820] border border-[#252b37] rounded-3xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-black text-white text-base sm:text-lg">
                Terrains & Accès au club
              </h2>
              <p className="text-xs text-zinc-400">
                Données issues de votre fiche club et de l'onglet Installations
              </p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            {(clubInfo.badgeAccesMessage || clubInfo.ouvertureCourtsMessage) && (
              <div className="p-3.5 rounded-2xl bg-[#0b0e14] border border-zinc-800 space-y-1.5">
                {clubInfo.badgeAccesMessage && (
                  <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                    <KeyRound className="w-4 h-4 shrink-0" />
                    <span>{clubInfo.badgeAccesMessage}</span>
                  </div>
                )}
                {clubInfo.ouvertureCourtsMessage && (
                  <div className="flex items-center gap-2 text-zinc-300">
                    <Clock className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span>{clubInfo.ouvertureCourtsMessage}</span>
                  </div>
                )}
              </div>
            )}

            {hasInstallations ? (
              <ul className="space-y-2">
                {clubInfo.installations.map((inst, idx) => (
                  <li
                    key={`${inst}-${idx}`}
                    className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#0b0e14] border border-zinc-800/80 text-zinc-200"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{inst}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 rounded-2xl bg-[#0b0e14] border border-dashed border-zinc-800 text-zinc-400 text-xs text-center">
                Aucune installation renseignée dans l'onglet Google Sheet « Installations » pour le moment.
              </div>
            )}
          </div>
        </section>

        {/* Tarifs & Modalités de paiement réels */}
        <section className="bg-[#141820] border border-[#252b37] rounded-3xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-black text-white text-base sm:text-lg">
                Tarifs & Contact Secrétariat
              </h2>
              <p className="text-xs text-zinc-400">
                Formules issues de l'onglet Cotisations_Tarifs
              </p>
            </div>
          </div>

          {clubInfo.modalitesPaiement && (
            <p className="text-xs text-sky-200/90 bg-sky-500/10 border border-sky-500/25 rounded-2xl p-3.5 leading-relaxed">
              {clubInfo.modalitesPaiement}
            </p>
          )}

          {hasTarifs ? (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {clubInfo.tarifs!.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#0b0e14] border border-zinc-800/80"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-white text-xs sm:text-sm leading-snug">{t.label}</p>
                    {t.description && (
                      <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2">{t.description}</p>
                    )}
                  </div>
                  <span className="font-heading font-black text-[#FF6D00] text-sm sm:text-base tabular-nums shrink-0">
                    {t.montant} €
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-[#0b0e14] border border-dashed border-zinc-800 text-zinc-400 text-xs text-center">
              Aucun tarif renseigné dans l'onglet Google Sheet « Cotisations_Tarifs ».
            </div>
          )}

          {(clubInfo.telephone || clubInfo.email) && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800">
              {clubInfo.telephone && (
                <a
                  href={`tel:${clubInfo.telephone.replace(/\s+/g, '')}`}
                  className="min-h-[44px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition whitespace-nowrap"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{clubInfo.telephone}</span>
                </a>
              )}
              {clubInfo.email && (
                <a
                  href={`mailto:${clubInfo.email}`}
                  className="min-h-[44px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition whitespace-nowrap"
                >
                  <Mail className="w-3.5 h-3.5 text-orange-400" />
                  <span>Contacter par email</span>
                </a>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
