import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export interface GoSportLookupPhoto {
  url: string;
  source: string;
}

export interface GoSportLookupSource {
  title: string;
  uri: string;
}

export interface GoSportLookupResult {
  success: boolean;
  reference: string;
  nomProduit: string;
  categorie: string;
  description: string;
  photos: GoSportLookupPhoto[];
  sources: GoSportLookupSource[];
  engine?: string;
  warning?: string;
}

export interface GoSportLookupInput {
  reference: string;
  referenceMagasin?: string;
  referenceClean?: string;
  nomProduit?: string;
  categorie?: string;
}

interface SearchImageCandidate {
  url: string;
  thumbnailUrl?: string;
  source: string;
  title?: string;
  width?: number;
  height?: number;
  score?: number;
}

interface SearchWebItem {
  title: string;
  link: string;
  snippet: string;
}

const LOOKUP_CACHE_TTL_MS = 15 * 60 * 1000;
const lookupCache = new Map<string, { expiresAt: number; result: GoSportLookupResult }>();

const VALID_CATEGORIES = [
  'Raquettes',
  'Chaussures',
  'Tenues',
  'Sacs',
  'Balles & Cordages',
  'Accessoires',
];

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const BRAND_DOMAINS = [
  'wilson.com',
  'babolat.com',
  'head.com',
  'asics.com',
  'tecnifibre.com',
  'yonex.com',
  'lacoste.com',
  'dunlop',
  'adidas.',
  'nike.',
  'lotto.',
  'newbalance.',
  'k-swiss',
  'prince',
];

const SPORT_RETAILER_DOMAINS = [
  'tennispro.',
  'tennis-point.',
  'tenniswarehouse',
  'extreme-tennis.',
  'larrytennis',
  'decathlon.',
  'intersport.',
  'go-sport.',
  'gosport',
  'sport2000',
  'alltricks.',
  'i-run.',
  'avantageservice',
  'prodirect',
  'mistertennis',
  'smashinn',
  'tradeinn',
];

function getSerperApiKey(): string | null {
  const key = (process.env.SERPER_API_KEY || '').trim();
  return key || null;
}

function getGoogleCseCredentials(): { apiKey: string; cx: string } | null {
  const apiKey = (
    process.env.GOOGLE_CSE_API_KEY ||
    process.env.GOOGLE_CUSTOM_SEARCH_API_KEY ||
    ''
  ).trim();
  const cx = (
    process.env.GOOGLE_CSE_CX ||
    process.env.GOOGLE_CUSTOM_SEARCH_CX ||
    ''
  ).trim();
  if (!apiKey || !cx) return null;
  return { apiKey, cx };
}

function scoreCatalogImageCandidate(
  item: SearchImageCandidate,
  cleanRef: string
): number {
  let score = 0;
  const domainLower = (item.source || '').toLowerCase();
  const urlLower = (item.url || '').toLowerCase();
  const titleLower = (item.title || '').toLowerCase();
  const refLower = cleanRef.toLowerCase();

  if (BRAND_DOMAINS.some((d) => domainLower.includes(d) || urlLower.includes(d))) {
    score += 50;
  } else if (SPORT_RETAILER_DOMAINS.some((d) => domainLower.includes(d) || urlLower.includes(d))) {
    score += 35;
  }

  if (refLower && (urlLower.includes(refLower) || titleLower.includes(refLower))) {
    score += 20;
  }
  if (/packshot|catalog\/product|products\/|cdn\.shopify|product[-_]?img/i.test(urlLower)) {
    score += 15;
  }

  if (item.width && item.height && item.height > 0) {
    const ratio = item.width / item.height;
    if (item.width >= 300 && item.height >= 300 && ratio >= 0.65 && ratio <= 1.55) {
      score += 20;
    } else if (ratio > 2.2 || ratio < 0.45) {
      score -= 30;
    }
    if (item.width < 180 || item.height < 180) {
      score -= 25;
    }
  }

  if (
    /youtube\.|instagram\.|facebook\.|tiktok\.|pinterest\.|ebay\.|amazon\.|leboncoin\.|vinted\./i.test(
      domainLower
    )
  ) {
    score -= 25;
  }

  return score;
}

function isQuotaError(err: any): boolean {
  const msg = String(err?.message || '').toUpperCase();
  return err?.status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
}

function extractJsonObject(rawText: string): Record<string, any> | null {
  if (!rawText) return null;
  const cleaned = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function isTechnicalCategory(categorie: string): boolean {
  const s = (categorie || '').toLowerCase();
  if (!s) return true;
  if (s.includes('balle') || s.includes('cordage') || s.includes('accessoire') || s.includes('grip') || s.includes('surgrip') || s.includes('antivibrateur')) {
    return false;
  }
  return true;
}

function getSecondaryAngleKeywords(categorie: string): string | null {
  const s = (categorie || '').toLowerCase();
  if (s.includes('chaussure') || s.includes('shoe') || s.includes('basket')) {
    return 'semelle profil';
  }
  if (s.includes('raquette')) {
    return 'detail cadre tamis';
  }
  if (s.includes('sac') || s.includes('thermo') || s.includes('bag')) {
    return 'compartiment interieur';
  }
  if (s.includes('tenue') || s.includes('textile')) {
    return 'dos detail';
  }
  return null;
}

function normalizeCategory(rawCat: unknown, fallback?: string): string {
  const candidates = [String(rawCat || '').trim(), String(fallback || '').trim()].filter(Boolean);
  for (const raw of candidates) {
    const s = raw.toLowerCase();
    if (s.includes('raquette')) return 'Raquettes';
    if (s.includes('chaussure') || s.includes('basket') || s.includes('shoe')) return 'Chaussures';
    if (s.includes('tenue') || s.includes('textile') || s.includes('polo') || s.includes('short') || s.includes('t-shirt') || s.includes('jupe') || s.includes('robe') || s.includes('veste')) return 'Tenues';
    if (s.includes('sac') || s.includes('thermo') || s.includes('bag')) return 'Sacs';
    if (s.includes('balle') || s.includes('cordage') || s.includes('bobine')) return 'Balles & Cordages';
    if (s.includes('accessoire') || s.includes('grip') || s.includes('surgrip') || s.includes('antivibrateur') || s.includes('casquette') || s.includes('chaussette')) return 'Accessoires';
    if (VALID_CATEGORIES.includes(raw)) return raw;
  }
  return 'Accessoires';
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&rdquo;|&ldquo;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLikelyFrenchText(text: string): boolean {
  const s = String(text || '').trim();
  if (!s) return false;
  const frSignals =
    (s.match(/[àâäéèêëîïôöùûüçœ]/gi) || []).length * 2 +
    (
      s.match(
        /\b(le|la|les|des|une|un|pour|avec|sur|dans|par|est|sont|balle|balles|raquette|chaussure|chaussures|cordage|sac|tenue|tennis|idéal|conçu|conçue|vendu|vendue|unité|contrôle|puissance|confort|adhérence|amorti|club|joueur|joueurs)\b/gi
      ) || []
    ).length;
  const enSignals = (
    s.match(
      /\b(the|and|with|for|your|you|are|this|that|from|best|buy|shop|shipping|free|features|designed|engineered|players|performance|balls|racket|shoes|strings)\b/gi
    ) || []
  ).length;
  return frSignals >= 2 && frSignals >= enSignals;
}

function formatConciseFrenchDescription(
  rawText: string,
  isUnitaire: boolean,
  nomProduit: string,
  categorie: string
): string {
  let cleaned = decodeHtmlEntities(String(rawText || ''))
    .replace(/\s*\|\s*[^|]{2,40}$/g, '')
    .replace(/^(acheter|achetez|découvrez|livraison gratuite[^.!]*[.!])\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned && !isLikelyFrenchText(cleaned)) {
    cleaned = '';
  }

  if (!cleaned) {
    const label = nomProduit || 'Article de tennis';
    const catLower = (categorie || '').toLowerCase();
    if (catLower.includes('balle')) {
      cleaned = `${label} : balle de tennis adaptée à l'entraînement et au jeu en club.`;
    } else if (catLower.includes('raquette')) {
      cleaned = `${label} : raquette offrant un bon équilibre entre maniabilité, contrôle et puissance.`;
    } else if (catLower.includes('chaussure')) {
      cleaned = `${label} : chaussure de tennis assurant maintien, stabilité et amorti sur le court.`;
    } else if (catLower.includes('sac')) {
      cleaned = `${label} : sac pratique pour transporter raquettes et équipement de tennis.`;
    } else if (catLower.includes('tenue')) {
      cleaned = `${label} : textile respirant pensé pour le confort sur les courts.`;
    } else {
      cleaned = `${label} : équipement de tennis sélectionné pour les joueurs du club.`;
    }
  }

  const maxBodyLen = isUnitaire ? 145 : 165;
  if (cleaned.length > maxBodyLen) {
    const slice = cleaned.slice(0, maxBodyLen);
    const lastSentenceEnd = Math.max(
      slice.lastIndexOf('. '),
      slice.lastIndexOf('! '),
      slice.lastIndexOf('? ')
    );
    if (lastSentenceEnd >= 70) {
      cleaned = slice.slice(0, lastSentenceEnd + 1).trim();
    } else {
      const lastSpace = slice.lastIndexOf(' ');
      cleaned = `${(lastSpace > 40 ? slice.slice(0, lastSpace) : slice).replace(/[,;:\-–]+$/, '').trim()}.`;
    }
  } else if (!/[.!?]$/.test(cleaned)) {
    cleaned = `${cleaned}.`;
  }

  if (isUnitaire && !/unit[eé]/i.test(cleaned)) {
    cleaned = `${cleaned} Vendu à l'unité.`;
  }

  return cleaned;
}

function isBadImageCandidate(urlStr: string): boolean {
  const lower = urlStr.toLowerCase();
  if (!lower.startsWith('https://') && !lower.startsWith('http://')) return true;
  if (
    lower.includes('.svg') ||
    lower.includes('favicon') ||
    lower.includes('/logo') ||
    lower.includes('logo.') ||
    lower.includes('sprite') ||
    lower.includes('icon') ||
    lower.includes('badge') ||
    lower.includes('flag') ||
    lower.includes('placeholder') ||
    lower.includes('blank.') ||
    lower.includes('1x1') ||
    lower.includes('pixel') ||
    lower.includes('www.gstatic.com') ||
    lower.includes('googleusercontent.com/favicon') ||
    lower.includes('bing.net/th?id=OSK') ||
    lower.includes('doubleclick') ||
    lower.includes('facebook.com/tr')
  ) {
    return true;
  }
  return false;
}

function resolveUrl(candidate: string, baseUrl: string): string | null {
  try {
    const trimmed = candidate.trim().replace(/&amp;/g, '&');
    if (!trimmed || trimmed.startsWith('data:')) return null;
    const resolved = new URL(trimmed, baseUrl).toString();
    if (!resolved.startsWith('https://') && !resolved.startsWith('http://')) return null;
    if (isBadImageCandidate(resolved)) return null;
    return resolved;
  } catch {
    return null;
  }
}

function extractImagesFromHtml(html: string, pageUrl: string): { images: string[]; metaDescription?: string } {
  const found: string[] = [];
  let metaDescription: string | undefined;

  const addCandidate = (raw: string | undefined) => {
    if (!raw) return;
    const resolved = resolveUrl(raw, pageUrl);
    if (resolved && !found.includes(resolved)) {
      found.push(resolved);
    }
  };

  // 1. JSON-LD Product schemas
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let ldMatch: RegExpExecArray | null;
  while ((ldMatch = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(ldMatch[1].trim());
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (!metaDescription && typeof item?.description === 'string' && item.description.trim().length > 20) {
          metaDescription = decodeHtmlEntities(item.description);
        }
        const imgs = item?.image;
        if (typeof imgs === 'string') addCandidate(imgs);
        else if (Array.isArray(imgs)) {
          for (const entry of imgs) {
            if (typeof entry === 'string') addCandidate(entry);
            else if (entry?.url) addCandidate(entry.url);
            else if (entry?.contentUrl) addCandidate(entry.contentUrl);
          }
        } else if (imgs?.url) {
          addCandidate(imgs.url);
        }
      }
    } catch {
      // Ignorer JSON-LD invalide
    }
  }

  // 2. OpenGraph / Twitter image & description meta tags
  const metaRegex = /<meta[^>]+(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image|twitter:image:src)["'][^>]+content=["']([^"']+)["'][^>]*>/gi;
  const metaRegexRev = /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image|twitter:image:src)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = metaRegex.exec(html)) !== null) addCandidate(m[1]);
  while ((m = metaRegexRev.exec(html)) !== null) addCandidate(m[1]);

  if (!metaDescription) {
    const descMatch =
      html.match(/<meta[^>]+(?:property|name)=["'](?:og:description|description)["'][^>]+content=["']([^"']{20,320})["'][^>]*>/i) ||
      html.match(/<meta[^>]+content=["']([^"']{20,320})["'][^>]+(?:property|name)=["'](?:og:description|description)["'][^>]*>/i);
    if (descMatch?.[1]) {
      metaDescription = decodeHtmlEntities(descMatch[1]);
    }
  }

  // 3. Balises <img> produit explicites
  const imgRegex = /<img[^>]+(?:src|data-src|data-original)=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["'][^>]*>/gi;
  let imgMatch: RegExpExecArray | null;
  while ((imgMatch = imgRegex.exec(html)) !== null && found.length < 10) {
    addCandidate(imgMatch[1]);
  }

  return { images: found, metaDescription };
}

async function scrapeProductPageImages(
  pageUrl: string
): Promise<{ finalUrl: string; images: string[]; metaDescription?: string }> {
  try {
    const res = await fetch(pageUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { finalUrl: res.url || pageUrl, images: [] };
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('text/html')) return { finalUrl: res.url || pageUrl, images: [] };
    const html = await res.text();
    const finalUrl = res.url || pageUrl;
    const extracted = extractImagesFromHtml(html, finalUrl);
    return { finalUrl, images: extracted.images, metaDescription: extracted.metaDescription };
  } catch {
    return { finalUrl: pageUrl, images: [] };
  }
}

async function searchSerperImages(
  query: string,
  apiKey: string
): Promise<{ items: SearchImageCandidate[]; error?: string }> {
  try {
    const res = await fetch('https://google.serper.dev/images', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        gl: 'fr',
        hl: 'fr',
        num: 12,
      }),
      signal: AbortSignal.timeout(5000),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        items: [],
        error: data?.message || `Serper Images HTTP ${res.status}`,
      };
    }

    const items: SearchImageCandidate[] = [];
    if (Array.isArray(data?.images)) {
      for (const item of data.images) {
        const imgUrl = typeof item?.imageUrl === 'string' ? item.imageUrl.trim() : '';
        if (!imgUrl || isBadImageCandidate(imgUrl)) continue;
        const thumb = typeof item?.thumbnailUrl === 'string' ? item.thumbnailUrl.trim() : undefined;
        let source = typeof item?.domain === 'string' ? item.domain.replace(/^www\./, '') : '';
        if (!source && typeof item?.source === 'string') {
          source = item.source;
        }
        if (!source) {
          try {
            source = new URL(imgUrl).hostname.replace(/^www\./, '');
          } catch {
            source = 'Google Images';
          }
        }
        items.push({
          url: imgUrl,
          thumbnailUrl: thumb,
          source,
          title: typeof item?.title === 'string' ? item.title : undefined,
          width: typeof item?.imageWidth === 'number' ? item.imageWidth : undefined,
          height: typeof item?.imageHeight === 'number' ? item.imageHeight : undefined,
        });
      }
    }
    return { items };
  } catch (err: any) {
    return { items: [], error: err?.message || 'Erreur réseau Serper.dev Images' };
  }
}

async function searchSerperWeb(
  query: string,
  apiKey: string
): Promise<SearchWebItem[]> {
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        gl: 'fr',
        hl: 'fr',
        lr: 'lang_fr',
        num: 6,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data: any = await res.json().catch(() => ({}));
    if (!Array.isArray(data?.organic)) return [];

    return data.organic
      .filter((item: any) => typeof item?.link === 'string' && item.link.startsWith('http'))
      .map((item: any) => ({
        title: String(item.title || item.link),
        link: String(item.link),
        snippet: decodeHtmlEntities(String(item.snippet || '')),
      }))
      .sort((a: SearchWebItem, b: SearchWebItem) => {
        const aFr = (isLikelyFrenchText(a.snippet) ? 2 : 0) + (/\.fr\b|\/fr\b/i.test(a.link) ? 1 : 0);
        const bFr = (isLikelyFrenchText(b.snippet) ? 2 : 0) + (/\.fr\b|\/fr\b/i.test(b.link) ? 1 : 0);
        return bFr - aFr;
      });
  } catch {
    return [];
  }
}

async function searchGoogleCustomImages(
  query: string,
  creds: { apiKey: string; cx: string }
): Promise<{ items: SearchImageCandidate[]; error?: string }> {
  try {
    const url =
      `https://www.googleapis.com/customsearch/v1` +
      `?key=${encodeURIComponent(creds.apiKey)}` +
      `&cx=${encodeURIComponent(creds.cx)}` +
      `&q=${encodeURIComponent(query)}` +
      `&searchType=image&num=8&hl=fr&safe=active`;

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) {
      return {
        items: [],
        error: data?.error?.message || `Google Custom Search Image HTTP ${res.status}`,
      };
    }

    const items: SearchImageCandidate[] = [];
    if (Array.isArray(data?.items)) {
      for (const item of data.items) {
        const imgUrl = typeof item?.link === 'string' ? item.link.trim() : '';
        if (!imgUrl || isBadImageCandidate(imgUrl)) continue;
        const thumb = typeof item?.image?.thumbnailLink === 'string' ? item.image.thumbnailLink.trim() : undefined;
        let source = typeof item?.displayLink === 'string' ? item.displayLink.replace(/^www\./, '') : '';
        if (!source) {
          try {
            source = new URL(imgUrl).hostname.replace(/^www\./, '');
          } catch {
            source = 'Google Images';
          }
        }
        items.push({
          url: imgUrl,
          thumbnailUrl: thumb,
          source,
          title: typeof item?.title === 'string' ? item.title : undefined,
        });
      }
    }
    return { items };
  } catch (err: any) {
    return { items: [], error: err?.message || 'Erreur réseau Google Custom Search' };
  }
}

async function searchGoogleCustomWeb(
  query: string,
  creds: { apiKey: string; cx: string }
): Promise<SearchWebItem[]> {
  try {
    const url =
      `https://www.googleapis.com/customsearch/v1` +
      `?key=${encodeURIComponent(creds.apiKey)}` +
      `&cx=${encodeURIComponent(creds.cx)}` +
      `&q=${encodeURIComponent(query)}` +
      `&num=5&hl=fr&safe=active`;

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data: any = await res.json().catch(() => ({}));
    if (!Array.isArray(data?.items)) return [];

    return data.items
      .filter((item: any) => typeof item?.link === 'string' && item.link.startsWith('http'))
      .map((item: any) => ({
        title: String(item.title || item.link),
        link: String(item.link),
        snippet: String(item.snippet || '').replace(/\s+/g, ' ').trim(),
      }));
  } catch {
    return [];
  }
}

async function searchBingImageCandidates(query: string): Promise<string[]> {
  try {
    const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&qft=+filterui:imagesize-medium&FORM=HDRSC2`;
    const res = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const candidates: string[] = [];
    const murlRegex = /&quot;murl&quot;:&quot;(https?:\/\/[^&]+?)&quot;/g;
    let match: RegExpExecArray | null;
    while ((match = murlRegex.exec(html)) !== null && candidates.length < 12) {
      const url = match[1].replace(/\\u002f/gi, '/').replace(/\\/g, '');
      if (!isBadImageCandidate(url) && !candidates.includes(url)) {
        candidates.push(url);
      }
    }
    if (candidates.length === 0) {
      const murlAlt = /"murl":"(https?:\/\/[^"]+?)"/g;
      while ((match = murlAlt.exec(html)) !== null && candidates.length < 12) {
        const url = match[1].replace(/\\u002f/gi, '/').replace(/\\/g, '');
        if (!isBadImageCandidate(url) && !candidates.includes(url)) {
          candidates.push(url);
        }
      }
    }
    return candidates;
  } catch {
    return [];
  }
}

async function verifyImageUrl(urlStr: string, sourceOverride?: string): Promise<GoSportLookupPhoto | null> {
  try {
    const res = await fetch(urlStr, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!ct.startsWith('image/') || ct.includes('svg')) return null;

    const lenHeader = res.headers.get('content-length');
    if (lenHeader && parseInt(lenHeader, 10) < 3000) return null;

    const buf = await res.arrayBuffer();
    if (buf.byteLength < 3000) return null;

    const finalUrl = res.url || urlStr;
    let source = sourceOverride || 'Web';
    if (!sourceOverride) {
      try {
        source = new URL(finalUrl).hostname.replace(/^www\./, '');
      } catch {
        source = 'Web';
      }
    }
    return { url: finalUrl, source };
  } catch {
    return null;
  }
}

function cleanProductReference(raw: string): string {
  let s = String(raw || '').trim();
  if (!s) return '';
  // Retirer "/U" ou "/u" (article déloté vendu à l'unité)
  s = s.replace(/\/u\b/gi, '').trim();
  // Si format "1508397/WRT116400", prendre la référence fournisseur après le "/"
  if (s.includes('/')) {
    const parts = s.split('/').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      s = parts[parts.length - 1];
    }
  }
  // Retirer un "+" final utilisé dans certains logiciels caisse
  s = s.replace(/\+$/, '').trim();
  return s;
}

export async function lookupGoSportProductByReference(
  input: GoSportLookupInput
): Promise<GoSportLookupResult> {
  const rawReference = String(input.reference || '').trim();
  const referenceMagasin = String(input.referenceMagasin || rawReference || '').trim();
  const providedClean = String(input.referenceClean || '').trim();
  const hintNom = String(input.nomProduit || '').trim();
  const hintCat = String(input.categorie || '').trim();

  const isUnitaire =
    /\/u\b/i.test(referenceMagasin) ||
    /\/u\b/i.test(rawReference) ||
    /\/u\b/i.test(hintNom);

  const effectiveCleanRef =
    providedClean || cleanProductReference(rawReference || referenceMagasin);
  const reference = effectiveCleanRef || referenceMagasin;

  if (!reference && !hintNom) {
    throw new Error('Veuillez indiquer une référence produit ou un nom de modèle.');
  }

  const cacheKey = `${reference.toLowerCase()}|${hintNom.toLowerCase()}|${isUnitaire ? 'U' : 'STD'}`;
  const cached = lookupCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const cleanHintNom = hintNom.replace(/\/u\b/gi, '').trim();
  const baseSearchQuery = [effectiveCleanRef, cleanHintNom].filter(Boolean).join(' ').trim();
  const catalogImageQuery = /tennis|raquette|balle|chaussure/i.test(`${baseSearchQuery} ${hintCat}`)
    ? baseSearchQuery
    : `${baseSearchQuery} tennis`.trim();

  const serperApiKey = getSerperApiKey();
  const cseCreds = getGoogleCseCredentials();
  const hintAngleKeywords = getSecondaryAngleKeywords(hintCat);

  // 1. Moteur de recherche prioritaire : Serper.dev (Google Images + Web), sinon Google CSE
  let searchImages: SearchImageCandidate[] = [];
  let searchWeb: SearchWebItem[] = [];
  let searchProviderError: string | undefined;
  let usedSearchProvider: 'serper' | 'google-cse' | null = null;

  if (serperApiKey) {
    usedSearchProvider = 'serper';
    const [imgRes, webRes, angleImgRes] = await Promise.all([
      searchSerperImages(catalogImageQuery, serperApiKey),
      searchSerperWeb(catalogImageQuery, serperApiKey),
      hintAngleKeywords
        ? searchSerperImages(`${baseSearchQuery} ${hintAngleKeywords}`.trim(), serperApiKey)
        : Promise.resolve({ items: [] as SearchImageCandidate[] }),
    ]);
    searchImages = [...imgRes.items];
    for (const item of angleImgRes.items) {
      if (!searchImages.some((existing) => existing.url === item.url)) {
        searchImages.push(item);
      }
    }
    searchProviderError = imgRes.error;
    searchWeb = webRes;

    // Si trop peu d'images avec référence + nom, élargir avec la référence nettoyée seule
    if (searchImages.length < 4 && effectiveCleanRef && cleanHintNom) {
      const fallbackQ = effectiveCleanRef;
      const retryImg = await searchSerperImages(`${fallbackQ} tennis`, serperApiKey);
      for (const item of retryImg.items) {
        if (!searchImages.some((existing) => existing.url === item.url)) {
          searchImages.push(item);
        }
      }
    }
  } else if (cseCreds) {
    usedSearchProvider = 'google-cse';
    const [imgRes, webRes] = await Promise.all([
      searchGoogleCustomImages(catalogImageQuery, cseCreds),
      searchGoogleCustomWeb(catalogImageQuery, cseCreds),
    ]);
    searchImages = imgRes.items;
    searchProviderError = imgRes.error;
    searchWeb = webRes;
  }

  // Tri intelligent catalogue / packshot (marques & revendeurs tennis + format carré/produit en priorité)
  if (searchImages.length > 1) {
    searchImages = [...searchImages]
      .map((item) => ({
        ...item,
        score: scoreCatalogImageCandidate(item, effectiveCleanRef),
      }))
      .sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  // 2. Appel Gemini (gemini-4-hydrogen puis secours gemini-3.1-flash-lite en cas de 429)
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  let parsed: Record<string, any> = {};
  const groundingSources: GoSportLookupSource[] = [];
  const geminiPageUrls: string[] = [];
  let geminiUsed = false;
  let geminiErr: any = null;

  if (apiKey) {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const queryLabel = [effectiveCleanRef, cleanHintNom, hintCat].filter(Boolean).join(' · ');
    const unitRule = isUnitaire
      ? `\nNote métier importante : la référence magasin (${referenceMagasin}) ou le libellé comporte « /U », ce qui signifie que l'article est déloté et vendu à l'unité en magasin (ex : balle vendue à l'unité sortie d'un seau ou tube, ou produit vendu au détail). Utilise la référence fournisseur nettoyée "${effectiveCleanRef}" pour identifier le modèle exact, et précise clairement « Vendu à l'unité » dans la description sommaire.`
      : '';

    const webContext =
      searchWeb.length > 0
        ? `\n\nRésultats Google trouvés pour ce produit :\n${searchWeb
            .map((w, i) => `${i + 1}. ${w.title} (${w.link}) : ${w.snippet}`)
            .join('\n')}`
        : '';

    const prompt = `Tu es l'assistant catalogue d'un magasin GO Sport partenaire d'un club de tennis.
À partir de la référence fournisseur / modèle produit suivant : "${queryLabel}"${unitRule}${webContext}

${searchWeb.length > 0 ? 'À partir des résultats ci-dessus (et Google Search si besoin)' : 'Utilise Google Search pour identifier exactement ce produit de sport / tennis'}, réponds UNIQUEMENT avec un objet JSON valide au format exact ci-dessous (sans texte ni explication autour) :
{
  "nomProduit": "Nom commercial clair et complet du produit (avec marque et modèle)",
  "categorie": "Exactement l'une des valeurs suivantes : Raquettes, Chaussures, Tenues, Sacs, Balles & Cordages, Accessoires",
  "description": "Explication très concise OBLIGATOIREMENT en français (1 à 2 phrases courtes max, 160 caractères max, sans mot anglais superflu), résumant les atouts du produit pour un joueur de tennis.",
  "imageSearchQuery": "Requête courte et précise (marque + modèle + référence fournisseur sans /U) pour trouver les photos officielles du produit",
  "productPageUrls": ["URL 1 de fiche produit officielle ou e-commerce", "URL 2", "URL 3"]
}`;

    const useGoogleSearchTool = searchWeb.length === 0;
    const candidateModels = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const;

    for (const modelName of candidateModels) {
      try {
        const config: Record<string, any> = {};
        if (useGoogleSearchTool) {
          config.tools = [{ googleSearch: {} }];
        }
        if (modelName === 'gemini-4-hydrogen') {
          config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
        }

        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config,
        });

        parsed = extractJsonObject(response.text || '') || {};
        geminiUsed = true;
        geminiErr = null;

        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        for (const chunk of groundingChunks) {
          const uri = chunk?.web?.uri;
          const title = chunk?.web?.title;
          if (uri && typeof uri === 'string' && uri.startsWith('http')) {
            if (!geminiPageUrls.includes(uri)) geminiPageUrls.push(uri);
            groundingSources.push({ title: String(title || uri), uri });
          }
        }
        break;
      } catch (err: any) {
        geminiErr = err;
        if (!isQuotaError(err)) {
          break;
        }
      }
    }
  } else {
    geminiErr = new Error(
      'Clé API Gemini manquante côté serveur (GEMINI_API_KEY). Vérifiez la configuration dans Settings > Secrets.'
    );
  }

  // 3. Agrégation des sources et pages web
  const sources: GoSportLookupSource[] = [...groundingSources];
  for (const w of searchWeb) {
    if (!geminiPageUrls.includes(w.link)) geminiPageUrls.push(w.link);
    if (!sources.some((s) => s.uri === w.link)) {
      sources.push({ title: w.title, uri: w.link });
    }
  }
  if (Array.isArray(parsed.productPageUrls)) {
    for (const u of parsed.productPageUrls) {
      if (typeof u === 'string' && u.startsWith('http') && !geminiPageUrls.includes(u)) {
        geminiPageUrls.push(u);
      }
    }
  }

  const nomProduit = String(parsed.nomProduit || hintNom || reference).trim();
  const categorie = normalizeCategory(parsed.categorie, hintCat);
  const imageSearchQuery = String(
    parsed.imageSearchQuery || catalogImageQuery || `${nomProduit} ${reference}`.trim()
  ).trim();

  const isTechnical = isTechnicalCategory(categorie);
  const maxPhotos = isTechnical ? 8 : 6;
  const detectedAngleKeywords = getSecondaryAngleKeywords(categorie);

  // Si produit technique et que la requête angle n'avait pas encore été faite avec la catégorie détectée
  if (serperApiKey && isTechnical && detectedAngleKeywords && detectedAngleKeywords !== hintAngleKeywords) {
    const angleRes = await searchSerperImages(`${imageSearchQuery} ${detectedAngleKeywords}`.trim(), serperApiKey);
    for (const item of angleRes.items) {
      if (!searchImages.some((existing) => existing.url === item.url)) {
        searchImages.push({
          ...item,
          score: scoreCatalogImageCandidate(item, effectiveCleanRef),
        });
      }
    }
  }

  // 4. Vérification des images (fiches produits multi-angles + Serper / Google CSE -> Bing)
  const pagesToScrape = geminiPageUrls.slice(0, 5);
  const [scrapedResults, bingCandidates] = await Promise.all([
    Promise.all(pagesToScrape.map((u) => scrapeProductPageImages(u))),
    searchImages.length >= maxPhotos ? Promise.resolve([]) : searchBingImageCandidates(imageSearchQuery),
  ]);

  const verifiedPhotos: GoSportLookupPhoto[] = [];
  const seenResolvedUrls = new Set<string>();

  // 4a. Vérifier d'abord les URLs Serper / Google CSE (avec fallback thumbnailUrl si hotlink bloqué)
  if (searchImages.length > 0) {
    const imgChecks = await Promise.all(
      searchImages.slice(0, 14).map(async (item) => {
        const direct = await verifyImageUrl(item.url, item.source);
        if (direct) return direct;
        if (item.thumbnailUrl) {
          return verifyImageUrl(item.thumbnailUrl, item.source);
        }
        return null;
      })
    );
    for (const r of imgChecks) {
      if (r && !seenResolvedUrls.has(r.url)) {
        seenResolvedUrls.add(r.url);
        verifiedPhotos.push(r);
        if (verifiedPhotos.length >= maxPhotos) break;
      }
    }
  }

  // 4b. Compléter depuis les galeries multi-angles des fiches produits & Bing
  if (verifiedPhotos.length < maxPhotos) {
    const extraCandidates: string[] = [];
    const addExtra = (u: string) => {
      if (u && !isBadImageCandidate(u) && !seenResolvedUrls.has(u) && !extraCandidates.includes(u)) {
        extraCandidates.push(u);
      }
    };
    const perPageSlice = isTechnical ? 6 : 3;
    for (const page of scrapedResults) {
      for (const img of page.images.slice(0, perPageSlice)) addExtra(img);
    }
    for (const bImg of bingCandidates) addExtra(bImg);

    const batchSize = 6;
    for (let i = 0; i < Math.min(extraCandidates.length, 18); i += batchSize) {
      if (verifiedPhotos.length >= maxPhotos) break;
      const batch = extraCandidates.slice(i, i + batchSize);
      const results = await Promise.all(batch.map((u) => verifyImageUrl(u)));
      for (const r of results) {
        if (r && !seenResolvedUrls.has(r.url)) {
          seenResolvedUrls.add(r.url);
          verifiedPhotos.push(r);
          if (verifiedPhotos.length >= maxPhotos) break;
        }
      }
    }
  }

  // 5. Description : concise et strictement en français (Gemini prioritaire, sinon meilleur extrait français, sinon synthèse FR)
  let rawDescription = String(parsed.description || '').trim();
  if (!rawDescription || !isLikelyFrenchText(rawDescription)) {
    const frenchMeta =
      scrapedResults.find((p) => p.metaDescription && isLikelyFrenchText(p.metaDescription))
        ?.metaDescription || '';
    const frenchSnippet =
      searchWeb.find((w) => w.snippet && isLikelyFrenchText(w.snippet))?.snippet || '';
    rawDescription = frenchMeta || frenchSnippet || '';
  }
  const description = formatConciseFrenchDescription(
    rawDescription,
    isUnitaire,
    nomProduit,
    categorie
  );

  const providerLabel = usedSearchProvider === 'serper' ? 'Serper.dev' : 'Google Custom Search';

  // Si Gemini a échoué ET que le moteur de recherche n'a rien remonté non plus, propager l'erreur exacte
  if (!geminiUsed && verifiedPhotos.length === 0 && !description) {
    if (searchProviderError && geminiErr && isQuotaError(geminiErr)) {
      const err: any = new Error(
        `Quota Gemini atteint (429) et ${providerLabel} a répondu : ${searchProviderError}`
      );
      err.status = 429;
      throw err;
    }
    throw geminiErr || new Error(searchProviderError || 'Impossible de récupérer les informations produit.');
  }

  const warning =
    !geminiUsed && geminiErr
      ? isQuotaError(geminiErr)
        ? `Quota Gemini temporairement atteint (429) — photos et informations récupérées via ${providerLabel}.`
        : `Service Gemini indisponible — photos et informations récupérées via ${providerLabel}.`
      : undefined;

  const result: GoSportLookupResult = {
    success: true,
    reference,
    nomProduit,
    categorie,
    description,
    photos: verifiedPhotos,
    sources: sources.slice(0, 5),
    engine: usedSearchProvider
      ? geminiUsed
        ? `${usedSearchProvider}+gemini`
        : usedSearchProvider
      : 'gemini-search',
    ...(warning ? { warning } : {}),
  };

  if (verifiedPhotos.length > 0 && geminiUsed) {
    lookupCache.set(cacheKey, {
      expiresAt: Date.now() + LOOKUP_CACHE_TTL_MS,
      result,
    });
  }

  return result;
}


