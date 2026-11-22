import { APPS_SCRIPT_WEB_APP_URL } from './googleSheets';
import { AdherentSession } from '../types/tennis';

export function normalizeLicenceKey(raw: string): string {
  return String(raw || '').trim().replace(/\s+/g, '').toUpperCase();
}

export function normalizeEmailKey(raw: string): string {
  return String(raw || '').trim().toLowerCase();
}

async function postAppsScriptJson(
  payload: Record<string, any>,
  appsScriptUrl: string = APPS_SCRIPT_WEB_APP_URL
): Promise<{ ok: boolean; data?: any; error?: string; scriptUpdateNeeded?: boolean }> {
  const targetUrl = appsScriptUrl || APPS_SCRIPT_WEB_APP_URL;

  try {
    const proxyUrl = `/api/gas-proxy?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        ok: false,
        error:
          "Réponse invalide du serveur Google Apps Script. Vérifiez que le script Code.gs est bien redéployé en Application Web.",
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        error: parsed?.error || "Erreur lors de la communication avec Google Apps Script.",
      };
    }

    if (parsed && parsed.success === false) {
      const msg = String(parsed.error || 'Opération refusée.');
      const isUnknownAction = msg.toLowerCase().includes('action inconnue');
      return {
        ok: false,
        scriptUpdateNeeded: isUnknownAction,
        error: isUnknownAction
          ? "La version actuelle du script Code.gs sur Google Sheets ne contient pas encore le module Espace Adhérent. Demandez à un administrateur de mettre à jour et redéployer Code.gs."
          : msg,
        data: parsed,
      };
    }

    return { ok: true, data: parsed };
  } catch (err: any) {
    return {
      ok: false,
      error: `Serveur de vérification momentanément indisponible (${err?.message || 'erreur réseau'}).`,
    };
  }
}

export interface RequestOtpResult {
  success: boolean;
  maskedEmail?: string;
  expiresInSeconds?: number;
  error?: string;
  scriptUpdateNeeded?: boolean;
}

/**
 * Demande l'envoi d'un code à usage unique à l'adresse e-mail enregistrée pour ce numéro de licence.
 * La génération, le stockage temporaire et l'envoi s'effectuent exclusivement côté Google Apps Script.
 */
export async function requestAdherentOtp(
  licence: string,
  appsScriptUrl: string = APPS_SCRIPT_WEB_APP_URL
): Promise<RequestOtpResult> {
  const cleanLic = normalizeLicenceKey(licence);
  if (!cleanLic || cleanLic.length < 4) {
    return {
      success: false,
      error: 'Veuillez saisir un numéro de licence FFT valide.',
    };
  }

  const res = await postAppsScriptJson(
    {
      action: 'requestAdherentOtp',
      licence: cleanLic,
    },
    appsScriptUrl
  );

  if (!res.ok || !res.data) {
    return {
      success: false,
      error: res.error || "Impossible d'envoyer le code de vérification.",
      scriptUpdateNeeded: res.scriptUpdateNeeded,
    };
  }

  return {
    success: true,
    maskedEmail: String(res.data.maskedEmail || ''),
    expiresInSeconds: Number(res.data.expiresInSeconds) || 600,
  };
}

export interface VerifyOtpResult {
  success: boolean;
  session?: AdherentSession;
  attemptsRemaining?: number;
  error?: string;
  scriptUpdateNeeded?: boolean;
}

/**
 * Vérifie le code à 6 chiffres auprès de Google Apps Script et ouvre une session temporaire en mémoire.
 */
export async function verifyAdherentOtp(
  licence: string,
  code: string,
  appsScriptUrl: string = APPS_SCRIPT_WEB_APP_URL
): Promise<VerifyOtpResult> {
  const cleanLic = normalizeLicenceKey(licence);
  const cleanCode = String(code || '').replace(/\D/g, '').trim();

  if (!cleanLic) {
    return { success: false, error: 'Numéro de licence manquant.' };
  }
  if (!/^\d{6}$/.test(cleanCode)) {
    return { success: false, error: 'Le code de vérification doit contenir exactement 6 chiffres.' };
  }

  const res = await postAppsScriptJson(
    {
      action: 'verifyAdherentOtp',
      licence: cleanLic,
      code: cleanCode,
    },
    appsScriptUrl
  );

  if (!res.ok || !res.data) {
    return {
      success: false,
      error: res.error || 'Code de vérification incorrect ou expiré.',
      attemptsRemaining:
        typeof res.data?.attemptsRemaining === 'number' ? res.data.attemptsRemaining : undefined,
      scriptUpdateNeeded: res.scriptUpdateNeeded,
    };
  }

  const sessionToken = String(res.data.sessionToken || '').trim();
  const verifiedEmail = normalizeEmailKey(res.data.verifiedEmail || '');
  const familyLicences = Array.isArray(res.data.familyLicences)
    ? res.data.familyLicences.map((l: any) => normalizeLicenceKey(String(l)))
    : [cleanLic];

  if (!sessionToken) {
    return {
      success: false,
      error: 'Jeton de session non reçu depuis Apps Script.',
    };
  }

  return {
    success: true,
    session: {
      sessionToken,
      verifiedLicence: normalizeLicenceKey(res.data.verifiedLicence || cleanLic),
      verifiedEmail,
      maskedEmail: String(res.data.maskedEmail || verifiedEmail),
      familyLicences,
      verifiedAt: Date.now(),
    },
  };
}

export interface UpdateMinorParentResult {
  success: boolean;
  representantLegal?: string;
  error?: string;
}

/**
 * Met à jour uniquement le nom du représentant légal (parent) pour un adhérent mineur authentifié.
 */
export async function updateMinorParentRemote(
  licence: string,
  sessionToken: string,
  representantLegal: string,
  appsScriptUrl: string = APPS_SCRIPT_WEB_APP_URL
): Promise<UpdateMinorParentResult> {
  const cleanLic = normalizeLicenceKey(licence);
  const cleanParent = String(representantLegal || '')
    .trim()
    .replace(/^[=+\-@]+/, '')
    .slice(0, 120);

  if (!cleanParent) {
    return {
      success: false,
      error: 'Veuillez saisir le nom et le prénom du parent ou représentant légal.',
    };
  }

  if (!sessionToken) {
    return {
      success: false,
      error: 'Session expirée. Veuillez vous reconnecter.',
    };
  }

  const res = await postAppsScriptJson(
    {
      action: 'updateMinorParent',
      licence: cleanLic,
      sessionToken,
      representantLegal: cleanParent,
    },
    appsScriptUrl
  );

  if (!res.ok) {
    return {
      success: false,
      error: res.error || "Impossible d'enregistrer le représentant légal.",
    };
  }

  return {
    success: true,
    representantLegal: cleanParent,
  };
}
