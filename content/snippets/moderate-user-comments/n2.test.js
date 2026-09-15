/**
 * Ces tests injectent un double local au lieu de charger le vrai modèle.
 *
 * Ce qu'ils prouvent : le lot part en un appel, les notes deviennent la bonne
 * décision, les seuils sont respectés, une réponse inexploitable part chez un
 * humain. Ce qu'ils ne prouvent pas : que le modèle note bien les commentaires.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeClassifier } from '../_harness/fake-model.mjs';
import { DEFAULT_THRESHOLDS, MODEL_NAME, ModerationUnavailable, ToxicityModel, moderate } from './n2.js';
import essai from '../../tryouts/frozen/moderate-user-comments.js';

const ATTACK = 'get off this forum you blorptard';
const BORDERLINE = 'that was a spectacularly bad take, honestly';
const CALM = 'the diagram is much clearer than the text';
const DOXXING = 'he lives at the corner of rue des Lilas by the way, go and say hello';

const SCORES = {
  [ATTACK]: { toxicity: 0.96, insult: 0.91, threat: 0.04 },
  [BORDERLINE]: { toxicity: 0.71, insult: 0.35, threat: 0.01 },
  [CALM]: { toxicity: 0.02, insult: 0.01, threat: 0 },
};

// ---------------------------------------------------------------------------
// Point de rupture (plomberie seulement)
// ---------------------------------------------------------------------------

test('point de rupture : un préjudice sans étiquette, noté bas partout, part en publication', async () => {
  const classifier = new FakeClassifier({ [DOXXING]: { toxicity: 0.08, insult: 0.03, threat: 0.06 } });
  assert.deepEqual(await moderate([DOXXING], classifier), [{ action: 'allow', label: 'toxicity', score: 0.08 }]);
  assert.equal((await moderate([ATTACK], new FakeClassifier(SCORES)))[0].action, 'block');
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('oriente chaque commentaire vers sa décision', async () => {
  const decisions = await moderate([ATTACK, BORDERLINE, CALM], new FakeClassifier(SCORES));
  assert.deepEqual(decisions.map((d) => d.action), ['block', 'review', 'allow']);
});

test("garde l'étiquette la plus forte pour que le relecteur sache pourquoi", async () => {
  assert.deepEqual((await moderate([ATTACK], new FakeClassifier(SCORES)))[0], { action: 'block', label: 'toxicity', score: 0.96 });
});

test('deux seuils, une bande pour un humain', async () => {
  assert.deepEqual(DEFAULT_THRESHOLDS, { block: 0.9, review: 0.6 });
  const rows = { a: { toxicity: 0.9 }, b: { toxicity: 0.8999 }, c: { toxicity: 0.6 }, d: { toxicity: 0.5999 } };
  const decisions = await moderate(Object.keys(rows), new FakeClassifier(rows));
  assert.deepEqual(decisions.map((d) => d.action), ['block', 'review', 'review', 'allow']);
});

test('le lot entier part en un appel', async () => {
  const classifier = new FakeClassifier(SCORES);
  await moderate([ATTACK, BORDERLINE, CALM], classifier);
  assert.deepEqual(classifier.calls, [[ATTACK, BORDERLINE, CALM]]);
});

test("les seuils sont à l'appelant", async () => {
  const [strict] = await moderate([BORDERLINE], new FakeClassifier(SCORES), { block: 0.7, review: 0.3 });
  const [lenient] = await moderate([BORDERLINE], new FakeClassifier(SCORES), { block: 0.99, review: 0.95 });
  assert.equal(strict.action, 'block');
  assert.equal(lenient.action, 'allow');
});

test('une ligne inexploitable part chez un humain plutôt que publiée', async () => {
  const rows = { a: {}, b: { toxicity: 'very' }, c: null, d: { toxicity: NaN }, e: { toxicity: true }, f: { toxicity: 1.5 }, g: { toxicity: -0.1 } };
  const decisions = await moderate(Object.keys(rows), new FakeClassifier(rows));
  for (const decision of decisions) assert.deepEqual(decision, { action: 'review', label: null, score: null });
});

test('une réponse de mauvaise longueur lève plutôt que de décaler les commentaires', async () => {
  const short = { predict: async () => [{ toxicity: 0.99 }] };
  const long = { predict: async (c) => new Array(c.length + 1).fill({ toxicity: 0.1 }) };
  for (const classifier of [short, long]) {
    await assert.rejects(() => moderate([ATTACK, CALM], classifier), ModerationUnavailable);
  }
});

test("le test existant s'appelle « an empty batch never reaches the model » ; le modèle est appelé avec []", async () => {
  const classifier = new FakeClassifier(SCORES);
  assert.deepEqual(await moderate([], classifier), []);
  assert.deepEqual(classifier.calls, []);
});

test("le classifieur est injecté, et par défaut c'est le vrai", async () => {
  await assert.rejects(() => moderate([CALM]), { code: 'ERR_MODULE_NOT_FOUND', message: /@huggingface\/transformers/ });
  assert.equal(MODEL_NAME, 'Xenova/toxic-bert');
});

test('predict demande toutes les étiquettes et rend une ligne par commentaire', async () => {
  const seen = [];
  const pipe = async (comments, options) => {
    seen.push(options);
    return comments.map(() => [{ label: 'toxic', score: 0.9 }, { label: 'insult', score: 0.1 }]);
  };
  const model = new ToxicityModel(pipe);
  assert.deepEqual(await model.predict([ATTACK, CALM]), [{ toxic: 0.9, insult: 0.1 }, { toxic: 0.9, insult: 0.1 }]);
  assert.deepEqual(seen, [{ top_k: null }]);
});

test('« The real model, loaded once and kept in memory for the process » ; moderate sans classifieur recharge à chaque appel', async () => {
  const original = ToxicityModel.load;
  let loads = 0;
  ToxicityModel.load = async () => {
    loads += 1;
    return { predict: async (c) => c.map(() => ({ toxic: 0 })) };
  };
  try {
    await moderate([CALM]);
    await moderate([CALM]);
  } finally {
    ToxicityModel.load = original;
  }
  assert.equal(loads, 1);
});

test("DÉFAUT : une ligne d'une autre forme ({label, score}) devient une décision étiquetée « score »", async () => {
  const rows = { [ATTACK]: { label: 'toxic', score: 0.95 } };
  const [decision] = await moderate([ATTACK], new FakeClassifier(rows));
  assert.deepEqual(decision, { action: 'block', label: 'score', score: 0.95 });
  await assert.rejects(async () => {
    assert.equal(decision.action, 'review');
  }, assert.AssertionError);
});

test("l'essai figé : six cas, une note la plus forte, des seuils, un cas inexploitable, l'adresse publiée", async () => {
  assert.equal(essai.cases.length, 6);
  const verdicts = [];
  for (const cas of essai.cases) {
    const out = await essai.run(cas.input.fr, 'fr', cas);
    verdicts.push(out.verdict.label);
    assert.match(out.note, /Un appel pour le lot/);
  }
  assert.deepEqual(verdicts, ['Bloqué, jamais publié', 'Publié', 'Mis de côté pour un humain', 'Bloqué, jamais publié', 'Mis de côté pour un humain', 'Publié']);
  const first = await essai.run(essai.cases[0].input.en, 'en', essai.cases[0]);
  assert.equal(first.verdict.detail, 'Strongest score: “toxicity” at 0.96.');
  assert.equal(essai.cases[5].fails, true);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : mille commentaires en un lot', async () => {
  const comments = Array.from({ length: 1000 }, (_, i) => `comment ${i}`);
  const classifier = new FakeClassifier({}, { toxicity: 0.1 });
  const start = performance.now();
  const decisions = await moderate(comments, classifier);
  assert.ok(performance.now() - start < 2000);
  assert.equal(decisions.length, 1000);
  assert.equal(classifier.calls.length, 1);
});

test('production : égalité entre étiquettes, la première gagne', async () => {
  const rows = { x: { insult: 0.7, toxicity: 0.7 } };
  assert.equal((await moderate(['x'], new FakeClassifier(rows)))[0].label, 'insult');
});

test('production : commentaires vides, NFD, emoji passent au classifieur tels quels', async () => {
  const comments = ['', 'quel flarnwît', '🙂', '﻿hello'];
  const classifier = new FakeClassifier({}, { toxicity: 0.2 });
  assert.deepEqual((await moderate(comments, classifier)).map((d) => d.action), ['allow', 'allow', 'allow', 'allow']);
  assert.deepEqual(classifier.calls, [comments]);
});
