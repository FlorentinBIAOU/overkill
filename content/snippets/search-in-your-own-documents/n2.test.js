/**
 * Ces tests injectent un double local au lieu de charger un vrai encodeur.
 *
 * Ce qu'ils prouvent : le fonds et la requête partent en un seul appel, un
 * encodeur qui tombe ou rend le mauvais nombre de vecteurs lève, les deux
 * classements sont fusionnés comme annoncé, et la fusion est déterministe
 * jusque dans ses égalités. Les scores sont ceux de n2.test.py.
 *
 * Ce qu'ils ne prouvent pas : qu'un vrai encodeur rapproche « vacances » de
 * « congés payés ». C'est pourquoi la fiche déclare `verification: stubbed`.
 *
 * Le chargement par défaut importe '@xenova/transformers'. Un crochet de
 * résolution, posé ci-dessous pour ce seul processus de test, remplace ce
 * paquet par un module à la surface de la bibliothèque publiée : `pipeline`
 * rend une fonction dont le résultat a `.tolist()`. Il compte les chargements.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { FakeEncoder } from '../_harness/fake-model.mjs';
import { buildIndex as buildIndexN0, search as searchN0 } from './n0.js';
import { EncodingFailed, MODEL_NAME, hybridSearch, unit, vectorRanking } from './n2.js';

globalThis.__transformersLoads = [];
const FAKE_TRANSFORMERS = `
  import { FakeEncoder } from ${JSON.stringify(new URL('../_harness/fake-model.mjs', import.meta.url).href)};
  export async function pipeline(task, model) {
    globalThis.__transformersLoads.push([task, model]);
    const fake = new FakeEncoder(1024);
    return async (batch, options) => {
      const vectors = await fake.encode(batch);
      return { options, tolist: () => vectors };
    };
  }`;
const HOOKS = `export async function resolve(specifier, context, next) {
  if (specifier === '@xenova/transformers') {
    return { url: 'data:text/javascript,' + encodeURIComponent(${JSON.stringify(FAKE_TRANSFORMERS)}), shortCircuit: true };
  }
  return next(specifier, context);
}`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const HANDBOOK = [
  {
    id: 'conges',
    title: 'Congés payés',
    body: 'Le salarié acquiert deux jours et demi de congés payés par mois travaillé. '
      + 'Le solde figure sur le bulletin de paie. Le télétravail ne change rien à ce '
      + 'calcul, et une journée de télétravail reste une journée travaillée.',
  },
  {
    id: 'teletravail',
    title: 'Télétravail',
    body: 'Deux jours par semaine sont ouverts, après accord écrit du responsable.',
  },
  {
    id: 'frais',
    title: 'Notes de frais',
    body: 'Les notes de frais se déposent avant le cinq du mois. Le remboursement suit '
      + 'la paie du mois suivant.',
  },
  {
    id: 'materiel',
    title: 'Matériel informatique',
    body: 'Le poste de travail est renouvelé tous les quatre ans. La demande passe par '
      + 'le responsable.',
  },
];

const WALLS = 'quelle est la couleur des murs du bureau';

const encoder = () => new FakeEncoder(1024);

/** Le synonyme est écrit ici, pas appris. */
class SynonymEncoder extends FakeEncoder {
  static SYNONYMS = { maison: 'télétravail' };

  async encode(texts) {
    const expanded = texts.map((text) => text.split(' ')
      .map((word) => SynonymEncoder.SYNONYMS[word.toLowerCase()] ?? word).join(' '));
    return super.encode(expanded);
  }
}

/** Un modèle qui perd en silence le dernier élément d'un lot. */
class TruncatedEncoder extends FakeEncoder {
  async encode(texts) {
    return (await super.encode(texts)).slice(0, -1);
  }
}

/** Un modèle qui ne peut pas tourner du tout. */
const brokenEncoder = {
  encode: async () => {
    throw new Error('out of memory while loading the model');
  },
};

/** Un encodeur dont chaque vecteur est posé à la main, par mot-clé du texte. */
const tableEncoder = (table, fallback) => ({
  encode: async (texts) => texts.map((text) => Object.entries(table).find(([key]) => text.includes(key))?.[1] ?? fallback),
});

const ids = (results) => results.map((result) => result.id);

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : la jambe vectorielle a toujours une réponse', async () => {
  const keywordIds = ids(searchN0(buildIndexN0(HANDBOOK), WALLS));
  assert.deepEqual(keywordIds, []);
  assert.equal((await vectorRanking(WALLS, HANDBOOK, encoder())).length, 4);
  const found = await hybridSearch(WALLS, HANDBOOK, keywordIds, { encoder: encoder() });
  assert.equal(found.length, 4);
  assert.equal(found[0].id, 'frais');
});

test('point de rupture : aucun résultat n’existe plus, même pour une requête vide ou absurde', async () => {
  for (const query of ['', 'zzzz qwxv', '🦄']) {
    assert.equal((await hybridSearch(query, HANDBOOK, [], { encoder: encoder() })).length, 4);
  }
});

test('point de rupture : c’est le double qui désigne la page en tête', async () => {
  const heads = {};
  for (const d of [8, 16, 32, 1024]) {
    heads[d] = (await hybridSearch(WALLS, HANDBOOK, [], { encoder: new FakeEncoder(d) }))[0].id;
  }
  assert.deepEqual(heads, { 8: 'conges', 16: 'teletravail', 32: 'materiel', 1024: 'frais' });
});

test('point de rupture : aucun seuil ne peut se poser sur le score fusionné', async () => {
  const offTopic = (await hybridSearch(WALLS, HANDBOOK, [], { encoder: encoder() }))[0].score;
  const onTopic = (await hybridSearch('notes de frais', HANDBOOK, [], { encoder: encoder() }))[0].score;
  assert.equal(offTopic, onTopic);
  assert.equal(offTopic, Math.round(1e6 / 61) / 1e6);
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('un document que les deux jambes mettent en tête gagne', async () => {
  const keywordIds = ids(searchN0(buildIndexN0(HANDBOOK), 'notes de frais'));
  assert.deepEqual(keywordIds, ['frais']);
  assert.deepEqual(await hybridSearch('notes de frais', HANDBOOK, keywordIds, { encoder: encoder() }), [
    { id: 'frais', score: 0.032787 },
    { id: 'conges', score: 0.016129 },
    { id: 'materiel', score: 0.015873 },
    { id: 'teletravail', score: 0.015625 },
  ]);
});

test('chaque liste vote par un sur k plus rang', async () => {
  const found = Object.fromEntries((await hybridSearch('notes de frais', HANDBOOK, ['materiel'], { encoder: encoder() })).map((r) => [r.id, r.score]));
  const ranking = await vectorRanking('notes de frais', HANDBOOK, encoder());
  ranking.forEach((id, i) => {
    const expected = 1 / (60 + i + 1) + (id === 'materiel' ? 1 / 61 : 0);
    assert.equal(found[id], Math.round(expected * 1e6) / 1e6);
  });
});

test('k dit ce que vaut la première place', async () => {
  const found = await hybridSearch('notes de frais', HANDBOOK, ['frais'], { encoder: encoder(), k: 0 });
  assert.deepEqual(found[0], { id: 'frais', score: 2 });
});

test('rien n’a à être remis à l’échelle', async () => {
  class Scaled extends FakeEncoder {
    async encode(texts) {
      return (await super.encode(texts)).map((v) => v.map((x) => 1000 * x));
    }
  }
  assert.deepEqual(
    await hybridSearch('notes de frais', HANDBOOK, ['frais'], { encoder: new Scaled(1024) }),
    await hybridSearch('notes de frais', HANDBOOK, ['frais'], { encoder: encoder() }),
  );
});

test('unit normalise une fois et laisse le vecteur nul intact', () => {
  assert.deepEqual(unit([3, 4]), [0.6, 0.8]);
  assert.deepEqual(unit([0, 0]), [0, 0]);
});

test('les égalités sont départagées par l’identifiant', async () => {
  const shuffled = [HANDBOOK[2], HANDBOOK[0], HANDBOOK[3], HANDBOOK[1]];
  assert.deepEqual(await vectorRanking('x', shuffled, tableEncoder({}, [0, 0])), ['conges', 'frais', 'materiel', 'teletravail']);
});

test('le fonds et la requête partent en un seul appel', async () => {
  const fake = encoder();
  await hybridSearch('notes de frais', HANDBOOK, [], { encoder: fake });
  const texts = HANDBOOK.map((d) => `${d.title} ${d.body}`);
  assert.deepEqual(fake.calls, [[...texts, 'notes de frais']]);
});

test('un fonds vide n’atteint jamais le modèle', async () => {
  const fake = encoder();
  assert.deepEqual(await hybridSearch('notes de frais', [], [], { encoder: fake }), []);
  assert.deepEqual(fake.calls, []);
});

test('la limite est respectée', async () => {
  const found = await hybridSearch('frais', HANDBOOK, ['frais'], { encoder: encoder(), limit: 2 });
  assert.equal(found.length, 2);
});

test('un lot tronqué lève plutôt que de perdre un document', async () => {
  await assert.rejects(() => hybridSearch('frais', HANDBOOK, [], { encoder: new TruncatedEncoder(1024) }), EncodingFailed);
});

test('un modèle qui ne peut pas tourner lève', async () => {
  await assert.rejects(() => hybridSearch('frais', HANDBOOK, [], { encoder: brokenEncoder }), EncodingFailed);
});

test('INFIRMÉ : des vecteurs inutilisables lèvent EncodingFailed', async () => {
  // NaN, ou dimensions incohérentes : un classement complet revient sans erreur.
  await assert.rejects(async () => {
    const nan = tableEncoder({}, [NaN, NaN, NaN]);
    const ragged = tableEncoder({ quoi: [1, 0, 5] }, [1, 0]);
    for (const bad of [nan, ragged]) {
      await assert.rejects(() => hybridSearch('quoi', HANDBOOK, [], { encoder: bad }), EncodingFailed);
    }
  });
});

test('la jambe vectorielle trouve ce que les mots ne trouvaient pas', async () => {
  const question = 'puis-je rester à la maison';
  assert.deepEqual(searchN0(buildIndexN0(HANDBOOK), question), []);
  assert.equal((await vectorRanking(question, HANDBOOK, encoder())).at(-1), 'teletravail');
  const found = await hybridSearch(question, HANDBOOK, [], { encoder: new SynonymEncoder(1024) });
  assert.deepEqual(ids(found).slice(0, 2), ['conges', 'teletravail']);
});

test('la tête du plein texte reste devant tout document qu’il n’a pas trouvé', async () => {
  const table = tableEncoder({ informatique: [-1, 0], Congés: [1, 0], QUESTION: [1, 0] }, [0, 1]);
  const found = await hybridSearch('QUESTION', HANDBOOK, ['materiel'], { encoder: table });
  assert.deepEqual(ids(found).slice(0, 2), ['materiel', 'conges']);
});

test('constat : plus bas dans la liste, un document sans aucun mot passe devant un document trouvé', async () => {
  const documents = [];
  for (let i = 0; i < 285; i += 1) documents.push({ id: `autre${String(i).padStart(3, '0')}`, title: 'autre', body: '' });
  const keywordIds = [];
  for (let i = 1; i <= 14; i += 1) {
    const id = `k${String(i).padStart(2, '0')}`;
    documents.push({ id, title: 'exact', body: '' });
    keywordIds.push(id);
  }
  documents.push({ id: 'intrus', title: 'intrus', body: '' });
  const table = tableEncoder({ exact: [-1, 0], intrus: [1, 0], QUESTION: [1, 0] }, [0, 1]);
  const order = ids(await hybridSearch('QUESTION', documents, keywordIds, { encoder: table, limit: 300 }));
  assert.ok(order.indexOf('k13') < order.indexOf('intrus'));
  assert.ok(order.indexOf('intrus') < order.indexOf('k14'));
});

test('le modèle nommé est multilingue', () => {
  assert.equal(MODEL_NAME, 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');
});

test('le modèle par défaut a la surface de @xenova/transformers', async () => {
  globalThis.__transformersLoads.length = 0;
  const found = await hybridSearch('notes de frais', HANDBOOK, ['frais']);
  assert.deepEqual(found, await hybridSearch('notes de frais', HANDBOOK, ['frais'], { encoder: encoder() }));
  assert.deepEqual(globalThis.__transformersLoads[0], ['feature-extraction', MODEL_NAME]);
});

test('DÉFAUT : le modèle par défaut est rechargé à chaque recherche', async () => {
  await assert.rejects(async () => {
    globalThis.__transformersLoads.length = 0;
    await hybridSearch('notes de frais', HANDBOOK, ['frais']);
    await hybridSearch('télétravail', HANDBOOK, ['teletravail']);
    assert.equal(globalThis.__transformersLoads.length, 1);
  });
});

test('DÉFAUT : le fonds est ré-encodé à chaque requête', async () => {
  await assert.rejects(async () => {
    const fake = encoder();
    await hybridSearch('notes de frais', HANDBOOK, [], { encoder: fake });
    await hybridSearch('télétravail', HANDBOOK, [], { encoder: fake });
    const first = `${HANDBOOK[0].title} ${HANDBOOK[0].body}`;
    assert.equal(fake.calls.flat().filter((text) => text === first).length, 1);
  });
});

test('deux exécutions rendent le même classement', async () => {
  assert.deepEqual(
    await hybridSearch(WALLS, HANDBOOK, [], { encoder: encoder() }),
    await hybridSearch(WALLS, HANDBOOK, [], { encoder: encoder() }),
  );
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : limite zéro et k nul', async () => {
  assert.deepEqual(await hybridSearch('frais', HANDBOOK, ['frais'], { encoder: encoder(), limit: 0 }), []);
  assert.equal((await hybridSearch('frais', HANDBOOK, ['frais'], { encoder: encoder(), k: 0 }))[0].score, 2);
});

test('production : dix mille pages', async () => {
  const docs = Array.from({ length: 10_000 }, (_, i) => ({
    id: `d${String(i).padStart(5, '0')}`,
    title: `Page ${i}`,
    body: 'le salarié acquiert deux jours de congés payés par mois '.repeat(5),
  }));
  const started = Date.now();
  const found = await hybridSearch('congés', docs, ['d00001'], { encoder: new FakeEncoder(64) });
  assert.equal(found[0].id, 'd00001');
  assert.ok(Date.now() - started < 30_000);
});

test('production : la requête part telle quelle, NFD, espace insécable, emoji', async () => {
  const fake = encoder();
  const query = 'congés payés 🌴﻿';
  assert.equal((await hybridSearch(query, HANDBOOK, [], { encoder: fake })).length, 4);
  assert.equal(fake.calls[0].at(-1), query);
});

test('production : un identifiant du plein texte absent du fonds ressort quand même', async () => {
  const found = await hybridSearch('x', HANDBOOK, ['supprime'], { encoder: encoder() });
  assert.ok(ids(found).includes('supprime'));
});
