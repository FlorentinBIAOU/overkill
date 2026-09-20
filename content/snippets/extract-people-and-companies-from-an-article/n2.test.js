import test from 'node:test';
import assert from 'node:assert/strict';

import { FakeClassifier } from '../_harness/fake-model.mjs';
import { extractNames as extractNamesN0 } from './n0.js';
import { LABELS, MAX_CHARACTERS, RecognitionUnavailable, extractNames } from './n2.js';

const ARTICLE = 'Le contrat lie la société Lumière SARL à Jean de La Fontaine et à '
  + 'Mme Marie Martin, de Lyon. M. Boulanger a livré le colis mercredi.';

const entites = (...trouvees) => ({
  entities: trouvees.map(([texte, label]) => ({
    text: texte,
    label,
    start: ARTICLE.indexOf(texte),
    end: ARTICLE.indexOf(texte) + texte.length,
  })),
});

const TROUVES = entites(['Lumière SARL', 'ORG'], ['Jean de La Fontaine', 'PER'],
  ['Marie Martin', 'PER'], ['Lyon', 'LOC'], ['Boulanger', 'PER']);

const double = (reponse = TROUVES) => new FakeClassifier({ [ARTICLE]: reponse }, { entities: [] });

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test("point de rupture : le modèle type tout et ne rend aucun doute", async () => {
  const lu = (await extractNames([ARTICLE], double(entites(['Lyon', 'ORG']))))[0];
  assert.deepEqual(lu.names, [{
    text: 'Lyon',
    type: 'company',
    evidence: 'ORG',
    start: ARTICLE.indexOf('Lyon'),
    end: ARTICLE.indexOf('Lyon') + 4,
  }]);
  assert.ok(!('score' in lu.names[0]));
});

test('point de rupture : témoin, le niveau N0 répond « unknown » sur le même nom', () => {
  const lyon = extractNamesN0(ARTICLE).names.find((n) => n.text === 'Lyon');
  assert.deepEqual([lyon.type, lyon.evidence], ['unknown', null]);
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('une étiquette non cartographiée est écartée et comptée', async () => {
  const lu = (await extractNames([ARTICLE],
    double(entites(['Lyon', 'LOC'], ['colis', 'MISC']))))[0];
  assert.deepEqual(lu.names.map((n) => n.text), ['Lyon']);
  assert.deepEqual(lu.unmapped, ['MISC']);
});

test('les étiquettes des deux jeux courants sont cartographiées', () => {
  assert.equal(LABELS.PER, 'person');
  assert.equal(LABELS.PERSON, 'person');
  assert.equal(LABELS.ORG, 'company');
  assert.equal(LABELS.LOC, 'place');
  assert.equal(LABELS.GPE, 'place');
});

test("un nom absent du texte envoyé est écarté", async () => {
  const menteur = new FakeClassifier(
    { [ARTICLE]: { entities: [{ text: 'Marseille', label: 'LOC', start: 0, end: 9 }] } },
    { entities: [] },
  );
  const lu = (await extractNames([ARTICLE], menteur))[0];
  assert.deepEqual(lu.names, []);
});

test('le texte est coupé au budget, pas refusé', async () => {
  const longTexte = ARTICLE.repeat(1000);
  const lu = (await extractNames([longTexte], new FakeClassifier({}, { entities: [] })))[0];
  assert.equal(lu.characters_read, MAX_CHARACTERS);
});

test('une panne du modèle est nommée', async () => {
  const casse = { predict: async () => { throw new Error('modèle introuvable'); } };
  await assert.rejects(() => extractNames([ARTICLE], casse), RecognitionUnavailable);
});

test("une réponse qui n'a pas la forme attendue est refusée", async () => {
  const bavard = { predict: async () => [{ entities: [] }, { entities: [] }] };
  await assert.rejects(() => extractNames([ARTICLE], bavard), RecognitionUnavailable);
});

test('le lot est envoyé en une fois', async () => {
  const client = double();
  await extractNames([ARTICLE, 'Autre texte.'], client);
  assert.deepEqual(client.calls, [[ARTICLE, 'Autre texte.']]);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : entrée banale, un paragraphe de presse', async () => {
  const lu = (await extractNames([ARTICLE], double()))[0];
  assert.deepEqual(lu.names.map((n) => [n.text, n.type]), [
    ['Lumière SARL', 'company'], ['Jean de La Fontaine', 'person'],
    ['Marie Martin', 'person'], ['Lyon', 'place'], ['Boulanger', 'person'],
  ]);
});

test('production : entrée vide', async () => {
  const lu = (await extractNames([''], new FakeClassifier({}, { entities: [] })))[0];
  assert.deepEqual(lu, { names: [], unmapped: [], characters_read: 0 });
});

test('production : valeurs aux limites', async () => {
  const vide = new FakeClassifier({}, { entities: [] });
  assert.deepEqual(await extractNames([], vide), []);
  assert.equal((await extractNames([null, 42], vide))[0].characters_read, 0);
  const muet = new FakeClassifier({}, {});
  assert.deepEqual((await extractNames([ARTICLE], muet))[0].names, []);
});

test("production : un texte illisible n'empêche pas de lire les autres", async () => {
  const rapports = await extractNames([ARTICLE, null], double());
  assert.equal(rapports[0].names.length, 5);
  assert.deepEqual(rapports[1].names, []);
});

test('production : la lecture tient la classe de latence annoncée', async () => {
  const client = double();
  const debut = performance.now();
  for (let i = 0; i < 500; i += 1) await extractNames([ARTICLE], client);
  assert.ok(performance.now() - debut < 10_000);
});
