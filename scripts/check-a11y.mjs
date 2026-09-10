#!/usr/bin/env node
/**
 * Audit d'accessibilité automatisé (CDC 11.2, contrôle 6).
 *
 *   « audit automatisé sur l'accueil, une page de famille et une page de fiche »
 *
 * Il tourne axe-core dans un navigateur réel sur le site construit, en clair et
 * en sombre. Toute violation de niveau sérieux ou critique fait échouer le
 * contrôle ; les niveaux mineur et modéré sont affichés en avertissement.
 *
 * Un audit automatisé ne voit qu'une partie du sujet. Ce qu'il ne voit pas —
 * l'ordre de tabulation réel, l'annonce d'un changement d'onglet, la lisibilité
 * d'un tableau au lecteur d'écran — est vérifié par tests/components.spec.mjs
 * et par une relecture manuelle consignée au rapport.
 */
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { serve } from './shot.mjs';

const PAGES = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (PAGES.length === 0) {
  console.error('usage : node scripts/check-a11y.mjs <chemin> [chemin...]');
  process.exit(1);
}

const THEMES = ['light', 'dark'];
const BLOQUANT = new Set(['serious', 'critical']);

const serveur = await serve();
const base = `http://127.0.0.1:${serveur.address().port}`;
const navigateur = await chromium.launch();

const bloquantes = [];
const avertissements = [];
let analysees = 0;

for (const chemin of PAGES) {
  for (const theme of THEMES) {
    // axe-core exige un contexte explicite, et non une page ouverte
    // directement sur le navigateur.
    const contexte = await navigateur.newContext({
      viewport: { width: 1280, height: 900 },
      colorScheme: theme,
    });
    const page = await contexte.newPage();
    await page.goto(base + chemin, { waitUntil: 'networkidle' });

    const resultats = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();

    analysees++;
    for (const v of resultats.violations) {
      const ligne = {
        ou: `${chemin} (${theme})`,
        id: v.id,
        impact: v.impact,
        description: v.help,
        cibles: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
      };
      (BLOQUANT.has(v.impact) ? bloquantes : avertissements).push(ligne);
    }
    await page.close();
    await contexte.close();
  }
}

await navigateur.close();
serveur.close();

console.log(`\ncheck-a11y — ${PAGES.length} page(s), ${analysees} analyse(s), clair et sombre\n`);

const afficher = (liste, marque) => {
  for (const v of liste) {
    console.log(`  ${marque} ${v.ou}  [${v.impact}] ${v.id}`);
    console.log(`      ${v.description}`);
    for (const c of v.cibles) console.log(`      ${c}`);
  }
};

if (avertissements.length) {
  console.log(`  ${avertissements.length} avertissement(s), non bloquant(s) :\n`);
  afficher(avertissements, '!');
  console.log('');
}

if (bloquantes.length) {
  console.error(`check-a11y : ${bloquantes.length} violation(s) bloquante(s)\n`);
  afficher(bloquantes, '✗');
  console.error('');
  process.exit(1);
}

console.log('check-a11y : aucune violation sérieuse ni critique\n');
