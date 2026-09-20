import test from 'node:test';
import assert from 'node:assert/strict';

import { MEAN_EXTRA, SIGNS, aggregate } from './n0.js';

// Une colonne de facture ordinaire, telle qu'un fichier la donne : du texte.
const FACTURE = ['83.87', '60.07', '12.35', '55.95', '1.38', '31.36'];

// La même colonne telle qu'un fichier réel la donne : avec ses trous.
const REELLE = ['1250.00', '125.00', '', 'n/a', '1125.50', '19,90', '3'];

/** La somme compensée, l'autre réponse classique au problème. */
function kahan(valeurs) {
  let total = 0;
  let correction = 0;
  for (const valeur of valeurs) {
    const ajuste = valeur - correction;
    const provisoire = total + ajuste;
    correction = (provisoire - total) - ajuste;
    total = provisoire;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : la moyenne est celle de ce qui a été lu', () => {
  const rapport = aggregate(REELLE);
  assert.equal(rapport.figures.count, 4);
  assert.equal(rapport.skipped.length, 3);
  assert.equal(rapport.figures.mean, '625.8750');
});

test('point de rupture : témoin, chaque ligne écartée revient avec sa raison', () => {
  assert.deepEqual(aggregate(REELLE).skipped.map((e) => [e.row, e.why]), [
    [2, 'empty'], [3, 'not a number'],
    [5, 'written with « , » as the decimal sign'],
  ]);
});

// ---------------------------------------------------------------------------
// Le verdict, confronté aux données de la fiche
// ---------------------------------------------------------------------------

test("verdict : la somme flottante n'est pas la somme de la facture", () => {
  let flottante = 0;
  for (const valeur of FACTURE) flottante += Number(valeur);
  assert.equal(String(flottante), '244.98000000000002');
  assert.equal(aggregate(FACTURE).figures.sum, '244.98');
  assert.notEqual(flottante, 244.98);
});

test("verdict : la somme compensée n'y change rien", () => {
  const valeurs = FACTURE.map(Number);
  assert.equal(String(kahan(valeurs)), '244.98000000000002');
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('la somme est exacte quelle que soit la longueur de la colonne', () => {
  assert.equal(aggregate(Array(10_000).fill('0.01')).figures.sum, '100.00');
  assert.equal(aggregate(Array(100).fill('0.07')).figures.sum, '7.00');
});

test('les valeurs sont alignées sur le plus grand nombre de décimales', () => {
  const figures = aggregate(['0.001', '1']).figures;
  assert.deepEqual([figures.sum, figures.decimals], ['1.001', 3]);
  assert.equal(figures.minimum, '0.001');
  assert.equal(figures.maximum, '1.000');
});

test('la moyenne est rendue deux décimales au-delà des données', () => {
  assert.equal(aggregate(['1', '2']).figures.mean, '1.50');
  assert.equal(MEAN_EXTRA, 2);
  assert.equal(aggregate(['0', '0', '1']).figures.mean, '0.33');
  assert.equal(aggregate(['-1', '-2']).figures.mean, '-1.50');
  assert.equal(aggregate(['0.005', '0.005', '0.005']).figures.mean, '0.00500');
});

test("le signe décimal est déclaré, et l'autre est refusé", () => {
  assert.equal(aggregate(['1250,00', '125,00'], ',').figures.sum, '1375.00');
  const refuse = aggregate(['1250,00'], '.');
  assert.equal(refuse.figures.count, 0);
  assert.equal(refuse.skipped[0].why, 'written with « , » as the decimal sign');
  assert.equal(aggregate(['1'], '!').reason,
    `the decimal sign must be one of ${SIGNS.join(' ')}`);
});

test("un séparateur de milliers n'est pas lu ici", () => {
  assert.equal(aggregate(['1 250.00']).skipped[0].why, 'not a number');
});

test('une colonne sans aucun nombre ne rend pas zéro', () => {
  const figures = aggregate(['', 'n/a']).figures;
  assert.equal(figures.count, 0);
  assert.equal(figures.sum, null);
  assert.equal(figures.mean, null);
});

test('aucune entrée ne lève', () => {
  assert.equal(aggregate('pas une liste').reason, 'expected a list of values');
  assert.equal(aggregate(null).reason, 'expected a list of values');
  assert.equal(aggregate([null, [], {}, true]).figures.count, 0);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : entrée banale, une colonne de facture', () => {
  const figures = aggregate(FACTURE).figures;
  assert.deepEqual([figures.count, figures.sum, figures.minimum], [6, '244.98', '1.38']);
});

test('production : entrée vide', () => {
  const rapport = aggregate([]);
  assert.equal(rapport.figures.count, 0);
  assert.deepEqual(rapport.skipped, []);
});

test('production : entrée très grande et terminaison rapide', () => {
  const enorme = Array(100_000).fill('1234567890123456789.99');
  const debut = performance.now();
  const rapport = aggregate(enorme);
  assert.ok(performance.now() - debut < 60_000);
  assert.equal(rapport.figures.sum, '123456789012345678999000.00');
});

test('production : encodages inattendus', () => {
  // L'espace insécable est une espace pour les deux langages : la valeur est lue.
  assert.equal(aggregate([' 12 ']).figures.sum, '12');
  assert.equal(aggregate(['١٢']).skipped[0].why, 'not a number');
  assert.equal(aggregate(['  12  ']).figures.sum, '12');
});

test('production : valeurs aux limites', () => {
  assert.equal(aggregate(['+7']).figures.sum, '7');
  assert.equal(aggregate(['00012.50']).figures.sum, '12.50');
  assert.equal(aggregate(['-5', '3', '-0.5']).figures.sum, '-2.5');
  assert.equal(aggregate(['1e3']).skipped[0].why, 'not a number');
});

test("production : une ligne illisible n'empêche pas de lire les autres", () => {
  const rapport = aggregate(['10', '20', 'Total', '30']);
  assert.equal(rapport.figures.sum, '60');
  assert.deepEqual(rapport.skipped, [{ row: 2, value: 'Total', why: 'not a number' }]);
});

test('production : la lecture tient la classe de latence annoncée', () => {
  const colonne = Array(1000).fill('12.34');
  const debut = performance.now();
  for (let i = 0; i < 1000; i += 1) aggregate(colonne);
  assert.ok(performance.now() - debut < 60_000);
});
