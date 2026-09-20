#!/usr/bin/env node
/**
 * Tout nombre écrit dans une fiche est tenu par un test de la même fiche.
 *
 *   « Tout nombre écrit dans une fiche — pourcentage, effectif, décompte,
 *     facteur — est soit asserté à l'égalité stricte dans un test, soit
 *     remplacé par un ordre de grandeur en toutes lettres. Il n'y a pas de
 *     troisième forme. Un générateur à graine fixe est reproductible à
 *     l'unité : il n'y a aucune raison d'écrire une fourchette. »
 *
 * `check-figures` interdit déjà les chiffres qu'on n'a pas le droit d'écrire —
 * un prix, une empreinte, une latence. Celui-ci s'occupe de ceux qu'on a le
 * droit d'écrire et qu'il faut alors tenir. La relecture du lot 17 a trouvé
 * quatre fiches publiant un nombre que le dépôt ne produit pas : « 0,6 % » et
 * « 6 887 » là où les deux suites rendent 0,450 % et 6 882, avec des tests qui
 * assertent `0.002 < x < 0.02` — une fourchette large d'une décade, qui
 * laisserait passer n'importe quoi.
 *
 * Le contrôle ne sait pas lire une assertion : il vérifie que le nombre publié
 * **apparaît** dans un fichier de test de la fiche. C'est la moitié
 * mécanisable de la règle, et elle suffit à rendre impossible le cas trouvé,
 * où le nombre de la page n'existait nulle part dans le dépôt.
 *
 * ## Ce qu'il regarde
 *
 * Les champs de prose du frontmatter — `scenario`, `name`, `breaking_point`,
 * `escalate_when`, `unavailable_reason`, `verdict_rationale` —, dans les deux
 * langues, et dans ces champs les nombres qui sont des mesures :
 *
 *   - un pourcentage, un facteur (`×N`, `N fois`) ;
 *   - un nombre à décimale, ou à séparateur de milliers ;
 *   - un entier d'au moins trois chiffres.
 *
 * Deux choses en sont écartées, parce qu'elles ne sont pas des mesures : une
 * année entre 1900 et 2099, et le numéro d'une norme ou d'une version, reconnu
 * au mot qui le précède — « RFC 2822 », « ISO 4217 », « version 1.4.4 ».
 *
 * ## La dette
 *
 * Neuf fiches publiaient un nombre qu'aucun de leurs tests ne porte le jour où
 * ce contrôle a été écrit — seize nombres en tout. Elles sont déclarées dans
 * `scripts/dette-chiffres.json`, et la liste ne peut que diminuer.
 */
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';

const FICHES = process.env.OVERKILL_ENTRIES ?? 'content/entries';
const EXTRAITS = process.env.OVERKILL_SNIPPETS ?? 'content/snippets';
const DETTE = 'scripts/dette-chiffres.json';

/** Les espaces qui séparent les milliers en français, insécables comprises. */
const ESPACE = '[\\u00a0\\u202f ]';

/**
 * Un nombre écrit, avec ses séparateurs de milliers et sa décimale, dans l'une
 * ou l'autre convention. Il ne commence ni après une lettre — sans quoi le
 * « 1 » de « N1 » ouvrirait un nombre — ni au milieu d'un autre.
 */
const NOMBRE = new RegExp(`(?<![\\p{L}\\d.,-])\\d{1,3}(?:[,${ESPACE.slice(1, -1)}]\\d{3})*(?:[.,]\\d+)?(?![\\d])`, 'gu');

/** Le mot qui précède un numéro de norme ou de version, et le disqualifie. */
const REFERENCE = /(?:RFC|ISO|NIST|SP|EN|NF|UTF|SHA|ECMA|IEEE|Unicode|version|norme|standard|numéro|n°)\s*$/i;

/** Les champs de prose que le lecteur voit sur la page. */
export function prosesDe(fiche) {
  const textes = [];
  const pousser = (bloc) => {
    if (!bloc || typeof bloc !== 'object') return;
    for (const langue of ['fr', 'en']) {
      if (typeof bloc[langue] === 'string') textes.push(bloc[langue]);
    }
  };
  pousser(fiche.scenario);
  pousser(fiche.verdict_rationale);
  for (const rung of fiche.rungs ?? []) {
    pousser(rung.name);
    pousser(rung.breaking_point);
    pousser(rung.escalate_when);
    pousser(rung.unavailable_reason);
  }
  return textes;
}

/**
 * La valeur d'un nombre écrit, quelle que soit sa convention.
 *
 * Quand les deux signes sont là, le dernier est la décimale. Quand il n'y en a
 * qu'un, il sépare les milliers s'il est suivi d'exactement trois chiffres et
 * que le groupe de tête n'est pas un zéro seul — aucun nombre ne s'écrit
 * « 0 897 » —, et c'est la décimale sinon. « 1 000,00 », « 1,234.56 »,
 * « 10,000 » et « 0,897 » se lisent ainsi sans ambiguïté.
 */
export function valeurDe(brut) {
  const sansEspace = brut.replace(new RegExp(ESPACE, 'gu'), '');
  const dernierPoint = sansEspace.lastIndexOf('.');
  const derniereVirgule = sansEspace.lastIndexOf(',');
  if (dernierPoint >= 0 && derniereVirgule >= 0) {
    const decimale = Math.max(dernierPoint, derniereVirgule);
    return sansEspace.slice(0, decimale).replace(/[.,]/g, '') + '.' + sansEspace.slice(decimale + 1);
  }
  const signe = Math.max(dernierPoint, derniereVirgule);
  if (signe < 0) return sansEspace;
  const apres = sansEspace.slice(signe + 1);
  const tete = sansEspace.slice(0, signe);
  if (apres.length === 3 && tete !== '0') return sansEspace.replace(/[.,]/g, ''); // séparateur de milliers
  return sansEspace.slice(0, signe).replace(/[.,]/g, '') + '.' + apres;
}

/** Les nombres publiés d'une fiche, en portée, sans doublon. */
export function chiffresDe(fiche) {
  const trouves = new Map();
  for (const texte of prosesDe(fiche)) {
    for (const trouvaille of texte.matchAll(NOMBRE)) {
      const brut = trouvaille[0];
      const avant = texte.slice(Math.max(0, trouvaille.index - 14), trouvaille.index);
      const apres = texte.slice(trouvaille.index + brut.length, trouvaille.index + brut.length + 8);

      const valeur = valeurDe(brut);
      const mesure = /^\s*%/.test(apres) || /^\s*fois\b/.test(apres) || /[×x]\s*$/.test(avant);
      const precis = /[.,]/.test(brut) || new RegExp(ESPACE, 'u').test(brut);
      const grand = !precis && valeur.replace(/^0+/, '').length >= 3;
      if (!mesure && !precis && !grand) continue;

      const entier = !valeur.includes('.');
      if (entier && !mesure && Number(valeur) >= 1900 && Number(valeur) <= 2099) continue;
      if (REFERENCE.test(avant)) continue;

      if (!trouves.has(valeur)) {
        trouves.set(valeur, { valeur, brut, contexte: texte.slice(Math.max(0, trouvaille.index - 45), trouvaille.index + brut.length + 15) });
      }
    }
  }
  return [...trouves.values()];
}

/** Les écritures sous lesquelles un test peut porter ce nombre. */
export function ecritures(chiffre) {
  const { valeur, brut } = chiffre;
  const formes = new Set([brut, valeur, valeur.replace('.', ','), brut.replace(new RegExp(ESPACE, 'gu'), '')]);
  /* Un entier écrit avec un séparateur de milliers se code sans lui. */
  formes.add(valeur.replace(/[^\d.]/g, ''));
  return [...formes].filter(Boolean);
}

// ------------------------------------------------------------------ exécution

if (import.meta.url === `file://${process.argv[1]}`) {
  const dette = new Set(JSON.parse(await readFile(DETTE, 'utf8')).dette);
  const absents = [];
  const fichesEnDette = new Set();
  let total = 0;

  const fichiers = (await readdir(FICHES)).filter((f) => f.endsWith('.mdx') && !f.startsWith('_')).sort();
  for (const fichier of fichiers) {
    const { data } = matter(await readFile(join(FICHES, fichier), 'utf8'));
    if (data.status !== 'published') continue;

    const dossier = join(EXTRAITS, data.id);
    if (!existsSync(dossier)) continue;
    const tests = (
      await Promise.all(
        (await readdir(dossier))
          .filter((f) => /\.test\.(py|js)$/.test(f))
          .map((f) => readFile(join(dossier, f), 'utf8')),
      )
    ).join('\n');

    for (const chiffre of chiffresDe(data)) {
      total += 1;
      if (ecritures(chiffre).some((forme) => tests.includes(forme))) continue;
      if (dette.has(data.id)) { fichesEnDette.add(data.id); continue; }
      absents.push({ id: data.id, ...chiffre });
    }
  }

  const perimees = [...dette].filter((id) => !fichesEnDette.has(id));

  if (absents.length || perimees.length) {
    console.error(`\ncheck-chiffres-tenus : ${absents.length + perimees.length} problème(s)\n`);
    for (const a of absents) {
      console.error(`  ✗ ${a.id}  « ${a.brut} » n'apparaît dans aucun test de la fiche`);
      console.error(`      …${a.contexte}…`);
    }
    for (const id of perimees) {
      console.error(`  ✗ ${id}  ligne de dette périmée : tous ses nombres publiés sont tenus`);
      console.error(`      retirer la ligne de ${DETTE}`);
    }
    if (absents.length) {
      console.error(
        '\n  Un nombre publié s\'asserte à l\'égalité stricte dans un test, ou se remplace\n' +
          '  par un ordre de grandeur en toutes lettres. Il n\'y a pas de troisième forme.\n',
      );
    }
    process.exit(1);
  }

  console.log(
    `check-chiffres-tenus : OK — ${total} nombre(s) publié(s), tous présents dans un test ; ` +
      `${dette.size} fiche(s) encore en dette`,
  );
}
