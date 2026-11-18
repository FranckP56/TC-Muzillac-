import { lookupGoSportProductByReference } from '../server/gosportLookup.ts';

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method Not Allowed' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const { reference, referenceMagasin, referenceClean, nomProduit, categorie } = body;

    if (!String(reference || referenceClean || referenceMagasin || '').trim() && !String(nomProduit || '').trim()) {
      res.status(400).json({
        success: false,
        error: 'Veuillez saisir une référence produit ou un nom de modèle.',
      });
      return;
    }

    const result = await lookupGoSportProductByReference({
      reference: String(reference || referenceClean || referenceMagasin || ''),
      referenceMagasin: referenceMagasin ? String(referenceMagasin) : undefined,
      referenceClean: referenceClean ? String(referenceClean) : undefined,
      nomProduit: nomProduit ? String(nomProduit) : undefined,
      categorie: categorie ? String(categorie) : undefined,
    });

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(result);
  } catch (err: any) {
    const rawMsg = String(err?.message || 'Erreur lors de la recherche produit.');
    const status =
      typeof err?.status === 'number' && err.status >= 400 && err.status < 600
        ? err.status
        : 500;

    let userMessage = rawMsg;
    if (
      rawMsg.includes('GEMINI_API_KEY') ||
      rawMsg.includes('API_KEY_INVALID') ||
      rawMsg.includes('PERMISSION_DENIED') ||
      status === 403 ||
      status === 401
    ) {
      userMessage =
        'Clé API Gemini absente ou invalide côté serveur (GEMINI_API_KEY).';
    } else if (rawMsg.includes('RESOURCE_EXHAUSTED') || status === 429) {
      userMessage =
        'Quota Gemini temporairement atteint (429). Configurez SERPER_API_KEY (serper.dev) ou une clé Gemini facturée dans vos variables d’environnement Vercel.';
    }

    res.status(status).json({ success: false, error: userMessage });
  }
}
