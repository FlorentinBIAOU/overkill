import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFields, parseAmount } from './n0.js';

// Two invoices, two suppliers, both already turned into text. Nothing here is
// unusual: this is what a French invoice looks like once the PDF has given up
// its characters.

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

test('reads the invoice it was written for', () => {
  assert.deepEqual(extractFields(LAMBERT), {
    invoice_number: 'FA-2024-0187',
    date: '14/03/2024',
    total: 82.8,
  });
});

test('reads uppercase labels and a grouped amount', () => {
  // Same supplier, a later invoice: shouting labels, and a total large enough
  // to carry a thousands separator.
  const invoice = 'FACTURE N° FA-2024-0201\nDATE : 02/12/2024\nTOTAL TTC : 1 234,56 €';
  assert.deepEqual(extractFields(invoice), {
    invoice_number: 'FA-2024-0201',
    date: '02/12/2024',
    total: 1234.56,
  });
});

test('ignores a label that carries no value', () => {
  // « Total » is a column heading here before it is a label. Accepting the
  // heading would return nothing at all instead of the amount below it.
  const invoice = 'Qté   Prix   Total\n\nTotal TTC   45,00 €';
  assert.equal(extractFields(invoice).total, 45);
});

test('an empty document returns no field', () => {
  assert.deepEqual(extractFields(''), { invoice_number: null, date: null, total: null });
});

test('parseAmount reads both spellings', () => {
  assert.equal(parseAmount('1.234,56 €'), 1234.56);
  assert.equal(parseAmount('82,80'), 82.8);
});

test('breaking point: the next supplier lays the page out otherwise', () => {
  // The rules are written against one supplier's page, and the next supplier
  // does not use that page. Nord Fournitures writes « N° » where Lambert
  // writes « Facture n° », spells the date out in words, and calls the total
  // « NET A PAYER ». Not one of the three fields survives, and only one of the
  // three failures is visible: the total comes back as a confident,
  // well-formed, wrong number, because « Sous-total » contains « total ».
  //
  // Adding « net a payer » to the labels fixes this supplier and waits for the
  // next one. That maintenance, invoice by invoice, is the real cost of N0.
  const fields = extractFields(NORD);
  assert.equal(fields.invoice_number, null);
  assert.equal(fields.date, null);
  assert.equal(fields.total, 77);
  assert.notEqual(fields.total, 92.4);
});
