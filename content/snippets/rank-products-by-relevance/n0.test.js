import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { DEFAULT_WEIGHTS, SIGNALS, fold, rank, score, signals, terms, textMatch } from './n0.js';
import essai from '../../tryouts/live/rank-products-by-relevance.js';

// An autumn catalogue, small enough to reason about by hand. Margin and
// popularity are shares between nought and one, as the snippet expects.
const CATALOGUE = [
  { title: 'Chaussures de course Route 5', tags: ['running', 'bitume'],
    inStock: true, margin: 0.35, popularity: 0.80 },
  { title: 'Chaussures de course Trail 3', tags: ['running', 'sentier'],
    inStock: true, margin: 0.42, popularity: 0.30 },
  { title: 'Chaussettes de running', tags: ['running'],
    inStock: true, margin: 0.60, popularity: 0.55 },
  { title: 'Montre GPS Crème', tags: ['running', 'montre'],
    inStock: false, margin: 0.25, popularity: 0.70 },
  { title: 'Sac à dos de randonnée', tags: ['randonnée'],
    inStock: true, margin: 0.48, popularity: 0.20 },
];

// The order the two language versions of the snippet must both produce. The
// same list appears in n0.test.py.
const EXPECTED_ORDER = [
  'Chaussures de course Route 5',
  'Chaussures de course Trail 3',
  'Chaussettes de running',
  'Sac à dos de randonnée',
  'Montre GPS Crème',
];

// Weights tuned on the autumn catalogue, where the popular products were also
// the relevant ones. The same numbers sit in the tryout.
const TUNED = { text: 3, availability: 2, margin: 1, popularity: 6 };

const SPRING = [
  { title: 'Sandales de randonnée Ultra', tags: ['randonnée', 'été'],
    inStock: true, margin: 0.40, popularity: 0.05 },
  ...CATALOGUE,
];

const titles = (ranked) => ranked.map((row) => row.product.title);

/** Exécute le vrai n0.py pour chaque [produits au format Python, requête, poids]. */
function enPython(appels) {
  const racine = fileURLToPath(new URL('../../../', import.meta.url));
  const venv = `${racine}.venv-tools/bin/python`;
  const python = existsSync(venv) ? venv : 'python3';
  const script =
    'import sys, json; sys.path.insert(0, sys.argv[1]); from n0 import rank; ' +
    'json.dump([[[r["product"]["title"], r["score"], r["signals"]] for r in rank(p, q, w)] ' +
    'for p, q, w in json.load(sys.stdin)], sys.stdout)';
  const r = spawnSync(python, ['-c', script, fileURLToPath(new URL('.', import.meta.url))], {
    input: JSON.stringify(appels),
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

const auFormatPython = (produits) => produits.map((p) => ({
  title: p.title, tags: p.tags ?? [], in_stock: p.inStock, margin: p.margin, popularity: p.popularity,
}));

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : les poids réglés à l’automne font le bon ordre sur le catalogue d’automne', () => {
  assert.equal(titles(rank(CATALOGUE, 'chaussures de course', TUNED))[0], EXPECTED_ORDER[0]);
});

test('point de rupture : au printemps, sandales randonnée perd contre le succès de la saison précédente', () => {
  // « mêmes poids, même code. Rien ne le signale : ni exception, ni test rouge, ni ligne de journal ».
  const ecrits = [];
  const noms = ['log', 'info', 'warn', 'error', 'debug'];
  const origines = Object.fromEntries(noms.map((n) => [n, console[n]]));
  let ranked;
  try {
    for (const n of noms) console[n] = (...args) => ecrits.push(args);
    ranked = rank(SPRING, 'sandales randonnée', TUNED);
  } finally {
    Object.assign(console, origines);
  }
  assert.equal(titles(ranked)[0], 'Chaussures de course Route 5');
  assert.equal(ranked.find((r) => r.product.title === 'Sandales de randonnée Ultra').signals.text, 1);
  assert.equal(ranked[0].signals.text, 0);
  assert.deepEqual(ecrits, []);
});

test('point de rupture : témoin, déplacer un nombre remet la nouveauté en tête', () => {
  const retuned = { ...TUNED, text: 12 };
  assert.equal(titles(rank(SPRING, 'sandales randonnee', retuned))[0], 'Sandales de randonnée Ultra');
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('classe d’abord les produits qui correspondent', () => {
  assert.deepEqual(titles(rank(CATALOGUE, 'chaussures de course')), EXPECTED_ORDER);
});

test('Python et JavaScript rendent le même classement et les mêmes scores', () => {
  const appels = [];
  for (const requete of ['chaussures de course', 'CRÈME', 'sandales randonnée', '', 'chauss', '!!!',
    'randonnée'.normalize('NFD'), 'running\u00a0montre', '🥾 randonnée']) {
    for (const poids of [DEFAULT_WEIGHTS, TUNED, { text: 1, availability: 0, margin: 9, popularity: 0 }]) {
      appels.push([SPRING, requete, poids]);
    }
  }
  const attendu = appels.map(([p, q, w]) => rank(p, q, w).map((r) => [r.product.title, r.score, r.signals]));
  assert.deepEqual(enPython(appels.map(([p, q, w]) => [auFormatPython(p), q, w])), attendu);
});

test('un préfixe suffit', () => {
  assert.equal(textMatch('chauss', CATALOGUE[0]), 1);
  assert.equal(textMatch('chaussures course', CATALOGUE[2]), 0);
});

test('INFIRMÉ : une requête au pluriel trouve le produit au singulier', () => {
  // La docstring dit « a shopper who types the plural is looking for the singular too ».
  assert.throws(() => assert.equal(textMatch('sandales', { title: 'Sandale de marche' }), 1));
});

test('le singulier trouve le pluriel', () => {
  assert.equal(textMatch('sandale', { title: 'Sandales de marche' }), 1);
});

test('les accents et la casse sont ignorés', () => {
  assert.equal(textMatch('CRÈME', CATALOGUE[3]), 1);
  assert.equal(textMatch('creme', CATALOGUE[3]), 1);
  assert.equal(textMatch('randonnee', CATALOGUE[4]), 1);
  assert.equal(textMatch('crème', { title: 'Montre creme' }), 1);
  assert.equal(fold('Crème'), 'creme');
});

test('tout ce qui n’est ni lettre ni chiffre sépare les termes', () => {
  assert.deepEqual(terms('T-shirt  col-V, taille 42/44'), ['t', 'shirt', 'col', 'v', 'taille', '42', '44']);
});

test('le classement dit pourquoi', () => {
  const top = rank(CATALOGUE, 'chaussures de course')[0];
  assert.deepEqual(top.signals, { text: 1, availability: 1, margin: 0.35, popularity: 0.80 });
  assert.ok(top.score >= 0 && top.score <= 1);
  assert.ok(Math.abs(top.score - (6 + 2 + 0.35 + 3 * 0.8) / 12) < 1e-12);
});

test('un poids de deux compte vraiment deux fois plus', () => {
  const mesure = { text: 1, availability: 0, margin: 1, popularity: 0 };
  assert.ok(Math.abs(score(mesure, { text: 1, availability: 1, margin: 0, popularity: 0 }) - 1 / 2) < 1e-12);
  assert.ok(Math.abs(score(mesure, { text: 2, availability: 1, margin: 0, popularity: 0 }) - 2 / 3) < 1e-12);
});

test('INFIRMÉ : chaque signal est ramené entre zéro et un', () => {
  // La marge et la popularité sont recopiées telles quelles : 35 reste 35.
  assert.throws(() => {
    const mesure = signals({ ...CATALOGUE[0], margin: 35, popularity: 80 }, 'chaussures');
    assert.ok(SIGNALS.every((name) => mesure[name] >= 0 && mesure[name] <= 1));
  });
});

test('INFIRMÉ : le score reste entre zéro et un quels que soient les poids', () => {
  // Texte 2, marge -1 : la moyenne pondérée vaut 2.
  assert.throws(() => {
    const s = score({ text: 1, availability: 0, margin: 0, popularity: 0 }, { text: 2, availability: 0, margin: -1, popularity: 0 });
    assert.ok(s >= 0 && s <= 1);
  });
});

test('le score reste entre zéro et un pour des poids positifs et des signaux dans l’échelle', () => {
  for (const poids of [DEFAULT_WEIGHTS, TUNED, { text: 0, availability: 0, margin: 0, popularity: 1e9 }]) {
    for (const row of rank(SPRING, 'chaussures randonnée', poids)) assert.ok(row.score >= 0 && row.score <= 1);
  }
});

test('la disponibilité est un signal parmi d’autres, pas un filtre', () => {
  assert.equal(titles(rank(CATALOGUE, 'montre'))[0], 'Montre GPS Crème');
  const stockFirst = { ...DEFAULT_WEIGHTS, availability: 20 };
  assert.equal(titles(rank(CATALOGUE, 'montre', stockFirst)).at(-1), 'Montre GPS Crème');
});

test('les poids sont des arguments, pas des constantes cachées', () => {
  const greedy = { text: 1, availability: 0, margin: 9, popularity: 0 };
  assert.equal(titles(rank(CATALOGUE, 'chaussures de course', greedy))[0], 'Chaussettes de running');
  assert.equal(titles(rank(CATALOGUE, 'chaussures de course', DEFAULT_WEIGHTS))[0], EXPECTED_ORDER[0]);
});

test('le tri est stable à égalité', () => {
  const twinA = { ...CATALOGUE[1], title: 'Trail 3 bleu' };
  const twinB = { ...CATALOGUE[1], title: 'Trail 3 rouge' };
  assert.deepEqual(titles(rank([twinA, twinB], 'trail')), ['Trail 3 bleu', 'Trail 3 rouge']);
  assert.deepEqual(titles(rank([twinB, twinA], 'trail')), ['Trail 3 rouge', 'Trail 3 bleu']);
  const jumeaux = Array.from({ length: 100 }, (_, i) => ({ ...CATALOGUE[1], title: `Trail ${i}` }));
  assert.deepEqual(titles(rank(jumeaux, 'trail')), jumeaux.map((p) => p.title));
});

test('déterministe : le même appel rend le même ordre', () => {
  assert.deepEqual(rank(SPRING, 'chaussures de course'), rank(SPRING, 'chaussures de course'));
});

test('aucune donnée hors des quatre signaux n’entre dans le score', () => {
  const avecClient = SPRING.map((p) => ({ ...p, lastBuyerEmail: 'i.fontaine@example.test', buyerAge: 41 }));
  assert.deepEqual(rank(avecClient, 'randonnée').map((r) => r.score), rank(SPRING, 'randonnée').map((r) => r.score));
});

test('aucun fichier écrit', () => {
  const noms = ['writeFileSync', 'writeFile', 'openSync', 'open', 'createWriteStream', 'appendFileSync'];
  const origines = Object.fromEntries(noms.map((n) => [n, fs[n]]));
  let ranked;
  try {
    for (const n of noms) {
      fs[n] = () => {
        throw new Error('un fichier a été ouvert');
      };
    }
    syncBuiltinESMExports();
    ranked = rank(SPRING, 'randonnée');
  } finally {
    Object.assign(fs, origines);
    syncBuiltinESMExports();
  }
  assert.equal(ranked.length, 6);
});

test('un classement de six produits prend moins d’une milliseconde', () => {
  const debut = performance.now();
  for (let i = 0; i < 1000; i += 1) rank(SPRING, 'sandales randonnée', TUNED);
  assert.ok(performance.now() - debut < 1000);
});

test('l’essai : la nouveauté arrive troisième derrière des chaussures de course et des chaussettes', () => {
  const cas = essai.cases.find((c) => c.fails);
  const fr = essai.run(cas.input.fr, 'fr').rows.rows;
  assert.deepEqual(fr.slice(0, 3).map((r) => r[0]), ['Chaussures de course Route 5', 'Chaussettes de running', 'Sandales de randonnée Ultra']);
  assert.equal(fr.filter((r) => r[1] === '100 %').length, 1);
  const en = essai.run(cas.input.en, 'en').rows.rows;
  assert.deepEqual(en.slice(0, 3).map((r) => r[0]), ['Route 5 running shoes', 'Running socks', 'Ultra hiking sandals']);
  assert.equal(en.filter((r) => r[1] === '100 %').length, 1);
});

test('l’essai : la cellule surlignée est le signal qui a le plus poussé le premier produit', () => {
  const { rows } = essai.run('sandales randonnée', 'fr').rows;
  const surlignees = rows.flatMap((r, i) => r.map((c, j) => (c && c.caught ? [i, j] : null)).filter(Boolean));
  // Première ligne, colonne popularité : 6 × 0,80 = 4,8, plus que stock 2 × 1.
  assert.deepEqual(surlignees, [[0, 4]]);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : une requête vide laisse les signaux commerciaux décider', () => {
  const ranked = rank(CATALOGUE, '');
  assert.ok(ranked.every((row) => row.signals.text === 0));
  assert.equal(titles(ranked)[0], 'Chaussures de course Route 5');
  assert.ok(rank(CATALOGUE, ' ,;!? ').every((r) => r.signals.text === 0));
});

test('production : un catalogue vide donne un classement vide', () => {
  assert.deepEqual(rank([], 'chaussures'), []);
});

test('production : des poids tous nuls rendent zéro et l’ordre du catalogue', () => {
  const zero = Object.fromEntries(SIGNALS.map((name) => [name, 0]));
  const ranked = rank(SPRING, 'randonnée', zero);
  assert.deepEqual(ranked.map((r) => r.score), Array(6).fill(0));
  assert.deepEqual(titles(ranked), SPRING.map((p) => p.title));
});

test('production : dix mille produits et une longue requête terminent vite', () => {
  const produits = Array.from({ length: 10_000 }, (_, i) => ({ ...CATALOGUE[i % 5], title: `${CATALOGUE[i % 5].title} ${i}` }));
  const debut = performance.now();
  const ranked = rank(produits, 'chaussures de course trail route sentier bitume '.repeat(10));
  assert.ok(performance.now() - debut < 10_000);
  assert.equal(ranked.length, 10_000);
});

test('production : NFD, insécable, largeur nulle, emoji et casse mixte', () => {
  assert.equal(textMatch('randonnée', { title: 'Sac à dos de randonnée'.normalize('NFD') }), 1);
  assert.equal(textMatch('RANDONNÉE', { title: 'sac de randonnee' }), 1);
  assert.equal(textMatch('sac\u00a0dos', { title: 'Sac à dos' }), 1);
  assert.equal(textMatch('🥾 randonnée', { title: 'Sac de randonnée' }), 1);
  assert.equal(textMatch('rando\u200bnnée', { title: 'randonnée' }), 0.5);
});

test('un mot en devanagari ne trouve pas un autre mot', () => {
  // Le repli retire toute marque : « हिंदी » devient « हद » ici, « ह » et « द » en Python.
  assert.equal(textMatch('हिंदी', { title: 'हद' }), 0);
});

test('DÉFAUT : un produit sans popularité ou des poids incomplets ne lèvent aucune erreur', () => {
  // Python lève (TypeError, KeyError). Ici, une popularité `undefined` donne un
  // score NaN que le tri traite comme une égalité ; des poids incomplets donnent
  // un total NaN, que `total ? … : 0` change en score nul pour tous les produits.
  assert.throws(() => {
    const ranked = rank([{ ...CATALOGUE[0], popularity: undefined }, ...CATALOGUE.slice(1)], 'montre');
    assert.ok(ranked.every((r) => Number.isFinite(r.score)));
  });
  assert.throws(() => {
    assert.throws(() => rank(CATALOGUE, 'x', { text: 1 }));
  });
});

test('production : un produit sans champ inStock est compté hors stock', () => {
  assert.equal(rank([{ title: 'Sans stock', margin: 0.1, popularity: 0.1 }], 'x')[0].signals.availability, 0);
  // Et des poids incomplets rendent zéro partout, dans l'ordre du catalogue.
  assert.deepEqual(rank(CATALOGUE, 'x', { text: 1 }).map((r) => r.score), Array(5).fill(0));
});
