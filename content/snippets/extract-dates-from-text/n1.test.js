import { test } from 'node:test';
import assert from 'node:assert/strict';
import { context, extractDates, train } from './n1.js';

// A small labelled set, the kind an afternoon of tagging produces. The label
// is the convention the document follows, not the value of any one date.
const DAY_FIRST = [
  'Facture émise le 05/06/2024, à régler sous trente jours.',
  'Livraison prévue le 07/08/2024 au dépôt de Lyon.',
  'Contrat signé le 09/10/2024 par les deux parties.',
  'Réunion de lancement le 11/12/2023, salle du conseil.',
  'Commande passée le 02/03/2024, accusé de réception joint.',
  'Échéance fixée au 04/05/2024, pénalités au-delà.',
  "Devis valable jusqu'au 06/07/2024 inclus.",
  'Bon de commande daté du 08/09/2024, service achats.',
];

const MONTH_FIRST = [
  'Invoice issued 05/06/2024, net thirty days.',
  'Shipment scheduled 07/08/2024 from the Dallas warehouse.',
  'Agreement signed 09/10/2024 by both parties.',
  'Kickoff meeting 11/12/2023 in the main conference room.',
  'Order placed 02/03/2024, confirmation attached.',
  'Payment due 04/05/2024, late fees thereafter.',
  'Quote valid through 06/07/2024 inclusive.',
  'Purchase order dated 08/09/2024, procurement team.',
];

const model = train(
  [...DAY_FIRST, ...MONTH_FIRST],
  [...DAY_FIRST.map(() => 1), ...MONTH_FIRST.map(() => 0)],
);

const days = (text) => extractDates(model, text).map((d) => d.date.toISOString().slice(0, 10));

test('context keeps the words and drops the digits', () => {
  const text = 'Facture émise le 05/06/2024, à régler pour le 4e trimestre.';
  assert.equal(context(text, 17, 27), 'facture émise le  , à régler pour le  e trimestre.');
});

test('reads the same digits two ways in two documents', () => {
  assert.deepEqual(days('Facture émise le 03/04/2024, à régler sous trente jours.'), ['2024-04-03']);
  assert.deepEqual(days('Invoice issued 03/04/2024, net thirty days.'), ['2024-03-04']);
});

test('the rules settle what they can without the model', () => {
  // 25 cannot be a month, whatever the prose around it says.
  assert.deepEqual(days('Invoice issued 25/12/2024, net thirty days.'), ['2024-12-25']);
});

test('still rejects a day the calendar does not have', () => {
  assert.deepEqual(days('Facture émise le 31/02/2024, à régler.'), []);
  assert.deepEqual(days('Facture émise le 29/02/2023, à régler.'), []);
  assert.deepEqual(days('Facture émise le 29/02/2024, à régler.'), ['2024-02-29']);
});

test('reads several dates in one document', () => {
  const text = 'Commande passée le 02/03/2024, échéance fixée au 04/05/2024, pénalités au-delà.';
  assert.deepEqual(days(text), ['2024-03-02', '2024-05-04']);
});

test('breaking point: a date with no context to read', () => {
  // The classifier never abstains. Given a bare date, with no prose around it
  // to read, it still commits to a convention, and the answer it commits to is
  // whatever the training set leaned towards. It is a guess, returned with the
  // same shape as a fact, and nothing in the output says which of the two the
  // caller is holding.
  const bare = days('03/04/2024');
  assert.equal(bare.length, 1);
  assert.ok(['2024-04-03', '2024-03-04'].includes(bare[0]));
});

test('breaking point: relative dates are still invisible', () => {
  // The candidates come from a rule, so what N0 could not see, this cannot see.
  assert.deepEqual(days('on se voit jeudi prochain'), []);
  assert.deepEqual(days('livraison dans quinze jours'), []);
});
