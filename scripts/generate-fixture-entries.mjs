#!/usr/bin/env node
/**
 * Jeu de fiches de test à 200 entrées (CDC 6.2).
 *
 * « L'architecture du site, la navigation, la recherche et les filtres doivent
 * fonctionner correctement avec 200 fiches publiées. Génère un jeu de données
 * de test à 200 entrées pour le vérifier, non commité, ou derrière un drapeau
 * de développement. »
 *
 * Les fiches sont dérivées des 200 intitulés réels de la feuille de route :
 * mêmes identifiants, mêmes titres, mêmes besoins, ce qui rend le test
 * représentatif du contenu final. Les barreaux, eux, sont fabriqués, puisque
 * ces intitulés n'ont pas de contenu et n'en auront pas (interdit 7).
 *
 * La sortie va dans un dossier ignoré par Git, et le script refuse d'écrire si
 * ce dossier venait à être suivi.
 */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

const SORTIE = 'content/entries-fixtures';
const ROADMAP = 'content/roadmap.yaml';

// Garde-fou : ce dossier ne doit jamais entrer dans l'historique.
try {
  const suivis = execFileSync('git', ['ls-files', SORTIE], { encoding: 'utf8' }).trim();
  if (suivis) {
    console.error(
      `generate-fixture-entries : ${SORTIE} est suivi par Git.\n` +
        `Ce jeu de test ne se commite pas (CDC 6.2). Le retirer de l'index avant de continuer.`,
    );
    process.exit(1);
  }
} catch {
  // Hors dépôt Git : rien à vérifier.
}

const intitules = parseYaml(await readFile(ROADMAP, 'utf8')) ?? [];
if (intitules.length === 0) {
  console.error(`generate-fixture-entries : ${ROADMAP} est vide.`);
  process.exit(1);
}

/** Choix déterministe, pour que deux exécutions donnent le même jeu. */
function hachage(texte) {
  let h = 2166136261;
  for (const c of texte) h = Math.imul(h ^ c.codePointAt(0), 16777619) >>> 0;
  return h;
}
const parmi = (id, sel, liste) => liste[hachage(id + sel) % liste.length];

const NIVEAUX = ['N0', 'N1', 'N2', 'N3'];
const COUTS = ['nul', 'négligeable', 'faible', 'modéré', 'élevé'];
const LATENCES = ['<1 ms', '~10 ms', '~100 ms', '~1 s', '>1 s'];
const EGRESS = ['none', 'own-infra', 'third-party'];

function fabriquerBarreaux(id) {
  const combien = 2 + (hachage(id + 'n') % 3); // 2 à 4 barreaux disponibles
  const disponibles = new Set(NIVEAUX.slice(0, combien));
  return NIVEAUX.map((level, i) =>
    disponibles.has(level)
      ? {
          level,
          available: true,
          name: {
            fr: `Approche ${level} de démonstration`,
            en: `Demonstration ${level} approach`,
          },
          cost: COUTS[Math.min(i + (hachage(id + level) % 2), COUTS.length - 1)],
          latency: LATENCES[Math.min(i + (hachage(id + level + 'l') % 2), LATENCES.length - 1)],
          risks: {
            data_egress: i === 3 ? 'third-party' : parmi(id, level, EGRESS.slice(0, 2)),
            deterministic: i < 2,
            testability: i < 2 ? 'unit' : 'statistical',
            vendor_lock: i === 3 ? 'provider' : i === 0 ? 'none' : 'library',
            footprint: ['negligible', 'low', 'moderate', 'high'][i],
            regulatory: { fr: ['Jeu de test'], en: ['Test fixture'] },
          },
          code: {
            python: 'snippets/_fixture/n0.py',
            javascript: 'snippets/_fixture/n0.js',
            verification: i < 2 ? 'executed' : 'stubbed',
          },
          breaking_point: { fr: 'Jeu de test.', en: 'Test fixture.' },
          escalate_when: { fr: 'Jeu de test.', en: 'Test fixture.' },
        }
      : {
          level,
          available: false,
          unavailable_reason: { fr: 'Jeu de test.', en: 'Test fixture.' },
        },
  );
}

await rm(SORTIE, { recursive: true, force: true });
await mkdir(SORTIE, { recursive: true });

for (const item of intitules) {
  const rungs = fabriquerBarreaux(item.id);
  const disponibles = rungs.filter((r) => r.available).map((r) => r.level);
  const verdict = parmi(item.id, 'v', disponibles);

  const document = {
    id: item.id,
    family: item.family,
    status: 'published',
    verdict,
    updated: '2026-09-01',
    contributors: ['florentin-biaou'],
    title: item.title,
    need: item.need,
    scenario: {
      fr: `Jeu de test à deux cents entrées. ${item.need.fr}`,
      en: `Two hundred entry test fixture. ${item.need.en}`,
    },
    rungs,
    verdict_rationale: { fr: 'Jeu de test.', en: 'Test fixture.' },
    further_reading: [],
    sources: [],
  };

  // YAML est un sur-ensemble de JSON : l'objet complet, accolades comprises,
  // est un frontmatter valide, et évite d'avoir à échapper quoi que ce soit.
  await writeFile(
    join(SORTIE, `${item.id}.mdx`),
    `---\n${JSON.stringify(document, null, 2)}\n---\n`,
  );
}

console.log(
  `generate-fixture-entries : ${intitules.length} fiche(s) de test écrites dans ${SORTIE}/\n` +
    `  Construire avec OVERKILL_FIXTURES=1 pour les inclure.`,
);
