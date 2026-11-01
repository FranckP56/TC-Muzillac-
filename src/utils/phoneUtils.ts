/**
 * Utilitaires de formatage des numéros de téléphone pour le Tennis Club de Muzillac (TCM)
 * Format officiel : 10 chiffres groupés par 2 avec le 0 initial affiché (0X XX XX XX XX)
 */

export function formatFrenchPhoneNumber(val: any): string {
  if (val === undefined || val === null) return '';
  let str = String(val).trim();
  if (!str) return '';

  // Supprime tous les caractères de mise en forme (espaces, points, tirets, slashs, parenthèses)
  let digits = str.replace(/[\s\.\-\(\)\/]/g, '');

  // Remplacement des indicatifs internationaux par le 0 métropolitain
  if (digits.startsWith('+33')) {
    digits = '0' + digits.slice(3);
  } else if (digits.startsWith('0033')) {
    digits = '0' + digits.slice(4);
  } else if (digits.startsWith('33') && digits.length === 11) {
    digits = '0' + digits.slice(2);
  }

  // Si Google Sheets a stocké le numéro sous forme numérique entière (ex: 662432464 ou 297416780),
  // le 0 initial a été tronqué -> 9 chiffres. On restaure le 0 initial.
  if (digits.length === 9 && /^[1-9]/.test(digits)) {
    digits = '0' + digits;
  }

  // Formatage standard par paires : 0X XX XX XX XX
  if (digits.length === 10 && digits.startsWith('0')) {
    return digits.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
  }

  return str;
}
