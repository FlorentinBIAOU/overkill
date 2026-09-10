#!/usr/bin/env node
/**
 * Poids de la page courante, affiché en pied de page (CDC 12).
 *
 *   « Le poids de la page courante est affiché en pied de page, calculé au
 *     build. C'est un argument, pas un gadget : personne d'autre ne peut le
 *     copier sans refaire son site. »
 *
 * Le calcul est fait après la construction, sur la sortie réelle : le HTML
 * compressé, plus les ressources que la page référence vraiment. La valeur est
 * injectée dans le pied de page de cette page-là, et le pied de page est
 * dévoilé du même coup.
 *
 * Si une page ne peut pas être mesurée, sa ligne reste masquée. L'interdit
 * numéro 2 vaut aussi pour le site lui-même : mieux vaut ne rien afficher
 * qu'un chiffre faux.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, resolve, extname } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';

/** Ce qui est déjà compressé n'est pas compressé une seconde fois. */
const DEJA_COMPRESSE = new Set(['.woff2', '.woff', '.png', '.jpg', '.jpeg', '.webp', '.avif']);

async function transfere(chemin) {
  const octets = await readFile(chemin);
  return DEJA_COMPRESSE.has(extname(chemin)) ? octets.length : gzipSync(octets, { level: 9 }).length;
}

/**
 * Les ressources que la page charge réellement.
 *
 * On ne compte pas l'index de recherche : il n'est chargé qu'au premier
 * caractère tapé, et l'afficher dans le poids d'une page que personne ne
 * cherche serait faux dans l'autre sens.
 */
async function ressourcesDe(cheminHtml, html) {
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
      if (url.includes('search-index')) continue;
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
    else if (e.name.endsWith('.html')) yield p;
  }
}

if (!existsSync(DIST)) {
  console.error("compute-page-weight : dist/ absent. Construire le site d'abord.");
  process.exit(1);
}

let injectees = 0;
let sansEmplacement = 0;
let total = 0;
let laPlusLourde = { chemin: '', poids: 0 };

for await (const chemin of pages(DIST)) {
  const html = await readFile(chemin, 'utf8');

  // Le pied de page réserve l'emplacement et reste masqué tant qu'aucune
  // valeur n'est injectée.
  if (!html.includes('data-page-weight-line')) {
    sansEmplacement++;
    continue;
  }

  let poids = gzipSync(Buffer.from(html), { level: 9 }).length;
  for (const r of await ressourcesDe(chemin, html)) poids += await transfere(r);

  const ko = poids / 1024;
  const affiche = `${ko.toFixed(1).replace('.', ',')} Ko`;

  /*
   * Astro ajoute un attribut de portée à chaque élément d'un composant, si
   * bien que le balisage réel n'est pas littéral. On cible donc les deux
   * emplacements par motif.
   *
   * La ligne n'est dévoilée que si la valeur a bien été insérée : une ligne
   * visible et vide dirait au lecteur que la page ne pèse rien.
   */
  const avecValeur = html.replace(
    /(<span data-page-weight\b[^>]*>)(<\/span>)/,
    `$1${affiche}$2`,
  );

  if (avecValeur === html) {
    sansEmplacement++;
    continue;
  }

  const sortie = avecValeur.replace(
    /(<p class="site-footer__weight"[^>]*?)\s+hidden(\s|>)/,
    '$1$2',
  );

  await writeFile(chemin, sortie);
  injectees++;
  total += poids;
  if (poids > laPlusLourde.poids) laPlusLourde = { chemin, poids };
}

const moyenne = injectees ? total / injectees / 1024 : 0;
console.log(
  `\ncompute-page-weight — ${injectees} page(s) mesurée(s), ` +
    `moyenne ${moyenne.toFixed(1)} Ko, ` +
    `la plus lourde ${(laPlusLourde.poids / 1024).toFixed(1)} Ko ` +
    `(${laPlusLourde.chemin.replace(`${DIST}/`, '')})`,
);
if (sansEmplacement) {
  console.log(`  ${sansEmplacement} page(s) sans emplacement de poids, laissées telles quelles.\n`);
} else {
  console.log('');
}
