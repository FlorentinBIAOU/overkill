#!/usr/bin/env node
/**
 * Aucune page ne doit déborder horizontalement, jusqu'à 360 px de large
 * (CDC 8.7).
 *
 * Un contenu large — tableau, bloc de code, diagramme — a le droit de défiler
 * dans son propre conteneur. C'est la page qui n'a pas le droit de déborder.
 * Le contrôle ignore donc ce qui vit à l'intérieur d'un conteneur défilant, et
 * ne retient que ce qui pousse réellement le document.
 */
import { chromium } from 'playwright';
import { serve } from './shot.mjs';

const LARGEURS = [360, 600, 900, 1440];

const pages = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (pages.length === 0) {
  console.error('usage : node scripts/check-overflow.mjs <chemin> [chemin...]');
  process.exit(1);
}

const serveur = await serve();
const base = `http://127.0.0.1:${serveur.address().port}`;
const navigateur = await chromium.launch();
let echecs = 0;

for (const chemin of pages) {
  for (const largeur of LARGEURS) {
    const page = await navigateur.newPage({ viewport: { width: largeur, height: 900 } });
    await page.goto(base + chemin, { waitUntil: 'networkidle' });

    const resultat = await page.evaluate(() => {
      const racine = document.documentElement;
      const limite = racine.clientWidth;
      if (racine.scrollWidth <= limite) return { deborde: false, coupables: [] };

      /** Un ancêtre qui défile absorbe la largeur de ses enfants. */
      const dansUnConteneurDefilant = (el) => {
        for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
          const ox = getComputedStyle(n).overflowX;
          if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return true;
        }
        return false;
      };

      const coupables = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.right <= limite + 1) continue;
        if (dansUnConteneurDefilant(el)) continue;
        coupables.push(
          `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}` +
            `${typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : ''}` +
            ` (droite ${Math.round(r.right)} px)`,
        );
      }
      return { deborde: coupables.length > 0, largeurDocument: racine.scrollWidth, coupables: [...new Set(coupables)].slice(0, 8) };
    });

    if (resultat.deborde) {
      echecs++;
      console.error(`  ✗ ${chemin} à ${largeur} px — document large de ${resultat.largeurDocument} px`);
      for (const c of resultat.coupables) console.error(`      ${c}`);
    } else {
      console.log(`  ok ${chemin} à ${largeur} px`);
    }
    await page.close();
  }
}

await navigateur.close();
serveur.close();

if (echecs) {
  console.error(`\ncheck-overflow : ${echecs} débordement(s) horizontal(aux)\n`);
  process.exit(1);
}
console.log('\ncheck-overflow : aucun débordement horizontal\n');
