import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { similarity } from './n0.js';
import { buildIndex, match } from './n1.js';

// Un registre de la taille d'un petit annuaire professionnel.
const REGISTER = [
  'Boulangerie Martin SARL',
  'Boulangerie Dupont',
  'Menuiserie Dubois SA',
  'Dubois Menuiserie',
  'Café de la Gare',
  'SNCF',
  'Société Nationale des Chemins de fer Français',
];
const SNCF_DEVELOPPEE = REGISTER.at(-1);

const INDEX = buildIndex(REGISTER);
const ranked = (query, index = INDEX, size = REGISTER.length) => Object.fromEntries(match(index, query, size));
const round12 = (x) => Number(x.toFixed(12));

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test("point de rupture : le sigle n'atteint pas les trois premiers, doublé par deux sociétés sans rapport", () => {
  const top = match(INDEX, 'SNCF', 4);
  assert.deepEqual(top.map(([name]) => name), ['SNCF', 'Menuiserie Dubois SA', 'Boulangerie Martin SARL', SNCF_DEVELOPPEE]);
  // Doublée par un score, pas par l'ordre du registre.
  assert.ok(top[1][1] > top[3][1] && top[2][1] > top[3][1] && top[3][1] > 0);
  assert.equal(round12(top[3][1]), 0.010394932704);
});

test("point de rupture : pondérer répare l'ordre des mots et classe la bonne boulangerie", () => {
  assert.deepEqual(match(INDEX, 'MARTIN BOULANGERIE'), match(INDEX, 'Boulangerie Martin'));
  const scores = ranked('Boulangerie Martin');
  assert.ok(scores['Boulangerie Martin SARL'] > scores['Boulangerie Dupont']);
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('trouve la bonne société en premier', () => {
  const [name, score] = match(INDEX, 'Boulangerie Martin')[0];
  assert.equal(name, 'Boulangerie Martin SARL');
  assert.equal(round12(score), 0.883177974427); // le même nombre en Python
});

test("un fragment rare pèse plus qu'un fragment courant", () => {
  const register = ['Boulangerie Martin', 'Boulangerie Dupont', 'Boulangerie de la Quiquengrogne',
    'Boulangerie Petit', 'Garage Lemoine', 'Fleurs Roux'];
  const index = buildIndex(register);
  assert.ok(index.idf.get('quiq') > index.idf.get('boul'));
  const [name, score] = match(index, 'Quiquengrogne', 1)[0];
  assert.equal(name, 'Boulangerie de la Quiquengrogne');
  assert.ok(Math.abs(score - 0.8013573) < 1e-6);
  assert.deepEqual(match(index, 'Boulangerie', 4).map(([n]) => n),
    ['Boulangerie Petit', 'Boulangerie Martin', 'Boulangerie Dupont', 'Boulangerie de la Quiquengrogne']);
});

test('Jaro-Winkler traite tous les caractères de la même façon', () => {
  assert.ok(similarity('Boulangerie Martin', 'Boulangerie Dupont') > 0.85);
  assert.ok(ranked('Boulangerie Martin')['Boulangerie Dupont'] < 0.6);
});

test('les fragments ne chevauchent jamais deux mots', () => {
  assert.deepEqual([...INDEX.idf.keys()].filter((g) => g.trim().includes(' ')), []);
});

test("l'ordre des mots ne coûte rien ici, au contraire de N0", () => {
  assert.deepEqual(match(INDEX, 'Martin Dubois', REGISTER.length), match(INDEX, 'Dubois Martin', REGISTER.length));
  assert.ok(similarity('Martin Dubois', 'Dubois Martin') < 0.5);
});

test('un pluriel et une inversion à la fois', () => {
  assert.equal(match(INDEX, 'Menuiseries Dubois')[0][0], 'Dubois Menuiserie');
});

test('des fragments de deux à quatre caractères survivent à une faute de frappe', () => {
  const [name, score] = match(INDEX, 'Boulangrie Martin')[0];
  assert.equal(name, 'Boulangerie Martin SARL');
  assert.equal(round12(score), 0.818982690918);
});

test('les lignes sont ramenées à la longueur un, donc le cosinus est un produit scalaire', () => {
  for (const vector of INDEX.vectors) {
    assert.ok(Math.abs(Math.hypot(...vector.values()) - 1) < 1e-12);
  }
  for (const name of REGISTER) assert.ok(Math.abs(ranked(name)[name] - 1) < 1e-12, name);
});

test('une recherche dans dix mille noms termine vite', () => {
  const names = Array.from({ length: 10_000 }, (_, i) => `Entreprise ${i} ${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + (Math.floor(i / 26) % 26))}`);
  const index = buildIndex(names);
  const start = performance.now();
  const top = match(index, names[4242]);
  assert.ok(performance.now() - start < 500);
  assert.equal(top[0][0], names[4242]);
});

test("les égalités reviennent dans l'ordre du registre", () => {
  const register = ['Dupont SA', 'Martin', 'Dupont SA', 'Garage', 'Dupont SA'];
  const index = buildIndex(register);
  assert.deepEqual(match(index, '', 5).map(([n]) => n), register);
  const duplicates = match(index, 'Dupont', 3);
  assert.deepEqual(duplicates.map(([n]) => n), ['Dupont SA', 'Dupont SA', 'Dupont SA']);
  assert.equal(new Set(duplicates.map(([, s]) => s)).size, 1);
});

test("un nom que personne n'a écrit obtient quand même un classement", () => {
  const [name, score] = match(INDEX, 'Kwyjibo')[0];
  assert.ok(REGISTER.includes(name) && score > 0);
});

test('n1 est déterministe', () => {
  const first = match(buildIndex(REGISTER), 'Boulangerie Martin', 7);
  for (let i = 0; i < 10; i += 1) assert.deepEqual(match(buildIndex(REGISTER), 'Boulangerie Martin', 7), first);
});

test("n1 est écrit en entier, sans dépendance", () => {
  const source = readFileSync(new URL('./n1.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s|require\(/m);
});

test('la même arithmétique que scikit-learn : valeurs épinglées en Python', () => {
  assert.equal(round12(ranked('Société Générale')[SNCF_DEVELOPPEE]), 0.469061234241);
  assert.equal(round12(ranked('A B')['Café de la Gare']), 0.105066545124);
  assert.equal(round12(ranked('İstanbul Ltd')['Boulangerie Martin SARL']), 0.178184011082);
});

test('la même arithmétique que scikit-learn, hors du plan multilingue de base aussi', () => {
  // « Code points, as scikit-learn counts them » : valeurs épinglées en Python.
  const emoji = buildIndex(['🍞🥐 Boulangerie Martin', 'Boulangerie Dupont', '𝔄𝔅 Conseil']);
  assert.equal(round12(match(emoji, '𝔄𝔅', 1)[0][1]), 0.475128643566);
  assert.equal(round12(match(emoji, '🍞🥐 Boulangerie', 1)[0][1]), 0.76304806389);
});

test("le score s'explique fragment par fragment", () => {
  // Docstring N2 : « a score that cannot be explained fragment by fragment, as N1's can ».
  // Une requête identique à un nom du registre a le vecteur de ce nom.
  const [requete, nom] = [INDEX.vectors[1], INDEX.vectors[0]]; // « Boulangerie Dupont », « Boulangerie Martin SARL »
  const parts = new Map([...requete].filter(([g]) => nom.has(g)).map(([g, w]) => [g, w * nom.get(g)]));
  const somme = [...parts.values()].reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(somme - ranked('Boulangerie Dupont')['Boulangerie Martin SARL']) < 1e-12);
  assert.equal(parts.size, 33);
  assert.ok([...parts.values()].every((p) => p > 0));
  // L'explication se lit : tout le score partagé vient du mot « boulangerie ».
  assert.ok([...parts.keys()].every((g) => ' boulangerie '.includes(g)));
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : une requête vide ne marque rien', () => {
  assert.ok(match(INDEX, '', REGISTER.length).every(([, score]) => score === 0));
});

test('production : un registre vide rend une liste vide', () => {
  assert.deepEqual(match(buildIndex([]), 'Martin'), []);
});

test('production : topK nul ou plus grand que le registre', () => {
  assert.deepEqual(match(INDEX, 'Martin', 0), []);
  assert.equal(match(INDEX, 'Martin', 100).length, REGISTER.length);
});

test('production : accent décomposé ou absent garde la bonne réponse en tête', () => {
  for (const [query, expected] of [['Café de la Gare', 0.887063254874], ['CAFE DE LA GARE', 0.884139130742]]) {
    const [name, score] = match(INDEX, query)[0];
    assert.equal(name, 'Café de la Gare');
    assert.equal(round12(score), expected);
  }
});

test('production : une requête de cent Ko termine', () => {
  const start = performance.now();
  match(INDEX, 'boulangerie martin '.repeat(5000));
  assert.ok(performance.now() - start < 2000);
});
