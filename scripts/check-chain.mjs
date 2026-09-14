#!/usr/bin/env node
/**
 * Un contrôle que personne ne lance ne contrôle rien (lot 14 partie 10).
 *
 * `test:search` a vécu six lots hors de `npm run check`, et deux de ses
 * assertions ont pourri en silence : elles visaient un balisage que la refonte
 * avait remplacé. Personne ne s'en est aperçu parce que personne ne lançait la
 * suite.
 *
 * Ce contrôle rend cela impossible. Tout script `check:*` ou `test:*` déclaré
 * dans package.json doit apparaître dans l'une des deux passes — la rapide ou
 * la longue —, sauf exemption écrite ici avec sa raison.
 *
 * Il tourne en tête de la passe rapide, donc avant tout le reste : ajouter un
 * contrôle sans le brancher fait échouer la chaîne immédiatement.
 */
import { readFile } from 'node:fs/promises';

/** Scripts qui n'ont pas à figurer dans la chaîne, et pourquoi. */
const EXEMPTS = new Map([
  ['check:chain', "c'est ce contrôle-ci, il ouvre la passe rapide"],
  ['check:fast', 'la passe elle-même, appelée par check'],
  ['check:slow', 'la passe elle-même, appelée par check'],
  ['check:links:external', 'dépend du réseau, tourne en avertissement hors chaîne'],
]);

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const scripts = pkg.scripts ?? {};

const chaine = [scripts['check:fast'] ?? '', scripts['check:slow'] ?? ''].join(' ; ');
if (!scripts['check:fast'] || !scripts['check:slow']) {
  console.error('check-chain : les deux passes check:fast et check:slow doivent exister.');
  process.exit(1);
}

/** Les noms appelés par une chaîne, tels qu'ils y figurent. */
const appeles = new Set([...chaine.matchAll(/npm run ([\w:-]+)/g)].map((m) => m[1]));

const orphelins = [];
for (const nom of Object.keys(scripts)) {
  if (!/^(check|test):/.test(nom)) continue;
  if (EXEMPTS.has(nom)) continue;
  if (!appeles.has(nom)) orphelins.push(nom);
}

/* Et l'inverse : un nom appelé qui n'existe plus. */
const fantomes = [...appeles].filter((n) => !(n in scripts));

if (orphelins.length || fantomes.length) {
  for (const o of orphelins) {
    console.error(`check-chain : ${o} n'est lancé par aucune passe. Branchez-le, ou exemptez-le avec sa raison.`);
  }
  for (const f of fantomes) {
    console.error(`check-chain : la chaîne appelle ${f}, qui n'existe pas.`);
  }
  process.exit(1);
}

console.log(
  `check-chain : OK — ${appeles.size} étape(s) enchaînée(s), ` +
    `${EXEMPTS.size} exemption(s) écrite(s)`,
);
