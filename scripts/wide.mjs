#!/usr/bin/env node
/**
 * Qui déborde ?
 *
 * `check-overflow` dit qu'une page déborde ; celui-ci dit de quoi. Il liste les
 * éléments plus larges que la fenêtre, du plus englobant au plus précis, avec
 * leur classe et le début de leur texte.
 *
 * Usage : node scripts/wide.mjs <chemin> [largeur]
 */
import { chromium } from 'playwright';
import { serve } from './shot.mjs';

const [chemin = '/fr', largeur = '360'] = process.argv.slice(2);
const serveur = await serve();
const base = `http://127.0.0.1:${serveur.address().port}`;
const navigateur = await chromium.launch();
const page = await navigateur.newPage({
  viewport: { width: Number(largeur), height: 900 },
});
await page.goto(base + chemin, { waitUntil: 'networkidle' });

/* Un élément rangé dans un conteneur qui défile n'est pas un débordement :
   c'est exactement le traitement voulu pour un tableau large ou un bloc de
   code. On ne signale donc que ce qui pousse la page elle-même. */
const coupables = await page.evaluate((max) => {
  const dansUnDefilement = (el) => {
    for (let n = el.parentElement; n; n = n.parentElement) {
      const o = getComputedStyle(n).overflowX;
      if (o === 'auto' || o === 'scroll' || o === 'hidden') return true;
    }
    return false;
  };
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.right <= max + 1 && r.width <= max + 1) continue;
    if (dansUnDefilement(el)) continue;
    out.push({
      balise: el.tagName.toLowerCase(),
      classe: String(el.className || '').slice(0, 50),
      largeur: Math.round(r.width),
      droite: Math.round(r.right),
      texte: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 45),
    });
  }
  return out;
}, Number(largeur));

console.log(`\n${chemin} à ${largeur} px — ${coupables.length} élément(s) trop large(s)\n`);
for (const c of coupables.slice(0, 20)) {
  console.log(
    `  ${String(c.largeur).padStart(5)} px, bord droit ${String(c.droite).padStart(5)} ` +
      `${c.balise}.${c.classe}\n      « ${c.texte} »`,
  );
}

await navigateur.close();
serveur.close();
