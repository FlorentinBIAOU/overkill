/**
 * These tests inject a local double instead of loading the checkpoint.
 *
 * What they prove: the record reaches the model in the shape it was fine-tuned
 * on, an oversized record is refused before anything is generated, a failed
 * call is retried, a half-finished sentence is never published, and copy that
 * claims an attribute the record does not carry is refused.
 *
 * What they do not prove: that the model writes well. Nothing in a test can
 * prove that, which is why this snippet is declared `verification: stubbed` on
 * the entry, and why the page says so next to the code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeSeq2Seq } from '../_harness/fake-model.mjs';
import { MAX_CHARACTERS, DescriptionUnavailable, UngroundedDescription, describe } from './n2.js';

// An invented product: no existing brand, no existing catalogue.
const PRODUCT = {
  name: 'Aurore 500',
  category: 'sac à dos',
  material: 'toile recyclée',
  audience: 'les randonneurs',
  features: ['poche pour ordinateur', 'sangle ventrale'],
  colours: ['ardoise', 'sable'],
  warranty: 'deux ans',
};

// The words the shop's catalogue uses, gathered from the attribute values of
// every product on the shelf. The grounding check is exactly as good as this
// list: a claim it does not contain is a claim nobody is watching.
const VOCABULARY = [
  'toile recyclée',
  'cuir pleine fleur',
  'étanche',
  'poche pour ordinateur',
  'sangle ventrale',
  'garanti à vie',
];

const COPY =
  'Aurore 500 accompagne les randonneurs à la journée. Sa toile recyclée ' +
  'encaisse les ronces, et sa sangle ventrale reporte la charge sur les hanches.';

const INVENTED =
  'Aurore 500 suit les randonneurs par tous les temps. Sa toile recyclée ' +
  'est entièrement étanche, et sa sangle ventrale reporte la charge.';

test('writes the copy the model returned', async () => {
  const model = new FakeSeq2Seq({}, COPY);
  assert.equal(await describe(PRODUCT, model, { vocabulary: VOCABULARY }), COPY);
});

test('sends the product attributes to the model', async () => {
  const model = new FakeSeq2Seq({}, COPY);
  await describe(PRODUCT, model);
  const source = model.calls[0];
  // Everything the copy may talk about has to be in the source line, in the
  // « field: value » shape the fine-tuning used.
  assert.ok(source.includes('category: sac à dos'));
  assert.ok(source.includes('material: toile recyclée'));
  assert.ok(source.includes('features: poche pour ordinateur, sangle ventrale'));
  assert.ok(!source.includes('\n'));
});

test('keeps only the sentences the model finished', async () => {
  // A small model stops when its token budget runs out, mid-word.
  const model = new FakeSeq2Seq({}, 'Aurore 500 accompagne les randonneurs à la journée. Sa toile recy');
  assert.equal(await describe(PRODUCT, model), 'Aurore 500 accompagne les randonneurs à la journée.');
});

test('a fragment is refused rather than published', async () => {
  await assert.rejects(
    () => describe(PRODUCT, new FakeSeq2Seq({}, 'Aurore 500.')),
    DescriptionUnavailable,
  );
  // And an answer with no finished sentence at all is a fragment too.
  await assert.rejects(
    () => describe(PRODUCT, new FakeSeq2Seq({}, 'un sac à dos solide et bien pensé pour la journée')),
    DescriptionUnavailable,
  );
});

test('refuses an oversized record before generating anything', async () => {
  const model = new FakeSeq2Seq({}, COPY);
  const oversized = { name: 'Aurore 500', features: ['détail interminable '.repeat(40)] };
  assert.ok(oversized.features[0].length > MAX_CHARACTERS);
  await assert.rejects(() => describe(oversized, model), RangeError);
  assert.equal(model.calls.length, 0);
});

test('retries a failed call', async () => {
  /** Loading the weights into memory is the call that fails, and once. */
  class FailingOnce {
    constructor() {
      this.calls = 0;
    }

    async generate() {
      this.calls += 1;
      if (this.calls === 1) throw new Error('checkpoint not loaded');
      return COPY;
    }
  }

  const model = new FailingOnce();
  assert.equal(await describe(PRODUCT, model, { attempts: 2 }), COPY);
  assert.equal(model.calls, 2);
});

test('a lasting failure raises rather than returning nothing', async () => {
  const model = {
    async generate() {
      throw new Error('checkpoint not loaded');
    },
  };
  await assert.rejects(() => describe(PRODUCT, model), DescriptionUnavailable);
});

test('breaking point: the model claims what the product does not have', async () => {
  // The breaking point of this rung, and the reason the check exists.
  //
  // The copy below is well written, in the shop's voice, and grammatical. It
  // also says the bag is waterproof. Nothing in the record says so: the model
  // wrote « étanche » because thousands of bag descriptions end that way. On a
  // shelf, that sentence is a claim the shop has to honour.
  //
  // The double is what makes this demonstrable at all — a real model invents on
  // its own schedule, which is precisely the problem. What the test proves is
  // that when it does, the code refuses instead of publishing.
  await assert.rejects(
    () => describe(PRODUCT, new FakeSeq2Seq({}, INVENTED), { vocabulary: VOCABULARY }),
    (error) => error instanceof UngroundedDescription && error.message.includes('étanche'),
  );

  // The same sentence, for a product whose record does carry the claim, goes
  // through: the check reads the record, not the wording.
  const waterproof = { ...PRODUCT, features: [...PRODUCT.features, 'étanche'] };
  assert.equal(
    await describe(waterproof, new FakeSeq2Seq({}, INVENTED), { vocabulary: VOCABULARY }),
    INVENTED,
  );
});

test('an empty vocabulary checks nothing, and says so by letting it pass', async () => {
  // The default is not a safe default. It is the caller's decision, and this
  // test is here so that nobody discovers it in production.
  assert.equal(await describe(PRODUCT, new FakeSeq2Seq({}, INVENTED)), INVENTED);
});
