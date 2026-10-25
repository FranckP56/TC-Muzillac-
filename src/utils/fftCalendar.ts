/**
 * Utilitaires pour le calendrier officiel de la FFT :
 * 1. Mise à jour mensuelle des classements (1er mardi de chaque mois à 06h00)
 * 2. Mise à jour hebdomadaire des résultats de rencontres (lundi suivant le week-end)
 * 3. Contrôle de l'ordre des classements en simple (Simple 1 >= Simple 2 >= Simple 3 >= Simple 4)
 */

import { MatchComposition, Adherent } from '../types/tennis';
import { getRankingWeight } from './ranking';

/**
 * Calcule le premier mardi d'un mois donné (à 06h00, heure officielle de parution FFT)
 */
export function getFirstTuesdayOfMonth(year: number, monthIndex: number): Date {
  const d = new Date(year, monthIndex, 1, 6, 0, 0);
  const dayOfWeek = d.getDay(); // 0 = Dimanche, 1 = Lundi, 2 = Mardi...
  const daysUntilTuesday = (2 - dayOfWeek + 7) % 7;
  d.setDate(1 + daysUntilTuesday);
  return d;
}

/**
 * Détermine la prochaine date officielle de parution des classements mensuels FFT
 */
export function getNextFftMonthlyRankingRelease(now = new Date()) {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // Premier mardi du mois en cours
  const firstTuesdayThisMonth = getFirstTuesdayOfMonth(currentYear, currentMonth);

  let targetTuesday: Date;
  if (now.getTime() < firstTuesdayThisMonth.getTime()) {
    targetTuesday = firstTuesdayThisMonth;
  } else {
    // Si le 1er mardi du mois est déjà passé, prendre le 1er mardi du mois suivant
    const nextMonth = (currentMonth + 1) % 12;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    targetTuesday = getFirstTuesdayOfMonth(nextYear, nextMonth);
  }

  const diffMs = targetTuesday.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const isToday = now.toDateString() === targetTuesday.toDateString();
  const isThisWeek = daysRemaining <= 6;

  const formattedDate = targetTuesday.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  return {
    date: targetTuesday,
    formattedDate: formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1),
    daysRemaining,
    isToday,
    isThisWeek,
    currentMonthName: monthNames[currentMonth],
    targetMonthName: monthNames[targetTuesday.getMonth()],
  };
}

/**
 * Informations sur le cycle hebdomadaire des rencontres (post-week-end & préparation)
 */
export function getWeeklyScheduleInfo(now = new Date()) {
  const day = now.getDay(); // 0: Dim, 1: Lun, 2: Mar, 3: Mer, 4: Jeu, 5: Ven, 6: Sam
  
  let phase = 'Préparation des compositions';
  let badgeColor = 'bg-blue-500/20 text-blue-300 border-blue-500/30';
  let description = "Vérification des compositions d'équipes et des licences FFT 2027 pour les rencontres à venir.";

  if (day === 1 || day === 2) { // Lundi ou Mardi
    phase = 'Mise à jour des résultats (Post-Weekend)';
    badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    description = "Saisie des feuilles de match du week-end et synchronisation des scores dans Données_appli.";
  } else if (day === 5 || day === 6 || day === 0) { // Vendredi, Samedi, Dimanche
    phase = 'Week-end de compétition en cours';
    badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    description = "Rencontres officielles par équipes du TCM. Compositions validées sur le terrain.";
  }

  // Calcul du prochain week-end
  const daysUntilSaturday = (6 - day + 7) % 7 || 7;
  const nextSaturday = new Date(now);
  nextSaturday.setDate(now.getDate() + daysUntilSaturday);
  const nextWeekendStr = nextSaturday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  return {
    phase,
    badgeColor,
    description,
    nextWeekend: nextWeekendStr,
  };
}

/**
 * Vérifie la règle FFT d'ordre des classements en simple :
 * Simple 1 >= Simple 2 >= Simple 3 >= Simple 4
 * Si un classement a changé le 1er mardi du mois et inverse l'ordre, cette fonction le signale immédiatement.
 */
export function checkSinglesRankingOrder(
  composition: MatchComposition,
  adherentsById: Map<string, Adherent>
): { isValid: boolean; error?: string; warnings: string[] } {
  const warnings: string[] = [];
  const singles = [
    { num: 1, id: composition.simple1Id, label: 'Simple 1' },
    { num: 2, id: composition.simple2Id, label: 'Simple 2' },
    { num: 3, id: composition.simple3Id, label: 'Simple 3' },
    { num: 4, id: composition.simple4Id, label: 'Simple 4' },
    { num: 5, id: composition.simple5Id, label: 'Simple 5' },
  ];

  const presentSingles = singles
    .map(s => {
      const adh = s.id ? adherentsById.get(s.id) : undefined;
      const weight = adh ? getRankingWeight(adh.dernierClassTennis) : -1;
      return { ...s, adh, weight };
    })
    .filter(s => !!s.adh);

  for (let i = 0; i < presentSingles.length - 1; i++) {
    const current = presentSingles[i];
    const next = presentSingles[i + 1];

    if (current.weight < next.weight) {
      warnings.push(
        `Ordre FFT non respecté : ${next.adh?.nomPrenom} (${next.adh?.dernierClassTennis} en ${next.label}) est mieux classé(e) que ${current.adh?.nomPrenom} (${current.adh?.dernierClassTennis} en ${current.label}). Le joueur le mieux classé doit obligatoirement jouer au rang supérieur ou égal.`
      );
    }
  }

  return {
    isValid: warnings.length === 0,
    error: warnings.length > 0 ? warnings[0] : undefined,
    warnings,
  };
}
