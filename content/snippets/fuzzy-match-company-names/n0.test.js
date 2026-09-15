import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { jaroWinkler, normalise, similarity } from './n0.js';
import essai from '../../tryouts/live/fuzzy-match-company-names.js';

const THRESHOLD = 0.85; // le seuil qu'une vraie campagne de déduplication emploierait
const SNCF_DEVELOPPEE = 'Société Nationale des Chemins de fer Français';
const close = (a, b, tolerance = 1e-9) => Math.abs(a - b) <= tolerance;

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : un sigle passe sous le seuil et sous une société sans rapport', () => {
  const vraie = similarity('SNCF', SNCF_DEVELOPPEE);
  const sansRapport = similarity('SNCF', 'Sanofi');
  assert.ok(close(vraie, 0.545));
  assert.ok(close(sansRapport, 0.775));
  assert.ok(vraie < THRESHOLD);
  // Aucun seuil : tout seuil qui retient la vraie paire retient aussi Sanofi.
  assert.ok(sansRapport > vraie);
  // Témoin : deux graphies d'un même nom passent le seuil.
  assert.ok(similarity('Boulangerie Martin SARL', 'BOULANGERIE MARTIN') >= THRESHOLD);
});

test('point de rupture : Sanofi partage trois lettres sur quatre avec le sigle', () => {
  const partagees = [...'sncf'].filter((c) => normalise('Sanofi').includes(c));
  assert.deepEqual(partagees, ['s', 'n', 'f']);
  // Jaro les trouve toutes les trois : m = 3, aucune transposition, préfixe « s ».
  const jaro = (3 / 4 + 3 / 6 + 3 / 3) / 3;
  assert.ok(close(jaroWinkler('sncf', 'sanofi'), jaro + 0.1 * (1 - jaro)));
});

test("INFIRMÉ : l'essai dit que Sanofi « ne partage avec SNCF qu'une première lettre » ; il en partage trois", async () => {
  await assert.rejects(async () => {
    assert.deepEqual([...'sncf'].filter((c) => normalise('Sanofi').includes(c)), ['s']);
  }, assert.AssertionError);
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('la même société sous deux graphies', () => {
  assert.equal(similarity('Boulangerie Martin SARL', 'BOULANGERIE MARTIN'), 1);
});

test('la forme juridique est retirée plutôt que comparée', () => {
  assert.equal(similarity('Boulangerie Martin SARL', 'Boulangerie Martin SAS'), 1);
  assert.ok(jaroWinkler('boulangerie martin sarl', 'boulangerie martin sas') < 1);
});

test('accents, casse et ponctuation sont ignorés', () => {
  assert.equal(similarity('Café de la Gare SAS', 'CAFE DE LA GARE'), 1);
  assert.equal(normalise('Café-de-la-Gare, S.A.S'), 'cafe de la gare s a s');
  assert.equal(normalise('Boulangerie Martin SARL'), 'boulangerie martin');
});

test('une esperluette et un pluriel restent au-dessus du seuil', () => {
  assert.ok(similarity('Établissements Léon & Fils SA', 'ETABLISSEMENTS LEON ET FILS') > THRESHOLD);
  assert.ok(similarity('Menuiserie Dubois', 'Menuiseries Dubois SA') > THRESHOLD);
});

test("deux sociétés différentes d'un même métier passent au-dessus du seuil", () => {
  assert.ok(similarity('Boulangerie Martin SARL', 'Boulangerie Dupont SARL') > THRESHOLD);
});

test("un nom fait seulement d'une forme juridique la garde", () => {
  assert.equal(normalise('SARL'), 'sarl');
  assert.ok(similarity('SARL', 'SAS') < 1);
});

test('la liste des formes juridiques est française et étrangère', () => {
  for (const form of ['sarl', 'sas', 'sasu', 'eurl', 'sci', 'snc', 'ltd', 'gmbh', 'llc', 'bv', 'spa']) {
    assert.equal(normalise(`Dupont ${form.toUpperCase()}`), 'dupont', form);
  }
});

test('Jaro-Winkler récompense un début commun', () => {
  assert.ok(jaroWinkler('martin', 'martix') > jaroWinkler('nartin', 'xartin'));
  assert.ok(similarity('Boulangerie Martin Lyon', 'Boulangerie Martin') > THRESHOLD);
});

test('Winkler ne regarde que les quatre premiers caractères', () => {
  // Six caractères communs en tête sur huit, sans transposition : Jaro = (6/8 + 6/8 + 1) / 3 = 5/6.
  const jaro = 5 / 6;
  assert.ok(close(jaroWinkler('martinxy', 'martinzw'), jaro + 4 * 0.1 * (1 - jaro)));
});

test("INFIRMÉ : le commentaire dit que Winkler ne rend jamais plus d'un dixième du score retenu ; il en rend quatre dixièmes", async () => {
  const jaro = 5 / 6;
  await assert.rejects(async () => {
    assert.ok(jaroWinkler('martinxy', 'martinzw') - jaro <= 0.1 * (1 - jaro) + 1e-12);
  }, assert.AssertionError);
});

test('la fenêtre sépare Jaro d’un simple compte de lettres', () => {
  // Huit lettres communes, quatre trouvées dans la fenêtre : Jaro 0,5, aucun début commun.
  assert.equal(jaroWinkler('abcdefgh', 'hgfedcba'), 0.5);
});

test('INFIRMÉ : « within half the length of the longer name » ; un jumeau à exactement la moitié n’est pas trouvé', async () => {
  await assert.rejects(async () => {
    assert.ok(jaroWinkler('abcdef', 'xxxaxx') > 0);
  }, assert.AssertionError);
});

test('un nom vide ne rapproche rien', () => {
  assert.equal(similarity('', 'Martin SARL'), 0);
  assert.equal(similarity('', ''), 1);
});

test("n0 n'emploie aucune dépendance, et l'algorithme tient en trente lignes", () => {
  const source = readFileSync(new URL('./n0.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s|require\(/m);
  const start = source.indexOf('function jaro(');
  const end = source.indexOf('/** Similarity of two company names');
  const code = source.slice(start, end).split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*\*|$)/.test(line));
  assert.ok(code.length <= 30, `${code.length} lignes`);
});

test('n0 est déterministe et rejouable', () => {
  const first = similarity('Boulangerie Martin SARL', 'Boulangerie Dupont');
  for (let i = 0; i < 20; i += 1) assert.equal(similarity('Boulangerie Martin SARL', 'Boulangerie Dupont'), first);
});

test("une comparaison prend moins d'une milliseconde", () => {
  const runs = [];
  for (let r = 0; r < 5; r += 1) {
    const start = performance.now();
    for (let i = 0; i < 100; i += 1) similarity('Boulangerie Martin SARL', 'Boulangerie Dupont SARL');
    runs.push((performance.now() - start) / 100);
  }
  assert.ok(Math.min(...runs) < 1);
});

test("l'ordre des mots coûte presque tout à N0", () => {
  assert.ok(similarity('Menuiserie Dubois', 'Dubois Menuiserie') < THRESHOLD);
  assert.ok(similarity('Martin Dubois', 'Dubois Martin') < 0.5);
});

test("l'essai : trois premiers cas, et le sigle", () => {
  const [statuts, accents, boulangeries, sigle] = essai.cases.map((c) => c.input.split('\n'));
  const [r1, ...c1] = statuts;
  assert.deepEqual(c1.map((c) => similarity(r1, c)), [1, 1]);
  const [r2, ...c2] = accents;
  assert.ok(c2.every((c) => similarity(r2, c) >= THRESHOLD));
  const [r3, ...c3] = boulangeries;
  assert.ok(c3.every((c) => similarity(r3, c) >= THRESHOLD));
  const [r4, vraie, sanofi] = sigle;
  assert.ok(similarity(r4, vraie) < THRESHOLD && similarity(r4, sanofi) > similarity(r4, vraie));
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : des noms de deux mille cinq cents caractères terminent', () => {
  const start = performance.now();
  similarity('boulangerie martin '.repeat(130), 'boulangerie dupont '.repeat(130));
  assert.ok(performance.now() - start < 2000);
});

test("production : marque d'ordre, espace insécable, NFD, emoji", () => {
  assert.equal(similarity('﻿Boulangerie Martin', 'Boulangerie Martin'), 1);
  assert.equal(similarity('Boulangérie Martin', 'Boulangérie Martin'), 1);
  assert.equal(similarity('🍞 Boulangerie Martin', 'BOULANGERIE MARTIN'), 1);
});

test('DÉFAUT : un nom sans lettre latine est vidé ; « Газпром » et « Лукойл » obtiennent 1,0', async () => {
  await assert.rejects(async () => {
    assert.ok(similarity('Газпром', 'Лукойл') < THRESHOLD);
    assert.ok(similarity('東京電力', '日立製作所') < THRESHOLD);
  }, assert.AssertionError);
});

test('DÉFAUT : « Nordic Spa » et « Nordic SA » obtiennent 1,0', async () => {
  await assert.rejects(async () => {
    assert.ok(similarity('Nordic Spa', 'Nordic SA') < 1);
  }, assert.AssertionError);
});

test('production : une lettre sans décomposition est perdue', () => {
  assert.equal(normalise('Ørsted'), 'rsted');
  assert.equal(normalise('Großmann'), 'gro mann');
  assert.ok(similarity('Ørsted', 'Orsted') > THRESHOLD);
});
