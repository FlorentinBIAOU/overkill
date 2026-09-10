/**
 * These tests inject a local double instead of calling a provider.
 *
 * What they prove: the request is built with what the journal of rung N0
 * holds, the answer is decoded, one call is made per refused row and not one
 * more, a failed call is retried, an unusable answer is recorded rather than
 * swallowed, and a repair that still does not coerce is refused again.
 *
 * What they do not prove: that the model repairs a row correctly. It cannot be
 * proved here, and the last test shows exactly how little the code can do
 * about it. That is why this snippet is declared `verification: stubbed` on
 * the entry, and why the page says so next to the code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeLLM } from '../_harness/fake-llm.mjs';
import { cleanCsv } from './n0.js';
import { repairRejectedRows } from './n3.js';

const HEADER = ['id', 'name', 'joined', 'amount', 'active'];
const SCHEMA = {
  id: 'integer',
  name: 'text',
  joined: 'date',
  amount: 'number',
  active: 'boolean',
};

const REJECT = {
  line: 4,
  column: 'joined',
  reason: 'not a real date',
  fields: ['3', 'Carol', '31/02/2024', '3.5', 'yes'],
};

const GOOD_ANSWER = JSON.stringify({
  id: '3',
  name: 'Carol',
  joined: '2024-03-02',
  amount: '3.5',
  active: 'yes',
});

test('builds a request carrying the column, the reason and the fields', async () => {
  const client = new FakeLLM({ response: '{}' });
  await repairRejectedRows(HEADER, [REJECT], SCHEMA, { client });
  const { prompt } = client.lastRequest;
  assert.ok(prompt.includes('- joined: date')); // the type the column expects
  assert.ok(prompt.includes('not a real date')); // why rung N0 refused it
  assert.ok(prompt.includes('31/02/2024')); // the fields exactly as they were read
  // Temperature zero, because a repair that changes between two identical
  // calls cannot be reviewed.
  assert.equal(client.lastRequest.temperature, 0);
});

test('decodes the answer and puts it back through the coercion of N0', async () => {
  const client = new FakeLLM({ response: GOOD_ANSWER });
  const result = await repairRejectedRows(HEADER, [REJECT], SCHEMA, { client });
  assert.deepEqual(result.unrepairable, []);
  assert.deepEqual(result.rows, [
    { id: 3, name: 'Carol', joined: '2024-03-02', amount: 3.5, active: true },
  ]);
});

test('one call per refused row, and none for the rest', async () => {
  // This is the whole argument for putting a model on this rung at all.
  //
  // Six data rows, two of which rung N0 refused. Two calls are made, not six.
  // On a file of a hundred thousand rows the ratio is what decides whether
  // this rung is affordable or absurd.
  const data = Buffer.from(
    'id,name,joined,amount,active\n' +
      '1,Alice,2024-01-09,1.0,yes\n' +
      '2,Bob,2024-01-10,2.0,no\n' +
      '3,Carol,31/02/2024,3.5,yes\n' + // refused
      '4,Dan,2024-01-12,4.0,no\n' +
      '5,Eve,2024-01-13,nought,yes\n' + // refused
      '6,Frank,2024-01-14,6.0,no\n',
    'utf8',
  );
  const cleaned = cleanCsv(data, SCHEMA);
  assert.equal(cleaned.rows.length, 4);
  assert.equal(cleaned.rejects.length, 2);

  const client = new FakeLLM({ response: GOOD_ANSWER });
  await repairRejectedRows(cleaned.columns, cleaned.rejects, SCHEMA, { client });
  assert.equal(client.callCount, cleaned.rejects.length);
  assert.ok(client.callCount < cleaned.rows.length);
});

test('retries a provider failure', async () => {
  const client = new FakeLLM({ response: GOOD_ANSWER, failTimes: 2 });
  const result = await repairRejectedRows(HEADER, [REJECT], SCHEMA, { client, attempts: 3 });
  assert.equal(client.callCount, 3);
  assert.equal(result.rows.length, 1);
});

test('an unusable answer is recorded rather than swallowed', async () => {
  // The model can answer anything, including prose where JSON was asked for.
  const client = new FakeLLM({ response: 'Of course! Here is the corrected row:' });
  const result = await repairRejectedRows(HEADER, [REJECT], SCHEMA, { client });
  assert.deepEqual(result.rows, []);
  const [refused] = result.unrepairable;
  assert.equal(refused.line, 4);
  assert.deepEqual(refused.fields, REJECT.fields);
  assert.equal(refused.reason, 'the model did not return a usable object');
  // One call, not three: at temperature zero, asking again returns the same
  // prose and costs the same money.
  assert.equal(client.callCount, 1);
});

test('a repair that still does not coerce is refused again', async () => {
  const client = new FakeLLM({
    response: JSON.stringify({
      id: '3',
      name: 'Carol',
      joined: 'the second of March',
      amount: '3.5',
      active: 'yes',
    }),
  });
  const result = await repairRejectedRows(HEADER, [REJECT], SCHEMA, { client });
  assert.deepEqual(result.rows, []);
  const [refused] = result.unrepairable;
  assert.equal(refused.column, 'joined');
  assert.equal(refused.reason, 'the repair was refused too: not a date');
});

test('breaking point: a well-formed invention passes without resistance', async () => {
  // The dangerous answer is not the malformed one. It is the one that is
  // perfectly shaped and wrong.
  //
  // The refused row said "in the spring" where a date was expected. The model
  // answers with a date in the right format; it coerces; it lands among the
  // clean rows with nothing to tell it apart from a value that was actually in
  // the file. No check here can catch that, because a date is a date.
  //
  // Keep the journal, keep the original fields, and let a human look at what
  // was invented. That is all this rung can honestly offer.
  const reject = {
    line: 9,
    column: 'joined',
    reason: 'not a date',
    fields: ['7', 'Zoe', 'in the spring', '3.5', 'yes'],
  };
  const client = new FakeLLM({
    response: JSON.stringify({
      id: '7',
      name: 'Zoe',
      joined: '2024-03-01',
      amount: '3.5',
      active: 'yes',
    }),
  });
  const result = await repairRejectedRows(HEADER, [reject], SCHEMA, { client });

  assert.deepEqual(result.unrepairable, []);
  assert.equal(result.rows[0].joined, '2024-03-01');
  // Nothing in the file ever said the first of March.
  assert.ok(!reject.fields.includes('2024-03-01'));
});
