/**
 * Ces tests injectent un double local au lieu de charger un modèle.
 *
 * Le chargement par défaut importe '@xenova/transformers'. Un crochet de
 * résolution, posé pour ce seul processus de test, remplace ce paquet par un
 * module à la surface publiée : `pipeline('summarization', nom)` rend une
 * fonction qui rend `[{ summary_text }]`. Il compte les chargements.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { FakeSeq2Seq } from '../_harness/fake-model.mjs';
import { CHUNK_CHARACTERS, MAX_CHARACTERS, MODEL_NAME, SummaryUnavailable, chunk, summarise } from './n2.js';

globalThis.__summariserLoads = [];
const FAKE_TRANSFORMERS = `
  export async function pipeline(task, model) {
    globalThis.__summariserLoads.push([task, model]);
    return async (text, options) => [{ summary_text: 'summary of ' + text.length + ' characters' }];
  }`;
register(`data:text/javascript,${encodeURIComponent(`export async function resolve(specifier, context, next) {
  if (specifier === '@xenova/transformers') {
    return { url: 'data:text/javascript,' + encodeURIComponent(${JSON.stringify(FAKE_TRANSFORMERS)}), shortCircuit: true };
  }
  return next(specifier, context);
}`)}`);

const REPORT = [
  'The support team migrated the ticketing system to a new platform in March.',
  'Every agent was trained during the two weeks before the switch.',
  'The old platform stayed available in read-only mode for a month afterwards.',
].join(' ');

const LONG = Array.from({ length: 120 }, (_, i) => `Paragraph ${i} describes another part of the warehouse.`).join(' ');

const DOCUMENT = [
  'The Rouen plant supplies every battery cell used on the Lyon assembly line.',
  'The Rouen plant will close at the end of March.',
].join(' ');
const SUPPORTED = 'The Lyon assembly line will stop when Rouen closes at the end of March.';
const INVENTED = 'The Lyon assembly line will move to Rouen in April.';

class FlakySeq2Seq extends FakeSeq2Seq {
  constructor(outputs, failTimes, defaultOutput = '') {
    super(outputs, defaultOutput);
    this.failTimes = failTimes;
  }

  async generate(text) {
    if (this.failTimes > 0) {
      this.failTimes -= 1;
      this.calls.push(text);
      throw new Error('simulated model failure');
    }
    return super.generate(text);
  }
}

/** Une note de la longueur d'une sortie de bart-large-cnn, environ 600 caractères. */
class NoteTaker extends FakeSeq2Seq {
  async generate(text) {
    this.calls.push(text);
    return Array(120).fill('note').join(' ');
  }
}

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : la fonction rend le résumé qui découle et celui qui invente à l’identique', async () => {
  assert.equal(await summarise(DOCUMENT, { model: new FakeSeq2Seq({}, SUPPORTED) }), SUPPORTED);
  assert.equal(await summarise(DOCUMENT, { model: new FakeSeq2Seq({}, INVENTED) }), INVENTED);
  assert.ok(!DOCUMENT.includes('April') && !DOCUMENT.includes(INVENTED));
});

test('point de rupture : la seule vérification est que la réponse n’est pas vide', async () => {
  for (const anything of ['x', 'Die Linie wird verlegt.', 'lorem '.repeat(10000), '{}']) {
    assert.equal(await summarise(DOCUMENT, { model: new FakeSeq2Seq({}, anything) }), anything.trim());
  }
  await assert.rejects(() => summarise(DOCUMENT, { model: new FakeSeq2Seq({}, ' \n ') }), SummaryUnavailable);
});

test('point de rupture : la seconde passe résume les notes et plus jamais le document', async () => {
  const pieces = chunk(LONG);
  const notes = Object.fromEntries(pieces.map((p, i) => [p, `note about part ${i}`]));
  const secondPass = pieces.map((p) => notes[p]).join(' ');
  const model = new FakeSeq2Seq({ ...notes, [secondPass]: 'the whole warehouse, in one line' });
  assert.equal(await summarise(LONG, { model }), 'the whole warehouse, in one line');
  assert.deepEqual(model.calls, [...pieces, secondPass]);
  assert.ok(!model.calls.at(-1).includes('Paragraph'));
  const short = new FakeSeq2Seq({}, 'a summary');
  await summarise(REPORT, { model: short });
  assert.deepEqual(short.calls, [REPORT]);
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('rend ce que le modèle a écrit', async () => {
  const model = new FakeSeq2Seq({ [REPORT]: 'The ticketing system was migrated in March.' });
  assert.equal(await summarise(REPORT, { model }), 'The ticketing system was migrated in March.');
});

test('la découpe se fait aux frontières de phrase sans rien perdre', () => {
  assert.equal(CHUNK_CHARACTERS, 3000);
  const pieces = chunk(LONG, 400);
  assert.ok(pieces.length > 1);
  assert.ok(pieces.every((p) => p.length <= 400 && p.endsWith('.')));
  assert.equal(pieces.join(' '), LONG);
});

test('production : limite de la découpe au caractère près', () => {
  const exactly = `${'a'.repeat(1499)}. ${'b'.repeat(1498)}.`;
  assert.equal(exactly.length, 3000);
  assert.deepEqual(chunk(exactly), [exactly]);
  assert.equal(chunk(`${exactly} c.`).length, 2);
});

test('une phrase plus longue que la fenêtre passe entière', () => {
  const oneLongSentence = `${new Array(200).fill('word').join(' ')}.`;
  assert.deepEqual(chunk(oneLongSentence, 100), [oneLongSentence]);
});

test('une passe tombée au milieu fait lever plutôt que rendre un demi-document', async () => {
  const pieces = chunk(LONG);
  const outputs = Object.fromEntries(pieces.map((p, i) => [p, `note ${i}`]));
  outputs[pieces[1]] = '';
  const model = new FakeSeq2Seq(outputs, 'unused');
  await assert.rejects(() => summarise(LONG, { model }), SummaryUnavailable);
  assert.equal(model.calls.at(-1), pieces[1]);
});

test('un document vide ne coûte rien', async () => {
  const model = new FakeSeq2Seq({}, 'a summary');
  assert.equal(await summarise('', { model }), '');
  assert.equal(await summarise('   \n  ', { model }), '');
  assert.deepEqual(model.calls, []);
});

test('un document d’une phrase passe quand même par le modèle', async () => {
  assert.equal(await summarise('The plant will close.', { model: new FakeSeq2Seq({}, 'rewritten') }), 'rewritten');
});

test('refuse un document trop long avant tout travail', async () => {
  const model = new FakeSeq2Seq({}, 'a summary');
  await assert.rejects(() => summarise('x'.repeat(MAX_CHARACTERS + 1), { model }), RangeError);
  assert.deepEqual(model.calls, []);
  await summarise('x'.repeat(MAX_CHARACTERS), { model });
  assert.equal(model.calls.length, 1);
});

test('une panne est retentée le nombre de fois annoncé', async () => {
  const model = new FlakySeq2Seq({ [REPORT]: 'a summary' }, 1);
  assert.equal(await summarise(REPORT, { model, attempts: 2 }), 'a summary');
  assert.equal(model.calls.length, 2);
  const down = new FlakySeq2Seq({ [REPORT]: 'a summary' }, 5);
  await assert.rejects(() => summarise(REPORT, { model: down, attempts: 3 }), SummaryUnavailable);
  assert.equal(down.calls.length, 3);
});

test('une réponse vide ou nulle lève plutôt que laisser un trou', async () => {
  await assert.rejects(() => summarise(REPORT, { model: new FakeSeq2Seq({}, '   ') }), SummaryUnavailable);
  await assert.rejects(() => summarise(REPORT, { model: { generate: async () => null } }), SummaryUnavailable);
});

test('le modèle nommé est distilbart-cnn-12-6', () => {
  // Constat : Python charge facebook/bart-large-cnn.
  assert.equal(MODEL_NAME, 'Xenova/distilbart-cnn-12-6');
});

test('le modèle par défaut a la surface de @xenova/transformers', async () => {
  globalThis.__summariserLoads.length = 0;
  assert.equal(await summarise(REPORT), `summary of ${REPORT.length} characters`);
  assert.deepEqual(globalThis.__summariserLoads, [['summarization', MODEL_NAME]]);
});

test('DÉFAUT : le modèle par défaut est rechargé à chaque document', async () => {
  await assert.rejects(async () => {
    globalThis.__summariserLoads.length = 0;
    await summarise(REPORT);
    await summarise(REPORT);
    assert.equal(globalThis.__summariserLoads.length, 1);
  });
});

test('la seconde passe dépasse la fenêtre', async () => {
  const document = Array.from({ length: 3600 }, (_, i) => `Paragraph ${i} describes another part of the warehouse.`).join(' ').slice(0, MAX_CHARACTERS);
  const model = new NoteTaker({});
  await summarise(document, { model });
  assert.ok(model.calls.length > 2);
  assert.ok(model.calls.every((call) => call.length <= CHUNK_CHARACTERS));
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : zéro essai lève sans appeler', async () => {
  const model = new FakeSeq2Seq({}, 'a summary');
  await assert.rejects(() => summarise(REPORT, { model, attempts: 0 }), SummaryUnavailable);
  assert.deepEqual(model.calls, []);
});

test('production : une réponse d’un autre type est une panne', async () => {
  let calls = 0;
  const model = { generate: async () => { calls += 1; return ['not', 'a', 'string']; } };
  await assert.rejects(() => summarise(REPORT, { model, attempts: 2 }), SummaryUnavailable);
  assert.equal(calls, 2);
});

test('production : constat, la découpe écrase les sauts de paragraphe', () => {
  assert.deepEqual(chunk('First paragraph ends.\n\nSecond one starts.'), ['First paragraph ends. Second one starts.']);
});

test('production : NFD et emoji partent tels quels', async () => {
  const text = 'La réunion est reportée 🚧.'.normalize('NFD');
  const model = new FakeSeq2Seq({}, 'ok');
  await summarise(text, { model });
  assert.deepEqual(model.calls, [text]);
});
