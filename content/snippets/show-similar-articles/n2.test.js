/**
 * These tests inject a local double instead of loading a real encoder.
 *
 * What they prove: one string is built per article, the encoder is called
 * once with the whole corpus rather than once per article, the vectors that
 * come back become a correctly ordered neighbour table, a corpus too small to
 * hold a pair never reaches the model at all, and an encoder that fails or
 * answers the wrong shape throws instead of returning an empty table that
 * reads like "this article has no neighbours".
 *
 * What they do not prove: that a real encoder puts the right articles close
 * together — and in particular that it closes the gap N1 leaves, since the
 * double matches words, exactly like N1. That is why this snippet is declared
 * `verification: stubbed` on the entry, and why the page says so next to the
 * code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeEncoder } from '../_harness/fake-model.mjs';
import { EncodingFailed, articleText, buildNeighbourTable } from './n2.js';

// Short bodies, the length of a standfirst. The corpus lives here, not in the
// snippet, and the same corpus and table appear in n2.test.py.
const ARTICLES = [
  {
    id: 'sourdough-starter',
    title: 'Keeping a sourdough starter alive',
    body: 'Feeding flour and water to a sourdough starter, and reading its smell.',
  },
  {
    id: 'rye-bread',
    title: 'Baking a dense rye loaf',
    body: 'Rye flour, a sourdough starter, a long proof, a dense rye loaf.',
  },
  {
    id: 'kimchi-at-home',
    title: 'Kimchi in a jar at home',
    body: 'Salting cabbage, packing a jar, waiting for the ferment to turn sour.',
  },
  {
    id: 'pickled-cucumbers',
    title: 'Pickled cucumbers in brine',
    body: 'Cucumbers, dill and brine in a jar, left to ferment on the counter.',
  },
  {
    id: 'knife-sharpening',
    title: 'Sharpening a kitchen knife',
    body: 'Angle, whetstone and strokes: putting an edge back on a kitchen knife.',
  },
  {
    id: 'cast-iron-care',
    title: 'Caring for a cast iron pan',
    body: 'Oil, heat and seasoning: keeping rust off a cast iron pan.',
  },
];

// The two neighbours of every article, best first. Ties are broken by
// identifier, which is why knife-sharpening lists kimchi before rye.
const EXPECTED = {
  'sourdough-starter': [['rye-bread', 0.416], ['cast-iron-care', 0.28]],
  'rye-bread': [['sourdough-starter', 0.416], ['kimchi-at-home', 0.273]],
  'kimchi-at-home': [['pickled-cucumbers', 0.421], ['rye-bread', 0.273]],
  'pickled-cucumbers': [['kimchi-at-home', 0.421], ['sourdough-starter', 0.18]],
  'knife-sharpening': [['kimchi-at-home', 0.261], ['rye-bread', 0.261]],
  'cast-iron-care': [['sourdough-starter', 0.28], ['rye-bread', 0.256]],
};

// Everything else an editor might publish in a year, in one article.
const RAMBLING =
  ' The oven, the tin, the cooling rack, the knife, the board and the jar of jam all ' +
  'come into it, and so does the counter, the kitchen, the oil, the pan and the iron ' +
  'shelf above the hob.';

// Wide enough that two different words never land in the same dimension.
const encoder = () => new FakeEncoder(256);

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

test('the whole table is built at once', async () => {
  assert.deepEqual(await buildNeighbourTable(ARTICLES, { encoder: encoder(), k: 2 }), EXPECTED);
});

test('the corpus is encoded in one batched call', async () => {
  const fake = encoder();
  await buildNeighbourTable(ARTICLES, { encoder: fake });
  // One call holding every article, not one call per article. The difference
  // is the whole reason a batch exists.
  assert.deepEqual(fake.calls, [ARTICLES.map(articleText)]);
  assert.equal(fake.calls.length, 1);
});

test('a corpus too small to hold a pair never reaches the model', async () => {
  const fake = encoder();
  const table = await buildNeighbourTable([ARTICLES[0]], { encoder: fake });
  assert.deepEqual(table, { 'sourdough-starter': [] });
  assert.deepEqual(fake.calls, []);
});

test('k caps the length of each row', async () => {
  const table = await buildNeighbourTable(ARTICLES, { encoder: encoder(), k: 1 });
  assert.deepEqual(table['sourdough-starter'], [['rye-bread', 0.416]]);
});

test('a model that cannot run throws', async () => {
  await assert.rejects(
    () => buildNeighbourTable(ARTICLES, { encoder: brokenEncoder }),
    EncodingFailed,
  );
});

test('a truncated batch throws rather than shifting every neighbour', async () => {
  // A missing vector would silently pair each article with the wrong one.
  await assert.rejects(
    () => buildNeighbourTable(ARTICLES, { encoder: new TruncatedEncoder(256) }),
    EncodingFailed,
  );
});

test('limit of this rung: one vector per article dilutes a long one', async () => {
  // The breaking point the entry claims for this rung, and the wall it hits in
  // production.
  //
  // An article gets one vector however long it is, so a piece that covers
  // eight subjects has each of them at one eighth strength. Adding a rambling
  // paragraph to the rye loaf article is enough to cost it its rightful first
  // neighbour, and to hand that place to an article about frying pans.
  //
  // The double exaggerates the size of the effect, being a bag of words. The
  // mechanism is the real one, and it is why serious pipelines cut long
  // articles into passages and index the passages, which is more machinery
  // again on top of a rung that already costs a model to host.
  const diluted = ARTICLES.map((article) => ({ ...article }));
  diluted[1].body += RAMBLING;

  const before = await buildNeighbourTable(ARTICLES, { encoder: encoder(), k: 2 });
  const after = await buildNeighbourTable(diluted, { encoder: encoder(), k: 2 });

  assert.equal(before['sourdough-starter'][0][0], 'rye-bread');
  assert.equal(after['sourdough-starter'][0][0], 'cast-iron-care');
  // The long article loses its own best neighbour too.
  assert.equal(after['rye-bread'][0][0], 'kimchi-at-home');
});
