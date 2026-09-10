/**
 * These tests inject a local double instead of calling a provider.
 *
 * What they prove: the request is built correctly, the answer is decoded
 * correctly, an oversized batch is refused before anything is spent, failures
 * are retried, and an answer that does not respect the request is rejected
 * instead of being handed to the caller as data.
 *
 * What they do not prove: that the model writes anything worth reading. That
 * is why this snippet is declared `verification: stubbed` on the entry, and
 * why the page says so next to the code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeLLM } from '../_harness/fake-llm.mjs';
import { MAX_ROWS, GenerationUnavailable, buildPrompt, writeRows } from './n3.js';

const FIELDS = ['display_name', 'job_title', 'support_message'];

// What a well-behaved answer looks like. Every value is invented and matches
// no real person.
const TWO_ROWS = JSON.stringify([
  {
    display_name: 'Iris Fontaine',
    job_title: 'warehouse supervisor',
    support_message: 'the label printer stopped mid batch, do i reprint the whole lot?',
  },
  {
    display_name: 'Marek Villeneuve',
    job_title: 'night dispatcher',
    support_message: "Can't log in since the update. Tried twice. Second time it froze.",
  },
]);

test('returns the rows the model wrote', async () => {
  const client = new FakeLLM({ response: TWO_ROWS });
  const rows = await writeRows(FIELDS, 2, { uniqueField: 'display_name', client });
  assert.deepEqual(rows.map((row) => row.display_name), ['Iris Fontaine', 'Marek Villeneuve']);
  assert.ok(rows[0].support_message.startsWith('the label printer'));
});

test('asks for what it checks', async () => {
  const client = new FakeLLM({ response: TWO_ROWS });
  await writeRows(FIELDS, 2, { uniqueField: 'display_name', client });
  const { prompt } = client.lastRequest;
  for (const field of FIELDS) assert.ok(prompt.includes(field));
  assert.ok(prompt.includes('2 rows'));
  assert.ok(buildPrompt(FIELDS, 2, 'display_name').includes('display_name'));
  // Varied prose is the only reason to be on this rung, so the temperature is
  // not zero here, unlike every other snippet that calls a model.
  assert.ok(client.lastRequest.temperature > 0);
});

test('refuses an oversized batch before spending anything', async () => {
  const client = new FakeLLM({ response: TWO_ROWS });
  await assert.rejects(() => writeRows(FIELDS, MAX_ROWS + 1, { client }), RangeError);
  await assert.rejects(() => writeRows(FIELDS, 0, { client }), RangeError);
  assert.equal(client.callCount, 0);
});

test('retries a provider failure', async () => {
  const client = new FakeLLM({ response: TWO_ROWS, failTimes: 2 });
  await writeRows(FIELDS, 2, { uniqueField: 'display_name', client, attempts: 3 });
  assert.equal(client.callCount, 3);
});

test('an unusable answer raises rather than returning nothing', async () => {
  // Prose where JSON was asked for. Returning an empty list here would leave a
  // suite running against no data at all, and passing.
  const client = new FakeLLM({ response: 'Of course! Here are two fictional support tickets:' });
  await assert.rejects(() => writeRows(FIELDS, 2, { client }), GenerationUnavailable);
});

test('breaking point: the model respects neither the schema nor uniqueness', async () => {
  // The risk this rung carries: the answer is plausible and wrong.
  //
  // Both answers below are valid JSON, and both would slip through a decoder
  // that only calls `JSON.parse`. The first renamed a key and dropped a row;
  // the second gave two rows the same name, which would turn a test about
  // duplicate accounts into a test that always passes.
  //
  // The code checks it itself, because nothing upstream will. The call count
  // shows it retried and then refused, rather than returning what it got.
  const renamed = JSON.stringify([{ name: 'Iris Fontaine', job_title: 'supervisor' }]);
  let client = new FakeLLM({ response: renamed });
  await assert.rejects(
    () => writeRows(FIELDS, 2, { uniqueField: 'display_name', client, attempts: 2 }),
    GenerationUnavailable,
  );
  assert.equal(client.callCount, 2);

  const first = { ...JSON.parse(TWO_ROWS)[0], job_title: 'clerk' };
  const repeated = JSON.stringify([first, first]);
  client = new FakeLLM({ response: repeated });
  await assert.rejects(
    () => writeRows(FIELDS, 2, { uniqueField: 'display_name', client, attempts: 2 }),
    GenerationUnavailable,
  );

  // Without the uniqueness requirement the very same answer is accepted: the
  // check exists because the caller asked for it, not because the model did.
  const accepted = await writeRows(FIELDS, 2, { client: new FakeLLM({ response: repeated }) });
  assert.equal(accepted[0].display_name, accepted[1].display_name);
});
