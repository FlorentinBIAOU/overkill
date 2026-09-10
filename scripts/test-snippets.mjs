#!/usr/bin/env node
/**
 * Exécute tous les extraits de code et leurs tests, et rend un compte rendu
 * par fiche.
 *
 * C'est le contrôle qui fait tenir la règle la plus importante du projet :
 * aucune fiche n'est publiée si son code n'a pas été exécuté et vérifié
 * (CDC 4.6, interdit 1).
 *
 *   node scripts/test-snippets.mjs                exécute tout
 *   node scripts/test-snippets.mjs <id-de-fiche>  n'exécute qu'une fiche
 *   node scripts/test-snippets.mjs --manifest     compare au manifeste
 */
import { spawnSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const RACINE = 'content/snippets';
const MANIFESTE = join(RACINE, 'manifest.json');

/**
 * Garde réseau, chargée avant les tests JavaScript : aucun extrait ne peut
 * ouvrir une connexion, même par accident. L'équivalent Python est un crochet
 * automatique de content/snippets/conftest.py.
 */
const GARDE_RESEAU = pathToFileURL(resolve(RACINE, '_harness/no-network.mjs')).href;

const args = process.argv.slice(2);
const verifierManifeste = args.includes('--manifest');
const cible = args.find((a) => !a.startsWith('--'));

/** Interpréteur Python : le venv d'outillage s'il existe, sinon python3. */
const PYTHON = existsSync('.venv-tools/bin/python') ? '.venv-tools/bin/python' : 'python3';

const dossiers = (await readdir(RACINE, { withFileTypes: true }))
  .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
  .map((e) => e.name)
  .filter((nom) => !cible || nom === cible)
  .sort();

if (dossiers.length === 0) {
  console.error(cible ? `Aucune fiche « ${cible} »` : `Aucun extrait sous ${RACINE}`);
  process.exit(1);
}

const lignes = [];
let extraits = 0;
let echecs = 0;
let sansTest = 0;

function lancer(commande, argv) {
  const r = spawnSync(commande, argv, { encoding: 'utf8' });
  return { ok: r.status === 0, sortie: (r.stdout ?? '') + (r.stderr ?? '') };
}

for (const fiche of dossiers) {
  const dossier = join(RACINE, fiche);
  const fichiers = await readdir(dossier);

  const py = fichiers.filter((f) => /^n[0-3]\.py$/.test(f)).sort();
  const js = fichiers.filter((f) => /^n[0-3]\.js$/.test(f)).sort();
  extraits += py.length + js.length;

  const manquants = [];
  for (const f of [...py, ...js]) {
    const ext = f.endsWith('.py') ? 'py' : 'js';
    if (!fichiers.includes(f.replace(`.${ext}`, `.test.${ext}`))) manquants.push(f);
  }
  sansTest += manquants.length;

  const resultats = [];

  if (py.length) {
    const r = lancer(PYTHON, ['-m', 'pytest', dossier, '--no-header', '-q']);
    resultats.push(['python', r]);
  }
  if (js.length) {
    const tests = fichiers.filter((f) => /^n[0-3]\.test\.js$/.test(f)).map((f) => join(dossier, f));
    if (tests.length) {
      // La garde réseau est chargée avant les tests : aucun extrait ne peut
      // ouvrir une connexion, même par accident.
      const r = lancer(process.execPath, ['--import', GARDE_RESEAU, '--test', ...tests]);
      resultats.push(['javascript', r]);
    }
  }

  const enEchec = resultats.filter(([, r]) => !r.ok);
  if (enEchec.length || manquants.length) echecs++;

  const etat = enEchec.length ? 'ÉCHEC' : manquants.length ? 'SANS TEST' : 'ok';
  lignes.push(
    `  ${etat.padEnd(9)} ${fiche.padEnd(34)} ${py.length} py, ${js.length} js`,
  );
  for (const f of manquants) lignes.push(`            aucun test pour ${f}`);
  for (const [langage, r] of enEchec) {
    lignes.push(`            ${langage} :`);
    for (const l of r.sortie.trim().split('\n').slice(-18)) lignes.push(`              ${l}`);
  }
}

console.log(`\ntest-snippets — ${dossiers.length} fiche(s), ${extraits} extrait(s)\n`);
console.log(lignes.join('\n'));

// Comparaison au manifeste : ce que la matrice annonce doit exister.
if (verifierManifeste && existsSync(MANIFESTE)) {
  const { entries } = JSON.parse(await readFile(MANIFESTE, 'utf8'));
  const absents = [];
  for (const e of entries) {
    if (cible && e.id !== cible) continue;
    for (const r of e.rungs) {
      if (!r.available) continue;
      const n = r.level.toLowerCase();
      for (const ext of ['py', 'js']) {
        for (const f of [`${n}.${ext}`, `${n}.test.${ext}`]) {
          const chemin = join(RACINE, e.id, f);
          if (!existsSync(chemin)) absents.push(chemin);
        }
      }
    }
  }
  if (absents.length) {
    console.log(`\n  ${absents.length} fichier(s) annoncé(s) par la matrice et absent(s) :`);
    for (const a of absents.slice(0, 40)) console.log(`    ${a}`);
    if (absents.length > 40) console.log(`    … et ${absents.length - 40} autres`);
    echecs++;
  }
}

console.log('');
if (echecs) {
  console.error(`test-snippets : ${echecs} fiche(s) en échec\n`);
  process.exit(1);
}
console.log(`test-snippets : OK — ${extraits} extrait(s) exécuté(s), aucun échec\n`);
