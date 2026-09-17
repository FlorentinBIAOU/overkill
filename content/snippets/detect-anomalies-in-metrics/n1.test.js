/**
 * Le score d'un point dépend de l'endroit où sont tombées les coupes :
 * JavaScript et Python ne s'accordent pas à la troisième décimale. Ils
 * s'accordent sur ce qui compte, les minutes qui passent le seuil.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { anomalies, score, train } from './n1.js';

const THRESHOLD = 0.65;

function wobble(minute, metric) {
  const step = minute * (0.6180339887498949 + 0.1 * metric);
  return step - Math.floor(step) - 0.5;
}

const daytime = (m) => [1000 + 80 * wobble(m, 0), 10 + wobble(m, 1), 130 + 10 * wobble(m, 2)];
const nighttime = (m) => [300 + 80 * wobble(m, 3), 3 + wobble(m, 4), 60 + 10 * wobble(m, 5)];
const nighttimeWithDaytimeErrors = (m) => [320 + 80 * wobble(m, 6), 9.6 + wobble(m, 7), 62 + 10 * wobble(m, 8)];

const ORDINARY = [
  ...Array.from({ length: 45 }, (_, minute) => daytime(minute)),
  ...Array.from({ length: 45 }, (_, minute) => nighttime(minute)),
];
const BROKEN_ERRORS = [320, 9.6, 62];
const BROKEN_LATENCY = [980, 9.8, 63];
const ROWS = [...ORDINARY, BROKEN_ERRORS, BROKEN_LATENCY];
const HABITUATED = [...ORDINARY, ...Array.from({ length: 15 }, (_, minute) => nighttimeWithDaytimeErrors(minute))];

function averageDepth(n) {
  return n > 1 ? 2 * (Math.log(n - 1) + 0.5772156649015329) - (2 * (n - 1)) / n : 0;
}
const cuts = (s, n) => -Math.log2(s) * averageDepth(n);

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : quinze minutes d’entraînement font un troisième régime', () => {
  assert.deepEqual(anomalies(train(HABITUATED), HABITUATED, THRESHOLD), []);
});

test('point de rupture : la minute signalée juste avant ne l’est plus', () => {
  assert.deepEqual(anomalies(train(ROWS), ROWS, THRESHOLD), [90, 91]);
  assert.ok(score(train(ROWS), BROKEN_ERRORS) > THRESHOLD);
  assert.ok(score(train(HABITUATED), BROKEN_ERRORS) < THRESHOLD);
});

test('point de rupture : rien dans la sortie ne dit que quelque chose a changé', () => {
  const flat = Array.from({ length: 40 }, () => [100, 5, 20]);
  assert.deepEqual(anomalies(train(HABITUATED), HABITUATED, THRESHOLD), anomalies(train(flat), flat, THRESHOLD));
  assert.equal(typeof score(train(HABITUATED), BROKEN_ERRORS), 'number');
});

test('constat : une seule minute suffit déjà', () => {
  assert.ok(score(train([...ORDINARY, nighttimeWithDaytimeErrors(0)]), BROKEN_ERRORS) < THRESHOLD);
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('signale les deux minutes dont la combinaison est impossible', () => {
  assert.deepEqual(anomalies(train(ROWS), ROWS, THRESHOLD), [90, 91]);
});

test('chaque minute signalée est ordinaire sur chaque métrique prise seule', () => {
  for (let metric = 0; metric < 3; metric += 1) {
    const column = ORDINARY.map((row) => row[metric]);
    for (const flagged of [BROKEN_ERRORS, BROKEN_LATENCY]) {
      assert.ok(flagged[metric] >= Math.min(...column) && flagged[metric] <= Math.max(...column));
    }
  }
});

test('un point à l’écart demande trois ou quatre coupes', () => {
  const model = train(ROWS);
  const broken = [cuts(score(model, BROKEN_ERRORS), 92), cuts(score(model, BROKEN_LATENCY), 92)];
  assert.ok(broken.every((c) => c > 3 && c < 5), String(broken));
  assert.ok(cuts(score(model, ORDINARY[0]), 92) > 5.5);
});

test('une minute hors de toute plage n’est pas signalée', async () => {
  assert.ok(score(train(ROWS), [1e6, 1e6, 1e6]) > THRESHOLD);
});

test('au-dessus d’un demi, le point a demandé moins de coupes que la foule', () => {
  const model = train(ROWS);
  for (const row of ROWS) {
    const s = score(model, row);
    assert.equal(s > 0.5, cuts(s, 92) < averageDepth(92));
  }
});

test('une flotte immobile n’a aucune anomalie', () => {
  const flat = Array.from({ length: 40 }, () => [100, 5, 20]);
  const model = train(flat);
  assert.ok(Math.abs(score(model, flat[0]) - 0.5) < 1e-9);
  assert.deepEqual(anomalies(model, flat, THRESHOLD), []);
});

test('le score est un rang entre zéro et un', () => {
  const model = train(ROWS);
  assert.ok(ROWS.every((row) => score(model, row) > 0 && score(model, row) < 1));
});

test('INFIRMÉ : la taille de la forêt est la seule vraie molette', async () => {
  await assert.rejects(async () => {
    const bySize = [50, 100, 500].map((trees) => anomalies(train(ROWS, { trees }), ROWS, THRESHOLD).join(','));
    assert.ok(new Set(bySize).size > 1);
  });
});

test('constat : le seuil change tout, la taille de la forêt presque rien', () => {
  const model = train(ROWS);
  assert.deepEqual([0.5, 0.55, 0.6, 0.65].map((t) => anomalies(model, ROWS, t).length), [52, 10, 4, 2]);
  for (const trees of [50, 100, 500]) assert.deepEqual(anomalies(train(ROWS, { trees }), ROWS, THRESHOLD), [90, 91]);
  // À dix arbres, une minute ordinaire de plus passe le seuil.
  assert.deepEqual(anomalies(train(ROWS, { trees: 10 }), ROWS, THRESHOLD), [70, 90, 91]);
});

test('le seuil est à vous', () => {
  const model = train(ROWS);
  const counts = [0, 0.5, 0.6, 0.7, 1].map((t) => anomalies(model, ROWS, t).length);
  assert.deepEqual(counts, [...counts].sort((a, b) => b - a));
  assert.equal(counts[0], ROWS.length);
  assert.equal(counts.at(-1), 0);
});

test('la graine fait partie du contrat', () => {
  assert.equal(score(train(ROWS), BROKEN_ERRORS), score(train(ROWS), BROKEN_ERRORS));
  assert.notEqual(score(train(ROWS, { seed: 1 }), BROKEN_ERRORS), score(train(ROWS), BROKEN_ERRORS));
});

test('rien n’est mis à l’échelle : une métrique en secondes pèse autant qu’en millisecondes', () => {
  const seconds = ROWS.map((r) => [r[0], r[1], r[2] / 1000]);
  const model = train(ROWS);
  const scaled = train(seconds);
  ROWS.forEach((row, i) => assert.ok(Math.abs(score(model, row) - score(scaled, seconds[i])) < 1e-12));
});

test('les coupes sont tirées entre le minimum et le maximum observés', () => {
  const model = train(ROWS);
  const low = [0, 1, 2].map((k) => Math.min(...ROWS.map((r) => r[k])));
  const high = [0, 1, 2].map((k) => Math.max(...ROWS.map((r) => r[k])));
  const walk = (node) => {
    if (node.below === undefined) return;
    assert.ok(node.cut >= low[node.metric] && node.cut <= high[node.metric]);
    walk(node.below);
    walk(node.above);
  };
  model.forest.forEach(walk);
});

test('l’extrait n’importe rien', () => {
  const source = readFileSync(new URL('./n1.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s/m);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('aucune ligne ou une seule ligne rend des scores NaN au lieu de lever', async () => {
  // Python lève ValueError sur zéro ligne et rend 0,5 sur une.
  assert.throws(() => train([]));
  assert.ok(Number.isFinite(score(train([[1, 2, 3]]), [1, 2, 3])));
});

test('production : une valeur manquante ne fait pas sonner toute la série', () => {
  // La même sortie que scikit-learn, qui accepte le NaN : les deux minutes
  // aberrantes, et elles seules.
  const rows = [...ROWS.slice(0, -1), [NaN, 1, 1]];
  assert.deepEqual(anomalies(train(rows), rows, THRESHOLD), [90, 91]);
});

test('production : score égal au seuil n’est pas signalé', () => {
  const model = train(ROWS);
  const exact = score(model, BROKEN_ERRORS);
  assert.ok(!anomalies(model, ROWS, exact).includes(90));
  assert.ok(anomalies(model, ROWS, exact - 1e-12).includes(90));
});

test('production : neuf mille deux cents minutes', () => {
  let seed = 1;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const rows = Array.from({ length: 9200 }, () => [1000 + 100 * rnd(), 10 + rnd(), 130 + 10 * rnd()]);
  const started = Date.now();
  anomalies(train(rows), rows, THRESHOLD);
  assert.ok(Date.now() - started < 10_000);
});
