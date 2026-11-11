/**
 * Normalise n'importe quelle chaîne de date vers le format officiel standard "JJ/MM/AAAA"
 * Supporte :
 * - "13 09 2026" (espaces) -> "13/09/2026"
 * - "13-09-2026" (tirets) -> "13/09/2026"
 * - "13.09.2026" (points) -> "13/09/2026"
 * - "13/09/2026" (slashes) -> "13/09/2026"
 * - "2026-09-13" (ISO) -> "13/09/2026"
 * - Numéro de série Excel (ex: 46278) -> "13/09/2026"
 */
export function normalizeDateString(raw: string | number | undefined | null): string {
  if (raw === undefined || raw === null) return '';
  const str = String(raw).trim();
  if (!str) return '';

  // 1. Détection format jour mois année avec séparateurs (espaces, tirets, points, slashes)
  // Ex: "13 09 2026", "13-09-2026", "13.09.2026", "13/09/2026"
  const matchDmy = str.match(/^(\d{1,2})[\s\-\.\/]+(\d{1,2})[\s\-\.\/]+(\d{4})$/);
  if (matchDmy) {
    const d = matchDmy[1].padStart(2, '0');
    const m = matchDmy[2].padStart(2, '0');
    const y = matchDmy[3];
    return `${d}/${m}/${y}`;
  }

  // 2. Format ISO Année Mois Jour : "2026-09-13" ou "2026 09 13"
  const matchYmd = str.match(/^(\d{4})[\s\-\.\/]+(\d{1,2})[\s\-\.\/]+(\d{1,2})$/);
  if (matchYmd) {
    const y = matchYmd[1];
    const m = matchYmd[2].padStart(2, '0');
    const d = matchYmd[3].padStart(2, '0');
    return `${d}/${m}/${y}`;
  }

  // 3. Format ISO complet avec heure (ex: "2026-09-12T22:00:00.000Z")
  if (str.includes('T')) {
    const dObj = new Date(str);
    if (!isNaN(dObj.getTime())) {
      try {
        return dObj.toLocaleDateString('fr-FR', {
          timeZone: 'Europe/Paris',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      } catch {
        const d = String(dObj.getDate()).padStart(2, '0');
        const m = String(dObj.getMonth() + 1).padStart(2, '0');
        const y = dObj.getFullYear();
        return `${d}/${m}/${y}`;
      }
    }
  }

  // 4. Numéro de série Excel (nombre de jours depuis 1900)
  if (/^\d{5}$/.test(str)) {
    const serial = parseInt(str, 10);
    // 25569 = jours entre 01/01/1900 et 01/01/1970
    const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      const d = String(date.getDate()).padStart(2, '0');
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const y = date.getFullYear();
      return `${d}/${m}/${y}`;
    }
  }

  return str;
}

/**
 * Parse une date sous format JJ/MM/AAAA (après normalisation) en objet Date JavaScript
 */
export function parseDateToJs(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  const norm = normalizeDateString(dateStr);
  const parts = norm.split('/');
  if (parts.length < 3) return null;

  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const y = parseInt(parts[2], 10);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;

  const dateObj = new Date(y, m, d);
  return isNaN(dateObj.getTime()) ? null : dateObj;
}

/**
 * Calcule une clé unique représentant le week-end (samedi/dimanche) pour une date donnée.
 * Si le match est le samedi 14/03 ou dimanche 15/03, les deux retournent le samedi de référence "weekend_2026-03-14".
 * Si un match est le vendredi soir (ou lundi matin de rattrapage), il est rattaché au week-end correspondant.
 * Si le match est en semaine (ex: mardi, mercredi ou jeudi pour Baden Cup), il retourne sa propre clé distincte.
 */
export function getWeekendKey(dateStr: string | undefined | null): string | null {
  const dateObj = parseDateToJs(dateStr);
  if (!dateObj) return null;

  const dayOfWeek = dateObj.getDay(); // 0 = Dimanche, 1 = Lundi, ..., 6 = Samedi
  let saturdayOffset = 0;
  if (dayOfWeek === 6) { // Samedi
    saturdayOffset = 0;
  } else if (dayOfWeek === 0) { // Dimanche
    saturdayOffset = -1;
  } else if (dayOfWeek === 5) { // Vendredi soir
    saturdayOffset = 1;
  } else {
    // Match en semaine (ex: mardi/mercredi de la Baden Cup +65 ans)
    // Ne bloque JAMAIS les championnats du week-end !
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `weekday_${y}-${m}-${d}`;
  }

  const satDate = new Date(dateObj);
  satDate.setDate(satDate.getDate() + saturdayOffset);
  const y = satDate.getFullYear();
  const m = String(satDate.getMonth() + 1).padStart(2, '0');
  const d = String(satDate.getDate()).padStart(2, '0');
  return `weekend_${y}-${m}-${d}`;
}

/**
 * Détermine si deux dates tombent sur le même week-end (Samedi / Dimanche)
 */
export function isSameWeekend(date1: string | undefined | null, date2: string | undefined | null): boolean {
  if (!date1 || !date2) return false;
  const key1 = getWeekendKey(date1);
  const key2 = getWeekendKey(date2);
  if (key1 && key2 && key1 === key2) return true;

  // Repli sur même date normalisée exacte
  const norm1 = normalizeDateString(date1);
  const norm2 = normalizeDateString(date2);
  return !!norm1 && !!norm2 && norm1 === norm2;
}

/**
 * Détecte si une rencontre correspond à la Baden Cup (+65 ans en semaine)
 * Règle TCM : La Baden Cup se joue en semaine et n'affecte pas les championnats du week-end
 * (un joueur peut jouer en Baden Cup en semaine et en championnat le week-end sans aucun conflit).
 */
export function isBadenCupMatch(r?: {
  libelleHomologation?: string;
  categorieAgeHomologation?: string;
  division?: string;
  numeroEquipe?: string;
  clubAccueilNom?: string;
  clubVisiteurNom?: string;
} | null): boolean {
  if (!r) return false;
  const combined = `${r.libelleHomologation || ''} ${r.categorieAgeHomologation || ''} ${r.division || ''} ${r.numeroEquipe || ''} ${r.clubAccueilNom || ''} ${r.clubVisiteurNom || ''}`.toLowerCase();
  return (
    combined.includes('baden') ||
    (combined.includes('65') && (combined.includes('cup') || combined.includes('coupe') || combined.includes('semaine') || combined.includes('+65')))
  );
}
