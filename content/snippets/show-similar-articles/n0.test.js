/**
 * The corpus lives here, not in the snippet: the snippet shows a function,
 * not a demonstration. The same corpus and the same expected table appear in
 * n0.test.py, which is how the two languages are held to the same ranking.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNeighbourTable, similarity, tagWeights } from './n0.js';

// A small blog. Every article carries "blog", the way every article on a real
// site carries the tag someone added on the first day and never removed.
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

test('the whole table is built at once', () => {
  assert.deepEqual(buildNeighbourTable(ARTICLES), EXPECTED);
});

test('a tag every article carries weighs nothing', () => {
  const weights = tagWeights(ARTICLES);
  assert.equal(weights.get('blog'), 0);
  assert.ok(weights.get('rye') > weights.get('sourdough'));
  assert.ok(weights.get('sourdough') > 0);
});

test('rarity beats a count of shared tags', () => {
  // Two articles share two ordinary tags; a third shares one rare tag. A
  // plain count of shared tags puts the wrong one first, which is exactly
  // what this rung is about.
  const corpus = [
    { id: 'sourdough-hydration', tags: ['news', 'guide', 'sourdough'] },
    { id: 'seo-checklist', tags: ['news', 'guide', 'seo'] },
    { id: 'sourdough-troubles', tags: ['news', 'sourdough'] },
    { id: 'css-grid', tags: ['news', 'guide', 'css'] },
    { id: 'hiring-process', tags: ['news', 'guide', 'hiring'] },
  ];
  const neighbours = buildNeighbourTable(corpus)['sourdough-hydration'];
  assert.equal(neighbours[0][0], 'sourdough-troubles');

  const shared = { 'seo-checklist': 2, 'sourdough-troubles': 1 };
  assert.ok(shared['seo-checklist'] > shared['sourdough-troubles']);
});

test('an article with no tags has no neighbours, and is nobody else\'s', () => {
  const corpus = [...ARTICLES, { id: 'untagged-draft', tags: [] }];
  const table = buildNeighbourTable(corpus);
  assert.deepEqual(table['untagged-draft'], []);
  for (const row of Object.values(table)) {
    assert.ok(!row.some(([id]) => id === 'untagged-draft'));
  }
});

test('a corpus of one article', () => {
  assert.deepEqual(buildNeighbourTable([ARTICLES[0]]), { 'kimchi-at-home': [] });
});

test('k caps the length of each row', () => {
  const table = buildNeighbourTable(ARTICLES, { k: 1 });
  assert.deepEqual(table['sourdough-starter'], [['rye-bread', 0.535]]);
});

test('the similarity of an article with itself is one', () => {
  const weights = tagWeights(ARTICLES);
  const score = similarity(ARTICLES[0].tags, ARTICLES[0].tags, weights);
  assert.equal(Math.round(score * 1e6) / 1e6, 1);
});

test('breaking point: a badly tagged corpus produces no similarity', () => {
  // Badly tagged means two things, and both end here. Tags so generic that
  // every article carries them weigh exactly zero, so no pair has anything to
  // share. Tags so specific that no two articles share one leave every pair
  // with nothing in common. Either way the table is empty, and the block does
  // not appear on a single page.
  //
  // This is not a bug to be tuned away: the tags are the whole input, and
  // this rung cannot invent a signal that nobody entered. It is the reason
  // the entry goes on to N1, which reads the article instead of its labels.
  const tooGeneric = [
    { id: 'first', tags: ['blog', 'article'] },
    { id: 'second', tags: ['blog', 'article'] },
    { id: 'third', tags: ['blog', 'article'] },
  ];
  assert.deepEqual(buildNeighbourTable(tooGeneric), { first: [], second: [], third: [] });

  const tooSpecific = [
    { id: 'first', tags: ['2024-retrospective'] },
    { id: 'second', tags: ['march-release'] },
    { id: 'third', tags: ['office-move'] },
  ];
  assert.deepEqual(buildNeighbourTable(tooSpecific), { first: [], second: [], third: [] });
});
