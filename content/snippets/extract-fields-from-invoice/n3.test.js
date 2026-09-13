/**
 * These tests inject a local double instead of calling a provider.
 *
 * What they prove: the request carries the text and the page as a data URL, the
 * answer is decoded, an oversized image is refused before anything is spent,
 * failures are retried, and an unusable answer never passes for a reading.
 *
 * What they do not prove: that the model reads the invoice correctly. That is
 * why this snippet is declared `verification: stubbed` on the entry, and why
 * the page says so next to the code, and it is what the last test is about.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeLLM } from '../_harness/fake-llm.mjs';
import { ExtractionUnavailable, MAX_IMAGE_BYTES, extractFields } from './n3.js';

const TEXT = `
NORD FOURNITURES SAS
                                          N° 2024-000431
                                          Émise le 3 avril 2024

Cartouche encre noire                2    38,50      77,00
                          NET A PAYER                92,40 EUR
`;

// The first bytes of a PNG. The caller renders the page; this snippet never
// opens a file.
const PAGE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

const ANSWER = { invoice_number: '2024-000431', date: '2024-04-03', total: 92.4 };

test('reads what the model answers', async () => {
  const client = new FakeLLM({ response: JSON.stringify(ANSWER) });
  assert.deepEqual(await extractFields(TEXT, PAGE, { client }), ANSWER);
});

test('sends the text and the page at temperature zero', async () => {
  const client = new FakeLLM({ response: JSON.stringify(ANSWER) });
  await extractFields(TEXT, PAGE, { client });
  const request = client.lastRequest;
  assert.ok(request.prompt.includes('NET A PAYER'));
  assert.ok(request.imageUrl.startsWith('data:image/png;base64,'));
  assert.deepEqual(
    new Uint8Array(Buffer.from(request.imageUrl.split(',')[1], 'base64')),
    PAGE,
  );
  assert.equal(request.temperature, 0);
});

test('accepts the code fence models like to add', async () => {
  const client = new FakeLLM({ response: `\`\`\`json\n${JSON.stringify(ANSWER)}\n\`\`\`` });
  const fields = await extractFields(TEXT, PAGE, { client });
  assert.equal(fields.total, 92.4);
});

test('a field the page does not carry comes back empty', async () => {
  const client = new FakeLLM({ response: '{"invoice_number": "2024-000431", "date": null}' });
  assert.deepEqual(await extractFields(TEXT, PAGE, { client }), {
    invoice_number: '2024-000431',
    date: null,
    total: null,
  });
});

test('refuses an oversized page before spending anything', async () => {
  const client = new FakeLLM({ response: JSON.stringify(ANSWER) });
  const huge = new Uint8Array(MAX_IMAGE_BYTES + 1);
  await assert.rejects(() => extractFields(TEXT, huge, { client }), RangeError);
  assert.equal(client.callCount, 0);
});

test('retries a provider failure', async () => {
  const client = new FakeLLM({ response: JSON.stringify(ANSWER), failTimes: 2 });
  await extractFields(TEXT, PAGE, { client, attempts: 3 });
  assert.equal(client.callCount, 3);
});

test('prose where JSON was asked for throws', async () => {
  const client = new FakeLLM({ response: 'Bien sûr ! Voici les champs de cette facture :' });
  await assert.rejects(() => extractFields(TEXT, PAGE, { client }), ExtractionUnavailable);
});

test('a total that is not a number throws', async () => {
  // "92,40 EUR" is what the page says, and it is not a number. Letting it
  // through would put a string where the rest of the pipeline expects a total.
  const client = new FakeLLM({
    response: '{"invoice_number": "x", "date": null, "total": "92,40 EUR"}',
  });
  await assert.rejects(() => extractFields(TEXT, PAGE, { client }), ExtractionUnavailable);
});

test('breaking point: a well-formed answer can still be invented', async () => {
  // Every check here is a check on the shape of the answer, and none of them is
  // a check on its truth. The model returns a perfectly valid object whose
  // total appears nowhere on the invoice. The code cannot tell, because telling
  // would mean finding the total in the page itself — which is the work this
  // rung was chosen to avoid.
  //
  // The only real defence is to check the answer against the document, and that
  // is N0 wearing a different hat.
  const invented = { invoice_number: '2024-000431', date: '2024-04-03', total: 942 };
  const client = new FakeLLM({ response: JSON.stringify(invented) });
  const fields = await extractFields(TEXT, PAGE, { client });
  assert.equal(fields.total, 942);
  assert.ok(!TEXT.includes('942,00'));
});
