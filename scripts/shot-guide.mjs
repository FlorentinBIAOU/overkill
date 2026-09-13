#!/usr/bin/env node
/**
 * Capture du verdict du questionnaire.
 *
 * Le verdict n'existe qu'après huit réponses : aucune URL ne le montre, donc
 * aucune capture simple ne l'attrape. Ce script remplit le formulaire et
 * photographie ce que la personne voit à l'arrivée.
 *
 * Usage : node scripts/shot-guide.mjs <langue> <thème> <largeur> <sortie> [réponses]
 * Réponses : famille,fréquence,tâche,egress,même,vérifier,exemples,héberger
 */
import { chromium } from 'playwright';
import { serve } from './shot.mjs';

const [langue = 'fr', theme = 'light', largeur = '1280', sortie = '/tmp/verdict.png', brut] =
  process.argv.slice(2);

const defaut = 'detect-filter,moyenne,mask-personal-data-in-chat,non,oui,oui,aucun,non';
const [family, frequence, entry, egress, meme, verifier, exemples, heberger] = (
  brut ?? defaut
).split(',');

const serveur = await serve();
const base = `http://127.0.0.1:${serveur.address().port}`;
const navigateur = await chromium.launch();
const page = await navigateur.newPage({
  viewport: { width: Number(largeur), height: 900 },
  colorScheme: theme === 'dark' ? 'dark' : 'light',
});
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));

await page.goto(`${base}/${langue}/par-ou-commencer`, { waitUntil: 'networkidle' });

const choisir = async (question, valeur) => {
  if (!valeur || valeur === '-') return;
  await page.check(`[data-question="${question}"] input[value="${valeur}"]`);
};

await choisir('family', family);
await choisir('frequence', frequence);
await page.click('[data-guide-next]');
await choisir('entry', entry);
await choisir('egress', egress);
await page.click('[data-guide-next]');
await choisir('meme', meme);
await choisir('verifier', verifier);
await page.click('[data-guide-next]');
await choisir('exemples', exemples);
await choisir('heberger', heberger);
await page.click('[data-guide-next]');
await page.waitForSelector('[data-guide-verdict]:not([hidden])');

await page.locator('.guide').screenshot({ path: sortie });
console.log('capture:', sortie);
if (erreurs.length) console.log('erreurs console:', erreurs);

await navigateur.close();
serveur.close();
