import React, { useState, useEffect, useMemo } from 'react';
import {
  Edit3,
  RotateCcw,
  Download,
  Upload,
  Check,
  CheckCircle2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Users,
  Calendar,
  Scale,
} from 'lucide-react';
import { ChampionshipRule } from '../types/rules';
import { UserRole } from '../types/tennis';
import {
  getStoredChampionshipRules,
  saveChampionshipRule,
  resetSingleRule,
  resetAllChampionshipRules,
  exportRulesToJson,
  importRulesFromJson,
} from '../utils/rulesManager';
import { EditRuleModal } from './EditRuleModal';

interface ReglementsTabProps {
  userRole?: UserRole;
}

type CategoryTab = 'hommes' | 'femmes' | 'jeunes';

interface LevelRowGroup {
  key: string;
  label: string;
  subtitle: string;
  rules: ChampionshipRule[];
  isCombined: boolean;
}

function getThirdSetSummary(formatText: string): string {
  const lower = formatText.toLowerCase();
  if (lower.includes('super tie-break') || lower.includes('10 pt')) {
    return '3e set Super Tie-Break 10 pts';
  }
  if (lower.includes('classique')) {
    return '3e set classique';
  }
  if (lower.includes('réduit') || lower.includes('adapté') || lower.includes('3 ou 4 jeux')) {
    return 'Sets courts adaptés';
  }
  return formatText;
}

function getPointsShortLabel(rule: ChampionshipRule): string {
  const match = rule.pointsSystem.match(/=\s*(\d+\s*points?)/i);
  if (match) {
    return match[1].replace(/points?/i, 'pts');
  }
  if (rule.level === 'Galaxie') {
    return 'Sans score homologué';
  }
  return `${rule.numSingles + rule.numDoubles} matchs`;
}

function rulesHaveSameFormat(a: ChampionshipRule, b: ChampionshipRule): boolean {
  return (
    a.numSingles === b.numSingles &&
    a.numDoubles === b.numDoubles &&
    a.singlesGameFormat === b.singlesGameFormat &&
    a.doublesGameFormat === b.doublesGameFormat &&
    a.doubleWeightStrict === b.doubleWeightStrict &&
    a.pointsSystem === b.pointsSystem &&
    a.expectedDay === b.expectedDay
  );
}

const COMMON_RULES_SECTIONS = [
  {
    title: 'Hiérarchie & Classement gelé',
    summary:
      'Le meilleur classement joue impérativement en Simple 1, le 2e en Simple 2, etc. Le classement retenu pour toute la phase est celui bloqué au premier mardi du mois de lancement.',
  },
  {
    title: 'Ordre type & Repos obligatoire',
    summary:
      'Sur 2 courts, 2 simples débutent à l’horaire officiel puis les suivants s’enchaînent avant les doubles. Un repos minimum de 30 min est garanti après un simple (permutation possible d’accord commun).',
  },
  {
    title: 'Qualification & Brûlage',
    summary:
      'Licence FFT 2027 validée TCM obligatoire. Un joueur disputant 2 rencontres en équipe supérieure est brûlé et ne peut plus redescendre. 1 seule équipe autorisée par week-end.',
  },
  {
    title: 'Horaires, Retards (W.O.) & Ten’Up',
    summary:
      'Forfait (W.O.) prononcé 15 min après l’appel de la partie. Le club recevant fournit les balles neuves ; les capitaines valident la feuille électronique sur Ten’Up avant dimanche 20h.',
  },
];

const CATEGORY_COMMON_BASE: Record<CategoryTab, { title: string; points: string }> = {
  hommes: {
    title: 'Socle commun Hommes',
    points:
      'Rencontres le dimanche · Tous les doubles se jouent en Format 4 (2 sets à 6 jeux avec No-Ad, 3e set Super Tie-Break 10 pts) · Ordre décroissant des classements en simple.',
  },
  femmes: {
    title: 'Socle commun Femmes',
    points:
      'Rencontres le dimanche · Tous les doubles se jouent en Format 4 (2 sets à 6 jeux avec No-Ad, 3e set Super Tie-Break 10 pts) · Ordre décroissant des classements en simple.',
  },
  jeunes: {
    title: 'Socle commun Jeunes',
    points:
      'Rencontres le samedi · Aucune règle stricte de poids sur le double · Seuls le nombre de simples et le format des jeux évoluent selon la tranche d’âge.',
  },
};

export const ReglementsTab: React.FC<ReglementsTabProps> = ({ userRole = 'adherent' }) => {
  const [activeTab, setActiveTab] = useState<CategoryTab>('hommes');
  const [isCommonRulesOpen, setIsCommonRulesOpen] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [rules, setRules] = useState<ChampionshipRule[]>(() => getStoredChampionshipRules());
  const [selectedRuleToEdit, setSelectedRuleToEdit] = useState<ChampionshipRule | null>(null);
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const canEdit = userRole === 'admin' || userRole === 'bureau';

  useEffect(() => {
    const handleRulesUpdated = () => {
      setRules(getStoredChampionshipRules());
    };
    window.addEventListener('tcm_rules_updated', handleRulesUpdated);
    return () => window.removeEventListener('tcm_rules_updated', handleRulesUpdated);
  }, []);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSaveRule = (updatedRule: ChampionshipRule) => {
    const newRules = saveChampionshipRule(updatedRule);
    setRules(newRules);
    showToast(`Règlement « ${updatedRule.title} » mis à jour.`);
  };

  const handleResetSingle = (ruleId: string) => {
    const newRules = resetSingleRule(ruleId);
    setRules(newRules);
    showToast('Règlement rétabli aux valeurs FFT 2027.');
  };

  const handleConfirmResetAll = () => {
    const newRules = resetAllChampionshipRules();
    setRules(newRules);
    setConfirmResetAll(false);
    showToast('Tous les règlements FFT 2027 ont été rétablis.');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = importRulesFromJson(content);
        if (res.success) {
          setRules(getStoredChampionshipRules());
          showToast(`${res.count || 0} règlements importés.`);
        } else {
          showToast(res.error || 'Erreur lors de l’importation JSON.', 'error');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Construction des niveaux regroupés pour la catégorie active
  const levelGroups = useMemo<LevelRowGroup[]>(() => {
    const byId = new Map(rules.map((r) => [r.id, r]));
    const groups: LevelRowGroup[] = [];

    const pushCombinedOrSplit = (
      baseKey: string,
      combinedLabel: string,
      combinedSubtitle: string,
      idsWithLabels: Array<{ id: string; label: string; subtitle: string }>
    ) => {
      const resolved = idsWithLabels
        .map((item) => ({ ...item, rule: byId.get(item.id) }))
        .filter((item): item is { id: string; label: string; subtitle: string; rule: ChampionshipRule } =>
          Boolean(item.rule)
        );
      if (resolved.length === 0) return;

      const allSame =
        resolved.length > 1 &&
        resolved.every((item) => rulesHaveSameFormat(item.rule, resolved[0].rule));

      if (allSame || resolved.length === 1) {
        groups.push({
          key: baseKey,
          label: resolved.length === 1 ? resolved[0].label : combinedLabel,
          subtitle: resolved.length === 1 ? resolved[0].subtitle : combinedSubtitle,
          rules: resolved.map((r) => r.rule),
          isCombined: resolved.length > 1,
        });
      } else {
        resolved.forEach((item) => {
          groups.push({
            key: `${baseKey}_${item.id}`,
            label: item.label,
            subtitle: item.subtitle,
            rules: [item.rule],
            isCombined: false,
          });
        });
      }
    };

    if (activeTab === 'hommes') {
      pushCombinedOrSplit(
        'h_reg_pr',
        'Régional & Pré-Régionale',
        'Pré-Nationale, R1, R2, R3 et Pré-Régionale',
        [
          { id: 'seniors_regional', label: 'Régional (PN, R1, R2, R3)', subtitle: 'Ligue de Bretagne' },
          { id: 'seniors_preregionale', label: 'Pré-Régionale (PR)', subtitle: 'Division qualificative Morbihan' },
        ]
      );
      pushCombinedOrSplit('h_d1', 'Départemental Division 1 (D1)', 'Comité du Morbihan', [
        { id: 'seniors_d1_m', label: 'Départemental Division 1 (D1)', subtitle: 'Nouveauté 2027 : 2 doubles obligatoires' },
      ]);
      pushCombinedOrSplit(
        'h_d2_d3',
        'Départemental Divisions 2 & 3 (D2 / D3)',
        'Format standard masculin Comité 56',
        [
          { id: 'seniors_d2_m', label: 'Départemental Division 2 (D2)', subtitle: 'Comité du Morbihan' },
          { id: 'seniors_d3_m', label: 'Départemental Division 3 (D3)', subtitle: 'Comité du Morbihan' },
        ]
      );
      pushCombinedOrSplit('h_sp', 'Seniors+ (+35, +45, +55, +65 ans)', 'Régional & Départemental Vétérans', [
        { id: 'seniors_plus', label: 'Seniors+ (+35, +45, +55, +65 ans)', subtitle: 'Toutes divisions Vétérans' },
      ]);
    } else if (activeTab === 'femmes') {
      pushCombinedOrSplit(
        'f_reg_pr',
        'Régional & Pré-Régionale',
        'Pré-Nationale, R1, R2, R3 et Pré-Régionale',
        [
          { id: 'seniors_regional', label: 'Régional (PN, R1, R2, R3)', subtitle: 'Ligue de Bretagne' },
          { id: 'seniors_preregionale', label: 'Pré-Régionale (PR)', subtitle: 'Division qualificative Morbihan' },
        ]
      );
      pushCombinedOrSplit('f_d1', 'Départemental Division 1 (D1)', 'Comité du Morbihan', [
        { id: 'seniors_d1_f', label: 'Départemental Division 1 (D1)', subtitle: '1 double décisif à 2 points' },
      ]);
      pushCombinedOrSplit(
        'f_d2_d3',
        'Départemental Divisions 2 & 3 (D2 / D3)',
        'Format féminin Comité 56',
        [
          { id: 'seniors_d2_f', label: 'Départemental Division 2 (D2)', subtitle: 'Comité du Morbihan' },
          { id: 'seniors_d3_f', label: 'Départemental Division 3 (D3)', subtitle: 'Comité du Morbihan' },
        ]
      );
      pushCombinedOrSplit('f_sp', 'Seniors+ (+35, +45, +55, +65 ans)', 'Régional & Départemental Vétérans', [
        { id: 'seniors_plus', label: 'Seniors+ (+35, +45, +55, +65 ans)', subtitle: 'Toutes divisions Vétérans' },
      ]);
    } else {
      pushCombinedOrSplit('j_13_18', 'Jeunes 13/14 ans & 17/18 ans', 'Comité du Morbihan', [
        { id: 'jeunes_13_18_garcons', label: 'Jeunes 13/14 ans & 17/18 ans', subtitle: 'Garçons & Filles · Comité 56' },
      ]);
      pushCombinedOrSplit('j_11_12', 'Jeunes 11/12 ans', 'Comité du Morbihan / Ligue de Bretagne', [
        { id: 'jeunes_11_18', label: 'Jeunes 11/12 ans', subtitle: 'Formule 2 simples + 1 double' },
      ]);
      pushCombinedOrSplit('j_galaxie', 'Galaxie Tennis (< 10 ans : Rouge, Orange, Vert)', 'Plateaux & championnats adaptés', [
        { id: 'jeunes_galaxie', label: 'Galaxie Tennis (< 10 ans)', subtitle: 'Terrains et balles évolutives' },
      ]);
    }

    return groups;
  }, [rules, activeTab]);

  const commonBase = CATEGORY_COMMON_BASE[activeTab];

  return (
    <div className="space-y-4 sm:space-y-5 animate-fadeIn">
      {/* Notification discrète */}
      {toast && (
        <div
          className={`fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 border text-xs font-bold animate-slideUp ${
            toast.type === 'error'
              ? 'bg-rose-950/95 text-rose-100 border-rose-500/60'
              : 'bg-emerald-500 text-zinc-950 border-emerald-300'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-zinc-950 shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* ==================== EN-TÊTE SOBRE + OUTILS ADMIN ==================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black font-heading text-white text-balance">
            Règlements des Championnats
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            FFT &amp; Bretagne 2027 · Règles communes regroupées et différences par niveau
          </p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2 flex-wrap">
            <label className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#141820] hover:bg-[#1c222e] text-zinc-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-[#252b37] whitespace-nowrap shrink-0">
              <Upload className="w-3.5 h-3.5 text-sky-400" />
              <span>Importer</span>
              <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
            </label>

            <button
              type="button"
              onClick={exportRulesToJson}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#141820] hover:bg-[#1c222e] text-zinc-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-[#252b37] whitespace-nowrap shrink-0"
              title="Exporter les règlements au format JSON"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Exporter</span>
            </button>

            {confirmResetAll ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleConfirmResetAll}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0"
                >
                  Confirmer FFT 2027
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResetAll(false)}
                  className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0"
                >
                  Annuler
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmResetAll(true)}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#141820] hover:bg-rose-950/40 text-zinc-300 hover:text-rose-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-[#252b37] whitespace-nowrap shrink-0"
                title="Rétablir tous les règlements officiels FFT 2027"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                <span>Rétablir tout</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ==================== BLOC 1 : RÈGLES COMMUNES (DÉPLIABLE EN HAUT) ==================== */}
      <div className="bg-[#141820] rounded-2xl border border-[#252b37] overflow-hidden">
        <button
          type="button"
          onClick={() => setIsCommonRulesOpen((prev) => !prev)}
          aria-expanded={isCommonRulesOpen}
          className="w-full min-h-[56px] px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-[#191f2a] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#1b2230] border border-[#2b3446] flex items-center justify-center text-orange-400 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-heading font-black text-white text-sm sm:text-base">
                Règles communes à tous les championnats
              </h2>
              <p className="text-[11px] sm:text-xs text-zinc-400 truncate mt-0.5">
                Classement gelé · Hiérarchie simples · Brûlage (2 matchs) · W.O. 15 min · Feuille Ten&apos;Up
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold text-orange-400 shrink-0 whitespace-nowrap">
            <span className="hidden sm:inline">{isCommonRulesOpen ? 'Masquer' : 'Consulter'}</span>
            {isCommonRulesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {isCommonRulesOpen && (
          <div className="px-4 pb-4 pt-3 border-t border-[#212733] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {COMMON_RULES_SECTIONS.map((sec) => (
              <div
                key={sec.title}
                className="p-3.5 rounded-xl bg-[#0e1118] border border-[#1f2532] space-y-1"
              >
                <h3 className="font-heading font-bold text-zinc-100 text-xs sm:text-sm">
                  {sec.title}
                </h3>
                <p className="text-[11px] sm:text-xs text-zinc-400 leading-relaxed">
                  {sec.summary}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ==================== SÉLECTEUR PRINCIPAL : HOMMES / FEMMES / JEUNES ==================== */}
      <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-[#10141c] rounded-2xl border border-[#252b37]">
        <button
          type="button"
          onClick={() => setActiveTab('hommes')}
          className={`min-h-[44px] px-3 py-2 rounded-xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'hommes'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-950/50'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>Hommes</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('femmes')}
          className={`min-h-[44px] px-3 py-2 rounded-xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'femmes'
              ? 'bg-pink-600 text-white shadow-md shadow-pink-950/50'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>Femmes</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('jeunes')}
          className={`min-h-[44px] px-3 py-2 rounded-xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'jeunes'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>Jeunes</span>
        </button>
      </div>

      {/* ==================== SOCLE COMMUN PROPRE À LA CATÉGORIE ==================== */}
      <div className="px-4 py-3 rounded-2xl bg-[#11151e] border border-[#222836] text-xs space-y-1">
        <span className="font-bold text-zinc-200 block">{commonBase.title}</span>
        <p className="text-[11px] sm:text-xs text-zinc-400 leading-relaxed">{commonBase.points}</p>
      </div>

      {/* ==================== LIGNES COMPACTES PAR NIVEAU (DIFFÉRENCES UNIQUEMENT) ==================== */}
      <div className="space-y-2.5">
        {levelGroups.map((group) => {
          const primaryRule = group.rules[0];
          if (!primaryRule) return null;

          const isExpanded = Boolean(expandedKeys[group.key]);
          const hasAnyCustomized = group.rules.some((r) => r.isCustomized);
          const thirdSetStr = getThirdSetSummary(primaryRule.singlesGameFormat);
          const pointsStr = getPointsShortLabel(primaryRule);
          const doubleDetail =
            primaryRule.numDoubles === 2
              ? '2 Doubles'
              : primaryRule.numDoubles === 1 && primaryRule.pointsSystem.includes('(2 pt')
                ? '1 Double (2 pts)'
                : `${primaryRule.numDoubles} Double${primaryRule.numDoubles > 1 ? 's' : ''}`;

          return (
            <div
              key={group.key}
              className="bg-[#141820] rounded-2xl border border-[#252b37] overflow-hidden transition-colors"
            >
              {/* En-tête cliquable de la ligne de niveau */}
              <button
                type="button"
                onClick={() => toggleExpand(group.key)}
                aria-expanded={isExpanded}
                className="w-full min-h-[64px] px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#191f2a] transition-colors cursor-pointer"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <h3 className="font-heading font-black text-white text-sm sm:text-base">
                      {group.label}
                    </h3>
                    {hasAnyCustomized && (
                      <span className="text-[11px] font-bold text-amber-400">
                        · Personnalisé
                      </span>
                    )}
                  </div>

                  {/* Différences clés uniquement (sans capsules) */}
                  <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-xs text-zinc-300">
                    <span className="font-semibold text-orange-300 tabular-nums">
                      {primaryRule.numSingles} Simple{primaryRule.numSingles > 1 ? 's' : ''}
                    </span>
                    <span className="text-zinc-600" aria-hidden="true">·</span>
                    <span className="font-semibold text-zinc-200 tabular-nums">{doubleDetail}</span>
                    <span className="text-zinc-600" aria-hidden="true">·</span>
                    <span className="text-zinc-300">{thirdSetStr}</span>
                    {primaryRule.doubleWeightStrict && (
                      <>
                        <span className="text-zinc-600" aria-hidden="true">·</span>
                        <span className="text-amber-300 font-semibold">Poids D1 ≤ D2</span>
                      </>
                    )}
                    <span className="text-zinc-600" aria-hidden="true">·</span>
                    <span className="text-zinc-400 tabular-nums">{pointsStr}</span>
                  </div>
                </div>

                {/* Synthèse numérique alignée à droite + chevron */}
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono font-black text-xs sm:text-sm text-zinc-200 tabular-nums whitespace-nowrap">
                    {primaryRule.numSingles}S + {primaryRule.numDoubles}D
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-zinc-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-400" />
                  )}
                </div>
              </button>

              {/* Détails dépliés au clic */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-3 border-t border-[#212733] space-y-3 text-xs">
                  <p className="text-[11px] text-zinc-400">{group.subtitle}</p>

                  {/* Précisions de format Simples / Doubles */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="p-3 rounded-xl bg-[#0e1118] border border-[#1f2532] space-y-1">
                      <span className="text-[11px] font-bold text-orange-400 block">
                        Format des simples ({primaryRule.numSingles})
                      </span>
                      <p className="text-zinc-300 text-xs leading-relaxed">
                        {primaryRule.singlesGameFormat}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-[#0e1118] border border-[#1f2532] space-y-1">
                      <span className="text-[11px] font-bold text-purple-300 block">
                        Format des doubles ({primaryRule.numDoubles})
                      </span>
                      <p className="text-zinc-300 text-xs leading-relaxed">
                        {primaryRule.doublesGameFormat}
                      </p>
                    </div>
                  </div>

                  {/* Ordre des parties, effectif et points */}
                  <div className="p-3 rounded-xl bg-[#0e1118] border border-[#1f2532] space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap text-zinc-300">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-zinc-500" />
                        <span>
                          Équipe : <strong className="text-white tabular-nums">{primaryRule.minPlayers} à {primaryRule.maxPlayers} joueurs</strong>
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                        <strong className="text-white">{primaryRule.expectedDay}</strong>
                      </span>
                    </div>

                    <div className="pt-2 border-t border-[#1c222e] space-y-1">
                      <span className="text-[11px] font-bold text-zinc-400 block">
                        Ordre officiel des parties
                      </span>
                      <p className="text-zinc-200 leading-relaxed">{primaryRule.orderOfPlay}</p>
                    </div>

                    <div className="pt-2 border-t border-[#1c222e] space-y-1">
                      <span className="text-[11px] font-bold text-zinc-400 block">
                        Décompte des points
                      </span>
                      <p className="text-zinc-300">{primaryRule.pointsSystem}</p>
                    </div>

                    {primaryRule.notes && (
                      <p className="pt-2 border-t border-[#1c222e] text-[11px] text-zinc-400 leading-relaxed">
                        {primaryRule.notes}
                      </p>
                    )}
                  </div>

                  {/* Boutons discrets de modification pour Bureau / Admin */}
                  {canEdit ? (
                    <div className="pt-1 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        {group.rules.map((r) => {
                          const shortEditName =
                            r.id === 'seniors_regional'
                              ? 'Régional'
                              : r.id === 'seniors_preregionale'
                                ? 'Pré-Régionale'
                                : r.division.includes('Division 2')
                                  ? 'D2'
                                  : r.division.includes('Division 3')
                                    ? 'D3'
                                    : null;

                          return (
                            <div key={r.id} className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedRuleToEdit(r)}
                                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#1a202c] hover:bg-[#232b3b] text-zinc-200 hover:text-white border border-[#2d3648] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-orange-400" />
                                <span>
                                  {group.isCombined && shortEditName
                                    ? `Modifier ${shortEditName}`
                                    : 'Modifier ce format'}
                                </span>
                              </button>

                              {r.isCustomized && (
                                <button
                                  type="button"
                                  onClick={() => handleResetSingle(r.id)}
                                  className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-rose-300 border border-zinc-800 text-xs font-bold transition flex items-center gap-1 cursor-pointer whitespace-nowrap"
                                  title="Rétablir aux valeurs FFT 2027"
                                >
                                  <RotateCcw className="w-3 h-3 text-rose-400" />
                                  <span>Rétablir</span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {primaryRule.updatedAt && (
                        <span className="text-[11px] text-zinc-500">
                          Modifié le {primaryRule.updatedAt}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 pt-1">
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Règlement officiel FFT en vigueur</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {levelGroups.length === 0 && (
          <div className="p-10 text-center bg-[#141820] rounded-2xl border border-[#252b37]">
            <Scale className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm font-bold text-white">Aucun règlement configuré</p>
          </div>
        )}
      </div>

      {/* Modale d'édition d'une règle (Admin / Bureau) */}
      {selectedRuleToEdit && (
        <EditRuleModal
          isOpen={!!selectedRuleToEdit}
          rule={selectedRuleToEdit}
          onClose={() => setSelectedRuleToEdit(null)}
          onSave={handleSaveRule}
          onReset={handleResetSingle}
        />
      )}
    </div>
  );
};
