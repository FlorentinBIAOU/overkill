#!/usr/bin/env node
/**
 * Validation du contenu, au-delà de ce que le schéma Zod peut faire seul.
 *
 * Zod voit la forme d'un document. Il ne voit ni le disque, ni les autres
 * fiches. Ce contrôle prend en charge ce qui manque (CDC 5.2 et 4.6) :
 *
 *   - unicité des identifiants, et égalité identifiant / nom de fichier
 *   - existence sur le disque de chaque fichier de code référencé
 *   - existence d'un test à côté de chaque extrait, pour une fiche publiée
 *   - couverture des dix familles, et appartenance à une seule
 *   - cohérence entre les fiches et les intitulés de la feuille de route
 *
 * Il applique aussi la règle de vérité du code : une fiche `published` dont un
 * extrait n'a pas de test est refusée. En cas de doute, `status: draft`.
 */
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import matter from 'gray-matter';
import { parse as parseYaml } from 'yaml';

import { entrySchema } from '../src/content/schema/entry.ts';
import { familySchema } from '../src/content/schema/family.ts';
import { roadmapItemSchema } from '../src/content/schema/roadmap.ts';
import { FAMILIES } from '../src/content/schema/enums.ts';

/**
 * Racine du contenu. Peut être déplacée par `--content=<dossier>`, ce dont se
 * sert la suite de tests pour valider le contrôle sur des fixtures isolées
 * sans toucher au contenu réel.
 */
const CONTENT =
  process.argv.find((a) => a.startsWith('--content='))?.slice('--content='.length) ?? 'content';
const problemes = [];
const avertissements = [];

const echec = (ou, quoi) => problemes.push(`${ou}\n      ${quoi}`);
const avertir = (ou, quoi) => avertissements.push(`${ou}\n      ${quoi}`);

/** Rend les messages de Zod lisibles pour un rédacteur, pas pour un moteur. */
function formatIssues(error) {
  return error.issues
    .map((i) => `${i.path.length ? i.path.join('.') + ' : ' : ''}${i.message}`)
    .join('\n      ');
}

async function lireDossier(dossier) {
  if (!existsSync(dossier)) return [];
  const noms = (await readdir(dossier)).filter((f) => f.endsWith('.mdx') && !f.startsWith('_'));
  return Promise.all(
    noms.map(async (nom) => ({
      nom,
      chemin: join(dossier, nom),
      ...matter(await readFile(join(dossier, nom), 'utf8')),
    })),
  );
}

// ---------------------------------------------------------------- les fiches

const fiches = await lireDossier(join(CONTENT, 'entries'));
const vus = new Map();
let publiees = 0;
let brouillons = 0;

for (const f of fiches) {
  const r = entrySchema.safeParse(f.data);
  if (!r.success) {
    echec(f.chemin, formatIssues(r.error));
    continue;
  }
  const e = r.data;

  // Identifiant unique, et identique au nom de fichier (CDC 5.2).
  const attendu = `${e.id}.mdx`;
  if (f.nom !== attendu) {
    echec(f.chemin, `le nom de fichier doit être « ${attendu} », d'après l'identifiant`);
  }
  if (vus.has(e.id)) {
    echec(f.chemin, `identifiant déjà employé par ${vus.get(e.id)}`);
  }
  vus.set(e.id, f.chemin);

  if (e.status === 'published') publiees++;
  else brouillons++;

  for (const barreau of e.rungs) {
    if (!barreau.available) continue;
    const ou = `${f.chemin} (${barreau.level})`;

    // Les deux langages sont systématiques (CDC annexe A).
    for (const langage of ['python', 'javascript']) {
      const rel = barreau.code[langage];
      if (!rel) {
        echec(ou, `extrait ${langage} manquant : les deux langages sont systématiques`);
        continue;
      }

      // Le fichier de code existe réellement sur le disque (CDC 4.6).
      const chemin = join(CONTENT, rel);
      if (!existsSync(chemin)) {
        echec(ou, `fichier de code introuvable : ${chemin}`);
        continue;
      }

      // Une fiche publiée exige un test à côté de chaque extrait (CDC 4.6).
      const ext = langage === 'python' ? 'py' : 'js';
      const test = join(dirname(chemin), `${basename(chemin, `.${ext}`)}.test.${ext}`);
      if (!existsSync(test)) {
        const message = `aucun test à côté de l'extrait : ${test}`;
        if (e.status === 'published') {
          echec(ou, `${message}\n      une fiche publiée exige un test par extrait (CDC 4.6)`);
        } else {
          avertir(ou, message);
        }
      }
    }
  }
}

// -------------------------------------------------------------- les familles

const familles = await lireDossier(join(CONTENT, 'families'));
const idsFamilles = new Set();

for (const f of familles) {
  const r = familySchema.safeParse(f.data);
  if (!r.success) {
    echec(f.chemin, formatIssues(r.error));
    continue;
  }
  if (idsFamilles.has(r.data.id)) echec(f.chemin, `famille en double : ${r.data.id}`);
  idsFamilles.add(r.data.id);
}

if (familles.length > 0) {
  for (const id of FAMILIES) {
    if (!idsFamilles.has(id)) echec('content/families', `famille absente : ${id}`);
  }
}

// --------------------------------------------------------- la feuille de route

const cheminRoadmap = join(CONTENT, 'roadmap.yaml');
let roadmap = [];
if (existsSync(cheminRoadmap)) {
  roadmap = parseYaml(await readFile(cheminRoadmap, 'utf8')) ?? [];
  const idsRoadmap = new Set();
  for (const item of roadmap) {
    const r = roadmapItemSchema.safeParse(item);
    if (!r.success) {
      echec(`${cheminRoadmap} → ${item?.id ?? '(sans identifiant)'}`, formatIssues(r.error));
      continue;
    }
    if (idsRoadmap.has(r.data.id)) echec(cheminRoadmap, `intitulé en double : ${r.data.id}`);
    idsRoadmap.add(r.data.id);
  }

  // Les 25 fiches produites font partie des 200 intitulés (CDC 6.2).
  for (const [id, chemin] of vus) {
    if (roadmap.length > 0 && !idsRoadmap.has(id)) {
      avertir(chemin, `la fiche ${id} n'apparaît pas dans la feuille de route`);
    }
  }
}

// ------------------------------------------------------------------- rapport

if (avertissements.length) {
  console.log(`\ncheck-content : ${avertissements.length} avertissement(s)\n`);
  for (const a of avertissements) console.log(`  ! ${a}`);
}

if (problemes.length) {
  console.error(`\ncheck-content : ${problemes.length} erreur(s)\n`);
  for (const p of problemes) console.error(`  ✗ ${p}`);
  console.error('');
  process.exit(1);
}

console.log(
  `\ncheck-content : OK — ${fiches.length} fiche(s) ` +
    `(${publiees} publiée(s), ${brouillons} brouillon(s)), ` +
    `${familles.length} famille(s), ${roadmap.length} intitulé(s) de feuille de route\n`,
);
