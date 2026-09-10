#!/usr/bin/env node
/**
 * Retire les pages de controle interne (/dev/*) de la sortie de production.
 *
 * Ces pages servent a verifier les tokens, les composants et les illustrations.
 * Elles ne font pas partie du site. Poser OVERKILL_DEV_PAGES=1 pour les garder.
 */
import { rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

if (process.env.OVERKILL_DEV_PAGES === '1') {
  console.log('strip-dev-pages: conservees (OVERKILL_DEV_PAGES=1)');
  process.exit(0);
}

if (!existsSync('dist/dev')) {
  console.log('strip-dev-pages: rien a retirer');
  process.exit(0);
}

const kept = await readdir('dist/dev');
await rm('dist/dev', { recursive: true, force: true });
console.log(`strip-dev-pages: ${kept.length} page(s) de controle retiree(s) de dist/`);
