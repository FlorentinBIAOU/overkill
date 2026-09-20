import test from 'node:test';
import assert from 'node:assert/strict';

import { HONORIFICS, LEGAL_FORMS, PARTICLES, extractNames } from './n0.js';

// Un paragraphe de presse française ordinaire : le public visé de la fiche.
const ARTICLE = 'Le contrat lie la société Lumière SARL à Jean de La Fontaine et à '
  + 'Mme Marie Martin, de Lyon. M. Boulanger a livré le colis mercredi.';

const lus = (texte) => extractNames(texte).names.map((n) => [n.text, n.type, n.evidence]);

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test("point de rupture : un nom sans marqueur n'est pas typé", () => {
  assert.deepEqual(lus('Le colis a été livré par Boulanger.'), [['Boulanger', 'unknown', null]]);
  assert.deepEqual(lus('Le colis part pour Lyon.'), [['Lyon', 'unknown', null]]);
});

test('point de rupture : témoin, un marqueur tranche dans les deux sens', () => {
  assert.deepEqual(lus('La société Boulanger a livré le colis.'),
    [['Boulanger', 'company', 'la société']]);
  assert.deepEqual(lus('M. Boulanger a livré le colis.'), [['Boulanger', 'person', 'm']]);
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('les trois familles de marqueurs sont reconnues', () => {
  assert.deepEqual(lus('Dr Martin et Pr Dupont')[0], ['Martin', 'person', 'dr']);
  assert.equal(lus("Jean d'Artagnan a signé.")[0][0], "Jean d'Artagnan");
  assert.deepEqual(lus('Acme Inc. a signé.')[0], ['Acme Inc', 'company', 'inc']);
  assert.deepEqual(lus('Le groupe Lumière a signé.')[0], ['Lumière', 'company', 'le groupe']);
});

test('une particule tient un nom ensemble', () => {
  assert.deepEqual(lus('Jean de La Fontaine'), [['Jean de La Fontaine', 'unknown', null]]);
  assert.ok(PARTICLES.has('de') && !PARTICLES.has('et'));
});

test("« et » ne tient pas un nom ensemble, et la fiche le dit", () => {
  assert.deepEqual(lus("L'enseigne Marks and Spencer ouvre à Lille."), [
    ['Marks', 'company', "l'enseigne"], ['Spencer', 'unknown', null], ['Lille', 'unknown', null]]);
  assert.deepEqual(lus('Le contrat lie Alex Ferguson et Acme Inc.').map((n) => n[0]),
    ['Alex Ferguson', 'Acme Inc']);
});

test('un mot capitalisé en tête de phrase est compté, pas rendu', () => {
  const rapport = extractNames('Boulanger a livré le colis.');
  assert.deepEqual(rapport.names, []);
  assert.equal(rapport.skipped_at_sentence_start, 1);
  assert.equal(extractNames('Le colis est parti.').skipped_at_sentence_start, 0);
});

test("un nom de plusieurs mots en tête de phrase est rendu", () => {
  assert.deepEqual(lus('Marie Martin a livré le colis.'), [['Marie Martin', 'unknown', null]]);
});

test('les marqueurs sont une liste déclarée faite pour être étendue', () => {
  assert.ok(HONORIFICS.has('mme') && LEGAL_FORMS.has('sarl'));
  assert.equal(lus('La société Lumière GmbH a signé.')[0][1], 'company');
});

test('aucune entrée ne lève', () => {
  for (const entree of [null, undefined, 42, [], {}, '']) {
    const rapport = extractNames(entree);
    assert.deepEqual(rapport.names, []);
    if (typeof entree !== 'string') assert.ok(rapport.reason.startsWith('expected text'));
  }
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test("production : entrée banale, un paragraphe de presse", () => {
  assert.deepEqual(lus(ARTICLE), [
    ['Lumière SARL', 'company', 'sarl'],
    ['Jean de La Fontaine', 'unknown', null],
    ['Marie Martin', 'person', 'mme'],
    ['Lyon', 'unknown', null],
    ['Boulanger', 'person', 'm'],
  ]);
});

test('production : entrée vide', () => {
  assert.deepEqual(extractNames(''),
    { names: [], skipped_at_sentence_start: 0, reason: null });
});

test('production : entrée très grande et terminaison rapide', () => {
  const enorme = ARTICLE.repeat(5000);
  const debut = performance.now();
  const rapport = extractNames(enorme);
  assert.ok(performance.now() - debut < 60_000);
  assert.equal(rapport.names.length, 5 * 5000);
});

test('production : encodages inattendus', () => {
  assert.deepEqual(lus('Mme  Marie Martin')[0], ['Marie Martin', 'person', 'mme']);
  assert.equal(lus('﻿M. Boulanger a signé.')[0][1], 'person');
  assert.equal(lus('ΑΘΗΝΑ Λτδ a signé.')[0][0], 'ΑΘΗΝΑ Λτδ');
});

test('production : valeurs aux limites', () => {
  assert.deepEqual(lus('A'), []);
  assert.deepEqual(lus('Le colis de A à Z.'), []);
  assert.deepEqual(lus('société lumière sarl'), []);
  assert.deepEqual(lus('IBM et SAP'), [['SAP', 'unknown', null]]);
});

test("production : un nom illisible n'empêche pas de lire les autres", () => {
  assert.deepEqual(lus('M. Boulanger, 42 ; Mme Martin.').map((n) => n[0]),
    ['Boulanger', 'Martin']);
});

test('production : la lecture tient la classe de latence annoncée', () => {
  const debut = performance.now();
  for (let i = 0; i < 1000; i += 1) extractNames(ARTICLE);
  assert.ok(performance.now() - debut < 20_000);
});
