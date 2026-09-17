import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FIELDS, STREET_TYPES, fold, normalise, parse } from './n0.js';

// Toutes les adresses sont inventées.
const EMPTY = Object.fromEntries(FIELDS.map((name) => [name, '']));
const LILAS = { number: '8', street_type: 'rue', street: 'rue des Lilas', postcode: '75011', city: 'Paris' };

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : un complément écrit après finit dans le nom de la rue', () => {
  assert.deepEqual(parse('8 rue des Lilas Bâtiment C Appartement 12, 75011 Paris'), { ...LILAS, street: 'rue des Lilas Bâtiment C Appartement 12' });
  assert.deepEqual(parse('8 rue des Lilas, 75011 Paris'), LILAS);
});

test('point de rupture : un complément écrit devant vide le numéro', () => {
  const parsed = parse('Appartement 12, Bâtiment C, 8 rue des Lilas, 75011 Paris');
  assert.equal(parsed.number, '');
  assert.equal(parsed.street_type, '');
  assert.equal(parsed.street, 'Appartement 12 Bâtiment C 8 rue des Lilas');
});

test('point de rupture : toute la ligne de voie, complément compris, passe en nom de rue', () => {
  assert.deepEqual(parse('Appartement 12, Bâtiment C, 8 rue des Lilas, 75011 Paris'), {
    number: '', street_type: '', street: 'Appartement 12 Bâtiment C 8 rue des Lilas', postcode: '75011', city: 'Paris',
  });
});

test('point de rupture : hors de France, le numéro allemand reste dans la rue', () => {
  assert.deepEqual(parse('Hauptstrasse 5, 10115 Berlin'), { number: '', street_type: '', street: 'Hauptstrasse 5', postcode: '10115', city: 'Berlin' });
});

test('point de rupture : une adresse britannique ressort sans code postal ni ville', () => {
  assert.deepEqual(parse('42 Rowan Street, Bristol BS1 4TQ'), { number: '42', street_type: '', street: 'Rowan Street Bristol BS1 4TQ', postcode: '', city: '' });
});

test('point de rupture : la ville écrite d’abord aspire la rue', () => {
  const parsed = parse('75011 Paris, 8 rue des Lilas');
  assert.equal(parsed.street, '');
  assert.equal(parsed.city, 'Paris 8 rue des Lilas');
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('cinq chiffres coupent une adresse en deux', () => {
  assert.equal(parse('3, Allée du Château\n33000 BORDEAUX').city, 'BORDEAUX');
  assert.equal(parse('8 rue des Lilas 7501 Paris').postcode, '');
  assert.equal(parse('8 rue des Lilas 750110 Paris').postcode, '');
});

test('les abréviations tapées ressortent sous une seule orthographe', () => {
  assert.equal(parse('12 av. des Cerisiers 69003 Lyon').street, 'avenue des Cerisiers');
  assert.equal(parse('3 bd Voltaire 75011 Paris').street, 'boulevard Voltaire');
  assert.equal(parse('12 imp. des Roses 44000 Nantes').street, 'impasse des Roses');
  for (const written of ['12 av. des Cerisiers', '12 avenue des Cerisiers', '12 AV DES CERISIERS']) {
    assert.equal(parse(`${written} 69003 Lyon`).street_type, 'avenue', written);
  }
});

test('une lettre isolée n’est un indice que collée au numéro ; le « r » reste un type de voie', () => {
  assert.equal(STREET_TYPES.r, 'rue');
  assert.deepEqual(parse('8 r des Lilas 75011 Paris'), LILAS);
  assert.deepEqual(parse('8 r. des Lilas 75011 Paris'), LILAS);
  assert.equal(parse('12b rue des Lilas 75011 Paris').number, '12 b');
  // Décision du rédacteur : une lettre séparée du numéro passe dans la voie, qui perd son type.
  assert.deepEqual(parse('12 B rue des Lilas 75011 Paris'), { number: '12', street_type: '', street: 'B rue des Lilas', postcode: '75011', city: 'Paris' });
});

test("garde l'indice de répétition et la plage avec le numéro", () => {
  assert.equal(parse('12 bis rue des Lilas 75011 Paris').number, '12 bis');
  assert.equal(parse('12 ter rue des Lilas 75011 Paris').number, '12 ter');
  assert.equal(parse('8 quater rue des Lilas 75011 Paris').number, '8 quater');
  assert.equal(parse('8bis rue des Lilas 75011 Paris').number, '8 bis');
  assert.equal(parse('12B rue des Lilas 75011 Paris').number, '12 B');
  assert.deepEqual(parse('8-10 rue des Lilas 75011 Paris'), { ...LILAS, number: '8-10' });
  assert.equal(parse('8-10bis rue des Lilas 75011 Paris').number, '8-10 bis');
  // Témoin : « ter » au début d'un mot plus long n'est pas un indice.
  assert.equal(parse('8 Terrasse des Lilas 75011 Paris').street, 'Terrasse des Lilas');
});

test('un nombre de cinq chiffres placé avant le vrai code postal n’est pas pris', () => {
  const parsed = parse('BP 40012, 8 rue des Lilas, 75011 Paris');
  assert.equal(parsed.postcode, '75011');
  assert.equal(parsed.city, 'Paris');
  assert.equal(parsed.street, 'BP 40012 8 rue des Lilas');
});

test('une année dans le nom de rue reste dans la rue', () => {
  assert.equal(parse('8 rue du 8 Mai 1945, 75011 Paris').street, 'rue du 8 Mai 1945');
});

test('lit accents, casse et ponctuation', () => {
  const parsed = parse('3, Allée du Château\n33000 BORDEAUX');
  assert.equal(parsed.street_type, 'allée');
  assert.equal(parsed.street, 'allée du Château');
  assert.equal(parsed.city, 'BORDEAUX');
});

test('normalisation et repli', () => {
  assert.equal(normalise('8 rue  des Lilas,\n75011\u00a0Paris'), '8 rue des Lilas 75011 Paris');
  assert.equal(normalise('\ufeff8 rue des\ufeffLilas\u2009 75011 Paris'), '8 rue des Lilas 75011 Paris');
  assert.equal(fold('Av.'), 'av');
  assert.equal(fold('Allée'), 'allee');
  assert.equal(fold('.av'), '.av');
});

test("chaque champ est une chaîne, vide quand l'adresse ne le porte pas", () => {
  assert.deepEqual(parse(''), EMPTY);
  const parsed = parse('Paris');
  assert.deepEqual(Object.keys(parsed), FIELDS);
  assert.ok(Object.values(parsed).every((v) => typeof v === 'string'));
});

test('garde la mention cedex avec la ville', () => {
  assert.equal(parse('2 place des Tilleuls 31081 Toulouse Cedex 9').city, 'Toulouse Cedex 9');
});

test("n0 est déterministe et n'emploie aucune dépendance", () => {
  for (let i = 0; i < 20; i += 1) assert.deepEqual(parse('8 rue des Lilas, 75011 Paris'), LILAS);
  assert.doesNotMatch(readFileSync(new URL('./n0.js', import.meta.url), 'utf8'), /^\s*import\s|require\(/m);
});

test("une adresse se découpe en moins d'une milliseconde", () => {
  const runs = [];
  for (let r = 0; r < 5; r += 1) {
    const start = performance.now();
    for (let i = 0; i < 100; i += 1) parse('8 rue des Lilas, 75011 Paris');
    runs.push((performance.now() - start) / 100);
  }
  assert.ok(Math.min(...runs) < 1);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : une adresse de trois mille caractères termine', () => {
  const start = performance.now();
  const parsed = parse(`${'8 rue des Lilas Bâtiment C '.repeat(120)} 75011 Paris`);
  assert.ok(performance.now() - start < 1000);
  assert.equal(parsed.postcode, '75011');
});

test("production : chiffres pleine largeur, espaces insécables, NFD, marque d'ordre", () => {
  assert.deepEqual(parse('８ rue des Lilas ７５０１１ Paris'), LILAS);
  assert.deepEqual(parse('8 rue des Lilas 75011 Paris'), LILAS);
  assert.equal(parse('3 Allée du Château 33000 Bordeaux').street_type, 'allée');
  // trim() retire la marque d'ordre en JavaScript ; Python ne la retire pas.
  assert.deepEqual(parse('﻿8 rue des Lilas, 75011 Paris'), LILAS);
});

test('production : une plage de numéros ne passe pas dans la rue', () => {
  const parsed = parse('8-10 rue des Lilas 75011 Paris');
  assert.equal(parsed.street, 'rue des Lilas');
  assert.equal(parsed.street_type, 'rue');
  assert.equal(parse('1234-5678 rue X 75011 Paris').number, '1234-5678');
  // Une plage écrite avec des espaces n'est pas reconnue : « - 10 » passe dans la voie.
  assert.deepEqual(parse('8 - 10 rue des Lilas 75011 Paris'), { number: '8', street_type: '', street: '- 10 rue des Lilas', postcode: '75011', city: 'Paris' });
});

test("production : une marque d'ordre des octets au milieu de la ligne", () => {
  assert.deepEqual(parse('8 rue des\ufeffLilas 75011 Paris'), LILAS);
});
