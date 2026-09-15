import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { blockingKey, editDistance, findDuplicates, normalise, recordText, similarity } from './n0.js';
import essai from '../../tryouts/live/find-duplicate-records.js';

// A customer file as it really looks: the same person entered twice, by two
// people, on two days.
const CUSTOMERS = [
  { name: 'Jean Dupont', postcode: '75011', city: 'Paris' },
  { name: 'Jean Dupônt', postcode: '75011', city: 'PARIS' },
  { name: 'Marie Martin', postcode: '69003', city: 'Lyon' },
  { name: 'Marie Martln', postcode: '69003', city: 'Lyon' },
  { name: 'Paul Bernard', postcode: '33000', city: 'Bordeaux' },
];

const indexesOf = (pairs) => pairs.map(([i, j]) => [i, j]);
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/** A file with varied family names and twenty postcodes, built without randomness. */
const syntheticFile = (size) => Array.from({ length: size }, (_, i) => ({
  name: `Client ${LETTERS[i % 26]}${LETTERS[(i * 7) % 26]}${LETTERS[(i * 13) % 23]}${LETTERS[Math.floor(i / 26) % 26]}eau`,
  postcode: String(75001 + (i % 20)),
  city: 'Paris',
}));

const pairsOfSize = (n) => (n * (n - 1)) / 2;

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : un chiffre faux dans le code postal, les textes à 0,96 et la paire absente', () => {
  const moved = [
    { name: 'Jean Dupont', postcode: '75011', city: 'Paris' },
    { name: 'Jean Dupont', postcode: '75012', city: 'Paris' },
  ];
  assert.notEqual(blockingKey(moved[0]), blockingKey(moved[1]));
  assert.equal(Math.round(similarity(recordText(moved[0]), recordText(moved[1])) * 100) / 100, 0.96);
  assert.deepEqual(findDuplicates(moved), []);
  // Witness: with the right postcode, the pair comes out.
  assert.deepEqual(findDuplicates([moved[0], { ...moved[1], postcode: '75011' }]), [[0, 1, 1]]);
});

test('point de rupture : jamais comparées, quel que soit le seuil', () => {
  const moved = [
    { name: 'Jean Dupont', postcode: '75011', city: 'Paris' },
    { name: 'Jean Dupont', postcode: '75012', city: 'Paris' },
  ];
  for (const threshold of [0, 0.5, 0.85]) assert.deepEqual(findDuplicates(moved, threshold), []);
});

test('point de rupture : « Dupont Jean » est manqué deux fois, la clé et la distance', () => {
  const swapped = [
    { name: 'Jean Dupont', postcode: '75011', city: 'Paris' },
    { name: 'Dupont Jean', postcode: '75011', city: 'Paris' },
  ];
  assert.notEqual(blockingKey(swapped[0]), blockingKey(swapped[1]));
  assert.deepEqual(findDuplicates(swapped, 0), []);
  assert.ok(similarity(recordText(swapped[0]), recordText(swapped[1])) < 0.85);
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('trouve les deux paires en doublon et rien d’autre', () => {
  assert.deepEqual(indexesOf(findDuplicates(CUSTOMERS)), [[0, 1], [2, 3]]);
});

test('la normalisation retire casse, accents, ponctuation et espaces doubles', () => {
  assert.equal(normalise('Jean DUPÔNT'), 'jean dupont');
  assert.equal(normalise("  Jean-Pierre,   d'Arc.  "), 'jean pierre d arc');
  assert.equal(recordText(CUSTOMERS[0]), recordText(CUSTOMERS[1]));
});

test('une faute d’un caractère garde un score haut', () => {
  assert.ok(similarity('marie martin', 'marie martln') > 0.9);
});

test('la distance d’édition est celle de Levenshtein', () => {
  assert.equal(editDistance('kitten', 'sitting'), 3);
  assert.equal(editDistance('', 'abc'), 3);
  assert.equal(editDistance('abc', 'abc'), 0);
});

test('la similarité vaut un pour des chaînes identiques et zéro sans rien en commun', () => {
  assert.equal(similarity('dupont', 'dupont'), 1);
  assert.equal(similarity('abc', 'xyz'), 0);
  assert.equal(similarity('', ''), 1);
});

test('la clé prend trois lettres du nom de famille et le code postal', () => {
  assert.equal(blockingKey({ name: 'Jean Dupônt', postcode: '75011' }), 'dup:75011');
});

test('le seuil est à vous', () => {
  assert.deepEqual(indexesOf(findDuplicates(CUSTOMERS, 0.99)), [[0, 1]]);
});

test('les paires sont rendues du score le plus haut au plus bas', () => {
  const scores = findDuplicates(CUSTOMERS, 0).map(([, , s]) => s);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
});

test('dix mille fiches font cinquante millions de paires', () => {
  assert.equal(pairsOfSize(10_000), 49_995_000);
});

test('INFIRMÉ : la docstring dit que ce niveau ne compare jamais toutes les paires, sur un seul bloc il les compare toutes', async () => {
  await assert.rejects(async () => {
    const sameBlock = Array.from({ length: 300 }, (_, i) => ({ name: `Jean Dupont${i}`, postcode: '75011', city: 'Paris' }));
    assert.ok(findDuplicates(sameBlock, 0).length < pairsOfSize(300));
  });
});

test('l’extrait est déterministe et n’importe rien', () => {
  const source = readFileSync(new URL('./n0.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s|\brequire\(|\bimport\(|\bfetch\(/m);
  assert.deepEqual(findDuplicates(CUSTOMERS), findDuplicates([...CUSTOMERS]));
});

test('il propose des paires et un score, il ne fusionne rien', () => {
  const records = CUSTOMERS.map((record) => ({ ...record }));
  const pairs = findDuplicates(records);
  assert.deepEqual(records, CUSTOMERS);
  assert.ok(pairs.every((pair) => pair.length === 3));
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : fichier vide et fiche unique', () => {
  assert.deepEqual(findDuplicates([]), []);
  assert.deepEqual(findDuplicates([CUSTOMERS[0]]), []);
});

test('production : un nom vide ne fait pas lever', () => {
  // Constat : deux fiches sans nom au même code postal sortent comme doublons certains.
  const blank = { name: '', postcode: '75011', city: 'Paris' };
  assert.deepEqual(findDuplicates([blank, { ...blank }]), [[0, 1, 1]]);
});

test('production : un nom nul ne fait pas lever', () => {
  // Python lève ici (voir son test DÉFAUT). JavaScript lit null comme le mot « null ».
  const records = [{ name: null, postcode: '75011', city: 'Paris' }, { name: 'Jean Dupont', postcode: '75011', city: 'Paris' }];
  assert.deepEqual(findDuplicates(records), []);
});

test('production : dix mille fiches variées dans une borne large', () => {
  const records = syntheticFile(10_000);
  const debut = performance.now();
  findDuplicates(records);
  assert.ok(performance.now() - debut < 30_000);
});

test('production : accents décomposés, espaces insécables et casse mixte', () => {
  assert.equal(normalise('Jean Dupo\u0302nt'), 'jean dupont');
  assert.equal(normalise('Jean\u00a0DUPONT'), 'jean dupont');
  assert.equal(blockingKey({ name: 'JEAN\u00a0Dupo\u0302nt', postcode: ' 75011 ' }), 'dup:75011');
});

test('un caractère de largeur nulle dans le nom change la clé', async () => {
  const records = [
    { name: 'Jean Dupont', postcode: '75011', city: 'Paris' },
    { name: 'Jean Du\u200bpont', postcode: '75011', city: 'Paris' },
  ];
  assert.deepEqual(indexesOf(findDuplicates(records)), [[0, 1]]);
});

test('production : seuil exactement atteint et valeurs aux limites', () => {
  const pair = [
    { name: 'Marie Martin', postcode: '69003', city: 'Lyon' },
    { name: 'Marie Martln', postcode: '69003', city: 'Lyon' },
  ];
  const score = similarity(recordText(pair[0]), recordText(pair[1]));
  assert.deepEqual(indexesOf(findDuplicates(pair, score)), [[0, 1]]);
  assert.deepEqual(findDuplicates(pair, score + 1e-9), []);
  assert.deepEqual(findDuplicates([pair[0], { ...pair[0] }], 1), [[0, 1, 1]]);
});

// ---------------------------------------------------------------------------
// L'essai de la fiche
// ---------------------------------------------------------------------------

test('essai : cinq fiches clients, deux saisies deux fois, deux paires', () => {
  for (const lang of ['fr', 'en']) {
    const sortie = essai.run(essai.cases[0].input, lang);
    assert.equal(sortie.rows.rows.length, 2);
    assert.equal(sortie.spans.length, 4);
  }
});

test('essai : trois Dupont à la même adresse sont tous comparés', () => {
  // Constat : « Jean » et « Jeanne » Dupont sortent en doublon à 0,92, sans que
  // le cas le signale.
  const sortie = essai.run(essai.cases[1].input, 'fr');
  assert.match(sortie.note, /^3 comparaisons effectuées sur 3 paires possibles/);
  assert.deepEqual(sortie.rows.rows.map((r) => [r[0], r[1]]), [['Jean Dupont, 75011', 'Jeanne Dupont, 75011']]);
});

test('essai : un chiffre de travers et un nom à l’envers, rien ne sort, et deux fiches à 0,96 jamais comparées', () => {
  const cas = essai.cases[2];
  assert.equal(cas.fails, true);
  for (const lang of ['fr', 'en']) {
    const sortie = essai.run(cas.input, lang);
    assert.equal(sortie.rows, undefined);
    assert.deepEqual(sortie.spans, []);
    assert.match(sortie.note, lang === 'fr' ? /^0 comparaison effectuée sur 3 paires.*0,96/ : /^0 comparison run out of 3 possible pairs.*0\.96/);
  }
  assert.equal(essai.level, 'N0');
});

test('essai : une seule fiche demande une ligne de plus', () => {
  assert.ok(essai.run('Jean Dupont ; 75011 ; Paris', 'fr').verdict.label);
});
