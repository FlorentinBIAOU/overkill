/**
 * These tests inject a local double instead of loading the real encoder.
 *
 * What they prove: the archive is encoded once and not once per query, the
 * vectors are brought to length one, the cosine is computed and voted on the
 * way the snippet claims, the floor sends an unknown ticket to the default
 * queue, and ties are resolved the way the docstring says.
 *
 * What they do not prove: that the encoder understands anything. The double is
 * a bag of words, so the very pair this rung exists for — a ticket and its
 * paraphrase, sharing no word — scores near nothing. That is asserted below
 * rather than hidden, and it is why the entry declares this snippet `stubbed`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { performance } from 'node:perf_hooks';
import { FakeEncoder } from '../_harness/fake-model.mjs';
import { DEFAULT_TEAM, MODEL_NAME, buildIndex, neighbours, route } from './n2.js';

// Resolved tickets, and the team that resolved each one.
const ARCHIVE = [
  ['Ma facture de janvier est trop élevée', 'billing'],
  ['Le prélèvement est passé deux fois ce mois-ci', 'billing'],
  ['Bonjour, merci de me confirmer le remboursement de ma commande', 'billing'],
  ['Impossible de me connecter depuis ce matin', 'technical'],
  ["L'application plante quand j'ouvre le tableau de bord", 'technical'],
  ["J'ai perdu mon mot de passe", 'technical'],
  ["Mon colis n'est toujours pas arrivé", 'shipping'],
  ['La livraison a été annulée par le transporteur', 'shipping'],
  ["Le suivi indique livré mais je n'ai rien reçu", 'shipping'],
];

const TICKETS = ARCHIVE.map(([ticket]) => ticket);
const TEAMS = ARCHIVE.map(([, team]) => team);

// The real encoder of this snippet returns 384 numbers per ticket; the double
// is asked for the same width, so the test exercises the real shape.
const DIMENSIONS = 384;

const POLITENESS = 'Bonjour, merci de me confirmer que vous avez bien reçu mon dossier';

const makeIndex = (encoder, tickets = TICKETS, teams = TEAMS) =>
  buildIndex(tickets, teams, encoder ?? new FakeEncoder(DIMENSIONS));

/** Un encodeur dont chaque vecteur est écrit dans le test. */
const vecteursDonnes = (vecteurs) => ({ encode: async (texts) => texts.map((t) => vecteurs[t]) });

/*
 * Un faux module `@huggingface/transformers` à la forme publiée :
 * `pipeline(task, model, options)` rend une fonction `extract(texts, { pooling })`
 * dont le résultat a `.tolist()`. Servi par un crochet de résolution, le paquet
 * n'étant pas installé.
 */
const FAUX_TRANSFORMERS = `
const words = (t) => t.toLowerCase().replace(/[^\\p{L}\\p{N}]+/gu, ' ').split(' ').filter(Boolean);
const hash = (w) => { let h = 2166136261; for (const c of w) h = Math.imul(h ^ c.codePointAt(0), 16777619) >>> 0; return h; };
export async function pipeline(task, model, options) {
  globalThis.__transformers.loads.push([task, model, options]);
  return async (texts, options) => {
    globalThis.__transformers.calls.push(options);
    return { tolist: () => texts.map((t) => { const v = new Array(384).fill(0); for (const w of words(t)) v[hash(w) % 384] += 1; return v; }) };
  };
}`;
globalThis.__transformers = { loads: [], calls: [] };
register(`data:text/javascript,${encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier === '@huggingface/transformers') {
    return { url: 'data:text/javascript,' + ${JSON.stringify(encodeURIComponent(FAUX_TRANSFORMERS))}, shortCircuit: true };
  }
  return next(specifier, context);
}`)}`);

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : un ticket qui ne s’adresse à personne part chez facturation', async () => {
  const index = await makeIndex();
  const [[similarity, team]] = await neighbours(index, POLITENESS, 1);
  assert.equal(team, 'billing');
  assert.equal(Number(similarity.toFixed(12)), 0.617213399848);
  assert.equal(await route(index, POLITENESS), 'billing');
  // Le voisin est bien le ticket de facturation poli : seul, il rend le même score.
  const seul = await makeIndex(undefined, [TICKETS[2]], [TEAMS[2]]);
  assert.equal(Number((await neighbours(seul, POLITENESS, 1))[0][0].toFixed(12)), 0.617213399848);
});

test('point de rupture : témoin, sans ce ticket dans l’archive l’accident se déplace', async () => {
  const gardes = ARCHIVE.filter(([t]) => !t.startsWith('Bonjour'));
  const index = await makeIndex(undefined, gardes.map(([t]) => t), gardes.map(([, e]) => e));
  assert.equal(await route(index, POLITENESS), 'technical');
});

test('point de rupture : le vote tranche de justesse', async () => {
  const found = await neighbours(await makeIndex(), POLITENESS);
  assert.deepEqual(found.map(([, team]) => team), ['billing', 'technical', 'technical']);
  assert.equal(Number((found[0][0] - (found[1][0] + found[2][0])).toFixed(3)), 0.011);
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('route un ticket vers l’équipe de ses voisins les plus proches', async () => {
  assert.equal(await route(await makeIndex(), 'Ma facture de février est trop élevée'), 'billing');
});

test('le voisin le plus proche et son score', async () => {
  const [[similarity, team]] = await neighbours(await makeIndex(), 'Ma facture de février est trop élevée', 1);
  assert.equal(team, 'billing');
  assert.equal(Number(similarity.toFixed(12)), 0.857142857143);
});

test('les voisins rendus sont un score et une équipe, pas le ticket qui a décidé', async () => {
  // « The k nearest resolved tickets, best first, with their cosine score » :
  // l'agent reçoit « billing, 0,62 », pas le ticket archivé qui a décidé, et la
  // fiche ne dit pas le contraire.
  const [premier] = await neighbours(await makeIndex(), POLITENESS, 1);
  const [score, team] = premier;
  assert.equal(typeof score, 'number');
  assert.ok(TEAMS.includes(team));
  assert.ok(!premier.some((part) => typeof part === 'string' && TICKETS.includes(part)));
});

test('l’archive est encodée une fois et non à chaque question', async () => {
  const encoder = new FakeEncoder(DIMENSIONS);
  const index = await makeIndex(encoder);
  assert.deepEqual(encoder.calls, [TICKETS]);
  await route(index, 'Mon colis est en retard chez le transporteur');
  await route(index, 'Ma facture est fausse');
  assert.deepEqual(encoder.calls.slice(1), [['Mon colis est en retard chez le transporteur'], ['Ma facture est fausse']]);
});

test('l’index est une copie de l’archive', async () => {
  const tickets = [...TICKETS];
  const index = await makeIndex(undefined, tickets);
  tickets.shift();
  assert.deepEqual(index.tickets, TICKETS);
  assert.equal(index.vectors.length, TICKETS.length);
});

test('le vote compte le voisinage, et pas seulement le meilleur', async () => {
  const ticket = 'Mon colis est en retard chez le transporteur';
  assert.deepEqual((await neighbours(await makeIndex(), ticket)).map(([, t]) => t), ['shipping', 'billing', 'shipping']);
  assert.equal(await route(await makeIndex(), ticket), 'shipping');
  const vecteurs = { q: [1, 0], a: [0.9, 0.1], b: [0.8, 0.2], c: [0.8, 0.2] };
  const index = await buildIndex(['a', 'b', 'c'], ['x', 'y', 'y'], vecteursDonnes(vecteurs));
  assert.equal(await route(index, 'q', { k: 1 }), 'x');
  assert.equal(await route(index, 'q', { k: 3 }), 'y');
});

test('à égalité de score, le tri garde l’ordre de l’archive', async () => {
  const vecteurs = { q: [1, 0], a: [0.6, 0.8], b: [0.6, 0.8], c: [0.6, 0.8] };
  const index = await buildIndex(['a', 'b', 'c'], ['x', 'y', 'z'], vecteursDonnes(vecteurs));
  assert.deepEqual((await neighbours(index, 'q')).map(([, t]) => t), ['x', 'y', 'z']);
});

test('à égalité de vote, l’équipe du plus proche l’emporte', async () => {
  const vecteurs = { q: [1, 0, 0, 0, 0], a: [0.5, 0.5, 0.5, 0.5, 0], b: [0.25, 0.75, 0.5, 0.25, 0.25], c: [0.25, 0.25, 0.25, 0.5, 0.75] };
  let index = await buildIndex(['a', 'b', 'c'], ['x', 'y', 'y'], vecteursDonnes(vecteurs));
  assert.equal(await route(index, 'q'), 'x');
  assert.deepEqual((await neighbours(index, 'q')).map(([s]) => s), [0.5, 0.25, 0.25]);
  index = await buildIndex(['a', 'b', 'c'], ['y', 'x', 'x'], vecteursDonnes(vecteurs));
  assert.equal(await route(index, 'q'), 'y');
});

test('le plancher juste au-dessus et juste en dessous', async () => {
  const vecteurs = { q: [1, 0], a: [0.25, 0.9682458365518543] };
  const index = await buildIndex(['a'], ['x'], vecteursDonnes(vecteurs));
  assert.equal(await route(index, 'q', { k: 1 }), 'x');
  assert.equal(await route(index, 'q', { k: 1, minSimilarity: 0.2500001 }), DEFAULT_TEAM);
});

test('un ticket que l’archive n’a jamais vu part dans la file par défaut', async () => {
  const ticket = 'Votre entrepôt accepte-t-il les visites scolaires';
  assert.deepEqual((await neighbours(await makeIndex(), ticket)).map(([s]) => s), [0, 0, 0]);
  assert.equal(await route(await makeIndex(), ticket), DEFAULT_TEAM);
});

test('ce que le double ne peut pas prouver', async () => {
  const index = await makeIndex();
  const ticket = "Je n'arrive plus à entrer dans mon espace client";
  assert.deepEqual((await neighbours(index, ticket)).map(([, team]) => team), ['shipping', 'shipping', 'technical']);
  assert.equal(await route(index, ticket), DEFAULT_TEAM);
});

test('l’encodeur par défaut a la forme de @huggingface/transformers', async () => {
  // `pipeline('feature-extraction', name, { dtype })` puis
  // `extract(texts, { pooling: 'mean' }).tolist()`.
  globalThis.__transformers = { loads: [], calls: [] };
  const index = await buildIndex(TICKETS, TEAMS);
  assert.equal(await route(index, 'Ma facture de février est trop élevée'), 'billing');
  await route(index, 'Mon colis est perdu');
  assert.deepEqual(globalThis.__transformers.loads, [['feature-extraction', MODEL_NAME, { dtype: 'fp32' }]]);
  assert.deepEqual(globalThis.__transformers.calls[0], { pooling: 'mean' });
});

test('déterministe', async () => {
  assert.deepEqual(await neighbours(await makeIndex(), POLITENESS), await neighbours(await makeIndex(), POLITENESS));
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : ticket vide, archive vide et k nul', async () => {
  assert.equal(await route(await makeIndex(), ''), DEFAULT_TEAM);
  assert.equal(await route(await makeIndex(undefined, [], []), 'Ma facture'), DEFAULT_TEAM);
  assert.equal(await route(await makeIndex(), 'Ma facture de janvier est trop élevée', { k: 0 }), DEFAULT_TEAM);
  assert.equal((await neighbours(await makeIndex(), 'Ma facture', 50)).length, TICKETS.length);
});

test('production : NFD, emoji, BOM et casse arrivent à l’encodeur tels quels', async () => {
  const encoder = new FakeEncoder(DIMENSIONS);
  const index = await makeIndex(encoder);
  const ticket = '\ufeff📦 COLIS perdu, cafe\u0301\u00a0!';
  await route(index, ticket);
  assert.deepEqual(encoder.calls.at(-1), [ticket]);
});

test('production : une archive de 900 tickets répond vite', async () => {
  const tickets = [];
  const teams = [];
  for (let i = 0; i < 100; i += 1) for (const [t, e] of ARCHIVE) { tickets.push(`${t} numero ${i}`); teams.push(e); }
  const index = await makeIndex(undefined, tickets, teams);
  const debut = performance.now();
  assert.equal(await route(index, 'Ma facture de février est trop élevée'), 'billing');
  assert.ok(performance.now() - debut < 5000);
});

test('un index encodé par un autre modèle est refusé', async () => {
  // La largeur du vecteur est vérifiée, dans les deux sens : un encodeur plus
  // large que l'index (768 contre 384) comme un encodeur plus étroit rendraient
  // un score faux, l'un tronqué, l'autre plein de NaN.
  const refus = { name: 'RangeError', message: /encoded by another model/ };
  let index = await makeIndex();
  index.encoder = new FakeEncoder(768);
  await assert.rejects(() => route(index, 'Ma facture de janvier'), refus);
  index = await makeIndex(new FakeEncoder(768));
  index.encoder = new FakeEncoder(DIMENSIONS);
  await assert.rejects(() => route(index, 'Ma facture de janvier'), refus);
});
