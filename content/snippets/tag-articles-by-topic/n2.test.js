/**
 * These tests inject a local double instead of loading a real encoder.
 *
 * What they prove: the topic descriptions are encoded once and not once per
 * article, the vectors are brought to length one, the cosine is computed and
 * sorted the way the snippet claims, the threshold cuts where it says it cuts,
 * and a topic added to the dictionary is usable immediately with no labelled
 * example.
 *
 * What they do not prove: that the model understands anything. The double is a
 * bag of words, so on the article this rung exists for — a topic treated
 * without ever being named — it says nothing at all. That is asserted below
 * rather than hidden, and it is why the entry declares this snippet `stubbed`.
 *
 * The double gives the same numbers in both languages, so the scores asserted
 * here are the ones asserted in n2.test.py.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeEncoder } from '../_harness/fake-model.mjs';
import { buildLabeller, score, tag } from './n2.js';

// A topic is a sentence, not a term list. Adding one is a one-line edit, which
// is the whole promise of this rung.
const TOPICS = {
  cybersécurité: 'La cybersécurité des entreprises : hameçonnage, rançongiciel et fuite de données.',
  fiscalité: 'La fiscalité des entreprises : impôt, TVA et déclaration fiscale.',
  recrutement: "Le recrutement des salariés : offre, candidature et entretien d'embauche.",
  télétravail: 'Le télétravail des salariés : travail à distance, bureau et domicile.',
};

// The real encoder of this snippet returns 384 numbers per text; the double is
// asked for the same width, so the test exercises the shape the snippet will
// actually meet.
const DIMENSIONS = 384;

// An article that is about one topic for four sentences, and mentions a second
// one in passing at the very end.
const LONG_ARTICLE =
  "La campagne d'hameçonnage imitait un message de la banque. " +
  'Les salariés ont reçu un courriel frauduleux les invitant à saisir leur ' +
  'identifiant sur un faux site. ' +
  "Le correctif publié la veille n'avait pas encore été installé partout, et " +
  'la fuite de données a touché plusieurs milliers de clients. ' +
  "L'entreprise a porté plainte, puis rappelé les règles internes. " +
  "Le service juridique précise au passage que l'amende éventuelle n'est pas " +
  "déductible de l'impôt.";

const makeLabeller = (topics = TOPICS) => buildLabeller(topics, new FakeEncoder(DIMENSIONS));

test('tags an article with the topic it is closest to', async () => {
  const article =
    "La campagne d'hameçonnage imitait un message de la banque, et la fuite de données a suivi.";
  const labeller = await makeLabeller();
  assert.deepEqual(await tag(labeller, article), ['cybersécurité']);
  const scored = await score(labeller, article);
  assert.equal(Number(scored['cybersécurité'].toFixed(4)), 0.5692);
});

test('an article carries several topics at once', async () => {
  const article =
    "Les indemnités de télétravail versées aux salariés sont soumises à la TVA et à l'impôt.";
  assert.deepEqual(await tag(await makeLabeller(), article), ['télétravail', 'fiscalité']);
});

test('the descriptions are encoded once, not once per article', async () => {
  // The point of building a labeller: the expensive call happens up front.
  const encoder = new FakeEncoder(DIMENSIONS);
  const labeller = await buildLabeller(TOPICS, encoder);
  assert.deepEqual(encoder.calls, [Object.values(TOPICS)]);
  await tag(labeller, 'un article');
  assert.deepEqual(encoder.calls[1], ['un article']);
});

test('an empty article scores zero everywhere', async () => {
  const labeller = await makeLabeller();
  assert.deepEqual(new Set(Object.values(await score(labeller, ''))), new Set([0]));
  assert.deepEqual(await tag(labeller, ''), []);
});

test('a new topic costs one line and no labelled example', async () => {
  // This is what the rung buys, and it is exactly the breaking point of N1:
  // there, a topic absent from the labelled corpus could never be answered.
  // Here the topic is added to the dictionary and the next article carries it.
  const article =
    'La région finance une partie du matériel acheté par les entreprises ' +
    "industrielles, via un guichet de subvention ouvert jusqu'en juin.";
  assert.deepEqual(await tag(await makeLabeller(), article), []);

  const extended = {
    ...TOPICS,
    subventions:
      'Les subventions publiques : la subvention de la région, le guichet ' +
      "d'aide et le financement du matériel.",
  };
  assert.deepEqual(await tag(await makeLabeller(extended), article), ['subventions']);
});

test('what the double cannot prove', async () => {
  // The article that defeats N0, and that N1 only caught because someone had
  // labelled a dozen like it: remote work never named.
  //
  // A real encoder is supposed to place it near the topic sentence. The double
  // is a bag of words, so it scores remote work exactly as high as computer
  // security and recruitment — that is, on « le », « la » and « de », not on
  // meaning. This test asserts the double's silence instead of implying a win
  // nobody measured.
  const article =
    "Depuis le printemps, l'équipe ne se retrouve au bureau que le mardi. " +
    "Le reste de la semaine, chacun s'organise depuis chez lui, et les " +
    'réunions se tiennent en visioconférence.';
  const labeller = await makeLabeller();
  const scored = await score(labeller, article);
  assert.equal(scored['télétravail'], scored['cybersécurité']);
  assert.equal(scored['télétravail'], scored.recrutement);
  assert.deepEqual(await tag(labeller, article), []);
});

test('breaking point: a cosine is not a probability', async () => {
  // The article above is four sentences of computer security and one line of
  // tax law, and the tax topic is real: an editor would file it under both.
  //
  // The cosine of the whole article against the tax sentence is dragged down
  // by everything else in the text, so the second topic falls under the
  // threshold. Lowering the threshold until it comes back also lets in remote
  // work, which the article never mentions.
  //
  // There is no threshold that separates them, because a cosine is not
  // calibrated: it has no meaning to compare across topics, and the only
  // honest way to pick one is to try it against articles someone has already
  // tagged by hand — a labelled corpus, the very thing this rung promised to
  // save.
  const labeller = await makeLabeller();
  assert.deepEqual(await tag(labeller, LONG_ARTICLE), ['cybersécurité']);
  assert.deepEqual(await tag(labeller, LONG_ARTICLE, 0.15), [
    'cybersécurité',
    'fiscalité',
    'télétravail',
  ]);
});
