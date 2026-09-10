/**
 * These tests inject a local double instead of calling a provider.
 *
 * What they prove: the request carries the article and the whole taxonomy, the
 * answer is decoded, oversized input is refused before anything is spent,
 * failures are retried, invented topics are dropped, and an unusable answer
 * does not quietly become an untagged article.
 *
 * What they do not prove: that the model tags well. That is why this snippet
 * is declared `verification: stubbed` on the entry, and why the page says so
 * next to the code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeLLM } from '../_harness/fake-llm.mjs';
import { MAX_CHARACTERS, TaggingUnavailable, tag } from './n3.js';

// The same controlled vocabulary as N0. On this rung it is no longer a list of
// terms to match, only the list of names the model is allowed to answer with.
const TOPICS = ['cybersécurité', 'fiscalité', 'recrutement', 'télétravail'];

const ARTICLE = "Les indemnités de télétravail versées aux salariés sont soumises à l'impôt.";

test('tags what the model reports', async () => {
  const client = new FakeLLM({ response: '["télétravail"]' });
  assert.deepEqual(await tag(ARTICLE, TOPICS, { client }), ['télétravail']);
});

test('an article comes back with several topics', async () => {
  const client = new FakeLLM({ response: JSON.stringify(['télétravail', 'fiscalité']) });
  // In the order of the taxonomy, not the order the model happened to use:
  // two identical calls must file an article the same way twice.
  assert.deepEqual(await tag(ARTICLE, TOPICS, { client }), ['fiscalité', 'télétravail']);
});

test('sends the article and the whole taxonomy in the prompt', async () => {
  const client = new FakeLLM({ response: '[]' });
  await tag(ARTICLE, TOPICS, { client });
  const { prompt } = client.lastRequest;
  assert.ok(prompt.includes(ARTICLE));
  for (const topic of TOPICS) assert.ok(prompt.includes(topic), topic);
  // Temperature zero, because a taxonomy that changes between two identical
  // calls is not a taxonomy.
  assert.equal(client.lastRequest.temperature, 0);
});

test('an empty answer is a legitimate answer', async () => {
  const client = new FakeLLM({ response: '[]' });
  assert.deepEqual(await tag('Le restaurant du coin a changé de carte.', TOPICS, { client }), []);
});

test('a topic the taxonomy does not know is dropped', async () => {
  // A model asked for four topics will still offer a fifth of its own. Case is
  // forgiven, since only the spelling of a known topic is restored. An
  // invented topic is not: it would create a tag in your database.
  const client = new FakeLLM({ response: JSON.stringify(['actualité juridique', 'Fiscalité']) });
  assert.deepEqual(await tag(ARTICLE, TOPICS, { client }), ['fiscalité']);
});

test('refuses oversized input before spending anything', async () => {
  const client = new FakeLLM({ response: '[]' });
  await assert.rejects(() => tag('x'.repeat(MAX_CHARACTERS + 1), TOPICS, { client }), RangeError);
  assert.equal(client.callCount, 0);
});

test('retries a provider failure', async () => {
  const client = new FakeLLM({ response: '[]', failTimes: 2 });
  await tag(ARTICLE, TOPICS, { client, attempts: 3 });
  assert.equal(client.callCount, 3);
});

test('gives up after the last attempt', async () => {
  const client = new FakeLLM({ response: '[]', failTimes: 5 });
  await assert.rejects(() => tag(ARTICLE, TOPICS, { client, attempts: 3 }), TaggingUnavailable);
  assert.equal(client.callCount, 3);
});

test('breaking point: an unusable answer raises rather than tagging nothing', async () => {
  // The model can answer anything, including prose where JSON was asked for.
  //
  // An empty list is a legitimate answer here — plenty of articles carry no
  // topic. So a function that shrugged and returned an empty list on a broken
  // answer would make a failure indistinguishable from a correct result, and
  // the articles would quietly fall out of every topic page on the site.
  //
  // It throws instead, and the caller decides whether to retry later or to
  // file the article for a human.
  const client = new FakeLLM({ response: 'Bien sûr ! Voici les thèmes de cet article :' });
  await assert.rejects(() => tag(ARTICLE, TOPICS, { client }), TaggingUnavailable);
});
