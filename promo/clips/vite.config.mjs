import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
// The real components, with network-touching modules swapped for timeline-driven stand-ins.
const swaps = {
  'services/aiService.ts': 'mocks/aiService.ts',
  'services/supabaseClient.ts': 'mocks/supabaseClient.ts',
  'utils/contentStorage.ts': 'mocks/storage.ts',
  'utils/imageStorage.ts': 'mocks/storage.ts',
};
const swap = {
  name: 'clip-mocks',
  enforce: 'pre',
  async resolveId(source, importer, options) {
    if (!importer || importer.includes('/promo/clips/mocks/')) return null;
    const r = await this.resolve(source, importer, { ...options, skipSelf: true });
    if (!r) return null;
    for (const [from, to] of Object.entries(swaps)) {
      if (r.id === path.join(repo, from)) return path.join(here, to);
    }
    return null;
  },
};
export default defineConfig({
  root: here,
  plugins: [swap, react()],
  server: { port: 5199, fs: { allow: [repo] } },
});
