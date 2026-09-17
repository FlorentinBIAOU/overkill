import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
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

/**
 * Une page, dans l'ordre où elle a été affichée.
 *
 * Les lignes des journaux ci-dessus écrivent le produit cliqué en premier, par
 * commodité de lecture. L'ordre d'affichage est l'inverse : les produits ignorés
 * au-dessus, le clic en dessous — c'est la seule forme dont N1 apprenne quelque
 * chose, puisqu'il n'apparie un clic qu'aux produits montrés au-dessus de lui.
 */
const page = (rows) => [...rows]
  .sort((a, b) => Number(Boolean(a[4])) - Number(Boolean(b[4])))
  .map((row) => ({
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

function learnWeightsEnPython(journaux, regularisation = 1) {
  const racine = fileURLToPath(new URL('../../../', import.meta.url));
  const venv = `${racine}.venv-tools/bin/python`;
  const python = existsSync(venv) ? venv : 'python3';
  const script =
    'import sys, json; sys.path.insert(0, sys.argv[1]); from n1 import learn_weights; ' +
    `json.dump([learn_weights(j, ${regularisation}) for j in json.load(sys.stdin)], sys.stdout)`;
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
  // decimals of agreement is what says the gradient descent above is the same
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

test('l’ajustement est une descente de gradient écrite en entier, sans dépendance', () => {
  // Docstring : « The fit is […] gradient descent rather than a dependency ». Le nombre de lignes n'est
  // pas épinglé (décision n° 10 du lot) ; il est mesuré au relevé.
  const source = readFileSync(new URL('./n1.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s|require\(/m);
  // Une descente : un seul pas ne rend pas les poids de six cents pas, qui sont ceux de scikit-learn.
  const unPas = learnWeights(impressions(), { epochs: 1 });
  const complet = learnWeights(impressions());
  assert.ok(SIGNALS.some((name) => !close(unPas[name], complet[name])));
  assert.throws(() => learnWeights(impressions(), { epochs: 0 }), /never differ/);
});

test('la pénalité divisée par le nombre de lignes fait le même modèle pour plusieurs C', () => {
  // Commentaire : « The penalty of scikit-learn's `C`, divided by the row count because the gradient above
  // is a mean: it is what makes both versions fit one model. »
  const journaux = [LOG, [...LOG, ...LOG, ...LOG]];
  for (const regularisation of [0.1, 1]) {
    const python = learnWeightsEnPython(journaux, regularisation);
    journaux.forEach((journal, i) => {
      const javascript = learnWeights(impressions(journal), { regularisation });
      for (const name of SIGNALS) assert.ok(close(python[i][name], javascript[name]), `${regularisation} ${i} ${name}`);
    });
  }
  // Le nombre de lignes compte : le journal triplé n'apprend pas les mêmes poids.
  assert.ok(Math.abs(learnWeights(impressions(LOG)).text - learnWeights(impressions(journaux[1])).text) > 0.03);
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

test('le score de N1 est une somme entre moins un et un, là où N0 est une moyenne', () => {
  const weights = learnWeights(impressions());
  assert.ok(weights.margin < 0);
  assert.ok(close(Object.values(weights).reduce((s, v) => s + Math.abs(v), 0), 1, 1e-9));
  const candidat = page([[0, 0, 1, 0, false]]);
  const [ligne] = rank(candidat, weights);
  assert.ok(close(ligne.score, weights.margin, 1e-12) && ligne.score < 0);
  assert.deepEqual(ligne.candidate.signals, candidat[0].signals);
  const tousPositifs = { text: 0.25, availability: 0.25, margin: 0.25, popularity: 0.25 };
  const tousNegatifs = Object.fromEntries(SIGNALS.map((n) => [n, -0.25]));
  const un = page([[1, 1, 1, 1, false]]);
  assert.equal(rank(un, tousPositifs)[0].score, 1);
  assert.equal(rank(un, tousNegatifs)[0].score, -1);
  for (const item of impressions(synthetique(100)).flat()) {
    const s = rank([item], weights)[0].score;
    assert.ok(s >= -1 && s <= 1);
  }
  assert.throws(() => n0.score(candidat[0].signals, weights), { name: 'RangeError', message: /nought or above/ });
});

test('diviser par le total signé inverserait l’ordre ou l’effacerait', () => {
  const moyenneSignee = (signaux, poids) => {
    const total = SIGNALS.reduce((s, n) => s + poids[n], 0);
    return total ? SIGNALS.reduce((s, n) => s + poids[n] * signaux[n], 0) / total : 0;
  };
  const weights = learnWeights(impressions(AGAINST_THE_SHOP));
  assert.ok(Object.values(weights).reduce((s, v) => s + v, 0) < 0);
  const candidats = page([[1, 1, 0.9, 0.5, false], [0, 1, 0.1, 0.5, false]]);
  const ranked = rank(candidats, weights);
  assert.ok(ranked[0].score > ranked[1].score);
  const ordreSomme = ranked.map((r) => r.candidate.signals.text);
  const ordreMoyenne = [...candidats].sort((a, b) => moyenneSignee(b.signals, weights) - moyenneSignee(a.signals, weights))
    .map((c) => c.signals.text);
  assert.deepEqual(ordreMoyenne, [...ordreSomme].reverse());
  const nuls = { text: 0.5, availability: 0, margin: -0.5, popularity: 0 };
  assert.deepEqual(candidats.map((c) => moyenneSignee(c.signals, nuls)), [0, 0]);
  assert.equal(new Set(rank(candidats, nuls).map((r) => r.score)).size, 2);
});

test('N0 refuse les poids appris négatifs : il faut servir avec la fonction de N1', () => {
  const weights = learnWeights(impressions(AGAINST_THE_SHOP));
  assert.ok(Math.min(...Object.values(weights)) < 0);
  const produits = [
    { title: 'pertinent et rentable', tags: [], inStock: true, margin: 0.9, popularity: 0.5 },
    { title: 'hors sujet et sans marge', tags: [], inStock: true, margin: 0.1, popularity: 0.5 },
  ];
  assert.throws(() => n0.rank(produits, 'pertinent', weights), { name: 'RangeError', message: /nought or above/ });
  const candidates = produits.map((p) => ({ title: p.title, signals: n0.signals(p, 'pertinent') }));
  const ranked = rank(candidates, weights);
  assert.deepEqual(ranked.map((r) => r.candidate.title), ['hors sujet et sans marge', 'pertinent et rentable']);
  assert.ok(ranked.every((r) => Object.keys(r.candidate.signals).length === 4 && typeof r.score === 'number'));
});

test('somme pondérée des mêmes signaux, même tri stable, signaux rendus', () => {
  // Docstring de rank : « A sum weighted over the same signals, the same stable sort, the signals handed back with each candidate ».
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

test('production : un journal sans aucune différence lève l’erreur nommée', () => {
  assert.throws(
    () => learnWeights(impressions([[[0.5, 1, 0.3, 0.2, true], [0.5, 1, 0.3, 0.2, false]]])),
    /nothing to learn from/,
  );
});

test('production : un signal manquant est refusé', () => {
  // Commentaire de inScale : « undefined fails too ».
  assert.throws(() => learnWeights([page([[0.5, 1, 0.3, undefined, true], [0.4, 1, 0.3, 0.2, false]])]), RangeError);
  assert.throws(() => learnWeights([page([[0.5, 1, 0.3, NaN, true], [0.4, 1, 0.3, 0.2, false]])]), RangeError);
});

test('un signal null ou écrit en chaîne est refusé, comme en Python', () => {
  // « The type is checked, not only the comparison: `null >= 0` is true in
  // JavaScript ».
  for (const valeur of [null, '0.9', undefined, NaN]) {
    assert.throws(() => pairs([page([[0.5, 1, 0.3, valeur, true], [0.4, 1, 0.3, 0.2, false]])]), RangeError, String(valeur));
  }
});

test('production : des signaux hors échelle sont refusés', () => {
  const enPourcent = LOG.map((rows) => rows.map((r) => [r[0], r[1], r[2], r[3] * 100, r[4]]));
  assert.throws(() => learnWeights(impressions(enPourcent)), { name: 'RangeError', message: /between 0 and 1/ });
  for (const hors of [-0.0001, 1.0000001, Infinity]) {
    assert.throws(() => pairs([page([[0.5, 1, 0.3, hors, true], [0.4, 1, 0.3, 0.2, false]])]), RangeError, String(hors));
  }
  assert.throws(() => pairs([page([[0.5, 1, 0.3, 2, false]])]), RangeError);
  assert.equal(pairs([page([[0, 0, 0, 0, true], [1, 1, 1, 1, false]])]).rows.length, 2);
});
