/**
 * These tests inject a local double instead of loading a real encoder.
 *
 * What they prove: the records are normalised the same way for every rung,
 * the encoder is called once with the whole batch, the vectors that come back
 * are turned into pairs correctly, and an encoder that fails or answers the
 * wrong shape throws rather than returning an empty result that reads like
 * "no duplicates found".
 *
 * What they do not prove: that a real encoder puts the right records close
 * together. That is why this snippet is declared `verification: stubbed` on
 * the entry, and why the page says so next to the code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeEncoder } from '../_harness/fake-model.mjs';
import { EncodingFailed, findDuplicates, recordText } from './n2.js';

const CUSTOMERS = [
  { name: 'Jean Dupont', address: '12 rue des Lilas', postcode: '75011', city: 'Paris' },
  { name: 'Dupont Jean', address: '12 rue des Lilas', postcode: '75011', city: 'Paris' },
  { name: 'Marie Martin', address: '5 avenue Victor Hugo', postcode: '69003', city: 'Lyon' },
];

// A catalogue: one product entered twice in two different wordings, and a
// third product that differs from the first by one character.
const CATALOGUE = [
  { name: 'Câble HDMI 2 m', brand: 'Belkin' },
  { name: 'HDMI lead, 2 metres, black', brand: 'Belkin' },
  { name: 'Câble HDMI 3 m', brand: 'Belkin' },
];

// Wide enough that two different words never land in the same dimension.
const encoder = () => new FakeEncoder(256);

/** A model that silently drops the last item of a batch. */
class TruncatedEncoder extends FakeEncoder {
  async encode(texts) {
    return (await super.encode(texts)).slice(0, -1);
  }
}

/** A model that cannot be run at all. */
const brokenEncoder = {
  encode: async () => {
    throw new Error('out of memory while loading the model');
  },
};

const indexesOf = (pairs) => pairs.map(([i, j]) => [i, j]);

test('finds the duplicate pair', async () => {
  assert.deepEqual(await findDuplicates(CUSTOMERS, { encoder: encoder() }), [[0, 1, 1]]);
});

test('encodes the whole file in one batched call', async () => {
  const fake = encoder();
  await findDuplicates(CUSTOMERS, { encoder: fake });
  assert.deepEqual(fake.calls, [CUSTOMERS.map(recordText)]);
});

test('a file too small to hold a pair never reaches the model', async () => {
  const fake = encoder();
  assert.deepEqual(await findDuplicates([CUSTOMERS[0]], { encoder: fake }), []);
  assert.deepEqual(fake.calls, []);
});

test('the threshold is yours to set', async () => {
  const loose = await findDuplicates(CUSTOMERS, { encoder: encoder(), threshold: 0 });
  assert.deepEqual(indexesOf(loose), [[0, 1], [0, 2], [1, 2]]);
});

test('blank records do not divide by zero', async () => {
  const blanks = [{ name: '', city: '' }, { name: '', city: '' }];
  assert.deepEqual(await findDuplicates(blanks, { encoder: encoder(), threshold: 0 }), [[0, 1, 0]]);
});

test('a truncated batch throws rather than losing a record', async () => {
  const truncated = new TruncatedEncoder(256);
  await assert.rejects(() => findDuplicates(CUSTOMERS, { encoder: truncated }), EncodingFailed);
});

test('a model that cannot run throws', async () => {
  await assert.rejects(() => findDuplicates(CUSTOMERS, { encoder: brokenEncoder }), EncodingFailed);
});

test('breaking point: one token of difference barely moves the vector', async () => {
  // A record is encoded as a whole, so the one token that tells two records
  // apart is a small part of a vector built from everything they share. Two
  // products one character apart score higher than the same product written
  // twice in different words.
  //
  // The double here is a bag of words, which makes the second half of that
  // sentence sharper than a real encoder would; the first half is the one
  // real encoders show too, and it is the one that merges two catalogue lines.
  const all = await findDuplicates(CATALOGUE, { encoder: encoder(), threshold: 0 });
  const scores = new Map(all.map(([i, j, s]) => [`${i},${j}`, s]));
  assert.ok(scores.get('0,2') > scores.get('0,1'));

  const found = await findDuplicates(CATALOGUE, { encoder: encoder() });
  // The two different cables, merged; the real pair, missed.
  assert.deepEqual(indexesOf(found), [[0, 2]]);
});
