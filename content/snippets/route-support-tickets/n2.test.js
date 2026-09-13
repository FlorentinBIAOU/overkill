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
import { FakeEncoder } from '../_harness/fake-model.mjs';
import { DEFAULT_TEAM, buildIndex, neighbours, route } from './n2.js';

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

const makeIndex = (encoder) => buildIndex(TICKETS, TEAMS, encoder ?? new FakeEncoder(DIMENSIONS));

test('routes a ticket to the team of its nearest neighbours', async () => {
  assert.equal(await route(await makeIndex(), 'Ma facture de février est trop élevée'), 'billing');
});

test('the nearest neighbour is the reason shown to the agent', async () => {
  const [[similarity, team]] = await neighbours(await makeIndex(), 'Ma facture de février est trop élevée', 1);
  assert.equal(team, 'billing');
  // The same number as the Python version of this snippet, because both run
  // the same double. Six of the seven words are shared with the archived
  // ticket, and the cosine says exactly that.
  assert.equal(Number(similarity.toFixed(12)), 0.857142857143);
});

test('the archive is encoded once, not once per query', async () => {
  // The point of an index: the expensive call happens at build time.
  const encoder = new FakeEncoder(DIMENSIONS);
  const index = await makeIndex(encoder);
  assert.deepEqual(encoder.calls, [TICKETS]);
  await route(index, 'Mon colis est en retard chez le transporteur');
  assert.deepEqual(encoder.calls[1], ['Mon colis est en retard chez le transporteur']);
});

test('the vote counts the neighbourhood, not only the best match', async () => {
  // The closest neighbour is a shipping ticket, the second is a billing one
  // that clears the floor as well; two shipping tickets outvote it.
  const ticket = 'Mon colis est en retard chez le transporteur';
  const found = await neighbours(await makeIndex(), ticket);
  assert.deepEqual(found.map(([, team]) => team), ['shipping', 'billing', 'shipping']);
  assert.equal(await route(await makeIndex(), ticket), 'shipping');
});

test('an empty ticket goes to the default queue', async () => {
  assert.equal(await route(await makeIndex(), ''), DEFAULT_TEAM);
});

test('a ticket the archive has never seen goes to the default queue', async () => {
  // Nothing in the archive shares anything with it, so every score is zero and
  // the floor does its job.
  const ticket = "Votre entrepôt accepte-t-il les visites scolaires";
  const found = await neighbours(await makeIndex(), ticket);
  assert.deepEqual(found.map(([similarity]) => similarity), [0, 0, 0]);
  assert.equal(await route(await makeIndex(), ticket), DEFAULT_TEAM);
});

test('what the double cannot prove', async () => {
  // The reason this rung exists is the paraphrase, and the double cannot show
  // it: it is a bag of words, exactly like N1. "Je n'arrive plus à entrer
  // dans mon espace client" is the lost password of the archive said in other
  // words. The double puts the password ticket third, behind two parcel
  // tickets that merely share "mon" and "plus", and the routing falls to
  // the default queue. Only the real encoder closes that gap. This test
  // asserts the double's silence instead of implying a win nobody measured.
  const index = await makeIndex();
  const ticket = "Je n'arrive plus à entrer dans mon espace client";
  const found = await neighbours(index, ticket);
  assert.deepEqual(found.map(([, team]) => team), ['shipping', 'shipping', 'technical']);
  assert.equal(await route(index, ticket), DEFAULT_TEAM);
});

test('breaking point: the archive is the policy', async () => {
  // There is no model of the teams on this rung, only an archive, and the
  // nearest ticket is not always a relevant one. This customer asks whether
  // their file arrived. It is a question for nobody in particular, and it is
  // routed to billing with a high score — the archive happens to hold one
  // billing ticket written with the same politeness formulas, and the vote
  // sees a strong match.
  //
  // The double makes the mechanism visible in its crudest form, by counting
  // words. A real encoder moves where the accident happens, it does not remove
  // it: whatever the archive is made of is the routing policy, including the
  // parts nobody chose.
  const index = await makeIndex();
  const ticket = 'Bonjour, merci de me confirmer que vous avez bien reçu mon dossier';
  const [[similarity, team]] = await neighbours(index, ticket, 1);
  assert.equal(team, 'billing');
  assert.equal(Number(similarity.toFixed(12)), 0.617213399848);
  assert.equal(await route(index, ticket), 'billing');
});
