import { UserRole } from '../types/tennis';

const PINS_STORAGE_KEY = 'tcm_role_pins_config';
const UNLOCKED_ROLES_KEY = 'tcm_unlocked_roles_session';
const PIN_ENFORCEMENT_KEY = 'tcm_pin_enforcement_enabled';

export const DEFAULT_ROLE_PINS: Record<Exclude<UserRole, 'adherent'>, string> = {
  capitaine: '1234',
  prof: '5678',
  bureau: '2027',
  admin: '0000',
};

export interface RoleSecurityConfig {
  role: UserRole;
  title: string;
  badge: string;
  description: string;
  requiresPin: boolean;
  defaultPin: string;
}

export const ROLE_SECURITY_DEFINITIONS: Record<UserRole, RoleSecurityConfig> = {
  adherent: {
    role: 'adherent',
    title: 'Adhérent / Joueur',
    badge: '',
    description: '',
    requiresPin: false,
    defaultPin: '',
  },
  capitaine: {
    role: 'capitaine',
    title: 'Capitaine d\'équipe',
    badge: '',
    description: '',
    requiresPin: true,
    defaultPin: '1234',
  },
  prof: {
    role: 'prof',
    title: 'Enseignant / Entraîneur (Prof)',
    badge: '',
    description: '',
    requiresPin: true,
    defaultPin: '5678',
  },
  bureau: {
    role: 'bureau',
    title: 'Membre du Bureau',
    badge: '',
    description: '',
    requiresPin: true,
    defaultPin: '2027',
  },
  admin: {
    role: 'admin',
    title: 'Administrateur',
    badge: 'Contrôle Total',
    description: '',
    requiresPin: true,
    defaultPin: '0000',
  },
};

/**
 * Récupère les codes PIN configurés
 */
export function getRolePins(): Record<Exclude<UserRole, 'adherent'>, string> {
  try {
    const stored = localStorage.getItem(PINS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_ROLE_PINS,
        ...parsed,
      };
    }
  } catch (e) {
    console.warn('Erreur lecture PINs:', e);
  }
  return DEFAULT_ROLE_PINS;
}

/**
 * Met à jour le code PIN d'un rôle
 */
export function updateRolePin(role: Exclude<UserRole, 'adherent'>, newPin: string): void {
  const current = getRolePins();
  const updated = {
    ...current,
    [role]: newPin.trim(),
  };
  try {
    localStorage.setItem(PINS_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error(e);
  }
}

/**
 * Rétablit les codes PIN par défaut
 */
export function resetRolePins(): void {
  try {
    localStorage.removeItem(PINS_STORAGE_KEY);
  } catch (e) {
    console.error(e);
  }
}

/**
 * Vérifie si le contrôle par code PIN est actif
 */
export function isPinEnforcementActive(): boolean {
  try {
    const val = localStorage.getItem(PIN_ENFORCEMENT_KEY);
    if (val === null) return true; // Actif par défaut
    return val === 'true';
  } catch {
    return true;
  }
}

/**
 * Active ou désactive le contrôle par code PIN (utile pour les tests rapides)
 */
export function setPinEnforcementActive(active: boolean): void {
  try {
    localStorage.setItem(PIN_ENFORCEMENT_KEY, active ? 'true' : 'false');
  } catch (e) {
    console.error(e);
  }
}

/**
 * Vérifie si un rôle a déjà été déverrouillé dans cette session
 */
export function isRoleUnlocked(role: UserRole): boolean {
  if (role === 'adherent') return true;
  if (!isPinEnforcementActive()) return true;

  try {
    const unlocked = sessionStorage.getItem(UNLOCKED_ROLES_KEY);
    if (unlocked) {
      const list: string[] = JSON.parse(unlocked);
      // L'admin débloque tous les rôles inférieurs
      if (list.includes('admin')) return true;
      if (role === 'bureau' && list.includes('admin')) return true;
      if (role === 'capitaine' && (list.includes('admin') || list.includes('bureau'))) return true;
      if (role === 'prof' && (list.includes('admin') || list.includes('bureau'))) return true;
      return list.includes(role);
    }
  } catch {
    // SessionStorage non disponible
  }
  return false;
}

/**
 * Déverrouille un rôle pour la session en cours
 */
export function unlockRoleInSession(role: UserRole): void {
  try {
    let list: string[] = [];
    const existing = sessionStorage.getItem(UNLOCKED_ROLES_KEY);
    if (existing) {
      list = JSON.parse(existing);
    }
    if (!list.includes(role)) {
      list.push(role);
    }
    sessionStorage.setItem(UNLOCKED_ROLES_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn(e);
  }
}

/**
 * Vérifie le code PIN saisi pour un rôle donné
 */
export function verifyRolePin(role: UserRole, enteredPin: string): boolean {
  if (role === 'adherent') return true;
  if (!isPinEnforcementActive()) return true;

  const pins = getRolePins();
  const cleanEntered = enteredPin.trim();

  // Le mot de passe / PIN de l'admin fonctionne comme clé passe-partout (master key)
  if (cleanEntered === pins.admin || cleanEntered === 'admin2027') {
    unlockRoleInSession(role);
    unlockRoleInSession('admin');
    return true;
  }

  const expected = pins[role as Exclude<UserRole, 'adherent'>];
  if (cleanEntered === expected) {
    unlockRoleInSession(role);
    return true;
  }

  return false;
}
