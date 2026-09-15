import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { context, extractDates, train } from './n1.js';
import * as n0 from './n0.js';

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

const makeModel = (dayFirst = DAY_FIRST, monthFirst = MONTH_FIRST) => train(
  [...dayFirst, ...monthFirst],
  [...dayFirst.map(() => 1), ...monthFirst.map(() => 0)],
);

const model = makeModel();

/** Stands in for the classifier where the rules alone must decide. */
const modelThatMustNotBeAsked = {
  get bias() { throw new Error('the rules should have settled this without the model'); },
  get weights() { throw new Error('the rules should have settled this without the model'); },
};

const iso = (date) => date.toISOString().slice(0, 10);
const pairs = (m, text) => extractDates(m, text).map((d) => [d.text, iso(d.date)]);
const days = (text) => extractDates(model, text).map((d) => iso(d.date));

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : sur 03/04/2024 seul, le classifieur tranche quand même', () => {
  assert.deepEqual(pairs(model, '03/04/2024'), [['03/04/2024', '2024-03-04']]);
  // Witness: surrounded by French prose, the same date reads 3 April.
  assert.deepEqual(days('Facture émise le 03/04/2024, à régler sous trente jours.'), ['2024-04-03']);
});

test('point de rupture : sans contexte, il tranche dans le sens où penche le jeu d’entraînement', () => {
  assert.deepEqual(pairs(makeModel(DAY_FIRST, MONTH_FIRST.slice(0, 3)), '03/04/2024'), [['03/04/2024', '2024-04-03']]);
  assert.deepEqual(pairs(makeModel(DAY_FIRST.slice(0, 3), MONTH_FIRST), '03/04/2024'), [['03/04/2024', '2024-03-04']]);
});

test('point de rupture : la supposition a exactement la forme d’un fait', () => {
  const [guessed] = extractDates(model, '03/04/2024');
  const [settled] = extractDates(model, '25/12/2024');
  assert.deepEqual(Object.keys(guessed), Object.keys(settled));
  assert.deepEqual(Object.keys(guessed), ['text', 'date']);
});

test('point de rupture : « 3 avril 2024 », « 12.03.24 » et « 2024-03-12 », trouvés par N0, ne ressortent plus', () => {
  for (const written of ['3 avril 2024', '12.03.24', '2024-03-12']) {
    assert.deepEqual(days(`Facture émise le ${written}, à régler.`), [], written);
    assert.equal(n0.extractDates(`Facture émise le ${written}, à régler.`).length, 1, written);
  }
});

test('point de rupture : les dates relatives restent invisibles', () => {
  assert.deepEqual(days('on se voit jeudi prochain'), []);
  assert.deepEqual(days('livraison dans quinze jours'), []);
  assert.deepEqual(days('à partir de demain'), []);
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('le contexte garde les mots et retire les chiffres', () => {
  const text = 'Facture émise le 05/06/2024, à régler pour le 4e trimestre.';
  assert.equal(context(text, 17, 27), 'facture émise le  , à régler pour le  e trimestre.');
});

test('le contexte s’arrête à quarante caractères de chaque côté', () => {
  const text = `${'x'.repeat(100)}03/04/2024${'y'.repeat(100)}`;
  assert.equal(context(text, 100, 110), `${'x'.repeat(40)} ${'y'.repeat(40)}`);
});

test('lit les mêmes chiffres de deux façons dans deux documents', () => {
  assert.deepEqual(days('Facture émise le 03/04/2024, à régler sous trente jours.'), ['2024-04-03']);
  assert.deepEqual(days('Invoice issued 03/04/2024, net thirty days.'), ['2024-03-04']);
});

test('un document qui cite un fournisseur étranger est lu date par date', () => {
  const text = 'Facture émise le 03/04/2024, à régler sous trente jours. Par ailleurs, '
    + 'notre fournisseur écrit : Invoice issued 03/04/2024, net thirty days.';
  assert.deepEqual(days(text), ['2024-04-03', '2024-03-04']);
  assert.deepEqual(n0.extractDates(text).map((d) => iso(d.date)), ['2024-04-03', '2024-04-03']);
});

test('les règles tranchent seules ce qu’elles peuvent trancher', () => {
  assert.deepEqual(pairs(modelThatMustNotBeAsked, 'Invoice issued 25/12/2024.'), [['25/12/2024', '2024-12-25']]);
  assert.deepEqual(pairs(modelThatMustNotBeAsked, 'Invoice issued 12/25/2024.'), [['12/25/2024', '2024-12-25']]);
  assert.deepEqual(pairs(modelThatMustNotBeAsked, '13/13/2024'), []);
});

test('la vérification calendaire de N0 est gardée', () => {
  assert.deepEqual(days('Facture émise le 31/02/2024, à régler.'), []);
  assert.deepEqual(days('Facture émise le 29/02/2023, à régler.'), []);
  assert.deepEqual(days('Facture émise le 29/02/2024, à régler.'), ['2024-02-29']);
  assert.deepEqual(days('Facture émise le 29/02/1900, à régler.'), []);
});

test('lit plusieurs dates dans un document', () => {
  const text = 'Commande passée le 02/03/2024, échéance fixée au 04/05/2024, pénalités au-delà.';
  assert.deepEqual(days(text), ['2024-03-02', '2024-05-04']);
});

test('une année sur deux chiffres est aussi ambiguë, et lui échappe', () => {
  const lire = (text, dayFirst) => n0.extractDates(text, dayFirst).map((d) => iso(d.date));
  assert.deepEqual(lire('03/04/24', true), ['2024-04-03']);
  assert.deepEqual(lire('03/04/24', false), ['2024-03-04']);
  assert.deepEqual(days('Invoice issued 03/04/24, net thirty days.'), []);
  assert.deepEqual(days('Facture émise le 3 avril 2024.'), []);
  assert.deepEqual(days('Invoice issued 03/04/2024, net thirty days.'), ['2024-03-04']);
});

test('tout le modèle tient en un poids par mot et un biais', () => {
  // Docstring js : « the whole model is one weight per word and a bias ».
  assert.deepEqual(Object.keys(model).sort(), ['bias', 'weights']);
  assert.equal(typeof model.bias, 'number');
  assert.ok(model.weights instanceof Map);
  for (const [word, weight] of model.weights) {
    assert.match(word, /^\p{L}+$/u);
    assert.equal(typeof weight, 'number');
  }
  // Un mot par entrée : « facture » et « invoice » ont chacun le leur, et leurs signes s'opposent.
  assert.ok(model.weights.get('facture') > 0 && model.weights.get('invoice') < 0);
});

test('l’extrait n’importe rien', () => {
  // docstring js : « written out here rather than pulled from a library » ; data_egress: none.
  const source = readFileSync(new URL('./n1.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s|\brequire\(|\bimport\(|\bfetch\(/m);
});

test('deux entraînements sur le même jeu rendent les mêmes lectures', () => {
  const text = 'Order placed 03/04/2024. Commande passée le 05/06/2024.';
  assert.deepEqual(pairs(makeModel(), text), pairs(model, text));
});

test('verdict : il faut garder N0 à côté pour les mois écrits en lettres', () => {
  assert.deepEqual(days('Livraison le 3 avril 2024.'), []);
  assert.equal(n0.extractDates('Livraison le 3 avril 2024.').length, 1);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : texte vide', () => {
  assert.deepEqual(days(''), []);
});

test('production : une phrase d’entraînement sans date candidate entraîne sur un contexte vide', () => {
  const m = train([...DAY_FIRST, ...MONTH_FIRST, 'Facture du 12.03.24'], [...DAY_FIRST.map(() => 1), ...MONTH_FIRST.map(() => 0), 1]);
  assert.deepEqual(pairs(m, 'Facture émise le 25/12/2024.'), [['25/12/2024', '2024-12-25']]);
});

test('production : cinq mille dates ambiguës dans une borne large', () => {
  const text = 'Facture émise le 03/04/2024, à régler. '.repeat(5000);
  const debut = performance.now();
  assert.equal(extractDates(model, text).length, 5000);
  assert.ok(performance.now() - debut < 30_000);
});

test('production : accents décomposés et capitales autour de la date', () => {
  assert.deepEqual(days('Facture émise le 03/04/2024, à régler sous trente jours.'.normalize('NFD')), ['2024-04-03']);
  assert.deepEqual(days('FACTURE ÉMISE LE 03/04/2024, À RÉGLER SOUS TRENTE JOURS.'), ['2024-04-03']);
});

test('production : espace insécable et BOM autour de la date', () => {
  assert.deepEqual(days('\ufeffFacture émise le\u00a003/04/2024,\u00a0à régler sous trente jours.'), ['2024-04-03']);
});

test('production : valeurs aux limites des règles', () => {
  assert.deepEqual(pairs(modelThatMustNotBeAsked, '13/12/2024'), [['13/12/2024', '2024-12-13']]);
  assert.deepEqual(pairs(modelThatMustNotBeAsked, '12/13/2024'), [['12/13/2024', '2024-12-13']]);
  assert.deepEqual(days('12/12/2024'), ['2024-12-12']);
  assert.deepEqual(days('00/00/2024'), []);
});
