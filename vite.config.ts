import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'gas-proxy-plugin',
        configureServer(server) {
          let cachedData: string | null = null;
          let cacheTime = 0;

          server.middlewares.use('/api/gas-proxy', async (req, res) => {
            // Set permissive CORS headers for all responses including preflights and errors
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Cache-Control, Pragma, X-Requested-With');

            if (req.method === 'OPTIONS') {
              res.statusCode = 204;
              res.end();
              return;
            }

            try {
              const url = new URL(req.url || '', `http://${req.headers.host || 'localhost:3000'}`);
              const targetUrl = url.searchParams.get('url') || 'https://script.google.com/macros/s/AKfycbx5gTcxhLQ1i2ZksvPGzzmJC4YXVvZp5-Rm7C74WZserM5mooPsMB450m128QdHMAV_TQ/exec?action=getAll';

              const isGetAll = req.method === 'GET' && targetUrl.includes('action=getAll');
              const now = Date.now();

              // In-memory cache for GET action=getAll (30 seconds TTL)
              if (isGetAll && cachedData && (now - cacheTime < 30000)) {
                res.setHeader('Content-Type', 'application/json');
                res.end(cachedData);
                return;
              }

              let body: string | undefined = undefined;
              if (req.method === 'POST') {
                const chunks: Buffer[] = [];
                for await (const chunk of req) {
                  chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                }
                body = Buffer.concat(chunks).toString('utf-8');
              }

              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 12000);

              const gasRes = await fetch(targetUrl, {
                method: req.method || 'GET',
                headers: req.method === 'POST' ? { 'Content-Type': 'text/plain;charset=utf-8' } : undefined,
                body: body || undefined,
                redirect: 'follow',
                signal: controller.signal,
              });
              clearTimeout(timeoutId);

              const data = await gasRes.text();
              if (isGetAll && gasRes.ok && data.startsWith('{')) {
                cachedData = data;
                cacheTime = Date.now();
              }

              res.setHeader('Content-Type', 'application/json');
              res.end(data);
            } catch (err: any) {
              if (cachedData) {
                res.setHeader('Content-Type', 'application/json');
                res.end(cachedData);
                return;
              }
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Apps Script proxy error' }));
            }
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
