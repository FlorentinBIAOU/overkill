import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { forecast, seasonalCoefficients } from './n0.js';

const SEASON = 52;

/**
 * Trois ans d'un magasin dont le niveau ne bouge pas. Mille euros par semaine,
 * une vague annuelle qui culmine au printemps, et une petite ondulation.
 * Chaque valeur sort de cette formule : aucun tirage, aucun fichier.
 */
function steadyShop(week) {
  return 1000 + 200 * Math.sin((2 * Math.PI * week) / SEASON) + 10 * ((week % 5) - 2);
}

/** Une forme saisonnière pure, multipliée par un niveau fixe : le modèle exact de N0. */
function shape(week) {
  return 1 + 0.2 * Math.sin((2 * Math.PI * week) / SEASON) + 0.1 * Math.cos((4 * Math.PI * week) / SEASON);
}

/** Bruit uniforme dans [-0,5 ; 0,5), générateur MINSTD : identique en Python. */
function noise(count, seed = 20260915) {
  const values = [];
  let state = seed;
  for (let i = 0; i < count; i += 1) {
    state = (state * 48271) % 2147483647;
    values.push(state / 2147483647 - 0.5);
  }
  return values;
}

const close = (actual, expected, tolerance) => Math.abs(actual - expected) <= tolerance;
const closeAll = (actual, expected, relative) => actual.length === expected.length
  && actual.every((value, i) => Math.abs(value - expected[i]) <= relative * Math.abs(expected[i]));

const HISTORY = Array.from({ length: 3 * SEASON }, (_, week) => steadyShop(week));
const NEXT_WEEK_IN_TRUTH = steadyShop(3 * SEASON);

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : une rupture de tendance laisse la prévision loin au-dessus', () => {
  // « Un concurrent ouvre, les huit dernières semaines reculent l'une après
  // l'autre, et la prévision reste loin au-dessus de ce que le magasin encaisse. »
  const declining = Array.from({ length: 156 }, (_, week) => (
    week < 148 ? steadyShop(week) : steadyShop(week) * 0.95 ** (week - 147)
  ));
  const truth = steadyShop(156) * 0.95 ** 9;

  assert.ok(close(forecast(declining)[0] / truth, 1.274, 0.005)); // 27 % au-dessus

  // Témoin : sans le recul, la même série est prévue à 2 % près.
  assert.ok(Math.abs(forecast(HISTORY)[0] - NEXT_WEEK_IN_TRUTH) / NEXT_WEEK_IN_TRUTH < 0.02);
});

test('point de rupture : la prévision reste au-dessus tant que le recul continue', () => {
  // « — elle y restera. » Huit semaines de recul de plus, huit prévisions trop hautes.
  const series = Array.from({ length: 172 }, (_, w) => (w < 148 ? steadyShop(w) : steadyShop(w) * 0.95 ** (w - 147)));
  for (let end = 156; end < 172; end += 1) {
    assert.ok(forecast(series.slice(0, end))[0] > 1.2 * series[end]);
  }
});

test('point de rupture : une semaine de promotion gonfle la prévision suivante', () => {
  // « Une seule semaine de promotion entre dans la moyenne comme du commerce
  // ordinaire et gonfle la prévision de la semaine suivante. »
  const withPromotion = [...HISTORY];
  withPromotion[withPromotion.length - 1] *= 2;

  assert.ok(close(forecast(withPromotion)[0] / forecast(HISTORY)[0], 1.124, 0.005));

  // Témoin : la semaine sans promotion est prévue à 2 % près.
  assert.ok(Math.abs(forecast(HISTORY)[0] - NEXT_WEEK_IN_TRUTH) / NEXT_WEEK_IN_TRUTH < 0.02);
});

test("point de rupture : la moyenne mobile n'a pas de pente", () => {
  // « La moyenne mobile n'a pas de pente », et escalate_when : « toujours sous le
  // réalisé pendant que vous grandissez, toujours au-dessus pendant que vous reculez ».
  const growing = (w) => 800 + 4 * w + 150 * Math.sin((2 * Math.PI * w) / SEASON);
  const shrinking = (w) => 2000 - 4 * w + 150 * Math.sin((2 * Math.PI * w) / SEASON);
  for (let end = 104; end < 156; end += 1) {
    assert.ok(forecast(Array.from({ length: end }, (_, w) => growing(w)))[0] < growing(end));
    assert.ok(forecast(Array.from({ length: end }, (_, w) => shrinking(w)))[0] > shrinking(end));
  }
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('prévoit la semaine suivante à deux pour cent près', () => {
  const predicted = forecast(HISTORY)[0];
  assert.ok(Math.abs(predicted - NEXT_WEEK_IN_TRUTH) / NEXT_WEEK_IN_TRUTH < 0.02);
});

test('les deux langages donnent le même nombre à la sixième décimale', () => {
  // Le même nombre est affirmé dans n0.test.py.
  assert.ok(close(forecast(HISTORY)[0], 1003.624843, 1e-6));
});

test("la forme saisonnière est lue dans l'historique", () => {
  const coefficients = seasonalCoefficients(HISTORY, SEASON);
  assert.ok(coefficients[13] > 1.15);
  assert.ok(coefficients[39] < 0.85);
  assert.ok(close(coefficients.reduce((t, v) => t + v, 0) / SEASON, 1, 1e-9));
});

test("un coefficient de 1,2 signifie vingt pour cent au-dessus du niveau de l'année", () => {
  const ordinary = 1000;
  // b = 1,2 × (51 a + b) / 52, résolu en b : la semaine 50 vaut 1,2 fois la moyenne de l'année.
  const peak = (1.2 * 51 * ordinary) / (52 - 1.2);
  const history = Array.from({ length: 2 * SEASON }, (_, week) => (week % SEASON === 50 ? peak : ordinary));
  assert.ok(close(seasonalCoefficients(history, SEASON)[50], 1.2, 1e-12));
});

test('remettre la forme ne gonfle ni ne dégonfle la prévision', () => {
  // Sur un cycle entier, la prévision moyenne vaut le niveau, même quand
  // l'historique ne compte pas un nombre entier de cycles.
  const history = Array.from({ length: 130 }, (_, week) => 1000 * shape(week));
  const year = forecast(history, { horizon: SEASON });
  let meanShape = 0;
  for (let w = 0; w < SEASON; w += 1) meanShape += shape(w) / SEASON;
  assert.ok(close(year.reduce((t, v) => t + v, 0) / SEASON, 1000 * meanShape, 1e-9));
});

test('diviser la saison, moyenner puis remettre la forme retrouve une série multiplicative', () => {
  const history = Array.from({ length: 3 * SEASON }, (_, week) => 1000 * shape(week));
  const expected = Array.from({ length: SEASON }, (_, s) => 1000 * shape(3 * SEASON + s));
  assert.ok(closeAll(forecast(history, { horizon: SEASON }), expected, 1e-12));
});

test("l'historique et la prévision partagent une même horloge", () => {
  // « L'appelant n'a jamais à caler la série sur un mois de janvier. »
  const offset = 13; // l'historique commence un 1er avril
  const history = Array.from({ length: 3 * SEASON }, (_, i) => 1000 * shape(offset + i));
  const expected = [0, 1, 2, 3].map((s) => 1000 * shape(offset + 156 + s));
  assert.ok(closeAll(forecast(history, { horizon: 4 }), expected, 1e-12));
});

test('une fenêtre courte réagit vite, une fenêtre longue est plus stable', () => {
  // Réactivité : le niveau tombe à 800 sur les six dernières semaines.
  const step = Array.from({ length: 3 * SEASON }, (_, w) => 1000 * shape(w) * (w >= 150 ? 0.8 : 1));
  const truth = 800 * shape(156);
  const shortError = Math.abs(forecast(step, { window: 2 })[0] - truth);
  const longError = Math.abs(forecast(step, { window: 12 })[0] - truth);
  // Pas zéro : le recul entre aussi dans les coefficients de ces six semaines.
  assert.ok(shortError < longError / 2);

  // Stabilité : sur un niveau fixe bruité, les prévisions successives dispersent moins.
  const bruit = noise(200);
  const noisy = Array.from({ length: 200 }, (_, w) => 1000 * shape(w) + 200 * bruit[w]);
  const spread = (window) => {
    const levels = [];
    for (let end = 120; end < 200; end += 1) levels.push(forecast(noisy.slice(0, end), { window })[0] / shape(end));
    const mean = levels.reduce((t, v) => t + v, 0) / levels.length;
    return Math.sqrt(levels.reduce((t, v) => t + (v - mean) ** 2, 0) / levels.length);
  };
  assert.ok(spread(12) < spread(2));
});

test('refuse un historique plus court que deux cycles', () => {
  assert.throws(() => forecast(HISTORY.slice(0, 2 * SEASON - 1)), { name: 'RangeError', message: /two full cycles/ });
  // Exactement deux cycles : accepté.
  assert.equal(forecast(HISTORY.slice(0, 2 * SEASON)).length, 1);
});

test('un horizon rend une valeur par semaine', () => {
  assert.equal(forecast(HISTORY, { horizon: 3 }).length, 3);
  assert.deepEqual(forecast(HISTORY, { horizon: 0 }), []);
});

test('une série plate est prévue à la même valeur', () => {
  assert.ok(close(forecast(new Array(2 * SEASON).fill(750))[0], 750, 1e-9));
});

test("n0 n'emploie aucune dépendance", () => {
  // Docstring : « No dependency » ; risks : vendor_lock none.
  const source = readFileSync(new URL('./n0.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s|require\(/m);
});

test('n0 est déterministe', () => {
  // risks : deterministic true ; scenario : « se rejoue à l'identique ».
  const first = forecast([...HISTORY], { horizon: 8 });
  for (let i = 0; i < 20; i += 1) assert.deepEqual(forecast([...HISTORY], { horizon: 8 }), first);
});

test("une prévision prend moins d'une milliseconde", () => {
  // latency : « <1 ms », sur trois ans d'historique. Meilleur de cinq séries de cinquante appels.
  const runs = [];
  for (let r = 0; r < 5; r += 1) {
    const start = performance.now();
    for (let i = 0; i < 50; i += 1) forecast(HISTORY);
    runs.push((performance.now() - start) / 50);
  }
  assert.ok(Math.min(...runs) < 1);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : une entrée vide est refusée par une erreur nommée', () => {
  assert.throws(() => forecast([]), { name: 'RangeError', message: /two full cycles/ });
});

test('production : trois cents ans de semaines terminent vite et juste', () => {
  const history = Array.from({ length: 100 * 3 * SEASON }, (_, week) => steadyShop(week));
  const start = performance.now();
  const predicted = forecast(history)[0];
  assert.ok(performance.now() - start < 2000);
  assert.ok(Math.abs(predicted - steadyShop(history.length)) / steadyShop(history.length) < 0.03);
});

test('DÉFAUT : une valeur manquante ou non numérique ne lève aucune erreur', async () => {
  // NaN rend NaN, null est compté comme zéro, "1000" rend NaN : aucun ne lève.
  await assert.rejects(async () => {
    for (const bad of [NaN, null, '1000']) {
      assert.throws(() => forecast([...HISTORY.slice(0, -1), bad]));
    }
  }, assert.AssertionError);
});

test('DÉFAUT : une semaine fermée chaque année fait tomber la prévision à NaN', async () => {
  // Fermeture annuelle la dernière semaine de l'année : coefficient nul, 0 / 0 dans la fenêtre.
  const history = Array.from({ length: 3 * SEASON }, (_, week) => (week % SEASON === 51 ? 0 : steadyShop(week)));
  await assert.rejects(async () => {
    assert.ok(forecast(history, { horizon: 2 }).every(Number.isFinite));
  }, assert.AssertionError);
});

test('production : un historique entièrement nul prévoit zéro', () => {
  assert.deepEqual(forecast(new Array(2 * SEASON).fill(0), { horizon: 2 }), [0, 0]);
});

test("production : une fenêtre d'une semaine ne garde que la dernière", () => {
  const history = Array.from({ length: 3 * SEASON }, (_, w) => 1000 * shape(w));
  history[history.length - 1] = 1500 * shape(155);
  // Pas 1650 : la semaine forte gonfle aussi le coefficient de sa propre position.
  assert.ok(close(forecast(history, { window: 1 })[0], 1414.285714, 1e-6));
  assert.ok(close(forecast(history, { window: 4 })[0], 1178.571429, 1e-6));
});

test("DÉFAUT : window=0 fait la moyenne de tout l'historique, sans erreur", async () => {
  await assert.rejects(async () => {
    assert.throws(() => forecast(HISTORY, { window: 0 }), RangeError);
  }, assert.AssertionError);
});
