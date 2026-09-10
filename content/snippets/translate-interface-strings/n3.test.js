/**
 * These tests inject a local double instead of calling a provider.
 *
 * What they prove: the interface context and the variables really travel in
 * the request, the answer is decoded, oversized input is refused before
 * anything is spent, failures are retried, an unusable answer throws instead
 * of being mistaken for a translation, and a rewritten variable is reported.
 *
 * What they do not prove: that the model translates well, or that the context
 * changes anything to its answer. That is why this snippet is declared
 * `verification: stubbed` on the entry, and why the page says so.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeLLM } from '../_harness/fake-llm.mjs';
import { MAX_CHARACTERS, TranslationUnavailable, translate } from './n3.js';

test('translates what the model answers', async () => {
  const client = new FakeLLM({ response: { translation: 'Enregistrer les modifications' } });
  const result = await translate('Save changes', 'French', { context: 'button label', client });
  assert.equal(result.target, 'Enregistrer les modifications');
  assert.equal(result.review, false);
  assert.deepEqual(result.warnings, []);
});

test('the interface context travels with the string', async () => {
  // The whole reason for this rung: the model is told where the string sits.
  const client = new FakeLLM({ response: { translation: 'Enregistrer' } });
  await translate('Save', 'French', { context: 'button label, next to Cancel', client });
  const { prompt } = client.lastRequest;
  assert.ok(prompt.includes('button label, next to Cancel'));
  assert.ok(prompt.includes('French'));
  assert.ok(prompt.endsWith('Save'));
  // Temperature zero: the same string must not be translated two ways in the
  // same interface.
  assert.equal(client.lastRequest.temperature, 0);
});

test('the variables are listed in the request', async () => {
  const client = new FakeLLM({ response: { translation: '{count} éléments sélectionnés' } });
  await translate('{count} items selected', 'French', { client });
  assert.ok(client.lastRequest.prompt.includes('exactly as written: {count}'));
});

test('a missing context is said to be missing rather than left blank', async () => {
  const client = new FakeLLM({ response: { translation: 'Enregistrer' } });
  await translate('Save', 'French', { client });
  assert.ok(client.lastRequest.prompt.includes('Where it appears in the interface: not given'));
});

test('a moved variable is accepted', async () => {
  const client = new FakeLLM({ response: { translation: 'Éléments sélectionnés : {count}' } });
  const result = await translate('{count} items selected', 'French', { client });
  assert.equal(result.review, false);
});

test('refuses oversized input before spending anything', async () => {
  const client = new FakeLLM({ response: { translation: 'x' } });
  await assert.rejects(
    () => translate('x'.repeat(MAX_CHARACTERS + 1), 'French', { client }),
    RangeError,
  );
  assert.equal(client.callCount, 0);
});

test('retries a provider failure', async () => {
  const client = new FakeLLM({ response: { translation: 'Enregistrer' }, failTimes: 2 });
  const result = await translate('Save', 'French', { client, attempts: 3 });
  assert.equal(result.target, 'Enregistrer');
  assert.equal(client.callCount, 3);
});

test('an answer without a translation throws', async () => {
  const client = new FakeLLM({ response: { note: 'I am not sure what you mean' } });
  await assert.rejects(() => translate('Save', 'French', { client }), TranslationUnavailable);
});

test('breaking point: prose where JSON was asked for', async () => {
  // A general-purpose model answers whatever it likes, including a polite
  // sentence around the translation. Returning that sentence as the label of
  // a button is worse than returning nothing, so it throws and the caller
  // decides.
  const client = new FakeLLM({ response: 'Sure! In French, Save is « Enregistrer ».' });
  await assert.rejects(() => translate('Save', 'French', { client }), TranslationUnavailable);
});

test('breaking point: asking for the variables is not keeping them', async () => {
  // The request says to keep `{count}` exactly as written. The model
  // translated it anyway. Nothing in the prompt can prevent that, which is
  // precisely why the answer is checked rather than trusted.
  const client = new FakeLLM({ response: { translation: '{compte} éléments sélectionnés' } });
  const result = await translate('{count} items selected', 'French', { client });
  assert.equal(result.review, true);
  assert.deepEqual(result.warnings, ['the model did not keep the interpolation variables']);
});
