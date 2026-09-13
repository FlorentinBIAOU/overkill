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
import { existsSync, readFileSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import matter from 'gray-matter';
import { parse as parseYaml } from 'yaml';

import { corpsApresDoc, docTraduite, replaceHeaderDoc } from '../src/lib/snippets.ts';
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

/**
 * Lit un dossier de documents.
 *
 * Un frontmatter YAML invalide fait lever l'analyseur. Sans ce filet, le
 * contrôle s'arrêtait sur une trace de pile au lieu de nommer le fichier
 * fautif et sa ligne : le message était inutilisable, et dans un enchaînement
 * de commandes l'échec pouvait passer pour un succès.
 */
async function lireDossier(dossier) {
  if (!existsSync(dossier)) return [];
  const noms = (await readdir(dossier)).filter((f) => f.endsWith('.mdx') && !f.startsWith('_'));
  const documents = [];

  for (const nom of noms) {
    const chemin = join(dossier, nom);
    const brut = await readFile(chemin, 'utf8');
    try {
      documents.push({ nom, chemin, ...matter(brut) });
    } catch (erreur) {
      const detail = String(erreur.message ?? erreur).split('\n')[0];
      echec(
        chemin,
        `frontmatter YAML illisible : ${detail}\n      ` +
          `Cause fréquente : un guillemet droit à l'intérieur d'une valeur déjà entre ` +
          `guillemets droits. Employer des guillemets typographiques, ou échapper.`,
      );
    }
  }
  return documents;
}

// ---------------------------------------------------------------- les fiches

const fiches = await lireDossier(join(CONTENT, 'entries'));
const vus = new Map();
/** Le verdict de chaque fiche valide, dont les essais ont besoin plus bas. */
const verdicts = new Map();
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
  if (e.status === 'published') verdicts.set(e.id, e.verdict);

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

      /*
       * La docstring d'en-tête est traduite, et rien d'autre.
       *
       * On substitue vraiment le texte, puis on compare le code qui suit la
       * docstring, caractère par caractère, avec l'original. C'est la seule
       * garantie qui compte : le lecteur français doit voir le même code que
       * le lecteur anglais, avec une explication qu'il peut lire.
       */
      const source = readFileSync(chemin, 'utf8');
      const traduite = docTraduite(rel, 'fr');
      if (!traduite) {
        if (e.status === 'published') {
          avertir(ou, `docstring d'en-tête non traduite : ${rel}`);
        }
      } else {
        const rendu = replaceHeaderDoc(source, langage, traduite);
        if (corpsApresDoc(rendu, langage) !== corpsApresDoc(source, langage)) {
          echec(ou, `la traduction de ${rel} ne se limite pas à la docstring d'en-tête`);
        }
        if (rendu === source) {
          echec(ou, `la traduction de ${rel} n'a rien remplacé : l'extrait a-t-il une docstring d'en-tête ?`);
        }
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

// ------------------------------------------------------------------ les essais

/**
 * Les essais (`content/tryouts/`) sont du contenu, et ils affirment quelque
 * chose : que tel extrait de telle fiche fait telle chose. Ce contrôle vérifie
 * ce que le contrat exige et que rien d'autre ne peut attraper.
 *
 * Le module est importé et ses cas sont exécutés : un essai qui jette ne passe
 * pas la construction du site. C'est la même règle que pour les extraits
 * (CDC 4.6) — rien d'affiché qui n'ait tourné.
 */
let essais = 0;
for (const mode of ['live', 'frozen']) {
  const dossier = join(CONTENT, 'tryouts', mode);
  if (!existsSync(dossier)) continue;
  for (const nom of (await readdir(dossier)).filter((f) => f.endsWith('.js'))) {
    const chemin = join(dossier, nom);
    const id = nom.slice(0, -3);
    essais += 1;
    const source = await readFile(chemin, 'utf8');

    if (!verdicts.has(id)) {
      echec(chemin, `aucune fiche publiée ne porte l'identifiant ${id}`);
      continue;
    }
    const verdict = verdicts.get(id);

    // L'essai porte sur l'extrait du niveau recommandé, et il l'importe.
    const attendu = `snippets/${id}/${verdict.toLowerCase()}.js`;
    if (!source.includes(attendu)) {
      echec(chemin, `l'essai doit importer ${attendu}, l'extrait du niveau recommandé`);
    }

    // Un essai interactif est chargé par un navigateur : ni module de Node,
    // ni dépendance installée.
    if (mode === 'live') {
      for (const m of source.matchAll(/from\s+'([^']+)'/g)) {
        if (!m[1].startsWith('.')) {
          echec(chemin, `un essai interactif ne peut pas dépendre de « ${m[1]} »`);
        }
      }
    }

    let spec;
    try {
      spec = (await import(`${process.cwd()}/${chemin}`)).default;
    } catch (erreur) {
      echec(chemin, `le module ne se charge pas : ${erreur.message}`);
      continue;
    }

    if (spec?.level !== verdict) {
      echec(chemin, `l'essai déclare ${spec?.level} alors que le verdict de la fiche est ${verdict}`);
    }

    const cas = spec?.cases ?? [];
    const bornes = mode === 'live' ? [3, 4] : [5, 6];
    if (cas.length < bornes[0] || cas.length > bornes[1]) {
      echec(chemin, `${bornes[0]} à ${bornes[1]} cas attendus en mode ${mode}, ${cas.length} trouvé(s)`);
    }
    if (!cas.some((c) => c.fails)) {
      echec(chemin, "un essai doit porter au moins un cas qui échoue : c'est le plus utile");
    }

    for (const [i, c] of cas.entries()) {
      const ou = `${chemin} → cas ${i + 1}`;
      for (const champ of ['label']) {
        if (!c[champ]?.fr || !c[champ]?.en) echec(ou, `${champ} doit être renseigné dans les deux langues`);
      }
      if (c.fails && (!c.why?.fr || !c.why?.en)) {
        echec(ou, 'un cas qui échoue doit dire pourquoi, dans les deux langues');
      }
      for (const lang of ['fr', 'en']) {
        const entree = typeof c.input === 'string' ? c.input : c.input?.[lang];
        if (entree === undefined) {
          echec(ou, `saisie manquante en ${lang}`);
          continue;
        }
        try {
          const resultat = await spec.run(entree, lang, c);
          const rendu =
            resultat &&
            (typeof resultat.output === 'string' ||
              resultat.rows ||
              resultat.verdict ||
              resultat.image ||
              resultat.error);
          if (!rendu) echec(ou, `l'essai ne rend rien d'affichable en ${lang}`);
        } catch (erreur) {
          echec(ou, `l'essai jette en ${lang} : ${erreur.message}`);
        }
      }
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
    `${familles.length} famille(s), ${roadmap.length} intitulé(s) de feuille de route, ` +
    `${essais} essai(s)\n`,
);
