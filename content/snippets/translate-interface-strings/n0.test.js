/**
 * Tests du niveau N0 : mémoire de traduction, correspondance exacte puis
 * approchée. La mémoire ci-dessous est ce qu'un projet possède après une
 * première vague de traduction. Elle vit ici et non dans l'extrait.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { index, lookup, normalise, placeholders, ratio } from './n0.js';

const MEMORY = {
  Save: 'Enregistrer',
  'Save changes': 'Enregistrer les modifications',
  'Delete this item?': 'Supprimer cet élément ?',
  '{count} items selected': '{count} éléments sélectionnés',
  'Your session has expired': 'Votre session a expiré',
};

const WARNING = 'interpolation variables differ from the source string';
const round3 = (value) => Number(value.toFixed(3));
// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : une chaîne nouvelle n’a aucune correspondance', () => {
  const result = lookup('Two-factor authentication is required for administrators', MEMORY);
  assert.deepEqual(result, { status: 'none', target: null, score: 0.375, matched: null, review: false, warnings: [] });
  // Témoin : une chaîne proche de la mémoire, elle, remonte sa traduction.
  assert.equal(lookup('Your session has expired.', MEMORY).target, 'Votre session a expiré');
});

// ---------------------------------------------------------------------------
// Nom et docstring
// ---------------------------------------------------------------------------

test('une correspondance exacte part telle quelle', () => {
  assert.deepEqual(lookup('Save changes', MEMORY), {
    status: 'exact', target: 'Enregistrer les modifications', score: 1,
    matched: 'Save changes', review: false, warnings: [],
  });
});

test('une majuscule corrigée ou une double espace donnent une approchée à relire', () => {
  // Le repli du rapprochement ignore casse, accents et espaces multiples : la
  // chaîne est retrouvée, à 1,0. Mais elle n'est pas la même que celle du
  // souvenir, donc c'est une approchée, renvoyée en relecture, pas une exacte.
  for (const source of ['save   changes', 'SAVE CHANGES']) {
    const result = lookup(source, MEMORY);
    assert.equal(result.status, 'fuzzy', source);
    assert.deepEqual([result.score, result.review, result.matched], [1, true, 'Save changes']);
  }
  assert.equal(normalise('Élément  SUPPRIMÉ'), 'element supprime');
});

test('un mot ajouté donne une correspondance approchée à relire', () => {
  const result = lookup('Save all changes', MEMORY);
  assert.equal(result.status, 'fuzzy');
  assert.equal(result.matched, 'Save changes');
  assert.equal(result.target, 'Enregistrer les modifications');
  assert.equal(round3(result.score), 0.857);
  assert.equal(result.review, true);
});

test('une variable déplacée ne remonte rien au seuil par défaut', () => {
  // Une variable qui change de place change assez la chaîne pour que la mémoire
  // ne la reconnaisse plus : 0,727 et 0,6, l'un et l'autre sous le seuil.
  for (const [moved, note] of [['{count} selected items', 0.727], ['Selected: {count} items', 0.6]]) {
    const result = lookup(moved, MEMORY);
    assert.equal(result.status, 'none', moved);
    assert.equal(Math.round(result.score * 1000) / 1000, note);
  }
  // Témoin : au-dessous du seuil, la même chaîne remonte, en relecture.
  const proche = lookup('{count} selected items', MEMORY, 0.7);
  assert.equal(proche.target, '{count} éléments sélectionnés');
  assert.equal(proche.review, true);
});

test('le seuil décide de ce qui mérite d’être montré', () => {
  assert.equal(lookup('Save all changes', MEMORY, 0.9).status, 'none');
  const exactly = lookup('abce', { abcd: 'x' });
  assert.equal(exactly.score, 0.75);
  assert.equal(exactly.status, 'fuzzy');
  assert.equal(lookup('abce', { abcd: 'x' }, 0.7500001).status, 'none');
});

test('n0 n’emploie aucun modèle ni service', () => {
  const source = readFileSync(new URL('./n0.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bimport\b|\brequire\(/);
});

test('n0 est déterministe', () => {
  const first = lookup('Save all changes', MEMORY);
  for (let i = 0; i < 10; i += 1) assert.deepEqual(lookup('Save all changes', MEMORY), first);
});

test('« Fold case, accents […] which are not what makes a string new » ; « polish » rend « Polonais » sans relecture', () => {
  assert.equal(lookup('polish', { Polish: 'Polonais' }).review, true);
  assert.equal(lookup('Resume', { Résumé: 'CV' }).review, true);
});

test('une correspondance approchée n’est jamais rendue comme finie', () => {
  for (const source of ['Save all changes', 'Delete this items?', 'Your session expired']) {
    const result = lookup(source, MEMORY);
    assert.equal(result.status, 'fuzzy', source);
    assert.equal(result.review, true);
    assert.ok(result.score < 1);
  }
});

test('une variable déplacée n’est pas un problème, une variable perdue si', () => {
  assert.deepEqual(placeholders('Delete {count} of {total}'), placeholders('{total}: {count}'));
  const result = lookup('{count} items selected', { '{count} items selected': 'Éléments sélectionnés' });
  assert.equal(result.status, 'exact');
  assert.equal(result.review, true);
  assert.deepEqual(result.warnings, [WARNING]);
});

test('une variable ajoutée depuis l’an dernier est signalée sur l’approchée', () => {
  const result = lookup('{count} items selected', { 'Items selected': 'Éléments sélectionnés' });
  assert.equal(result.status, 'fuzzy');
  assert.equal(round3(result.score), 0.778);
  assert.deepEqual(result.warnings, [WARNING]);
});

test('les formes de variables annoncées sont reconnues', () => {
  assert.deepEqual(
    placeholders('{count} {} %s %d %(count)s %1$s %2$d'),
    ['{count}', '{}', '%s', '%d', '%(count)s', '%1$s', '%2$d'].sort(),
  );
});

test('« Android and iOS string files » ; %@, %1$@ et %ld ne sont pas reconnues', () => {
  assert.deepEqual(placeholders('%@ items, %1$@ of %2$@, %ld left'), ['%@', '%1$@', '%2$@', '%ld'].sort());
});

test('le score est celui de difflib sans heuristique de rebut', () => {
  // « Ported here so both versions of this snippet return the very same score
  // on the very same pair » : les valeurs sont celles de Python (n0.test.py).
  const a = 'x'.repeat(150) + 'The quick brown fox jumps over the lazy dog '.repeat(3);
  const b = 'y'.repeat(100) + 'The quick brown fox jumped over the lazy dogs '.repeat(3);
  assert.equal(ratio(a, b), 0.49615384615384617);
  assert.equal(ratio('Save 🙂 changes', 'Save changes 🙂'), 0.8571428571428571);
  assert.equal(ratio('', ''), 1);
  assert.equal(lookup('Two-factor authentication is required for administrators', MEMORY).score, 0.375);
});

test('une chaîne vide et une mémoire vide ne rendent rien', () => {
  assert.equal(lookup('', MEMORY).status, 'none');
  assert.equal(lookup('Save', {}).status, 'none');
  assert.equal(lookup('Save', {}).target, null);
});

test('une chaîne inchangée ne déclenche aucun calcul de score', () => {
  // « The exact match is settled first, by lookup in a map, and only a string
  // that is not in the memory is scored against every entry of it. » La chaîne
  // cherchée est la dernière de mille : avant, l'extrait notait les neuf cent
  // quatre-vingt-dix-neuf autres d'abord.
  const paires = Array.from({ length: 1000 }, (_, i) => [`Label number ${i}`, `Libellé numéro ${i}`]);
  const memory = Object.fromEntries(paires);
  const derniere = 'Label number 999';
  let parcours = 0;
  // Un proxy qui compte les parcours de la mémoire : `Object.entries` les
  // demande toutes, la recherche exacte n'en demande aucune.
  const comptee = new Proxy(memory, {
    ownKeys(cible) { parcours += 1; return Reflect.ownKeys(cible); },
  });

  const exact = index(memory);
  const result = lookup(derniere, comptee, 0.75, exact);
  assert.equal(result.status, 'exact');
  assert.equal(result.target, 'Libellé numéro 999');
  assert.equal(parcours, 0);
  // Et sans index fourni, elle n'est parcourue que pour le construire.
  assert.deepEqual(lookup(derniere, comptee), result);
  assert.equal(parcours, 1);
  // Une chaîne absente, elle, est bien notée contre toute la mémoire.
  assert.equal(lookup('Something entirely new here', comptee, 0.75, exact).status, 'none');
  assert.equal(parcours, 2);
});

test('production : une passe de publication tient dans une borne large', () => {
  // La borne attrape un effondrement, elle ne mesure pas : deux cents chaînes
  // inchangées contre mille connues tiennent en moins d'une milliseconde
  // mesurée, et la borne est à deux secondes.
  const memory = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`Label number ${i}`, `Libellé numéro ${i}`]));
  const exact = index(memory);
  const debut = performance.now();
  for (let i = 0; i < 200; i += 1) {
    assert.equal(lookup(`Label number ${i}`, memory, 0.75, exact).status, 'exact');
  }
  assert.ok(performance.now() - debut < 2000);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : encodage NFD, insécable, emoji, casse', () => {
  assert.equal(lookup('Delete this item?'.normalize('NFD'), MEMORY).status, 'exact');
  assert.equal(lookup('Save changes', MEMORY).status, 'exact');
  // `exactKey` compose la chaîne et retire les caractères de format : une chaîne
  // en NFD est la même chaîne. La casse, elle, en fait une autre.
  assert.equal(lookup('SAVE CHANGES', MEMORY).status, 'fuzzy');
  assert.equal(round3(lookup('Save 🙂 changes', { 'Save changes 🙂': 'x' }).score), 0.857);
});

test('production : une marque d’ordre des octets ne fait pas une autre chaîne', () => {
  // `exactKey` : « Fold only what cannot change the words: composition, format
  // characters, spacing ». U+FEFF est un caractère de format, retiré avant la
  // comparaison, ici comme en Python.
  const result = lookup('﻿Save changes', MEMORY);
  assert.equal(result.status, 'exact');
  assert.equal(result.review, false);
});

test('production : un caractère de largeur nulle envoie en relecture', () => {
  assert.equal(lookup('Save​changes', MEMORY).review, true);
});

test('production : une mémoire de mille chaînes termine', () => {
  const memory = Object.fromEntries(
    Array.from({ length: 1000 }, (_, i) => [`Label number ${i} for the settings page`, `Libellé ${i}`]),
  );
  const start = performance.now();
  assert.equal(lookup('Label number 517 for the settings page', memory).target, 'Libellé 517');
  assert.ok(performance.now() - start < 5000);
});

test('une mémoire de textes longs rend chaque recherche lente', () => {
  const mots = ('the a your to of settings account save delete item items selected changes password '
    + 'email is has been was not could be error try again later update profile notification').split(' ');
  const paragraph = (k) => Array.from({ length: 250 }, (_, i) => mots[(i * k + 3) % mots.length]).join(' ');
  const memory = Object.fromEntries(Array.from({ length: 20 }, (_, k) => [paragraph(k + 1), 'aide']));
  const start = performance.now();
  lookup(`${paragraph(7)} now`, memory);
  assert.ok(performance.now() - start < 500);
});

test('les variables ICU et i18next ne sont pas vérifiées', () => {
  const icu = '{count, plural, one {# item} other {# items}}';
  assert.equal(lookup(icu, { [icu]: 'éléments' }).review, true);
  assert.equal(lookup('{{count}} items', { '{{count}} items': '{count} éléments' }).review, true);
});
