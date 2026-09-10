/**
 * These tests inject a local double instead of calling a provider.
 *
 * What they prove: the request is built correctly, the answer is decoded
 * correctly, oversized input is refused, failures are retried, and an unusable
 * answer does not silently return the message unmasked.
 *
 * What they do not prove: that the model finds the right things. That is why
 * this snippet is declared `verification: stubbed` on the entry, and why the
 * page says so next to the code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeLLM } from '../_harness/fake-llm.mjs';
import { MAX_CHARACTERS, MaskingUnavailable, mask } from './n3.js';

test('masks what the model reports', async () => {
  const client = new FakeLLM({ response: '[{"text": "jean@example.com", "kind": "email"}]' });
  assert.equal(await mask('write to jean@example.com', { client }), 'write to [email]');
});

test('sends the message inside the prompt, at temperature zero', async () => {
  const client = new FakeLLM({ response: '[]' });
  await mask('hello there', { client });
  assert.ok(client.lastRequest.prompt.includes('hello there'));
  assert.equal(client.lastRequest.temperature, 0);
});

test('an empty result leaves the message untouched', async () => {
  const client = new FakeLLM({ response: '[]' });
  assert.equal(await mask('nothing to see here', { client }), 'nothing to see here');
});

test('the longest match is replaced first', async () => {
  const client = new FakeLLM({
    response: JSON.stringify([
      { text: '06', kind: 'phone' },
      { text: '06 12 34 56 78', kind: 'phone' },
    ]),
  });
  assert.equal(await mask('call 06 12 34 56 78', { client }), 'call [phone]');
});

test('refuses oversized input before spending anything', async () => {
  const client = new FakeLLM({ response: '[]' });
  await assert.rejects(() => mask('x'.repeat(MAX_CHARACTERS + 1), { client }), RangeError);
  assert.equal(client.callCount, 0);
});

test('retries a provider failure', async () => {
  const client = new FakeLLM({ response: '[]', failTimes: 2 });
  await mask('hello', { client, attempts: 3 });
  assert.equal(client.callCount, 3);
});

test('breaking point: an unusable answer raises rather than passing through', async () => {
  // The model can answer anything, including prose where JSON was asked for.
  // The dangerous behaviour would be to shrug and return the message
  // unmasked, which would leak the very data this function exists to remove.
  // It throws instead, and the caller decides.
  const client = new FakeLLM({ response: 'Sure! Here are the details I found:' });
  await assert.rejects(() => mask('call 06 12 34 56 78', { client }), MaskingUnavailable);
});
