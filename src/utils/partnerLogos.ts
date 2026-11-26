import { PartenaireLogo } from '../types/tennis';

export const DEFAULT_PARTNER_LOGOS = {
  gosport: {
    id: 'part-gosport-muzillac',
    nom: 'GO Sport Muzillac',
    role: 'boutique',
    logoUrl: '/assets/aistudio/logo_carr__GOSport_muzillac_N_B_2957796d.png',
    ordre: 1,
    actif: true,
  },
  mizuno: {
    id: 'part-mizuno',
    nom: 'Mizuno',
    role: 'boutique',
    logoUrl: '/assets/aistudio/MIZUNO_logo.svg_40b02e26.webp',
    ordre: 2,
    actif: true,
  },
  wilson: {
    id: 'part-wilson',
    nom: 'Wilson',
    role: 'offre_magasin',
    logoUrl: '/assets/aistudio/wilson-logo_2f195208.jpg',
    ordre: 3,
    actif: true,
  },
} as const;

export function normalizePartnerSiteUrl(raw?: string): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (/^(javascript|data|vbscript):/i.test(value)) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value.replace(/^\/+/, '')}`;
}

export function getDisplayPartnersForCarousel(partenaires: PartenaireLogo[]): PartenaireLogo[] {
  const activeSaved = partenaires
    .filter((p) => p.actif !== false && Boolean(p.logoUrl))
    .slice()
    .sort((a, b) => (a.ordre ?? 999) - (b.ordre ?? 999));

  if (activeSaved.length > 0) {
    return activeSaved;
  }

  return [
    { ...DEFAULT_PARTNER_LOGOS.gosport },
    { ...DEFAULT_PARTNER_LOGOS.mizuno },
    { ...DEFAULT_PARTNER_LOGOS.wilson },
  ];
}

export function resolvePartnerLogoUrl(
  partenaires: PartenaireLogo[],
  key: keyof typeof DEFAULT_PARTNER_LOGOS
): string {
  const target = DEFAULT_PARTNER_LOGOS[key];
  const normTarget = target.nom.toLowerCase();
  const match = partenaires.find((p) => {
    if (!p.actif || !p.logoUrl) return false;
    const pId = p.id.toLowerCase();
    const pNom = p.nom.toLowerCase();
    if (pId === target.id) return true;
    if (key === 'gosport') return pNom.includes('go sport') || pNom.includes('gosport');
    if (key === 'mizuno') return pNom.includes('mizuno');
    if (key === 'wilson') return pNom.includes('wilson');
    return pNom === normTarget;
  });
  return match?.logoUrl || target.logoUrl;
}

/**
 * Compresse un logo en PNG (ou JPEG fond blanc si > 42 Ko) pour tenir dans une cellule Google Sheet (< 50 000 caractères).
 */
export async function compressLogoSourceToBase64(source: Blob | string): Promise<string> {
  let blob: Blob;
  if (typeof source === 'string') {
    if (source.startsWith('data:image')) return source;
    const res = await fetch(source);
    if (!res.ok) throw new Error(`Impossible de charger l'image (${res.status}).`);
    blob = await res.blob();
  } else {
    blob = source;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxSide = 320;
        let { width, height } = img;
        if (width > maxSide || height > maxSide) {
          if (width > height) {
            height = Math.max(1, Math.round((height * maxSide) / width));
            width = maxSide;
          } else {
            width = Math.max(1, Math.round((width * maxSide) / height));
            height = maxSide;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas indisponible pour traiter le logo.'));
          return;
        }
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const pngData = canvas.toDataURL('image/png');
        if (pngData.length <= 42000) {
          resolve(pngData);
          return;
        }

        // Repli JPEG sur fond blanc si PNG trop lourd
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        let quality = 0.85;
        let jpegData = canvas.toDataURL('image/jpeg', quality);
        while (jpegData.length > 42000 && quality > 0.35) {
          quality -= 0.1;
          jpegData = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(jpegData);
      };
      img.onerror = () => reject(new Error("Format d'image invalide."));
      img.src = String(reader.result || '');
    };
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier logo.'));
    reader.readAsDataURL(blob);
  });
}
