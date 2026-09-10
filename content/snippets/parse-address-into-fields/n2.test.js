/**
 * These tests inject a local double instead of installing the real parser.
 *
 * What they prove: the batch is sent in one call, an oversized address is
 * refused before anything is parsed, a failed call is retried, the parser's
 * label set is mapped onto ours, and an answer we cannot use throws rather than
 * returning fields that are quietly wrong.
 *
 * What they do not prove: that libpostal labels addresses well. That is why
 * this snippet is declared `verification: stubbed` on the entry, and why the
 * page says so next to the code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeClassifier } from '../_harness/fake-model.mjs';
import { FIELDS, MAX_CHARACTERS, ParsingUnavailable, parseAddresses } from './n2.js';

// Invented addresses, and the components libpostal would return for them, in
// its own vocabulary. The values are ours, so the test exercises our mapping
// and not the model's opinions.
const FRENCH = '8 rue des Lilas, Appartement 12, 75011 Paris';
const GERMAN = 'Hauptstrasse 5, 10115 Berlin';
const BRITISH = '42 Rowan Street, Bristol BS1 4TQ';

const COMPONENTS = {
  [FRENCH]: {
    house_number: '8',
    road: 'rue des lilas',
    unit: 'appartement 12',
    postcode: '75011',
    city: 'paris',
  },
  [GERMAN]: { house_number: '5', road: 'hauptstrasse', postcode: '10115', city: 'berlin' },
  [BRITISH]: { house_number: '42', road: 'rowan street', postcode: 'bs1 4tq', city: 'bristol' },
};

const empty = Object.fromEntries(FIELDS.map((name) => [name, '']));

test('parses an address into our fields', async () => {
  const parser = new FakeClassifier(COMPONENTS);
  assert.deepEqual(await parseAddresses([FRENCH], parser), [
    {
      number: '8',
      street: 'rue des lilas',
      complement: 'appartement 12',
      postcode: '75011',
      city: 'paris',
    },
  ]);
});

test('reads the foreign addresses that broke the rungs below', async () => {
  // The gain of this rung: the number after the street, and a postcode that is
  // not five digits, are conventions the model was trained on.
  const parser = new FakeClassifier(COMPONENTS);
  const [german, british] = await parseAddresses([GERMAN, BRITISH], parser);
  assert.equal(german.number, '5');
  assert.equal(german.street, 'hauptstrasse');
  assert.equal(british.postcode, 'bs1 4tq');
  assert.equal(british.city, 'bristol');
});

test('sends the whole batch in one call', async () => {
  const parser = new FakeClassifier(COMPONENTS);
  await parseAddresses([FRENCH, GERMAN, BRITISH], parser);
  assert.deepEqual(parser.calls, [[FRENCH, GERMAN, BRITISH]]);
});

test('joins the labels that share one field and drops the rest', async () => {
  // Two complements in one address, and a country we have no field for.
  const parser = new FakeClassifier({
    [FRENCH]: { level: 'étage 3', unit: 'porte b', country: 'france' },
  });
  const [parsed] = await parseAddresses([FRENCH], parser);
  assert.equal(parsed.complement, 'étage 3 porte b');
  assert.deepEqual(Object.keys(parsed).sort(), [...FIELDS].sort());
});

test('an empty answer gives empty fields rather than an error', async () => {
  const parser = new FakeClassifier({ [FRENCH]: {} });
  assert.deepEqual(await parseAddresses([FRENCH], parser), [empty]);
});

test('an empty batch never reaches the parser', async () => {
  const parser = new FakeClassifier(COMPONENTS);
  assert.deepEqual(await parseAddresses([], parser), []);
  assert.deepEqual(parser.calls, []);
});

test('refuses an oversized address before parsing anything', async () => {
  const parser = new FakeClassifier(COMPONENTS);
  await assert.rejects(
    () => parseAddresses([FRENCH, 'x'.repeat(MAX_CHARACTERS + 1)], parser),
    RangeError,
  );
  assert.deepEqual(parser.calls, []);
});

test('retries a failed call', async () => {
  // The data files are mapped on the first call, and that is the one that
  // fails when the machine is short of memory.
  const parser = {
    calls: 0,
    async predict(addresses) {
      this.calls += 1;
      if (this.calls === 1) throw new Error('model not loaded');
      return addresses.map((a) => COMPONENTS[a]);
    },
  };
  const [parsed] = await parseAddresses([FRENCH], parser);
  assert.equal(parsed.postcode, '75011');
  assert.equal(parser.calls, 2);
});

test('a lasting failure throws rather than returning nothing', async () => {
  const parser = { predict: async () => { throw new Error('model not loaded'); } };
  await assert.rejects(() => parseAddresses([FRENCH], parser), ParsingUnavailable);
});

test('a short answer throws rather than misaligning the addresses', async () => {
  const parser = { predict: async () => [COMPONENTS[FRENCH]] };
  await assert.rejects(() => parseAddresses([FRENCH, GERMAN], parser), ParsingUnavailable);
});

test('breaking point: the parser always answers and never doubts', async () => {
  // It parses, it does not validate. libpostal returns labels, never a score
  // and never a refusal. Handed a line that is not an address at all, it splits
  // it into fields that look exactly like a real result, and nothing in the
  // code can tell the difference. A typo in a house number, an invented street,
  // a postcode that belongs to another town: all come back as clean fields.
  //
  // Checking that an address exists is a different job, done against a
  // reference file of streets, and this rung does not do it.
  const nonsense = 'the meeting is at ten in room four';
  let parser = new FakeClassifier({ [nonsense]: { house_number: 'ten', road: 'room four' } });
  const [parsed] = await parseAddresses([nonsense], parser);
  assert.equal(parsed.number, 'ten');
  assert.equal(parsed.street, 'room four');

  // Same shape, on an address that is plausible and simply wrong: nothing
  // distinguishes it from the correct one above.
  const wrongTown = '8 rue des Lilas, 75011 Lyon';
  parser = new FakeClassifier({
    [wrongTown]: { road: 'rue des lilas', postcode: '75011', city: 'lyon' },
  });
  const [confident] = await parseAddresses([wrongTown], parser);
  assert.equal(confident.city, 'lyon');
});
