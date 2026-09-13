#!/usr/bin/env node
/**
 * Capture d'une page du site construit, pour vérification visuelle.
 * Usage : node scripts/shot.mjs <chemin> [largeur] [thème] [sortie]
 * SEL=<sélecteur> limite la capture à un élément, ce qui permet de regarder un
 * composant de près sans réduire une page de cinq mille pixels de haut.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.xml': 'application/xml', '.png': 'image/png', '.txt': 'text/plain',
};

export function serve(root = 'dist', port = 0) {
  const server = createServer(async (req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);

    /*
     * La mesure d'audience est servie par l'hébergeur, sous un chemin de ce
     * domaine qui n'existe pas dans `dist`. Sans cette réponse vide, chaque
     * page renverrait une erreur 404 en console, et tous les contrôles qui
     * refusent les erreurs de console échoueraient sur un défaut qui n'existe
     * pas en production.
     */
    if (p.startsWith('/_vercel/insights/')) {
      res.writeHead(200, { 'content-type': 'text/javascript' });
      res.end('/* servi par l\'hébergeur en production */\n');
      return;
    }
    let file = join(root, p);
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    } catch {
      if (!extname(file)) file = join(root, p + '.html');
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('404');
    }
  });
  return new Promise((r) => server.listen(port, () => r(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [path = '/', width = '1280', theme = 'light', out] = process.argv.slice(2);
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: Number(width), height: 900 },
    colorScheme: theme === 'dark' ? 'dark' : 'light',
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(base + path, { waitUntil: 'networkidle' });
  const file = out ?? `/tmp/claude-1000/-home-florentin-overkill/12ef01fd-e268-4a13-9f10-3ce09e7f756f/scratchpad/shot-${width}-${theme}.png`;
  const selector = process.env.SEL;
  if (selector) {
    const cible = page.locator(selector).first();
    await cible.scrollIntoViewIfNeeded();
    await cible.screenshot({ path: file });
  } else {
    await page.screenshot({ path: file, fullPage: true });
  }
  console.log('capture:', file);
  if (errors.length) console.log('erreurs console:', errors);
  await browser.close();
  server.close();
}
