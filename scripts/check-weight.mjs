#!/usr/bin/env node
/**
 * Budgets de poids de la section 12 du cahier des charges. Bloquants.
 *
 * | Élément                                        | Budget  |
 * |------------------------------------------------|---------|
 * | Page de fiche, transféré, hors illustrations    | ≤ 120 Ko|
 * | Accueil, transféré, illustrations comprises     | ≤ 250 Ko|
 * | Polices, total sur tout le site                 | ≤ 90 Ko |
 * | JavaScript sur une page de fiche                | ≤ 15 Ko |
 * | JavaScript sur le catalogue, index exclu        | ≤ 25 Ko |
 * | Illustration unitaire                           | ≤ 8 Ko  |
 *
 * « Transféré » veut dire ce qui passe sur le réseau : on compresse en gzip
 * avant de mesurer, ce que fait tout hébergeur statique. Les woff2 et les
 * images déjà compressés sont comptés tels quels.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const KO = 1024;

const BUDGETS = {
  entryPage: 120,
  home: 250,
  fonts: 90,
  entryJs: 15,
  catalogueJs: 25,
  illustration: 8,
};

/** Poids transféré : gzip, sauf pour ce qui est déjà compressé. */
const DEJA_COMPRESSE = new Set(['.woff2', '.woff', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.gz']);

async function transfere(chemin) {
  const octets = await readFile(chemin);
  return DEJA_COMPRESSE.has(extname(chemin)) ? octets.length : gzipSync(octets, { level: 9 }).length;
}

/** Ressources référencées par une page, résolues sur le disque. */
async function ressourcesDe(cheminHtml) {
  const html = await readFile(cheminHtml, 'utf8');
  const trouvees = new Set();
  const motifs = [
    /<script[^>]+src="([^"]+)"/g,
    /<link[^>]+href="([^"]+)"[^>]*rel="stylesheet"/g,
    /<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"/g,
    /<link[^>]+rel="preload"[^>]*href="([^"]+)"/g,
    /<img[^>]+src="([^"]+)"/g,
  ];
  for (const motif of motifs) {
    for (const m of html.matchAll(motif)) {
      const url = m[1];
      if (url.startsWith('http') || url.startsWith('data:')) continue;
      const p = url.startsWith('/') ? join(DIST, url) : resolve(dirname(cheminHtml), url);
      if (existsSync(p)) trouvees.add(p);
    }
  }
  return [...trouvees];
}

async function* pages(dossier) {
  for (const e of await readdir(dossier, { withFileTypes: true })) {
    const p = join(dossier, e.name);
    if (e.isDirectory()) yield* pages(p);
    else if (e.name === 'index.html') yield p;
  }
}

const lignes = [];
const echecs = [];

function verifier(libelle, mesureKo, budgetKo) {
  const ok = mesureKo <= budgetKo;
  lignes.push(
    `  ${ok ? 'ok   ' : 'ÉCHEC'} ${mesureKo.toFixed(1).padStart(7)} Ko / ${String(budgetKo).padStart(3)} Ko  ${libelle}`,
  );
  if (!ok) echecs.push(`${libelle} : ${mesureKo.toFixed(1)} Ko pour un budget de ${budgetKo} Ko`);
}

if (!existsSync(DIST)) {
  console.error('check-weight : dist/ absent. Construire le site d\'abord.');
  process.exit(1);
}

// --- Polices, total sur tout le site ---------------------------------------
let polices = 0;
if (existsSync(join(DIST, 'fonts'))) {
  for (const f of await readdir(join(DIST, 'fonts'))) {
    polices += (await stat(join(DIST, 'fonts', f))).size;
  }
}
verifier('polices, total sur le site', polices / KO, BUDGETS.fonts);

// --- Illustrations, unitaires ----------------------------------------------
const illustrations = 'src/assets/illustrations';
if (existsSync(illustrations)) {
  for (const f of (await readdir(illustrations)).filter((n) => n.endsWith('.svg'))) {
    const poids = (await transfere(join(illustrations, f))) / KO;
    verifier(`illustration ${f}`, poids, BUDGETS.illustration);
  }
}

// --- Pages -----------------------------------------------------------------
const toutes = [];
for await (const p of pages(DIST)) toutes.push(p);

const estFiche = (p) => /\/fiches\/[^/]+\/index\.html$/.test(p);
const estAccueil = (p) => /dist\/(en|fr)\/index\.html$/.test(p);
const estCatalogue = (p) => /\/catalogue\/index\.html$/.test(p);

/**
 * Astro met les petits modules en ligne dans le HTML plutôt que d'émettre un
 * fichier. Les compter séparément est indispensable : sans cela, le budget de
 * JavaScript mesurerait zéro sur une page qui en exécute.
 */
async function jsEnLigne(cheminHtml) {
  const html = await readFile(cheminHtml, 'utf8');
  const morceaux = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
    (m) => m[1],
  );
  if (morceaux.length === 0) return 0;
  return gzipSync(Buffer.from(morceaux.join('\n')), { level: 9 }).length;
}

/**
 * Le module d'essai d'une fiche est chargé à la demande, donc il n'apparaît
 * dans aucune balise `script` : il serait invisible au budget alors que le
 * navigateur le télécharge. La page nomme l'essai qu'elle emploie dans
 * `data-tryout`, et le module émis porte ce nom — c'est ce lien qu'on suit.
 */
async function jsDiffere(cheminHtml) {
  const html = await readFile(cheminHtml, 'utf8');
  const m = html.match(/data-tryout="([a-z0-9-]+)"/);
  if (!m) return 0;
  const dossier = join(DIST, '_astro');
  let poids = 0;
  for (const f of await readdir(dossier)) {
    if (f.startsWith(`${m[1]}.`) && f.endsWith('.js')) poids += await transfere(join(dossier, f));
  }
  return poids;
}

async function poidsPage(chemin, { sansIllustrations = false } = {}) {
  let total = await transfere(chemin);
  let js = await jsEnLigne(chemin);
  const differe = await jsDiffere(chemin);
  total += differe;
  js += differe;
  for (const r of await ressourcesDe(chemin)) {
    if (sansIllustrations && /\.(svg|png|jpe?g|webp|avif)$/.test(r)) continue;
    const t = await transfere(r);
    total += t;
    if (r.endsWith('.js')) js += t;
  }
  return { total, js };
}

// La page de fiche la plus lourde, pas la moyenne : le budget vaut pour toutes.
const fiches = toutes.filter(estFiche);
if (fiches.length) {
  // La plus lourde et celle qui charge le plus de JavaScript ne sont pas
  // forcément la même fiche : le budget vaut pour toutes, donc on mesure les
  // deux pires séparément.
  let pire = { chemin: '', total: 0, js: 0 };
  let pireJs = { chemin: '', total: 0, js: 0 };
  for (const f of fiches) {
    const m = await poidsPage(f, { sansIllustrations: true });
    if (m.total > pire.total) pire = { chemin: f, ...m };
    if (m.js > pireJs.js) pireJs = { chemin: f, ...m };
  }
  const nom = pire.chemin.replace(`${DIST}/`, '');
  verifier(`fiche la plus lourde, hors illustrations (${nom})`, pire.total / KO, BUDGETS.entryPage);
  verifier(
    `JavaScript, fiche la plus chargée (${pireJs.chemin.replace(`${DIST}/`, '')})`,
    pireJs.js / KO,
    BUDGETS.entryJs,
  );
}

for (const accueil of toutes.filter(estAccueil)) {
  const m = await poidsPage(accueil);
  verifier(`accueil ${accueil.replace(`${DIST}/`, '')}`, m.total / KO, BUDGETS.home);
}

for (const cat of toutes.filter(estCatalogue)) {
  // L'index de recherche est explicitement exclu du budget par le CDC, et il
  // n'est de toute façon chargé qu'au premier caractère tapé.
  const m = await poidsPage(cat);
  verifier(`JavaScript du catalogue ${cat.replace(`${DIST}/`, '')}`, m.js / KO, BUDGETS.catalogueJs);
}

console.log(`\ncheck-weight — budgets de la section 12\n`);
console.log(lignes.join('\n'));

if (echecs.length) {
  console.error(`\ncheck-weight : ${echecs.length} budget(s) dépassé(s)\n`);
  for (const e of echecs) console.error(`  ${e}`);
  console.error(
    `\nLe budget ne se négocie pas : c'est la fonctionnalité qui cède, pas le chiffre.\n`,
  );
  process.exit(1);
}
console.log('\ncheck-weight : tous les budgets sont respectés\n');
