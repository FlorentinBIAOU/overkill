import { test } from 'node:test';
import assert from 'node:assert/strict';
import { learn, normalise, rerank } from './n1.js';
import * as n0 from './n0.js';

const repeat = (times, event) => Array.from({ length: times }, () => event);

// A slice of a click log: what was typed, and which suggestion was chosen.
// The kind of file a search bar already writes without being asked.
const CLICKS = [
  ...repeat(4, ['cha', 'chaussettes de sport']),
  ...repeat(2, ['chau', 'chaussettes de sport']),
  ['ch', 'chemise en lin'],
  ...repeat(3, ['e', 'étagère murale']),
  ['ÉCHA', 'écharpe en laine'],
];

// What the prefix tree of the previous rung hands over: candidates already
// ordered by how often the term is searched.
const BY_FREQUENCY = ['chaussures de running', 'chaussettes de sport'];

// The catalogue of the N0 tests, to chain both rungs as the entry describes.
const CATALOGUE = [
  ['chaussures de running', 900],
  ['chaussettes de sport', 400],
  ['étagère murale', 300],
  ['chemise en lin', 250],
  ['écharpe en laine', 120],
  ['échelle télescopique', 60],
];

const model = learn(CLICKS);

/** N0 retrieves, N1 reorders: the pipeline the verdict recommends. */
const chain = (m, prefix) => rerank(m, prefix, n0.suggest(n0.build(CATALOGUE), prefix));

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : « écharpe en laine » a un clic sous « echa » et « rcharpe » ne lui donne rien à classer', () => {
  // breaking_point : « « écharpe en laine » a un clic à son actif sous le
  // préfixe « echa », et « rcharpe » ne lui donne toujours rien à classer ».
  // Le témoin : sous « echa », la chaîne N0 puis N1 remonte bien le terme.
  assert.equal(model.get('echa\técharpe en laine'), 1);
  assert.deepEqual(chain(model, 'echa'), ['écharpe en laine']);
  assert.deepEqual(chain(model, 'rcharpe'), []);
});

test('point de rupture : ce niveau réordonne une liste, il ne l’allonge pas', () => {
  // Même quand le journal a vu des clics sous la faute de frappe elle-même, le
  // terme cliqué n'apparaît pas s'il n'est pas dans les candidats. Le test
  // d'origine, rerank(model, 'rcharpe', []), ne démontrait rien à lui seul.
  const avecFaute = learn([...CLICKS, ...repeat(50, ['rcharpe', 'écharpe en laine'])]);
  assert.deepEqual(rerank(avecFaute, 'rcharpe', []), []);
  assert.deepEqual(rerank(avecFaute, 'vhauss', []), []);
  assert.deepEqual(rerank(avecFaute, 'rcharpe', ['échelle télescopique']), ['échelle télescopique']);
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('un terme cliqué passe devant un terme plus cherché', () => {
  assert.deepEqual(rerank(model, 'cha', BY_FREQUENCY), [
    'chaussettes de sport',
    'chaussures de running',
  ]);
});

test('un préfixe jamais frappé se replie sur un préfixe plus court', () => {
  // "chaus" is absent from the log; "chau" is not, and it carries the clicks.
  assert.deepEqual(rerank(model, 'chaus', BY_FREQUENCY), [
    'chaussettes de sport',
    'chaussures de running',
  ]);
});

test('plus le préfixe commun est long, plus le clic pèse', () => {
  const m = learn([['c', 'chemise en lin'], ['cha', 'chaussettes de sport']]);
  assert.deepEqual(rerank(m, 'cha', ['chemise en lin', 'chaussettes de sport']), [
    'chaussettes de sport',
    'chemise en lin',
  ]);
  // Witness: at "c", both clicks sit on the same prefix length, and order stands.
  assert.deepEqual(rerank(m, 'c', ['chemise en lin', 'chaussettes de sport']), [
    'chemise en lin',
    'chaussettes de sport',
  ]);
});

test('un clic renseigne tous les préfixes de ce qui a été frappé', () => {
  const m = learn([['chau', 'chaussettes de sport']]);
  for (const prefix of ['', 'c', 'ch', 'cha', 'chau']) {
    assert.equal(m.get(`${prefix}\tchaussettes de sport`), 1);
  }
  assert.equal(m.has('chaus\tchaussettes de sport'), false);
});

test('un préfixe vide classe sur tout le journal', () => {
  const candidates = ['chaussures de running', 'chemise en lin', 'chaussettes de sport'];
  assert.deepEqual(rerank(model, '', candidates), [
    'chaussettes de sport',
    'chemise en lin',
    'chaussures de running',
  ]);
});

test('accents et casse sont ignorés comme dans l’arbre de préfixes', () => {
  const candidates = ['échelle télescopique', 'écharpe en laine'];
  assert.deepEqual(rerank(model, 'echa', candidates), [
    'écharpe en laine',
    'échelle télescopique',
  ]);
  assert.deepEqual(rerank(model, 'ÉCHA', candidates), rerank(model, 'echa', candidates));
  for (const text of ['Écharpe', 'Straße', 'e\u0301CHA', '🎁 Coffret']) {
    assert.equal(normalise(text), n0.normalise(text));
  }
});

test('la limite est respectée', () => {
  assert.deepEqual(rerank(model, 'cha', BY_FREQUENCY, 1), ['chaussettes de sport']);
});

test('les termes que personne n’a cliqués gardent leur ordre d’arrivée', () => {
  const untouched = ['chaussures de running', 'échelle télescopique'];
  assert.deepEqual(rerank(model, 'cha', untouched), untouched);
});

test('un journal vide ne change rien', () => {
  assert.deepEqual(rerank(learn([]), 'cha', BY_FREQUENCY), BY_FREQUENCY);
});

test('la requête est comptée telle quelle, sans filtre', () => {
  // risks.regulatory : « rien dans l'approche ne la filtre avant de la compter ».
  const m = learn([['jean.dupont@exemple.fr', 'chemise en lin']]);
  assert.equal(m.get('jean.dupont@exemple.fr\tchemise en lin'), 1);
});

test('deux apprentissages du même journal rendent le même classement', () => {
  const melange = [...CLICKS].reverse();
  const candidates = ['chaussures de running', 'chemise en lin', 'chaussettes de sport'];
  assert.deepEqual(rerank(learn(melange), 'ch', candidates), rerank(model, 'ch', candidates));
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : journal vide, candidats vides, préfixe vide', () => {
  assert.deepEqual(rerank(learn([]), '', []), []);
  assert.equal(learn([]).size, 0);
});

test('production : cent mille clics et mille candidats dans une borne large', () => {
  let graine = 1;
  const alea = () => (graine = (graine * 1103515245 + 12345) % 2147483648);
  const lettres = 'abcdefghijklmnopqrstuvwxyz ';
  const termes = Array.from({ length: 100_000 }, () =>
    Array.from({ length: 20 }, () => lettres[alea() % lettres.length]).join(''),
  );
  const debut = performance.now();
  const m = learn(termes.map((terme) => [terme.slice(0, 8), terme]));
  assert.equal(rerank(m, 'abcd', termes.slice(0, 1000), 10).length, 10);
  assert.ok(performance.now() - debut < 30_000);
});

test('production : une requête collée de 10 000 caractères termine dans une borne large', () => {
  const debut = performance.now();
  const m = learn([['q'.repeat(10_000), 'chemise en lin']]);
  const candidats = [...repeat(9, 'x'), 'chemise en lin'];
  assert.equal(rerank(m, 'q'.repeat(10_000), candidats)[0], 'chemise en lin');
  assert.ok(performance.now() - debut < 10_000);
});

test('DÉFAUT : une requête collée de 10 000 caractères laisse cinquante millions de caractères de clés', async () => {
  // Une clé par préfixe, chacune copie du préfixe : 50 025 002 caractères.
  await assert.rejects(async () => {
    const m = learn([['q'.repeat(10_000), 'chemise en lin']]);
    let total = 0;
    for (const k of m.keys()) total += k.length;
    assert.ok(total <= 100 * 10_000, `${total} caractères de clés`);
  });
});

test('production : une saisie en accents décomposés retrouve les clics du terme composé', () => {
  const m = learn([['e\u0301cha', 'écharpe en laine']]);
  assert.deepEqual(rerank(m, 'écha', ['échelle télescopique', 'écharpe en laine']), [
    'écharpe en laine',
    'échelle télescopique',
  ]);
});

test('INFIRMÉ : le commentaire dit « a tab never occurs inside a prefix », une tabulation dans la saisie crée un clic fantôme', async () => {
  // La clé est `${prefix}\t${term}` : la saisie « a<TAB>b » cliquée sur « c »
  // produit la même clé que la saisie « a » cliquée sur « b<TAB>c ».
  await assert.rejects(async () => {
    const m = learn([['a\tb', 'c']]);
    assert.deepEqual(rerank(m, 'a', ['x', 'b\tc']), ['x', 'b\tc']);
  });
});

test('production : limite à zéro et au nombre exact de candidats', () => {
  assert.deepEqual(rerank(model, 'cha', BY_FREQUENCY, 0), []);
  assert.deepEqual(rerank(model, 'cha', BY_FREQUENCY, 2), [
    'chaussettes de sport',
    'chaussures de running',
  ]);
  assert.equal(rerank(model, 'cha', BY_FREQUENCY, 3).length, 2);
});
