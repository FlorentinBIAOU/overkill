import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { DEFAULT_WEIGHTS, outOfScale, SIGNALS, fold, rank, score, signals, terms, textMatch } from './n0.js';
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

test('une requête au pluriel ne trouve pas le produit au singulier', () => {
  // Docstring de textMatch : « Not the other way round: "sandales" does not find "sandale". »
  assert.equal(textMatch('sandales', { title: 'Sandale de marche' }), 0);
  assert.equal(textMatch('sandales randonnée', { title: 'Sandale de randonnée' }), 0.5);
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
  assert.equal(fold('Việt Nam, Évry, Ångström'), 'viet nam, evry, angstrom');
  assert.equal(textMatch('evry', { title: 'Magasin d’Évry'.normalize('NFD') }), 1);
});

test('seules les diacritiques de U+0300 à U+036F sont retirées', () => {
  assert.equal(fold('a\u0300b\u036fc'), 'abc');
  assert.equal(fold('e\u1dc4'), 'e\u1dc4');
  assert.equal(fold('हिंदी'), 'हिंदी');
});

test('les voyelles du devanagari et de l’arabe restent des mots différents', () => {
  assert.deepEqual(terms('हिंदी फ़िल्में'), ['हिंदी', 'फ़िल्में']);
  assert.equal(textMatch('हिंदी', { title: 'हद' }), 0);
  assert.equal(textMatch('मलक', { title: 'मालिक' }), 0);
  // « مَلِك » (roi) et « مَلَك » (ange) ne diffèrent que par une voyelle : ils restent deux mots.
  assert.equal(textMatch('مَلِك', { title: 'مَلَك' }), 0);
  assert.equal(textMatch('हिंदी', { title: 'हिंदी फ़िल्में' }), 1);
  assert.equal(textMatch('مَلِك', { title: 'كتاب مَلِك' }), 1);
});

test('tout ce qui n’est ni lettre, ni marque, ni chiffre sépare les termes', () => {
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

test('le texte et la disponibilité sont entre zéro et un par construction', () => {
  for (const requete of ['chaussures de course', '', 'chauss randonnée zzz', '!!!']) {
    for (const produit of [...SPRING, { ...CATALOGUE[0], inStock: 'oui' }, { ...CATALOGUE[0], inStock: 0 }]) {
      const mesure = signals(produit, requete);
      assert.ok(mesure.text >= 0 && mesure.text <= 1 && [0, 1].includes(mesure.availability));
    }
  }
});

test('une marge ou une popularité hors de l’échelle est ramenée et signalée', () => {
  // « margin and popularity because a value outside is brought back onto it
  // […] Brought back, and not refused ».
  assert.equal(signals({ ...CATALOGUE[0], margin: 35 }, 'chaussures').margin, 1);
  assert.equal(signals({ ...CATALOGUE[0], margin: -0.05 }, 'chaussures').margin, 0);
  assert.equal(signals({ ...CATALOGUE[0], popularity: 80 }, 'chaussures').popularity, 1);
  for (const hors of [-0.0001, 1.0000001, NaN, Infinity, null, '0.5']) {
    assert.deepEqual(outOfScale({ ...CATALOGUE[0], margin: hors }), ['margin'], String(hors));
    const mesure = signals({ ...CATALOGUE[0], margin: hors }, 'chaussures');
    assert.ok(mesure.margin >= 0 && mesure.margin <= 1, String(hors));
  }
  for (const limite of [0, 1]) {
    const produit = { ...CATALOGUE[0], margin: limite, popularity: limite };
    assert.deepEqual([signals(produit, 'chaussures').margin, signals(produit, 'chaussures').popularity], [limite, limite]);
    assert.deepEqual(outOfScale(produit), []);
  }
});

test('un seul produit mal renseigné ne fait pas tomber la page', () => {
  // « One badly filled product must not take the whole category page down with
  // it. The products whose signals had to be moved come back named ».
  const produits = [CATALOGUE[0], { ...CATALOGUE[1], margin: -0.05 }, CATALOGUE[2]];
  const classement = rank(produits, 'chaussures');
  assert.equal(classement.length, 3);
  const fautif = classement.find((row) => row.product.title === CATALOGUE[1].title);
  assert.deepEqual(fautif.outOfScale, ['margin']);
  assert.equal(fautif.signals.margin, 0);
  assert.deepEqual(classement.filter((row) => row !== fautif).map((row) => row.outOfScale), [[], []]);
});

test('un poids négatif est refusé', () => {
  const mesure = { text: 1, availability: 0, margin: 0, popularity: 0 };
  assert.throws(() => score(mesure, { text: 2, availability: 0, margin: -1, popularity: 0 }), { name: 'RangeError', message: /nought or above/ });
  assert.throws(() => rank(CATALOGUE, 'chaussures', { ...DEFAULT_WEIGHTS, popularity: -1e-9 }), RangeError);
  assert.equal(score(mesure, { text: 2, availability: 0, margin: 0, popularity: 0 }), 1);
});

test('un poids qui n’est pas un nombre fini est refusé', () => {
  // « a weight that is not a finite number, zero or above, is refused ».
  const mesure = { text: 1, availability: 0, margin: 0.5, popularity: 0.2 };
  for (const poids of [NaN, Infinity, -Infinity, null, '2', true]) {
    assert.throws(() => score(mesure, { ...DEFAULT_WEIGHTS, text: poids }), { message: /finite number/ }, String(poids));
  }
  assert.throws(() => score(mesure, { text: 1, availability: 1 }), { message: /every signal needs a weight/ });
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
  // why : « cette nouveauté n'a presque aucune popularité » : 5 %, la plus faible du tableau.
  const cas = essai.cases.find((c) => c.fails);
  const fr = essai.run(cas.input.fr, 'fr').rows.rows;
  assert.deepEqual(fr.slice(0, 3).map((r) => r[0]), ['Chaussures de course Route 5', 'Chaussettes de running', 'Sandales de randonnée Ultra']);
  assert.equal(fr.filter((r) => r[1] === '100 %').length, 1);
  const popularite = (rows, titre) => rows.find((r) => r[0] === titre)[4];
  const valeur = (cellule) => Number.parseInt(typeof cellule === 'object' ? cellule.v : cellule, 10);
  assert.equal(valeur(popularite(fr, 'Sandales de randonnée Ultra')), 5);
  assert.equal(Math.min(...fr.map((r) => valeur(r[4]))), 5);
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

test('production : un mot en devanagari ou en arabe voyellé ne trouve pas un autre mot', () => {
  // Même sortie en Python (n0.test.py) : les deux langages gardent les mêmes marques.
  assert.equal(textMatch('हिंदी', { title: 'हद' }), 0);
  assert.equal(textMatch('مَلِك', { title: 'مَلَك' }), 0);
  assert.deepEqual(terms('مَكْتَبَة'), ['مَكْتَبَة']);
});

test('production : un champ manquant lève, un champ sali est signalé', () => {
  // « A field the catalogue does not have at all is a schema fault, not a dirty
  // value: it is refused, as it is in Python ».
  assert.throws(() => rank([{ title: 'Sans stock', margin: 0.1, popularity: 0.1 }], 'x'), RangeError);
  assert.throws(() => rank([{ title: 'Sans marge', inStock: true, popularity: 0.1 }], 'x'), RangeError);
  for (const popularity of [null, '0.5', undefined]) {
    const classement = rank([{ ...CATALOGUE[0], popularity }], 'x');
    assert.equal(classement[0].signals.popularity, 0, String(popularity));
    assert.deepEqual(classement[0].outOfScale, ['popularity'], String(popularity));
  }
  assert.throws(() => rank(CATALOGUE, 'x', { text: 1 }), { message: /every signal needs a weight/ });
});
