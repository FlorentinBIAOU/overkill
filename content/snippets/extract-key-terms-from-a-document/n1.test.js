import test from 'node:test';
import assert from 'node:assert/strict';

import { extractKeyTerms } from './n0.js';
import { extractKeyTermsInCorpus } from './n1.js';

const VIDES_FR = ('de des du la le les un une et ou à au aux en dans sur pour par avec sans '
  + 'sous est sont a ont ce cette ces qui que dont se son sa ses leur leurs ne '
  + 'pas plus il elle nous vous ils elles on y d l s n c j m t qu').split(' ');

/** Des conditions générales de vente : même passe-partout, un produit près. */
const cgv = (produit, detail) => `Conditions générales de vente

La société Lumière, immatriculée au registre du commerce, vend ${produit}.
${detail} Le client dispose d'un délai de rétractation de quatorze jours.
Les présentes conditions générales de vente sont soumises au droit français.`;

const CORPUS = [
  cgv('des moulins à café', 'Le moulin est garanti deux ans.'),
  cgv('des vélos électriques', 'La batterie du vélo est garantie deux ans.'),
  cgv('des imprimantes laser', 'La cartouche laser est garantie six mois.'),
  cgv('des casques audio', 'Le casque audio est garanti deux ans.'),
];

const textes = (rapport, index = 0) => rapport.documents[index].terms.map((t) => t.text);

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : le sujet de la collection disparaît de tous ses documents', () => {
  const rapport = extractKeyTermsInCorpus(CORPUS, VIDES_FR);
  const scores = new Map(rapport.documents[0].terms.map((t) => [t.key, t.score]));
  assert.equal(scores.get('vente'), 0);
  assert.equal(scores.get('conditions générales') ?? 0, 0);
});

test('point de rupture : témoin, le niveau N0 le fait remonter', () => {
  const sansCorpus = extractKeyTerms(CORPUS[0], VIDES_FR).terms
    .map((t) => t.text.toLowerCase());
  assert.ok(sansCorpus.some((terme) => terme.includes('conditions générales')));
});

// ---------------------------------------------------------------------------
// Le verdict, confronté aux données de la fiche
// ---------------------------------------------------------------------------

test('verdict : le corpus fait remonter ce qui distingue le document', () => {
  const seul = extractKeyTerms(CORPUS[0], VIDES_FR).terms.map((t) => t.text.toLowerCase());
  const avec = textes(extractKeyTermsInCorpus(CORPUS, VIDES_FR)).map((t) => t.toLowerCase());

  assert.ok(!seul.includes('moulin'));
  assert.ok(avec.includes('moulin') && avec.includes('café'));
  assert.ok(seul.some((t) => t.includes('conditions générales')));
  assert.ok(!avec.slice(0, 3).some((t) => t.includes('conditions générales')));
});

test('verdict : chaque document de la collection a son propre sujet', () => {
  const rapport = extractKeyTermsInCorpus(CORPUS, VIDES_FR);
  const premiers = [0, 1, 2, 3].map((index) => textes(rapport, index)[0].toLowerCase());
  assert.deepEqual(premiers, ['café', 'batterie', 'cartouche laser', 'casque audio']);
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test("un corpus de moins de deux documents est refusé", () => {
  for (const corpus of [[], [CORPUS[0]]]) {
    const rapport = extractKeyTermsInCorpus(corpus, VIDES_FR);
    assert.deepEqual(rapport.documents, []);
    assert.equal(rapport.reason, 'a corpus of at least two documents is required');
  }
});

test('la liste de mots vides est exigée', () => {
  assert.equal(extractKeyTermsInCorpus(CORPUS, []).reason,
    'a stop list is required, one per language');
});

test("le logarithme n'est pas plancher à un, contrairement à scikit-learn", () => {
  const partout = Math.log(CORPUS.length / CORPUS.length);
  const lisse = Math.log((1 + CORPUS.length) / (1 + CORPUS.length)) + 1;
  assert.equal(partout, 0);
  assert.equal(lisse, 1);
});

test("un terme d'un seul document pèse le plus", () => {
  const rapport = extractKeyTermsInCorpus(CORPUS, VIDES_FR);
  const unique = rapport.documents[0].terms.find((t) => t.key === 'café');
  assert.equal(unique.score, Math.floor(Math.log(4) * 10000 + 0.5) / 10000);
});

test("le classement ne dépend pas de l'ordre des égalités", () => {
  const corpus = ['alpha. bravo. charlie.', 'delta. echo.', 'alpha. foxtrot.'];
  assert.deepEqual(textes(extractKeyTermsInCorpus(corpus, VIDES_FR)),
    ['bravo', 'charlie', 'alpha']);
});

test('aucune entrée ne lève', () => {
  for (const entree of [null, undefined, 42, 'texte', {}]) {
    const rapport = extractKeyTermsInCorpus(entree, VIDES_FR);
    assert.deepEqual(rapport.documents, []);
    assert.ok(rapport.reason.startsWith('expected a list'));
  }
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : entrée banale, un dossier de contrats', () => {
  const rapport = extractKeyTermsInCorpus(CORPUS, VIDES_FR);
  assert.equal(rapport.documents.length, 4);
  assert.ok(rapport.documents.every((doc) => doc.terms.length > 0));
});

test('production : entrée vide', () => {
  const rapport = extractKeyTermsInCorpus(['', ''], VIDES_FR);
  assert.deepEqual(rapport.documents.map((doc) => doc.terms), [[], []]);
});

test('production : entrée très grande et terminaison rapide', () => {
  const enorme = [];
  for (let i = 0; i < 5; i += 1) for (const texte of CORPUS) enorme.push(texte.repeat(200));
  const debut = performance.now();
  const rapport = extractKeyTermsInCorpus(enorme, VIDES_FR);
  assert.ok(performance.now() - debut < 60_000);
  assert.equal(rapport.documents.length, 20);
});

test('production : valeurs aux limites', () => {
  const jumeaux = extractKeyTermsInCorpus([CORPUS[0], CORPUS[0]], VIDES_FR);
  assert.deepEqual([...new Set(jumeaux.documents[0].terms.map((t) => t.score))], [0]);
  const melange = extractKeyTermsInCorpus([CORPUS[0], '', CORPUS[1]], VIDES_FR);
  assert.deepEqual(melange.documents[1].terms, []);
  assert.ok(melange.documents[0].terms.length > 0);
});

test("production : un document illisible n'empêche pas de lire les autres", () => {
  const rapport = extractKeyTermsInCorpus([CORPUS[0], null, CORPUS[1]], VIDES_FR);
  assert.deepEqual(rapport.documents[1].terms, []);
  assert.equal(textes(rapport, 0)[0].toLowerCase(), 'café');
});

test('production : la lecture tient la classe de latence annoncée', () => {
  const debut = performance.now();
  for (let i = 0; i < 100; i += 1) extractKeyTermsInCorpus(CORPUS, VIDES_FR);
  assert.ok(performance.now() - debut < 30_000);
});
