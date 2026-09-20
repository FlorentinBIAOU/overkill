import test from 'node:test';
import assert from 'node:assert/strict';

import { extractAmounts, readNumber } from './n0.js';

// Une ligne de facture française ordinaire : le numéro de pièce, la date, et
// le montant qui porte son symbole.
const FACTURE = 'Facture n° 2026-118 du 10 octobre 2026 — total 1 250,00 €';

const DEVIS = 'Sous-total 1 250,00 €, remise 125,00 €, total 1 125,00 € TTC. '
  + 'TVA 20 % incluse.';

// Le même document, avec la devise écrite une fois, en tête.
const ENTETE = 'Facture n° 2026-118. Montants exprimés en euros.\n'
  + 'Sous-total : 1 250,00\nRemise : 125,00\nTotal : 1 125,00';

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : trois chiffres derrière un séparateur se lisent deux façons', () => {
  const francais = extractAmounts('1,859 € le litre', 'fr').amounts[0];
  const anglais = extractAmounts('1,859 € le litre', 'en').amounts[0];
  assert.equal(francais.value, '1.859');
  assert.equal(anglais.value, '1859');
  // La lecture dépend de la déclaration, et le drapeau le dit — il ne dit pas
  // laquelle des deux est juste.
  assert.equal(francais.ambiguous, true);
  assert.equal(anglais.ambiguous, true);
});

test("point de rupture : témoin, une espace tranche le groupement", () => {
  for (const convention of ['fr', 'en']) {
    const lu = extractAmounts('1 859,00 €', convention).amounts[0];
    assert.equal(lu.value, '1859.00');
    assert.equal(lu.ambiguous, false);
  }
});

// ---------------------------------------------------------------------------
// Le verdict
// ---------------------------------------------------------------------------

test('verdict : le numéro de facture n’est pas rendu comme un total', () => {
  // Aucune bibliothèque JavaScript maintenue ne fait ce travail ; la
  // comparaison avec `price-parser`, qui rend ici 2026, est dans le test Python.
  const lus = extractAmounts(FACTURE, 'fr').amounts;
  assert.deepEqual(lus.map((a) => a.value), ['1250.00']);
  assert.equal(lus[0].currency, 'EUR');
  assert.equal(lus[0].start, FACTURE.indexOf('1 250,00'));
});

test("verdict : un texte à plusieurs montants les rend tous", () => {
  assert.deepEqual(extractAmounts(DEVIS, 'fr').amounts.map((a) => a.value),
    ['1250.00', '125.00', '1125.00']);
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test("la convention est exigée et il n'y a pas de défaut", () => {
  for (const convention of [null, undefined, '', 'de', 'FR']) {
    const rapport = extractAmounts(FACTURE, convention);
    assert.deepEqual(rapport.amounts, []);
    assert.equal(rapport.reason, "declare a convention among ['en', 'fr']");
  }
});

test("un symbole partagé n'est pas tranché", () => {
  const lu = extractAmounts('$100', 'en').amounts[0];
  assert.equal(lu.currency, null);
  assert.ok(lu.currency_candidates.includes('USD') && lu.currency_candidates.includes('CAD'));
  assert.equal(extractAmounts('USD 100', 'en').amounts[0].currency, 'USD');
});

test('la marque doit toucher le nombre', () => {
  assert.deepEqual(extractAmounts(ENTETE, 'fr').amounts, []);
  assert.equal(extractAmounts(ENTETE, 'fr').unmarked, 5);
  const avec = ENTETE.replace('1 250,00', '1 250,00 €');
  assert.equal(extractAmounts(avec, 'fr').amounts.length, 1);
});

test("la valeur est les chiffres écrits, jamais un flottant", () => {
  const lus = extractAmounts('0,10 € + 0,20 €', 'fr').amounts;
  assert.deepEqual(lus.map((a) => a.value), ['0.10', '0.20']);
  for (const a of lus) assert.equal(typeof a.value, 'string');
  // Ce que cette fiche refuse de faire, et pourquoi.
  assert.notEqual(0.10 + 0.20, 0.30);
});

test('les formes de nombre connues sont lues', () => {
  assert.deepEqual(readNumber('1.234.567,89', 'fr'), ['1234567.89', false]);
  assert.deepEqual(readNumber('1,234,567.89', 'en'), ['1234567.89', false]);
  assert.deepEqual(readNumber('1 234 567,89', 'fr'), ['1234567.89', false]);
  assert.deepEqual(readNumber('12', 'fr'), ['12', false]);
  assert.deepEqual(readNumber('1,2345', 'fr'), ['1.2345', false]);
  assert.deepEqual(readNumber('12 5', 'fr'), [null, false]);
  assert.deepEqual(readNumber('1,2345,6', 'fr'), [null, false]);
  assert.deepEqual(extractAmounts('12 5 €', 'fr').amounts, []);
});

test("les espaces de groupement de l'écriture française sont lues", () => {
  for (const espace of [' ', ' ', ' ']) {
    assert.equal(extractAmounts(`1${espace}250,00 €`, 'fr').amounts[0].value, '1250.00');
  }
  assert.equal(extractAmounts("CHF 1'234.50", 'fr').amounts[0].value, '1234.50');
});

test("un pourcentage n'est pas un montant", () => {
  assert.deepEqual(extractAmounts('12,5 % de remise', 'fr').amounts, []);
});

test('aucune entrée ne lève', () => {
  for (const entree of [null, undefined, 42, [], {}, '']) {
    const rapport = extractAmounts(entree, 'fr');
    assert.deepEqual(rapport.amounts, []);
    if (typeof entree !== 'string') assert.ok(rapport.reason.startsWith('expected text'));
  }
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : entrée banale, une ligne de facture', () => {
  const lu = extractAmounts(FACTURE, 'fr').amounts[0];
  assert.deepEqual([lu.value, lu.currency, lu.mark], ['1250.00', 'EUR', '€']);
});

test('production : entrée vide', () => {
  assert.deepEqual(extractAmounts('', 'fr'), { amounts: [], unmarked: 0, reason: null });
});

test('production : entrée très grande et terminaison rapide', () => {
  const enorme = DEVIS.repeat(2000);
  const debut = performance.now();
  const rapport = extractAmounts(enorme, 'fr');
  assert.ok(performance.now() - debut < 60_000);
  assert.equal(rapport.amounts.length, 6000);
});

test('production : encodages inattendus', () => {
  assert.equal(extractAmounts('1 250,00 €', 'fr').amounts[0].value, '1250.00');
  assert.equal(extractAmounts('﻿1 250,00 €', 'fr').amounts[0].value, '1250.00');
  assert.deepEqual(extractAmounts('١٢٣ €', 'fr').amounts, []); // chiffres arabes
});

test('production : valeurs aux limites', () => {
  assert.equal(extractAmounts('£0.01', 'en').amounts[0].value, '0.01');
  assert.equal(extractAmounts('9 999 999 999 €', 'fr').amounts[0].value, '9999999999');
  assert.equal(extractAmounts('€1 250', 'fr').amounts[0].value, '1250');
  assert.equal(extractAmounts('1 250€', 'fr').amounts[0].value, '1250');
});

test("production : un nombre illisible n'empêche pas de lire les autres", () => {
  const lus = extractAmounts('12 5 € puis 1 250,00 €', 'fr').amounts;
  assert.deepEqual(lus.map((a) => a.value), ['1250.00']);
});

test('production : la lecture tient la classe de latence annoncée', () => {
  const debut = performance.now();
  for (let i = 0; i < 1000; i += 1) extractAmounts(DEVIS, 'fr');
  assert.ok(performance.now() - debut < 20_000);
});
