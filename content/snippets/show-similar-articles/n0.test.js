/**
 * Le fonds vit ici, pas dans l'extrait : l'extrait montre une fonction, pas
 * une démonstration. Le même fonds et la même table attendue figurent dans
 * n0.test.py, ce qui tient les deux langages au même classement.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildNeighbourTable, similarity, tagWeights } from './n0.js';
import { buildNeighbourTable as buildN1 } from './n1.js';

// Un petit blog. Chaque article porte « blog », comme chaque article d'un vrai
// site porte l'étiquette posée le premier jour et jamais retirée.
const ARTICLES = [
  { id: 'kimchi-at-home', tags: ['blog', 'fermentation', 'vegetables'] },
  { id: 'cast-iron-care', tags: ['blog', 'tools', 'maintenance', 'cast-iron'] },
  { id: 'knife-sharpening', tags: ['blog', 'tools', 'maintenance'] },
  { id: 'rye-bread', tags: ['blog', 'baking', 'sourdough', 'rye'] },
  { id: 'site-news', tags: ['blog'] },
  { id: 'sourdough-starter', tags: ['blog', 'baking', 'sourdough', 'fermentation'] },
];

const EXPECTED = {
  'kimchi-at-home': [['sourdough-starter', 0.302]],
  'cast-iron-care': [['knife-sharpening', 0.655]],
  'knife-sharpening': [['cast-iron-care', 0.655]],
  'rye-bread': [['sourdough-starter', 0.535]],
  'site-news': [],
  'sourdough-starter': [['rye-bread', 0.535], ['kimchi-at-home', 0.302]],
};

const TOO_GENERIC = [
  { id: 'first', tags: ['blog', 'article'] },
  { id: 'second', tags: ['blog', 'article'] },
  { id: 'third', tags: ['blog', 'article'] },
];

const TOO_SPECIFIC = [
  { id: 'first', tags: ['2024-retrospective'] },
  { id: 'second', tags: ['march-release'] },
  { id: 'third', tags: ['office-move'] },
];

const EMPTY = { first: [], second: [], third: [] };

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : un fonds mal étiqueté ne produit aucune similarité', () => {
  assert.deepEqual(buildNeighbourTable(TOO_GENERIC), EMPTY);
  assert.deepEqual(buildNeighbourTable(TOO_SPECIFIC), EMPTY);
});

test('point de rupture : « blog » et « article » pèsent exactement zéro', () => {
  assert.deepEqual([...tagWeights(TOO_GENERIC)], [['blog', 0], ['article', 0]]);
  const ones = new Map([['blog', 1], ['article', 1]]);
  assert.equal(Math.round(similarity(TOO_GENERIC[0].tags, TOO_GENERIC[1].tags, ones) * 1e6) / 1e6, 1);
});

test('point de rupture : chaque article porte une étiquette que lui seul porte', () => {
  assert.ok([...tagWeights(TOO_SPECIFIC).values()].every((w) => w > 0));
  assert.deepEqual(buildNeighbourTable(TOO_SPECIFIC), EMPTY);
  const shared = TOO_SPECIFIC.map((a) => ({ ...a, tags: a.id !== 'third' ? [...a.tags, 'release'] : a.tags }));
  assert.deepEqual(buildNeighbourTable(shared), { first: [['second', 0.12]], second: [['first', 0.12]], third: [] });
});

test('point de rupture : l’échec est total, le bloc n’apparaît sur aucune page', () => {
  for (const corpus of [TOO_GENERIC, TOO_SPECIFIC]) {
    assert.ok(Object.values(buildNeighbourTable(corpus)).every((row) => row.length === 0));
  }
  assert.equal(Object.values(buildNeighbourTable(ARTICLES)).filter((row) => row.length).length, 5);
});

test('point de rupture : un seul article de plus et l’étiquette générique redevient un signal', () => {
  const mixed = [...TOO_GENERIC, { id: 'fourth', tags: ['blog', 'unique'] }];
  assert.deepEqual(buildNeighbourTable(mixed), {
    first: [['second', 1], ['third', 1]],
    second: [['first', 1], ['third', 1]],
    third: [['first', 1], ['second', 1]],
    fourth: [],
  });
});

test('INFIRMÉ : une étiquette presque universelle laisse des lignes vides', async () => {
  await assert.rejects(async () => {
    const table = buildNeighbourTable([...TOO_GENERIC, { id: 'fourth', tags: ['blog', 'unique'] }]);
    assert.ok(table.first.length === 0 && table.second.length === 0 && table.third.length === 0);
  });
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('la table entière est construite d’un coup', () => {
  assert.deepEqual(buildNeighbourTable(ARTICLES), EXPECTED);
});

test('une étiquette que tous portent ne pèse rien', () => {
  const weights = tagWeights(ARTICLES);
  assert.equal(weights.get('blog'), 0);
  assert.ok(weights.get('rye') > weights.get('sourdough'));
  assert.ok(weights.get('sourdough') > 0);
});

test('la rareté bat le compte des étiquettes partagées', () => {
  const corpus = [
    { id: 'sourdough-hydration', tags: ['news', 'guide', 'sourdough'] },
    { id: 'seo-checklist', tags: ['news', 'guide', 'seo'] },
    { id: 'sourdough-troubles', tags: ['news', 'sourdough'] },
    { id: 'css-grid', tags: ['news', 'guide', 'css'] },
    { id: 'hiring-process', tags: ['news', 'guide', 'hiring'] },
  ];
  assert.equal(buildNeighbourTable(corpus)['sourdough-hydration'][0][0], 'sourdough-troubles');
  const mine = new Set(corpus[0].tags);
  const count = (a) => a.tags.filter((t) => mine.has(t)).length;
  const byCount = corpus.slice(1).sort((a, b) => count(b) - count(a) || (a.id < b.id ? -1 : 1));
  assert.deepEqual(byCount.map(count), [2, 2, 2, 2]);
  assert.equal(byCount[0].id, 'css-grid');
});

test('sans la rareté, l’annonce du site se range à côté de chaque article', () => {
  const ones = new Map(ARTICLES.flatMap((a) => a.tags).map((t) => [t, 1]));
  assert.ok(ARTICLES.every((other) => similarity(ARTICLES[4].tags, other.tags, ones) > 0));
  const table = buildNeighbourTable(ARTICLES);
  assert.deepEqual(table['site-news'], []);
  assert.ok(Object.values(table).every((row) => !row.some(([id]) => id === 'site-news')));
});

test('un article qui ne porte que des étiquettes universelles n’a aucun voisin', () => {
  assert.equal(similarity(['blog'], ['blog', 'rye'], tagWeights(ARTICLES)), 0);
  assert.deepEqual(buildNeighbourTable(ARTICLES)['site-news'], []);
});

test('un article sans étiquette n’a aucun voisin et n’est le voisin de personne', () => {
  const table = buildNeighbourTable([...ARTICLES, { id: 'untagged-draft', tags: [] }]);
  assert.deepEqual(table['untagged-draft'], []);
  for (const row of Object.values(table)) assert.ok(!row.some(([id]) => id === 'untagged-draft'));
});

test('la similarité d’un article avec lui-même vaut un', () => {
  const score = similarity(ARTICLES[0].tags, ARTICLES[0].tags, tagWeights(ARTICLES));
  assert.equal(Math.round(score * 1e6) / 1e6, 1);
});

test('les égalités sont départagées par l’identifiant quel que soit l’ordre', () => {
  const tie = [
    { id: 'z', tags: ['x', 'q'] },
    { id: 'b', tags: ['x', 'r'] },
    { id: 'a', tags: ['x', 's'] },
    { id: 'c', tags: ['w'] },
  ];
  const table = buildNeighbourTable(tie);
  assert.deepEqual(table.z, [['a', 0.041], ['b', 0.041]]);
  const reversed = buildNeighbourTable([...tie].reverse());
  for (const id of Object.keys(table)) assert.deepEqual(reversed[id], table[id]);
});

test('k borne la longueur de chaque ligne', () => {
  assert.deepEqual(buildNeighbourTable(ARTICLES, { k: 1 })['sourdough-starter'], [['rye-bread', 0.535]]);
});

test('la table ne dépend d’aucun lecteur', () => {
  // La fonction ne prend que le fonds et deux réglages.
  assert.equal(buildNeighbourTable.length, 1);
});

test('l’extrait n’importe rien', () => {
  const source = readFileSync(new URL('./n0.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s/m);
});

test('deux constructions rendent la même table', () => {
  const reversed = buildNeighbourTable([...ARTICLES].reverse());
  for (const id of Object.keys(EXPECTED)) assert.deepEqual(reversed[id], EXPECTED[id]);
});

test('scénario : les niveaux rendent la même forme de table', () => {
  const texts = ARTICLES.map((a) => ({ ...a, title: a.tags.join(' '), body: '' }));
  for (const table of [buildNeighbourTable(ARTICLES), buildN1(texts)]) {
    assert.deepEqual(Object.keys(table).sort(), ARTICLES.map((a) => a.id).sort());
    for (const row of Object.values(table)) {
      assert.ok(row.every((n) => Array.isArray(n) && typeof n[0] === 'string' && typeof n[1] === 'number'));
    }
  }
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : fonds vide et fonds d’un article', () => {
  assert.deepEqual(buildNeighbourTable([]), {});
  assert.equal(tagWeights([]).size, 0);
  assert.deepEqual(buildNeighbourTable([ARTICLES[0]]), { 'kimchi-at-home': [] });
});

test('production : mille articles', () => {
  let seed = 1;
  const next = () => { seed = (seed * 16807) % 2147483647; return seed; };
  const corpus = Array.from({ length: 1000 }, (_, i) => ({
    id: `a${String(i).padStart(4, '0')}`,
    tags: Array.from({ length: 5 }, () => `t${next() % 200}`),
  }));
  const started = Date.now();
  assert.equal(Object.keys(buildNeighbourTable(corpus)).length, 1000);
  assert.ok(Date.now() - started < 60_000);
});

test('production : étiquette répétée et casse différente', () => {
  const weights = tagWeights(ARTICLES);
  assert.ok(Math.abs(similarity(['rye', 'rye', 'baking'], ['rye', 'baking'], weights) - 1) < 1e-9);
  const cased = [{ id: 'a', tags: ['Sourdough', 'x'] }, { id: 'b', tags: ['sourdough', 'y'] }, { id: 'c', tags: ['z'] }];
  assert.deepEqual(buildNeighbourTable(cased), { a: [], b: [], c: [] });
});

test('une étiquette NFD ne rencontre pas la même en NFC', async () => {
  const corpus = [
    { id: 'a', tags: ['fermentação', 'x'] },
    { id: 'b', tags: ['fermentação'.normalize('NFD'), 'y'] },
    { id: 'c', tags: ['z'] },
  ];
  assert.notDeepEqual(buildNeighbourTable(corpus).a, []);
});

test('des étiquettes en chaîne sont lues lettre à lettre', async () => {
  const corpus = [{ id: 'a', tags: 'blog' }, { id: 'b', tags: 'gloss' }, { id: 'c', tags: 'x' }];
  let table;
  try {
    table = buildNeighbourTable(corpus);
  } catch (error) {
    if (error instanceof TypeError) return;
    throw error;
  }
  assert.deepEqual(table.a, []);
});

test('production : limites k nul et score égal au minimum', () => {
  assert.deepEqual(buildNeighbourTable(ARTICLES, { k: 0 }), Object.fromEntries(ARTICLES.map((a) => [a.id, []])));
  assert.deepEqual(buildNeighbourTable(ARTICLES, { minimum: 0.535 })['rye-bread'], []);
  assert.deepEqual(buildNeighbourTable(ARTICLES, { minimum: 0.534 })['rye-bread'], [['sourdough-starter', 0.535]]);
});

test('production : étiquettes emoji, espace insécable et BOM', () => {
  const corpus = [
    { id: 'a', tags: ['🍞', 'pain levain', '﻿x'] },
    { id: 'b', tags: ['🍞', 'pain levain'] },
    { id: 'c', tags: ['autre'] },
  ];
  assert.deepEqual(buildNeighbourTable(corpus).a, [['b', 0.463]]);
});
