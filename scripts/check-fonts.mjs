#!/usr/bin/env node
/**
 * Budget de poids des polices (CDC section 12) : 90 Ko au total sur tout le site.
 *
 * Les polices sont déjà compressées en woff2, la compression de transport
 * n'apporte rien de plus. On mesure donc le poids sur disque, qui est ici le
 * poids transféré.
 */
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const DIR = 'public/fonts';
const BUDGET_KB = 90;

const files = (await readdir(DIR)).filter((f) => f.endsWith('.woff2'));
if (files.length === 0) {
  console.error(`check-fonts: aucun fichier woff2 dans ${DIR}`);
  process.exit(1);
}

let total = 0;
const rows = [];
for (const f of files) {
  const { size } = await stat(join(DIR, f));
  total += size;
  rows.push([f, size]);
}

rows.sort((a, b) => b[1] - a[1]);
for (const [f, size] of rows) {
  console.log(`  ${(size / 1024).toFixed(1).padStart(6)} Ko  ${f}`);
}

const totalKb = total / 1024;
const verdict = totalKb <= BUDGET_KB ? 'OK' : 'DEPASSEMENT';
console.log(`  ${'-'.repeat(40)}`);
console.log(`  ${totalKb.toFixed(1).padStart(6)} Ko  total (budget ${BUDGET_KB} Ko) — ${verdict}`);

if (totalKb > BUDGET_KB) {
  console.error(
    `\ncheck-fonts: budget dépassé de ${(totalKb - BUDGET_KB).toFixed(1)} Ko.\n` +
      `Le budget ne se négocie pas : resserrer le sous-ensemble ou retirer une graisse.`,
  );
  process.exit(1);
}
