import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalise, review } from './n0.js';

// La liste est une politique : elle vit avec le test, pas avec le code.
const TERMS = ['blorptard', 'zibbernaut', 'flarnwit'];
const REPORT = 'he called me a blorptard, please remove his comment';
const ATTACK = 'get off this forum you blorptard';

/** Ce qu'un programme lit du résultat : le drapeau et les termes, sans la fenêtre. */
const withoutLocation = (result) => ({ flagged: result.flagged, terms: result.matches.map((m) => m.term) });

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : une graphie absente de la liste passe intacte', () => {
  for (const evasion of ['bl0rptard', 'blorp-tard', 'b l o r p t a r d', 'blorptardd']) {
    assert.deepEqual(review(`you are a ${evasion}`, TERMS), { flagged: false, matches: [] }, evasion);
  }
  assert.ok(review('you are a blorptard', TERMS).flagged);
});

test("point de rupture : le signalement est signalé exactement comme l'insulte", () => {
  const banter = review('congratulations you absolute blorptard, well played', TERMS);
  const expected = { flagged: true, terms: ['blorptard'] };
  assert.deepEqual(withoutLocation(review(REPORT, TERMS)), expected);
  assert.deepEqual(withoutLocation(review(ATTACK, TERMS)), expected);
  assert.deepEqual(withoutLocation(banter), expected);
  assert.ok(!review('great write-up, the third section helped a lot', TERMS).flagged);
});

test("INFIRMÉ : la fiche dit que rien dans le résultat ne distingue le signalement de l'insulte ; la fenêtre de contexte les distingue", async () => {
  await assert.rejects(async () => {
    assert.deepEqual(review(REPORT, TERMS).matches, review(ATTACK, TERMS).matches);
  }, assert.AssertionError);
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('signale un terme listé et montre son contexte', () => {
  assert.deepEqual(review('honestly this whole update is the work of a blorptard', TERMS), {
    flagged: true,
    matches: [{ term: 'blorptard', position: 9, context: 'work of a blorptard' }],
  });
});

test('chaque décision se ramène à un mot de la liste', () => {
  const listed = new Set(TERMS.map(normalise));
  assert.ok(review('ZIBBERNAUT and flarnwît', TERMS).matches.every((m) => listed.has(m.term)));
});

test('la normalisation replie la casse et les accents', () => {
  assert.equal(normalise('BLÔRPTARD'), 'blorptard');
  assert.ok(review('what a ZIBBERNAUT', TERMS).flagged);
  assert.ok(review('quel flarnwît celui-là', TERMS).flagged);
  assert.ok(review('what a blorptard', ['BLÖRPTARD']).flagged);
});

test("INFIRMÉ : rien d'autre que la casse et les accents n'est touché ; NFKD replie aussi les formes de compatibilité", async () => {
  await assert.rejects(async () => {
    assert.equal(normalise('ｂｌｏｒｐｔａｒｄ'), 'ｂｌｏｒｐｔａｒｄ');
    assert.equal(normalise('ﬁn²'), 'ﬁn²');
  }, assert.AssertionError);
});

test('les lettres et chiffres de toute écriture ; la ponctuation et le souligné séparent', () => {
  const result = review('блорп_blorptard, 42blorptard', TERMS);
  assert.deepEqual(result.matches.map((m) => m.position), [1]);
  assert.equal(result.matches[0].context, 'блорп blorptard 42blorptard');
});

test('la fenêtre compte des mots de chaque côté', () => {
  const text = 'one two three four blorptard five six seven eight';
  assert.equal(review(text, TERMS).matches[0].context, 'two three four blorptard five six seven');
  assert.equal(review(text, TERMS, 1).matches[0].context, 'four blorptard five');
  assert.equal(review(text, TERMS, 0).matches[0].context, 'blorptard');
});

test('rend chaque occurrence, pas seulement la première', () => {
  assert.deepEqual(review('one blorptard, then another blorptard', TERMS).matches.map((m) => m.position), [1, 4]);
});

test('la fenêtre est coupée aux bords du commentaire', () => {
  assert.equal(review('blorptard', TERMS, 5).matches[0].context, 'blorptard');
});

test('INFIRMÉ : « Return every listed term found in text » ; un terme de deux mots n’est jamais trouvé', async () => {
  await assert.rejects(async () => {
    assert.ok(review('quel sale type celui-là', ['sale type']).flagged);
  }, assert.AssertionError);
});

test("n0 est déterministe et n'emploie aucune dépendance", () => {
  for (let i = 0; i < 20; i += 1) assert.deepEqual(review(REPORT, TERMS), review(REPORT, TERMS));
  const source = readFileSync(new URL('./n0.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s|require\(/m);
});

test("un commentaire se vérifie en moins d'une milliseconde", () => {
  const runs = [];
  for (let r = 0; r < 5; r += 1) {
    const start = performance.now();
    for (let i = 0; i < 100; i += 1) review('honestly this whole update is the work of a blorptard', TERMS);
    runs.push((performance.now() - start) / 100);
  }
  assert.ok(Math.min(...runs) < 1);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : un commentaire vide et une liste vide', () => {
  assert.deepEqual(review('', TERMS), { flagged: false, matches: [] });
  assert.deepEqual(review(ATTACK, []), { flagged: false, matches: [] });
});

test('production : un commentaire de cent Ko termine vite', () => {
  const start = performance.now();
  const result = review('you blorptard '.repeat(7000), TERMS);
  assert.ok(performance.now() - start < 2000);
  assert.equal(result.matches.length, 7000);
});

test("production : pleine largeur et marque d'ordre", () => {
  assert.ok(review('ｂｌｏｒｐｔａｒｄ', TERMS).flagged);
  assert.ok(review('﻿blorptard', TERMS).flagged);
});

test('DÉFAUT : toLowerCase ne replie pas « ß » ; « SCHEISSE » n’est pas trouvé pour « scheiße », Python le trouve', async () => {
  await assert.rejects(async () => {
    assert.ok(review('SCHEISSE', ['scheiße']).flagged);
  }, assert.AssertionError);
});

test('DÉFAUT : un accent tapé en NFD coupe le mot avant la normalisation', async () => {
  await assert.rejects(async () => {
    assert.ok(review('quel flarnwît', TERMS).flagged);
  }, assert.AssertionError);
});
