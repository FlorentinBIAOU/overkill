/**
 * These tests inject a local double instead of calling a provider.
 *
 * What they prove: the request is built correctly, only an excerpt is sent,
 * the answer is decoded and normalised correctly, oversized input is refused,
 * failures are retried, and an unusable answer does not become a language
 * code.
 *
 * What they do not prove: that the model names the right language. That is
 * why this snippet is declared `verification: stubbed` on the entry, and why
 * the page says so next to the code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeLLM } from '../_harness/fake-llm.mjs';
import { EXCERPT_CHARACTERS, MAX_CHARACTERS, DetectionUnavailable, buildPrompt, detect } from './n3.js';

const LANGUAGES = ['fr', 'en', 'es'];

test('returns the code the model reports', async () => {
  const client = new FakeLLM({ response: '{"language": "fr", "confidence": 0.98}' });
  assert.equal(await detect('La réunion de lundi est reportée.', LANGUAGES, { client }), 'fr');
});

test('sends the text and the allowed list, at temperature zero', async () => {
  const client = new FakeLLM({ response: '{"language": "es"}' });
  await detect('La reunión del lunes.', LANGUAGES, { client });
  assert.ok(client.lastRequest.prompt.includes('La reunión del lunes.'));
  assert.ok(client.lastRequest.prompt.includes('en, es, fr'));
  assert.equal(client.lastRequest.temperature, 0);
});

test('sends only an excerpt of a long document', async () => {
  // A language is decided in the first few sentences. The rest is paid for
  // and thrown away.
  const client = new FakeLLM({ response: '{"language": "en"}' });
  const document = 'The meeting is on Monday. '.repeat(200) + 'and the last line is never read';
  await detect(document, LANGUAGES, { client });
  const { prompt } = client.lastRequest;
  assert.ok(prompt.includes('The meeting is on Monday.'));
  assert.ok(!prompt.includes('and the last line is never read'));
  assert.ok(prompt.length <= buildPrompt(LANGUAGES, '').length + EXCERPT_CHARACTERS);
});

test('normalises the shapes a model writes a code in', async () => {
  for (const written of ['fr', 'FR', ' fr ', 'fr-CA']) {
    const client = new FakeLLM({ response: JSON.stringify({ language: written }) });
    assert.equal(await detect('Bonjour à tous.', LANGUAGES, { client }), 'fr', written);
  }
});

test('null when the model says it is none of them', async () => {
  const client = new FakeLLM({ response: '{"language": "und", "confidence": 0.4}' });
  assert.equal(await detect('Der Zug kam zu spät an.', LANGUAGES, { client }), null);
});

test('refuses oversized input before spending anything', async () => {
  const client = new FakeLLM({ response: '{"language": "en"}' });
  await assert.rejects(() => detect('x'.repeat(MAX_CHARACTERS + 1), LANGUAGES, { client }), RangeError);
  assert.equal(client.callCount, 0);
});

test('retries a provider failure', async () => {
  const client = new FakeLLM({ response: '{"language": "en"}', failTimes: 2 });
  await detect('The meeting is on Monday.', LANGUAGES, { client, attempts: 3 });
  assert.equal(client.callCount, 3);
});

test('breaking point: an unusable answer never becomes a language code', async () => {
  // The model can answer anything, including prose where JSON was asked for,
  // and a language that was not on the list it was given.
  //
  // The dangerous behaviour would be to shrug and return a plausible-looking
  // code, which downstream would route a message to the wrong team without a
  // trace. It throws instead, and the caller decides.
  const prose = new FakeLLM({ response: 'The text appears to be written in French.' });
  await assert.rejects(() => detect('Bonjour à tous.', LANGUAGES, { client: prose }), DetectionUnavailable);

  const offList = new FakeLLM({ response: '{"language": "it", "confidence": 0.99}' });
  await assert.rejects(() => detect('Bonjour à tous.', LANGUAGES, { client: offList }), DetectionUnavailable);
});

test('breaking point: the confidence is written by the model, not measured', async () => {
  // The second half of the same breaking point, and the more expensive one:
  // nothing in this code can tell a right answer from a wrong one.
  //
  // Here the model answers Spanish, with a self-reported confidence of
  // ninety-nine per cent, on a sentence that is plainly French. The snippet
  // validates the shape, finds it perfect, and hands the wrong code back.
  //
  // N0 and N1 can be measured against a labelled set on your own machine.
  // This cannot be, which is what `verification: stubbed` means on the entry.
  const client = new FakeLLM({ response: '{"language": "es", "confidence": 0.99}' });
  assert.equal(await detect('Bonjour à tous, la réunion de lundi est reportée.', LANGUAGES, { client }), 'es');
});
