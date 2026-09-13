#!/usr/bin/env node
/**
 * Le référencement, vérifié sur ce qui est livré (lot 14, 9.1).
 *
 * Le contrôle parcourt `dist` et refuse :
 *
 *   - un titre manquant, vide, ou employé par deux pages de la même langue
 *   - une méta description manquante, vide, ou employée par deux pages de la
 *     même langue
 *   - une balise canonique absente, ou qui ne désigne pas la page elle-même
 *   - un `hreflang` manquant : les deux langues et `x-default` sont attendus
 *   - un bloc de données structurées illisible, sans `@context` ni `@type`
 *
 * L'unicité se juge **par langue** : la page française du catalogue et la page
 * anglaise portent le même titre, et c'est correct — `hreflang` dit aux moteurs
 * qu'elles sont deux versions d'une même page, pas deux pages concurrentes.
 *
 * La racine du site est un repli de redirection, marqué `noindex` : elle n'a ni
 * canonique, ni description, et n'a pas à en avoir.
 *
 * Lecture par expressions régulières et non par analyseur de document : il
 * s'agit de lire cinq balises par page, et le contrôle doit rester rapide à
 * deux cents pages. La durée est affichée pour que la promesse se vérifie.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const DIST = 'dist';
const SITE = 'https://isitoverkill.dev';
const LANGUES = ['fr', 'en'];

const debut = performance.now();
const problemes = [];
/** Un jeu de titres et de descriptions par langue. */
const titres = new Map();
const descriptions = new Map();
const vus = (table, langue) => {
  if (!table.has(langue)) table.set(langue, new Map());
  return table.get(langue);
};

async function* pages(dossier) {
  for (const e of await readdir(dossier, { withFileTypes: true })) {
    const p = join(dossier, e.name);
    if (e.isDirectory()) {
      // Les pages de contrôle ne sont pas publiées : elles n'ont pas à être
      // référençables.
      if (e.name === 'dev' || e.name === '_astro') continue;
      yield* pages(p);
    } else if (e.name.endsWith('.html')) {
      yield p;
    }
  }
}

/** `dist/fr/catalogue/index.html` → `/fr/catalogue` */
const chemin = (fichier) =>
  '/' + relative(DIST, fichier).replace(/index\.html$/, '').replace(/\.html$/, '').replace(/\/$/, '');

const UN = (html, motif) => html.match(motif)?.[1];

let nb = 0;
let blocs = 0;

for await (const fichier of pages(DIST)) {
  const html = await readFile(fichier, 'utf8');
  const ou = relative(DIST, fichier);
  const url = chemin(fichier);
  nb += 1;

  /* La racine est le repli de redirection, en noindex : elle n'entre pas dans
     le référencement, et n'a donc ni canonique ni description à porter. */
  if (ou === 'index.html') continue;

  const langue = url.split('/')[1] ?? '';
  const titresVus = vus(titres, langue);
  const descriptionsVues = vus(descriptions, langue);

  const titre = UN(html, /<title>([\s\S]*?)<\/title>/);
  if (!titre?.trim()) {
    problemes.push(`${ou} — titre manquant ou vide`);
  } else if (titresVus.has(titre)) {
    problemes.push(
      `${ou} — titre en double, déjà porté par ${titresVus.get(titre)} : « ${titre} »`,
    );
  } else {
    titresVus.set(titre, ou);
  }

  const description = UN(html, /<meta name="description" content="([^"]*)"/);
  if (!description?.trim()) {
    problemes.push(`${ou} — méta description manquante ou vide`);
  } else if (descriptionsVues.has(description)) {
    problemes.push(
      `${ou} — méta description en double, déjà portée par ${descriptionsVues.get(description)}`,
    );
  } else {
    descriptionsVues.set(description, ou);
  }

  const canonique = UN(html, /<link rel="canonical" href="([^"]+)"/);
  if (!canonique) {
    problemes.push(`${ou} — balise canonique absente`);
  } else {
    const attendu = `${SITE}${url}`;
    if (canonique !== attendu) {
      problemes.push(`${ou} — canonique ${canonique}, attendu ${attendu}`);
    }
  }

  const hreflangs = [...html.matchAll(/hreflang="([^"]+)"/g)].map((m) => m[1]);
  for (const attendu of [...LANGUES, 'x-default']) {
    if (!hreflangs.includes(attendu)) {
      problemes.push(`${ou} — hreflang « ${attendu} » manquant`);
    }
  }

  for (const m of html.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
  )) {
    blocs += 1;
    let donnees;
    try {
      donnees = JSON.parse(m[1]);
    } catch (erreur) {
      problemes.push(`${ou} — données structurées illisibles : ${erreur.message}`);
      continue;
    }
    if (!donnees['@context']) problemes.push(`${ou} — données structurées sans @context`);
    if (!donnees['@type']) problemes.push(`${ou} — données structurées sans @type`);
  }
}

const duree = Math.round(performance.now() - debut);
console.log(
  `\ncheck-seo — ${nb} page(s), ${blocs} bloc(s) de données structurées, ${duree} ms\n`,
);

if (problemes.length) {
  console.error(`check-seo : ${problemes.length} problème(s)\n`);
  for (const p of problemes) console.error(`  ✗ ${p}`);
  console.error('');
  process.exit(1);
}

console.log('check-seo : titres et descriptions uniques, canoniques et hreflang en place\n');
