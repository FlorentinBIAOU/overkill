import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse as parseN0 } from './n0.js';
import { LABELS, features, fold, parse, tokenise, train } from './n1.js';
import essai from '../../tryouts/live/parse-address-into-fields.js';

// Le jeu d'entraînement de ce niveau : des adresses étiquetées à la main, jeton
// par jeton. Toutes sont inventées.
const TAGGED = [
  [['8', 'number'], ['rue', 'street_type'], ['des Lilas', 'street'], ['75011', 'postcode'], ['Paris', 'city']],
  [['14', 'number'], ['avenue', 'street_type'], ['des Cerisiers', 'street'], ['69003', 'postcode'], ['Lyon', 'city']],
  [['3', 'number'], ['allée', 'street_type'], ['du Château', 'street'], ['33000', 'postcode'], ['Bordeaux', 'city']],
  [['27', 'number'], ['boulevard', 'street_type'], ['des Acacias', 'street'], ['13006', 'postcode'], ['Marseille', 'city']],
  [['5', 'number'], ['impasse', 'street_type'], ['des Peupliers', 'street'], ['44000', 'postcode'], ['Nantes', 'city']],
  [['2', 'number'], ['place', 'street_type'], ['des Tilleuls', 'street'], ['31000', 'postcode'], ['Toulouse', 'city']],
  [['41', 'number'], ['chemin', 'street_type'], ['des Vignes', 'street'], ['38000', 'postcode'], ['Grenoble', 'city']],
  [['9', 'number'], ['route', 'street_type'], ['de la Forêt', 'street'], ['35000', 'postcode'], ['Rennes', 'city']],
  [['12 bis', 'number'], ['rue', 'street_type'], ['des Écoles', 'street'], ['59000', 'postcode'], ['Lille', 'city']],
  [['6', 'number'], ['quai', 'street_type'], ['des Ormes', 'street'], ['67000', 'postcode'], ['Strasbourg', 'city']],
  [['8', 'number'], ['rue', 'street_type'], ['des Lilas', 'street'], ['Bâtiment C', 'complement'], ['75011', 'postcode'], ['Paris', 'city']],
  [['14', 'number'], ['avenue', 'street_type'], ['des Cerisiers', 'street'], ['Appartement 12', 'complement'], ['69003', 'postcode'], ['Lyon', 'city']],
  [['Appartement 4', 'complement'], ['3', 'number'], ['allée', 'street_type'], ['du Château', 'street'], ['33000', 'postcode'], ['Bordeaux', 'city']],
  [['Bâtiment B', 'complement'], ['Escalier 2', 'complement'], ['27', 'number'], ['boulevard', 'street_type'], ['des Acacias', 'street'], ['13006', 'postcode'], ['Marseille', 'city']],
  [['5', 'number'], ['impasse', 'street_type'], ['des Peupliers', 'street'], ['Résidence Les Ormes', 'complement'], ['44000', 'postcode'], ['Nantes', 'city']],
  [['2', 'number'], ['place', 'street_type'], ['des Tilleuls', 'street'], ['Escalier A', 'complement'], ['31000', 'postcode'], ['Toulouse', 'city']],
  [['41', 'number'], ['chemin', 'street_type'], ['des Vignes', 'street'], ['Étage 3', 'complement'], ['38000', 'postcode'], ['Grenoble', 'city']],
  [['9', 'number'], ['route', 'street_type'], ['de la Forêt', 'street'], ['Porte 12', 'complement'], ['35000', 'postcode'], ['Rennes', 'city']],
];

/** Des segments vers le couple [adresse, une étiquette par jeton] attendu par `train`. */
function expand(segments) {
  return [
    segments.map(([text]) => text).join(' '),
    segments.flatMap(([text, label]) => tokenise(text).map(() => label)),
  ];
}

const model = train(TAGGED.map(expand));
const EMPTY = Object.fromEntries(LABELS.map((name) => [name, '']));

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test("point de rupture : l'adresse allemande rend une rue vide et un numéro qui vaut 5", () => {
  assert.deepEqual(parse(model, 'Hauptstrasse 5, 10115 Berlin'), {
    number: '5', street_type: '', street: '', complement: 'Hauptstrasse', postcode: '10115', city: 'Berlin',
  });
  assert.equal(parse(model, '8 rue des Lilas, 75011 Paris').street, 'rue des Lilas');
});

test("point de rupture : l'adresse britannique rend pas de code postal et « 4TQ » pour ville", () => {
  const parsed = parse(model, '42 Rowan Street, Bristol BS1 4TQ');
  assert.deepEqual(parsed, { number: '42', street_type: '', street: '', complement: 'Rowan Street Bristol BS1', postcode: '', city: '4TQ' });
  const labelled = Object.entries(parsed).filter(([k]) => k !== 'street').flatMap(([, v]) => v.split(' ').filter(Boolean));
  assert.deepEqual(labelled.sort(), tokenise('42 Rowan Street, Bristol BS1 4TQ').sort());
});

test('point de rupture : toutes les adresses du jeu placent le numéro devant et cinq chiffres avant la ville', () => {
  for (const segments of TAGGED) {
    const labels = segments.map(([, label]) => label);
    assert.ok(labels.indexOf('number') < labels.indexOf('street_type'));
    assert.equal(labels.indexOf('postcode'), labels.indexOf('city') - 1);
    assert.match(segments.find(([, l]) => l === 'postcode')[0], /^\d{5}$/);
  }
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test("l'aide d'étiquetage aligne les étiquettes sur les jetons", () => {
  const [address, labels] = expand(TAGGED[0]);
  assert.equal(address, '8 rue des Lilas 75011 Paris');
  assert.deepEqual(labels, ['number', 'street_type', 'street', 'street', 'postcode', 'city']);
});

test('découpe une adresse ordinaire', () => {
  assert.deepEqual(parse(model, '8 rue des Lilas, 75011 Paris'), {
    number: '8', street_type: 'rue', street: 'rue des Lilas', complement: '', postcode: '75011', city: 'Paris',
  });
});

test("un complément au milieu de la ligne n'avale plus la voie", () => {
  const address = '8 rue des Lilas Bâtiment C Appartement 12, 75011 Paris';
  assert.equal(parse(model, address).street, 'rue des Lilas');
  assert.equal(parse(model, address).complement, 'Bâtiment C Appartement 12');
  assert.equal(parseN0(address).street, 'rue des Lilas Bâtiment C Appartement 12');
});

test('sépare un complément que N0 avalait', () => {
  const parsed = parse(model, 'Appartement 12, Bâtiment C, 8 rue des Lilas, 75011 Paris');
  assert.equal(parsed.complement, 'Appartement 12 Bâtiment C');
  assert.equal(parsed.number, '8');
  assert.equal(parsed.street, 'rue des Lilas');
});

test("l'essai : une rue, une résidence et une ville jamais vues ; deux compléments devant ; tout en capitales", () => {
  const seen = TAGGED.flat().map(([text]) => text).join(' ');
  for (const word of ['Moulin', 'Charmes', 'Dijon', '21000']) assert.ok(!seen.includes(word), word);
  const [jamais, devant, capitales] = essai.cases;
  const valeurs = (cas) => Object.fromEntries(essai.run(cas.input, 'fr').rows.rows.map(([champ, cellule]) => [champ, cellule.v ?? '']));
  assert.deepEqual(valeurs(jamais), { Numéro: '7', Voie: 'rue du Moulin', Complément: 'Résidence Les Charmes', 'Code postal': '21000', Ville: 'Dijon' });
  assert.deepEqual(valeurs(devant), { Numéro: '8', Voie: 'rue des Lilas', Complément: 'Appartement 12 Bâtiment C', 'Code postal': '75011', Ville: 'Paris' });
  assert.deepEqual(valeurs(capitales), { Numéro: '6', Voie: 'QUAI DES ORMES', Complément: '', 'Code postal': '67000', Ville: 'STRASBOURG' });
});

test("l'essai allemand : la rue passe en complément, la voie ressort vide, le 5 devient un numéro", () => {
  const allemand = essai.cases[3];
  assert.equal(allemand.fails, true);
  const rows = Object.fromEntries(essai.run(allemand.input, 'fr').rows.rows.map(([champ, cellule]) => [champ, cellule.v ?? '']));
  assert.deepEqual(rows, { Numéro: '5', Voie: '', Complément: 'Hauptstrasse', 'Code postal': '10115', Ville: 'Berlin' });
  assert.equal(essai.run(allemand.input, 'fr').note, 'Modèle entraîné sur 18 adresses étiquetées mot par mot.');
});

test("chaque mot est étiqueté d'après ce à quoi il ressemble et ce qui l'entoure", () => {
  const traits = features(['8', 'Rue', 'des'], 1);
  assert.equal(traits['token=rue'], 1);
  assert.equal(traits['previous=8'], 1);
  assert.equal(traits['next=des'], 1);
  assert.equal(features(['75011'], 0).five_digits, 1);
  assert.equal(fold('Allée'), 'allee');
});

test('la position compte aussi : sur la ville écrite d’abord, la fin de ligne l’emporte', () => {
  const parsed = parse(model, '75011 Paris, 8 rue des Lilas');
  assert.equal(parsed.postcode, '75011');
  assert.equal(parsed.city, 'Lilas');
  // Témoin : à sa place habituelle, le même couple est lu code postal et ville.
  assert.equal(parse(model, '8 rue des Lilas, 75011 Paris').city, 'Paris');
  const traits = features(tokenise('75011 Paris, 8 rue des Lilas'), 5);
  assert.equal(traits.last, 1);
  assert.equal(traits.position, 5 / 6);
});

test('une régression binaire par étiquette, la plus forte l’emporte', () => {
  assert.deepEqual(Object.keys(model.weights).sort(), [...LABELS].sort());
  for (const w of Object.values(model.weights)) assert.equal(w.length, model.columns.size + 1);
});

test('écrit en entier : aucune dépendance à installer', () => {
  // « Written out rather than pulled from a library: no dependency to install for a model this size. »
  assert.doesNotMatch(readFileSync(new URL('./n1.js', import.meta.url), 'utf8'), /^\s*import\s|require\(/m);
});

test('les champs sont regroupés dans l’ordre de lecture et le type ouvre la voie', () => {
  const parsed = parse(model, 'Bâtiment B Escalier 2 27 boulevard des Acacias 13006 Marseille');
  assert.equal(parsed.complement, 'Bâtiment B Escalier 2');
  assert.equal(parsed.street, 'boulevard des Acacias');
  assert.equal(parsed.street_type, 'boulevard');
});

test("un exemple mal aligné est refusé plutôt qu'appris", () => {
  assert.throws(() => train([['8 rue des Lilas', ['number', 'street_type']]]), /4 tokens for 2 labels/);
});

test('le jeu d’entraînement compte dix-huit adresses', () => {
  assert.equal(TAGGED.length, 18);
});

test('n1 est déterministe et sans dépendance', () => {
  const again = train(TAGGED.map(expand));
  for (const a of ['8 rue des Lilas, 75011 Paris', 'Hauptstrasse 5, 10115 Berlin']) assert.deepEqual(parse(again, a), parse(model, a));
  assert.doesNotMatch(readFileSync(new URL('./n1.js', import.meta.url), 'utf8'), /^\s*import\s|require\(/m);
});

test("une adresse se découpe en moins d'une milliseconde", () => {
  const runs = [];
  for (let r = 0; r < 5; r += 1) {
    const start = performance.now();
    for (let i = 0; i < 50; i += 1) parse(model, '8 rue des Lilas, 75011 Paris');
    runs.push((performance.now() - start) / 50);
  }
  assert.ok(Math.min(...runs) < 1);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : une chaîne vide et de la ponctuation seule', () => {
  assert.deepEqual(parse(model, ''), EMPTY);
  assert.deepEqual(parse(model, ' ,;. '), EMPTY);
});

test("production : un jeu d'entraînement vide ou d'une seule étiquette est refusé", () => {
  // « Two labels at least, as scikit-learn demands. »
  assert.throws(() => train([]), { name: 'RangeError', message: 'train needs at least two different labels' });
  assert.throws(() => train([['Paris Lyon', ['city', 'city']]]), RangeError);
});

test('production : une adresse de trois mille caractères termine', () => {
  const start = performance.now();
  const parsed = parse(model, `${'8 rue des Lilas Bâtiment C '.repeat(120)} 75011 Paris`);
  assert.ok(performance.now() - start < 2000);
  assert.ok(parsed.postcode.endsWith('75011'));
});

test("production : marque d'ordre, pleine largeur, NFD", () => {
  assert.equal(parse(model, '﻿8 rue des Lilas, 75011 Paris').street, 'rue des Lilas');
  assert.equal(parse(model, '８ rue des Lilas, ７５０１１ Paris').postcode, '75011');
  assert.equal(parse(model, '3 Allée du Château, 33000 Bordeaux').street, 'Allée du Château');
});

test("production : une ligne qui n'est pas une adresse est étiquetée quand même", () => {
  const parsed = parse(model, 'the meeting is at ten in room four');
  assert.equal(parsed.number, 'the');
  assert.equal(parsed.city, 'four');
});
