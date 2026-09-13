#!/usr/bin/env node
/**
 * Capture du même élément sur plusieurs pages, en une seule session de
 * navigateur. Sert à regarder vingt zones d'essai sans relancer vingt fois
 * un navigateur.
 *
 * Usage : SEL=<sélecteur> node scripts/shots.mjs <dossier> <thème> <largeur> <chemin...>
 */
import { chromium } from 'playwright';
import { serve } from './shot.mjs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const [dossier, theme = 'light', largeur = '1280', ...chemins] = process.argv.slice(2);
const selecteur = process.env.SEL;
await mkdir(dossier, { recursive: true });

const serveur = await serve();
const base = `http://127.0.0.1:${serveur.address().port}`;
const navigateur = await chromium.launch();
const page = await navigateur.newPage({
  viewport: { width: Number(largeur), height: 900 },
  colorScheme: theme === 'dark' ? 'dark' : 'light',
});

for (const chemin of chemins) {
  const erreurs = [];
  const onError = (e) => erreurs.push(String(e));
  const onConsole = (m) => m.type() === 'error' && erreurs.push(m.text());
  page.on('pageerror', onError);
  page.on('console', onConsole);
  await page.goto(base + chemin, { waitUntil: 'networkidle' });
  const nom = chemin.replace(/^\/|\/$/g, '').replace(/\//g, '-') || 'accueil';
  const fichier = join(dossier, `${nom}-${largeur}-${theme}.png`);
  try {
    if (selecteur) {
      const cible = page.locator(selecteur).first();
      await cible.scrollIntoViewIfNeeded({ timeout: 5000 });
      await cible.screenshot({ path: fichier });
    } else {
      await page.screenshot({ path: fichier, fullPage: true });
    }
    console.log(`ok   ${fichier}${erreurs.length ? `  ERREURS: ${erreurs.join(' | ')}` : ''}`);
  } catch (erreur) {
    console.log(`MANQUE ${chemin} : ${erreur.message.split('\n')[0]}`);
  }
  page.off('pageerror', onError);
  page.off('console', onConsole);
}

await navigateur.close();
serveur.close();
