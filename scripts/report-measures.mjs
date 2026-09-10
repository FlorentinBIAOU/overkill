#!/usr/bin/env node
/**
 * Rassemble les mesures qui alimentent la rubrique « Mesures » de RAPPORT.md
 * (CDC 15).
 *
 * Toutes les valeurs sont lues sur la sortie réelle du site, jamais saisies à
 * la main : un rapport qui recopie des chiffres finit par en recopier de faux.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { gzipSync } from 'node:zlib';
import { parse as parseYaml } from 'yaml';
import matter from 'gray-matter';

const DIST = 'dist';
const KO = 1024;
const ko = (n) => `${(n / KO).toFixed(1)} Ko`;

if (!existsSync(DIST)) {
  console.error("report-measures : dist/ absent. Construire le site d'abord.");
  process.exit(1);
}

async function* pages(dossier) {
  for (const e of await readdir(dossier, { withFileTypes: true })) {
    const p = join(dossier, e.name);
    if (e.isDirectory()) yield* pages(p);
    else if (e.name.endsWith('.html')) yield p;
  }
}

const transfere = async (c) =>
  ['.woff2', '.png', '.jpg', '.webp'].includes(extname(c))
    ? (await stat(c)).size
    : gzipSync(await readFile(c)).length;

// --- Pages -----------------------------------------------------------------
const parType = { fiche: [], famille: [], catalogue: [], accueil: [], éditoriale: [] };
let total = 0;
let compte = 0;

for await (const p of pages(DIST)) {
  const poids = await transfere(p);
  total += poids;
  compte++;
  const rel = p.replace(`${DIST}/`, '');
  if (/\/fiches\//.test(rel)) parType.fiche.push([rel, poids]);
  else if (/\/familles\//.test(rel)) parType.famille.push([rel, poids]);
  else if (/\/catalogue\//.test(rel)) parType.catalogue.push([rel, poids]);
  else if (/^(en|fr)\/index\.html$/.test(rel)) parType.accueil.push([rel, poids]);
  else parType.éditoriale.push([rel, poids]);
}

console.log('\n## Poids par type de page, HTML transféré\n');
console.log('| Type | Pages | Moyenne | La plus lourde |');
console.log('|---|---|---|---|');
for (const [nom, liste] of Object.entries(parType)) {
  if (!liste.length) continue;
  const moy = liste.reduce((s, [, p]) => s + p, 0) / liste.length;
  const pire = liste.reduce((a, b) => (b[1] > a[1] ? b : a));
  console.log(`| ${nom} | ${liste.length} | ${ko(moy)} | ${ko(pire[1])} — ${pire[0]} |`);
}
console.log(`\nTotal du site : ${ko(total)} sur ${compte} pages.`);

// --- Polices ---------------------------------------------------------------
let polices = 0;
const detailPolices = [];
if (existsSync(join(DIST, 'fonts'))) {
  for (const f of await readdir(join(DIST, 'fonts'))) {
    const s = (await stat(join(DIST, 'fonts', f))).size;
    polices += s;
    detailPolices.push([f, s]);
  }
}
console.log('\n## Polices\n');
console.log('| Fichier | Transféré |');
console.log('|---|---|');
for (const [f, s] of detailPolices.sort((a, b) => b[1] - a[1])) {
  console.log(`| ${f} | ${ko(s)} |`);
}
console.log(`| **Total** | **${ko(polices)}** pour un budget de 90 Ko |`);

// --- Illustrations ---------------------------------------------------------
const illus = 'src/assets/illustrations';
if (existsSync(illus)) {
  const fichiers = (await readdir(illus)).filter((f) => f.endsWith('.svg'));
  let plus = 0;
  for (const f of fichiers) plus = Math.max(plus, (await stat(join(illus, f))).size);
  console.log(
    `\n## Illustrations\n\n${fichiers.length} fichiers, la plus lourde ${ko(plus)} ` +
      `pour un budget de 8 Ko l'unité.`,
  );
}

// --- Contenu ---------------------------------------------------------------
const entries = existsSync('content/entries')
  ? (await readdir('content/entries')).filter((f) => f.endsWith('.mdx') && !f.startsWith('_'))
  : [];

let publiees = 0;
let brouillons = 0;
const parFamille = {};
const parVerdict = {};
let barreauxDispo = 0;
let executed = 0;
let stubbed = 0;

for (const f of entries) {
  const { data } = matter(await readFile(join('content/entries', f), 'utf8'));
  if (data.status === 'published') publiees++;
  else brouillons++;
  parFamille[data.family] = (parFamille[data.family] ?? 0) + 1;
  parVerdict[data.verdict] = (parVerdict[data.verdict] ?? 0) + 1;
  for (const r of data.rungs ?? []) {
    if (!r.available) continue;
    barreauxDispo++;
    if (r.code?.verification === 'executed') executed++;
    else stubbed++;
  }
}

console.log('\n## Contenu\n');
console.log(`Fiches : ${entries.length} (${publiees} publiées, ${brouillons} brouillons).`);
console.log(`Barreaux disponibles : ${barreauxDispo}, dont ${executed} executed et ${stubbed} stubbed.`);
console.log('\n| Verdict | Fiches |');
console.log('|---|---|');
for (const v of ['N0', 'N1', 'N2', 'N3']) {
  if (parVerdict[v]) console.log(`| ${v} | ${parVerdict[v]} |`);
}

// --- Feuille de route ------------------------------------------------------
if (existsSync('content/roadmap.yaml')) {
  const intitules = parseYaml(await readFile('content/roadmap.yaml', 'utf8')) ?? [];
  const parFamilleRoadmap = {};
  for (const i of intitules) {
    parFamilleRoadmap[i.family] = (parFamilleRoadmap[i.family] ?? 0) + 1;
  }
  console.log(`\n## Feuille de route\n\n${intitules.length} intitulés.\n`);
  console.log('| Famille | Intitulés | Fiches écrites |');
  console.log('|---|---|---|');
  for (const [f, n] of Object.entries(parFamilleRoadmap).sort()) {
    console.log(`| ${f} | ${n} | ${parFamille[f] ?? 0} |`);
  }
}
console.log('');
