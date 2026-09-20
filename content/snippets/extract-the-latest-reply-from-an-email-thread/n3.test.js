import test from 'node:test';
import assert from 'node:assert/strict';

import { FakeLLM } from '../_harness/fake-llm.mjs';
import { FakeSDK } from '../_harness/fake-sdk.mjs';
import { MAX_CHARACTERS, MODEL, ReadingUnavailable, providerClient, readReply } from './n3.js';

// La réponse est écrite entre les lignes citées : c'est le cas pour lequel ce
// niveau existe, et le seul que le niveau N0 ne sait pas lire.
const FIL_INTERCALE = `Le 10 octobre 2026 à 13:55, Marie Martin <marie@exemple.fr> a écrit :
> Pouvez-vous confirmer le devis DV-2026-118 avant vendredi ?
Oui, il est signé de ce matin.
> Et la livraison est-elle toujours prévue le 20 ?
Non, le 22 : le transporteur a décalé la tournée.
`;

// Outlook recopie l'ancien message sans le préfixer.
const FIL_OUTLOOK_FR = `Bonjour Marie,

C'est noté, je m'en occupe.

Jean

________________________________
De : Marie Martin <marie@exemple.fr>
Envoyé : jeudi 10 octobre 2026 13:55
À : Jean Dupont <jean@exemple.fr>
Objet : RE: Devis DV-2026-118

Bonjour Jean,
Pouvez-vous confirmer le devis avant vendredi ?
Marie
`;

const double = (lignes, extra = {}) => new FakeLLM({
  response: JSON.stringify({ lines: lignes }), ...extra,
});

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : la garde refuse une ligne citée, pas une ligne ancienne', async () => {
  // Lignes 13 et 14 : le message de la semaine dernière, sous le trait.
  const rapport = await readReply(FIL_OUTLOOK_FR, { client: double([13, 14]) });
  assert.deepEqual(rapport.dropped, []);
  assert.equal(rapport.reply, 'Bonjour Jean,\nPouvez-vous confirmer le devis avant vendredi ?');
});

test('point de rupture : témoin, une ligne citée est bien écartée', async () => {
  const rapport = await readReply(FIL_INTERCALE, { client: double([2, 3]) });
  assert.deepEqual(rapport.dropped, [2]);
  assert.deepEqual(rapport.lines, [3]);
  assert.equal(rapport.reply, 'Oui, il est signé de ce matin.');
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('la réponse est faite de lignes du fil, dans leur ordre', async () => {
  const rapport = await readReply(FIL_INTERCALE, { client: double([5, 3, 3]) });
  assert.deepEqual(rapport.lines, [3, 5]);
  assert.equal(rapport.reply, 'Oui, il est signé de ce matin.\n'
    + 'Non, le 22 : le transporteur a décalé la tournée.');
});

test("un numéro qui n'est pas une ligne du fil est écarté", async () => {
  const rapport = await readReply(FIL_INTERCALE, { client: double([0, 3, 99, 'trois', null, 2.5]) });
  assert.deepEqual(rapport.lines, [3]);
  assert.deepEqual(rapport.dropped, [0, 99, 'trois', null, 2.5]);
});

test('le fil est coupé au budget, pas refusé', async () => {
  const longFil = 'ligne\n'.repeat(5000);
  const rapport = await readReply(longFil, { client: double([1]) });
  assert.equal(rapport.characters_sent, MAX_CHARACTERS);
});

test('la requête porte le fil numéroté ligne à ligne', async () => {
  const client = double([3]);
  await readReply(FIL_INTERCALE, { client });
  const envoye = client.lastRequest.prompt;
  assert.ok(envoye.includes('3: Oui, il est signé de ce matin.'));
  assert.ok(envoye.includes('2: > Pouvez-vous confirmer'));
});

test('une réponse dans une clôture de code est décodée', async () => {
  const client = new FakeLLM({ response: '```json\n{"lines": [3]}\n```' });
  assert.deepEqual((await readReply(FIL_INTERCALE, { client })).lines, [3]);
});

test("un refus du modèle n'est pas passé au décodeur", async () => {
  const client = { complete: async () => null };
  await assert.rejects(
    () => readReply(FIL_INTERCALE, { client, attempts: 1 }),
    ReadingUnavailable,
  );
});

test('une panne est retentée le nombre de fois annoncé', async () => {
  const client = double([3], { failTimes: 2 });
  assert.deepEqual((await readReply(FIL_INTERCALE, { client })).lines, [3]);
  const trop = double([3], { failTimes: 3 });
  await assert.rejects(() => readReply(FIL_INTERCALE, { client: trop }), ReadingUnavailable);
  assert.equal(trop.callCount, 3);
});

test("l'adaptateur par défaut parle au vrai kit", async () => {
  const sdk = new FakeSDK({ content: JSON.stringify({ lines: [3, 5] }) });
  const client = await providerClient(sdk);
  const rapport = await readReply(FIL_INTERCALE, { client });
  assert.deepEqual(rapport.lines, [3, 5]);
  const envoye = sdk.lastRequest;
  assert.equal(envoye.endpoint, 'chat.completions');
  assert.equal(envoye.model, MODEL);
  assert.equal(envoye.temperature, 0);
  assert.equal(envoye.messages[0].role, 'user');
  assert.ok(envoye.messages[0].content.includes('1: Le 10 octobre 2026'));
  // Un refus du fournisseur : content nul, lu comme tel.
  const muet = await providerClient(new FakeSDK({ content: null }));
  await assert.rejects(
    () => readReply(FIL_INTERCALE, { client: muet, attempts: 1 }),
    ReadingUnavailable,
  );
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : entrée banale, une réponse intercalée', async () => {
  const rapport = await readReply(FIL_INTERCALE, { client: double([3, 5]) });
  assert.equal(rapport.source, 'model');
  assert.ok(rapport.reply.includes('Oui, il est signé de ce matin.'));
});

test('production : entrée vide', async () => {
  const rapport = await readReply('', { client: double([]) });
  assert.equal(rapport.reply, '');
  assert.equal(rapport.characters_sent, 0);
});

test('production : encodages inattendus', async () => {
  const crlf = FIL_INTERCALE.replaceAll('\n', '\r\n');
  assert.equal((await readReply(crlf, { client: double([3]) })).reply,
    'Oui, il est signé de ce matin.');
  const cr = FIL_INTERCALE.replaceAll('\n', '\r');
  assert.equal((await readReply(cr, { client: double([3]) })).reply,
    'Oui, il est signé de ce matin.');
});

test('production : valeurs aux limites', async () => {
  assert.equal((await readReply(FIL_INTERCALE, { client: double([]) })).reply, '');
  const liste = new FakeLLM({ response: '[3]' });
  assert.deepEqual((await readReply(FIL_INTERCALE, { client: liste })).lines, []);
  const texte = new FakeLLM({ response: '{"lines": "3"}' });
  assert.deepEqual((await readReply(FIL_INTERCALE, { client: texte })).lines, []);
});

test("production : une ligne refusée n'empêche pas de garder les autres", async () => {
  const rapport = await readReply(FIL_INTERCALE, { client: double([2, 3, 5]) });
  assert.deepEqual(rapport.lines, [3, 5]);
  assert.deepEqual(rapport.dropped, [2]);
});

test('production : la lecture tient la classe de latence annoncée', async () => {
  const debut = performance.now();
  for (let i = 0; i < 200; i += 1) {
    await readReply(FIL_INTERCALE, { client: double([3, 5]) });
  }
  assert.ok(performance.now() - debut < 10_000);
});
