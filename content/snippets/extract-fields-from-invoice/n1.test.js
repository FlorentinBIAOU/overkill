import { test } from 'node:test';
import assert from 'node:assert/strict';
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

const model = train(
  TRAINING.map(([document]) => document),
  TRAINING.map(([document, marks]) => labelsFor(document, marks)),
);

test('reads a supplier it was never trained on', () => {
  // This is the invoice the keyword rules of N0 read wrong, silently.
  assert.deepEqual(extractFields(model, NORD), {
    invoice_number: '2024-000431',
    date: '3 avril 2024',
    total: 92.4,
  });
});

test('still reads the suppliers it learnt from', () => {
  assert.equal(extractFields(model, LAMBERT).total, 82.8);
  assert.equal(extractFields(model, FERRAND).total, 802.08);
});

test('renaming the label changes nothing', () => {
  // The features never look at the words. Calling the total something else is
  // the change that breaks N0 and leaves this rung untouched.
  const renamed = LAMBERT.replace('Total TTC', 'Net à payer');
  assert.equal(extractFields(model, renamed).total, 82.8);
});

test('features read position and shape', () => {
  const features = lineFeatures('        Total TTC     82,80 €', 9, 10);
  assert.equal(features[1], 1); //  the last line of the page
  assert.ok(features[2] > 0); //    indented
  assert.equal(features[8], 1); //  the amount hangs on the right
});

test('an empty document returns no field', () => {
  assert.deepEqual(extractFields(model, ''), {
    invoice_number: null,
    date: null,
    total: null,
  });
});

test('breaking point: a legal footer below the totals', () => {
  // The features are the whole model, and one of them says « the amount at the
  // bottom right of the page ». Every French invoice ends with the fixed
  // recovery indemnity, an amount, at the bottom, on the right, on a line of
  // its own. It looks more like a total than the total does, and nothing in
  // the training set said otherwise.
  //
  // The fix is not a better classifier, it is more labelled invoices, of every
  // layout you will ever receive. Each new supplier costs annotation, which is
  // the running cost this rung is usually assumed not to have.
  const verrerie = `
VERRERIE DU CENTRE
Facture V-2451 du 12/09/2024

Bocaux 500 ml x 200                          264,00
Caisses bois                                  36,00

Total TTC                                    360,00 €

Escompte pour paiement anticipé : néant
Indemnité forfaitaire de recouvrement        40,00 €
`;
  const fields = extractFields(model, verrerie);
  assert.equal(fields.invoice_number, 'V-2451');
  assert.equal(fields.total, 40);
  assert.notEqual(fields.total, 360);
});
