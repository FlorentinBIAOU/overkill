#!/usr/bin/env node
/**
 * Transforme la matrice des extraits, écrite pour être lue par un humain, en
 * un manifeste que les scripts peuvent consommer.
 *
 * La matrice reste la source : elle est relue, discutée et versionnée comme un
 * document. Le manifeste en est dérivé, jamais édité à la main.
 *
 *   node scripts/build-snippet-manifest.mjs           écrit le manifeste
 *   node scripts/build-snippet-manifest.mjs --check   vérifie qu'il est à jour
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const SOURCE = 'docs/sprints/MATRICE-EXTRAITS.md';
const SORTIE = 'content/snippets/manifest.json';

const texte = (await readFile(SOURCE, 'utf8')).split('## Récapitulatif')[0];

const blocs = texte.split(/^### \d+\. /m).slice(1);
const fiches = [];

for (const bloc of blocs) {
  const enTete = bloc.match(/^`([a-z0-9-]+)` — verdict attendu \*\*(N[0-3])\*\*/);
  if (!enTete) throw new Error(`en-tête de fiche illisible :\n${bloc.slice(0, 120)}`);
  const [, id, verdict] = enTete;

  const rungs = [];
  for (const m of bloc.matchAll(/^\| (N[0-3]) \| (.*?) \| (\*\*E\*\*|\*\*S\*\*|—) \|$/gm)) {
    const [, level, colonne, preuve] = m;
    const available = preuve !== '—';
    rungs.push(
      available
        ? {
            level,
            available: true,
            approach: colonne.trim(),
            verification: preuve.includes('E') ? 'executed' : 'stubbed',
          }
        : {
            level,
            available: false,
            // La raison est écrite dans la colonne « approche », après le tiret.
            unavailable_reason: colonne.replace(/^—\s*/, '').trim(),
          },
    );
  }

  if (rungs.length !== 4) {
    throw new Error(`${id} : ${rungs.length} niveaux au lieu de 4`);
  }
  if (!rungs.every((r, i) => r.level === ['N0', 'N1', 'N2', 'N3'][i])) {
    throw new Error(`${id} : niveaux hors de l'ordre N0 à N3`);
  }
  const cible = rungs.find((r) => r.level === verdict);
  if (!cible?.available) {
    throw new Error(`${id} : le verdict ${verdict} désigne un niveau absent`);
  }

  const rupture = bloc.match(/\*\*Point de rupture (N[0-3])\*\*\s*:\s*([\s\S]*?)(?:\n\n|\n---|$)/);
  fiches.push({
    id,
    expected_verdict: verdict,
    rungs,
    breaking_point_note: rupture
      ? { level: rupture[1], text: rupture[2].replace(/\s+/g, ' ').trim() }
      : null,
  });
}

const disponibles = fiches.flatMap((f) => f.rungs.filter((r) => r.available));
const manifeste = {
  _comment:
    'Dérivé de docs/sprints/MATRICE-EXTRAITS.md par scripts/build-snippet-manifest.mjs. ' +
    'Ne pas modifier à la main.',
  entries: fiches,
  totals: {
    entries: fiches.length,
    available_rungs: disponibles.length,
    executed: disponibles.filter((r) => r.verification === 'executed').length,
    stubbed: disponibles.filter((r) => r.verification === 'stubbed').length,
    files: disponibles.length * 4,
  },
};

const json = JSON.stringify(manifeste, null, 2) + '\n';

if (process.argv.includes('--check')) {
  const actuel = existsSync(SORTIE) ? await readFile(SORTIE, 'utf8') : '';
  if (actuel !== json) {
    console.error(
      `build-snippet-manifest : ${SORTIE} n'est plus à jour.\n` +
        `Relancer « node scripts/build-snippet-manifest.mjs ».`,
    );
    process.exit(1);
  }
  console.log('build-snippet-manifest : manifeste à jour');
} else {
  await writeFile(SORTIE, json);
  console.log(`build-snippet-manifest : ${SORTIE} écrit`);
}

const t = manifeste.totals;
console.log(
  `  ${t.entries} fiches, ${t.available_rungs} niveaux disponibles ` +
    `(${t.executed} executed, ${t.stubbed} stubbed), ${t.files} fichiers attendus`,
);
