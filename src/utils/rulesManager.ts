import { ChampionshipRule } from '../types/rules';
import { DEFAULT_CHAMPIONSHIP_RULES } from '../data/defaultRules';
import { Rencontre } from '../types/tennis';
import { getRequiredSex } from './fftEligibility';

const RULES_STORAGE_KEY = 'tcm_custom_championship_rules';

/**
 * Charge les règlements actifs (localStorage ou valeurs par défaut)
 */
export function getStoredChampionshipRules(): ChampionshipRule[] {
  try {
    const raw = localStorage.getItem(RULES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Fusionne avec les défauts au cas où de nouveaux championnats ont été ajoutés
        const defaultMap = new Map(DEFAULT_CHAMPIONSHIP_RULES.map(r => [r.id, r]));
        const merged: ChampionshipRule[] = [];
        
        parsed.forEach((customRule: ChampionshipRule) => {
          if (defaultMap.has(customRule.id)) {
            merged.push({
              ...defaultMap.get(customRule.id)!,
              ...customRule,
              isCustomized: Boolean(customRule.isCustomized),
            });
            defaultMap.delete(customRule.id);
          } else {
            merged.push(customRule);
          }
        });

        // Ajoute les règles par défaut restantes
        defaultMap.forEach(r => merged.push(r));
        return merged;
      }
    }
  } catch (e) {
    console.warn('Erreur lors du chargement des règlements personnalisés:', e);
  }
  return DEFAULT_CHAMPIONSHIP_RULES;
}

/**
 * Sauvegarde une règle modifiée dans le localStorage
 */
export function saveChampionshipRule(updatedRule: ChampionshipRule): ChampionshipRule[] {
  const current = getStoredChampionshipRules();
  const index = current.findIndex(r => r.id === updatedRule.id);
  
  let newRules: ChampionshipRule[];
  const ruleToSave: ChampionshipRule = {
    ...updatedRule,
    isCustomized: true,
    updatedAt: new Date().toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }),
  };

  if (index >= 0) {
    newRules = [...current];
    newRules[index] = ruleToSave;
  } else {
    newRules = [...current, ruleToSave];
  }

  try {
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(newRules));
    window.dispatchEvent(new Event('tcm_rules_updated'));
  } catch (e) {
    console.error('Erreur sauvegarde règle:', e);
  }

  return newRules;
}

/**
 * Réinitialise une règle individuelle à sa valeur d'origine FFT 2027
 */
export function resetSingleRule(ruleId: string): ChampionshipRule[] {
  const defaultRule = DEFAULT_CHAMPIONSHIP_RULES.find(r => r.id === ruleId);
  if (!defaultRule) return getStoredChampionshipRules();

  const current = getStoredChampionshipRules();
  const updated = current.map(r => r.id === ruleId ? { ...defaultRule, isCustomized: false } : r);

  try {
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('tcm_rules_updated'));
  } catch (e) {
    console.error(e);
  }
  return updated;
}

/**
 * Réinitialise tous les règlements aux valeurs par défaut
 */
export function resetAllChampionshipRules(): ChampionshipRule[] {
  try {
    localStorage.removeItem(RULES_STORAGE_KEY);
    window.dispatchEvent(new Event('tcm_rules_updated'));
  } catch (e) {
    console.error(e);
  }
  return DEFAULT_CHAMPIONSHIP_RULES;
}

/**
 * Exporte les règles au format JSON téléchargeable
 */
export function exportRulesToJson(): void {
  const rules = getStoredChampionshipRules();
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(rules, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `reglements_championnats_tcm_${new Date().getFullYear()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/**
 * Importe des règles depuis un fichier JSON
 */
export function importRulesFromJson(jsonString: string): { success: boolean; count?: number; error?: string } {
  try {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return { success: false, error: 'Format invalide : attendu un tableau de règlements.' };
    }
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(parsed));
    window.dispatchEvent(new Event('tcm_rules_updated'));
    return { success: true, count: parsed.length };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur lors de la lecture du fichier JSON' };
  }
}

/**
 * Détermine la règle de championnat correspondant à une rencontre donnée
 */
export function findRuleForRencontre(rencontre: Rencontre, rulesList?: ChampionshipRule[]): ChampionshipRule | null {
  const rules = rulesList || getStoredChampionshipRules();
  const cat = (rencontre.categorieAgeHomologation || '').toLowerCase();
  const lib = (rencontre.libelleHomologation || '').toLowerCase();
  const niv = (rencontre.niveauHomologation || '').toLowerCase();
  const div = (rencontre.division || '').toLowerCase();
  const reqSex = getRequiredSex(rencontre);
  const isFemme = reqSex === 'F';
  const combined = `${div} ${lib} ${niv}`.toLowerCase();

  const youthText = `${cat} ${lib} ${div} ${rencontre.numeroEquipe || ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const normCat = cat.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // 1. Jeunes (ordre strict : 13-18 ans AVANT 11/12 et <10 ans pour éviter toute collision de chiffres ex: "17/18" contenant "8")
  const is13To18 =
    /(?:^|[^\d])1[3-8]\s*[\/\-]\s*1[4-8](?:[^\d]|$)/.test(youthText) ||
    /(?:^|[^\d])(13|14|15|16|17|18)\s*ans(?:[^\d]|$)/.test(youthText) ||
    /(?:^|[^\d])u1[4-8](?:[^\d]|$)/.test(youthText) ||
    /(?:^|[^\d])(13|14|15|16|17|18)(?:[^\d]|$)/.test(normCat);

  const is11To12 =
    !is13To18 && (
      /(?:^|[^\d])11\s*[\/\-]\s*12(?:[^\d]|$)/.test(youthText) ||
      /(?:^|[^\d])(11|12)\s*ans(?:[^\d]|$)/.test(youthText) ||
      /(?:^|[^\d])u1[12](?:[^\d]|$)/.test(youthText) ||
      /(?:^|[^\d])(11|12)(?:[^\d]|$)/.test(normCat)
    );

  const isUnder10 =
    !is13To18 &&
    !is11To12 && (
      youthText.includes('galaxie') ||
      normCat.includes('rouge') || normCat.includes('orange') ||
      normCat.includes('vert') || normCat.includes('violet') ||
      /(?:^|[^\d])(7|8|9|10)\s*ans(?:[^\d]|$)/.test(youthText) ||
      /(?:^|[^\d])[789]\s*[\/\-]\s*10(?:[^\d]|$)/.test(youthText) ||
      /(?:^|[^\d])u(8|9|10)(?:[^\d]|$)/.test(youthText) ||
      /(?:^|[^\d])(7|8|9|10)(?:[^\d]|$)/.test(normCat)
    );

  const isJeunes =
    is13To18 ||
    is11To12 ||
    isUnder10 ||
    youthText.includes('jeune');

  if (isJeunes) {
    if (is13To18) {
      return rules.find(r => r.id === 'jeunes_13_18_garcons') || null;
    }
    if (isUnder10) {
      return rules.find(r => r.id === 'jeunes_galaxie') || null;
    }
    return rules.find(r => r.id === 'jeunes_11_18') || null;
  }

  // 2. Seniors+
  const isSeniorsPlus =
    normCat.includes('+') ||
    youthText.includes('baden') ||
    youthText.includes('veteran') ||
    youthText.includes('senior+') ||
    /(?:^|[^\d])\+?(35|45|55|65|70|75)(?:[^\d]|$)/.test(youthText);

  if (isSeniorsPlus) {
    return rules.find(r => r.id === 'seniors_plus') || null;
  }

  // 3. Pré-Régionale
  const isPreRegionale = 
    combined.includes('pré-rég') || 
    combined.includes('pre-reg') || 
    combined.includes('prérég') || 
    combined.includes('prereg') || 
    combined.includes('pré région') || 
    combined.includes('pre region') || 
    div === 'pr' || 
    div.startsWith('pr ') || 
    div.endsWith(' pr') ||
    combined.includes('qualificative pré-régionale') ||
    combined.includes('qualificative pre-regionale');

  if (isPreRegionale) {
    return rules.find(r => r.id === 'seniors_preregionale') || null;
  }

  // 4. Régional pur (Pré-Nat, R1, R2, R3)
  const isPureRegional = 
    combined.includes('pré-nat') || 
    combined.includes('prenat') || 
    div.includes('r1') || 
    div.includes('r2') || 
    div.includes('r3') || 
    div.includes('pn') ||
    (niv.includes('région') && !isPreRegionale);

  if (isPureRegional) {
    return rules.find(r => r.id === 'seniors_regional') || null;
  }

  // 5. D1
  const isD1 = 
    div.includes('d1') || 
    div.includes('division 1') || 
    div.includes('1ère division') || 
    div.includes('1ere division') || 
    div === '1' ||
    lib.includes('division 1') ||
    lib.includes(' d1');

  if (isD1) {
    return isFemme 
      ? rules.find(r => r.id === 'seniors_d1_f') || null
      : rules.find(r => r.id === 'seniors_d1_m') || null;
  }

  // 6. D2
  const isD2 = 
    div.includes('d2') || 
    div.includes('division 2') || 
    div.includes('2ème division') || 
    div.includes('2eme division') || 
    div === '2' ||
    lib.includes('division 2') ||
    lib.includes(' d2');

  if (isD2) {
    return isFemme 
      ? rules.find(r => r.id === 'seniors_d2_f') || null
      : rules.find(r => r.id === 'seniors_d2_m') || null;
  }

  // 7. D3 ou par défaut
  return isFemme 
    ? rules.find(r => r.id === 'seniors_d3_f') || null
    : rules.find(r => r.id === 'seniors_d3_m') || null;
}
