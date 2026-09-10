/**
 * These tests inject a local double instead of calling a provider.
 *
 * What they prove: the document reaches the prompt, the sentence budget
 * reaches the prompt, the answer is decoded, an oversized document is refused
 * before anything is spent, a provider failure is retried, and an answer of
 * the wrong shape throws instead of returning a silently empty summary.
 *
 * What they do not prove: that the summary is true of the document. The last
 * test shows how far that goes. This snippet is declared `verification:
 * stubbed` on the entry, and the page says so next to the code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeLLM } from '../_harness/fake-llm.mjs';
import { MAX_CHARACTERS, SummaryUnavailable, summarise } from './n3.js';

const REPORT = [
  'The support team migrated the ticketing system to a new platform in March.',
  'Every agent was trained during the two weeks before the switch.',
  'The old platform stayed available in read-only mode for a month afterwards.',
].join(' ');

const ANSWER = JSON.stringify({
  summary: 'The ticketing system moved to a new platform in March.',
  key_points: ['agents trained beforehand', 'old platform kept read-only'],
});

test('decodes the summary and the key points', async () => {
  const client = new FakeLLM({ response: ANSWER });
  const result = await summarise(REPORT, { client });
  assert.equal(result.summary, 'The ticketing system moved to a new platform in March.');
  assert.deepEqual(result.keyPoints, ['agents trained beforehand', 'old platform kept read-only']);
});

test('sends the document and the sentence budget in the prompt', async () => {
  const client = new FakeLLM({ response: ANSWER });
  await summarise(REPORT, { client, maxSentences: 5 });
  assert.ok(client.lastRequest.prompt.includes(REPORT));
  assert.ok(client.lastRequest.prompt.includes('at most 5 sentences'));
  assert.equal(client.lastRequest.temperature, 0);
});

test('key points default to an empty list', async () => {
  const client = new FakeLLM({ response: JSON.stringify({ summary: 'One line.' }) });
  assert.deepEqual(await summarise(REPORT, { client }), { summary: 'One line.', keyPoints: [] });
});

test('an empty document costs nothing', async () => {
  const client = new FakeLLM({ response: ANSWER });
  assert.deepEqual(await summarise('', { client }), { summary: '', keyPoints: [] });
  assert.deepEqual(await summarise('   \n ', { client }), { summary: '', keyPoints: [] });
  assert.equal(client.callCount, 0);
});

test('refuses an oversized document before spending anything', async () => {
  const client = new FakeLLM({ response: ANSWER });
  await assert.rejects(() => summarise('x'.repeat(MAX_CHARACTERS + 1), { client }), RangeError);
  assert.equal(client.callCount, 0);
});

test('retries a provider failure', async () => {
  const client = new FakeLLM({ response: ANSWER, failTimes: 2 });
  await summarise(REPORT, { client, attempts: 3 });
  assert.equal(client.callCount, 3);
});

test('prose where JSON was asked for throws', async () => {
  const client = new FakeLLM({ response: 'Sure! Here is a summary of your document:' });
  await assert.rejects(() => summarise(REPORT, { client }), SummaryUnavailable);
});

test('valid JSON of the wrong shape throws', async () => {
  // The awkward case: the answer parses, so a naive JSON.parse is happy, and
  // the caller would get a summary that is silently empty.
  const wrongShapes = [
    '[]',
    '{"key_points": ["a", "b"]}',
    '{"summary": "   "}',
    '{"summary": "fine", "key_points": "a, b"}',
  ];
  for (const response of wrongShapes) {
    const client = new FakeLLM({ response });
    await assert.rejects(() => summarise(REPORT, { client, attempts: 1 }), SummaryUnavailable);
  }
});

test('breaking point: the model writes what the document does not say', async () => {
  // The risk this rung buys, and the one nothing in n3.js catches.
  //
  // The prompt says "use only what the document says". That is a request, not
  // a constraint: the answer below is well-formed JSON, the right shape, the
  // right length, fluent, and it states a figure and a decision that appear
  // nowhere in the document.
  //
  // Every check in n3.js passes, because every check in n3.js is about shape.
  // Whether a summary follows from its source is a question about meaning, and
  // no amount of parsing answers it. If that matters for your use, the answer
  // is not a better prompt: it is a human reading the source next to the
  // summary, or a rung that cannot invent, which is what N0 and N1 are for.
  const client = new FakeLLM({
    response: JSON.stringify({
      summary:
        'The migration cut ticket handling time by a third, and the board' +
        ' approved a second phase for the autumn.',
      key_points: ['a third faster', 'second phase approved'],
    }),
  });
  const result = await summarise(REPORT, { client });

  // It came back clean, and it is not in the document.
  assert.ok(result.summary.includes('board'));
  assert.ok(!REPORT.includes('board'));
  assert.ok(!REPORT.includes('third'));
});
