import path from 'path';
import { Readable } from 'stream';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Serves api/*.ts during `npm run dev`, mirroring Vercel's serverless functions. */
const devApi = (): Plugin => ({
  name: 'dev-api',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const match = req.url?.match(/^\/api\/([\w-]+)(?:\?.*)?$/);
      if (!match) return next();
      try {
        const mod = await server.ssrLoadModule(`/api/${match[1]}.ts`);
        const handler = mod[req.method || 'GET'];
        if (!handler) { res.statusCode = 405; return res.end(); }

        const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
        const request = new Request(`http://localhost${req.url}`, {
          method: req.method,
          headers: req.headers as Record<string, string>,
          body: hasBody ? (Readable.toWeb(req) as any) : undefined,
          duplex: 'half',
        } as RequestInit);
        const response: Response = await handler(request);

        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch (e) {
        console.error('[dev-api]', e);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Dev API error' }));
      }
    });
  },
});

export default defineConfig(({ mode }) => {
  // Make server-only vars (e.g. ANTHROPIC_API_KEY) from .env.local visible to api/* in dev.
  const env = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), devApi()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
  };
});
