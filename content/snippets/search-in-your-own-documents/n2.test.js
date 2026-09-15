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
 * Le chargement par défaut importe '@huggingface/transformers'. Un crochet de
 * résolution, posé ci-dessous pour ce seul processus de test, remplace ce
 * paquet par un module à la surface de la bibliothèque publiée : `pipeline`
 * rend une fonction dont le résultat (un tenseur) a `.tolist()`. Il compte les
 * chargements réussis et les tentatives ; le chargement est gardé au niveau du
 * module de l'extrait, donc les tests qui l'exercent s'enchaînent dans l'ordre
 * du fichier.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { FakeEncoder } from '../_harness/fake-model.mjs';
import { buildIndex as buildIndexN0, search as searchN0 } from './n0.js';
import { EncodingFailed, MODEL_NAME, hybridSearch, unit, vectorRanking } from './n2.js';

globalThis.__transformersLoads = [];
globalThis.__transformersAttempts = 0;
globalThis.__transformersFailNext = false;
globalThis.__transformersOptions = [];
const FAKE_TRANSFORMERS = `
  import { FakeEncoder } from ${JSON.stringify(new URL('../_harness/fake-model.mjs', import.meta.url).href)};
  export async function pipeline(task, model) {
    globalThis.__transformersAttempts += 1;
    if (globalThis.__transformersFailNext) {
      globalThis.__transformersFailNext = false;
      throw new Error('could not download the weights');
    }
    globalThis.__transformersLoads.push([task, model]);
    const fake = new FakeEncoder(1024);
    return async (batch, options) => {
      globalThis.__transformersOptions.push(options);
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
  // « la page de tête a le même score pour cette question que pour une question
  // à laquelle le manuel répond. Un seuil devrait porter sur le cosinus, que
  // l’extrait ne rend pas ».
  const offTopic = (await hybridSearch(WALLS, HANDBOOK, [], { encoder: encoder() }))[0].score;
  const keys = new Set((await hybridSearch(WALLS, HANDBOOK, [], { encoder: encoder() })).flatMap(Object.keys));
  assert.deepEqual([...keys], ['id', 'score']);
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

test('des vecteurs inutilisables lèvent EncodingFailed', async () => {
  // « vectors of different sizes, or values that are not finite numbers » :
  // NaN, infini, dimensions incohérentes, valeur non numérique.
  const nan = tableEncoder({}, [NaN, NaN, NaN]);
  const infinite = tableEncoder({}, [Infinity, 0]);
  const ragged = tableEncoder({ quoi: [1, 0, 5] }, [1, 0]);
  const text = tableEncoder({ quoi: [1, 0] }, [1, 'beaucoup']);
  for (const bad of [nan, infinite, ragged, text]) {
    await assert.rejects(() => hybridSearch('quoi', HANDBOOK, [], { encoder: bad }), EncodingFailed);
  }
});

test('un encodeur qui a rendu des vecteurs inutilisables ne garde rien en cache', async () => {
  class Flaky extends FakeEncoder {
    broken = true;

    async encode(texts) {
      const vectors = await super.encode(texts);
      if (this.broken) {
        this.broken = false;
        vectors[0] = new Array(this.dimensions).fill(NaN);
      }
      return vectors;
    }
  }
  const flaky = new Flaky(1024);
  await assert.rejects(() => hybridSearch('frais', HANDBOOK, [], { encoder: flaky }), EncodingFailed);
  assert.equal((await hybridSearch('frais', HANDBOOK, [], { encoder: flaky })).length, 4);
  assert.equal(flaky.calls[1].length, 5);
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

test('plus bas dans la liste, chaque jambe pèse autant que l’autre', async () => {
  // docstring : « further down the list, each leg weighs as much as the other ».
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

test('production : un chargement du modèle qui échoue est retenté à la recherche suivante', async () => {
  // Commentaire : « a failed load is tried again on the next search ». Premier
  // test du fichier à charger le modèle par défaut. Constat : l’échec sort tel
  // quel, pas en EncodingFailed.
  assert.equal(globalThis.__transformersAttempts, 0);
  globalThis.__transformersFailNext = true;
  await assert.rejects(() => hybridSearch('notes de frais', HANDBOOK, ['frais']), (error) => !(error instanceof EncodingFailed) && /could not download/.test(error.message));
  assert.equal((await hybridSearch('notes de frais', HANDBOOK, ['frais'])).length, 4);
  assert.equal(globalThis.__transformersAttempts, 2);
  assert.equal(globalThis.__transformersLoads.length, 1);
});

test('le modèle par défaut a la surface de @huggingface/transformers', async () => {
  const found = await hybridSearch('notes de frais', HANDBOOK, ['frais']);
  assert.deepEqual(found, await hybridSearch('notes de frais', HANDBOOK, ['frais'], { encoder: encoder() }));
  assert.deepEqual(globalThis.__transformersLoads[0], ['feature-extraction', MODEL_NAME]);
  assert.deepEqual(globalThis.__transformersOptions.at(-1), { pooling: 'mean' });
});

test('production : le modèle par défaut est chargé une fois par processus', async () => {
  // docstring : « Loaded once per process, then kept warm ».
  await hybridSearch('notes de frais', HANDBOOK, ['frais']);
  await hybridSearch('télétravail', HANDBOOK, ['teletravail']);
  assert.equal(globalThis.__transformersLoads.length, 1);
});

test('production : le fonds n’est pas ré-encodé à chaque requête', async () => {
  // « a document is encoded again only once its text has changed ».
  const fake = encoder();
  await hybridSearch('notes de frais', HANDBOOK, [], { encoder: fake });
  await hybridSearch('télétravail', HANDBOOK, [], { encoder: fake });
  const first = `${HANDBOOK[0].title} ${HANDBOOK[0].body}`;
  assert.equal(fake.calls.flat().filter((text) => text === first).length, 1);
  assert.deepEqual(fake.calls[1], ['télétravail']);
});

test('DÉFAUT : un vecteur refusé empoisonne le cache d’un encodeur déjà servi', async () => {
  // Un encodeur a déjà servi une recherche ; à la suivante, le vecteur d’une
  // page nouvelle est refusé (NaN). vectorRanking a déjà écrit ce vecteur dans
  // la Map gardée pour l’encodeur (known.set avant la vérification) : la page
  // n’est plus jamais ré-encodée, et chaque recherche qui la contient lève
  // EncodingFailed. Le Python construit un nouveau dictionnaire et répond.
  class FlakyOnSecondCall extends FakeEncoder {
    count = 0;

    async encode(texts) {
      const vectors = await super.encode(texts);
      this.count += 1;
      if (this.count === 2) vectors[0] = new Array(this.dimensions).fill(NaN);
      return vectors;
    }
  }
  const flaky = new FlakyOnSecondCall(1024);
  await hybridSearch('frais', HANDBOOK.slice(0, 1), [], { encoder: flaky });
  await assert.rejects(() => hybridSearch('frais', HANDBOOK.slice(0, 2), [], { encoder: flaky }), EncodingFailed);
  await assert.rejects(async () => {
    assert.equal((await hybridSearch('frais', HANDBOOK.slice(0, 2), [], { encoder: flaky })).length, 2);
    assert.deepEqual(flaky.calls[2], [`${HANDBOOK[1].title} ${HANDBOOK[1].body}`, 'frais']);
  });
});

test('production : un document modifié est ré-encodé, et lui seul', async () => {
  const fake = encoder();
  await hybridSearch('frais', HANDBOOK, [], { encoder: fake });
  const changed = [{ ...HANDBOOK[0], body: 'Vingt-cinq jours ouvrés par an.' }, ...HANDBOOK.slice(1)];
  const found = await hybridSearch('frais', changed, [], { encoder: fake });
  assert.deepEqual(fake.calls[1], ['Congés payés Vingt-cinq jours ouvrés par an.', 'frais']);
  assert.deepEqual(found, await hybridSearch('frais', changed, [], { encoder: encoder() }));
});

test('production : deux documents au même texte ne partent qu’une fois', async () => {
  const fake = encoder();
  const twins = [...HANDBOOK, { ...HANDBOOK[2], id: 'frais-copie' }];
  const found = await hybridSearch('frais', twins, [], { encoder: fake });
  assert.equal(fake.calls[0].length, 5);
  assert.ok(ids(found).includes('frais') && ids(found).includes('frais-copie'));
});

test('production : le cache ne garde que les textes de la dernière recherche', async () => {
  const fake = encoder();
  await hybridSearch('frais', HANDBOOK, [], { encoder: fake });
  await hybridSearch('frais', HANDBOOK.slice(1), [], { encoder: fake });
  await hybridSearch('frais', HANDBOOK, [], { encoder: fake });
  assert.deepEqual(fake.calls[1], ['frais']);
  assert.deepEqual(fake.calls[2], [`${HANDBOOK[0].title} ${HANDBOOK[0].body}`, 'frais']);
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
