import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialiser Firebase une seule fois
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Configurer le provider Google avec les scopes autorisés
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.readonly');
provider.setCustomParameters({
  prompt: 'select_account'
});

const STORAGE_TOKEN_KEY = 'tcm_google_access_token_persistent';
const STORAGE_EXPIRY_KEY = 'tcm_google_token_expiry';

// Cache en mémoire pour le token d'accès
let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Initialiser le token depuis le stockage local persistant au démarrage
try {
  const savedToken = localStorage.getItem(STORAGE_TOKEN_KEY);
  const expiry = localStorage.getItem(STORAGE_EXPIRY_KEY);
  if (savedToken && (!expiry || parseInt(expiry, 10) > Date.now())) {
    cachedAccessToken = savedToken;
  }
} catch {
  // Ignorer si localStorage indisponible
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      // Si un token persistant existe ou s'il est déjà en cache
      if (!cachedAccessToken) {
        try {
          const savedToken = localStorage.getItem(STORAGE_TOKEN_KEY);
          const expiry = localStorage.getItem(STORAGE_EXPIRY_KEY);
          if (savedToken && (!expiry || parseInt(expiry, 10) > Date.now())) {
            cachedAccessToken = savedToken;
          }
        } catch {}
      }

      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else {
        // Utilisateur Firebase connecté mais sans token Sheets actif
        if (onAuthSuccess) onAuthSuccess(user, '');
      }
    } else {
      cachedAccessToken = null;
      try {
        localStorage.removeItem(STORAGE_TOKEN_KEY);
        localStorage.removeItem(STORAGE_EXPIRY_KEY);
      } catch {}
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Impossible de récupérer le jeton d'accès Google OAuth.");
    }

    cachedAccessToken = credential.accessToken;
    try {
      localStorage.setItem(STORAGE_TOKEN_KEY, credential.accessToken);
      // Expiration indicative de 24h
      localStorage.setItem(STORAGE_EXPIRY_KEY, String(Date.now() + 24 * 3600 * 1000));
    } catch {}

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Erreur de connexion Google:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;
  try {
    const savedToken = localStorage.getItem(STORAGE_TOKEN_KEY);
    const expiry = localStorage.getItem(STORAGE_EXPIRY_KEY);
    if (savedToken && (!expiry || parseInt(expiry, 10) > Date.now())) {
      cachedAccessToken = savedToken;
      return cachedAccessToken;
    }
  } catch {}
  return null;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  try {
    if (token) {
      localStorage.setItem(STORAGE_TOKEN_KEY, token);
      localStorage.setItem(STORAGE_EXPIRY_KEY, String(Date.now() + 24 * 3600 * 1000));
    } else {
      localStorage.removeItem(STORAGE_TOKEN_KEY);
      localStorage.removeItem(STORAGE_EXPIRY_KEY);
    }
  } catch {}
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  try {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_EXPIRY_KEY);
  } catch {}
};
