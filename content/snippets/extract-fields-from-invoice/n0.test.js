import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AMOUNT, extractFields, findAfterLabel, parseAmount } from './n0.js';

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

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : le fournisseur suivant fait tomber les trois champs', () => {
  const fields = extractFields(NORD);
  assert.equal(fields.invoice_number, null);
  assert.equal(fields.date, null);
  assert.notEqual(fields.total, 92.4);
  // Witness: the Lambert invoice is read in full.
  assert.deepEqual(extractFields(LAMBERT), { invoice_number: 'FA-2024-0187', date: '14/03/2024', total: 82.8 });
});

test('point de rupture : deux champs tombent à vide, et cela se voit', () => {
  const fields = extractFields(NORD);
  assert.deepEqual(Object.keys(fields).filter((name) => fields[name] === null), ['invoice_number', 'date']);
});

test('point de rupture : le total revient bien formé et faux, parce que « Sous-total » contient « total »', () => {
  assert.equal(extractFields(NORD).total, 77);
  assert.equal(findAfterLabel(NORD, ['total'], AMOUNT), '77,00');
  // Witness: without the word « Sous-total », the same line gives nothing.
  assert.equal(extractFields(NORD.replace('Sous-total', 'Montant HT')).total, null);
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('lit la facture pour laquelle il a été écrit', () => {
  assert.deepEqual(extractFields(LAMBERT), { invoice_number: 'FA-2024-0187', date: '14/03/2024', total: 82.8 });
});

test('lit des libellés en capitales et un montant groupé', () => {
  const invoice = 'FACTURE N° FA-2024-0201\nDATE : 02/12/2024\nTOTAL TTC : 1 234,56 €';
  assert.deepEqual(extractFields(invoice), { invoice_number: 'FA-2024-0201', date: '02/12/2024', total: 1234.56 });
});

test('un libellé sans valeur sur sa ligne est ignoré', () => {
  assert.equal(extractFields('Qté   Prix   Total\n\nTotal TTC   45,00 €').total, 45);
});

test('les libellés sont rangés du plus précis au moins précis, Total TTC avant Total HT', () => {
  assert.equal(extractFields(LAMBERT).total, 82.8);
  // Witness: with the least specific label alone, the plausible wrong number comes back.
  assert.equal(findAfterLabel(LAMBERT, ['total'], AMOUNT), '69,00');
});

test('parseAmount lit les deux graphies', () => {
  assert.equal(parseAmount('1.234,56 €'), 1234.56);
  assert.equal(parseAmount('82,80'), 82.8);
  assert.equal(parseAmount('92.40'), 92.4);
});

test('INFIRMÉ : le commentaire dit qu’une quantité et un prix unitaire ne sont jamais lus comme un seul nombre, « 2 380,50 » l’est', async () => {
  await assert.rejects(async () => {
    assert.equal('Cartouche encre noire 2 380,50'.match(AMOUNT)[0], '380,50');
  });
});

test('l’extrait n’importe rien', () => {
  const source = readFileSync(new URL('./n0.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s|\brequire\(|\bimport\(|\bfetch\(/m);
  assert.deepEqual(extractFields(LAMBERT), extractFields(LAMBERT));
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : document vide ou blanc', () => {
  assert.deepEqual(extractFields(''), { invoice_number: null, date: null, total: null });
  assert.deepEqual(extractFields('\n   \n\t'), { invoice_number: null, date: null, total: null });
});

test('production : un document de neuf mégaoctets dans une borne large', () => {
  const big = LAMBERT.repeat(20_000);
  const debut = performance.now();
  assert.equal(extractFields(big).total, 82.8);
  assert.ok(performance.now() - debut < 10_000);
});

test('production : espace insécable et espace fine dans le montant', () => {
  assert.equal(extractFields('Total TTC 1\u00a0234,56 €').total, 1234.56);
  assert.equal(extractFields('Total TTC 1\u202f234,56 €').total, 1234.56);
});

test('une espace insécable dans « Total TTC » rend le Total HT', async () => {
  assert.equal(extractFields(LAMBERT.replace('Total TTC', 'Total\u00a0TTC')).total, 82.8);
});

test('un montant à l’anglaise est lu sans erreur et faux', async () => {
  assert.ok([1234.56, null].includes(extractFields('TOTAL TTC : 1,234.56 USD').total));
});

test('le total négatif d’un avoir perd son signe', async () => {
  assert.equal(extractFields("Facture d'avoir n° AV-2024-0012\nTotal TTC -82,80 €").total, -82.8);
});

test('production : valeurs aux limites du montant', () => {
  assert.equal(extractFields('Total TTC 0,00 €').total, 0);
  assert.equal(extractFields('Total TTC 999,99 €').total, 999.99);
  assert.equal(extractFields('Total TTC 1 000,00 €').total, 1000);
  assert.equal(extractFields('Total TTC 1 234 567,89 €').total, 1234567.89);
  assert.equal(extractFields('Total TTC 12,5 €').total, null);
});

test('production : un motif conçu pour faire exploser la référence termine', () => {
  const debut = performance.now();
  extractFields(`Facture n° ${'1-'.repeat(50_000)}!`);
  extractFields(`Total TTC ${'1 '.repeat(50_000)}x`);
  assert.ok(performance.now() - debut < 10_000);
});
