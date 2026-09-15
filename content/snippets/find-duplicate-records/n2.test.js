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
import { readFileSync } from 'node:fs';
import { FakeEncoder } from '../_harness/fake-model.mjs';
import { EncodingFailed, MODEL_NAME, findDuplicates, normalise, recordText } from './n2.js';
import * as n0 from './n0.js';
import * as n1 from './n1.js';

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

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

// Wide enough that two different words never land in the same dimension.
const encoder = () => new FakeEncoder(256);

/** A model that silently drops the last item of a batch. */
class TruncatedEncoder extends FakeEncoder {
  async encode(texts) {
    return (await super.encode(texts)).slice(0, -1);
  }
}

/** A model that answers one vector too many. */
class PaddedEncoder extends FakeEncoder {
  async encode(texts) {
    const vectors = await super.encode(texts);
    return [...vectors, vectors.at(-1)];
  }
}

/** A model that cannot be run at all. */
const brokenEncoder = {
  encode: async () => {
    throw new Error('out of memory while loading the model');
  },
};

const given = (vectors) => ({ encode: async () => vectors });
const indexesOf = (pairs) => pairs.map(([i, j]) => [i, j]);

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : « Câble HDMI 2 m » est plus proche de « 3 m » que de la même référence en anglais', async () => {
  // Le double local écrit ces vecteurs : ce que ferait un vrai encodeur n'est pas testé ici.
  const scores = new Map((await findDuplicates(CATALOGUE, { encoder: encoder(), threshold: 0 })).map(([i, j, s]) => [`${i},${j}`, s]));
  assert.ok(scores.get('0,2') > scores.get('0,1'));
});

test('point de rupture : au seuil par défaut, les deux câbles différents sont rapprochés et le vrai doublon raté', async () => {
  assert.deepEqual(indexesOf(await findDuplicates(CATALOGUE, { encoder: encoder() })), [[0, 2]]);
  // Witness: the customer file, where the duplicate shares its words, is found.
  assert.deepEqual(await findDuplicates(CUSTOMERS, { encoder: encoder() }), [[0, 1, 1]]);
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('trouve la paire en doublon', async () => {
  assert.deepEqual(await findDuplicates(CUSTOMERS, { encoder: encoder() }), [[0, 1, 1]]);
});

test('encode tout le fichier en un seul appel groupé', async () => {
  const fake = encoder();
  await findDuplicates(CUSTOMERS, { encoder: fake });
  assert.deepEqual(fake.calls, [CUSTOMERS.map(recordText)]);
});

test('les fiches sont normalisées de la même façon à chaque niveau', () => {
  for (const text of ['Jean DUPÔNT', '  Société-Générale,  Paris ', 'Câble HDMI 2 m']) {
    assert.equal(normalise(text), n0.normalise(text));
    assert.equal(normalise(text), n1.normalise(text));
  }
});

test('un fichier trop petit pour une paire n’atteint jamais le modèle', async () => {
  const fake = encoder();
  assert.deepEqual(await findDuplicates([CUSTOMERS[0]], { encoder: fake }), []);
  assert.deepEqual(await findDuplicates([], { encoder: fake }), []);
  assert.deepEqual(fake.calls, []);
});

test('le seuil est à vous, et toutes les paires sont comparées', async () => {
  const loose = await findDuplicates(CUSTOMERS, { encoder: encoder(), threshold: 0 });
  assert.deepEqual(indexesOf(loose), [[0, 1], [0, 2], [1, 2]]);
});

test('des fiches vides ne divisent pas par zéro', async () => {
  const blanks = [{ name: '', city: '' }, { name: '', city: '' }];
  assert.deepEqual(await findDuplicates(blanks, { encoder: encoder(), threshold: 0 }), [[0, 1, 0]]);
});

test('un lot tronqué ou trop long lève plutôt que perdre une fiche', async () => {
  await assert.rejects(() => findDuplicates(CUSTOMERS, { encoder: new TruncatedEncoder(256) }), EncodingFailed);
  await assert.rejects(() => findDuplicates(CUSTOMERS, { encoder: new PaddedEncoder(256) }), EncodingFailed);
});

test('un modèle qui ne tourne pas lève', async () => {
  await assert.rejects(() => findDuplicates(CUSTOMERS, { encoder: brokenEncoder }), EncodingFailed);
});

test('DÉFAUT : des vecteurs de mauvaise forme ne lèvent pas', async () => {
  // Dimensions différentes : NaN, la paire disparaît en silence ; NaN dans un vecteur : idem.
  await assert.rejects(async () => {
    for (const vectors of [[[1, 0, 0], [1, 0]], [[Number.NaN, 0], [1, 0]]]) {
      await assert.rejects(() => findDuplicates([{ a: 'x' }, { a: 'y' }], { encoder: given(vectors), threshold: 0 }), EncodingFailed);
    }
  });
});

test('l’encodeur par défaut est multilingue et n’est chargé que sans double', () => {
  assert.equal(MODEL_NAME, 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');
  const source = readFileSync(new URL('./n2.js', import.meta.url), 'utf8');
  assert.match(source, /pipeline\('feature-extraction', MODEL_NAME\)/);
  assert.match(source, /pooling: 'mean'/);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : mille fiches dans une borne large', async () => {
  const records = Array.from({ length: 1000 }, (_, i) => ({ name: `Client ${i} ${LETTERS[i % 26]}${LETTERS[(i * 7) % 26]}`, city: 'Paris' }));
  const debut = performance.now();
  await findDuplicates(records, { encoder: new FakeEncoder(32) });
  assert.ok(performance.now() - debut < 60_000);
});

test('production : accents décomposés, espaces insécables et casse partent normalisés', async () => {
  const fake = encoder();
  await findDuplicates([{ name: 'Jean\u00a0DUPO\u0302NT' }, { name: 'Jean Dupont' }], { encoder: fake });
  assert.deepEqual(fake.calls, [['jean dupont', 'jean dupont']]);
});

test('DÉFAUT : des fiches identiques ne sortent pas au seuil un', async () => {
  // Le produit scalaire de deux vecteurs unitaires identiques vaut
  // 0,9999999999999999 par arrondi flottant ; Python les rend.
  await assert.rejects(async () => {
    assert.deepEqual(await findDuplicates([CUSTOMERS[0], { ...CUSTOMERS[0] }], { encoder: encoder(), threshold: 1 }), [[0, 1, 1]]);
  });
});
