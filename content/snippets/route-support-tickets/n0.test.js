import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TEAM, matches, route } from './n0.js';

// A handful of tickets as a support desk receives them: French, hurried, and
// rarely limited to one subject.
const BILLING = 'Ma facture de janvier est trop élevée, pouvez-vous vérifier ?';
const TECHNICAL = "Impossible d'ouvrir une connexion depuis ce matin.";
const SHIPPING = "Mon colis n'est toujours pas arrivé après trois semaines.";

test('routes each ticket to its team', () => {
  assert.equal(route(BILLING), 'billing');
  assert.equal(route(TECHNICAL), 'technical');
  assert.equal(route(SHIPPING), 'shipping');
});

test('accents and case cost nothing', () => {
  assert.equal(route('PRÉLÈVEMENT en double sur mon compte'), 'billing');
  assert.equal(route('prelevement en double sur mon compte'), 'billing');
});

test('plurals and derived forms still match', () => {
  // French tickets are written in the plural far more often than a keyword
  // list is, which is why the boundary is on the left of the word only.
  assert.equal(route('Mes factures de mars sont fausses'), 'billing');
  assert.equal(route('Des erreurs apparaissent à chaque export'), 'technical');
  assert.equal(route('Les livraisons du mois sont toutes en retard'), 'shipping');
});

test('an empty ticket goes to the default queue', () => {
  assert.equal(route(''), DEFAULT_TEAM);
});

test('the default queue is the caller’s to name', () => {
  assert.equal(route('Bonjour, merci de me rappeler.', 'triage'), 'triage');
});

test('matches shows what the rules saw', () => {
  // What a reviewer needs when a ticket lands on the wrong desk.
  assert.deepEqual(matches(SHIPPING), { shipping: ['colis'] });
});

test('breaking point: a ticket that belongs to two teams', () => {
  // This customer has two problems, and the rules see both. The routing
  // returns one team, the one the priority order puts first, and the parcel
  // half of the ticket is dropped without a trace in the queue that receives
  // it. Priority makes the outcome predictable; it does not make it right. No
  // ordering of the rules would be, because the ticket really is both.
  const ticket = "Le colis n'est jamais arrivé et le prélèvement est passé quand même.";
  assert.deepEqual(matches(ticket), { billing: ['prélèvement'], shipping: ['colis'] });
  assert.equal(route(ticket), 'billing');
});

test('breaking point: a ticket that belongs to no team', () => {
  // A perfectly ordinary ticket, written by someone who describes their
  // problem without ever using the vocabulary of the rules. Nothing matches,
  // so it goes to the default queue — which is the honest outcome, and also
  // the reason this rung stops working once that queue is the busiest one.
  const ticket = "Bonjour, depuis hier je n'arrive plus à faire ce que je faisais avant.";
  assert.deepEqual(matches(ticket), {});
  assert.equal(route(ticket), DEFAULT_TEAM);
});
