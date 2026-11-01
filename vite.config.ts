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
          server.middlewares.use('/api/gas-proxy', async (req, res) => {
            try {
              const url = new URL(req.url || '', `http://${req.headers.host || 'localhost:3000'}`);
              const targetUrl = url.searchParams.get('url') || 'https://script.google.com/macros/s/AKfycbx5gTcxhLQ1i2ZksvPGzzmJC4YXVvZp5-Rm7C74WZserM5mooPsMB450m128QdHMAV_TQ/exec?action=getAll';
              
              const gasRes = await fetch(targetUrl, {
                method: req.method || 'GET',
                redirect: 'follow',
              });
              
              const data = await gasRes.text();
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(data);
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
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
