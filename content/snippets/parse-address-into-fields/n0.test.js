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

test("INFIRMÉ : la fiche dit que « l'adresse entière passe en nom de rue » ; le code postal et la ville sont bien lus", async () => {
  await assert.rejects(async () => {
    const parsed = parse('Appartement 12, Bâtiment C, 8 rue des Lilas, 75011 Paris');
    assert.equal(parsed.postcode, '');
    assert.ok(parsed.street.includes('75011 Paris'));
  }, assert.AssertionError);
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

test('« r » est dans le dictionnaire, mais « 8 r des Lilas » donne le numéro « 8 r » et aucune rue', async () => {
  assert.equal(STREET_TYPES.r, 'rue');
  assert.deepEqual(parse('8 r des Lilas 75011 Paris'), LILAS);
});

test("garde l'indice de répétition avec le numéro", () => {
  assert.equal(parse('12 bis rue des Lilas 75011 Paris').number, '12 bis');
  assert.equal(parse('12 ter rue des Lilas 75011 Paris').number, '12 ter');
  assert.equal(parse('12B rue des Lilas 75011 Paris').number, '12 B');
});

test("INFIRMÉ : le commentaire justifie « le dernier code postal » par l'année d'un nom de rue ; une année n'est jamais un code postal", async () => {
  await assert.rejects(async () => {
    assert.notEqual(parse('rue du 8 Mai 1945').postcode, '');
  }, assert.AssertionError);
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
  assert.equal(normalise('8 rue  des Lilas,\n75011 Paris'), '8 rue des Lilas 75011 Paris');
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

test('une plage « 8-10 » donne le numéro « 8 » et la rue « -10 rue des Lilas »', async () => {
  const parsed = parse('8-10 rue des Lilas 75011 Paris');
  assert.equal(parsed.street, 'rue des Lilas');
  assert.equal(parsed.street_type, 'rue');
});
