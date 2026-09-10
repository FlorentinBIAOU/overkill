/**
 * These tests inject a local double instead of loading a real encoder.
 *
 * What they prove: the whole corpus and the query go to the model in one
 * batched call, an encoder that fails or returns the wrong number of vectors
 * throws instead of quietly losing documents, the two rankings are fused in
 * the declared order, and the fusion is deterministic down to its tie-breaks.
 * The scores asserted here are the ones asserted in n2.test.py: the harness
 * hashes words identically in both languages, so both sides must agree.
 *
 * What they do not prove: that a real encoder puts "vacances" next to "congés
 * payés". That is the whole promise of this rung, it is the one thing a double
 * cannot stand in for, and it is why the entry declares this snippet
 * `verification: stubbed`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeEncoder } from '../_harness/fake-model.mjs';
import { EncodingFailed, hybridSearch, vectorRanking } from './n2.js';

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

// Wide enough that two words of this corpus almost never share a dimension.
const encoder = () => new FakeEncoder(1024);

/**
 * Stands in for the one thing a real encoder brings: knowing that two words
 * are used in the same places.
 *
 * The double is a bag of words, so the synonym is spelled out here rather than
 * learnt from a corpus. Injecting it exercises the fusion; it says nothing
 * about whether a real model would make the same connection.
 */
class SynonymEncoder extends FakeEncoder {
  static SYNONYMS = { maison: 'télétravail' };

  async encode(texts) {
    const expanded = texts.map((text) => text.split(' ')
      .map((word) => SynonymEncoder.SYNONYMS[word.toLowerCase()] ?? word).join(' '));
    return super.encode(expanded);
  }
}

/** A model that silently drops the last item of a batch. */
class TruncatedEncoder extends FakeEncoder {
  async encode(texts) {
    return (await super.encode(texts)).slice(0, -1);
  }
}

/** A model that cannot be run at all. */
const brokenEncoder = {
  encode: async () => {
    throw new Error('out of memory while loading the model');
  },
};

const ids = (results) => results.map((result) => result.id);

test('a document both legs rank first wins', async () => {
  // The full-text search returned ["frais"]; the vector leg agrees.
  assert.deepEqual(await hybridSearch('notes de frais', HANDBOOK, ['frais'], { encoder: encoder() }), [
    { id: 'frais', score: 0.032787 },
    { id: 'conges', score: 0.016129 },
    { id: 'materiel', score: 0.015873 },
    { id: 'teletravail', score: 0.015625 },
  ]);
});

test('the corpus and the query go out in one call', async () => {
  const fake = encoder();
  await hybridSearch('notes de frais', HANDBOOK, [], { encoder: fake });
  const texts = HANDBOOK.map((d) => `${d.title} ${d.body}`);
  assert.deepEqual(fake.calls, [[...texts, 'notes de frais']]);
});

test('an empty corpus never reaches the model', async () => {
  const fake = encoder();
  assert.deepEqual(await hybridSearch('notes de frais', [], [], { encoder: fake }), []);
  assert.deepEqual(fake.calls, []);
});

test('k says how much being first is worth', async () => {
  // k is the flatness of the vote. At k = 0 the first place of a list is worth
  // a whole point and the second half a point.
  const found = await hybridSearch('notes de frais', HANDBOOK, ['frais'], { encoder: encoder(), k: 0 });
  assert.deepEqual(found[0], { id: 'frais', score: 2 });
});

test('the limit is respected', async () => {
  const found = await hybridSearch('frais', HANDBOOK, ['frais'], { encoder: encoder(), limit: 2 });
  assert.equal(found.length, 2);
});

test('a truncated batch throws rather than losing a document', async () => {
  const truncated = new TruncatedEncoder(1024);
  await assert.rejects(() => hybridSearch('frais', HANDBOOK, [], { encoder: truncated }), EncodingFailed);
});

test('a model that cannot run throws', async () => {
  await assert.rejects(() => hybridSearch('frais', HANDBOOK, [], { encoder: brokenEncoder }), EncodingFailed);
});

test('the vector leg finds what the words could not', async () => {
  // The gap N0 could not close, closed by the second leg. "maison" appears in
  // no document, so the full-text search returns nothing at all. With an
  // encoder that connects it to "télétravail", the two pages that speak of
  // working from home come out on top, where they were last.
  const question = 'puis-je rester à la maison';
  assert.equal((await vectorRanking(question, HANDBOOK, encoder())).at(-1), 'teletravail');
  const found = await hybridSearch(question, HANDBOOK, [], { encoder: new SynonymEncoder(1024) });
  assert.deepEqual(ids(found).slice(0, 2), ['conges', 'teletravail']);
});

test('breaking point: the vector leg always has an answer', async () => {
  // Cosine similarity is defined for every pair of texts, so a vector search
  // always returns a full ranking. There is no such thing as "no match".
  //
  // Below, the handbook says nothing about the colour of the walls. The
  // full-text leg answers honestly, with nothing. The vector leg ranks all
  // four pages anyway, and the fusion presents an unrelated one first.
  // Anything downstream — a rung N3 answer, a "did you mean" — will treat it
  // as the best document there is, unless you set a floor and enforce it.
  const keywordIds = []; // what N0 returns for this question
  const found = await hybridSearch('quelle est la couleur des murs du bureau', HANDBOOK,
    keywordIds, { encoder: encoder() });
  assert.equal(found.length, 4);
  assert.equal(found[0].id, 'frais');
});
