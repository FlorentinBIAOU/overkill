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

test("l'essai : Sanofi partage avec SNCF trois lettres sur quatre", () => {
  const why = essai.cases[3].why;
  assert.match(why.fr, /qui partage avec SNCF trois lettres sur quatre/);
  assert.match(why.en, /which shares three of the four letters of SNCF/);
  assert.deepEqual([...'sncf'].filter((c) => normalise('Sanofi').includes(c)), ['s', 'n', 'f']);
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
  for (const form of ['sarl', 'sas', 'sasu', 'eurl', 'sci', 'snc', 'ltd', 'gmbh', 'llc', 'bv']) {
    assert.equal(normalise(`Dupont ${form.toUpperCase()}`), 'dupont', form);
  }
});

test("« spa » n'est pas une forme, et « Nordic Spa » ne fusionne pas avec « Nordic SA »", () => {
  assert.equal(normalise('Nordic Spa'), 'nordic spa');
  assert.ok(close(similarity('Nordic Spa', 'Nordic SA'), 0.92));
  // Témoin : « SA » est bien retiré, « Nordic SA » et « Nordic » sont un seul nom.
  assert.equal(similarity('Nordic SA', 'Nordic'), 1);
});

test('Jaro-Winkler récompense un début commun', () => {
  assert.ok(jaroWinkler('martin', 'martix') > jaroWinkler('nartin', 'xartin'));
  // Une ville, un reste de ponctuation après la même marque : au-dessus du seuil.
  assert.ok(close(similarity('Boulangerie Martin Lyon', 'Boulangerie Martin'), 0.9565, 1e-4));
  assert.ok(close(similarity('Boulangerie Martin (ex-Dupuis)', 'Boulangerie Martin'), 0.9286, 1e-4));
  // Témoin : la même ville en tête coûte bien plus, sous le seuil.
  assert.ok(close(similarity('Lyon Boulangerie Martin', 'Boulangerie Martin'), 0.7794, 1e-4));
});

test('Winkler ne regarde que les quatre premiers caractères', () => {
  // Six caractères communs en tête sur huit, sans transposition : Jaro = (6/8 + 6/8 + 1) / 3 = 5/6.
  const jaro = 5 / 6;
  assert.ok(close(jaroWinkler('martinxy', 'martinzw'), jaro + 4 * 0.1 * (1 - jaro)));
});

test('Winkler rend un dixième du score retenu par caractère commun en tête', () => {
  // « abcdefgh » contre une chaîne qui en garde les « commun » premiers caractères : Jaro sans transposition.
  for (let commun = 1; commun < 7; commun += 1) {
    const jaro = (commun / 8 + commun / 8 + 1) / 3;
    const b = 'abcdefgh'.slice(0, commun) + 'XYZWVUTS'.slice(commun);
    const rendu = (jaroWinkler('abcdefgh', b) - jaro) / (1 - jaro);
    assert.ok(close(rendu, Math.min(commun, 4) / 10, 1e-12), String(commun));
  }
  assert.equal(jaroWinkler('abcdefgh', 'XYZWVUTS'), 0);
});

test('la fenêtre sépare Jaro d’un simple compte de lettres', () => {
  // Huit lettres communes, quatre trouvées dans la fenêtre : Jaro 0,5, aucun début commun.
  assert.equal(jaroWinkler('abcdefgh', 'hgfedcba'), 0.5);
});

test('la fenêtre vaut la moitié de la longueur moins un', () => {
  // « abcdef » : six caractères, moitié 3, fenêtre 2. Aucun début commun.
  assert.ok(close(jaroWinkler('abcdef', 'xxaxxx'), (1 / 6 + 1 / 6 + 1) / 3)); // distance 2 : trouvé
  assert.equal(jaroWinkler('abcdef', 'xxxaxx'), 0); // distance 3, la moitié : pas trouvé
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

test('production : deux noms non latins différents restent sous le seuil', () => {
  assert.equal(normalise('Газпром'), 'газпром');
  assert.ok(close(similarity('Газпром', 'Лукойл'), 0.4365, 1e-4));
  assert.equal(similarity('東京電力', '日立製作所'), 0);
});

test('production : grec, arabe, chinois identiques à 1 et différents sous le seuil', () => {
  assert.equal(similarity('Αθηναϊκή Ζυθοποιία', 'ΑΘΗΝΑΪΚΗ ΖΥΘΟΠΟΙΙΑ'), 1);
  assert.ok(close(similarity('Αθηναϊκή Ζυθοποιία', 'Ελληνικά Πετρέλαια'), 0.5556, 1e-4));
  assert.equal(similarity('شركة أرامكو', 'شركة أرامكو'), 1);
  assert.ok(close(similarity('أرامكو السعودية', 'مصرف الراجحي'), 0.5881, 1e-4));
  assert.equal(similarity('東京電力', '東京電力'), 1);
  assert.ok(close(similarity('中国石油', '中国银行'), 0.7333, 1e-4));
});

test('DÉFAUT : toutes les marques de catégorie M sont retirées, voyelles du devanagari et du thaï comprises ; « कमल उद्योग » et « कोमल उद्योग » obtiennent 1,0', async () => {
  await assert.rejects(async () => {
    assert.ok(similarity('कमल उद्योग', 'कोमल उद्योग') < 1);
    assert.ok(similarity('กินดี', 'กันดี') < 1);
  }, assert.AssertionError);
});

test('DÉFAUT : une forme juridique en tête de nom est retirée ; « Sa Nostra » et « Nostra », « NV Energy » et « Energy Ltd » obtiennent 1,0', async () => {
  await assert.rejects(async () => {
    assert.ok(similarity('Sa Nostra', 'Nostra') < 1);
    assert.ok(similarity('NV Energy', 'Energy Ltd') < 1);
  }, assert.AssertionError);
});

test("production : un nom fait seulement d'emoji ou de ponctuation est vidé", () => {
  // Non réparé, décision du rédacteur : deux tels noms valent 1, comme deux noms vides.
  assert.equal(normalise('🍞'), '');
  assert.equal(normalise('!!!'), '');
  assert.equal(similarity('🍞', '🚗'), 1);
});

test('production : une lettre sans décomposition est gardée, pas repliée', () => {
  assert.equal(normalise('Ørsted'), 'ørsted');
  assert.equal(normalise('Großmann'), 'großmann');
  assert.ok(close(similarity('Ørsted', 'Orsted'), 0.8889, 1e-4));
  assert.ok(similarity('Ørsted', 'Orsted') > THRESHOLD);
});

test('production : des caractères hors du plan de base comptent pour un', () => {
  // « Code points, as Python counts them, not UTF-16 units. » Même valeur en Python.
  assert.ok(close(jaroWinkler('𠀀𠀁x', '𠀀𠀁y'), 0.8222, 1e-4));
});

test('production : formes pointées et largeur nulle restent au-dessus du seuil', () => {
  // Non réparé, décision du rédacteur.
  assert.ok(close(similarity('Boulangerie Martin S.A.R.L.', 'Boulangerie Martin'), 0.9385, 1e-4));
  assert.ok(close(similarity('Boulan\u200bgerie Martin', 'Boulangerie Martin'), 0.9561, 1e-4));
});
