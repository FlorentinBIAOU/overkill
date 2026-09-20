#!/usr/bin/env node
/**
 * Règle R14 : une raison rendue par le code est une affirmation, et elle se
 * teste comme les autres.
 *
 *   « Le périmètre des affirmations à tester liste quatre choses : le
 *     frontmatter, les docstrings, les commentaires, et les libellés de
 *     l'essai. Il ne mentionne pas les chaînes que le code rend. Or ce sont
 *     elles que l'appelant lit, journalise et sur lesquelles il branche son
 *     code. »
 *
 * Six fiches du lot 17 ont été refusées parce qu'une de ces chaînes affirme
 * quelque chose de faux alors que la décision prise par le code était juste :
 * une brève de presse déclarée « construite par son JavaScript », une réponse
 * correctement coupée accusée d'avoir « plus de texte sous la citation
 * qu'au-dessus », une famille de suivi qui « ne porte rien à vérifier » alors
 * qu'elle porte une clé. Aucun test ne les lisait.
 *
 * Ce contrôle ne sait pas dire si une raison est vraie — rien ne le sait à la
 * place d'un lecteur. Il fait la seule chose mécanisable, et c'est ce que le
 * relecteur demande : il rend ces chaînes **testables**, en exigeant que
 * chacune apparaisse mot pour mot dans un test de la même fiche. Écrire ce
 * test oblige à relire la phrase à côté du cas qui la déclenche, et c'est là
 * que les six se sont trouvées fausses.
 *
 * ## Ce qu'il appelle une raison
 *
 * Une chaîne de prose — au moins trois mots, majoritairement des lettres —
 * qui arrive dans un champ nommé `reason`, `why`, `evidence`, `skipped`,
 * `source` ou `strategy`, soit directement :
 *
 *     `return {"reason": "this page is a list of links, not an article"}`
 *
 * soit par un passe-plat dont un paramètre porte ce nom :
 *
 *     `def _report(title, text, reason): ...`
 *     `return _report(title, "", "this page is a list of links, not an article")`
 *
 * Les messages d'exception ne sont pas des raisons : ils remontent par une
 * autre voie, et la charte des tests les couvre déjà par les cas de
 * production.
 *
 * ## La dette
 *
 * Six fiches hors du périmètre du lot 18 rendaient des raisons qu'aucun test
 * ne lit le jour où ce contrôle a été écrit. Elles sont déclarées dans
 * `scripts/dette-raisons.json`, par fiche, et la liste ne peut que diminuer.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const EXTRAITS = process.env.OVERKILL_SNIPPETS ?? 'content/snippets';
const DETTE = 'scripts/dette-raisons.json';

/** Les champs de sortie que le lecteur d'une fiche prend pour une explication. */
export const CHAMPS = ['reason', 'why', 'evidence', 'skipped', 'source', 'strategy'];

// ------------------------------------------------------------------- lecture

/**
 * Découpe une source en code, chaînes et commentaires.
 *
 * Écrit à la main plutôt qu'avec un analyseur syntaxique : le dépôt n'en
 * embarque pas pour Python, et en embarquer un pour JavaScript seul ferait
 * deux mécaniques à tenir pour la même règle. Les extraits sont courts et
 * écrits dans un style homogène, ce qui rend le découpage sûr ; le seul piège
 * réel est le littéral d'expression régulière de JavaScript, traité plus bas.
 */
export function decouper(source, python) {
  const morceaux = [];
  let i = 0;
  let precedent = ''; // dernier caractère de code non blanc, pour trancher `/`

  const pousser = (type, debut, fin, valeur) => morceaux.push({ type, debut, fin, valeur });

  while (i < source.length) {
    const c = source[i];

    if (python && c === '#') {
      const fin = source.indexOf('\n', i);
      pousser('commentaire', i, fin < 0 ? source.length : fin, '');
      i = fin < 0 ? source.length : fin;
      continue;
    }
    if (!python && c === '/' && source[i + 1] === '/') {
      const fin = source.indexOf('\n', i);
      pousser('commentaire', i, fin < 0 ? source.length : fin, '');
      i = fin < 0 ? source.length : fin;
      continue;
    }
    if (!python && c === '/' && source[i + 1] === '*') {
      const fin = source.indexOf('*/', i + 2);
      pousser('commentaire', i, fin < 0 ? source.length : fin + 2, '');
      i = fin < 0 ? source.length : fin + 2;
      continue;
    }

    /* Une docstring Python est un littéral triple ; aucune raison n'en sort. */
    if (python && (source.startsWith('"""', i) || source.startsWith("'''", i))) {
      const marque = source.slice(i, i + 3);
      const fin = source.indexOf(marque, i + 3);
      pousser('commentaire', i, fin < 0 ? source.length : fin + 3, '');
      i = fin < 0 ? source.length : fin + 3;
      continue;
    }

    /*
     * Un `/` ouvre une expression régulière quand ce qui précède ne peut pas
     * être la fin d'une valeur : une parenthèse, une virgule, un opérateur, un
     * mot-clé. Après un identifiant ou une parenthèse fermante, c'est une
     * division. C'est l'heuristique habituelle, et elle suffit ici.
     */
    if (!python && c === '/' && (precedent === '' || '(,=:[!&|?{};+-*%<>~^'.includes(precedent))) {
      let j = i + 1;
      let classe = false;
      while (j < source.length) {
        const d = source[j];
        if (d === '\\') { j += 2; continue; }
        if (d === '[') classe = true;
        else if (d === ']') classe = false;
        else if (d === '/' && !classe) break;
        else if (d === '\n') break;
        j += 1;
      }
      pousser('code', i, j + 1, source.slice(i, j + 1));
      i = j + 1;
      precedent = '/';
      continue;
    }

    if (c === '"' || c === "'" || (!python && c === '`')) {
      let j = i + 1;
      let valeur = '';
      while (j < source.length && source[j] !== c) {
        if (source[j] === '\\') { valeur += source[j + 1] ?? ''; j += 2; continue; }
        /*
         * L'interpolation d'un gabarit peut contenir n'importe quoi, y compris
         * un autre gabarit et ses apostrophes. On la saute en comptant les
         * accolades, et on laisse un trou propre à sa place : sans cela, la
         * première apostrophe imbriquée terminerait la chaîne au mauvais
         * endroit et le reste de la ligne serait lu comme du code.
         */
        if (c === '`' && source[j] === '$' && source[j + 1] === '{') {
          j = finDInterpolation(source, j + 1);
          valeur += '${}';
          continue;
        }
        valeur += source[j];
        j += 1;
      }
      pousser('chaine', i, j + 1, valeur);
      i = j + 1;
      precedent = '"';
      continue;
    }

    if (!/\s/.test(c)) precedent = c;
    i += 1;
  }
  return morceaux;
}

/**
 * L'index qui suit l'accolade fermante d'une interpolation `${…}`, en comptant
 * les accolades et en traversant les chaînes et les gabarits imbriqués.
 */
function finDInterpolation(source, ouvrante) {
  let profondeur = 0;
  let i = ouvrante;
  while (i < source.length) {
    const c = source[i];
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      i += 1;
      while (i < source.length && source[i] !== q) {
        if (source[i] === '\\') { i += 2; continue; }
        if (q === '`' && source[i] === '$' && source[i + 1] === '{') { i = finDInterpolation(source, i + 1); continue; }
        i += 1;
      }
      i += 1;
      continue;
    }
    if (c === '{') profondeur += 1;
    else if (c === '}') { profondeur -= 1; if (profondeur === 0) return i + 1; }
    i += 1;
  }
  return source.length;
}

/**
 * Le source avec certains morceaux remplacés par des blancs de même longueur,
 * ce qui garde les positions. Deux vues servent :
 *
 *   - sans commentaires **ni** chaînes, pour chercher une définition ou un
 *     appel de fonction sans qu'un bout de prose passe pour du code ;
 *   - sans commentaires seulement, pour lire le nom de clé qui précède un
 *     littéral — dans `{"reason": "…"}`, ce nom est lui-même une chaîne.
 */
function effacer(source, morceaux, types) {
  const lettres = source.split('');
  for (const m of morceaux) {
    if (!types.includes(m.type)) continue;
    for (let k = m.debut; k < m.fin && k < lettres.length; k += 1) {
      if (lettres[k] !== '\n') lettres[k] = ' ';
    }
  }
  return lettres.join('');
}

/** Ce qui reste d'une chaîne quand on retire ses trous d'interpolation. */
export function fragments(valeur) {
  return valeur
    .split(/\$\{[^}]*\}|\{[^{}]*\}/)
    .map((f) => f.trim())
    .filter(Boolean);
}

/**
 * Une chaîne de prose : au moins trois mots, au moins douze caractères hors
 * interpolation, et majoritairement des lettres. Un motif, un nom de clé, un
 * code de format ou un chemin ne passent pas.
 */
export function estProse(valeur) {
  const texte = fragments(valeur).join(' ');
  if (texte.length < 12) return false;
  if (texte.split(/\s+/).filter(Boolean).length < 3) return false;
  return (texte.match(/[\p{L} ]/gu) ?? []).length / texte.length > 0.7;
}

// ------------------------------------------------------------- les porteurs

/**
 * Les fonctions du fichier dont un paramètre s'appelle comme un champ de
 * sortie, avec la position de ce paramètre. Un appel à l'une d'elles fait
 * d'un littéral bien placé une raison.
 */
export function porteurs(code, python) {
  const trouves = new Map();
  const definitions = python
    ? [...code.matchAll(/def\s+(\w+)\s*\(([^)]*)\)/g)].map((m) => [m[1], m[2]])
    : [
        ...code.matchAll(/function\s+(\w+)\s*\(([^)]*)\)/g),
        ...code.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*\(([^)]*)\)\s*=>/g),
      ].map((m) => [m[1], m[2]]);

  for (const [nom, parametres] of definitions) {
    const positions = [];
    parametres.split(',').forEach((brut, rang) => {
      const p = brut.trim().replace(/[:=].*$/s, '').replace(/^[*]+/, '').trim();
      if (CHAMPS.includes(p)) positions.push(rang);
    });
    if (positions.length) trouves.set(nom, positions);
  }
  return trouves;
}

/** Les bornes de chaque argument d'un appel, à partir de sa parenthèse ouvrante. */
function bornesDesArguments(source, ouvrante) {
  const bornes = [];
  let profondeur = 0;
  let debut = ouvrante + 1;
  for (let i = ouvrante; i < source.length; i += 1) {
    const c = source[i];
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      i += 1;
      while (i < source.length && source[i] !== q) { if (source[i] === '\\') i += 1; i += 1; }
      continue;
    }
    if ('([{'.includes(c)) profondeur += 1;
    else if (')]}'.includes(c)) {
      profondeur -= 1;
      if (profondeur === 0) { bornes.push([debut, i]); return bornes; }
    } else if (c === ',' && profondeur === 1) { bornes.push([debut, i]); debut = i + 1; }
  }
  return bornes;
}

/** Les raisons qu'un extrait peut rendre, en clair. */
export function raisonsDe(source, python) {
  const morceaux = decouper(source, python);
  const code = effacer(source, morceaux, ['chaine', 'commentaire']);
  const avecChaines = effacer(source, morceaux, ['commentaire']);
  const litteraux = morceaux.filter((m) => m.type === 'chaine' && estProse(m.valeur));
  const raisons = new Set();

  /* 1. Le littéral est la valeur d'un champ de sortie, nommé juste avant. */
  const affectation = new RegExp(`["'\`]?\\b(?:${CHAMPS.join('|')})["'\`]?\\s*[:=]\\s*[fr]?$`);
  for (const litteral of litteraux) {
    const avant = avecChaines.slice(Math.max(0, litteral.debut - 48), litteral.debut);
    if (affectation.test(avant)) raisons.add(litteral.valeur);
  }

  /* 2. Le littéral est passé à un passe-plat, à la place du champ de sortie. */
  for (const [nom, positions] of porteurs(code, python)) {
    for (const appel of code.matchAll(new RegExp(`\\b${nom}\\s*\\(`, 'g'))) {
      const ouvrante = appel.index + appel[0].length - 1;
      const bornes = bornesDesArguments(source, ouvrante);
      for (const rang of positions) {
        const borne = bornes[rang];
        if (!borne) continue;
        for (const litteral of litteraux) {
          if (litteral.debut >= borne[0] && litteral.fin <= borne[1]) raisons.add(litteral.valeur);
        }
      }
    }
  }

  return raisons;
}

// ------------------------------------------------------------------ exécution

if (import.meta.url === `file://${process.argv[1]}`) {
  const dette = new Set(JSON.parse(await readFile(DETTE, 'utf8')).dette);
  const dossiers = (await readdir(EXTRAITS, { withFileTypes: true }))
    .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
    .map((e) => e.name)
    .sort();

  const absentes = [];
  const fichesEnDette = new Set();
  let total = 0;

  for (const id of dossiers) {
    const fichiers = await readdir(join(EXTRAITS, id));
    const tests = (
      await Promise.all(
        fichiers.filter((f) => /\.test\.(py|js)$/.test(f)).map((f) => readFile(join(EXTRAITS, id, f), 'utf8')),
      )
    ).join('\n');

    for (const fichier of fichiers.filter((f) => /^n\d\.(py|js)$/.test(f)).sort()) {
      const source = await readFile(join(EXTRAITS, id, fichier), 'utf8');
      for (const raison of raisonsDe(source, fichier.endsWith('.py'))) {
        total += 1;
        /* Le plus long morceau constant : ce qu'un test peut citer mot pour mot. */
        const noyau = fragments(raison).sort((a, b) => b.length - a.length)[0];
        if (!noyau || tests.includes(noyau)) continue;
        if (dette.has(id)) { fichesEnDette.add(id); continue; }
        absentes.push({ ou: `${id}/${fichier}`, raison, noyau });
      }
    }
  }

  const perimees = [...dette].filter((id) => !fichesEnDette.has(id));

  if (absentes.length || perimees.length) {
    console.error(`\ncheck-raisons : ${absentes.length + perimees.length} problème(s)\n`);
    for (const a of absentes) {
      console.error(`  ✗ ${a.ou}  raison qu'aucun test ne lit`);
      console.error(`      « ${a.raison} »`);
      console.error(`      citer « ${a.noyau} » dans un test de la fiche.`);
    }
    for (const id of perimees) {
      console.error(`  ✗ ${id}  ligne de dette périmée : toutes ses raisons sont désormais testées`);
      console.error(`      retirer la ligne de ${DETTE}`);
    }
    if (absentes.length) {
      console.error(
        '\n  R14 : une raison rendue par le code est une affirmation. Elle ne dit que ce\n' +
          '  que le code a constaté, jamais la cause qu\'il suppose, et un test la cite.\n',
      );
    }
    process.exit(1);
  }

  console.log(
    `check-raisons : OK — ${total} raison(s) rendue(s) par les extraits, ` +
      `toutes citées par un test ; ${dette.size} fiche(s) encore en dette`,
  );
}
