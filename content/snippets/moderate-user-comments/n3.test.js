/**
 * These tests inject a local double instead of calling a provider.
 *
 * What they prove: the request carries the comment and the categories, the
 * answer is decoded, the thresholds are honoured, an oversized comment is
 * refused before anything is spent, a failure is retried, and an unusable
 * answer throws instead of becoming a decision.
 *
 * What they do not prove: that the provider judges comments well. That is why
 * this snippet is declared `verification: stubbed` on the entry, and why the
 * page says so next to the code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeLLM } from '../_harness/fake-llm.mjs';
import { CATEGORIES, MAX_CHARACTERS, ModerationUnavailable, moderate } from './n3.js';

const ATTACK = 'get off this forum you blorptard';
const CALM = 'the diagram is much clearer than the text';

function scored(values = {}) {
  return JSON.stringify(Object.fromEntries(CATEGORIES.map((n) => [n, values[n] ?? 0])));
}

test('blocks what the endpoint scores high', async () => {
  const client = new FakeLLM({ response: scored({ harassment: 0.97 }) });
  const decision = await moderate(ATTACK, { client });
  assert.equal(decision.action, 'block');
  assert.equal(decision.category, 'harassment');
});

test('allows what it scores low', async () => {
  const client = new FakeLLM({ response: scored() });
  assert.equal((await moderate(CALM, { client })).action, 'allow');
});

test('sends the comment and the categories at temperature zero', async () => {
  const client = new FakeLLM({ response: scored() });
  await moderate(ATTACK, { client });
  const { prompt, temperature } = client.lastRequest;
  assert.ok(prompt.includes(ATTACK));
  for (const name of CATEGORIES) assert.ok(prompt.includes(name), name);
  // Temperature zero, because a moderation decision that changes between two
  // identical calls cannot be explained to the person it was applied to.
  assert.equal(temperature, 0);
});

test('thresholds are the caller to set', async () => {
  const client = new FakeLLM({ response: scored({ harassment: 0.7 }) });
  assert.equal((await moderate(ATTACK, { client })).action, 'review');
  const strict = await moderate(ATTACK, { client, thresholds: { block: 0.5, review: 0.2 } });
  assert.equal(strict.action, 'block');
});

test('ignores invented categories and scores out of range', async () => {
  const client = new FakeLLM({ response: JSON.stringify({ harassment: 0.4, sarcasm: 0.99, hate: 7.5 }) });
  const decision = await moderate(ATTACK, { client });
  assert.deepEqual(decision.scores, { harassment: 0.4 });
});

test('refuses an oversized comment before spending anything', async () => {
  const client = new FakeLLM({ response: scored() });
  await assert.rejects(() => moderate('x'.repeat(MAX_CHARACTERS + 1), { client }), RangeError);
  assert.equal(client.callCount, 0);
});

test('retries a provider failure', async () => {
  const client = new FakeLLM({ response: scored(), failTimes: 2 });
  await moderate(CALM, { client, attempts: 3 });
  assert.equal(client.callCount, 3);
});

test('an unusable answer throws rather than allowing the comment', async () => {
  // Prose where JSON was asked for. Shrugging and returning "allow" would
  // publish everything the provider fails to answer about.
  const client = new FakeLLM({ response: 'Sure! This comment looks a bit rude to me.' });
  await assert.rejects(() => moderate(ATTACK, { client }), ModerationUnavailable);
});

test('breaking point: the score is asserted, not measured', async () => {
  // The number is the provider's opinion, and the code has nothing to check it
  // against. Here a plainly harmless comment comes back scored as harassment,
  // and the function blocks it, correctly by its own logic. There is no
  // feature to inspect, no weight to print, and no answer to give the user
  // beyond the provider's number. The endpoint changes on their schedule.
  const client = new FakeLLM({ response: scored({ harassment: 0.95 }) });
  const decision = await moderate(CALM, { client });
  assert.equal(decision.action, 'block');
  assert.equal(decision.scores.harassment, 0.95);
});
