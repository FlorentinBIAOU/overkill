import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { DECIMALS, PER, estimateCost } from './n0.js';

// Un travail ordinaire : dix mille documents à faire lire, une page chacun.
const ITEMS = 10_000;
const PRIX_ENTREE = '0.15';
const PRIX_SORTIE = '0.60';

// La même page, comptée par un tokeniseur et estimée depuis ses caractères.
const PAGE_COMPTEE = 1200;
const PAGE_ESTIMEE = { characters: 4800, characters_per_token: '4' };
const PAGE_ESTIMEE_AUTREMENT = { characters: 4800, characters_per_token: '2.5' };

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test("point de rupture : une estimation dépend du rapport qu'on a déclaré", () => {
  const quatre = estimateCost(ITEMS, PAGE_ESTIMEE, 300, PRIX_ENTREE, PRIX_SORTIE);
  const deuxEtDemi = estimateCost(ITEMS, PAGE_ESTIMEE_AUTREMENT, 300, PRIX_ENTREE, PRIX_SORTIE);
  assert.equal(quatre.tokens.in, 1200);
  assert.equal(deuxEtDemi.tokens.in, 1920);
  assert.notEqual(quatre.cost.total, deuxEtDemi.cost.total);
  assert.equal(quatre.reason, null);
  assert.equal(deuxEtDemi.reason, null);
});

test("point de rupture : témoin, le rapport dit toujours s'il a compté ou estimé", () => {
  assert.equal(estimateCost(ITEMS, PAGE_COMPTEE, 300, PRIX_ENTREE, PRIX_SORTIE).tokens.source,
    'counted');
  assert.equal(estimateCost(ITEMS, PAGE_ESTIMEE, 300, PRIX_ENTREE, PRIX_SORTIE).tokens.source,
    'mixed');
  assert.equal(estimateCost(1, PAGE_ESTIMEE, PAGE_ESTIMEE, '1', '1').tokens.source, 'estimated');
});

// ---------------------------------------------------------------------------
// Ce que la fiche s'interdit
// ---------------------------------------------------------------------------

test("l'extrait ne porte aucun prix", () => {
  // Un dollar suivi d'un chiffre, un symbole monétaire, un code ISO : ce que
  // l'on cherche est un tarif, pas le « $ » d'une fin d'expression régulière
  // ni celui d'une interpolation de gabarit.
  const source = readFileSync(new URL('./n0.js', import.meta.url), 'utf8');
  const TARIF = /[€£¥₹]|\b(?:USD|EUR|GBP|JPY)\b|\$\s?[0-9]/;
  assert.equal(TARIF.exec(source), null);
});

test("le résultat est dans l'unité des prix donnés", () => {
  const rapport = estimateCost(1, 1_000_000, 0, '2.50', '0');
  assert.equal(rapport.cost.total, '2.500000');
  assert.ok(!('currency' in rapport) && !('currency' in rapport.cost));
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test("le calcul est exact et ne passe par aucun flottant", () => {
  const rapport = estimateCost(ITEMS, PAGE_COMPTEE, 300, PRIX_ENTREE, PRIX_SORTIE);
  assert.equal(rapport.cost.per_item, '0.000360');
  assert.equal(rapport.cost.total, '3.600000');
  assert.equal(typeof rapport.cost.total, 'string');
});

test("le seuil de bascule est le premier appel qui dépasse", () => {
  assert.equal(estimateCost(1, 1_000_000, 0, '2.50', '0',
    { fixedAlternative: '7.5' }).break_even_items, 3);
  assert.equal(estimateCost(1, 1_000_000, 0, '2.50', '0',
    { fixedAlternative: '7.51' }).break_even_items, 4);
});

test("un appel gratuit n'a pas de seuil de bascule", () => {
  assert.equal(estimateCost(1, 0, 0, '0', '0', { fixedAlternative: '800' }).break_even_items, null);
});

test("une fraction de jeton est facturée comme un jeton", () => {
  const unPeuPlus = { characters: 1001, characters_per_token: '4' };
  assert.equal(estimateCost(1, unPeuPlus, 0, '1', '1').tokens.in, 251);
});

test("l'unité de prix est un paramètre", () => {
  assert.equal(estimateCost(1000, 500, 500, '1', '1', { per: 1000 }).cost.total, '1000.000000');
  assert.equal(estimateCost(1000, 500, 500, '1', '1', { per: PER }).cost.total, '1.000000');
});

test('les décimales suivent les prix donnés', () => {
  assert.equal(estimateCost(1000, 500, 500, '0.0001', '0.0002', { decimals: 2 }).cost.decimals, 4);
  assert.equal(DECIMALS, 6);
});

test('chaque entrée impossible est nommée', () => {
  assert.ok(estimateCost(-1, 1, 1, '1', '1').reason.startsWith('items must be'));
  assert.ok(estimateCost(1, 1, 1, 'abc', '1').reason.startsWith('the in price'));
  assert.ok(estimateCost(1, 'x', 1, '1', '1').reason.startsWith('the in tokens'));
  assert.ok(estimateCost(1, 1, 1, '1', '1', { per: 0 }).reason.startsWith('the price unit'));
  assert.ok(estimateCost(1, 1, 1, '1', '1', { fixedAlternative: 'beaucoup' }).reason
    .startsWith('the alternative'));
});

test('aucune entrée ne lève', () => {
  for (const items of [null, undefined, 1.5, true, '10', []]) {
    assert.equal(estimateCost(items, 1, 1, '1', '1').cost, null);
  }
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : entrée banale, dix mille documents', () => {
  const rapport = estimateCost(ITEMS, PAGE_COMPTEE, 300, PRIX_ENTREE, PRIX_SORTIE,
    { fixedAlternative: '800' });
  assert.equal(rapport.tokens.total, 1500);
  assert.equal(rapport.cost.total, '3.600000');
  assert.equal(rapport.break_even_items, 2_222_223);
});

test('production : entrée vide', () => {
  const rapport = estimateCost(0, 0, 0, '0', '0');
  assert.equal(rapport.cost.total, '0.000000');
  assert.equal(rapport.tokens.total, 0);
});

test('production : entrée très grande et terminaison rapide', () => {
  const debut = performance.now();
  const rapport = estimateCost(10 ** 9, 10 ** 9, 10 ** 9, '999.999999', '999.999999');
  assert.ok(performance.now() - debut < 10_000);
  assert.equal(rapport.cost.total, '1999999998000000.000000');
});

test('production : valeurs aux limites', () => {
  assert.equal(estimateCost(1, 0, 0, '0', '0').cost.per_item, '0.000000');
  assert.equal(estimateCost(1, 1, 0, '0.000001', '0').cost.per_item, '0.000000');
  assert.equal(estimateCost(1, 500_000, 0, '0.000001', '0').cost.per_item, '0.000001');
});

test("production : un champ impossible n'empêche pas de dire pourquoi", () => {
  const rapport = estimateCost(1, { characters: -1, characters_per_token: '4' }, 0, '1', '1');
  assert.equal(rapport.cost, null);
  assert.ok(rapport.reason.startsWith('the in tokens'));
});

test('production : la lecture tient la classe de latence annoncée', () => {
  const debut = performance.now();
  for (let i = 0; i < 100_000; i += 1) {
    estimateCost(ITEMS, PAGE_COMPTEE, 300, PRIX_ENTREE, PRIX_SORTIE);
  }
  assert.ok(performance.now() - debut < 20_000);
});
