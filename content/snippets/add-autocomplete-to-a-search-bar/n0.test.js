import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build, normalise, suggest } from './n0.js';
import essai from '../../tryouts/live/add-autocomplete-to-a-search-bar.js';

// What a fortnight of search logs looks like once grouped: the term as it is
// spelled in the catalogue, and how often it was searched.
const CATALOGUE = [
  ['chaussures de running', 900],
  ['chaussettes de sport', 400],
  ['étagère murale', 300],
  ['chemise en lin', 250],
  ['écharpe en laine', 120],
  ['échelle télescopique', 60],
];

const tree = build(CATALOGUE);

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : « rcharpe » ne remonte rien quand « echarpe » remonte « écharpe en laine »', () => {
  // breaking_point : « le préfixe « echarpe » remonte « écharpe en laine », le
  // préfixe « rcharpe » ne remonte rien, et la bonne orthographe est pourtant
  // dans l'index ». Le témoin est la première assertion.
  assert.deepEqual(suggest(tree, 'echarpe'), ['écharpe en laine']);
  assert.deepEqual(suggest(tree, 'rcharpe'), []);
  assert.ok(suggest(tree, '', CATALOGUE.length).includes('écharpe en laine'));
});

test('point de rupture : une faute sur le premier caractère quitte l’arbre dès la première touche', () => {
  assert.deepEqual(suggest(tree, 'chauss'), ['chaussures de running', 'chaussettes de sport']);
  assert.deepEqual(suggest(tree, 'vhauss'), []);
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('les termes les plus cherchés sous un préfixe sont proposés', () => {
  assert.deepEqual(suggest(tree, 'cha'), ['chaussures de running', 'chaussettes de sport']);
});

test('l’ordre suit le compte d’usage et la limite est respectée', () => {
  assert.deepEqual(suggest(tree, 'ch', 2), ['chaussures de running', 'chaussettes de sport']);
});

test('l’ordre ne dépend que du compte, pas de l’ordre d’insertion', () => {
  const melange = [CATALOGUE[4], CATALOGUE[1], CATALOGUE[5], CATALOGUE[0], CATALOGUE[3], CATALOGUE[2]];
  assert.deepEqual(suggest(build(melange), '', 6), suggest(tree, '', 6));
  assert.deepEqual(suggest(build([['b', 1], ['a', 9]]), ''), ['a', 'b']);
});

test('un préfixe vide propose les termes les plus cherchés de tout l’index', () => {
  assert.deepEqual(suggest(tree, '', 3), [
    'chaussures de running',
    'chaussettes de sport',
    'étagère murale',
  ]);
});

test('accents et casse sont ignorés', () => {
  assert.deepEqual(suggest(tree, 'ec'), ['écharpe en laine', 'échelle télescopique']);
  assert.deepEqual(suggest(tree, 'ech'), ['écharpe en laine', 'échelle télescopique']);
  assert.deepEqual(suggest(tree, 'ÉCH'), suggest(tree, 'ech'));
});

test('un préfixe inconnu ne rend rien', () => {
  assert.deepEqual(suggest(tree, 'zzz'), []);
});

test('deux orthographes du même terme survivent toutes les deux', () => {
  const both = build([['Chaussures', 5], ['chaussures', 3]]);
  assert.deepEqual(suggest(both, 'chau'), ['Chaussures', 'chaussures']);
});

test('la normalisation replie les accents sans toucher aux lettres', () => {
  assert.equal(normalise('Écharpe'), 'echarpe');
  assert.equal(normalise('Étagère Murale'), 'etagere murale');
});

test('un caractère NUL dans un terme ne se confond pas avec la marque de fin', () => {
  // Commentaire : « A character can never collide with it ». En JavaScript la
  // marque est un Symbol : l'affirmation tient.
  assert.deepEqual(suggest(build([['a\0b', 1]]), 'a'), ['a\0b']);
  assert.deepEqual(suggest(build([['a\0b', 1], ['a', 2]]), 'a'), ['a', 'a\0b']);
});

test('l’extrait n’importe rien', () => {
  // docstring : « No dependency » ; risks.data_egress: none.
  const source = readFileSync(new URL('./n0.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s/m);
  assert.doesNotMatch(source, /\brequire\(|\bimport\(|\bfetch\(/);
});

test('deux exécutions sur la même entrée rendent la même liste', () => {
  assert.deepEqual(suggest(build(CATALOGUE), 'ch'), suggest(build(CATALOGUE), 'ch'));
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : un index vide ne propose rien', () => {
  const vide = build([]);
  assert.deepEqual(suggest(vide, ''), []);
  assert.deepEqual(suggest(vide, 'cha'), []);
});

test('production : cent mille termes se construisent et se parcourent dans une borne large', () => {
  // Borne volontairement large : elle attrape un effondrement, elle ne mesure rien.
  let graine = 1;
  const alea = () => (graine = (graine * 1103515245 + 12345) % 2147483648);
  const lettres = 'abcdefghijklmnopqrstuvwxyz ';
  const termes = Array.from({ length: 100_000 }, () => [
    Array.from({ length: 20 }, () => lettres[alea() % lettres.length]).join(''),
    alea() % 1000,
  ]);
  const debut = performance.now();
  const grand = build(termes);
  assert.equal(suggest(grand, '', 10).length, 10);
  assert.equal(suggest(grand, 'a', 10).length, 10);
  assert.ok(performance.now() - debut < 20_000);
});

test('DÉFAUT : un terme de 100 000 caractères dans le journal fait planter la barre vide', async () => {
  // collect est récursif : « Maximum call stack size exceeded » sur le préfixe vide.
  await assert.rejects(async () => {
    const long = build([['x'.repeat(100_000), 1], ['chemise en lin', 2]]);
    assert.deepEqual(suggest(long, ''), ['chemise en lin', 'x'.repeat(100_000)]);
  });
});

test('production : une saisie en accents décomposés retrouve le terme composé', () => {
  assert.deepEqual(suggest(tree, 'e\u0301charpe'), ['écharpe en laine']);
  assert.deepEqual(suggest(build([['e\u0301charpe', 1]]), 'écha'), ['e\u0301charpe']);
});

test('production : casse mixte et emoji sont retrouvés', () => {
  assert.deepEqual(suggest(tree, 'cHeMiSe'), ['chemise en lin']);
  assert.deepEqual(suggest(build([['🎁 coffret cadeau', 3]]), '🎁'), ['🎁 coffret cadeau']);
});

test('DÉFAUT : « strasse » ne retrouve pas « Straße » en JavaScript, alors que Python le retrouve', async () => {
  // toLowerCase garde « ß », casefold le replie en « ss » : les deux extraits
  // ne proposent pas la même chose pour la même frappe.
  await assert.rejects(async () => {
    assert.deepEqual(suggest(build([['Straße', 1]]), 'strasse'), ['Straße']);
  });
});

test('DÉFAUT : un caractère invisible dans la saisie vide la liste', async () => {
  await assert.rejects(async () => {
    assert.deepEqual(suggest(tree, 'écharpe\u00a0en'), ['écharpe en laine']);
    assert.deepEqual(suggest(tree, '\u200bech'), ['écharpe en laine', 'échelle télescopique']);
    assert.deepEqual(suggest(tree, '\ufeffech'), ['écharpe en laine', 'échelle télescopique']);
  });
});

test('DÉFAUT : une espace en tête de saisie vide la liste', async () => {
  await assert.rejects(async () => {
    assert.deepEqual(suggest(tree, ' cha'), ['chaussures de running', 'chaussettes de sport']);
  });
});

test('production : à compte égal, l’ordre est alphabétique', () => {
  // Python départage par point de code et rend l'inverse : voir son test DÉFAUT.
  assert.deepEqual(suggest(build([['zèbre', 1], ['écharpe', 1]]), ''), ['écharpe', 'zèbre']);
});

test('production : limite à zéro, à un, et au nombre exact de candidats', () => {
  assert.deepEqual(suggest(tree, 'ch', 0), []);
  assert.deepEqual(suggest(tree, 'ch', 1), ['chaussures de running']);
  assert.equal(suggest(tree, 'ch', 3).length, 3);
  assert.equal(suggest(tree, 'ch', 4).length, 3);
});

test('production : un préfixe plus long que tout terme ne rend rien', () => {
  assert.deepEqual(suggest(tree, 'chemise en lin bleue'), []);
  assert.deepEqual(suggest(tree, 'chemise en lin'), ['chemise en lin']);
});

// ---------------------------------------------------------------------------
// L'essai de la fiche
// ---------------------------------------------------------------------------

test('essai : « cr » propose les termes du journal triés par nombre de recherches', () => {
  const fr = essai.run('cr', 'fr');
  assert.deepEqual(
    fr.rows.rows.map(([terme]) => terme),
    ['crème fraîche', 'crème de marrons'],
  );
  assert.equal(fr.rows.rows[0][1].caught, true);
  const en = essai.run('cr', 'en');
  assert.deepEqual(en.rows.rows.map(([terme]) => terme), ['crème fraîche', 'cream cheese']);
});

test('essai : la barre vide propose les cinq termes les plus cherchés', () => {
  const fr = essai.run('', 'fr');
  assert.deepEqual(fr.rows.rows.map(([terme]) => terme), [
    'crème fraîche',
    'café moulu',
    'chocolat noir',
    'crème de marrons',
    'chorizo doux',
  ]);
});

test('essai : « creme » sans accent remonte « crème fraîche »', () => {
  for (const lang of ['fr', 'en']) {
    assert.equal(essai.run('creme', lang).rows.rows[0][0], 'crème fraîche');
  }
});

test('essai : « vreme », la touche d’à côté, ne propose rien, et c’est le cas marqué en échec', () => {
  // why : « l'arbre quitte la branche au premier caractère : il n'a plus rien
  // à descendre, donc rien à proposer ».
  const cas = essai.cases.find((c) => c.input === 'vreme');
  assert.equal(cas.fails, true);
  for (const lang of ['fr', 'en']) {
    const sortie = essai.run('vreme', lang);
    assert.equal(sortie.rows, undefined);
    assert.ok(sortie.verdict.label);
  }
  assert.equal(essai.level, 'N0');
});
