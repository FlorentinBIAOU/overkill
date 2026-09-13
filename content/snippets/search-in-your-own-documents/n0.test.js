/**
 * The corpus is a small internal handbook, the kind every company has.
 *
 * These tests are the same ones as n0.test.py, on the same documents and the
 * same queries. They pass with the same rankings and the same scores, which is
 * how this file is kept honest: it claims to reproduce what SQLite's FTS5 does,
 * and the Python side of the snippet runs the real thing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, search, tokenise } from './n0.js';

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

const index = () => buildIndex(HANDBOOK);
const ids = (results) => results.map((result) => result.id);

test('finds the document that carries the words', () => {
  assert.deepEqual(search(index(), 'notes de frais'), [{ id: 'frais', score: 3.3722 }]);
});

test('a title match outranks two body matches', () => {
  // The handbook says "télétravail" twice in the body of the leave page, and
  // never in the body of the page whose title it is. The column weights are
  // what puts the right document first.
  assert.deepEqual(ids(search(index(), 'télétravail')), ['teletravail', 'conges']);
});

test('all the query terms must appear', () => {
  // FTS5 puts an implicit AND between terms. That is the behaviour you get by
  // default, and the reason a long question often returns nothing at all.
  assert.deepEqual(search(index(), 'accord responsable'), [{ id: 'teletravail', score: 1.0534 }]);
  assert.deepEqual(search(index(), 'congés responsable'), []);
});

test('accents and case do not matter', () => {
  assert.deepEqual(search(index(), 'CONGÉS'), [{ id: 'conges', score: 1.5938 }]);
  assert.deepEqual(search(index(), 'conges'), search(index(), 'CONGÉS'));
});

test('a word present in most documents adds nothing to the score', () => {
  // BM25 weighs a term by how rare it is. "le" is nearly everywhere, so it
  // separates nothing, and every document comes back with the same score.
  assert.deepEqual([...new Set(search(index(), 'le').map((r) => r.score))], [0]);
});

test('an empty query returns nothing instead of raising', () => {
  for (const query of ['', '   ', '!?', '""']) {
    assert.deepEqual(search(index(), query), []);
  }
});

test('a query full of MATCH syntax is searched, not executed', () => {
  // Unquoted, this comes out of the search box as a syntax error inside FTS5.
  // Quoting each token turns it back into a search for those words.
  assert.deepEqual(tokenise('congés" paie'), ['conges', 'paie']);
  assert.deepEqual(ids(search(index(), 'congés" paie')), ['conges']);
});

test('the limit is respected', () => {
  assert.equal(search(index(), 'le', 2).length, 2);
});

test('breaking point: a search by meaning', () => {
  // The breaking point claimed on the entry: the reader asks for the thing,
  // the document names it otherwise, and the index has nothing to match.
  //
  // The handbook answers both questions below. It says "congés payés" where
  // the reader says "vacances", and "télétravail" where the reader says
  // "depuis chez moi". No amount of ranking helps: the words are not in the
  // inverted index, so the documents are not even candidates.
  assert.deepEqual(search(index(), 'combien de vacances puis-je poser'), []);
  assert.deepEqual(search(index(), 'puis-je travailler depuis chez moi'), []);
  // The same two questions, asked in the words of the document, work.
  assert.deepEqual(ids(search(index(), 'congés')), ['conges']);
  assert.equal(ids(search(index(), 'télétravail'))[0], 'teletravail');
});
