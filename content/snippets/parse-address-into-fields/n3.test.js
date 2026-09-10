/**
 * These tests inject a local double instead of calling a provider.
 *
 * What they prove: the request is built correctly, the answer is decoded
 * correctly, an oversized address is refused before anything is spent, a
 * failure is retried, an invented field is dropped, and an unusable answer
 * throws rather than returning fields nobody can trust.
 *
 * What they do not prove: that the model splits addresses well. That is why
 * this snippet is declared `verification: stubbed` on the entry, and why the
 * page says so next to the code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeLLM } from '../_harness/fake-llm.mjs';
import { FIELDS, MAX_CHARACTERS, ParsingUnavailable, parse } from './n3.js';

// Invented addresses. None is the home of a real person, and none is the
// registered office of a real company.
const FRENCH = '8 rue des Lilas, Appartement 12, 75011 Paris';

test('decodes the fields the model returns', async () => {
  const client = new FakeLLM({
    response: JSON.stringify({
      number: '8',
      street: 'rue des Lilas',
      complement: 'Appartement 12',
      postcode: '75011',
      city: 'Paris',
    }),
  });
  assert.deepEqual(await parse(FRENCH, { client }), {
    number: '8',
    street: 'rue des Lilas',
    complement: 'Appartement 12',
    postcode: '75011',
    city: 'Paris',
  });
});

test('sends the address inside the prompt, at temperature zero', async () => {
  const client = new FakeLLM({ response: '{}' });
  await parse(FRENCH, { client });
  assert.ok(client.lastRequest.prompt.includes(FRENCH));
  // An address that splits differently between two identical calls cannot be
  // reconciled with anything.
  assert.equal(client.lastRequest.temperature, 0);
});

test('a missing field comes back empty', async () => {
  const client = new FakeLLM({ response: '{"street": "rue des Lilas", "city": "Paris"}' });
  const parsed = await parse('rue des Lilas, Paris', { client });
  assert.equal(parsed.number, '');
  assert.equal(parsed.postcode, '');
  assert.deepEqual(Object.keys(parsed).sort(), [...FIELDS].sort());
});

test('accepts the case and spacing the model changed', async () => {
  // Rewriting the case is the model tidying up; rewriting the words is not.
  const client = new FakeLLM({ response: '{"city": "PARIS", "street": "Rue  des Lilas"}' });
  const parsed = await parse(FRENCH, { client });
  assert.equal(parsed.city, 'PARIS');
  assert.equal(parsed.street, 'Rue  des Lilas');
});

test('drops a field the model invented', async () => {
  // The address carries no postcode. The model supplies a plausible one, and a
  // plausible postcode is worse than an empty field: nothing downstream would
  // ever question it.
  const client = new FakeLLM({
    response: '{"street": "rue des Lilas", "postcode": "75011", "city": "Paris"}',
  });
  const parsed = await parse('rue des Lilas, Paris', { client });
  assert.equal(parsed.postcode, '');
  assert.equal(parsed.street, 'rue des Lilas');
  assert.equal(parsed.city, 'Paris');
});

test('refuses an oversized address before spending anything', async () => {
  const client = new FakeLLM({ response: '{}' });
  await assert.rejects(() => parse('x'.repeat(MAX_CHARACTERS + 1), { client }), RangeError);
  assert.equal(client.callCount, 0);
});

test('retries a provider failure', async () => {
  const client = new FakeLLM({ response: '{}', failTimes: 2 });
  await parse(FRENCH, { client, attempts: 3 });
  assert.equal(client.callCount, 3);
});

test('an unusable answer throws rather than returning empty fields', async () => {
  // Prose where JSON was asked for, and a list where an object was asked for.
  // Returning five empty fields would look exactly like an address that has no
  // fields, and the caller would never know the difference.
  for (const response of ['Sure! Here is the address split into fields:', '["8", "rue des Lilas"]']) {
    await assert.rejects(() => parse(FRENCH, { client: new FakeLLM({ response }) }), ParsingUnavailable);
  }
});

test('breaking point: the check covers provenance, not correctness', async () => {
  // The guard proves where a value came from, and nothing more. Here the model
  // has swapped the street and the town. Both values were copied from the
  // address, so both pass the check, and the answer comes back neatly
  // structured and wrong. Catching this would take a reference file of streets
  // and towns — which is another rung's job, and a cost this one is usually
  // assumed not to have.
  const address = '12 rue de Lille, 59000 Lille';
  const client = new FakeLLM({
    response: '{"number": "12", "street": "Lille", "city": "rue de Lille"}',
  });
  const parsed = await parse(address, { client });
  assert.equal(parsed.street, 'Lille');
  assert.equal(parsed.city, 'rue de Lille');
});
