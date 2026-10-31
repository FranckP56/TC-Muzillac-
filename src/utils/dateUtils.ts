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
