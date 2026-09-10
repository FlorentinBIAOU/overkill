/**
 * These tests inject a local double instead of calling a provider.
 *
 * What they prove: the prompt carries the ticket and the list of teams, the
 * answer is decoded, oversized input is refused before anything is spent,
 * failures are retried, an unparseable answer throws instead of routing at
 * random, and a team the model invented never becomes a queue.
 *
 * What they do not prove: that the model reads tickets well. That is why this
 * snippet is declared `verification: stubbed` on the entry, and why the page
 * says so next to the code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeLLM } from '../_harness/fake-llm.mjs';
import { DEFAULT_TEAM, MAX_CHARACTERS, RoutingUnavailable, route } from './n3.js';

const BILLING = "Le prélèvement de mars est passé deux fois, merci de m'en rembourser un.";

test('routes the ticket to the team the model names', async () => {
  const client = new FakeLLM({ response: '{"team": "billing"}' });
  assert.equal(await route(BILLING, { client }), 'billing');
});

test('sends the ticket and the list of teams, at temperature zero', async () => {
  const client = new FakeLLM({ response: '{"team": "shipping"}' });
  await route("Mon colis n'est pas arrivé", { client });
  const { prompt, temperature } = client.lastRequest;
  assert.ok(prompt.includes("Mon colis n'est pas arrivé"));
  // The list of teams has to be in the prompt: a model cannot pick from a list
  // it was never shown.
  assert.ok(prompt.includes('billing, technical, shipping'));
  assert.equal(temperature, 0);
});

test('a team written in another case is still a team', async () => {
  // Models capitalise, and pad. Being strict here would send correct answers
  // to the default queue.
  const client = new FakeLLM({ response: '{"team": "  Billing "}' });
  assert.equal(await route(BILLING, { client }), 'billing');
});

test('refuses oversized input before spending anything', async () => {
  const client = new FakeLLM({ response: '{"team": "billing"}' });
  await assert.rejects(() => route('x'.repeat(MAX_CHARACTERS + 1), { client }), RangeError);
  assert.equal(client.callCount, 0);
});

test('retries a provider failure', async () => {
  const client = new FakeLLM({ response: '{"team": "billing"}', failTimes: 2 });
  assert.equal(await route(BILLING, { client, attempts: 3 }), 'billing');
  assert.equal(client.callCount, 3);
});

test('an unparseable answer throws rather than routing at random', async () => {
  // Prose where JSON was asked for. Falling back to a team here would hide a
  // provider incident behind a queue that keeps filling up.
  const client = new FakeLLM({ response: 'Bien sûr ! Ce ticket concerne la facturation.' });
  await assert.rejects(() => route(BILLING, { client, attempts: 2 }), RoutingUnavailable);
  assert.equal(client.callCount, 2);
});

test('an answer without a team goes to the default queue', async () => {
  const client = new FakeLLM({ response: '{"reason": "not sure"}' });
  assert.equal(await route(BILLING, { client }), DEFAULT_TEAM);
});

test('breaking point: the model invents a queue', async () => {
  // Asked to pick from three teams, the model confidently returns a fourth
  // that sounds plausible and does not exist. Nothing in the answer says so —
  // it is well-formed JSON, and the model is not hedging.
  //
  // The closed list catches it and the ticket goes to the default queue. Take
  // that check out, as the first version of this kind of code usually does,
  // and the ticket is filed into a team nobody created and nobody watches.
  for (const invented of ['{"team": "customer success"}', '{"team": "Facturation"}', '{"team": ["billing", "shipping"]}']) {
    const client = new FakeLLM({ response: invented });
    assert.equal(await route(BILLING, { client }), DEFAULT_TEAM, invented);
  }
});
