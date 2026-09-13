/**
 * These tests inject a local double instead of loading a model.
 *
 * What they prove: the document is cut into pieces the model can read, at
 * sentence boundaries, with nothing lost between them; the two passes are
 * wired together correctly; oversized input is refused before any work is
 * done; a failed call is retried; and an empty answer throws rather than
 * leaving a silent hole in the middle of the summary.
 *
 * What they do not prove: that the model writes a good summary, or a true one.
 * The last test below shows exactly how far that goes. This snippet is
 * declared `verification: stubbed` on the entry, and the page says so next to
 * the code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeSeq2Seq } from '../_harness/fake-model.mjs';
import { MAX_CHARACTERS, SummaryUnavailable, chunk, summarise } from './n2.js';

const REPORT = [
  'The support team migrated the ticketing system to a new platform in March.',
  'Every agent was trained during the two weeks before the switch.',
  'The old platform stayed available in read-only mode for a month afterwards.',
].join(' ');

// Long enough to need several passes of the model.
const LONG = Array.from(
  { length: 120 },
  (_, i) => `Paragraph ${i} describes another part of the warehouse.`,
).join(' ');

/** The harness double, with its first calls failing, as a real one does. */
class FlakySeq2Seq extends FakeSeq2Seq {
  constructor(outputs, failTimes, defaultOutput = '') {
    super(outputs, defaultOutput);
    this.failTimes = failTimes;
  }

  async generate(text) {
    if (this.failTimes > 0) {
      this.failTimes -= 1;
      this.calls.push(text);
      throw new Error('simulated model failure');
    }
    return super.generate(text);
  }
}

test('returns what the model wrote', async () => {
  const model = new FakeSeq2Seq({ [REPORT]: 'The ticketing system was migrated in March.' });
  assert.equal(await summarise(REPORT, { model }), 'The ticketing system was migrated in March.');
});

test('a short document is sent in one piece', async () => {
  const model = new FakeSeq2Seq({}, 'a summary');
  await summarise(REPORT, { model });
  assert.deepEqual(model.calls, [REPORT]);
});

test('chunks are cut at sentence boundaries and lose nothing', () => {
  const pieces = chunk(LONG, 400);
  assert.ok(pieces.length > 1);
  for (const piece of pieces) {
    assert.ok(piece.length <= 400);
    assert.ok(piece.endsWith('.'));
  }
  assert.equal(pieces.join(' '), LONG);
});

test('a sentence longer than the window is passed whole', () => {
  // Documented behaviour: cutting mid-clause would be worse.
  const oneLongSentence = `${new Array(200).fill('word').join(' ')}.`;
  assert.deepEqual(chunk(oneLongSentence, 100), [oneLongSentence]);
});

test('a long document is summarised in two passes', async () => {
  const pieces = chunk(LONG);
  const notes = Object.fromEntries(pieces.map((p, i) => [p, `note about part ${i}`]));
  const secondPass = pieces.map((p) => notes[p]).join(' ');
  const model = new FakeSeq2Seq({ ...notes, [secondPass]: 'the whole warehouse, in one line' });

  assert.equal(await summarise(LONG, { model }), 'the whole warehouse, in one line');
  // One call per piece, then one on the notes the model itself wrote.
  assert.deepEqual(model.calls, [...pieces, secondPass]);
});

test('an empty document costs nothing', async () => {
  const model = new FakeSeq2Seq({}, 'a summary');
  assert.equal(await summarise('', { model }), '');
  assert.equal(await summarise('   \n  ', { model }), '');
  assert.deepEqual(model.calls, []);
});

test('a single-sentence document still goes through the model', async () => {
  const model = new FakeSeq2Seq({}, 'rewritten');
  assert.equal(await summarise('The plant will close.', { model }), 'rewritten');
});

test('refuses an oversized document before doing any work', async () => {
  const model = new FakeSeq2Seq({}, 'a summary');
  await assert.rejects(() => summarise('x'.repeat(MAX_CHARACTERS + 1), { model }), RangeError);
  assert.deepEqual(model.calls, []);
});

test('retries a failed call', async () => {
  const model = new FlakySeq2Seq({ [REPORT]: 'a summary' }, 1);
  assert.equal(await summarise(REPORT, { model, attempts: 2 }), 'a summary');
  assert.equal(model.calls.length, 2);
});

test('gives up when every attempt fails', async () => {
  const model = new FlakySeq2Seq({ [REPORT]: 'a summary' }, 5);
  await assert.rejects(() => summarise(REPORT, { model, attempts: 3 }), SummaryUnavailable);
  assert.equal(model.calls.length, 3);
});

test('an empty answer throws rather than leaving a hole', async () => {
  // Returning the empty string would put a gap in the middle of a multi-pass
  // summary that nobody would ever notice.
  const model = new FakeSeq2Seq({}, '   ');
  await assert.rejects(() => summarise(REPORT, { model }), SummaryUnavailable);
});

test('breaking point: the model writes what the document does not say', async () => {
  // The risk this rung buys, and the one nothing in n2.js catches.
  //
  // An abstractive model writes new sentences. That is exactly why it can
  // state a conclusion drawn from two passages ten pages apart, which N0 and
  // N1 cannot. It is also why it can state one the document does not support.
  //
  // Below, the double is told to answer each of two summaries of the same
  // document. One follows from it, the other is invented: neither April nor a
  // move to Rouen appears anywhere in the source. The function returns both,
  // identically, without a warning, because the only thing it can check about
  // an answer is that it is not empty. Checking that a summary is entailed by
  // its source is a different problem, and no amount of plumbing here solves
  // it. What this test shows is what the plumbing lets through, not what a
  // real model writes.
  const document = [
    'The Rouen plant supplies every battery cell used on the Lyon assembly line.',
    'The Rouen plant will close at the end of March.',
  ].join(' ');
  const supported = 'The Lyon assembly line will stop when Rouen closes at the end of March.';
  const invented = 'The Lyon assembly line will move to Rouen in April.';

  assert.equal(await summarise(document, { model: new FakeSeq2Seq({}, supported) }), supported);
  assert.equal(await summarise(document, { model: new FakeSeq2Seq({}, invented) }), invented);

  assert.ok(!document.includes('April'));
  assert.ok(!document.includes(invented));
});
