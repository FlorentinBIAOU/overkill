#!/usr/bin/env node
/**
 * Aucune ressource tierce chargée à l'exécution (CDC 12, interdit 6).
 *
 *   « Aucun traceur, aucune mesure d'audience côté client, aucune ressource
 *     tierce chargée à l'exécution. Les polices sont auto-hébergées. »
 *
 * Le contrôle ouvre chaque page dans un navigateur réel et enregistre toutes
 * les requêtes émises. Toute requête vers un autre hôte que celui du site est
 * une violation.
 *
 * C'est une vérification de comportement, pas de source : elle attrape aussi
 * ce qu'un script chargerait de lui-même après le rendu.
 *
 * **Révisé au lot 14.** Le site porte désormais une mesure d'audience, et la
 * moitié de phrase du CDC qui l'interdisait est levée. Ce contrôle reste
 * inchangé dans sa règle, et c'est précisément pourquoi il tient toujours : la
 * mesure retenue est servie depuis ce domaine, sous `/_vercel/insights/`, par
 * l'hébergeur. Aucune requête ne part vers un autre hôte, et le jour où
 * quelqu'un remplacerait ce chemin par le domaine d'un fournisseur, ce
 * contrôle échouerait — ce qu'on lui demande.
 */
import { chromium } from 'playwright';
import { serve } from './shot.mjs';

const PAGES = process.argv.slice(2);
if (PAGES.length === 0) {
  console.error('usage : node scripts/check-third-party.mjs <chemin> [chemin...]');
  process.exit(1);
}

const serveur = await serve();
const hote = '127.0.0.1';
const base = `http://${hote}:${serveur.address().port}`;
const navigateur = await chromium.launch();

const violations = [];
let requetes = 0;

for (const chemin of PAGES) {
  const page = await navigateur.newPage({ viewport: { width: 1280, height: 900 } });

  page.on('request', (r) => {
    requetes++;
    const url = new URL(r.url());
    if (url.protocol === 'data:' || url.protocol === 'blob:') return;
    if (url.hostname !== hote) violations.push(`${chemin} → ${r.url()}`);
  });

  await page.goto(base + chemin, { waitUntil: 'networkidle' });

  // On laisse le temps à un éventuel chargement différé de se déclencher.
  await page.waitForTimeout(500);
  await page.close();
}

await navigateur.close();
serveur.close();

console.log(
  `\ncheck-third-party — ${PAGES.length} page(s), ${requetes} requête(s) observée(s)\n`,
);

if (violations.length) {
  console.error(`check-third-party : ${violations.length} ressource(s) tierce(s)\n`);
  for (const v of violations) console.error(`  ✗ ${v}`);
  console.error('');
  process.exit(1);
}
console.log('check-third-party : aucune requête vers un domaine tiers\n');
