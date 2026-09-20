import test from 'node:test';
import assert from 'node:assert/strict';

import { FakeLLM } from '../_harness/fake-llm.mjs';
import { FakeSDK } from '../_harness/fake-sdk.mjs';
import { MAX_CHARACTERS, MODEL, ReadingUnavailable, providerClient, readAmounts } from './n3.js';

// La devise est écrite une fois, en tête ; les montants n'ont rien à côté
// d'eux. C'est le cas que le niveau N0 signale et ne sait pas lire.
const ENTETE = 'Facture n° 2026-118. Montants exprimés en euros.\n'
  + 'Sous-total : 1 250,00\nRemise : 125,00\nTotal : 1 125,00';

const TROUVES = [
  { text: '1 250,00', currency: 'EUR' },
  { text: '125,00', currency: 'EUR' },
  { text: '1 125,00', currency: 'EUR' },
];

const double = (amounts, extra = {}) => new FakeLLM({
  response: JSON.stringify({ amounts }), ...extra,
});

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test("point de rupture : la garde vérifie d'où vient un nombre, pas ce qu'il désigne", async () => {
  const client = double([{ text: '2026', currency: 'EUR' }]);
  const rapport = await readAmounts(ENTETE, 'fr', { client });
  assert.deepEqual(rapport.dropped, []);
  assert.equal(rapport.amounts[0].value, '2026'); // le numéro de facture
});

test('point de rupture : témoin, un total absent du document est écarté', async () => {
  const client = double([...TROUVES, { text: '9 999,00', currency: 'EUR' }]);
  const rapport = await readAmounts(ENTETE, 'fr', { client });
  assert.deepEqual(rapport.amounts.map((a) => a.value), ['1250.00', '125.00', '1125.00']);
  assert.deepEqual(rapport.dropped, [{ text: '9 999,00', why: 'not in the document' }]);
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('une devise nommée nulle part dans le document est refusée', async () => {
  const client = double([{ text: '1 250,00', currency: 'USD' }]);
  const rapport = await readAmounts(ENTETE, 'fr', { client });
  assert.deepEqual(rapport.amounts, []);
  assert.equal(rapport.dropped[0].why, 'USD is named nowhere in the document');
});

test("une devise qui n'est pas un code est refusée", async () => {
  const client = double([{ text: '1 250,00', currency: 'euros' }]);
  const rapport = await readAmounts(ENTETE, 'fr', { client });
  assert.equal(rapport.dropped[0].why, 'EUROS is not a code this rung knows');
});

test('la valeur est relue par le niveau N0, pas par le modèle', async () => {
  const un = await readAmounts(ENTETE, 'fr', { client: double([TROUVES[0]]) });
  assert.equal(un.amounts[0].value, '1250.00');
  const deux = await readAmounts(ENTETE, 'en', { client: double([TROUVES[0]]) });
  assert.equal(deux.amounts[0].value, '1250.00');
});

test('le document est coupé au budget, pas refusé', async () => {
  const longDoc = ENTETE + ' euros '.repeat(5000);
  const rapport = await readAmounts(longDoc, 'fr', { client: double([]) });
  assert.equal(rapport.characters_sent, MAX_CHARACTERS);
});

test('la requête porte le document', async () => {
  const client = double(TROUVES);
  await readAmounts(ENTETE, 'fr', { client });
  assert.ok(client.lastRequest.prompt.includes('Montants exprimés en euros.'));
});

test('une réponse dans une clôture de code est décodée', async () => {
  const client = new FakeLLM({
    response: '```json\n{"amounts": [{"text": "125,00", "currency": "EUR"}]}\n```',
  });
  const rapport = await readAmounts(ENTETE, 'fr', { client });
  assert.equal(rapport.amounts[0].value, '125.00');
});

test("un refus du modèle n'est pas passé au décodeur", async () => {
  const client = { complete: async () => null };
  await assert.rejects(
    () => readAmounts(ENTETE, 'fr', { client, attempts: 1 }),
    ReadingUnavailable,
  );
});

test('une panne est retentée le nombre de fois annoncé', async () => {
  const client = double(TROUVES, { failTimes: 2 });
  assert.equal((await readAmounts(ENTETE, 'fr', { client })).amounts.length, 3);
  const trop = double(TROUVES, { failTimes: 3 });
  await assert.rejects(() => readAmounts(ENTETE, 'fr', { client: trop }), ReadingUnavailable);
  assert.equal(trop.callCount, 3);
});

test("l'adaptateur par défaut parle au vrai kit", async () => {
  const sdk = new FakeSDK({ content: JSON.stringify({ amounts: TROUVES }) });
  const client = await providerClient(sdk);
  const rapport = await readAmounts(ENTETE, 'fr', { client });
  assert.equal(rapport.amounts.length, 3);
  const envoye = sdk.lastRequest;
  assert.equal(envoye.endpoint, 'chat.completions');
  assert.equal(envoye.model, MODEL);
  assert.equal(envoye.temperature, 0);
  assert.equal(envoye.messages[0].role, 'user');
  assert.ok(envoye.messages[0].content.includes('Sous-total : 1 250,00'));
  const muet = await providerClient(new FakeSDK({ content: null }));
  await assert.rejects(
    () => readAmounts(ENTETE, 'fr', { client: muet, attempts: 1 }),
    ReadingUnavailable,
  );
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : entrée banale, un document à devise en entête', async () => {
  const rapport = await readAmounts(ENTETE, 'fr', { client: double(TROUVES) });
  assert.equal(rapport.source, 'model');
  assert.deepEqual(rapport.amounts.map((a) => a.currency), ['EUR', 'EUR', 'EUR']);
});

test('production : entrée vide', async () => {
  const rapport = await readAmounts('', 'fr', { client: double([]) });
  assert.deepEqual(rapport.amounts, []);
  assert.equal(rapport.characters_sent, 0);
});

test('production : encodages inattendus', async () => {
  const insecable = ENTETE.replace('1 250,00', '1 250,00');
  const client = double([{ text: '1 250,00', currency: 'EUR' }]);
  const rapport = await readAmounts(insecable, 'fr', { client });
  assert.equal(rapport.amounts[0].value, '1250.00');
});

test('production : valeurs aux limites', async () => {
  assert.deepEqual((await readAmounts(ENTETE, 'fr', { client: double([]) })).amounts, []);
  const liste = new FakeLLM({ response: '[]' });
  assert.deepEqual((await readAmounts(ENTETE, 'fr', { client: liste })).amounts, []);
  const texte = new FakeLLM({ response: '{"amounts": "1 250,00"}' });
  assert.deepEqual((await readAmounts(ENTETE, 'fr', { client: texte })).amounts, []);
  const vide = await readAmounts(ENTETE, 'fr', { client: double([{ text: '', currency: 'EUR' }]) });
  assert.equal(vide.dropped[0].why, 'not in the document');
});

test("production : un montant écarté n'empêche pas de garder les autres", async () => {
  const client = double([{ text: '9 999,00', currency: 'EUR' }, ...TROUVES]);
  const rapport = await readAmounts(ENTETE, 'fr', { client });
  assert.equal(rapport.amounts.length, 3);
  assert.equal(rapport.dropped.length, 1);
});

test('production : la lecture tient la classe de latence annoncée', async () => {
  const debut = performance.now();
  for (let i = 0; i < 200; i += 1) {
    await readAmounts(ENTETE, 'fr', { client: double(TROUVES) });
  }
  assert.ok(performance.now() - debut < 10_000);
});
