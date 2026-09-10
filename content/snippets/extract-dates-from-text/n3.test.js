/**
 * These tests inject a local double instead of calling a provider.
 *
 * What they prove: the request is built correctly, the answer is decoded
 * correctly, oversized input is refused, failures are retried, and neither an
 * impossible date nor an unusable answer reaches the caller as if it were a
 * fact.
 *
 * What they do not prove: that the model reads dates well. That is why this
 * snippet is declared `verification: stubbed` on the entry, and why the page
 * says so next to the code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeLLM } from '../_harness/fake-llm.mjs';
import { MAX_CHARACTERS, ExtractionUnavailable, extractDates } from './n3.js';

const TODAY = new Date(Date.UTC(2024, 2, 12));
const days = (found) => found.map((d) => [d.text, d.date.toISOString().slice(0, 10)]);

test('decodes what the model reports', async () => {
  const client = new FakeLLM({ response: '[{"text": "12/03/2024", "date": "2024-03-12"}]' });
  const found = await extractDates('réunion le 12/03/2024', { client, today: TODAY });
  assert.deepEqual(days(found), [['12/03/2024', '2024-03-12']]);
});

test('reads the relative dates that stop N0', async () => {
  // This is what the rung buys, and the only reason it is on the entry.
  const client = new FakeLLM({ response: '[{"text": "jeudi prochain", "date": "2024-03-14"}]' });
  const found = await extractDates('on se voit jeudi prochain', { client, today: TODAY });
  assert.deepEqual(days(found), [['jeudi prochain', '2024-03-14']]);
});

test('sends the text and the reference day in the prompt', async () => {
  const client = new FakeLLM({ response: '[]' });
  await extractDates('on se voit jeudi prochain', { client, today: TODAY });
  // Without a reference day, "jeudi prochain" cannot be resolved at all.
  assert.ok(client.lastRequest.prompt.includes('on se voit jeudi prochain'));
  assert.ok(client.lastRequest.prompt.includes('2024-03-12'));
  assert.equal(client.lastRequest.temperature, 0);
});

test('an empty result is an empty list', async () => {
  const client = new FakeLLM({ response: '[]' });
  assert.deepEqual(await extractDates('rien à signaler', { client, today: TODAY }), []);
});

test('refuses oversized input before spending anything', async () => {
  const client = new FakeLLM({ response: '[]' });
  await assert.rejects(
    () => extractDates('x'.repeat(MAX_CHARACTERS + 1), { client, today: TODAY }),
    RangeError,
  );
  assert.equal(client.callCount, 0);
});

test('retries a provider failure', async () => {
  const client = new FakeLLM({ response: '[]', failTimes: 2 });
  await extractDates('hello', { client, today: TODAY, attempts: 3 });
  assert.equal(client.callCount, 3);
});

test('breaking point: a confident answer the calendar refuses', async () => {
  // Fluency is not correctness. The model can return 31 February in flawless
  // JSON, and a date it invented outright. Nothing in the answer marks either
  // one as wrong, so the calendar check of N0 has to stay, here as well. Only
  // the impossible day is dropped; the invented one gets through, and no
  // amount of plumbing catches it.
  const client = new FakeLLM({
    response: JSON.stringify([
      { text: '31 février 2024', date: '2024-02-31' },
      { text: 'hier', date: '2024-03-11' },
    ]),
  });
  const found = await extractDates('31 février 2024, hier', { client, today: TODAY });
  assert.deepEqual(days(found), [['hier', '2024-03-11']]);
});

test('breaking point: an unusable answer throws rather than returning nothing', async () => {
  // Asked for JSON, the model can answer prose. Returning an empty list here
  // would tell the caller that the text holds no date, which is a different
  // statement, and a false one. It throws instead, and the caller decides.
  const client = new FakeLLM({ response: 'Sure! Here are the dates I found:' });
  await assert.rejects(
    () => extractDates('réunion le 12/03/2024', { client, today: TODAY }),
    ExtractionUnavailable,
  );
});
