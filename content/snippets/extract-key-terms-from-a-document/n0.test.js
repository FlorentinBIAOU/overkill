import test from 'node:test';
import assert from 'node:assert/strict';

import { MAX_WORDS, candidatesOf, extractKeyTerms } from './n0.js';

// Une liste de mots vides française réduite à ce qu'il faut pour ce test. En
// production elle vient d'une ressource par langue, pas d'une constante.
const VIDES_FR = ('de des du la le les un une et ou à au aux en dans sur pour par avec sans '
  + 'sous est sont a ont ce cette ces qui que dont se son sa ses leur leurs ne '
  + 'pas plus il elle nous vous ils elles on y d l s n c j m t qu').split(' ');

const VIDES_EN = ('the a an and or to of in on for with without is are be been this that '
  + 'these those it its their his her we you they').split(' ');

// Des conditions générales de vente : le document ordinaire du public visé.
const CGV = `Conditions générales de vente

La société Lumière, immatriculée au registre du commerce, vend des moulins à café.
Le moulin à café Lumière est garanti deux ans. La garantie couvre les pièces et
la main-d'oeuvre. Le client dispose d'un délai de rétractation de quatorze jours.
Les présentes conditions générales de vente sont soumises au droit français.`;

const ANGLAIS = `Terms and conditions of sale

Lumiere Ltd sells coffee grinders. The coffee grinder is covered by a two year
warranty. The customer has fourteen days to withdraw from the sale.`;

const textes = (rapport) => rapport.terms.map((terme) => terme.text);

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : un terme construit sur une préposition est coupé en deux', () => {
  const tous = candidatesOf(CGV, VIDES_FR);
  assert.ok(!tous.includes('moulin à café'));
  assert.ok(tous.includes('moulin') && tous.includes('café'));
});

test('point de rupture : témoin, un terme sans préposition revient entier', () => {
  assert.ok(candidatesOf(CGV, VIDES_FR).includes('droit français'));
  assert.ok(candidatesOf(CGV, VIDES_FR).includes('conditions générales'));
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('la liste de mots vides est exigée', () => {
  for (const liste of [null, undefined, []]) {
    const rapport = extractKeyTerms(CGV, liste);
    assert.deepEqual(rapport.terms, []);
    assert.equal(rapport.reason, 'a stop list is required, one per language');
  }
});

test('sans les mots vides de la bonne langue, le découpage ne veut rien dire', () => {
  const francais = candidatesOf(CGV, VIDES_FR);
  const anglais = candidatesOf(CGV, VIDES_EN);
  assert.ok(anglais.length < francais.length);
  assert.equal(Math.max(...anglais.map((c) => c.split(' ').length)), MAX_WORDS);
  assert.ok(francais.includes('société lumière'));
});

test('une phrase longue est coupée à la longueur déclarée', () => {
  assert.deepEqual(candidatesOf('alpha beta gamma delta epsilon zeta', VIDES_FR),
    ['alpha beta gamma delta', 'epsilon zeta']);
});

test("un nombre seul n'est pas un terme", () => {
  const lus = candidatesOf('Le délai est de 14 jours.', VIDES_FR);
  assert.ok(!lus.includes('14') && !lus.includes('14 jours'));
  assert.deepEqual(lus, ['délai', 'jours']);
});

test('le singulier et le pluriel sont deux termes', () => {
  const tous = candidatesOf('Le moulin Lumière. Les moulins Lumière.', VIDES_FR);
  assert.ok(tous.includes('moulin lumière') && tous.includes('moulins lumière'));
});

test('le même mot accentué de deux façons est un seul terme', () => {
  const compose = 'société Lumière'.normalize('NFD');
  assert.notEqual(compose, 'société Lumière');
  assert.deepEqual(candidatesOf(`société Lumière. ${compose}.`, VIDES_FR), ['société lumière']);
});

test("le classement ne dépend pas de l'ordre des égalités", () => {
  const premier = textes(extractKeyTerms('delta echo. alpha bravo. charlie foxtrot.', VIDES_FR));
  const inverse = textes(extractKeyTerms('alpha bravo. charlie foxtrot. delta echo.', VIDES_FR));
  assert.deepEqual(premier, inverse);
  assert.deepEqual(premier, ['alpha bravo', 'charlie foxtrot', 'delta echo']);
});

test('aucune entrée ne lève', () => {
  for (const entree of [null, undefined, 42, [], {}, '']) {
    const rapport = extractKeyTerms(entree, VIDES_FR);
    assert.deepEqual(rapport.terms, []);
    if (typeof entree !== 'string') assert.ok(rapport.reason.startsWith('expected text'));
  }
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : entrée banale, des conditions générales de vente', () => {
  const lus = textes(extractKeyTerms(CGV, VIDES_FR));
  assert.ok(lus.includes('garanti deux ans'));
  // Et le passe-partout du document arrive en tête, ce que N1 corrige.
  assert.ok(lus.some((terme) => terme.toLowerCase().includes('conditions générales')));
});

test('production : entrée vide', () => {
  assert.deepEqual(extractKeyTerms('', VIDES_FR), { terms: [], reason: null });
  assert.deepEqual(extractKeyTerms('   \n\n  ', VIDES_FR).terms, []);
});

test('production : entrée très grande et terminaison rapide', () => {
  const enorme = CGV.repeat(2000);
  const debut = performance.now();
  const rapport = extractKeyTerms(enorme, VIDES_FR);
  assert.ok(performance.now() - debut < 60_000);
  assert.equal(rapport.terms[0].count, 2000);
});

test('production : encodages inattendus', () => {
  assert.equal(extractKeyTerms('﻿moulin Lumière', VIDES_FR).terms[0].text, 'moulin Lumière');
  // L'espace insécable est une espace : elle sépare deux mots du même terme.
  assert.deepEqual(candidatesOf('moulin Lumière', VIDES_FR), ['moulin lumière']);
  assert.deepEqual(candidatesOf('emoji 🙂 moulin', VIDES_FR), ['emoji', 'moulin']);
});

test('production : valeurs aux limites', () => {
  assert.deepEqual(candidatesOf('a', VIDES_FR), []);
  assert.deepEqual(candidatesOf('ok', VIDES_FR), ['ok']);
  assert.deepEqual(candidatesOf('porte-monnaie', VIDES_FR), ['porte-monnaie']);
  assert.equal(extractKeyTerms(CGV, VIDES_FR, { top: 2 }).terms.length, 2);
});

test("production : un document sans aucun terme ne fait pas tomber le lot", () => {
  const lot = [CGV, 'de la le les', ANGLAIS];
  const rapports = lot.map((texte) => extractKeyTerms(texte, VIDES_FR));
  assert.deepEqual(rapports.map((r) => r.terms.length > 0), [true, false, true]);
});

test('production : la lecture tient la classe de latence annoncée', () => {
  const debut = performance.now();
  for (let i = 0; i < 1000; i += 1) extractKeyTerms(CGV, VIDES_FR);
  assert.ok(performance.now() - debut < 20_000);
});
