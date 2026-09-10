/**
 * The same handbook as n0, so the two rungs can be compared on the same corpus.
 *
 * Every number asserted here is asserted identically in n1.test.py. The two
 * implementations rank the same documents in the same order with the same
 * scores, which is the only way to claim, as the entry does, that this is one
 * algorithm rather than two.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, search, tokenise } from './n1.js';

const HANDBOOK = [
  {
    id: 'conges',
    title: 'Congés payés',
    body: 'Le salarié acquiert deux jours et demi de congés payés par mois travaillé. '
      + 'Le solde figure sur le bulletin de paie. Le télétravail ne change rien à ce '
      + 'calcul, et une journée de télétravail reste une journée travaillée.',
  },
  {
    id: 'teletravail',
    title: 'Télétravail',
    body: 'Deux jours par semaine sont ouverts, après accord écrit du responsable.',
  },
  {
    id: 'frais',
    title: 'Notes de frais',
    body: 'Les notes de frais se déposent avant le cinq du mois. Le remboursement suit '
      + 'la paie du mois suivant.',
  },
  {
    id: 'materiel',
    title: 'Matériel informatique',
    body: 'Le poste de travail est renouvelé tous les quatre ans. La demande passe par '
      + 'le responsable.',
  },
];

const INDEX = buildIndex(HANDBOOK);
const ids = (results) => results.map((result) => result.id);

test('finds and scores the right document', () => {
  assert.deepEqual(search(INDEX, 'congés payés'), [
    { id: 'conges', score: 3.6746, terms: { conges: 1.8373, payes: 1.8373 } },
  ]);
});

test('one term is enough where N0 wanted them all', () => {
  // The query that returned nothing at N0, because FTS5 demands every term,
  // returns three documents here, ranked. Same corpus, different rule.
  assert.deepEqual(ids(search(INDEX, 'congés responsable')), ['conges', 'teletravail', 'materiel']);
});

test('a title match outranks two body matches', () => {
  assert.deepEqual(ids(search(INDEX, 'télétravail')), ['teletravail', 'conges']);
});

test('the score is the sum of what each term contributed', () => {
  const result = search(INDEX, 'paie du mois')[0];
  assert.equal(result.id, 'frais');
  // Both sides are rounded for display, so they agree to the displayed digit.
  const sum = Object.values(result.terms).reduce((total, share) => total + share, 0);
  assert.ok(Math.abs(sum - result.score) < 0.001);
});

test('a rare term weighs more than a common one', () => {
  // "congés" is in one document, "le" in three. Both are matches; only one
  // tells you anything.
  const { terms } = search(INDEX, 'congés le')[0];
  assert.ok(terms.conges > terms.le);
});

test('length normalisation is a dial, not a law', () => {
  // b = 0 stops correcting for document length: the long page stops paying for
  // its size, and its score rises.
  assert.equal(search(INDEX, 'paie du mois')[1].score, 1.1024);
  assert.deepEqual(search(INDEX, 'paie du mois', { b: 0 })[1], {
    id: 'conges', score: 1.3863, terms: { paie: 0.6931, mois: 0.6931 },
  });
  // Far enough to change the order: at b = 0 these two tie, and the tie-break
  // on the identifier decides. Ranking must be reproducible before it is good.
  assert.deepEqual(ids(search(INDEX, 'jours')), ['teletravail', 'conges']);
  assert.deepEqual(ids(search(INDEX, 'jours', { b: 0 })), ['conges', 'teletravail']);
});

test('a word typed twice is not twice as important', () => {
  assert.deepEqual(search(INDEX, 'congés congés'), search(INDEX, 'congés'));
});

test('accents and case do not matter', () => {
  assert.deepEqual(search(INDEX, 'CONGÉS'), search(INDEX, 'conges'));
  assert.deepEqual(tokenise('Notes de frais !'), ['notes', 'de', 'frais']);
});

test('an empty query returns nothing', () => {
  for (const query of ['', '   ', '!?']) {
    assert.deepEqual(search(INDEX, query), []);
  }
});

test('the limit is respected', () => {
  assert.equal(search(INDEX, 'le', { limit: 2 }).length, 2);
});

test('breaking point: the tokenizer is now your problem', () => {
  // Writing the index yourself does not close the gap N0 showed; it hands you
  // the gap. A reader asking for "vacances" still finds nothing, and now the
  // singular of a word the handbook writes in the plural finds nothing either,
  // because nothing in these forty lines knows French morphology.
  //
  // Stemming, elision, synonyms, stop words: each is a rule you write, test
  // and maintain, for the language of every document you hold.
  assert.deepEqual(search(INDEX, 'vacances'), []);
  assert.deepEqual(search(INDEX, 'congé'), []);
  assert.deepEqual(ids(search(INDEX, 'congés')), ['conges']);
});
