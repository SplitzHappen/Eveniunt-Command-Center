// Finds Playwright: the repository's own node_modules, or the folder named in PLAYWRIGHT_DIR (a node_modules parent).
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export function loadPlaywright() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const tries = [process.env.PLAYWRIGHT_DIR, root].filter(Boolean);
  for (const dir of tries) {
    try { return createRequire(path.join(dir, 'package.json'))('playwright'); } catch (e) { /* next */ }
  }
  throw new Error('playwright not found: run npm ci, or set PLAYWRIGHT_DIR to a folder that holds node_modules/playwright');
}
