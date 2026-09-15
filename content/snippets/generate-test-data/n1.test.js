import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { generateRows } from './n0.js';
import { pick, sampleRows } from './n1.js';

// The distributions live in the test, never in the snippet. These are the
// shape a `GROUP BY city` and a bucketed count would return: raw observed
// counts, not probabilities, and no need to make them sum to anything in
// particular.
//
// The figures below are invented for the example, and the postcodes are those
// of the cities they sit next to, nothing more.
const SESSIONS = {
  city: { type: 'categorical', counts: { Paris: 4120, Lyon: 980, Nantes: 410, Lille: 190 } },
  postcode: { type: 'categorical', counts: { 75011: 4120, 69003: 980, 44000: 410, 59000: 190 } },
  // Most baskets hold one item; the long tail is real but thin.
  items: { type: 'histogram', edges: [1, 2, 3, 6, 21], counts: [6900, 1800, 900, 400] },
  delay_days: { type: 'histogram', edges: [0, 1, 3, 8, 31], counts: [5200, 2400, 1600, 800] },
};

// The exact rows expected for one seed. The same literal appears in
// n1.test.py, which is what pins the two implementations to each other.
const GOLDEN = [
  { city: 'Lyon', postcode: '69003', items: 2, delay_days: 4 },
  { city: 'Paris', postcode: '75011', items: 2, delay_days: 0 },
  { city: 'Nantes', postcode: '75011', items: 1, delay_days: 0 },
];

const SEED = 'sessions-week-24';
const POSTCODE_OF = { Paris: '75011', Lyon: '69003', Nantes: '44000', Lille: '59000' };

/** Exécute le vrai n1.py, pour chaque [distributions, count, seed]. */
function sampleRowsEnPython(appels) {
  const racine = fileURLToPath(new URL('../../../', import.meta.url));
  const venv = `${racine}.venv-tools/bin/python`;
  const python = existsSync(venv) ? venv : 'python3';
  const script =
    'import sys, json; sys.path.insert(0, sys.argv[1]); from n1 import sample_rows; ' +
    'json.dump([sample_rows(s, n, g) for s, n, g in json.load(sys.stdin)], sys.stdout)';
  const r = spawnSync(python, ['-c', script, fileURLToPath(new URL('.', import.meta.url))], {
    input: JSON.stringify(appels),
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

const compter = (rows, predicat) => rows.filter(predicat).length;

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : les parts par ville sont justes', () => {
  const rows = sampleRows(SESSIONS, 4000, SEED);
  const total = Object.values(SESSIONS.city.counts).reduce((sum, count) => sum + count, 0);
  for (const [city, observed] of Object.entries(SESSIONS.city.counts)) {
    const seen = compter(rows, (row) => row.city === city);
    assert.ok(Math.abs(seen / 4000 - observed / total) < 0.02, city);
  }
});

test('point de rupture : près d’une ligne sur deux associe une ville à un autre code postal', () => {
  const rows = sampleRows(SESSIONS, 2000, SEED);
  const impossible = compter(rows, (row) => POSTCODE_OF[row.city] !== row.postcode);
  assert.equal(impossible, 908); // 45,4 %
  // Ce qu'annonce l'indépendance des deux colonnes : 1 - somme des parts au carré.
  const parts = Object.values(SESSIONS.city.counts).map((c) => c / 5700);
  assert.ok(Math.abs(impossible / 2000 - (1 - parts.reduce((s, p) => s + p * p, 0))) < 0.02);
});

test('point de rupture : une ligne sur vingt annonce Nantes avec un code postal parisien', () => {
  const rows = sampleRows(SESSIONS, 2000, SEED);
  assert.equal(compter(rows, (row) => row.city === 'Nantes' && row.postcode === '75011'), 100);
});

test('point de rupture : témoin, une colonne conjointe ne produit aucune ligne impossible', () => {
  const counts = Object.fromEntries(
    Object.entries(POSTCODE_OF).map(([city, code]) => [`${city}|${code}`, SESSIONS.city.counts[city]]),
  );
  const couples = sampleRows({ place: { type: 'categorical', counts } }, 2000, SEED)
    .map((row) => row.place.split('|'));
  assert.ok(couples.every(([city, code]) => POSTCODE_OF[city] === code));
  assert.ok(Math.abs(couples.filter(([city]) => city === 'Paris').length / 2000 - 4120 / 5700) < 0.02);
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('produit les lignes attendues', () => {
  assert.deepEqual(sampleRows(SESSIONS, 3, SEED), GOLDEN);
});

test('Python et JavaScript produisent les mêmes lignes pour la même table observée', () => {
  const variees = {
    ...SESSIONS,
    postcode: { type: 'categorical', counts: { 75011: 4120, 69003: 980, 44000: 410, 59000: 190, '2A004': 3, 10: 5, 9: 7 } },
    'ville accentuée': { type: 'categorical', counts: { Orléans: 3, Besançon: 2, Évry: 1 } },
    montant: { type: 'histogram', edges: [0, 10, 1000, 100000], counts: [50, 30, 1] },
  };
  const appels = [[SESSIONS, 3, SEED], [variees, 500, SEED]];
  for (const graine of ['', '🧪', 'semaine-été'.normalize('NFD'), '\ufeffx']) appels.push([variees, 50, graine]);
  assert.deepEqual(sampleRowsEnPython(appels), appels.map(([s, n, g]) => sampleRows(s, n, g)));
});

test('INFIRMÉ : les deux langages s’accordent sur des libellés emoji et pleine chasse', () => {
  // Python trie les libellés par point de code, JavaScript par unité UTF-16.
  assert.throws(() => {
    const appel = [{ x: { type: 'categorical', counts: { '🍕 restauration': 1, 'Ｚ': 1 } } }, 6, SEED];
    assert.deepEqual(sampleRowsEnPython([appel]), [sampleRows(...appel)]);
  });
});

test('la même graine redonne les mêmes lignes, une autre graine non', () => {
  assert.deepEqual(sampleRows(SESSIONS, 50, SEED), sampleRows(SESSIONS, 50, SEED));
  assert.notDeepEqual(sampleRows(SESSIONS, 50, SEED), sampleRows(SESSIONS, 50, 'sessions-week-25'));
});

test('le cas courant reste courant, là où N0 donne le même poids à chaque cas', () => {
  const n0Rows = generateRows({ items: { type: 'int', min: 1, max: 9 } }, 9000, SEED);
  for (let k = 1; k <= 9; k += 1) {
    assert.ok(Math.abs(compter(n0Rows, (r) => r.items === k) / 9000 - 1 / 9) < 0.02);
  }
  const rows = sampleRows(SESSIONS, 4000, SEED);
  assert.ok(Math.abs(compter(rows, (row) => row.items === 1) / 4000 - 6900 / 10000) < 0.02);
});

test('les valeurs restent dans les tranches observées, semi-ouvertes', () => {
  const rows = sampleRows(SESSIONS, 2000, SEED);
  const items = rows.map((row) => row.items);
  const delays = rows.map((row) => row.delay_days);
  // The buckets are half-open, so the last edge is never reached.
  assert.equal(Math.min(...items), 1);
  assert.ok(Math.max(...items) <= 20);
  assert.equal(Math.min(...delays), 0);
  assert.ok(Math.max(...delays) <= 30);
  const etroite = sampleRows({ v: { type: 'histogram', edges: [5, 6], counts: [1] } }, 200, SEED);
  assert.deepEqual(new Set(etroite.map((r) => r.v)), new Set([5]));
});

test('la valeur est uniforme à l’intérieur de sa tranche', () => {
  const rows = sampleRows({ v: { type: 'histogram', edges: [0, 10], counts: [1] } }, 10_000, SEED);
  for (let k = 0; k < 10; k += 1) {
    assert.ok(Math.abs(compter(rows, (r) => r.v === k) / 10_000 - 0.1) < 0.02, String(k));
  }
});

test('pick répartit exactement selon les effectifs entiers', () => {
  assert.deepEqual(Array.from({ length: 12 }, (_, n) => pick([1, 2, 3], n)), [0, 1, 1, 2, 2, 2, 0, 1, 1, 2, 2, 2]);
  assert.equal(pick([1, 2 ** 32], 2 ** 32 - 1), 1);
});

test('une catégorie observée zéro fois n’est jamais tirée', () => {
  const city = { type: 'categorical', counts: { Paris: 100, Ajaccio: 0 } };
  assert.deepEqual([...new Set(sampleRows({ city }, 200, SEED).map((row) => row.city))], ['Paris']);
});

test('une catégorie observée une seule fois finit dans le jeu de test', () => {
  const city = { type: 'categorical', counts: { Paris: 9999, 'Saint-Pierre-et-Miquelon': 1 } };
  assert.ok(sampleRows({ city }, 20_000, SEED).some((row) => row.city === 'Saint-Pierre-et-Miquelon'));
});

test('l’ordre de la requête ne change pas le jeu', () => {
  const a = { city: { type: 'categorical', counts: { Paris: 4120, Lyon: 980, Nantes: 410 } } };
  const b = { city: { type: 'categorical', counts: { Nantes: 410, Paris: 4120, Lyon: 980 } } };
  assert.deepEqual(sampleRows(a, 100, SEED), sampleRows(b, 100, SEED));
});

test('une distribution impossible à tirer est refusée', () => {
  // Nothing was observed, so there is nothing to sample from. Falling back to
  // a uniform draw here would quietly invent a distribution.
  assert.throws(() => sampleRows({ city: { type: 'categorical', counts: { Paris: 0 } } }, 1, SEED), RangeError);
  assert.throws(
    () => sampleRows({ items: { type: 'histogram', edges: [1, 5], counts: [10, 2] } }, 1, SEED),
    RangeError,
  );
  assert.throws(() => sampleRows({ items: { type: 'gaussian', mean: 3 } }, 1, SEED), RangeError);
});

test('aucun fichier écrit', () => {
  const noms = ['writeFileSync', 'writeFile', 'openSync', 'open', 'createWriteStream', 'appendFileSync'];
  const origines = Object.fromEntries(noms.map((n) => [n, fs[n]]));
  let rows;
  try {
    for (const n of noms) {
      fs[n] = () => {
        throw new Error('un fichier a été ouvert');
      };
    }
    syncBuiltinESMExports();
    rows = sampleRows(SESSIONS, 50, SEED);
  } finally {
    Object.assign(fs, origines);
    syncBuiltinESMExports();
  }
  assert.equal(rows.length, 50);
});

test('trois lignes prennent moins d’une milliseconde', () => {
  const debut = performance.now();
  for (let i = 0; i < 1000; i += 1) sampleRows(SESSIONS, 3, SEED);
  assert.ok(performance.now() - debut < 1000);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : aucune distribution, zéro ligne et une ligne', () => {
  assert.deepEqual(sampleRows({}, 2, SEED), [{}, {}]);
  assert.deepEqual(sampleRows(SESSIONS, 0, SEED), []);
  assert.equal(sampleRows(SESSIONS, 1, SEED).length, 1);
  assert.deepEqual(sampleRows({ c: { type: 'categorical', counts: {} } }, 0, SEED), []);
  assert.throws(() => sampleRows({ c: { type: 'categorical', counts: {} } }, 1, SEED), RangeError);
});

test('production : cinquante mille lignes sur quatre colonnes terminent vite', () => {
  const debut = performance.now();
  const rows = sampleRows(SESSIONS, 50_000, SEED);
  assert.ok(performance.now() - debut < 15_000);
  assert.equal(rows.length, 50_000);
});

test('DÉFAUT : les libellés sont triés une fois par colonne et non à chaque cellule', () => {
  // Coût lignes × libellés × log(libellés) : un GROUP BY code_postal de 6 000
  // codes sur 10 000 lignes prend environ 5 s ici.
  assert.throws(() => {
    const vraiSort = Array.prototype.sort;
    let tris = 0;
    // eslint-disable-next-line no-extend-native
    Array.prototype.sort = function compte(...args) {
      tris += 1;
      return vraiSort.apply(this, args);
    };
    try {
      const counts = Object.fromEntries(Array.from({ length: 6000 }, (_, i) => [String(i).padStart(5, '0'), (i % 7) + 1]));
      sampleRows({ postcode: { type: 'categorical', counts } }, 1000, SEED);
    } finally {
      Array.prototype.sort = vraiSort; // eslint-disable-line no-extend-native
    }
    assert.ok(tris <= 1, `${tris} tris`);
  });
});

test('production : libellés accentués, NFD, emoji et BOM', () => {
  const counts = { Orléans: 3, ['Orléans'.normalize('NFD')]: 2, '🍕': 1, '\ufeffLyon': 1, 'Lyon\u00a0': 1 };
  const vus = new Set(sampleRows({ c: { type: 'categorical', counts } }, 2000, SEED).map((r) => r.c));
  assert.deepEqual(vus, new Set(Object.keys(counts)));
  assert.equal([...vus].filter((c) => c.startsWith('Orl')).length, 2);
});

test('production : valeurs aux limites des tranches', () => {
  const nulle = sampleRows({ v: { type: 'histogram', edges: [3, 3], counts: [1] } }, 20, SEED);
  assert.deepEqual(new Set(nulle.map((r) => r.v)), new Set([3]));
  assert.deepEqual(sampleRows({ c: { type: 'categorical', counts: { seul: 1 } } }, 5, SEED), Array(5).fill({ c: 'seul' }));
  const negatif = sampleRows({ c: { type: 'categorical', counts: { a: -5, b: 10 } } }, 50, SEED);
  assert.deepEqual(new Set(negatif.map((r) => r.c)), new Set(['b']));
});

test('production : des bornes flottantes de moins d’une unité ne rendent que les bornes basses', () => {
  const rows = sampleRows({ v: { type: 'histogram', edges: [0, 0.5, 1], counts: [1, 1] } }, 200, SEED);
  assert.deepEqual(new Set(rows.map((r) => r.v)), new Set([0, 0.5]));
});
