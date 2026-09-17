import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_KEYS, blockingKey, compareRecords, editDistance, fieldKey, findDuplicates, normalise, recordText, similarity } from './n0.js';
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

const MOVED = [
  { name: 'Jean Dupont', postcode: '75011', city: 'Paris' },
  { name: 'Jean Dupont', postcode: '75012', city: 'Paris' },
];
const withEmail = () => MOVED.map((record) => ({ ...record, email: 'j.dupont@example.fr' }));

test('point de rupture : aucune clé ne rapproche la paire, et elle n’est jamais comparée', () => {
  // « Ni le nom et le code postal, ni le courriel, ni le téléphone […] 0,96 de
  // ressemblance sur le texte entier, et rien dans le résultat ».
  assert.ok(DEFAULT_KEYS.every((key) => key(MOVED[0]) !== key(MOVED[1]) || key(MOVED[0]) === ''));
  assert.equal(Math.round(similarity(recordText(MOVED[0]), recordText(MOVED[1])) * 100) / 100, 0.96);
  assert.deepEqual(findDuplicates(MOVED), []);
  // Témoin : le même couple avec le même courriel des deux côtés est comparé.
  assert.deepEqual(findDuplicates(withEmail()), [[0, 1, 0.863]]);
});

test('une seconde clé rattrape ce que la première a manqué', () => {
  // « A key that misses a duplicate is answered with a second key, not with
  // the removal of the key ».
  assert.deepEqual(findDuplicates(withEmail(), 0.85, [blockingKey]), []);
  assert.deepEqual(findDuplicates(withEmail(), 0.85, [fieldKey('email')]), [[0, 1, 0.863]]);
  assert.deepEqual(findDuplicates(withEmail()), [[0, 1, 0.863]]);
});

test('point de rupture : jamais comparées, quel que soit le seuil', () => {
  const moved = MOVED;
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

test('toutes les paires sont comparées quand tout tombe dans un seul groupe', () => {
  // « all of them when every record lands in the same group ».
  const sameBlock = Array.from({ length: 300 }, (_, i) => ({ name: `Jean Dupont${i}`, postcode: '75011', city: 'Paris' }));
  assert.equal(findDuplicates(sameBlock, 0).length, pairsOfSize(300));
  // Témoin : vingt codes postaux différents, et les groupes redeviennent petits.
  const spread = sameBlock.map((record, i) => ({ ...record, postcode: String(75001 + (i % 20)) }));
  assert.ok(findDuplicates(spread, 0).length < pairsOfSize(300) / 10);
});

test('un champ absent d’un côté n’est pas une différence', () => {
  // « A field only one of the two carries is not a difference ».
  const complete = { name: 'Jean Dupont', postcode: '75011', email: 'jean.dupont@example.fr', phone: '0612345678' };
  const partial = { name: 'Jean Dupont', postcode: '75011', email: null, phone: null };
  assert.deepEqual(findDuplicates([complete, partial]), [[0, 1, 1]]);
  // Témoin : deux personnes différentes au même code postal ne sortent pas.
  const other = { name: 'Marie Durand', postcode: '75011', email: 'm.durand@example.fr', phone: '0611111111' };
  assert.deepEqual(findDuplicates([complete, other]), []);
});

test('l’ordre des colonnes ne change rien', () => {
  // « Sorted by column name, so that two exports of the same data give the
  // same text ».
  const complete = { name: 'Jean Dupont', postcode: '75011', email: 'jean.dupont@example.fr', phone: '0612345678' };
  const reordered = { postcode: '75011', name: 'Jean Dupont', phone: '0612345678', email: 'jean.dupont@example.fr' };
  assert.equal(recordText(complete), recordText(reordered));
  assert.deepEqual(findDuplicates([complete, reordered]), [[0, 1, 1]]);
});

test('un champ partagé par tous ne porte pas une paire à lui seul', () => {
  // WEIGHTS : « Agreeing on a town says almost nothing […] while agreeing on
  // an email address says nearly everything ». Deux personnes d'un même
  // foyer : entrée tout à fait ordinaire d'un carnet d'adresses.
  const household = [
    { name: 'Jean Dupont', postcode: '75011', city: 'Paris', country: 'France' },
    { name: 'Sophie Dupont', postcode: '75011', city: 'Paris', country: 'France' },
  ];
  assert.ok(compareRecords(household[0], household[1], {}) >= 0.85);
  assert.ok(compareRecords(household[0], household[1]) < 0.85);
  assert.deepEqual(findDuplicates(household), []);
  // Témoin : la même personne saisie deux fois sort malgré ces champs.
  assert.deepEqual(findDuplicates([household[0], { ...household[0], name: 'Jean Dupônt' }]), [[0, 1, 1]]);
});

test('un courriel différent pèse autant qu’un nom identique', () => {
  // IDENTIFYING : « Two different addresses at the same domain share most of
  // their characters ».
  const pair = [
    { name: 'Jean Dupont', postcode: '75011', email: 'jean.dupont@example.fr' },
    { name: 'Jean Dupont', postcode: '75011', email: 'jeanne.dupont@example.fr' },
  ];
  assert.ok(similarity(normalise(pair[0].email), normalise(pair[1].email)) > 0.9);
  assert.deepEqual(findDuplicates(pair), []);
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

test('production : un nom vide ou nul ne produit aucune clé', () => {
  // « A record missing either half produces no key ».
  const blank = { name: '', postcode: '75011', city: 'Paris' };
  assert.equal(blockingKey(blank), '');
  assert.deepEqual(findDuplicates([blank, { ...blank }]), []);
  const nul = { name: null, postcode: '75011', city: 'Paris' };
  assert.deepEqual(findDuplicates([nul, { name: 'Jean Dupont', postcode: '75011', city: 'Paris' }]), []);
  // Témoin : avec un courriel des deux côtés, la seconde clé les rapproche.
  assert.deepEqual(findDuplicates([{ ...blank, email: 'a@b.fr' }, { ...blank, email: 'a@b.fr' }]), [[0, 1, 1]]);
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

test('production : un caractère de largeur nulle dans le nom ne change pas la clé', () => {
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
  const score = compareRecords(pair[0], pair[1]);
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
  // `why` du cas : « Jean et Jeanne Dupont sortent en doublon à 0,89 ».
  const cas = essai.cases[1];
  assert.equal(cas.fails, true);
  assert.match(cas.why.fr, /en doublon à 0,89/);
  assert.match(cas.why.en, /as duplicates at 0\.89/);
  const sortie = essai.run(cas.input, 'fr');
  assert.match(sortie.note, /^3 comparaisons effectuées sur 3 paires possibles/);
  assert.deepEqual(sortie.rows.rows.map((r) => [r[0], r[1], r[2].v]), [['Jean Dupont, 75011', 'Jeanne Dupont, 75011', '0,89']]);
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
