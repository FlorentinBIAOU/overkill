/**
 * Les séries sont construites par formule : les nombres sont les mêmes sur
 * toutes les machines et dans les deux langages, et n0.test.py affirme les
 * mêmes. L'essai interactif, qui importe cet extrait, est testé en fin de
 * fichier.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { anomalies, scan } from './n0.js';
import essai from '../../tryouts/live/detect-anomalies-in-metrics.js';

const RESTING = 1200;

/** Douze cents requêtes par minute, avec une petite oscillation qui se répète. */
const quietMetric = (minute) => RESTING + 40 * ((minute % 7) - 3);

const QUIET = Array.from({ length: 60 }, (_, minute) => quietMetric(minute));
const TOTAL_RISE = 40 * 72;
const DRIFTING = Array.from({ length: 120 }, (_, m) => (m < 48 ? quietMetric(m) : quietMetric(m) + 40 * (m - 47)));
const STEPPING = Array.from({ length: 120 }, (_, m) => (m < 48 ? quietMetric(m) : quietMetric(m) + TOTAL_RISE));

/** Bruit gaussien reproductible : Park-Miller puis Box-Muller, écrit à l'identique en Python. */
function gaussianNoise(count, mean = 1000, sigma = 50) {
  let state = 1;
  const uniform = () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
  const values = [];
  while (values.length < count) {
    const u = uniform();
    const v = uniform();
    values.push(mean + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v));
  }
  return values;
}

/** Le piège de la docstring : moyenne et écart type, fenêtre avec ou sans le point jugé. */
function meanStdScan(series, window, { threshold = 3.5, includePoint = false } = {}) {
  const flagged = [];
  for (let index = window; index < series.length; index += 1) {
    const reference = series.slice(index - window + (includePoint ? 1 : 0), index + (includePoint ? 1 : 0));
    const mean = reference.reduce((s, v) => s + v, 0) / reference.length;
    const spread = Math.sqrt(reference.reduce((s, v) => s + (v - mean) ** 2, 0) / reference.length);
    if (Math.abs(series[index] - mean) > threshold * spread) flagged.push(index);
  }
  return flagged;
}

const indices = (verdicts) => verdicts.map((v) => v.index);

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : une dérive lente n’est jamais signalée', () => {
  assert.equal(120 - 48, 72);
  assert.deepEqual(anomalies(DRIFTING), []);
  assert.notDeepEqual(anomalies(STEPPING), []);
});

test('point de rupture : la série finit à plus du triple de son niveau de repos', () => {
  assert.equal(DRIFTING[119], quietMetric(119) + TOTAL_RISE);
  assert.equal(STEPPING[119], 3960);
  assert.equal(DRIFTING[119], 3960);
  assert.ok(DRIFTING[119] > 3 * RESTING);
});

test('point de rupture : chaque pas reste en deçà de l’écart toléré', () => {
  const verdicts = scan(DRIFTING);
  const narrowest = Math.min(...verdicts.map((v) => v.limit));
  assert.ok(Math.abs(narrowest - 311.346) < 1e-9);
  assert.ok(40 / narrowest < 0.13);
  assert.equal(Math.round(Math.max(...verdicts.map((v) => v.deviation / v.limit)) * 1e4) / 1e4, 0.9636);
  assert.ok(verdicts.at(-1).usual > 3000);
});

test('point de rupture : la marche est signalée dès sa première minute, et douze minutes seulement', () => {
  assert.deepEqual(indices(anomalies(STEPPING)), Array.from({ length: 12 }, (_, i) => 48 + i));
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('signale une pointe et rien d’autre', () => {
  const series = [...QUIET];
  series[40] = 4800;
  assert.deepEqual(indices(anomalies(series)), [40]);
});

test('le verdict porte le raisonnement, pas seulement un booléen', () => {
  const series = [...QUIET];
  series[40] = 4800;
  const [verdict] = anomalies(series);
  assert.equal(verdict.value, 4800);
  assert.equal(verdict.usual, 1200);
  assert.equal(verdict.deviation, 3600);
  assert.ok(Math.abs(verdict.limit - 311.346) < 1e-9);
  assert.equal(Math.round(verdict.usual + verdict.limit), 1511);
  assert.equal(verdict.isAnomaly, verdict.deviation > verdict.limit);
});

test('une première pointe ne cache pas la seconde', () => {
  const series = [...QUIET];
  series[40] = 4800;
  series[41] = 4700;
  assert.deepEqual(indices(anomalies(series)), [40, 41]);
});

test('moyenne et écart type : une pointe assez grosse élargit la bande', () => {
  const series = [...QUIET];
  series[40] = 20000;
  series[41] = 4800;
  assert.deepEqual(meanStdScan(series, 24), [40]);
  assert.deepEqual(indices(anomalies(series)), [40, 41]);
  const spike = [...QUIET];
  spike[40] = 1e9;
  assert.deepEqual(meanStdScan(spike, 12, { includePoint: true }), []);
  assert.deepEqual(indices(anomalies(spike, { window: 12 })), [40]);
  const example = [...QUIET];
  example[40] = 4800;
  example[41] = 4700;
  assert.deepEqual(meanStdScan(example, 24), [40, 41]);
});

test('la médiane résiste jusqu’à moins de la moitié de la fenêtre', () => {
  const base = Array.from({ length: 24 }, (_, m) => quietMetric(m));
  const judged = [0, 11, 12].map((k) => scan([...new Array(k).fill(100000), ...base.slice(k), 1200])[0]);
  assert.deepEqual([judged[0].usual, Math.round(judged[0].limit * 1000) / 1000], [1180, 311.346]);
  assert.deepEqual([judged[1].usual, Math.round(judged[1].limit * 1000) / 1000], [1320, 1245.384]);
  assert.equal(judged[2].usual, 50660);
});

test('le facteur 1,4826 met l’écart absolu médian à l’échelle d’un écart type', () => {
  const alternating = [...Array.from({ length: 24 }, (_, i) => (i % 2 ? 2 : 0)), 1];
  assert.ok(Math.abs(scan(alternating)[0].limit - 3.5 * 1.4826) < 1e-9);
});

test('INFIRMÉ : le seuil de 3,5 garde son sens sur une fenêtre de 24', async () => {
  // Nominal : 0,047 % ; mesuré : 0,75 %, seize fois plus.
  await assert.rejects(async () => {
    const noise = gaussianNoise(20000);
    assert.ok(anomalies(noise).length / (noise.length - 24) < 2 * 0.000465);
  });
});

test('constat : taux de fausses alertes sur bruit gaussien', () => {
  const noise = gaussianNoise(20000);
  const rate = anomalies(noise).length / (noise.length - 24);
  assert.ok(rate > 0.005 && rate < 0.01);
  assert.ok(anomalies(noise, { window: 12 }).length / (noise.length - 12) > 0.02);
});

test('une série plus courte que la fenêtre ne reçoit aucun verdict', () => {
  assert.deepEqual(scan([1, 2, 3]), []);
  assert.equal(scan(QUIET)[0].index, 24);
  assert.equal(scan(QUIET).length, 36);
});

test('la médiane JavaScript est celle de Python, moyenne des deux du milieu sur un compte pair', () => {
  // Commentaire : « Middle value, or the average of the two middle ones on an even count ».
  const series = [...QUIET];
  series[30] = 9999;
  const verdict = scan(series)[31 - 24];
  const sorted = series.slice(7, 31).sort((a, b) => a - b);
  assert.equal(verdict.usual, (sorted[11] + sorted[12]) / 2);
  assert.equal(scan([3, 1, 2, 10], { window: 3 })[0].usual, 2);
});

test('une métrique constante n’est une anomalie qu’au premier mouvement', () => {
  assert.deepEqual(anomalies(new Array(30).fill(500)), []);
  const [verdict] = anomalies([...new Array(29).fill(500), 501]);
  assert.equal(verdict.limit, 0);
  assert.equal(verdict.deviation, 1);
});

test('anomalies est le sous-ensemble de scan', () => {
  const series = [...QUIET];
  series[40] = 4800;
  assert.deepEqual(anomalies(series), scan(series).filter((v) => v.isAnomaly));
});

test('l’extrait n’importe rien', () => {
  const source = readFileSync(new URL('./n0.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s/m);
});

test('deux exécutions rendent les mêmes verdicts', () => {
  assert.deepEqual(scan(DRIFTING), scan([...DRIFTING]));
});

test('INFIRMÉ : N0 ne sonne pas pour les minutes que N1 signale', async () => {
  const wobble = (minute, metric) => {
    const step = minute * (0.6180339887498949 + 0.1 * metric);
    return step - Math.floor(step) - 0.5;
  };
  const day = Array.from({ length: 45 }, (_, m) => [1000 + 80 * wobble(m, 0), 10 + wobble(m, 1), 130 + 10 * wobble(m, 2)]);
  const night = Array.from({ length: 45 }, (_, m) => [300 + 80 * wobble(m, 3), 3 + wobble(m, 4), 60 + 10 * wobble(m, 5)]);
  const rows = [...day, ...night, [320, 9.6, 62], [980, 9.8, 63]];
  await assert.rejects(async () => {
    const flagged = new Set([0, 1, 2].flatMap((metric) => indices(anomalies(rows.map((row) => row[metric])))));
    assert.ok(!flagged.has(90) && !flagged.has(91));
  });
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : série vide', () => {
  assert.deepEqual(scan([]), []);
  assert.deepEqual(anomalies([]), []);
});

test('production : douze mille minutes et une semaine en fenêtre d’un jour', () => {
  const started = Date.now();
  assert.deepEqual(anomalies(Array.from({ length: 12000 }, (_, m) => quietMetric(m))), []);
  assert.equal(scan(Array.from({ length: 10080 }, (_, m) => quietMetric(m)), { window: 1440 }).length, 10080 - 1440);
  assert.ok(Date.now() - started < 30_000);
});

test('production : valeurs aux limites du seuil', () => {
  assert.deepEqual(anomalies(new Array(30).fill(500)), []);
  const verdicts = anomalies(QUIET.slice(0, 30), { threshold: 0 });
  assert.ok(verdicts.every((v) => v.deviation > 0));
  assert.equal(verdicts.length, scan(QUIET.slice(0, 30)).filter((v) => v.deviation > 0).length);
});

test('production : valeurs négatives et très grandes', () => {
  const shifted = QUIET.map((v) => v - 10_000);
  shifted[40] = 10_000;
  assert.deepEqual(indices(anomalies(shifted)), [40]);
  const huge = QUIET.map((v) => v * 1e290);
  huge[40] = 4800 * 1e290;
  assert.deepEqual(indices(anomalies(huge)), [40]);
});

test('production : un point manquant NaN n’est jamais signalé', () => {
  const series = [...QUIET];
  series[30] = NaN;
  series[40] = 4800;
  assert.deepEqual(indices(anomalies(series)), [40]);
});

test('DÉFAUT : une métrique de comptage presque toujours nulle sonne à chaque unité', async () => {
  await assert.rejects(async () => {
    const errors = [...new Array(30).fill(0), 1, ...new Array(5).fill(0), 1, ...new Array(5).fill(0)];
    assert.deepEqual(anomalies(errors), []);
  });
});

test('DÉFAUT : une fenêtre nulle rend des verdicts à NaN au lieu d’être refusée', async () => {
  await assert.rejects(async () => {
    assert.throws(() => scan([1, 2, 3], { window: 0 }), RangeError);
  });
});

// ---------------------------------------------------------------------------
// L'essai interactif (niveau N0, fenêtre de 12)
// ---------------------------------------------------------------------------

const points = (i) => essai.cases[i].input.split(' ').map(Number);

test('essai : une pointe à 4 800 requêtes, et les nombres du verdict', () => {
  const result = essai.run(essai.cases[0].input, 'fr');
  assert.deepEqual(result.rows.rows, [['33', { v: '4800', caught: true }, '1180', '3620', '311']]);
  assert.equal(result.note, '1 anomalie sur 36 minutes jugées, 48 points fournis. Les 12 premières minutes ne sont pas jugées : elles servent de fenêtre.');
  assert.deepEqual(result.spans, [{ start: 165, end: 169 }]);
  assert.equal(essai.cases[0].input.slice(165, 169), '4800');
});

test('essai : deux pointes de suite, toutes deux signalées', () => {
  assert.deepEqual(essai.run(essai.cases[1].input, 'en').rows.rows.map((r) => r[0]), ['33', '34']);
});

test('essai : une marche de 1 400 d’un coup, signalée puis absorbée', () => {
  const series = points(2);
  assert.equal(series[12] - quietMetric(12), 1400);
  assert.deepEqual(essai.run(essai.cases[2].input, 'fr').rows.rows.map((r) => r[0]), ['12', '13', '14', '15', '16', '17']);
});

test('essai : la hausse étalée finit à 2 720 en partant de 1 080 sans une minute signalée', () => {
  const cas = essai.cases[3];
  assert.equal(cas.fails, true);
  assert.deepEqual(essai.run(cas.input, 'fr').verdict, {
    label: 'Aucune anomalie',
    detail: '36 minutes jugées, aucune ne dépasse l’écart toléré. La métrique est passée de 1080 à 2720.',
  });
  const series = points(3);
  assert.deepEqual(series.slice(12).map((v, i) => v - quietMetric(i + 12)), Array.from({ length: 36 }, (_, i) => 40 * (i + 1)));
});

test('INFIRMÉ : le cas 4 dit « la même hausse » que la marche, 1 440 contre 1 400', async () => {
  assert.equal(points(3).at(-1) - quietMetric(47), 1440);
  await assert.rejects(async () => {
    assert.equal(points(3).at(-1) - quietMetric(47), points(2)[12] - quietMetric(12));
  });
});

test('INFIRMÉ : le why dit qu’« aucun écart d’une minute à la suivante n’approche l’écart toléré »', async () => {
  // De minute en minute, la série jugée varie jusqu'à 200 (retour de
  // l'oscillation), 64 % de l'écart toléré de 311 ; l'écart mesuré atteint 73 %.
  const series = points(3);
  const judged = scan(series, { window: 12 });
  const steps = series.slice(12).map((v, i) => Math.abs(v - series[i + 11]));
  assert.equal(Math.max(...steps), 200);
  assert.equal(Math.round(Math.max(...judged.map((v) => v.deviation / v.limit)) * 100), 73);
  await assert.rejects(async () => {
    assert.ok(Math.max(...steps) < 0.25 * Math.min(...judged.map((v) => v.limit)));
  });
});

test('essai : saisie vide et historique trop court', () => {
  assert.deepEqual(essai.run('', 'fr'), { error: 'Aucun nombre à lire dans cette saisie.' });
  assert.deepEqual(essai.run('1 2 3', 'en').verdict, {
    label: 'Not enough history',
    detail: '3 points given: more than 12 are needed before a point has a window behind it.',
  });
});

test('DÉFAUT : l’essai lit « 4,800 » comme 4,8 et « 4 800 » comme deux points', async () => {
  // Le libellé anglais écrit lui-même « 4,800 ».
  const base = points(0).slice(0, 33).join(' ');
  await assert.rejects(async () => {
    const withComma = essai.run(`${base} 4,800`, 'en');
    assert.equal(withComma.rows?.rows?.[0]?.[1]?.v, '4800');
  });
  await assert.rejects(async () => {
    const withSpace = essai.run(`${base} 4 800`, 'fr');
    assert.equal(withSpace.rows?.rows?.[0]?.[1]?.v, '4800');
  });
});
