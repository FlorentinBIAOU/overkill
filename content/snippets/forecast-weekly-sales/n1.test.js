import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { forecast as forecastN0 } from './n0.js';
import { calendarFeatures, fit, forecast } from './n1.js';
import essai from '../../tryouts/live/forecast-weekly-sales.js';

const SEASON = 52;

/**
 * Trois ans d'un magasin qui grandit de deux cent huit par an. Un niveau, une
 * tendance droite, une vague annuelle avec une seconde harmonique, et une petite
 * ondulation. Aucun tirage, aucun fichier.
 */
function growingShop(week) {
  return (
    800
    + 4 * week
    + 150 * Math.sin((2 * Math.PI * week) / SEASON)
    + 60 * Math.cos((4 * Math.PI * week) / SEASON)
    + 20 * ((week % 7) - 3)
  );
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

/** Les historiques des cas de l'essai, lus dans l'essai lui-même. */
function essaiHistories() {
  return essai.cases.map((c) => c.input.match(/-?\d+(?:\.\d+)?/g).map(Number));
}

const close = (actual, expected, tolerance) => Math.abs(actual - expected) <= tolerance;
const sum = (values) => values.reduce((t, v) => t + v, 0);
const argmax = (values) => values.indexOf(Math.max(...values));
const argmin = (values) => values.indexOf(Math.min(...values));

const HISTORY = Array.from({ length: 3 * SEASON }, (_, week) => growingShop(week));
const NEXT_WEEK_IN_TRUTH = growingShop(3 * SEASON);
const REGIME_CHANGE = HISTORY.map((value, week) => (week >= 136 ? value * 0.7 : value));

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : une rupture de régime est moyennée', () => {
  // « Les vingt dernières semaines s'installent à un niveau nettement plus bas :
  // l'ajustement coupe la poire en deux entre l'ancien monde et le nouveau, et
  // prévoit un niveau que le magasin n'a plus atteint depuis cinq mois. »
  const predicted = forecast(fit(REGIME_CHANGE))[0];
  const newWorld = growingShop(156) * 0.7;
  const oldWorld = growingShop(156);

  assert.ok(close(predicted, 1310.320702, 1e-6));
  assert.ok(newWorld < predicted && predicted < oldWorld); // la poire coupée en deux
  assert.ok(predicted > Math.max(...REGIME_CHANGE.slice(-20))); // jamais atteint en vingt semaines

  // Témoin : sans la rupture, la même série est prévue à 2 % près.
  assert.ok(Math.abs(forecast(fit(HISTORY))[0] - NEXT_WEEK_IN_TRUTH) / NEXT_WEEK_IN_TRUTH < 0.02);
});

test('point de rupture : les moindres carrés pèsent chaque semaine pareil', () => {
  // La solution annule le gradient de la somme des carrés NON pondérée :
  // Xᵀ (X b − y) = 0. Une pondération la déplacerait.
  const { coefficients } = fit(REGIME_CHANGE);
  const design = REGIME_CHANGE.map((_, w) => calendarFeatures(w, SEASON, 2));
  const residuals = design.map((row, w) => sum(row.map((x, i) => x * coefficients[i])) - REGIME_CHANGE[w]);
  const gradient = coefficients.map((_, i) => sum(design.map((row, w) => row[i] * residuals[w])));
  const scale = Math.max(...coefficients.map((_, i) => Math.abs(sum(design.map((row, w) => row[i] * REGIME_CHANGE[w])))));
  assert.ok(Math.max(...gradient.map(Math.abs)) < 1e-6 * scale);
});

test("point de rupture : l'essai du concurrent prévoit plus de mille et lit encore une croissance", () => {
  // Essai, cas qui échoue : « moins de neuf cents pains par semaine depuis
  // l'ouverture d'un concurrent, il y a vingt semaines, et la prévision en annonce
  // plus de mille […] et lit encore une croissance de plus de quatre-vingts pains
  // par an sur un commerce qui a perdu trente pour cent de ses ventes ».
  const [up, , , competitor] = essaiHistories();
  assert.equal(competitor.length, 104);
  assert.deepEqual(competitor.slice(0, 84), up.slice(0, 84));
  assert.notEqual(competitor[84], up[84]);
  assert.ok(competitor.slice(84).every((c, i) => close(c / up[84 + i], 0.7, 0.002)));

  const model = fit(competitor);
  assert.ok(Math.max(...competitor.slice(-20)) < 900);
  assert.ok(forecast(model)[0] > 1000);
  assert.ok(model.coefficients[1] > 80);

  // Témoin : sans concurrent, la prévision prolonge la dernière semaine.
  assert.ok(Math.abs(forecast(fit(up))[0] - up.at(-1)) / up.at(-1) < 0.05);
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('prévoit la semaine suivante à deux pour cent près', () => {
  const predicted = forecast(fit(HISTORY))[0];
  assert.ok(Math.abs(predicted - NEXT_WEEK_IN_TRUTH) / NEXT_WEEK_IN_TRUTH < 0.02);
});

test('les deux langages donnent le même nombre à la sixième décimale', () => {
  // numpy d'un côté, équations normales et Gauss de l'autre : le même nombre.
  assert.ok(close(forecast(fit(HISTORY))[0], 1481.923623, 1e-6));
});

test('relit la croissance annuelle dans la série', () => {
  // La série grandit de 4 par semaine, donc 208 par an.
  assert.ok(close(fit(HISTORY).coefficients[1], 208, 2));
});

test('estime la pente que N0 ignore', () => {
  // Sur la même série qui grandit, N0 se trompe toujours par défaut ; N1 des deux côtés, et moins.
  const errorsN0 = [];
  const errorsN1 = [];
  for (let end = 104; end < 156; end += 1) {
    errorsN0.push(forecastN0(HISTORY.slice(0, end))[0] - HISTORY[end]);
    errorsN1.push(forecast(fit(HISTORY.slice(0, end)))[0] - HISTORY[end]);
  }
  assert.ok(errorsN0.every((e) => e < 0));
  assert.ok(errorsN1.some((e) => e < 0) && errorsN1.some((e) => e > 0));
  assert.ok(sum(errorsN1.map(Math.abs)) < sum(errorsN0.map(Math.abs)) / 2);
});

test('prolonge la tendance sur six mois', () => {
  const sixMonths = forecast(fit(HISTORY), 26);
  assert.ok(sixMonths.at(-1) - sixMonths[0] > 80);
});

test('sur une série plate N0 et N1 rendent le même nombre', () => {
  const flat = new Array(2 * SEASON).fill(750);
  const model = fit(flat);
  assert.ok(close(forecast(model)[0], forecastN0(flat)[0], 1e-9));
  assert.ok(Math.abs(model.coefficients[1]) < 1e-6);
});

test('refuse un historique plus court que le nombre de variables', () => {
  assert.throws(() => fit(HISTORY.slice(0, 5)), { name: 'RangeError', message: /fewer weeks/ });
  // Exactement six semaines, six variables : accepté.
  assert.equal(fit(HISTORY.slice(0, 6)).coefficients.length, 6);
});

test('la ligne de la matrice est tout le modèle', () => {
  const row = calendarFeatures(13, SEASON, 2);
  [1, 0.25, 1, 0, 0, -1].forEach((expected, i) => assert.ok(close(row[i], expected, 1e-12)));

  const model = fit(HISTORY);
  const expected = sum(calendarFeatures(160, SEASON, 2).map((x, i) => x * model.coefficients[i]));
  assert.ok(close(forecast(model, 5)[4], expected, 1e-9));
});

test('six coefficients lisibles un par un sur cent cinquante-six nombres', () => {
  assert.equal(HISTORY.length, 156);
  const model = fit(HISTORY);
  assert.equal(model.coefficients.length, 6);
  assert.deepEqual(Object.keys(model).sort(), ['coefficients', 'harmonics', 'seasonLength', 'start']);
});

test('compter en cycles garde la matrice à des échelles comparables', () => {
  // « Compter la tendance en cycles plutôt qu'en semaines garde ces équations bien conditionnées. »
  const diagonalRatio = (trendScale) => {
    const diagonal = new Array(6).fill(0);
    for (let w = 0; w < 156; w += 1) {
      const row = calendarFeatures(w, SEASON, 2);
      row[1] *= trendScale;
      row.forEach((x, i) => { diagonal[i] += x * x; });
    }
    return Math.max(...diagonal) / Math.min(...diagonal);
  };
  assert.ok(diagonalRatio(1) < 10);
  assert.ok(diagonalRatio(SEASON) > 10_000);
});

/** Un pic de Noël (semaine 50, trois semaines de large) et un creux d'été (semaine 30), bruités. */
function peakAndDip(harmonics, weeks = 156) {
  const season = (p) => {
    const distance = Math.min(Math.abs(p - 50), SEASON - Math.abs(p - 50));
    return 1000 + 350 * Math.exp(-(distance ** 2) / 18) - 200 * Math.exp(-((p - 30) ** 2) / 50);
  };
  const bruit = noise(weeks + SEASON);
  const series = Array.from({ length: weeks }, (_, w) => season(w % SEASON) + 120 * bruit[w]);
  const ahead = forecast(fit(series, { harmonics }), SEASON);
  const error = sum(ahead.map((a, i) => Math.abs(a - season((weeks + i) % SEASON)))) / SEASON;
  return { ahead, error };
}

test("deux paires dessinent un pic de Noël et un creux d'été", () => {
  const { ahead } = peakAndDip(2);
  // L'horizon commence en position 0 du cycle : l'indice est la semaine de l'année.
  assert.ok(argmax(ahead) >= 47 && argmax(ahead) <= 51);
  assert.ok(argmin(ahead) >= 27 && argmin(ahead) <= 33);
});

test("INFIRMÉ : au-delà de deux paires on commence à dessiner le bruit ; sur un pic de Noël de trois semaines, quatre paires divisent l'erreur par 2,5", async () => {
  await assert.rejects(async () => {
    assert.ok(peakAndDip(4).error >= peakAndDip(2).error);
  }, assert.AssertionError);
});

test("n1 n'emploie aucune dépendance", () => {
  // Docstring JS : « vingt lignes qui ne valent aucune dépendance ».
  const source = readFileSync(new URL('./n1.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s|require\(/m);
});

test('n1 est déterministe', () => {
  const first = forecast(fit([...HISTORY]), 8);
  for (let i = 0; i < 20; i += 1) assert.deepEqual(forecast(fit([...HISTORY]), 8), first);
});

test("un ajustement et une prévision prennent moins d'une milliseconde", () => {
  const runs = [];
  for (let r = 0; r < 5; r += 1) {
    const start = performance.now();
    for (let i = 0; i < 50; i += 1) forecast(fit(HISTORY));
    runs.push((performance.now() - start) / 50);
  }
  assert.ok(Math.min(...runs) < 1);
});

test('réajuster après la rupture rapproche la prévision', () => {
  const truth = growingShop(156) * 0.7;
  const refit = forecast(fit(REGIME_CHANGE.slice(-20)))[0];
  assert.ok(Math.abs(refit - truth) / truth < 0.07);
  assert.ok(Math.abs(refit - truth) < Math.abs(forecast(fit(REGIME_CHANGE))[0] - truth) / 4);
});

test("INFIRMÉ : escalate_when dit de relire le coefficient de croissance après réajustement ; sur les vingt semaines d'après la rupture il vaut -7760 par an, pour +146", async () => {
  await assert.rejects(async () => {
    const growth = fit(REGIME_CHANGE.slice(-20)).coefficients[1];
    assert.ok(growth > 0.5 * 145.6 && growth < 1.5 * 145.6);
  }, assert.AssertionError);
});

test("l'essai lit la croissance des boulangeries et refuse cinq semaines", () => {
  const [up, flat, five] = essaiHistories();
  assert.equal(up.length, 104);
  assert.equal(flat.length, 104);
  assert.ok(close(fit(up).coefficients[1], 207.37, 0.01));
  assert.ok(Math.abs(fit(flat).coefficients[1]) < 1);
  assert.equal(five.length, 5);
  assert.throws(() => fit(five), { name: 'RangeError', message: /fewer weeks of history than features/ });
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('une entrée vide lève TypeError (design[0]) au lieu du refus nommé', () => {
  assert.throws(() => fit([]), RangeError);
});

test('production : trois cents ans de semaines terminent vite et juste', () => {
  const history = Array.from({ length: 100 * 3 * SEASON }, (_, w) => growingShop(w));
  const start = performance.now();
  const predicted = forecast(fit(history))[0];
  assert.ok(performance.now() - start < 5000);
  // Le même nombre est affirmé en Python.
  assert.ok(close(predicted, 63259.968239, 1e-5));
});

test('une semaine manquante rend une prévision NaN (NaN) ou fausse (null compté zéro), sans erreur', () => {
  for (const missing of [NaN, null]) {
    assert.throws(() => fit([...HISTORY.slice(0, -1), missing]));
  }
});

test("dix semaines d'historique sont acceptées et rendent une croissance de +899 850 par an pour 208", () => {
  for (const weeks of [10, 20, 26]) {
    let model;
    try {
      model = fit(HISTORY.slice(0, weeks));
    } catch (error) {
      if (error instanceof RangeError) continue;
      throw error;
    }
    assert.ok(model.coefficients[1] > 104 && model.coefficients[1] < 312);
  }
});

test('production : un horizon nul rend une liste vide', () => {
  assert.deepEqual(forecast(fit(HISTORY), 0), []);
});
