/**
 * Ces tests injectent un double local au lieu de charger le vrai modèle.
 *
 * Ce qu'ils prouvent : le lot part en un appel, les notes deviennent la bonne
 * décision, les seuils sont respectés, une réponse inexploitable part chez un
 * humain. Ce qu'ils ne prouvent pas : que le modèle note bien les commentaires.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { FakeClassifier } from '../_harness/fake-model.mjs';
import {
  DEFAULT_THRESHOLDS,
  ENGLISH,
  HARM_LABELS,
  MODEL_NAME,
  MULTILINGUAL,
  ModerationUnavailable,
  ToxicityModel,
  moderate,
} from './n2.js';
import essai from '../../tryouts/frozen/moderate-user-comments.js';

const ATTACK = 'get off this forum you blorptard';
const BORDERLINE = 'that was a spectacularly bad take, honestly';
const CALM = 'the diagram is much clearer than the text';
const DOXXING = 'he lives at the corner of rue des Lilas by the way, go and say hello';

// Double du module « @huggingface/transformers » : l'extrait l'importe au premier
// chargement ; ce crochet de résolution le remplace par un module qui délègue à
// une fonction posée par le test. Surface imitée : `pipeline(tâche, modèle,
// options)` rend un pipeline, `pipe(commentaires, { top_k })` une liste de listes
// de `{ label, score }`.
const FAUX_TRANSFORMERS = 'export async function pipeline(...args) { return globalThis.fauxPipeline(...args); }';
const CROCHET = `export async function resolve(specifier, context, next) {
  if (specifier === '@huggingface/transformers') {
    return { url: 'data:text/javascript,' + encodeURIComponent(${JSON.stringify(FAUX_TRANSFORMERS)}), shortCircuit: true };
  }
  return next(specifier, context);
}`;
register(`data:text/javascript,${encodeURIComponent(CROCHET)}`);

const SCORES = {
  [ATTACK]: { toxicity: 0.96, insult: 0.91, threat: 0.04 },
  [BORDERLINE]: { toxicity: 0.71, insult: 0.35, threat: 0.01 },
  [CALM]: { toxicity: 0.02, insult: 0.01, threat: 0 },
};

// ---------------------------------------------------------------------------
// Point de rupture (plomberie seulement)
// ---------------------------------------------------------------------------

test("point de rupture : sept nuisances, et aucune ne nomme la divulgation d'un domicile", () => {
  assert.deepEqual(HARM_LABELS, ['toxicity', 'severe_toxicity', 'obscene', 'identity_attack', 'insult', 'threat', 'sexual_explicit']);
  assert.ok(!HARM_LABELS.some((label) => ['address', 'doxx', 'privacy', 'personal'].some((w) => label.includes(w))));
});

test("point de rupture : sur des notes simulées basses, l'adresse part en publication", async () => {
  const classifier = new FakeClassifier({ [DOXXING]: { toxicity: 0.08, insult: 0.03, threat: 0.06 } });
  assert.deepEqual(await moderate([DOXXING], classifier), [{ action: 'allow', label: 'toxicity', score: 0.08 }]);
  assert.equal((await moderate([ATTACK], new FakeClassifier(SCORES)))[0].action, 'block');
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('point de rupture : le couple multilingue ne rend qu’une étiquette', async () => {
  // breaking_point : « le couple de cette page ne note que l'anglais […] et
  // celui qui lit le français ne rend qu'une étiquette, « toxic » : le relecteur
  // reçoit un nombre, plus une raison. » Les deux couples sont publiés dans
  // l'extrait ; c'est la ligne du bas qui choisit.
  assert.deepEqual([MODEL_NAME, HARM_LABELS], [ENGLISH[0], ENGLISH[1]]);
  assert.equal(MULTILINGUAL[0], 'onnx-community/distilbert-multilingual-toxicity-classifier-ONNX');
  assert.deepEqual(MULTILINGUAL[1], ['toxic']);
  // Le même commentaire, les deux couples : l'anglais nomme la nuisance…
  const anglais = new FakeClassifier({ [ATTACK]: { toxicity: 0.91, insult: 0.96, threat: 0.04 } });
  assert.deepEqual((await moderate([ATTACK], anglais))[0], { action: 'block', label: 'insult', score: 0.96 });
  // …le multilingue rend une note et rien d'autre.
  const francais = new FakeClassifier({ [ATTACK]: { toxic: 0.96, 'not-toxic': 0.04 } });
  const decision = (await moderate([ATTACK], francais, DEFAULT_THRESHOLDS, MULTILINGUAL[1]))[0];
  assert.deepEqual(decision, { action: 'block', label: 'toxic', score: 0.96 });
  // Et brancher le couple anglais sur des notes multilingues ne lève pas :
  // aucune étiquette connue, donc relecture humaine, sans une erreur.
  const melange = new FakeClassifier({ [ATTACK]: { toxic: 0.96 } });
  assert.equal((await moderate([ATTACK], melange))[0].action, 'review');
});

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

test("un lot vide n'atteint jamais le modèle", async () => {
  const classifier = new FakeClassifier(SCORES);
  assert.deepEqual(await moderate([], classifier), []);
  assert.deepEqual(classifier.calls, []);
  // Sans classifieur non plus : le modèle par défaut n'est pas chargé pour un lot vide.
  globalThis.fauxPipeline = async () => assert.fail('modèle chargé pour un lot vide');
  try {
    assert.deepEqual(await moderate([]), []);
  } finally {
    delete globalThis.fauxPipeline;
  }
});

test("le classifieur est injecté ; par défaut c'est le vrai, chargé une fois, et un chargement raté n'est pas gardé", async () => {
  // « The real model, loaded on first use and kept for the process » ; « a failed load is not kept ».
  const appels = [];
  globalThis.fauxPipeline = async (...args) => {
    appels.push(['pipeline', ...args]);
    throw new Error('téléchargement impossible');
  };
  try {
    await assert.rejects(() => moderate([CALM]), /téléchargement impossible/);
    globalThis.fauxPipeline = async (...args) => {
      appels.push(['pipeline', ...args]);
      return async (comments, options) => {
        appels.push(['pipe', comments, options]);
        return comments.map(() => [{ label: 'toxicity', score: 0.05 }, { label: 'muslim', score: 0.99 }]);
      };
    };
    assert.deepEqual(await moderate([CALM, ATTACK]), [{ action: 'allow', label: 'toxicity', score: 0.05 }, { action: 'allow', label: 'toxicity', score: 0.05 }]);
    await moderate([CALM]);
  } finally {
    delete globalThis.fauxPipeline;
  }
  const options = { subfolder: '', dtype: 'fp32' };
  assert.deepEqual(appels, [
    ['pipeline', 'text-classification', 'protectai/unbiased-toxic-roberta-onnx', options],
    ['pipeline', 'text-classification', 'protectai/unbiased-toxic-roberta-onnx', options],
    ['pipe', [CALM, ATTACK], { top_k: null }],
    ['pipe', [CALM], { top_k: null }],
  ]);
  assert.equal(MODEL_NAME, 'protectai/unbiased-toxic-roberta-onnx');
});

test('predict demande toutes les étiquettes et rend une ligne par commentaire', async () => {
  const seen = [];
  const pipe = async (comments, options) => {
    seen.push(options);
    return comments.map(() => [{ label: 'toxicity', score: 0.9 }, { label: 'insult', score: 0.1 }]);
  };
  const model = new ToxicityModel(pipe);
  assert.deepEqual(await model.predict([ATTACK, CALM]), [{ toxicity: 0.9, insult: 0.1 }, { toxicity: 0.9, insult: 0.1 }]);
  assert.deepEqual(seen, [{ top_k: null }]);
});

test('production : une étiquette de mention d’identité ne décide jamais', async () => {
  const comment = 'as a muslim woman i found the second section very useful';
  const row = { toxicity: 0.01, severe_toxicity: 0, obscene: 0, identity_attack: 0.01, insult: 0, threat: 0, sexual_explicit: 0, male: 0.02, female: 0.91, muslim: 0.95 };
  assert.deepEqual((await moderate([comment], new FakeClassifier({ [comment]: row })))[0], { action: 'allow', label: 'toxicity', score: 0.01 });
  const only = { [comment]: { female: 0.91, muslim: 0.95 } };
  assert.deepEqual((await moderate([comment], new FakeClassifier(only)))[0], { action: 'review', label: null, score: null });
});

test("production : une ligne d'une autre forme part en relecture", async () => {
  const rows = { [ATTACK]: { label: 'toxicity', score: 0.95 } };
  assert.deepEqual((await moderate([ATTACK], new FakeClassifier(rows)))[0], { action: 'review', label: null, score: null });
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
