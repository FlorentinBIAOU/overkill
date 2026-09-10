#!/usr/bin/env node
/**
 * Contrôle des liens (CDC 11.2).
 *
 *   « aucun lien interne mort, liens externes signalés en avertissement »
 *
 * La distinction est délibérée : un lien interne mort est notre faute et bloque
 * le déploiement ; un lien externe injoignable peut n'être qu'un serveur tiers
 * momentanément indisponible, et faire échouer la construction du site pour
 * cela rendrait la CI ingouvernable.
 *
 *   node scripts/check-links.mjs              internes seulement
 *   node scripts/check-links.mjs --external   vérifie aussi les liens externes
 */
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, resolve, extname } from 'node:path';
import { parse as parseYaml } from 'yaml';

const DIST = 'dist';

/**
 * Les pages de contrôle interne ne partent pas en production : elles sont
 * retirées par scripts/strip-dev-pages.mjs. Leurs liens vers des données
 * factices ne doivent pas faire échouer le contrôle.
 */
const IGNOREES = /^dev\//;

/**
 * Les intitulés de la feuille de route qui n'ont pas encore de fiche.
 *
 * La page de famille et la feuille de route les affichent en grisé, avec un
 * lien pour les proposer. Un lien vers une fiche « à écrire » est donc attendu,
 * pas cassé, et ne doit pas bloquer le déploiement.
 */
async function intitulesSansFiche() {
  const chemin = 'content/roadmap.yaml';
  if (!existsSync(chemin)) return new Set();
  const intitules = parseYaml(await readFile(chemin, 'utf8')) ?? [];
  const ecrites = new Set(
    existsSync('content/entries')
      ? (await readdir('content/entries'))
          .filter((f) => f.endsWith('.mdx') && !f.startsWith('_'))
          .map((f) => f.replace(/\.mdx$/, ''))
      : [],
  );
  return new Set(intitules.map((i) => i.id).filter((id) => !ecrites.has(id)));
}
const VERIFIER_EXTERNES = process.argv.includes('--external');

async function* pages(dossier) {
  for (const e of await readdir(dossier, { withFileTypes: true })) {
    const p = join(dossier, e.name);
    if (e.isDirectory()) yield* pages(p);
    else if (e.name.endsWith('.html')) yield p;
  }
}

if (!existsSync(DIST)) {
  console.error("check-links : dist/ absent. Construire le site d'abord.");
  process.exit(1);
}

const aEcrire = await intitulesSansFiche();
const morts = [];
const attendus = [];
const externes = new Map();
let internesVerifies = 0;

for await (const page of pages(DIST)) {
  const source = page.replace(`${DIST}/`, '');
  if (IGNOREES.test(source)) continue;
  const html = await readFile(page, 'utf8');

  // Les ancres déclarées dans cette page, pour vérifier les liens internes.
  const ancres = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));

  for (const m of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)) {
    const href = m[1];

    // L'adresse de contact est encodée en références numériques pour limiter
    // l'aspiration automatique : le navigateur la décode, ce contrôle doit
    // faire de même avant de décider s'il s'agit d'un lien interne.
    const decode = (t) => t.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
    const cible0 = decode(href);
    if (/^(mailto:|tel:|data:|javascript:)/i.test(cible0)) continue;

    if (/^https?:\/\//.test(href)) {
      if (!externes.has(href)) externes.set(href, new Set());
      externes.get(href).add(source);
      continue;
    }

    // Ancre dans la page courante.
    if (href.startsWith('#')) {
      const ancre = decodeURIComponent(href.slice(1));
      internesVerifies++;
      if (ancre && !ancres.has(ancre)) morts.push(`${source} → ${href} (ancre absente de la page)`);
      continue;
    }

    // Lien interne : on cherche le fichier correspondant dans dist/.
    const [chemin, ancre] = href.split('#');
    const sansRequete = chemin.split('?')[0];
    const base = sansRequete.startsWith('/')
      ? join(DIST, sansRequete)
      : resolve(dirname(page), sansRequete);

    const candidats = extname(base)
      ? [base]
      : [base, join(base, 'index.html'), `${base}.html`, `${base}/index.html`];

    internesVerifies++;
    const cible = candidats.find((c) => existsSync(c));
    if (!cible) {
      // Une fiche encore à écrire est une cible attendue, pas un lien mort.
      const identifiant = sansRequete.replace(/\/$/, '').split('/').pop();
      if (aEcrire.has(identifiant)) attendus.push(`${source} → ${href}`);
      else morts.push(`${source} → ${href}`);
      continue;
    }

    // L'ancre visée existe-t-elle dans la page de destination ?
    if (ancre && cible.endsWith('.html')) {
      const destination = await readFile(cible, 'utf8');
      if (!new RegExp(`\\bid="${ancre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).test(destination)) {
        morts.push(`${source} → ${href} (ancre absente de la page visée)`);
      }
    }
  }
}

console.log(
  `\ncheck-links — ${internesVerifies} lien(s) interne(s), ` +
    `${externes.size} lien(s) externe(s) distinct(s)\n`,
);

if (attendus.length) {
  console.log(
    `  ${attendus.length} lien(s) vers une fiche encore à écrire, attendus par la ` +
      `feuille de route.\n`,
  );
}

// --- Liens externes : avertissement, jamais échec ---------------------------
if (VERIFIER_EXTERNES && externes.size > 0) {
  const injoignables = [];
  for (const [url, sources] of externes) {
    try {
      const controleur = AbortSignal.timeout(12_000);
      let r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controleur });
      // Certains serveurs refusent HEAD sans que le lien soit mort.
      if (r.status === 405 || r.status === 403) {
        r = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(12_000) });
      }
      if (!r.ok) injoignables.push([url, `${r.status}`, sources]);
    } catch (e) {
      injoignables.push([url, String(e.name ?? e), sources]);
    }
  }
  if (injoignables.length) {
    console.log(`  ${injoignables.length} lien(s) externe(s) injoignable(s), en avertissement :\n`);
    for (const [url, raison, sources] of injoignables) {
      console.log(`  ! ${raison.padEnd(12)} ${url}`);
      console.log(`      cité par ${[...sources].slice(0, 3).join(', ')}`);
    }
    console.log('');
  } else {
    console.log('  Tous les liens externes répondent.\n');
  }
} else if (externes.size > 0) {
  console.log('  Liens externes non vérifiés. Ajouter --external pour les tester.\n');
}

// --- Liens internes : bloquant ---------------------------------------------
if (morts.length) {
  console.error(`check-links : ${morts.length} lien(s) interne(s) mort(s)\n`);
  for (const m of morts) console.error(`  ✗ ${m}`);
  console.error('');
  process.exit(1);
}
console.log('check-links : aucun lien interne mort\n');
