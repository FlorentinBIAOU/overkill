/**
 * These tests inject a local double instead of calling a provider.
 *
 * What they prove: the record reaches the prompt, the temperature asked for is
 * the one sent, an oversized record is refused before a token is spent, a
 * failure is retried, an unusable answer raises instead of returning
 * something, and copy that claims an attribute the record does not carry is
 * refused.
 *
 * What they do not prove: that the model writes well, and that it writes the
 * same way tomorrow. That is why this snippet is declared `verification:
 * stubbed` on the entry, and why the page says so next to the code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeLLM } from '../_harness/fake-llm.mjs';
import { MAX_CHARACTERS, DescriptionUnavailable, UngroundedDescription, describe } from './n3.js';

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
  'garanti à vie',
];

const COPY =
  'Aurore 500 tient la journée de marche sans se rappeler à vous. Sa toile ' +
  'recyclée encaisse les ronces, et sa poche pour ordinateur rentre au bureau le lundi.';

const INVENTED =
  'Aurore 500 tient la journée de marche sans se rappeler à vous. Sa toile ' +
  'recyclée encaisse les ronces, et le sac est garanti à vie contre les défauts de couture.';

const answer = (description) => JSON.stringify({ description });

test('writes the copy the model returned', async () => {
  const client = new FakeLLM({ response: answer(COPY) });
  assert.equal(await describe(PRODUCT, client, { vocabulary: VOCABULARY }), COPY);
});

test('sends the attributes and the temperature asked for', async () => {
  const client = new FakeLLM({ response: answer(COPY) });
  await describe(PRODUCT, client, { temperature: 0.4 });
  const { prompt } = client.lastRequest;
  // Everything the copy may talk about has to be in the prompt.
  assert.ok(prompt.includes('- category : sac à dos'));
  assert.ok(prompt.includes('- material : toile recyclée'));
  assert.ok(prompt.includes('- features : poche pour ordinateur, sangle ventrale'));
  // Variety is what this rung is bought for, so the temperature is not zero by
  // default — and whatever the caller asked for is what is sent.
  assert.equal(client.lastRequest.temperature, 0.4);
});

test('collapses the line breaks a model leaves in its prose', async () => {
  const client = new FakeLLM({ response: answer(`  ${COPY}\n\n  `) });
  assert.equal(await describe(PRODUCT, client), COPY);
});

test('refuses an oversized record before spending anything', async () => {
  const client = new FakeLLM({ response: answer(COPY) });
  const oversized = { name: 'Aurore 500', features: ['détail interminable '.repeat(40)] };
  assert.ok(oversized.features[0].length > MAX_CHARACTERS);
  await assert.rejects(() => describe(oversized, client), RangeError);
  assert.equal(client.callCount, 0);
});

test('retries a provider failure', async () => {
  const client = new FakeLLM({ response: answer(COPY), failTimes: 2 });
  assert.equal(await describe(PRODUCT, client, { attempts: 3 }), COPY);
  assert.equal(client.callCount, 3);
});

test('an answer that is not JSON raises rather than being published', async () => {
  // The model can answer anything, including a polite preamble where JSON was
  // asked for. Publishing that on a product page is worse than an empty page.
  const client = new FakeLLM({ response: 'Bien sûr ! Voici une proposition de description :' });
  await assert.rejects(() => describe(PRODUCT, client, { attempts: 2 }), DescriptionUnavailable);
  assert.equal(client.callCount, 2);
});

test('JSON without a description raises too', async () => {
  const client = new FakeLLM({ response: JSON.stringify({ titre: 'Aurore 500' }) });
  await assert.rejects(() => describe(PRODUCT, client, { attempts: 1 }), DescriptionUnavailable);
});

test('a fragment is refused', async () => {
  const client = new FakeLLM({ response: answer('Un sac à dos.') });
  await assert.rejects(() => describe(PRODUCT, client), DescriptionUnavailable);
});

test('breaking point: the model promises what the shop does not sell', async () => {
  // The breaking point of this rung: fluency is not truthfulness.
  //
  // The copy below is better than anything the template rung can write. It is
  // also a commercial commitment the shop never made — the record says two
  // years, the sentence says for life — and it is written with exactly the same
  // confidence as the true sentence beside it. There is no wording, no
  // temperature and no instruction that removes this risk, because the model has
  // no way of telling an attribute of this product from an attribute that
  // belongs in a sentence of this shape.
  //
  // So the code checks. Every term of the catalogue vocabulary found in the copy
  // has to be found in the record too, or the description does not ship.
  await assert.rejects(
    () => describe(PRODUCT, new FakeLLM({ response: answer(INVENTED) }), { vocabulary: VOCABULARY }),
    (error) => error instanceof UngroundedDescription && error.message.includes('garanti à vie'),
  );

  // The check reads the record, not the wording: the same sentence goes through
  // for a product whose warranty really is unlimited.
  const forLife = { ...PRODUCT, warranty: 'garanti à vie' };
  assert.equal(
    await describe(forLife, new FakeLLM({ response: answer(INVENTED) }), { vocabulary: VOCABULARY }),
    INVENTED,
  );
});

test('the same product gets a different description at each run', async () => {
  // The other half of the bargain, and the reason the rung above exists.
  //
  // Two calls, two answers, both acceptable. That is what is being bought here,
  // and it is also what makes review impossible: nothing you approved yesterday
  // is what a customer reads today. The double stands in for the model, so what
  // this test shows is the shape of the problem, not its frequency.
  const first = await describe(PRODUCT, new FakeLLM({ response: answer(COPY) }), {
    vocabulary: VOCABULARY,
  });
  const secondCopy =
    'Aurore 500 part en week-end sans y penser. Sa toile recyclée passe la pluie ' +
    'et les ronces, et son ardoise discrète se fait oublier en réunion.';
  const second = await describe(PRODUCT, new FakeLLM({ response: answer(secondCopy) }), {
    vocabulary: VOCABULARY,
  });
  assert.notEqual(first, second);
});
