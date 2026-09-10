/**
 * These tests inject a local double instead of loading the real model.
 *
 * What they prove: the batch is sent in one call, the scores are decoded into
 * the right decision, the thresholds are honoured, and an answer the caller
 * cannot act on sends the comment to a human rather than publishing it.
 *
 * What they do not prove: that the model scores comments well. That is why
 * this snippet is declared `verification: stubbed` on the entry, and why the
 * page says so next to the code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeClassifier } from '../_harness/fake-model.mjs';
import { ModerationUnavailable, moderate } from './n2.js';

const ATTACK = 'get off this forum you blorptard';
const BORDERLINE = 'that was a spectacularly bad take, honestly';
const CALM = 'the diagram is much clearer than the text';

// The labels are the ones a toxicity model actually exposes; the scores are
// ours, so the test exercises our thresholds and not the model's opinions.
const SCORES = {
  [ATTACK]: { toxicity: 0.96, insult: 0.91, threat: 0.04 },
  [BORDERLINE]: { toxicity: 0.71, insult: 0.35, threat: 0.01 },
  [CALM]: { toxicity: 0.02, insult: 0.01, threat: 0 },
};

test('routes each comment to its decision', async () => {
  const classifier = new FakeClassifier(SCORES);
  const decisions = await moderate([ATTACK, BORDERLINE, CALM], classifier);
  assert.deepEqual(decisions.map((d) => d.action), ['block', 'review', 'allow']);
});

test('keeps the strongest label so a reviewer knows why', async () => {
  const classifier = new FakeClassifier(SCORES);
  const [decision] = await moderate([ATTACK], classifier);
  assert.equal(decision.label, 'toxicity');
  assert.equal(decision.score, 0.96);
});

test('sends the whole batch in one call', async () => {
  const classifier = new FakeClassifier(SCORES);
  await moderate([ATTACK, BORDERLINE, CALM], classifier);
  assert.deepEqual(classifier.calls, [[ATTACK, BORDERLINE, CALM]]);
});

test('thresholds are the caller to set', async () => {
  const classifier = new FakeClassifier(SCORES);
  const [strict] = await moderate([BORDERLINE], classifier, { block: 0.7, review: 0.3 });
  const [lenient] = await moderate([BORDERLINE], classifier, { block: 0.99, review: 0.95 });
  assert.equal(strict.action, 'block');
  assert.equal(lenient.action, 'allow');
});

test('an unusable row goes to a human rather than through', async () => {
  // An empty mapping, and a score that is not a number: two shapes of the same
  // failure. Neither may end in "allow".
  const classifier = new FakeClassifier({ [ATTACK]: {}, [BORDERLINE]: { toxicity: 'very' } });
  const decisions = await moderate([ATTACK, BORDERLINE], classifier);
  assert.deepEqual(decisions.map((d) => d.action), ['review', 'review']);
  assert.equal(decisions[0].score, null);
});

test('a short answer throws rather than misaligning the comments', async () => {
  const truncating = { predict: async () => [{ toxicity: 0.99 }] };
  await assert.rejects(() => moderate([ATTACK, CALM], truncating), ModerationUnavailable);
});

test('an empty batch never reaches the model', async () => {
  const classifier = new FakeClassifier(SCORES);
  assert.deepEqual(await moderate([], classifier), []);
});

test('breaking point: the label list is the policy you get', async () => {
  // You inherit someone else's taxonomy. The model scores toxicity, insult and
  // threat. A comment that publishes someone's home address, or that quietly
  // organises a pile-on, is not any of those, so it scores low everywhere and
  // is allowed. Nothing in the code is wrong; the harm simply has no label.
  //
  // Widening the policy here means fine-tuning and a labelled corpus of your
  // own, which is the cost N2 is usually assumed not to have.
  const doxxing = 'he lives at the corner of rue des Lilas by the way, go and say hello';
  const classifier = new FakeClassifier({ [doxxing]: { toxicity: 0.08, insult: 0.03, threat: 0.06 } });
  const [decision] = await moderate([doxxing], classifier);
  assert.equal(decision.action, 'allow');
});
