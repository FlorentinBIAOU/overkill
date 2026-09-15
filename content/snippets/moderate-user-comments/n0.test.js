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

test("point de rupture : seule la fenêtre de contexte distingue le signalement de l'insulte", () => {
  // Une insulte dont le terme tombe à la même position que dans le signalement.
  const report = review(REPORT, TERMS);
  const insult = review('just get lost you blorptard', TERMS);
  assert.equal(report.flagged, true);
  assert.equal(insult.flagged, true);
  const differ = Object.keys(report.matches[0]).filter((k) => report.matches[0][k] !== insult.matches[0][k]);
  assert.deepEqual(differ, ['context']);
  assert.equal(report.matches[0].context, 'called me a blorptard please remove his');
  assert.equal(insult.matches[0].context, 'get lost you blorptard');
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

test('chaque décision se ramène à une entrée de la liste', () => {
  const terms = [...TERMS, 'Sale Type'];
  const listed = new Set(terms.map(normalise));
  const { matches } = review('ZIBBERNAUT and flarnwît, quel sale type', terms);
  assert.deepEqual(matches.map((m) => m.term), ['zibbernaut', 'flarnwit', 'sale type']);
  assert.ok(matches.every((m) => listed.has(m.term)));
});

test('la normalisation replie la casse et les accents', () => {
  assert.equal(normalise('BLÔRPTARD'), 'blorptard');
  assert.ok(review('what a ZIBBERNAUT', TERMS).flagged);
  assert.ok(review('quel flarnwît celui-là', TERMS).flagged);
  assert.ok(review('what a blorptard', ['BLÖRPTARD']).flagged);
});

test('les formes de compatibilité sont repliées, pas les sosies', () => {
  assert.equal(normalise('ｂｌｏｒｐｔａｒｄ'), 'blorptard');
  assert.equal(normalise('ﬁn²'), 'fin2');
  assert.ok(review('you ᵇˡᵒʳᵖᵗᵃʳᵈ', TERMS).flagged);
  assert.ok(review('you are a ﬂarnwit', TERMS).flagged);
  // Les sosies : un zéro, un « о » cyrillique.
  assert.equal(normalise('bl0rptard'), 'bl0rptard');
  assert.ok(!review('you bl0rptard', TERMS).flagged);
  assert.ok(!review('you bl\u043erptard', TERMS).flagged);
});

test('les formes de compatibilité en capitales sont repliées comme les autres', () => {
  // Python ne les replie pas : casefold y est appliqué avant NFKD.
  assert.ok(review('you 𝐁𝐋𝐎𝐑𝐏𝐓𝐀𝐑𝐃', TERMS).flagged);
  assert.ok(review('you ᴮᴸᴼᴿᴾᵀᴬᴿᴰ', TERMS).flagged);
});

test('INFIRMÉ : « ß » et « ς » ne sont pas les deux seules lettres où casefold diffère des minuscules après NFKD ; le repli JavaScript diverge de Python ailleurs', async () => {
  // Valeurs de normalise en Python : « ᾳ » → « αι », « Ꭰ » (cherokee) → « Ꭰ ».
  await assert.rejects(async () => {
    assert.equal(normalise('ᾳ'), 'αι');
    assert.equal(normalise('Ꭰ'), 'Ꭰ');
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

test('un terme de deux mots est trouvé', () => {
  assert.ok(review('quel sale type celui-là', ['sale type']).flagged);
});

test('un terme de plusieurs mots est trouvé quelle que soit la ponctuation qui les sépare', () => {
  assert.deepEqual(review('quel sale, type celui-là', ['sale type'], 1).matches, [
    { term: 'sale type', position: 1, context: 'quel sale type celui' },
  ]);
  assert.ok(review('quel SALE — type', ['sale type']).flagged);
  // Témoin : les mots doivent se suivre.
  assert.ok(!review('quel sale gros type', ['sale type']).flagged);
  assert.deepEqual(review('sale type', ['sale', 'sale type']).matches.map((m) => m.term), ['sale', 'sale type']);
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

test('production : ß majuscule et sigma final sont repliés comme en Python', () => {
  assert.ok(review('STRAẞE', ['strasse']).flagged);
  assert.ok(review('SCHEISSE', ['scheiße']).flagged);
  assert.equal(normalise('ΚΑΚΟΣ'), 'κακοσ');
  assert.equal(normalise('κακος'), 'κακοσ');
  assert.ok(review('κακος', ['ΚΑΚΟΣ']).flagged);
});

test('production : un terme vide ou de ponctuation dans la liste est sans effet', () => {
  assert.deepEqual(review(ATTACK, ['', '!!!']), { flagged: false, matches: [] });
  assert.deepEqual(review(ATTACK, ['', 'blorptard']).matches, [
    { term: 'blorptard', position: 5, context: 'this forum you blorptard' },
  ]);
});

test('DÉFAUT : une voyelle dépendante du devanagari coupe le mot ; « मल » est trouvé dans « कोमल »', async () => {
  await assert.rejects(async () => {
    assert.ok(!review('यह कोमल है', ['मल']).flagged);
    assert.equal(review('तुम कमीने हो', ['कमीने']).matches[0].context, 'तुम कमीने हो');
  }, assert.AssertionError);
});

test('production : un accent tapé en NFD reste dans son mot', () => {
  assert.deepEqual(review('quel flarnwi\u0302t', TERMS).matches, [
    { term: 'flarnwit', position: 1, context: 'quel flarnwît' },
  ]);
  assert.ok(review('quel flarnwît', ['flarnwi\u0302t']).flagged);
});
