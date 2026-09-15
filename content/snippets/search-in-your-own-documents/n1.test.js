/**
 * Le même règlement que n0, pour comparer les deux niveaux sur le même fonds.
 *
 * Chaque nombre affirmé ici l'est à l'identique dans n1.test.py : les deux
 * implémentations classent les mêmes documents dans le même ordre avec les
 * mêmes scores.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildIndex as buildIndexN0, search as searchN0 } from './n0.js';
import { FIELD_WEIGHTS, buildIndex, search, tokenise } from './n1.js';

const HANDBOOK = [
  {
    id: 'conges',
    title: 'Congés payés',
    body: 'Le salarié acquiert deux jours et demi de congés payés par mois travaillé. '
      + 'Le solde figure sur le bulletin de paie. Le télétravail ne change rien à ce '
      + 'calcul, et une journée de télétravail reste une journée travaillée.',
  },
  {
    id: 'teletravail',
    title: 'Télétravail',
    body: 'Deux jours par semaine sont ouverts, après accord écrit du responsable.',
  },
  {
    id: 'frais',
    title: 'Notes de frais',
    body: 'Les notes de frais se déposent avant le cinq du mois. Le remboursement suit '
      + 'la paie du mois suivant.',
  },
  {
    id: 'materiel',
    title: 'Matériel informatique',
    body: 'Le poste de travail est renouvelé tous les quatre ans. La demande passe par '
      + 'le responsable.',
  },
];

const INDEX = buildIndex(HANDBOOK);
const ids = (results) => results.map((result) => result.id);

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : le découpage en mots devient votre problème', () => {
  assert.deepEqual(search(INDEX, 'vacances'), []);
  assert.deepEqual(search(INDEX, 'congé'), []);
  assert.deepEqual(ids(search(INDEX, 'congés')), ['conges']);
});

test('point de rupture : le singulier ne trouve rien, pas plus qu’à N0', () => {
  // breaking_point : « « congé » au singulier ne trouve rien non plus […] — pas plus qu’à N0 ».
  const n0Index = buildIndexN0(HANDBOOK);
  assert.deepEqual(searchN0(n0Index, 'congé'), []);
  assert.deepEqual(search(INDEX, 'congé'), []);
  assert.deepEqual(ids(searchN0(n0Index, 'congés')), ['conges']);
  assert.deepEqual(ids(search(INDEX, 'congés')), ['conges']);
});

test('point de rupture : désuffixation, synonymes et mots vides ne sont pas traités', () => {
  assert.ok(ids(search(INDEX, 'travail')).includes('materiel'));
  assert.ok(!ids(search(INDEX, 'travail')).includes('conges')); // la page dit « travaillé »
  assert.deepEqual(search(INDEX, 'vacances'), []);
  const stop = search(INDEX, 'le');
  assert.deepEqual(ids(stop), ['conges', 'materiel', 'frais']);
  assert.ok(stop.every((result) => result.score > 0));
});

test('point de rupture : l’élision laisse un mot « l » qui pèse plus que le vrai mot', () => {
  const corpus = [...HANDBOOK, { id: 'accord', title: 'Accord', body: 'l\'accord du responsable' }];
  const [result] = search(buildIndex(corpus), 'l\'accord');
  assert.equal(result.id, 'accord');
  assert.deepEqual(result.terms, { l: 1.9377, accord: 1.6844 });
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('trouve et note le bon document', () => {
  assert.deepEqual(search(INDEX, 'congés payés'), [
    { id: 'conges', score: 3.6746, terms: { conges: 1.8373, payes: 1.8373 } },
  ]);
});

test('un seul terme suffit là où N0 les voulait tous', () => {
  assert.deepEqual(ids(search(INDEX, 'congés responsable')), ['conges', 'teletravail', 'materiel']);
  assert.deepEqual(searchN0(buildIndexN0(HANDBOOK), 'congés responsable'), []);
});

test('N1 ne reproduit pas FTS5 à la décimale : règle, IDF, longueur et poids diffèrent', () => {
  // docstring : « It does not reproduce FTS5 to the decimal: the matching rule,
  // the idf, the length and the title weight all differ ».
  const n0Index = buildIndexN0(HANDBOOK);
  assert.deepEqual(FIELD_WEIGHTS, { title: 3, body: 1 });
  const sameWeights = buildIndex(HANDBOOK, { title: 10, body: 1 });
  assert.equal(search(sameWeights, 'congés')[0].score, 2.3173);
  assert.equal(searchN0(n0Index, 'congés')[0].score, 1.5938);
  assert.ok(search(sameWeights, 'le').every((r) => r.score > 0));
  assert.deepEqual([...new Set(searchN0(n0Index, 'le').map((r) => r.score))], [0]);
  assert.equal(sameWeights.lengths.get('teletravail'), 10 + tokenise(HANDBOOK[1].body).length);
  assert.notDeepEqual(search(sameWeights, 'congés responsable'), []);
  assert.deepEqual(searchN0(n0Index, 'congés responsable'), []);
});

test('un titre l’emporte sur deux occurrences dans le corps', () => {
  assert.deepEqual(ids(search(INDEX, 'télétravail')), ['teletravail', 'conges']);
});

test('les poids de champ disent ce que vaut un titre', () => {
  assert.deepEqual(ids(search(buildIndex(HANDBOOK, { body: 1 }), 'télétravail')), ['conges']);
});

test('le score est la somme de ce que chaque terme a apporté', () => {
  const result = search(INDEX, 'paie du mois')[0];
  assert.equal(result.id, 'frais');
  const sum = Object.values(result.terms).reduce((total, share) => total + share, 0);
  assert.ok(Math.abs(sum - result.score) < 0.001);
});

test('un terme rare pèse plus qu’un terme courant', () => {
  const { terms } = search(INDEX, 'congés le')[0];
  assert.ok(terms.conges > terms.le);
});

test('k1 sature la répétition', () => {
  const docs = [1, 2, 4, 8].map((k) => ({ id: `r${k}`, title: 'x', body: Array(k).fill('zèbre').join(' ') }));
  for (let i = 0; i < 6; i += 1) docs.push({ id: `f${i}`, title: 'x', body: 'y' });
  const scores = Object.fromEntries(search(buildIndex(docs), 'zèbre', { b: 0, limit: 10 }).map((r) => [r.id, r.score]));
  assert.deepEqual(scores, { r8: 1.7099, r4: 1.5126, r2: 1.229, r1: 0.8938 });
  const gains = [scores.r2 - scores.r1, scores.r4 - scores.r2, scores.r8 - scores.r4];
  assert.deepEqual(gains, [...gains].sort((a, b) => b - a));
  assert.ok(scores.r8 < Math.log(1 + (10 - 4 + 0.5) / (4 + 0.5)) * 2.2);
});

test('la normalisation de longueur est une molette, pas une loi', () => {
  assert.equal(search(INDEX, 'paie du mois')[1].score, 1.1024);
  assert.deepEqual(search(INDEX, 'paie du mois', { b: 0 })[1], {
    id: 'conges', score: 1.3863, terms: { paie: 0.6931, mois: 0.6931 },
  });
  assert.deepEqual(ids(search(INDEX, 'jours')), ['teletravail', 'conges']);
  assert.deepEqual(ids(search(INDEX, 'jours', { b: 0 })), ['conges', 'teletravail']);
});

test('un mot tapé deux fois ne compte pas double', () => {
  assert.deepEqual(search(INDEX, 'congés congés'), search(INDEX, 'congés'));
});

test('accents et casse ne comptent pas', () => {
  assert.deepEqual(search(INDEX, 'CONGÉS'), search(INDEX, 'conges'));
  assert.deepEqual(tokenise('Notes de frais !'), ['notes', 'de', 'frais']);
});

test('une requête vide ne renvoie rien', () => {
  for (const query of ['', '   ', '!?']) {
    assert.deepEqual(search(INDEX, query), []);
  }
});

test('la limite est respectée', () => {
  assert.equal(search(INDEX, 'le', { limit: 2 }).length, 2);
});

test('l’index ne suit pas les suppressions jusqu’à la reconstruction', () => {
  const documents = HANDBOOK.map((d) => ({ ...d }));
  const built = buildIndex(documents);
  documents.shift();
  assert.deepEqual(ids(search(built, 'congés')), ['conges']);
  assert.deepEqual(search(buildIndex(documents), 'congés'), []);
});

test('l’extrait n’importe rien', () => {
  const source = readFileSync(new URL('./n1.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s/m);
  assert.doesNotMatch(source, /import\(/);
});

test('deux index rendent les mêmes résultats', () => {
  for (const query of ['le', 'jours', 'congés responsable']) {
    assert.deepEqual(search(buildIndex(HANDBOOK), query), search(buildIndex(HANDBOOK), query));
  }
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : fonds vide et documents sans texte', () => {
  assert.deepEqual(search(buildIndex([]), 'congés'), []);
  assert.deepEqual(search(buildIndex([{ id: 'vide', title: '', body: '' }]), 'congés'), []);
});

test('production : un champ nul est indexé comme vide', () => {
  assert.deepEqual(search(buildIndex([{ id: 'nul', title: null, body: undefined }]), 'null'), []);
  assert.deepEqual(ids(search(buildIndex([{ id: 'nul', title: null, body: 'congés' }]), 'congés')), ['nul']);
});

test('production : dix mille pages et une requête de vingt mille mots', () => {
  const started = Date.now();
  const docs = Array.from({ length: 10_000 }, (_, i) => ({
    id: `d${String(i).padStart(5, '0')}`,
    title: `Page ${i}`,
    body: 'le salarié acquiert deux jours de congés payés par mois '.repeat(20),
  }));
  const index = buildIndex(docs);
  assert.equal(search(index, 'congés payés mois').length, 5);
  assert.deepEqual(search(index, Array.from({ length: 20_000 }, (_, i) => `mot${i}`).join(' ')), []);
  assert.ok(Date.now() - started < 30_000);
});

test('production : NFD, espace insécable, BOM, emoji, ligature et casse mixte', () => {
  assert.deepEqual(ids(search(INDEX, 'congés'.normalize('NFD'))), ['conges']);
  assert.equal(ids(search(INDEX, 'notes de frais'))[0], 'frais');
  assert.deepEqual(ids(search(INDEX, '﻿congés')), ['conges']);
  assert.deepEqual(ids(search(INDEX, 'congés 🌴')), ['conges']);
  assert.deepEqual(ids(search(INDEX, 'CoNgÉs')), ['conges']);
  assert.deepEqual(ids(search(buildIndex([{ id: 'pdf', title: 'Envoyer un ﬁchier', body: '' }]), 'fichier')), ['pdf']);
});

test('production : une espace de largeur nulle coupe le mot en deux', () => {
  assert.deepEqual(tokenise('con​gés'), ['con', 'ges']);
  assert.deepEqual(search(INDEX, 'con​gés'), []);
});

test('production : limites zéro et un, k1 nul, b à un', () => {
  assert.deepEqual(search(INDEX, 'le', { limit: 0 }), []);
  assert.deepEqual(ids(search(INDEX, 'le', { limit: 1 })), ['conges']);
  assert.equal(new Set(search(INDEX, 'le', { k1: 0 }).map((r) => r.score)).size, 1);
  assert.deepEqual(ids(search(INDEX, 'jours', { b: 1 })), ['teletravail', 'conges']);
});

test('production : une limite négative est refusée', () => {
  assert.throws(() => search(INDEX, 'le', { limit: -1 }), { name: 'RangeError', message: 'limit must be zero or more' });
});
