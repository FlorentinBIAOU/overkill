#!/usr/bin/env node
/**
 * Contraintes des illustrations (CDC 8.6).
 *
 * Ce contrôle vérifie ce qui se vérifie mécaniquement : le poids, la palette,
 * l'épaisseur de trait, l'absence de dégradé et de trame, la présence d'un
 * `role="img"` et d'un `<title>`.
 *
 * Ce qu'il ne peut pas vérifier, et qui compte au moins autant : que
 * l'illustration exprime le verbe de sa famille, et que les douze forment une
 * série. Cela se regarde, à trois tailles et dans les deux thèmes.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIR = 'src/assets/illustrations';
const BUDGET_KO = 8;

/** La palette autorisée : les tokens, et rien d'autre (CDC 8.6). */
const PALETTE = new Set([
  '#16130E', '#FFCE00', '#FFFDF7', '#F4EFE2',
  '#EDE7D7', '#C8BC9E', '#8A7C5C', '#4C4432',
  'currentColor', 'none',
]);

const INTERDITS = [
  [/<linearGradient|<radialGradient|gradient/i, 'dégradé'],
  [/<pattern/i, 'trame'],
  [/<filter|filter=/i, 'filtre'],
  [/opacity\s*[:=]/i, 'opacité partielle'],
  [/<text|<tspan/i, 'texte'],
  [/<image/i, 'image matricielle'],
];

const fichiers = (await readdir(DIR)).filter((f) => f.endsWith('.svg')).sort();
const problemes = [];
const lignes = [];

for (const f of fichiers) {
  const chemin = join(DIR, f);
  const svg = await readFile(chemin, 'utf8');
  const { size } = await stat(chemin);
  const transfere = gzipSync(Buffer.from(svg), { level: 9 }).length;

  const dire = (quoi) => problemes.push(`${f} : ${quoi}`);

  if (size / 1024 > BUDGET_KO) dire(`${(size / 1024).toFixed(1)} Ko, budget ${BUDGET_KO} Ko`);
  if (!/role="img"/.test(svg)) dire('role="img" manquant');
  if (!/<title>/.test(svg)) dire('<title> manquant');

  for (const [motif, nom] of INTERDITS) {
    if (motif.test(svg)) dire(`${nom} interdit (CDC 8.6)`);
  }

  // Palette : toute valeur de couleur doit venir des tokens.
  for (const m of svg.matchAll(/(?:fill|stroke)="([^"]+)"/g)) {
    const valeur = m[1];
    if (!PALETTE.has(valeur) && !PALETTE.has(valeur.toUpperCase())) {
      dire(`couleur hors palette : ${valeur}`);
    }
  }

  // Épaisseurs de trait : 16 sur les formes principales, 8 sur les détails.
  for (const m of svg.matchAll(/stroke-width="([^"]+)"/g)) {
    if (!['16', '8'].includes(m[1])) dire(`épaisseur de trait ${m[1]}, attendu 16 ou 8`);
  }

  // Coordonnées : pas de décimale, la grille est en entiers.
  if (/(?:x|y|cx|cy|r|width|height)="[-\d]+\.\d\d+"/.test(svg)) {
    dire('coordonnée à plus d\'une décimale');
  }

  lignes.push(
    `  ${(size / 1024).toFixed(2).padStart(5)} Ko  ${(transfere / 1024).toFixed(2).padStart(5)} Ko gz  ${f}`,
  );
}

console.log(`\ncheck-illustrations — ${fichiers.length} fichier(s), budget ${BUDGET_KO} Ko l'unité\n`);
console.log(lignes.join('\n'));

if (problemes.length) {
  console.error(`\ncheck-illustrations : ${problemes.length} problème(s)\n`);
  for (const p of problemes) console.error(`  ✗ ${p}`);
  console.error('');
  process.exit(1);
}
console.log('\ncheck-illustrations : contraintes respectées\n');
