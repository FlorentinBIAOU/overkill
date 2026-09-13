import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LABELS, parse, tokenise, train } from './n1.js';

// The training set of this rung: addresses tagged by hand, token by token.
// Every one is invented — none is the home of a real person, and none is the
// registered office of a real company. Written as segments rather than as one
// label per token, because that is the form a human can actually check.
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

/** Turn segments into the [address, one label per token] pair `train` wants. */
function expand(segments) {
  return [
    segments.map(([text]) => text).join(' '),
    segments.flatMap(([text, label]) => tokenise(text).map(() => label)),
  ];
}

const model = train(TAGGED.map(expand));

test('the tagging helper lines labels up with tokens', () => {
  const [address, labels] = expand(TAGGED[0]);
  assert.equal(address, '8 rue des Lilas 75011 Paris');
  assert.deepEqual(labels, ['number', 'street_type', 'street', 'street', 'postcode', 'city']);
});

test('parses an ordinary address', () => {
  assert.deepEqual(parse(model, '8 rue des Lilas, 75011 Paris'), {
    number: '8',
    street_type: 'rue',
    street: 'rue des Lilas',
    complement: '',
    postcode: '75011',
    city: 'Paris',
  });
});

test('separates a complement that N0 swallowed', () => {
  // The gain of this rung, on the very address the rung below got wrong.
  const parsed = parse(model, 'Appartement 12, Bâtiment C, 8 rue des Lilas, 75011 Paris');
  assert.equal(parsed.complement, 'Appartement 12 Bâtiment C');
  assert.equal(parsed.number, '8');
  assert.equal(parsed.street, 'rue des Lilas');
});

test('reads a street it has never seen', () => {
  // Neither the street nor the town is in the training set: the labels come
  // from the shape of the line, not from a list of names.
  const parsed = parse(model, '7 rue du Moulin, Résidence Les Charmes, 21000 Dijon');
  assert.equal(parsed.street, 'rue du Moulin');
  assert.equal(parsed.complement, 'Résidence Les Charmes');
  assert.equal(parsed.city, 'Dijon');
});

test('reads capitals and accents', () => {
  const parsed = parse(model, '6 QUAI DES ORMES 67000 STRASBOURG');
  assert.equal(parsed.number, '6');
  assert.equal(parsed.street, 'QUAI DES ORMES');
  assert.equal(parsed.city, 'STRASBOURG');
});

test('handles an empty string', () => {
  assert.deepEqual(parse(model, ''), Object.fromEntries(LABELS.map((name) => [name, ''])));
});

test('a misaligned example is rejected rather than learnt', () => {
  assert.throws(() => train([['8 rue des Lilas', ['number', 'street_type']]]));
});

test('breaking point: a convention absent from the training set', () => {
  // This rung knows the conventions it was shown. Every address tagged above
  // puts the number first and five digits before the town. A German address
  // puts the number last, a British one has no run of five digits at all, and
  // the model has no way to say "I have never seen this". It labels every
  // token anyway, confidently and wrongly.
  //
  // Widening it costs another round of hand tagging, per country. That is the
  // real price of this rung, and it is why the entry does not pretend the model
  // generalises for free.
  const german = parse(model, 'Hauptstrasse 5, 10115 Berlin');
  // The five digits and the town still land right; the street does not.
  assert.equal(german.postcode, '10115');
  assert.equal(german.city, 'Berlin');
  assert.equal(german.street, '');
  assert.equal(german.number, '5');

  const british = parse(model, '42 Rowan Street, Bristol BS1 4TQ');
  assert.equal(british.postcode, '');
  assert.notEqual(british.city, 'Bristol');
  assert.equal(british.street, '');
});
