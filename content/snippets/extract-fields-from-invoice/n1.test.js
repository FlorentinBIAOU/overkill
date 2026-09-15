import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractFields, lineFeatures, pageLines, train } from './n1.js';

// Two suppliers to learn from. Their pages have nothing in common but the fact
// that they are invoices, which is the point.

const LAMBERT = `
PAPETERIE LAMBERT
12 rue des Acacias — 69003 Lyon

Facture n° FA-2024-0187
Date : 14/03/2024
Client : Studio Vermeil

Réf     Désignation                Qté   PU HT    Montant HT
A-11    Ramette A4 80 g             10    4,90       49,00
B-02    Stylo bille noir            25    0,80       20,00

                          Total HT      69,00 €
                          TVA 20 %      13,80 €
                          Total TTC     82,80 €
`;

const FERRAND = `
Atelier Ferrand — Menuiserie
SIRET 812 345 678 00019

FACTURE 2024/117
Le 08/07/2024

Prestation                                    Montant
Pose de plinthes (2 jours)                    540,00
Fournitures et quincaillerie                  128,40

Total hors taxes                              668,40
TVA 20 %                                      133,68
Montant à régler                              802,08 €
`;

// The supplier the keyword rules of N0 could not read.
const NORD = `
NORD FOURNITURES SAS
Facture

                                          N° 2024-000431
                                          Émise le 3 avril 2024

Désignation                        Qté     Prix      Total
Cartouche encre noire                2    38,50      77,00

                          Sous-total                 77,00
                          TVA (20 %)                 15,40
                          NET A PAYER                92,40 EUR
`;

const TRAINING = [
  [LAMBERT, { 'Facture n°': 'invoice_number', 'Date :': 'date', 'Total TTC': 'total' }],
  [FERRAND, { 'FACTURE 2024': 'invoice_number', 'Le 08/07': 'date', 'Montant à régler': 'total' }],
];

/** One label per non-blank line, the way an annotator would give them. */
function labelsFor(document, marks) {
  return pageLines(document).map(
    (line) => Object.entries(marks).find(([mark]) => line.includes(mark))?.[1] ?? 'other',
  );
}

const makeModel = (extra = []) => train(
  [...TRAINING.map(([document]) => document), ...extra.map(([document]) => document)],
  [...TRAINING.map(([document, marks]) => labelsFor(document, marks)), ...extra.map(([document, marks]) => labelsFor(document, marks))],
);

const model = makeModel();

const VERRERIE = `
VERRERIE DU CENTRE
Facture V-2451 du 12/09/2024

Bocaux 500 ml x 200                          264,00
Caisses bois                                  36,00

Total TTC                                    360,00 €

Escompte pour paiement anticipé : néant
Indemnité forfaitaire de recouvrement        40,00 €
`;
const INDEMNITY = 'Indemnité forfaitaire de recouvrement        40,00 €';

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : l’indemnité forfaitaire de recouvrement est retenue comme montant dû', () => {
  const fields = extractFields(model, VERRERIE);
  assert.equal(fields.invoice_number, 'V-2451');
  assert.equal(fields.total, 40);
  // Witness: without that line, the same invoice reads 360,00.
  assert.equal(extractFields(model, VERRERIE.replace(INDEMNITY, '')).total, 360);
});

test('point de rupture : l’indemnité a les traits d’un total, montant seul en bas à droite', () => {
  const lines = pageLines(VERRERIE);
  const features = lineFeatures(lines.at(-1), lines.length - 1, lines.length);
  assert.equal(features[1], 1);
  assert.equal(features[5], 1 / 3);
  assert.equal(features[8], 1);
});

test('INFIRMÉ : la fiche laisse entendre qu’annoter cette facture corrigerait la lecture, entraîné dessus il rend encore 40,00', async () => {
  await assert.rejects(async () => {
    const retrained = makeModel([[VERRERIE, { 'Facture V': 'invoice_number', 'Total TTC': 'total' }]]);
    assert.equal(extractFields(retrained, VERRERIE).total, 360);
  });
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('lit un fournisseur jamais vu à l’entraînement', () => {
  assert.deepEqual(extractFields(model, NORD), { invoice_number: '2024-000431', date: '3 avril 2024', total: 92.4 });
});

test('lit encore les fournisseurs appris', () => {
  assert.equal(extractFields(model, LAMBERT).total, 82.8);
  assert.equal(extractFields(model, FERRAND).total, 802.08);
});

test('renommer le libellé ne change rien', () => {
  assert.equal(extractFields(model, LAMBERT.replace('Total TTC', 'Net à payer')).total, 82.8);
});

test('les traits ne lisent jamais ce que dit la ligne', () => {
  assert.deepEqual(lineFeatures('Total TTC 82,80 €', 3, 10), lineFeatures('Solde TTC 82,80 €', 3, 10));
});

test('les traits lisent la position et la forme', () => {
  const features = lineFeatures('        Total TTC     82,80 €', 9, 10);
  assert.equal(features[0], 1);
  assert.equal(features[1], 1);
  assert.ok(features[2] > 0);
  assert.equal(features[8], 1);
});

test('une ligne préférée qui ne porte aucune valeur n’est pas une réponse', () => {
  // A hand-set model: the total classifier loves an all-capitals line.
  const zero = () => ({ weights: new Float64Array(10), bias: 0 });
  const loveCapitals = { weights: Float64Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 10]), bias: 0 };
  const pointing = { classes: ['date', 'invoice_number', 'other', 'total'], models: [zero(), zero(), zero(), loveCapitals] };
  assert.equal(extractFields(pointing, 'SOCIÉTÉ EXEMPLE\nTotal TTC 82,80 €').total, 82.8);
});

test('l’entraînement tient en quelques dizaines de lignes, et la régression est lue plutôt qu’importée', () => {
  assert.equal(TRAINING.reduce((n, [document]) => n + pageLines(document).length, 0), 21);
  const source = readFileSync(new URL('./n1.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s|\brequire\(|\bimport\(|\bfetch\(/m);
});

test('deux entraînements rendent les mêmes lectures', () => {
  assert.deepEqual(extractFields(makeModel(), NORD), extractFields(model, NORD));
});

test('verdict : N1 prend pour le montant dû une mention légale de bas de page', () => {
  assert.equal(extractFields(model, VERRERIE).total, 40);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : document vide ou blanc', () => {
  const empty = { invoice_number: null, date: null, total: null };
  assert.deepEqual(extractFields(model, ''), empty);
  assert.deepEqual(extractFields(model, '  \n\t\n'), empty);
});

test('production : une seule ligne', () => {
  assert.equal(extractFields(model, 'Total TTC 82,80 €').total, 82.8);
});

test('production : dix mille lignes dans une borne large', () => {
  const big = LAMBERT.repeat(800);
  const debut = performance.now();
  assert.notEqual(extractFields(model, big).total, null);
  assert.ok(performance.now() - debut < 20_000);
});

test('une date en lettres avec majuscule ou sans accent n’est pas lue', async () => {
  assert.equal(extractFields(model, NORD.replace('3 avril 2024', '3 Avril 2024')).date, '3 Avril 2024');
  assert.equal(extractFields(model, NORD.replace('3 avril 2024', '1 fevrier 2024')).date, '1 fevrier 2024');
});

test('production : espaces insécables dans le montant et la date', () => {
  const text = NORD.replace('92,40', '1\u202f092,40').replace('3 avril 2024', '3\u00a0avril\u00a02024');
  const fields = extractFields(model, text);
  assert.equal(fields.total, 1092.4);
  assert.equal(fields.date, '3\u00a0avril\u00a02024');
});
