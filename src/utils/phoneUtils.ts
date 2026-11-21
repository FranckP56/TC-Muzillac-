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

/**
 * Normalise un numéro pour un lien sms: (ex: 0612345678 ou +33612345678)
 */
export function toSmsRecipient(val: any): string {
  if (val === undefined || val === null) return '';
  let digits = String(val).trim().replace(/[\s.\-()/]/g, '');
  if (!digits) return '';

  if (digits.startsWith('00')) {
    digits = '+' + digits.slice(2);
  }
  if (digits.length === 9 && /^[1-9]/.test(digits)) {
    digits = '0' + digits;
  }
  if (!/^\+?\d{9,15}$/.test(digits)) {
    return '';
  }
  return digits;
}

/**
 * Normalise un numéro pour un lien https://wa.me/... (format international sans '+', ex: 33612345678)
 */
export function toWhatsAppPhone(val: any): string {
  const sms = toSmsRecipient(val);
  if (!sms) return '';
  let digits = sms.replace(/^\+/, '');
  if (digits.startsWith('0') && digits.length === 10) {
    digits = '33' + digits.slice(1);
  }
  return digits;
}

/**
 * Construit un lien sms: compatible Android & iOS (individuel ou groupé)
 */
export function buildSmsHref(phones: string[], body?: string): string {
  const cleaned = Array.from(new Set(phones.map(toSmsRecipient).filter(Boolean)));
  if (cleaned.length === 0) return '#';

  const isIOS =
    typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent || '');

  const encodedBody = body ? encodeURIComponent(body) : '';

  if (cleaned.length === 1) {
    if (!encodedBody) return `sms:${cleaned[0]}`;
    return isIOS
      ? `sms:${cleaned[0]}&body=${encodedBody}`
      : `sms:${cleaned[0]}?body=${encodedBody}`;
  }

  // Envoi groupé : iOS utilise /open?addresses=..., Android utilise la liste séparée par des virgules
  if (isIOS) {
    return encodedBody
      ? `sms://open?addresses=${cleaned.join(',')}&body=${encodedBody}`
      : `sms://open?addresses=${cleaned.join(',')}`;
  }
  return encodedBody
    ? `sms:${cleaned.join(',')}?body=${encodedBody}`
    : `sms:${cleaned.join(',')}`;
}

/**
 * Construit un lien WhatsApp individuel avec texte pré-rempli
 */
export function buildWhatsAppHref(phone: string, body?: string): string {
  const wa = toWhatsAppPhone(phone);
  if (!wa) return '#';
  const encodedBody = body ? encodeURIComponent(body) : '';
  return encodedBody ? `https://wa.me/${wa}?text=${encodedBody}` : `https://wa.me/${wa}`;
}

