import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIELDS, fold, normalise, parse } from './n0.js';

// Every address below is invented. None is the home of a real person, and none
// is the registered office of a real company.

test('parses an ordinary address', () => {
  assert.deepEqual(parse('8 rue des Lilas, 75011 Paris'), {
    number: '8',
    street_type: 'rue',
    street: 'rue des Lilas',
    postcode: '75011',
    city: 'Paris',
  });
});

test('expands an abbreviated street type', () => {
  // Two spellings of one street have to compare equal downstream.
  for (const written of ['12 av. des Cerisiers', '12 avenue des Cerisiers', '12 AV DES CERISIERS']) {
    assert.equal(parse(`${written} 69003 Lyon`).street_type, 'avenue', written);
  }
});

test('keeps the repetition index with the number', () => {
  assert.equal(parse('12 bis rue des Lilas 75011 Paris').number, '12 bis');
  assert.equal(parse('12B rue des Lilas 75011 Paris').number, '12 B');
});

test('reads accents, case and punctuation', () => {
  // The address as a form actually receives it: two lines, commas, accents.
  const parsed = parse('3, Allée du Château\n33000 BORDEAUX');
  assert.equal(parsed.street_type, 'allée');
  assert.equal(parsed.street, 'allée du Château');
  assert.equal(parsed.city, 'BORDEAUX');
});

test('handles an empty string', () => {
  assert.deepEqual(parse(''), Object.fromEntries(FIELDS.map((name) => [name, ''])));
});

test('normalisation and folding', () => {
  assert.equal(normalise('8 rue  des Lilas,\n75011 Paris'), '8 rue des Lilas 75011 Paris');
  assert.equal(fold('Av.'), 'av');
  // The trailing dot, and only that one: a leading dot is not an
  // abbreviation mark, and dropping it would make this snippet disagree
  // with its Python twin.
  assert.equal(fold('.av'), '.av');
});

test('keeps a cedex mention with the town', () => {
  // Losing it would send the letter to the wrong sorting office.
  assert.equal(parse('2 place des Tilleuls 31081 Toulouse Cedex 9').city, 'Toulouse Cedex 9');
});

test('breaking point: complements, foreign addresses and reversed order', () => {
  // The breaking point claimed on the entry, in its three shapes. A complement
  // has no anchor of its own, so it is swallowed by whichever field it touches.
  // A foreign address may still hand five digits to the anchor, or none at all.
  // And an address written town first turns the anchor upside down. In every
  // case the parser answers confidently and wrongly, which is worse than
  // answering nothing.

  // A complement after the street lands inside the street name.
  const swallowed = parse('8 rue des Lilas Bâtiment C Appartement 12, 75011 Paris');
  assert.equal(swallowed.street, 'rue des Lilas Bâtiment C Appartement 12');

  // A complement before the street takes the place of the house number.
  const hidden = parse('Appartement 12, Bâtiment C, 8 rue des Lilas, 75011 Paris');
  assert.equal(hidden.number, '');
  assert.ok(hidden.street.startsWith('Appartement 12'));

  // German: five digits, so the anchor fires, but the house number comes after
  // the street and the street type is inside the word.
  const german = parse('Hauptstrasse 5, 10115 Berlin');
  assert.equal(german.postcode, '10115');
  assert.equal(german.city, 'Berlin');
  assert.equal(german.number, '');
  assert.equal(german.street, 'Hauptstrasse 5');

  // British: no run of five digits at all, so nothing is anchored and the town
  // ends up inside the street.
  const british = parse('42 Rowan Street, Bristol BS1 4TQ');
  assert.equal(british.postcode, '');
  assert.equal(british.city, '');
  assert.equal(british.street, 'Rowan Street Bristol BS1 4TQ');

  // Town first: everything after the postcode is taken for the town.
  const reversedOrder = parse('75011 Paris, 8 rue des Lilas');
  assert.equal(reversedOrder.street, '');
  assert.equal(reversedOrder.city, 'Paris 8 rue des Lilas');
});
