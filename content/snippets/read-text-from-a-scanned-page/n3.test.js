/**
 * These tests inject a local double instead of calling a provider.
 *
 * What they prove: the image is recognised and encoded, an unsupported or
 * oversized image is refused before anything is spent, the answer is decoded,
 * failures are retried, and an unusable answer never passes for a
 * transcription.
 *
 * What they do not prove: that the transcription is what the page says. The
 * last test in this file is about exactly that, and it is the reason this
 * snippet is declared `verification: stubbed` on the entry.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeLLM } from '../_harness/fake-llm.mjs';
import { MAX_IMAGE_BYTES, ReadingUnavailable, readPage } from './n3.js';

// Enough of a PNG to be recognised as one. Nothing here decodes the pixels —
// neither this test, nor the snippet, nor anything else on this rung.
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);

const TRANSCRIPTION = {
  text: 'NORD FOURNITURES SAS\nN° 2024-000431\nNET A PAYER 92,40 EUR',
  unreadable: [],
};

test('returns the transcription', async () => {
  const client = new FakeLLM({ response: JSON.stringify(TRANSCRIPTION) });
  const result = await readPage(PNG, { client });
  assert.ok(result.text.startsWith('NORD FOURNITURES SAS'));
  assert.equal(result.review, false);
});

test('sends the image encoded with its media type', async () => {
  const client = new FakeLLM({ response: JSON.stringify(TRANSCRIPTION) });
  await readPage(PNG, { client });
  const request = client.lastRequest;
  assert.equal(request.image.mediaType, 'image/png');
  assert.deepEqual(Buffer.from(request.image.data, 'base64'), PNG);
  assert.ok(request.prompt.includes('Transcribe'));
  assert.equal(request.temperature, 0);
});

test('reads the format from the bytes, not from a name', async () => {
  const client = new FakeLLM({ response: JSON.stringify(TRANSCRIPTION) });
  await readPage(JPEG, { client });
  assert.equal(client.lastRequest.image.mediaType, 'image/jpeg');
});

test('refuses a format no provider takes before spending anything', async () => {
  const client = new FakeLLM({ response: JSON.stringify(TRANSCRIPTION) });
  const gif = Buffer.concat([Buffer.from('GIF89a', 'latin1'), Buffer.alloc(64)]);
  await assert.rejects(() => readPage(gif, { client }), TypeError);
  assert.equal(client.callCount, 0);
});

test('refuses an oversized image before spending anything', async () => {
  const client = new FakeLLM({ response: JSON.stringify(TRANSCRIPTION) });
  const huge = Buffer.concat([PNG, Buffer.alloc(MAX_IMAGE_BYTES)]);
  await assert.rejects(() => readPage(huge, { client }), RangeError);
  assert.equal(client.callCount, 0);
});

test('a fragment the model could not read asks for a human', async () => {
  // The one honest signal this rung gives: the model saying it does not know.
  const client = new FakeLLM({
    response: JSON.stringify({ text: 'NET A PAYER ... EUR', unreadable: ['the total'] }),
  });
  const result = await readPage(PNG, { client });
  assert.deepEqual(result.unreadable, ['the total']);
  assert.equal(result.review, true);
});

test('a missing unreadable key is not an error', async () => {
  const client = new FakeLLM({ response: JSON.stringify({ text: 'une page lisible' }) });
  assert.deepEqual(await readPage(PNG, { client }), {
    text: 'une page lisible',
    unreadable: [],
    review: false,
  });
});

test('retries a provider failure', async () => {
  const client = new FakeLLM({ response: JSON.stringify(TRANSCRIPTION), failTimes: 2 });
  await readPage(PNG, { client, attempts: 3 });
  assert.equal(client.callCount, 3);
});

test('an unusable answer raises rather than returning a blank page', async () => {
  // Prose where JSON was asked for. Returning an empty transcription would
  // file the page as read and empty, which is worse than failing.
  const client = new FakeLLM({ response: 'Of course! Here is the text of your invoice:' });
  await assert.rejects(() => readPage(PNG, { client }), ReadingUnavailable);
});

test('an answer shaped wrong raises too', async () => {
  const client = new FakeLLM({ response: JSON.stringify({ text: ['line one', 'line two'] }) });
  await assert.rejects(() => readPage(PNG, { client }), ReadingUnavailable);
});

test('breaking point: the model can write a page it never read', async () => {
  // The breaking point of this rung: a model that reads is a model that
  // writes.
  //
  // The image handed over here carries a PNG header and nothing to read. The
  // answer is written into the double below, since no test can order an
  // invention from a provider: a complete, well-formatted, entirely plausible
  // invoice — a supplier, a reference in the right shape, a total with two
  // decimals, and an empty `unreadable` list, so no doubt reported at all.
  //
  // Every assertion below passes, and that is the point. The transcription is
  // well-formed JSON, the plumbing is correct, the review flag is false, and
  // the caller receives a total that was never printed on any page. Nothing
  // upstream of the model saw the pixels, and nothing downstream can check
  // them: the only defence left is a rule about what the document must
  // contain, which is rung N0 again, or a human.
  const invented = {
    text: 'PAPETERIE DU NORD\nFacture 2024-000998\nNET A PAYER 1 240,00 EUR',
    unreadable: [],
  };
  const client = new FakeLLM({ response: JSON.stringify(invented) });
  const result = await readPage(PNG, { client });

  assert.equal(result.review, false);
  assert.deepEqual(result.unreadable, []);
  assert.ok(result.text.includes('NET A PAYER 1 240,00 EUR'));
  // The whole of what the code did with the pixels: forward them.
  assert.deepEqual(Buffer.from(client.lastRequest.image.data, 'base64'), PNG);
});
