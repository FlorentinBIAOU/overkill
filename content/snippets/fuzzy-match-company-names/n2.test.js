/**
 * Ces tests injectent un double local au lieu de charger un vrai encodeur.
 *
 * Ce qu'ils prouvent : le registre est encodé une fois et non à chaque requête,
 * les vecteurs sont ramenés à la longueur un, le cosinus est calculé et trié
 * comme l'extrait le dit, les égalités sont stables, topK plafonne la réponse.
 *
 * Ce qu'ils ne prouvent pas : que le modèle comprend quoi que ce soit. Le double
 * est un sac de mots ; sur la paire sigle contre raison sociale, il rend zéro.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeEncoder } from '../_harness/fake-model.mjs';
import { similarity } from './n0.js';
import { buildIndex as buildIndexN1, match as matchN1 } from './n1.js';
import { MODEL_NAME, buildIndex, match } from './n2.js';

const REGISTER = [
  'Boulangerie du Vieux Moulin',
  'Boulangerie du Vieux Port',
  'Le Vieux Moulin',
  'SNCF',
  'Société Nationale des Chemins de fer Français',
];
const SNCF_DEVELOPPEE = REGISTER.at(-1);

// Le vrai encodeur de l'extrait rend 384 nombres par nom ; le double aussi.
const DIMENSIONS = 384;

const makeIndex = () => buildIndex(REGISTER, new FakeEncoder(DIMENSIONS));
const ranked = async (query) => Object.fromEntries(await match(await makeIndex(), query, REGISTER.length));
const close = (a, b, tolerance = 1e-12) => Math.abs(a - b) <= tolerance;

// ---------------------------------------------------------------------------
// Point de rupture (contre le double)
// ---------------------------------------------------------------------------

test('point de rupture : avec le double, des mots ordinaires partagés l’emportent sur l’identité', async () => {
  const scores = await ranked('Boulangerie du Vieux Moulin');
  assert.ok(close(scores['Boulangerie du Vieux Port'], 0.75));
  assert.ok(close(scores['Le Vieux Moulin'], 1 / Math.sqrt(3)));
  assert.ok(scores['Boulangerie du Vieux Port'] > scores['Le Vieux Moulin']);
  // Témoin : le nom lui-même arrive premier, à 1.
  const [name, score] = (await match(await makeIndex(), 'Boulangerie du Vieux Moulin'))[0];
  assert.equal(name, 'Boulangerie du Vieux Moulin');
  assert.ok(close(score, 1));
});

test('point de rupture : le double score à zéro la paire de sigles', async () => {
  assert.equal((await ranked('SNCF'))[SNCF_DEVELOPPEE], 0);
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('N0 et N1 manquent tous deux la paire de sigles', () => {
  assert.ok(similarity('SNCF', SNCF_DEVELOPPEE) < 0.85);
  const index = buildIndexN1(['Boulangerie Martin SARL', 'Menuiserie Dubois SA', 'SNCF', SNCF_DEVELOPPEE]);
  assert.equal(matchN1(index, 'SNCF', 4).at(-1)[0], SNCF_DEVELOPPEE);
});

test("aucune forme juridique n'est retirée et rien n'est mis en minuscules", async () => {
  const encoder = new FakeEncoder(DIMENSIONS);
  const index = await buildIndex(['Boulangerie Martin SARL', 'CAFÉ DE LA GARE'], encoder);
  await match(index, 'BOULANGERIE martin sas');
  assert.deepEqual(encoder.calls, [['Boulangerie Martin SARL', 'CAFÉ DE LA GARE'], ['BOULANGERIE martin sas']]);
});

test("la casse est repliée par le double, pas par l'extrait", async () => {
  assert.deepEqual(
    await match(await makeIndex(), 'BOULANGERIE DU VIEUX MOULIN'),
    await match(await makeIndex(), 'Boulangerie du Vieux Moulin'),
  );
});

test("le registre est encodé une fois, pas à chaque requête", async () => {
  const encoder = new FakeEncoder(DIMENSIONS);
  const index = await buildIndex(REGISTER, encoder);
  assert.deepEqual(encoder.calls, [REGISTER]);
  await match(index, 'Le Vieux Moulin');
  await match(index, 'SNCF');
  assert.deepEqual(encoder.calls.slice(1), [['Le Vieux Moulin'], ['SNCF']]);
});

test('topK plafonne la réponse', async () => {
  assert.equal((await match(await makeIndex(), 'Le Vieux Moulin', 2)).length, 2);
});

test('le cosinus est un produit scalaire de vecteurs unitaires', async () => {
  const index = await makeIndex();
  for (const vector of index.vectors) assert.ok(close(Math.hypot(...vector), 1, 1e-9));
  assert.ok(close((await ranked('SNCF')).SNCF, 1));
});

test('un nom qui ne partage rien marque zéro', async () => {
  assert.equal((await ranked('Boulangerie du Vieux Moulin')).SNCF, 0);
});

test("les égalités reviennent dans l'ordre du registre", async () => {
  assert.deepEqual((await match(await makeIndex(), '', REGISTER.length)).map(([n]) => n), REGISTER);
  const register = ['Dupont', 'Martin', 'Dupont', 'Garage', 'Dupont'];
  const index = await buildIndex(register, new FakeEncoder(DIMENSIONS));
  assert.deepEqual((await match(index, 'Dupont', 5)).map(([n]) => n), ['Dupont', 'Dupont', 'Dupont', 'Martin', 'Garage']);
});

test("l'encodeur est injecté, et par défaut c'est le vrai", async () => {
  await assert.rejects(() => buildIndex(['Boulangerie Martin']), { code: 'ERR_MODULE_NOT_FOUND', message: /@xenova\/transformers/ });
  assert.equal(MODEL_NAME, 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');
});

test('un encodeur qui rend des Float32Array, comme Tensor.tolist en amont, est accepté', async () => {
  const inner = new FakeEncoder(DIMENSIONS);
  const encoder = { encode: async (texts) => (await inner.encode(texts)).map((v) => Float32Array.from(v)) };
  const index = await buildIndex(REGISTER, encoder);
  const [name, score] = (await match(index, 'Le Vieux Moulin'))[0];
  assert.equal(name, 'Le Vieux Moulin');
  assert.ok(close(score, 1, 1e-6));
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : un registre vide et une requête vide', async () => {
  assert.deepEqual(await match(await buildIndex([], new FakeEncoder(DIMENSIONS)), 'Martin'), []);
  assert.ok((await match(await makeIndex(), '', 5)).every(([, score]) => score === 0));
});

test('production : dix mille noms de 384 dimensions terminent', async () => {
  const names = Array.from({ length: 10_000 }, (_, k) => `Entreprise ${k} numero ${k % 97}`);
  const index = await buildIndex(names, new FakeEncoder(DIMENSIONS));
  const start = performance.now();
  const top = await match(index, names[4242]);
  assert.ok(performance.now() - start < 2000);
  assert.equal(top[0][0], names[4242]);
});

test("production : accents NFD, emoji, marque d'ordre et entrée énorme passent à l'encodeur sans erreur", async () => {
  const index = await makeIndex();
  for (const query of ['Société Nationale', '🍞 Boulangerie', '﻿SNCF', 'a'.repeat(100_000)]) {
    assert.equal((await match(index, query)).length, 3);
  }
});
