import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lemmatise, normalise, stems, tag } from './n0.js';

// The controlled vocabulary of a small editorial team: four topics, and the
// terms an editor would list for each. It lives here, in the test, because it
// belongs to the newsroom rather than to the code.
const VOCABULARY = {
  cybersécurité: ['cybersécurité', 'rançongiciel', 'hameçonnage', 'mot de passe'],
  fiscalité: ['fiscalité', 'impôt', 'TVA', "crédit d'impôt", 'déclaration fiscale'],
  recrutement: ['recrutement', 'embauche', 'candidat', "entretien d'embauche"],
  télétravail: ['télétravail', 'travail à distance', 'distanciel'],
};

test('tags an article with the topic it names', () => {
  const article = "La campagne d'hameçonnage imitait un message de la banque.";
  assert.deepEqual(tag(article, VOCABULARY), ['cybersécurité']);
});

test('an article carries several topics at once', () => {
  const article =
    'La loi de finances précise le régime de TVA applicable aux indemnités ' +
    "de télétravail, et prolonge le crédit d'impôt recherche.";
  assert.deepEqual(tag(article, VOCABULARY), ['fiscalité', 'télétravail']);
});

test('an article about nothing in the vocabulary carries no topic', () => {
  assert.deepEqual(tag('Le restaurant du coin a changé de carte.', VOCABULARY), []);
  assert.deepEqual(tag('', VOCABULARY), []);
});

test('case, accents and plurals cost nothing', () => {
  // The same sentence four ways: each spelling has to reach the same stem.
  for (const article of [
    'les impôts et la TVA',
    'LES IMPÔTS ET LA TVA',
    "l'impôt et la tva",
    'les impots et la tva',
  ]) {
    assert.deepEqual(tag(article, VOCABULARY), ['fiscalité'], article);
  }
});

test('a multi-word term matches across the plural of both words', () => {
  assert.deepEqual(tag('changez vos mots de passe', VOCABULARY), ['cybersécurité']);
  assert.equal(lemmatise('mots'), 'mot');
  assert.equal(normalise('Hameçonnage'), 'hameconnage');
});

test('a stem never matches inside a longer word', () => {
  // "impôt" must not be found inside "impotent". Padding the stems with
  // spaces is what buys that.
  assert.deepEqual(tag('un vieillard impotent', VOCABULARY), []);
  assert.equal(stems('impôts'), ' impot ');
});

test('minTerms asks for more than one passing mention', () => {
  const article = 'Le candidat a signé hier.';
  assert.deepEqual(tag(article, VOCABULARY), ['recrutement']);
  assert.deepEqual(tag(article, VOCABULARY, 2), []);
});

test('the best supported topic comes first', () => {
  const article =
    "Après l'entretien d'embauche, le candidat a demandé si le télétravail " +
    'était possible ; le recrutement est signé.';
  assert.deepEqual(tag(article, VOCABULARY), ['recrutement', 'télétravail']);
});

test('breaking point: a topic treated without ever being named', () => {
  // This article is about remote work from its first line to its last, and it
  // never uses a single term of the topic's vocabulary. A controlled
  // vocabulary sees words, not subjects. The only repair is to keep adding
  // terms, one missed article at a time, for ever — which is the honest
  // description of what maintaining this rung costs.
  const article =
    "Depuis le printemps, l'équipe ne se retrouve au bureau que le mardi. " +
    "Le reste de la semaine, chacun s'organise depuis chez lui, et les " +
    'réunions se tiennent en visioconférence.';
  assert.deepEqual(tag(article, VOCABULARY), []);
});
