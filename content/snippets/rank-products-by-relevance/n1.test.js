import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import * as n0 from './n0.js';
import { SIGNALS, learnWeights, pairs, rank } from './n1.js';

// A click log, the kind two weeks of traffic leaves behind. Each row is
// [text, availability, margin, popularity, clicked], and each page is one
// result list a shopper saw.
const LOG = [
  [[1.0, 1.0, 0.30, 0.20, true], [0.5, 1.0, 0.55, 0.90, false], [0.0, 1.0, 0.60, 0.80, false]],
  [[1.0, 1.0, 0.25, 0.55, true], [0.5, 1.0, 0.50, 0.95, false], [0.0, 1.0, 0.45, 0.70, false]],
  [[0.5, 1.0, 0.35, 0.80, true], [0.5, 1.0, 0.65, 0.25, false]],
  [[1.0, 1.0, 0.20, 0.45, true], [1.0, 0.0, 0.60, 0.90, false]],
  [[1.0, 1.0, 0.40, 0.60, true], [0.5, 0.0, 0.55, 0.85, false], [0.0, 1.0, 0.50, 0.60, false]],
  [[0.5, 1.0, 0.30, 0.70, true], [0.5, 0.0, 0.45, 0.75, false]],
  [[1.0, 1.0, 0.45, 0.85, true], [1.0, 1.0, 0.30, 0.20, false]],
  [[0.5, 1.0, 0.25, 0.90, true], [0.0, 1.0, 0.70, 0.95, false]],
];

const FLAT_MARGIN = LOG.map((rows) => rows.map((row) => [row[0], row[1], 0.4, row[3], row[4]]));

// Un journal où l'acheteur a pris, sur chaque page, le produit le moins
// pertinent et le moins rentable : les poids appris sont tous négatifs ou nuls.
const AGAINST_THE_SHOP = [
  [[0.0, 1.0, 0.10, 0.50, true], [1.0, 1.0, 0.90, 0.50, false]],
  [[0.5, 1.0, 0.20, 0.50, true], [0.5, 1.0, 0.80, 0.50, false]],
];

const page = (rows) => rows.map((row) => ({
  signals: Object.fromEntries(SIGNALS.map((name, i) => [name, row[i]])),
  clicked: row[4],
}));

const impressions = (log = LOG) => log.map(page);

const close = (value, expected, tolerance = 0.01) => Math.abs(value - expected) < tolerance;

/** Journal synthétique, générateur MINSTD entier : identique au test Python. */
function synthetique(pages, vrais = [0.5, 0.3, 0.0, 0.2], graine = 1) {
  let etat = graine;
  const log = [];
  for (let p = 0; p < pages; p += 1) {
    const items = [];
    for (let j = 0; j < 4; j += 1) {
      const valeurs = [];
      for (let k = 0; k < 4; k += 1) {
        etat = (etat * 48271) % 2147483647;
        valeurs.push((etat % 101) / 100);
      }
      items.push(valeurs);
    }
    const scoreDe = (it) => it.reduce((s, v, k) => s + vrais[k] * v, 0);
    let meilleur = 0;
    for (let j = 1; j < 4; j += 1) if (scoreDe(items[j]) > scoreDe(items[meilleur])) meilleur = j;
    log.push(items.map((it, j) => [...it, j === meilleur]));
  }
  return log;
}

function learnWeightsEnPython(journaux) {
  const racine = fileURLToPath(new URL('../../../', import.meta.url));
  const venv = `${racine}.venv-tools/bin/python`;
  const python = existsSync(venv) ? venv : 'python3';
  const script =
    'import sys, json; sys.path.insert(0, sys.argv[1]); from n1 import learn_weights; ' +
    'json.dump([learn_weights(j) for j in json.load(sys.stdin)], sys.stdout)';
  const r = spawnSync(python, ['-c', script, fileURLToPath(new URL('.', import.meta.url))], {
    input: JSON.stringify(journaux.map((j) => impressions(j))),
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : une marge identique partout donne une colonne de zéros', () => {
  const { rows } = pairs(impressions(FLAT_MARGIN));
  assert.ok(rows.length > 0);
  const j = SIGNALS.indexOf('margin');
  assert.ok(rows.every((row) => row[j] === 0 || Object.is(row[j], -0)));
});

test('point de rupture : le poids appris vaut exactement zéro', () => {
  const weights = learnWeights(impressions(FLAT_MARGIN));
  assert.equal(weights.margin, 0);
  assert.ok(weights.text > 0);
  assert.notEqual(learnWeights(impressions()).margin, 0);
});

test('point de rupture : une page où seule la marge diffère rend deux scores identiques', () => {
  const candidates = page([[0.5, 1.0, 0.10, 0.50, false], [0.5, 1.0, 0.90, 0.50, false]]);
  const scores = rank(candidates, learnWeights(impressions(FLAT_MARGIN))).map((row) => row.score);
  assert.equal(scores[0], scores[1]);
  const temoin = rank(candidates, learnWeights(impressions())).map((row) => row.score);
  assert.notEqual(temoin[0], temoin[1]);
});

test('point de rupture : aucun surcroît de trafic n’y change rien', () => {
  const dixFois = impressions(Array(10).fill(FLAT_MARGIN).flat());
  assert.equal(learnWeights(dixFois).margin, 0);
  const montreAutrement = [...dixFois, page([[1.0, 1.0, 0.10, 0.5, true], [1.0, 1.0, 0.90, 0.5, false]])];
  assert.notEqual(learnWeights(montreAutrement).margin, 0);
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('une paire devient deux lignes de sens opposé', () => {
  const { rows, labels } = pairs([page(LOG[3])]);
  assert.deepEqual(labels, [1, 0]);
  assert.ok(rows[0].every((value, i) => close(value, [0, 1, -0.4, -0.45][i], 1e-9)));
  assert.ok(rows[1].every((value, i) => close(value, [0, -1, 0.4, 0.45][i], 1e-9)));
});

test('les deux classes sont équilibrées', () => {
  const { labels } = pairs(impressions(synthetique(50)));
  assert.equal(labels.filter((l) => l === 1).length * 2, labels.length);
});

test('une ordonnée à l’origine sortirait nulle sur des paires symétriques', () => {
  // Sans dépendance ici : la moyenne des étiquettes vaut exactement 1/2, le
  // logit d'une constante ajustée seule vaut donc 0.
  const { labels } = pairs(impressions());
  assert.equal(labels.reduce((s, l) => s + l, 0) / labels.length, 0.5);
});

test('la régression redonne les poids du score d’origine', () => {
  const vrais = { text: 0.5, availability: 0.3, margin: 0.0, popularity: 0.2 };
  const appris = learnWeights(impressions(synthetique(300, Object.values(vrais))));
  for (const name of SIGNALS) assert.ok(close(appris[name], vrais[name], 0.05), `${name} ${appris[name]}`);
});

test('apprend que la pertinence et le stock guident les acheteurs', () => {
  const weights = learnWeights(impressions());
  assert.ok(weights.text > weights.availability && weights.availability > 0);
  assert.ok(weights.popularity < weights.text);
});

test('le journal peut contredire la boutique', () => {
  assert.ok(learnWeights(impressions()).margin < 0);
});

test('Python et JavaScript apprennent les mêmes poids à deux décimales', () => {
  // The same log, fitted by scikit-learn in n1.py, gives these weights. Two
  // decimals of agreement is what says the thirty lines above are the same
  // model and not a lookalike.
  const weights = learnWeights(impressions());
  assert.ok(close(weights.text, 0.44), weights.text);
  assert.ok(close(weights.availability, 0.28), weights.availability);
  assert.ok(close(weights.margin, -0.25), weights.margin);
  assert.ok(close(weights.popularity, 0.02), weights.popularity);
  // Et sur quatre journaux, contre l'exécution réelle de n1.py.
  const journaux = [LOG, FLAT_MARGIN, synthetique(300), AGAINST_THE_SHOP];
  learnWeightsEnPython(journaux).forEach((python, i) => {
    const javascript = learnWeights(impressions(journaux[i]));
    for (const name of SIGNALS) assert.ok(close(python[name], javascript[name]), `${i} ${name}`);
  });
});

test('l’ajustement tient en une trentaine de lignes', () => {
  // Docstring : « The fit is thirty lines of gradient descent rather than a dependency ».
  const lignes = (f) => f.toString().split('\n').filter((l) => l.trim() && !l.trim().startsWith('//')).length;
  assert.ok(lignes(pairs) + lignes(learnWeights) <= 40, String(lignes(pairs) + lignes(learnWeights)));
});

test('INFIRMÉ : la pénalité est ce qui garde à zéro un signal que le journal n’a pas fait varier', () => {
  // Commentaire : « The penalty keeps a signal the log never varied at exactly
  // nought ». Sans pénalité, le poids reste nul aussi : la colonne est à zéro,
  // son gradient l'est, et le poids part de zéro.
  assert.throws(() => {
    assert.notEqual(learnWeights(impressions(FLAT_MARGIN), { regularisation: Infinity }).margin, 0);
  });
});

test('les poids appris classent une nouvelle page comme le journal', () => {
  const weights = learnWeights(impressions());
  const candidates = page([
    [0.0, 1.0, 0.70, 0.95, false], // popular, profitable, off topic
    [1.0, 1.0, 0.20, 0.05, false], // on topic, new, thin margin
  ]);
  assert.equal(rank(candidates, weights)[0].candidate.signals.text, 1);
});

test('les poids sont sur une échelle lisible, et la mise à l’échelle ne change aucun ordre', () => {
  const weights = learnWeights(impressions());
  const total = Object.values(weights).reduce((sum, value) => sum + Math.abs(value), 0);
  assert.ok(close(total, 1, 1e-9));
  const candidates = impressions().flat();
  const x7 = Object.fromEntries(SIGNALS.map((n) => [n, weights[n] * 7]));
  assert.deepEqual(rank(candidates, weights).map((r) => r.candidate), rank(candidates, x7).map((r) => r.candidate));
});

test('INFIRMÉ : l’échelle du score reste celle de N0', () => {
  // Un produit rentable sans autre signal reçoit -0,25 avec les poids appris.
  assert.throws(() => {
    const s = rank(page([[0.0, 0.0, 1.0, 0.0, false]]), learnWeights(impressions()))[0].score;
    assert.ok(s >= 0 && s <= 1);
  });
});

test('INFIRMÉ : la fonction de service de N0 classe comme N1 avec les poids appris', () => {
  // n0.score divise par la somme signée des poids : une somme négative inverse l'ordre.
  assert.throws(() => {
    const weights = learnWeights(impressions(AGAINST_THE_SHOP));
    assert.ok(Object.values(weights).reduce((s, v) => s + v, 0) < 0);
    const produits = [
      { title: 'pertinent et rentable', tags: [], inStock: true, margin: 0.9, popularity: 0.5 },
      { title: 'hors sujet et sans marge', tags: [], inStock: true, margin: 0.1, popularity: 0.5 },
    ];
    const ordreN0 = n0.rank(produits, 'pertinent', weights).map((r) => r.product.title);
    const candidates = produits.map((p) => ({ title: p.title, signals: n0.signals(p, 'pertinent') }));
    assert.deepEqual(ordreN0, rank(candidates, weights).map((r) => r.candidate.title));
  });
});

test('même somme pondérée, même tri stable, même explication', () => {
  const weights = { text: 0.5, availability: 0.25, margin: 0, popularity: 0.25 };
  const jumeaux = page([[0.5, 1, 0.1, 0.5, false], [0.5, 1, 0.1, 0.5, false], [0.5, 1, 0.1, 0.5, false]])
    .map((c, id) => ({ ...c, id }));
  const ranked = rank(jumeaux, weights);
  assert.deepEqual(ranked.map((r) => r.candidate.id), [0, 1, 2]);
  assert.deepEqual(ranked[0].candidate.signals, jumeaux[0].signals);
  const produits = [['a', true, 0.2, 0.9], ['b', false, 0.9, 0.1], ['c', true, 0.5, 0.5]]
    .map(([title, inStock, margin, popularity]) => ({ title, tags: [], inStock, margin, popularity }));
  const ordreN0 = n0.rank(produits, 'a', weights).map((r) => r.product.title);
  const ordreN1 = rank(produits.map((p) => ({ title: p.title, signals: n0.signals(p, 'a') })), weights)
    .map((r) => r.candidate.title);
  assert.deepEqual(ordreN0, ordreN1);
});

test('déterministe : le même journal redonne les mêmes poids', () => {
  assert.deepEqual(learnWeights(impressions()), learnWeights(impressions()));
});

test('un journal sans un clic n’enseigne rien', () => {
  const silent = LOG.map((rows) => page(rows.map((row) => [...row.slice(0, 4), false])));
  assert.throws(() => learnWeights(silent), /nothing to learn from/);
});

test('une page d’un seul résultat ne fait aucune paire', () => {
  assert.equal(pairs([page([LOG[0][0]])]).rows.length, 0);
});

test('servir une page de cinq produits prend moins d’une milliseconde', () => {
  const weights = learnWeights(impressions());
  const candidates = [...impressions()[0], ...impressions()[4]];
  const debut = performance.now();
  for (let i = 0; i < 1000; i += 1) rank(candidates, weights);
  assert.ok(performance.now() - debut < 1000);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : un journal vide et des pages vides lèvent l’erreur nommée', () => {
  assert.throws(() => learnWeights([]), /nothing to learn from/);
  assert.throws(() => learnWeights([[], []]), /nothing to learn from/);
  assert.deepEqual(rank([], { text: 1, availability: 0, margin: 0, popularity: 0 }), []);
});

test('production : cent fois le journal du test apprend vite et les mêmes poids', () => {
  const debut = performance.now();
  const weights = learnWeights(impressions(Array(100).fill(LOG).flat()));
  assert.ok(performance.now() - debut < 20_000);
  assert.ok(weights.text > weights.availability && weights.availability > 0 && weights.margin < 0);
});

test('production : valeurs aux limites, tous les signaux à zéro ou à un', () => {
  const weights = learnWeights(impressions([[[1, 1, 1, 1, true], [0, 0, 0, 0, false]]]));
  for (const v of Object.values(weights)) assert.ok(close(v, 0.25, 1e-9));
});

test('DÉFAUT : un journal sans aucune différence lève l’erreur nommée', () => {
  // JavaScript rend quatre poids NaN sans erreur ; Python lève ZeroDivisionError.
  assert.throws(() => {
    assert.throws(
      () => learnWeights(impressions([[[0.5, 1, 0.3, 0.2, true], [0.5, 1, 0.3, 0.2, false]]])),
      /nothing to learn from/,
    );
  });
});

test('DÉFAUT : un signal manquant rend des poids NaN, sans erreur', () => {
  // Python lève TypeError sur None ; ici `undefined` contamine tout l'ajustement.
  assert.throws(() => {
    const weights = learnWeights([page([[0.5, 1, 0.3, undefined, true], [0.4, 1, 0.3, 0.2, false]])]);
    assert.ok(Object.values(weights).every(Number.isFinite));
  });
});

test('DÉFAUT : des signaux hors échelle font diverger la descente de gradient des poids de Python', () => {
  // Rien ne refuse une popularité en pourcentage. scikit-learn converge
  // (popularité ≈ 0,00) ; le pas fixe de 0,5 fait osciller la descente de
  // gradient, qui rend une popularité ≈ -0,49 : les deux langages ne sont plus
  // le même modèle, et rien ne le signale.
  assert.throws(() => {
    const enPourcent = LOG.map((rows) => rows.map((r) => [r[0], r[1], r[2], r[3] * 100, r[4]]));
    const [python] = learnWeightsEnPython([enPourcent]);
    const javascript = learnWeights(impressions(enPourcent));
    for (const name of SIGNALS) assert.ok(close(python[name], javascript[name]), name);
  });
});
