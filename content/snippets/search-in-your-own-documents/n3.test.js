/**
 * These tests inject a local double instead of calling a provider.
 *
 * What they prove: the retrieved passages really travel inside the prompt, the
 * pack is capped in number and in length, nothing is asked of the model when
 * retrieval found nothing, a failure is retried, an unusable reply throws, and
 * an answer citing a passage nobody sent is refused.
 *
 * What they do not prove: that the answer is true. The last test below shows
 * exactly how far the grounding check goes, and where it stops. That is why
 * the entry declares this snippet `verification: stubbed`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeLLM } from '../_harness/fake-llm.mjs';
import {
  MAX_CHARACTERS, NO_ANSWER, AnswerNotGrounded, AnswerUnavailable, answer,
} from './n3.js';

// What a search over the handbook returned for the question below.
const PASSAGES = [
  {
    id: 'conges',
    text: 'Le salarié acquiert deux jours et demi de congés payés par mois de travail effectif.',
  },
  { id: 'frais', text: 'Les notes de frais se déposent avant le cinq du mois.' },
];

const QUESTION = 'combien de jours de congés par mois ?';

const dontKnow = () => new FakeLLM({ response: JSON.stringify({ answer: NO_ANSWER, sources: [] }) });

test('returns the answer and its sources', async () => {
  const client = new FakeLLM({
    response: JSON.stringify({ answer: 'Deux jours et demi par mois.', sources: ['conges'] }),
  });
  assert.deepEqual(await answer(QUESTION, PASSAGES, { client }), {
    answer: 'Deux jours et demi par mois.',
    sources: ['conges'],
  });
});

test('every retrieved passage travels inside the prompt', async () => {
  const client = dontKnow();
  await answer(QUESTION, PASSAGES, { client });
  const { prompt } = client.lastRequest;
  for (const passage of PASSAGES) {
    assert.ok(prompt.includes(passage.text));
    assert.ok(prompt.includes(`[${passage.id}]`)); // so the model can cite it
  }
  assert.ok(prompt.includes(QUESTION));
  assert.equal(client.lastRequest.temperature, 0);
});

test('only the best passages are sent', async () => {
  // Retrieval returns a ranking; the prompt takes the head of it. Sending
  // everything found is how a context window fills up with noise.
  const client = dontKnow();
  await answer(QUESTION, PASSAGES, { client, maxPassages: 1 });
  assert.ok(!client.lastRequest.prompt.includes(PASSAGES[1].text));
});

test('a very long passage is cut before it is sent', async () => {
  const client = dontKnow();
  await answer(QUESTION, [{ id: 'conges', text: 'x'.repeat(MAX_CHARACTERS + 100) }], { client });
  assert.ok(client.lastRequest.prompt.includes('x'.repeat(MAX_CHARACTERS)));
  assert.ok(!client.lastRequest.prompt.includes('x'.repeat(MAX_CHARACTERS + 1)));
});

test('nothing retrieved means nothing asked', async () => {
  const client = new FakeLLM({ response: '{}' });
  assert.deepEqual(await answer(QUESTION, [], { client }), { answer: NO_ANSWER, sources: [] });
  assert.equal(client.callCount, 0);
});

test('the model may say it does not know without citing anything', async () => {
  const result = await answer(QUESTION, PASSAGES, { client: dontKnow() });
  assert.deepEqual(result, { answer: NO_ANSWER, sources: [] });
});

test('retries a provider failure', async () => {
  const client = new FakeLLM({
    response: JSON.stringify({ answer: NO_ANSWER, sources: [] }),
    failTimes: 1,
  });
  await answer(QUESTION, PASSAGES, { client, attempts: 2 });
  assert.equal(client.callCount, 2);
});

test('prose where JSON was asked for throws', async () => {
  const client = new FakeLLM({ response: 'Bien sûr ! Vous avez droit à…' });
  await assert.rejects(() => answer(QUESTION, PASSAGES, { client }), AnswerUnavailable);
});

test('a citation nobody sent is refused', async () => {
  // The clearest sign of an invented answer, and the cheapest to catch.
  const client = new FakeLLM({
    response: JSON.stringify({ answer: "Voir l'accord d'entreprise.", sources: ['accord-2019'] }),
  });
  await assert.rejects(() => answer(QUESTION, PASSAGES, { client }), AnswerNotGrounded);
});

test('an answer that cites nothing is refused', async () => {
  const client = new FakeLLM({
    response: JSON.stringify({ answer: 'Trente jours ouvrés.', sources: [] }),
  });
  await assert.rejects(() => answer(QUESTION, PASSAGES, { client }), AnswerNotGrounded);
});

test('breaking point: a real citation on an invented sentence', async () => {
  // The check above reads the citations, not the answer.
  //
  // Here the model cites the passage it was actually given, and writes a
  // sentence that passage flatly contradicts — the handbook says two and a
  // half days a month, the answer says thirty days on arrival. Every check in
  // this snippet passes, and the answer comes back with a source next to it,
  // which is precisely what makes it convincing.
  //
  // Whoever reads it has to open the passage to find out, which is the work
  // retrieval was supposed to save. There is no line of code below that fixes
  // this; there is a human, or there is a risk you accept knowingly.
  const invented = "Vous avez trente jours ouvrés de congés dès l'embauche.";
  const client = new FakeLLM({ response: JSON.stringify({ answer: invented, sources: ['conges'] }) });
  assert.deepEqual(await answer(QUESTION, PASSAGES, { client }), {
    answer: invented,
    sources: ['conges'],
  });
  assert.ok(PASSAGES[0].text.includes('deux jours et demi')); // what the source really says
});
