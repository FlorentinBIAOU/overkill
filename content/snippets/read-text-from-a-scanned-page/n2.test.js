/**
 * These tests inject a local double instead of running a real engine.
 *
 * What they prove: the engine is called with the page it was given, the
 * reading is decoded and cleaned, a low confidence sends the page to a human
 * without losing the text, a failed call is retried, and an answer that is not
 * a reading never passes for one.
 *
 * What they do not prove: that the engine reads the pixels correctly. That is
 * why this snippet is declared `verification: stubbed` on the entry, and why
 * the page says so next to the code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeOCR } from '../_harness/fake-model.mjs';
import { OCRUnavailable, clean, readPage } from './n2.js';

const PAGE = 'scan-page-1.png';

// What an engine gives back on a clean office scan: the text, with the ragged
// spacing of a page that was photographed rather than typeset.
const READING =
  'NORD FOURNITURES SAS\n' +
  '   N° 2024-000431\n' +
  '\n' +
  '   Émise le 3 avril 2024\n' +
  'NET A PAYER    92,40 EUR\n';

/** An engine that drops a call, the way a busy worker process does. */
class FlakyEngine {
  constructor(engine, failures = 1) {
    this.engine = engine;
    this.failures = failures;
  }

  async read(imagePath) {
    if (this.failures > 0) {
      this.failures -= 1;
      throw new Error('the worker was not ready');
    }
    return this.engine.read(imagePath);
  }
}

test('reads the page', async () => {
  const result = await readPage(PAGE, new FakeOCR({ [PAGE]: READING }, 0.94));
  assert.deepEqual(result.text.split('\n'), [
    'NORD FOURNITURES SAS',
    'N° 2024-000431',
    'Émise le 3 avril 2024',
    'NET A PAYER 92,40 EUR',
  ]);
  assert.equal(result.confidence, 0.94);
  assert.equal(result.review, false);
});

test('hands the engine the page it was given', async () => {
  const engine = new FakeOCR({ [PAGE]: READING });
  await readPage(PAGE, engine);
  assert.deepEqual(engine.calls, [PAGE]);
});

test('rejoins a word the scan cut in two', async () => {
  // A word broken at the end of a line comes back with its hyphen. Left
  // alone, « exemplaire » is two tokens no search will ever match.
  const engine = new FakeOCR({ [PAGE]: 'un second exem-\nplaire de la facture' });
  assert.equal((await readPage(PAGE, engine)).text, 'un second exemplaire de la facture');
});

test('a low confidence keeps the text and asks for a human', async () => {
  // A faint fax, read badly but not uselessly. The text is still the best
  // thing anyone has; what changes is that nobody files it unread.
  const result = await readPage(PAGE, new FakeOCR({ [PAGE]: READING }, 0.41));
  assert.ok(result.text.includes('NORD FOURNITURES SAS'));
  assert.equal(result.confidence, 0.41);
  assert.equal(result.review, true);
});

test('a blank page is flagged however sure the engine is', async () => {
  const result = await readPage(PAGE, new FakeOCR({}, 0.99));
  assert.deepEqual(result, { text: '', confidence: 0.99, review: true });
});

test('a confidence that is not a number is not a confidence', async () => {
  const result = await readPage(PAGE, new FakeOCR({ [PAGE]: READING }, 'high'));
  assert.equal(result.confidence, 0);
  assert.equal(result.review, true);
});

test('retries a failed call', async () => {
  const engine = new FlakyEngine(new FakeOCR({ [PAGE]: READING }));
  assert.ok((await readPage(PAGE, engine)).text.includes('NORD FOURNITURES SAS'));
});

test('gives up after the last attempt', async () => {
  const engine = new FlakyEngine(new FakeOCR({ [PAGE]: READING }), 5);
  await assert.rejects(() => readPage(PAGE, engine, { attempts: 2 }), OCRUnavailable);
});

test('an answer that is not a reading raises', async () => {
  const talkative = { read: async () => 'NORD FOURNITURES SAS' };
  await assert.rejects(() => readPage(PAGE, talkative), OCRUnavailable);
});

test('cleaning an empty reading stays empty', () => {
  assert.equal(clean(''), '');
  assert.equal(clean('   \n\n \t \n'), '');
});

test('breaking point: a confident misreading passes every threshold', async () => {
  // The breaking point of this rung: the confidence catches a page the engine
  // struggled with, and the engine did not struggle here.
  //
  // The double below is told to answer the way an engine does on a clean scan
  // it read wrong without hesitating: the letter O where the invoice printed a
  // zero, and a high score. No test can order a real engine to misread, so the
  // reading is written here. What is asserted is what the code does with it —
  // the score is high, so the review flag stays down, and nothing in this code
  // can tell that the number is wrong.
  //
  // Raising the threshold does not help, because the mistake is confident.
  // What helps is knowing the shape of your references and checking the
  // reading against it — a rule you write yourself, back on rung N0.
  const result = await readPage(PAGE, new FakeOCR({ [PAGE]: 'N° 2O24-OOO431' }, 0.96));
  assert.equal(result.review, false);
  assert.equal(result.text, 'N° 2O24-OOO431');
  assert.ok(!result.text.includes('2024-000431'));
});
