/**
 * Ces tests injectent un double local au lieu de charger un vrai encodeur.
 *
 * Ce qu'ils prouvent : une chaîne par article, un seul appel pour tout le
 * fonds, une table correctement ordonnée, un fonds trop petit pour une paire
 * n'atteint jamais le modèle, et un encodeur qui tombe ou rend le mauvais
 * nombre de vecteurs lève. Les nombres sont ceux de n2.test.py.
 *
 * Ce qu'ils ne prouvent pas : qu'un vrai encodeur rapproche les bons articles.
 *
 * Le chargement par défaut importe '@huggingface/transformers'. Un crochet de
 * résolution, posé pour ce seul processus de test, remplace ce paquet par un
 * module à la surface de la bibliothèque publiée, qui compte les chargements.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { FakeEncoder } from '../_harness/fake-model.mjs';
import { buildNeighbourTable as buildN1 } from './n1.js';
import { EncodingFailed, MODEL_NAME, articleText, buildNeighbourTable, unit } from './n2.js';

globalThis.__transformersLoads = [];
const FAKE_TRANSFORMERS = `
  import { FakeEncoder } from ${JSON.stringify(new URL('../_harness/fake-model.mjs', import.meta.url).href)};
  export async function pipeline(task, model) {
    globalThis.__transformersLoads.push([task, model]);
    const fake = new FakeEncoder(256);
    return async (batch, options) => {
      const vectors = await fake.encode(batch);
      return { options, tolist: () => vectors };
    };
  }`;
const HOOKS = `export async function resolve(specifier, context, next) {
  if (specifier === '@huggingface/transformers') {
    return { url: 'data:text/javascript,' + encodeURIComponent(${JSON.stringify(FAKE_TRANSFORMERS)}), shortCircuit: true };
  }
  return next(specifier, context);
}`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const ARTICLES = [
  {
    id: 'sourdough-starter',
    title: 'Keeping a sourdough starter alive',
    body: 'Feeding flour and water to a sourdough starter, and reading its smell.',
  },
  {
    id: 'rye-bread',
    title: 'Baking a dense rye loaf',
    body: 'Rye flour, a sourdough starter, a long proof, a dense rye loaf.',
  },
  {
    id: 'kimchi-at-home',
    title: 'Kimchi in a jar at home',
    body: 'Salting cabbage, packing a jar, waiting for the ferment to turn sour.',
  },
  {
    id: 'pickled-cucumbers',
    title: 'Pickled cucumbers in brine',
    body: 'Cucumbers, dill and brine in a jar, left to ferment on the counter.',
  },
  {
    id: 'knife-sharpening',
    title: 'Sharpening a kitchen knife',
    body: 'Angle, whetstone and strokes: putting an edge back on a kitchen knife.',
  },
  {
    id: 'cast-iron-care',
    title: 'Caring for a cast iron pan',
    body: 'Oil, heat and seasoning: keeping rust off a cast iron pan.',
  },
];

const EXPECTED = {
  'sourdough-starter': [['rye-bread', 0.416], ['cast-iron-care', 0.28]],
  'rye-bread': [['sourdough-starter', 0.416], ['kimchi-at-home', 0.273]],
  'kimchi-at-home': [['pickled-cucumbers', 0.421], ['rye-bread', 0.273]],
  'pickled-cucumbers': [['kimchi-at-home', 0.421], ['sourdough-starter', 0.18]],
  'knife-sharpening': [['kimchi-at-home', 0.261], ['rye-bread', 0.261]],
  'cast-iron-care': [['sourdough-starter', 0.28], ['rye-bread', 0.256]],
};

const RAMBLING =
  ' The oven, the tin, the cooling rack, the knife, the board and the jar of jam all ' +
  'come into it, and so does the counter, the kitchen, the oil, the pan and the iron ' +
  'shelf above the hob.';

const encoder = () => new FakeEncoder(256);

class TruncatedEncoder extends FakeEncoder {
  async encode(texts) {
    return (await super.encode(texts)).slice(0, -1);
  }
}

const brokenEncoder = {
  encode: async () => {
    throw new Error('out of memory while loading the model');
  },
};

const diluted = () => ARTICLES.map((article, i) => (i === 1 ? { ...article, body: article.body + RAMBLING } : { ...article }));

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : le paragraphe digressif coûte au seigle sa place de premier voisin', async () => {
  const before = await buildNeighbourTable(ARTICLES, { encoder: encoder(), k: 2 });
  const after = await buildNeighbourTable(diluted(), { encoder: encoder(), k: 2 });
  assert.equal(before['sourdough-starter'][0][0], 'rye-bread');
  assert.equal(after['sourdough-starter'][0][0], 'cast-iron-care');
});

test('point de rupture : l’article rallongé perd son propre meilleur voisin', async () => {
  assert.equal((await buildNeighbourTable(ARTICLES, { encoder: encoder(), k: 2 }))['rye-bread'][0][0], 'sourdough-starter');
  assert.equal((await buildNeighbourTable(diluted(), { encoder: encoder(), k: 2 }))['rye-bread'][0][0], 'kimchi-at-home');
});

test('point de rupture : c’est le hors-sujet qui dilue, pas la longueur seule', async () => {
  const longer = ARTICLES.map((article, i) => (i === 1 ? { ...article, body: Array(8).fill(article.body).join(' ') } : article));
  const table = await buildNeighbourTable(longer, { encoder: encoder(), k: 2 });
  assert.deepEqual(table['sourdough-starter'][0], ['rye-bread', 0.482]);
  assert.deepEqual(table['rye-bread'][0], ['sourdough-starter', 0.482]);
});

test('constat : avec le double, huit sujets ne pèsent pas chacun un huitième', async () => {
  const eight = [
    { id: 'all', title: 'oven', body: 'board jam pan rye kimchi knife iron' },
    { id: 'one', title: 'rye', body: '' },
    { id: 'z', title: 'zzz', body: '' },
  ];
  assert.deepEqual((await buildNeighbourTable(eight, { encoder: encoder(), minimum: -1 })).one[0], ['all', 0.289]);
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('la table entière est construite d’un coup', async () => {
  assert.deepEqual(await buildNeighbourTable(ARTICLES, { encoder: encoder(), k: 2 }), EXPECTED);
});

test('le fonds est encodé en un seul appel et en entier', async () => {
  const fake = encoder();
  await buildNeighbourTable(ARTICLES, { encoder: fake });
  assert.deepEqual(fake.calls, [ARTICLES.map(articleText)]);
});

test('une chaîne par article, titre puis corps', () => {
  assert.equal(articleText(ARTICLES[0]), 'Keeping a sourdough starter alive. Feeding flour and water to a sourdough starter, and reading its smell.');
});

test('unit normalise et laisse le vecteur nul intact', () => {
  assert.deepEqual(unit([3, 4]), [0.6, 0.8]);
  assert.deepEqual(unit([0, 0]), [0, 0]);
});

test('les égalités sont départagées par l’identifiant', async () => {
  const tie = ['z', 'b', 'm'].map((id) => ({ id, title: 'a', body: 'b' }));
  assert.deepEqual((await buildNeighbourTable(tie, { encoder: encoder() })).z, [['b', 1], ['m', 1]]);
});

test('un fonds trop petit pour une paire n’atteint jamais le modèle', async () => {
  const fake = encoder();
  assert.deepEqual(await buildNeighbourTable([ARTICLES[0]], { encoder: fake }), { 'sourdough-starter': [] });
  assert.deepEqual(await buildNeighbourTable([], { encoder: fake }), {});
  assert.deepEqual(fake.calls, []);
});

test('k borne la longueur de chaque ligne', async () => {
  assert.deepEqual((await buildNeighbourTable(ARTICLES, { encoder: encoder(), k: 1 }))['sourdough-starter'], [['rye-bread', 0.416]]);
});

test('un modèle qui ne peut pas tourner lève', async () => {
  await assert.rejects(() => buildNeighbourTable(ARTICLES, { encoder: brokenEncoder }), EncodingFailed);
});

test('un lot tronqué lève plutôt que de décaler chaque voisin', async () => {
  await assert.rejects(() => buildNeighbourTable(ARTICLES, { encoder: new TruncatedEncoder(256) }), EncodingFailed);
});

test('des vecteurs inutilisables lèvent', async () => {
  const nan = { encode: async (texts) => texts.map(() => [NaN, NaN, NaN]) };
  const ragged = { encode: async (texts) => texts.map((_, i) => (i === texts.length - 1 ? [1, 0, 5] : [1, 0])) };
  for (const bad of [nan, ragged]) {
    await assert.rejects(() => buildNeighbourTable(ARTICLES, { encoder: bad }), EncodingFailed);
  }
});

test('constat : le double ne comble pas le trou des deux langues', async () => {
  const two = [
    { id: 'en', title: 'Keeping a sourdough starter alive', body: 'Feed the starter twice a day.' },
    { id: 'fr', title: 'Entretenir un levain naturel', body: 'Nourrissez-le deux fois par jour.' },
    { id: 'x', title: 'Other', body: 'thing' },
  ];
  const row = new Map((await buildNeighbourTable(two, { encoder: encoder(), minimum: -1 })).en);
  assert.equal(row.get('fr'), 0);
});

test('scénario : la table a la même forme qu’en N0 et N1', async () => {
  for (const table of [await buildNeighbourTable(ARTICLES, { encoder: encoder() }), buildN1(ARTICLES)]) {
    assert.deepEqual(Object.keys(table).sort(), ARTICLES.map((a) => a.id).sort());
    for (const row of Object.values(table)) {
      assert.ok(row.every((n) => Array.isArray(n) && typeof n[0] === 'string' && typeof n[1] === 'number'));
    }
  }
  // Constat : ici la construction rend une promesse, là une valeur.
  assert.ok(buildNeighbourTable(ARTICLES, { encoder: encoder() }) instanceof Promise);
});

test('le modèle nommé est multilingue', () => {
  assert.equal(MODEL_NAME, 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');
});

test('le modèle par défaut a la surface de @huggingface/transformers', async () => {
  globalThis.__transformersLoads.length = 0;
  assert.deepEqual(await buildNeighbourTable(ARTICLES, { k: 2 }), EXPECTED);
  assert.deepEqual(globalThis.__transformersLoads, [['feature-extraction', MODEL_NAME]]);
});

test('INFIRMÉ : le modèle reste chargé entre deux constructions', async () => {
  await assert.rejects(async () => {
    globalThis.__transformersLoads.length = 0;
    await buildNeighbourTable(ARTICLES);
    await buildNeighbourTable(ARTICLES);
    assert.equal(globalThis.__transformersLoads.length, 1);
  });
});

test('deux constructions rendent la même table', async () => {
  assert.deepEqual(
    await buildNeighbourTable(ARTICLES, { encoder: encoder() }),
    await buildNeighbourTable(ARTICLES, { encoder: encoder() }),
  );
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : trois cents articles', async () => {
  const corpus = Array.from({ length: 300 }, (_, i) => ({
    id: `a${String(i).padStart(4, '0')}`, title: `title ${i}`, body: `${'word '.repeat(20)}w${i % 37}`,
  }));
  const started = Date.now();
  assert.equal(Object.keys(await buildNeighbourTable(corpus, { encoder: encoder() })).length, 300);
  assert.ok(Date.now() - started < 60_000);
});

test('production : le texte part tel quel, NFD, insécable, emoji', async () => {
  const fake = encoder();
  await buildNeighbourTable([{ ...ARTICLES[0], title: 'Pâte à crêpes 🥞﻿' }, ARTICLES[1]], { encoder: fake });
  assert.ok(fake.calls[0][0].startsWith('Pâte à crêpes 🥞﻿. '));
});

test('production : limites k nul et score égal au minimum', async () => {
  assert.deepEqual(await buildNeighbourTable(ARTICLES, { encoder: encoder(), k: 0 }), Object.fromEntries(ARTICLES.map((a) => [a.id, []])));
  assert.deepEqual((await buildNeighbourTable(ARTICLES, { encoder: encoder(), minimum: 0.416 }))['rye-bread'], []);
  assert.deepEqual((await buildNeighbourTable(ARTICLES, { encoder: encoder(), minimum: 0.415 }))['rye-bread'], [['sourdough-starter', 0.416]]);
});
