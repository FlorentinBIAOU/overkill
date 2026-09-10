/**
 * These tests inject a local double instead of loading the real model.
 *
 * What they prove: the page is sent in one pass with its lines in order, the
 * scores are decoded into fields, the threshold sends a doubtful field to a
 * human, an oversized document is refused before the model runs, a failed pass
 * is retried, and an unusable answer never passes for a reading.
 *
 * What they do not prove: that the model tags the right lines. That is why
 * this snippet is declared `verification: stubbed` on the entry, and why the
 * page says so next to the code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeClassifier } from '../_harness/fake-model.mjs';
import { ExtractionUnavailable, MAX_LINES, extractFields } from './n2.js';

const LINES = [
  'NORD FOURNITURES SAS',
  '                            N° 2024-000431',
  '                            Émise le 3 avril 2024',
  'Cartouche encre noire            2    38,50      77,00',
  '                    Sous-total                     77,00',
  '                    TVA (20 %)                     15,40',
  '                    NET A PAYER                    92,40 EUR',
];
const INVOICE = LINES.join('\n');

// The labels are the ones an invoice model exposes; the scores are ours, so the
// test exercises our thresholds and not the model's opinions.
const SCORES = {
  [LINES[1]]: { invoice_number: 0.97, date: 0.11 },
  [LINES[2]]: { date: 0.95 },
  [LINES[6]]: { total: 0.93, invoice_number: 0.02 },
};

/** A model that drops a pass, the way a machine under load does. */
class FlakyModel {
  constructor(model, failures = 1) {
    this.model = model;
    this.failures = failures;
  }

  async predict(lines) {
    if (this.failures > 0) {
      this.failures -= 1;
      throw new Error('the model was not ready');
    }
    return this.model.predict(lines);
  }
}

test('reads the three fields', async () => {
  const fields = await extractFields(INVOICE, new FakeClassifier(SCORES));
  assert.equal(fields.invoice_number.value, '2024-000431');
  assert.equal(fields.date.value, '3 avril 2024');
  assert.equal(fields.total.value, 92.4);
  assert.deepEqual(Object.values(fields).map((f) => f.review), [false, false, false]);
});

test('sends the whole page in one pass', async () => {
  const model = new FakeClassifier(SCORES);
  await extractFields(INVOICE, model);
  assert.deepEqual(model.calls, [LINES]);
});

test('a doubtful score goes to a human with its value', async () => {
  const fields = await extractFields(INVOICE, new FakeClassifier(SCORES), { threshold: 0.99 });
  assert.equal(fields.total.value, 92.4);
  assert.equal(fields.total.review, true);
  assert.equal(fields.total.score, 0.93);
});

test('a tagged line holding no value is not an answer', async () => {
  // The model is sure the company name is the total. It carries no amount, so
  // there is nothing to return and a human is asked.
  const model = new FakeClassifier({ [LINES[0]]: { total: 0.99 } });
  const { total } = await extractFields(INVOICE, model);
  assert.equal(total.value, null);
  assert.equal(total.review, true);
});

test('a score that is not a number is not a score', async () => {
  const model = new FakeClassifier({ [LINES[6]]: { total: 'very' } });
  const { total } = await extractFields(INVOICE, model);
  assert.deepEqual(total, { value: null, score: 0, review: true });
});

test('refuses an oversized document before the model runs', async () => {
  const model = new FakeClassifier(SCORES);
  await assert.rejects(() => extractFields('ligne\n'.repeat(MAX_LINES + 1), model), RangeError);
  assert.deepEqual(model.calls, []);
});

test('retries a failed pass', async () => {
  const model = new FlakyModel(new FakeClassifier(SCORES));
  const { total } = await extractFields(INVOICE, model);
  assert.equal(total.value, 92.4);
});

test('gives up after the last attempt', async () => {
  const model = new FlakyModel(new FakeClassifier(SCORES), 5);
  await assert.rejects(
    () => extractFields(INVOICE, model, { attempts: 2 }),
    ExtractionUnavailable,
  );
});

test('a short answer throws rather than misaligning the lines', async () => {
  const truncating = { predict: async () => [{ total: 0.99 }] };
  await assert.rejects(() => extractFields(INVOICE, truncating), ExtractionUnavailable);
});

test('breaking point: a confident mistake passes every threshold', async () => {
  // The threshold catches doubt, and the model is not in doubt. This invoice
  // carries a deposit block, a layout the fine-tuning never saw. The model tags
  // the deposit line as the total and scores it high, so the field comes back
  // with a number, a good score, and no review flag. Nothing in the code is
  // wrong; the reading simply is.
  //
  // Raising the threshold does not help, because the mistake scores higher than
  // the right answer. What helps is fine-tuning on invoices that carry
  // deposits, which means an annotated corpus of your own — the cost this rung
  // is usually assumed not to have.
  const lines = [
    'VERRERIE DU CENTRE',
    'Facture V-2451 du 12/09/2024',
    'Bocaux 500 ml x 200                          264,00',
    'Total TTC                                    360,00 €',
    'Acompte versé le 02/09                       120,00 €',
    'Solde à régler                               240,00 €',
  ];
  const model = new FakeClassifier({ [lines[4]]: { total: 0.96 }, [lines[3]]: { total: 0.41 } });
  const { total } = await extractFields(lines.join('\n'), model);
  assert.equal(total.value, 120);
  assert.equal(total.review, false);
  assert.notEqual(total.value, 360);
});
