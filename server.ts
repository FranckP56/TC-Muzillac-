import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { lookupGoSportProductByReference } from './server/gosportLookup.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

const DEFAULT_GAS_GET_ALL_URL =
  'https://script.google.com/macros/s/AKfycbx5gTcxhLQ1i2ZksvPGzzmJC4YXVvZp5-Rm7C74WZserM5mooPsMB450m128QdHMAV_TQ/exec?action=getAll';

async function createApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  let cachedGasGetAll: string | null = null;
  let gasCacheTime = 0;

  // 1. Proxy Google Apps Script (GET / POST / OPTIONS)
  app.all('/api/gas-proxy', async (req: Request, res: Response) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, Accept, Cache-Control, Pragma, X-Requested-With'
    );

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    try {
      const targetUrl =
        typeof req.query.url === 'string' && req.query.url.trim()
          ? req.query.url
          : DEFAULT_GAS_GET_ALL_URL;

      const isGetAll = req.method === 'GET' && targetUrl.includes('action=getAll');
      const now = Date.now();

      if (isGetAll && cachedGasGetAll && now - gasCacheTime < 30000) {
        res.setHeader('Content-Type', 'application/json');
        res.send(cachedGasGetAll);
        return;
      }

      let bodyStr: string | undefined;
      if (req.method === 'POST') {
        if (typeof req.body === 'string') {
          bodyStr = req.body;
        } else if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
          bodyStr = JSON.stringify(req.body);
        } else {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          bodyStr = Buffer.concat(chunks).toString('utf-8');
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const gasRes = await fetch(targetUrl, {
        method: req.method || 'GET',
        headers:
          req.method === 'POST' ? { 'Content-Type': 'text/plain;charset=utf-8' } : undefined,
        body: req.method === 'POST' ? bodyStr : undefined,
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await gasRes.text();
      if (isGetAll && gasRes.ok && data.startsWith('{')) {
        cachedGasGetAll = data;
        gasCacheTime = Date.now();
      }

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Content-Type', 'application/json');
      res.send(data);
    } catch (err: any) {
      if (cachedGasGetAll) {
        res.setHeader('Content-Type', 'application/json');
        res.send(cachedGasGetAll);
        return;
      }
      res.status(502).json({ error: err?.message || 'Apps Script proxy error' });
    }
  });

  // 2. Recherche produit GO Sport par référence (Gemini Search Grounding + >= 3 photos vérifiées + description sommaire)
  app.post('/api/gosport-lookup', async (req: Request, res: Response) => {
    try {
      const { reference, referenceMagasin, referenceClean, nomProduit, categorie } = req.body || {};
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
      res.json(result);
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
          'Clé API Gemini absente ou invalide. Vérifiez votre clé dans Settings > Secrets (GEMINI_API_KEY).';
      } else if (rawMsg.includes('RESOURCE_EXHAUSTED') || status === 429) {
        userMessage =
          'Quota Gemini temporairement atteint (429). Configurez SERPER_API_KEY (serper.dev) ou une clé Gemini facturée dans Settings > Secrets / Vercel pour rechercher les photos catalogue.';
      }

      res.status(status).json({
        success: false,
        error: userMessage,
      });
    }
  });

  // 3. Relais image léger pour l'aperçu et la validation de photos protégées contre le hotlinking
  app.get('/api/image-proxy', async (req: Request, res: Response) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    if (!rawUrl || (!rawUrl.startsWith('https://') && !rawUrl.startsWith('http://'))) {
      res.status(400).send('Invalid image URL');
      return;
    }

    try {
      const imgRes = await fetch(rawUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!imgRes.ok) {
        res.status(imgRes.status).send('Image fetch failed');
        return;
      }

      const ct = (imgRes.headers.get('content-type') || '').toLowerCase();
      if (!ct.startsWith('image/')) {
        res.status(415).send('Not an image');
        return;
      }

      const buf = Buffer.from(await imgRes.arrayBuffer());
      if (buf.byteLength > 5 * 1024 * 1024) {
        res.status(413).send('Image too large');
        return;
      }

      res.setHeader('Content-Type', ct);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(buf);
    } catch {
      res.status(502).send('Image proxy error');
    }
  });

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT} (mode=${isDev ? 'dev' : 'prod'})`);
  });
}

createApp();
