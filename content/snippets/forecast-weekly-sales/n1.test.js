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
// Quatre ans, rupture au début de la quatrième année : un cycle complet d'après rupture.
const REGIME_CHANGE_ONE_CYCLE_AFTER = Array.from({ length: 4 * SEASON }, (_, week) => growingShop(week) * (week >= 156 ? 0.7 : 1));

/**
 * Une boulangerie, et rien de la forme du modèle : un pic de Noël étroit sur
 * deux semaines, une semaine fermée en août, et un bruit multiplicatif.
 *
 * C'est le témoin de `growingShop`, qui est, lui, exactement une constante, une
 * droite et deux harmoniques — la forme que les moindres carrés décrivent par
 * construction.
 */
function bakery(week) {
  const inYear = week % SEASON;
  if (inYear === 31) return 0; // la semaine de fermeture
  const peak = inYear === 51 ? 900 : inYear === 50 ? 400 : 0;
  return (800 + 4 * week + peak) * (1 + (0.05 * ((week % 5) - 2)) / 2);
}

const BAKERY_UNTIL_CHRISTMAS = Array.from({ length: 155 }, (_, week) => bakery(week));
const CHRISTMAS_IN_TRUTH = bakery(155);

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

test('prévoit la semaine suivante à deux pour cent près, sur une série de sa propre forme', () => {
  // `growingShop` est une constante, une droite et deux harmoniques : la forme
  // exacte du modèle. Ce test montre que les moindres carrés retrouvent leurs
  // propres coefficients — pas qu'ils prévoient des ventes.
  const predicted = forecast(fit(HISTORY))[0];
  assert.ok(Math.abs(predicted - NEXT_WEEK_IN_TRUTH) / NEXT_WEEK_IN_TRUTH < 0.02);
});

test('verdict : sur un changement de niveau, N0 bat N1', () => {
  // « sur un changement de niveau — un concurrent qui ouvre — N0 se recale en
  // quatre semaines et N1 se trompe de près d'un tiers, en lisant encore une
  // croissance ».
  const truth = growingShop(3 * SEASON) * 0.7;
  const n0 = forecastN0(REGIME_CHANGE)[0];
  const n1 = forecast(fit(REGIME_CHANGE))[0];
  assert.equal(Math.round(truth), 1025);
  assert.equal(Math.round(n0), 995);
  assert.equal(Math.round(n1), 1310);
  assert.ok(Math.abs(n0 - truth) / truth < 0.04);
  assert.ok((n1 - truth) / truth > 0.27);
  // Et le coefficient de croissance lu sur un commerce qui a perdu 30 % :
  assert.ok(fit(REGIME_CHANGE).coefficients[1] > 80);
  // Témoin : sur la croissance régulière, N1 gagne, et largement.
  assert.ok(Math.abs(forecast(fit(HISTORY))[0] - NEXT_WEEK_IN_TRUTH)
    < Math.abs(forecastN0(HISTORY)[0] - NEXT_WEEK_IN_TRUTH));
});

test('verdict : sur une série hors de la forme du modèle, N0 bat N1', () => {
  // « sur un pic de Noël de deux semaines, que deux paires d'harmoniques ne
  // savent pas dessiner, N1 sous-prévoit d'un tiers la semaine où la rupture de
  // stock coûte le plus ».
  const n0 = forecastN0(BAKERY_UNTIL_CHRISTMAS)[0];
  const n1 = forecast(fit(BAKERY_UNTIL_CHRISTMAS))[0];
  assert.equal(Math.round(CHRISTMAS_IN_TRUTH), 2204);
  assert.equal(Math.round(n0), 2356);
  assert.equal(Math.round(n1), 1527);
  assert.ok(Math.abs(n0 - CHRISTMAS_IN_TRUTH) / CHRISTMAS_IN_TRUTH < 0.08);
  assert.ok((CHRISTMAS_IN_TRUTH - n1) / CHRISTMAS_IN_TRUTH > 0.3);
});

test('les deux langages donnent le même nombre à la sixième décimale', () => {
  // numpy d'un côté, équations normales et Gauss de l'autre : le même nombre.
  assert.ok(close(forecast(fit(HISTORY))[0], 1481.923623, 1e-6));
});

test('relit la croissance annuelle dans la série', () => {
  // La série grandit de 4 par semaine, donc 208 par an.
  assert.ok(close(fit(HISTORY).coefficients[1], 208, 2));
});

test('le coefficient est la croissance par cycle, donc par an avec la saison de 52 semaines', () => {
  // docstring : « it is the growth per cycle, per year with the default 52-week season ».
  const series = Array.from({ length: 104 }, (_, w) => w + 10 * Math.sin((2 * Math.PI * w) / 13));
  assert.ok(close(fit(series, { seasonLength: 13 }).coefficients[1], 13, 1e-6));
  assert.ok(close(fit(Array.from({ length: 104 }, (_, w) => w)).coefficients[1], 52, 1e-6));
});

test('la saison peut ne pas être un nombre entier de semaines', () => {
  // « `seasonLength` need not be a whole number […] Pass 365.25 / 7 to hold it
  // in place — which […] N0, indexing by `week % seasonLength`, cannot do ».
  const annee = 365.25 / 7;
  const serie = Array.from({ length: 3 * SEASON }, (_, w) => 800 + 4 * w + 150 * Math.sin((2 * Math.PI * w) / annee));
  const model = fit(serie, { seasonLength: annee });
  assert.ok(Math.abs(model.coefficients[1] - 4 * annee) < 1);
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

test('sur une série plate N0 et N1 rendent la même prévision, à l’erreur d’arrondi près', () => {
  const flat = new Array(2 * SEASON).fill(750);
  const model = fit(flat);
  assert.ok(close(forecast(model)[0], forecastN0(flat)[0], 1e-9));
  assert.ok(Math.abs(model.coefficients[1]) < 1e-6);
});

test('refuse un historique plus court que le nombre de variables', () => {
  // Garde « fewer weeks of history than features », atteinte en premier : cinq
  // semaines pour six variables, ou un cycle quand harmonics demande 62 variables.
  assert.throws(() => fit(HISTORY.slice(0, 5)), { name: 'RangeError', message: /fewer weeks/ });
  assert.throws(() => fit(HISTORY.slice(0, SEASON), { harmonics: 30 }), { name: 'RangeError', message: /fewer weeks/ });
  // Témoin : 25 paires, 52 variables pour 52 semaines, accepté.
  assert.equal(fit(HISTORY.slice(0, SEASON), { harmonics: 25 }).coefficients.length, 52);
});

test('refuse moins d’un cycle complet et accepte exactement un cycle', () => {
  // docstring : « Less than one full cycle of history cannot tell the trend from
  // the season, so it is refused ». Six semaines passaient ; désormais refusées.
  for (const weeks of [6, 10, 20, 26, SEASON - 1]) {
    assert.throws(() => fit(HISTORY.slice(0, weeks)), { name: 'RangeError', message: /less than one full cycle/ });
  }
  assert.equal(fit(HISTORY.slice(0, SEASON)).coefficients.length, 6);
  assert.equal(fit(HISTORY.slice(0, 13), { seasonLength: 13 }).coefficients.length, 6);
  assert.throws(() => fit(HISTORY.slice(0, 12), { seasonLength: 13 }), { name: 'RangeError', message: /less than one full cycle/ });
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

test("deux paires placent un pic de Noël et un creux d'été", () => {
  // Docstring Python : « Two pairs are enough to place a Christmas peak and a summer dip ».
  const { ahead } = peakAndDip(2);
  // L'horizon commence en position 0 du cycle : l'indice est la semaine de l'année.
  assert.ok(argmax(ahead) >= 47 && argmax(ahead) <= 51);
  assert.ok(argmin(ahead) >= 27 && argmin(ahead) <= 33);
});

test('un pic de quelques semaines demande plus de paires pour atteindre toute sa hauteur', () => {
  // Docstring Python : « a peak only a few weeks wide needs more pairs to reach its
  // full height ». Pic de trois semaines à 1 350 : 1 239 à deux paires, 1 325 à
  // quatre, atteint à six ; erreur moyenne 36,5, 14,6, 7,8.
  const [two, four, six] = [2, 4, 6].map((h) => peakAndDip(h));
  assert.ok(Math.max(...two.ahead) < 1350 - 80);
  assert.ok(Math.max(...two.ahead) < Math.max(...four.ahead) && Math.max(...four.ahead) < Math.max(...six.ahead));
  assert.ok(Math.max(...six.ahead) > 1350 - 20);
  assert.ok(six.error < four.error && four.error < two.error);
});

test("n1 n'emploie aucune dépendance", () => {
  // Docstring JS : « short enough that no dependency is worth it ». Plus aucun nombre de lignes n'est affirmé.
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

test('réajuster sur un cycle complet après la rupture rapproche la prévision', () => {
  // escalate_when : « réajuster sur la période qui suit la rupture dès qu'elle couvre
  // un cycle complet ». Série et bornes refaites : vingt semaines sont refusées.
  const truth = growingShop(4 * SEASON) * 0.7;
  const refit = forecast(fit(REGIME_CHANGE_ONE_CYCLE_AFTER.slice(-SEASON)))[0];
  const whole = forecast(fit(REGIME_CHANGE_ONE_CYCLE_AFTER))[0];
  assert.ok(Math.abs(refit - truth) / truth < 0.03);
  assert.ok(Math.abs(refit - truth) < Math.abs(whole - truth) / 2);
});

test('après réajustement sur un cycle complet, le coefficient de croissance se relit', () => {
  // escalate_when : « puis relire le coefficient de croissance » : 138,8 lu pour +145,6.
  const growth = fit(REGIME_CHANGE_ONE_CYCLE_AFTER.slice(-SEASON)).coefficients[1];
  assert.ok(close(growth, 138.8, 0.1));
  assert.ok(growth > 0.9 * 145.6 && growth < 1.1 * 145.6);
});

test('sur vingt semaines, l’extrait refuse, et la tendance se confond avec la saison', () => {
  // escalate_when : « Plus tôt, l'extrait refuse l'ajustement : sur vingt semaines, la
  // tendance et la saison se confondent, et le coefficient de croissance ne se relit
  // plus ». Le refus, puis la raison : les mêmes moindres carrés, résolus ici hors de
  // l'extrait (équations normales, Gauss), lisent -7 760 par an pour +145,6.
  const recent = REGIME_CHANGE.slice(-20);
  assert.throws(() => fit(recent), { name: 'RangeError', message: /less than one full cycle/ });
  const design = recent.map((_, w) => calendarFeatures(w, SEASON, 2));
  const rows = design[0].map((_, i) => [
    ...design[0].map((__, j) => sum(design.map((r) => r[i] * r[j]))),
    sum(design.map((r, w) => r[i] * recent[w])),
  ]);
  for (let c = 0; c < 6; c += 1) {
    const p = rows.slice(c).reduce((best, r, k) => (Math.abs(r[c]) > Math.abs(rows[best][c]) ? c + k : best), c);
    [rows[c], rows[p]] = [rows[p], rows[c]];
    for (let r = 0; r < 6; r += 1) {
      if (r !== c) {
        const f = rows[r][c] / rows[c][c];
        for (let k = c; k <= 6; k += 1) rows[r][k] -= f * rows[c][k];
      }
    }
  }
  assert.ok(close(rows[1][6] / rows[1][1], -7759.68, 0.5));
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

test('essai : un historique refusé s’affiche « historique trop court », avec le message de l’extrait', () => {
  // Libellé de refus (tour 2) : « Refusé : historique trop court » / « Refused: history too short ».
  const [up, , five] = essaiHistories();
  const cinq = essai.run(five.join(' '), 'fr');
  assert.equal(cinq.verdict.label, 'Refusé : historique trop court');
  assert.match(cinq.verdict.detail, /fewer weeks of history than features/);
  const unCycleMoinsUne = essai.run(up.slice(0, SEASON - 1).join(' '), 'en');
  assert.equal(unCycleMoinsUne.verdict.label, 'Refused: history too short');
  assert.match(unCycleMoinsUne.verdict.detail, /less than one full cycle/);
  // Témoin : un cycle complet est ajusté et affiché.
  assert.equal(essai.run(up.slice(0, SEASON).join(' '), 'fr').rows.rows.length, 8);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : une entrée vide est refusée par une erreur nommée', () => {
  // Le nombre de variables est calculé avant la matrice : plus de TypeError sur design[0].
  assert.throws(() => fit([]), { name: 'RangeError', message: /fewer weeks/ });
});

test('production : trois cents ans de semaines terminent vite et juste', () => {
  const history = Array.from({ length: 100 * 3 * SEASON }, (_, w) => growingShop(w));
  const start = performance.now();
  const predicted = forecast(fit(history))[0];
  assert.ok(performance.now() - start < 5000);
  // Le même nombre est affirmé en Python.
  assert.ok(close(predicted, 63259.968239, 1e-5));
});

test('production : une semaine manquante est refusée', () => {
  // Commentaire : « A missing week must be refused: null would be multiplied as zero, NaN would spread ».
  for (const missing of [NaN, null, Infinity, '1000']) {
    assert.throws(() => fit([...HISTORY.slice(0, -1), missing]), { name: 'TypeError', message: /finite number/ });
  }
});

test('production : un historique de moins d’un cycle ne rend pas une croissance absurde', () => {
  // Dix semaines rendaient +899 850 par an pour 208 : elles sont refusées, par une erreur nommée.
  for (const weeks of [10, 20, 26]) {
    assert.throws(() => fit(HISTORY.slice(0, weeks)), { name: 'RangeError', message: /less than one full cycle/ });
  }
});

test('production : un horizon nul rend une liste vide', () => {
  assert.deepEqual(forecast(fit(HISTORY), 0), []);
});
