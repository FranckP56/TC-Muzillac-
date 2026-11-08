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
              isCustomized: true,
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

  // 1. Jeunes
  const isJeunes = 
    cat.includes('11') || cat.includes('12') || cat.includes('13') || 
    cat.includes('14') || cat.includes('15') || cat.includes('16') || 
    cat.includes('17') || cat.includes('18') || cat.includes('jeune') || 
    cat.includes('galaxie') || cat.includes('8') || cat.includes('9') || cat.includes('10');

  const isUnder10 = 
    cat.includes('galaxie') || cat.includes('rouge') || cat.includes('orange') || 
    cat.includes('vert') || cat.includes('violet') || cat.includes('8') || 
    cat.includes('9') || cat.includes('10 ans') || cat.includes('9/10');

  if (isJeunes) {
    if (isUnder10) {
      return rules.find(r => r.id === 'jeunes_galaxie') || null;
    }
    return rules.find(r => r.id === 'jeunes_11_18') || null;
  }

  // 2. Seniors+
  const isSeniorsPlus = 
    cat.includes('+') || cat.includes('35') || cat.includes('45') || 
    cat.includes('55') || cat.includes('65') || cat.includes('vétéran') || 
    cat.includes('senior+');

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
