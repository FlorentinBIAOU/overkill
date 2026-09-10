/**
 * Le harnais est du code comme le reste : il se teste.
 *
 * Sa propriété la plus importante est la parité entre les deux langages. Un
 * extrait N2 dont les versions Python et JavaScript ne donnent pas les mêmes
 * résultats sur les mêmes entrées n'est pas un extrait, c'est deux extraits
 * différents montrés comme s'ils étaient le même.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import { stableHash, FakeEncoder } from '../content/snippets/_harness/fake-model.mjs';
import { FakeLLM, hashWord } from '../content/snippets/_harness/fake-llm.mjs';

const PYTHON = existsSync('.venv-tools/bin/python') ? '.venv-tools/bin/python' : 'python3';

const MOTS = [
  'boulangerie', 'martin', 'sncf', 'société', 'nationale', 'chemins', 'fer',
  'a', 'zzz', 'é', '0123456789', 'overkill', 'the', 'quick', 'brown',
];

function python(code) {
  return JSON.parse(
    execFileSync(PYTHON, ['-c', code], { encoding: 'utf8', cwd: process.cwd() }),
  );
}

test('le hachage stable donne les mêmes valeurs dans les deux langages', () => {
  const attendu = python(`
import json, sys
sys.path.insert(0, 'content/snippets')
from _harness.fake_model import stable_hash
print(json.dumps({m: stable_hash(m) for m in ${JSON.stringify(MOTS)}}))
`);
  for (const mot of MOTS) {
    assert.equal(stableHash(mot), attendu[mot], `divergence sur « ${mot} »`);
  }
});

test('les deux hachages du harnais sont le même', () => {
  for (const mot of MOTS) assert.equal(stableHash(mot), hashWord(mot));
});

test("l'encodeur factice donne les mêmes vecteurs dans les deux langages", async () => {
  const textes = ['boulangerie martin', 'MARTIN BOULANGERIE', 'société nationale'];
  const attendu = python(`
import json, sys
sys.path.insert(0, 'content/snippets')
from _harness.fake_model import FakeEncoder
print(json.dumps(FakeEncoder(dimensions=64).encode(${JSON.stringify(textes)})))
`);
  const obtenu = await new FakeEncoder(64).encode(textes);
  for (let i = 0; i < textes.length; i += 1) {
    for (let j = 0; j < 64; j += 1) {
      assert.ok(
        Math.abs(obtenu[i][j] - attendu[i][j]) < 1e-12,
        `vecteur ${i}, dimension ${j} : ${obtenu[i][j]} contre ${attendu[i][j]}`,
      );
    }
  }
});

test('le double de modèle généraliste enregistre ce qu\'on lui demande', async () => {
  const client = new FakeLLM({ response: '[]' });
  await client.complete({ prompt: 'bonjour', temperature: 0 });
  assert.equal(client.callCount, 1);
  assert.equal(client.lastRequest.prompt, 'bonjour');
});

test('le double simule un échec de fournisseur autant de fois que demandé', async () => {
  const client = new FakeLLM({ response: 'ok', failTimes: 2 });
  await assert.rejects(() => client.complete({ prompt: 'a' }));
  await assert.rejects(() => client.complete({ prompt: 'a' }));
  assert.equal(await client.complete({ prompt: 'a' }), 'ok');
  assert.equal(client.callCount, 3);
});

test("le double proteste s'il n'a jamais été appelé", () => {
  const client = new FakeLLM({ response: '' });
  assert.throws(() => client.lastRequest, /never called/);
});
