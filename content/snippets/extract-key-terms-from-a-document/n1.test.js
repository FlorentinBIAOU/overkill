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

// Un second corpus, hors du jeu de contrats de cette fiche : quatre comptes
// rendus de conseil municipal, courts, où les égalités de score dominent.
// C'est R4 et T4 — confronter le verdict à des données qu'il n'a pas choisies.
const CONSEIL = [
  'Le conseil municipal a approuvé le budget de la nouvelle médiathèque, rue des'
  + ' Frères-Lumière. Les travaux commenceront au printemps. Le maire a rappelé que la'
  + ' salle de lecture accueillera les scolaires.',
  "Le conseil municipal a voté la création d'une piste cyclable le long du canal. La"
  + ' piste cyclable reliera la gare au parc des sports, et sa mise en service est'
  + ' prévue pour septembre.',
  "Le conseil municipal a décidé d'étendre le stationnement payant au centre-ville. Le"
  + " stationnement payant s'appliquera du lundi au samedi, et les riverains garderont"
  + ' leur abonnement annuel.',
  "Le conseil municipal a validé la rénovation de l'école élémentaire Jean-Moulin."
  + " L'école accueillera deux classes de plus à la rentrée, et la cantine de l'école"
  + ' sera agrandie.',
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
  assert.deepEqual(premiers, ['moulins', 'vélos électriques', 'imprimantes laser',
    'casques audio']);
  // Les trois premiers de chaque document sont à égalité de score : c'est la
  // règle de départage qui les ordonne, et le rapport dit combien d'autres
  // partagent le score du dernier retenu.
  assert.deepEqual([0, 1, 2, 3].map((i) => textes(rapport, i).slice(0, 3)), [
    ['moulins', 'café', 'moulin'],
    ['vélos électriques', 'batterie', 'vélo'],
    ['imprimantes laser', 'cartouche laser', 'garantie six mois'],
    ['casques audio', 'casque audio', 'garanti deux ans'],
  ]);
  assert.deepEqual(rapport.documents.map((d) => d.tied_at_cut), [10, 10, 9, 9]);
});

test("verdict : un second corpus de documents courts, où les égalités dominent", () => {
  // R4 et T4 : le verdict confronté à des données qu'il n'a pas choisies.
  // Ce que N1 gagne : « conseil municipal » ouvre les quatre comptes rendus,
  // donc il n'est le sujet d'aucun. N0 le garde dans les trois premiers termes
  // des quatre documents ; N1 le fait disparaître partout.
  const vides = [...VIDES_FR, 'sera', 'seront', 'été', 'étaient', 'était'];
  const parN1 = extractKeyTermsInCorpus(CONSEIL, vides, { top: 3 });
  const premiers = parN1.documents.map((d) => d.terms.map((t) => t.text));
  assert.deepEqual(premiers, [
    ['nouvelle médiathèque', 'travaux commenceront', 'approuvé'],
    ['piste cyclable reliera', 'piste cyclable', 'voté'],
    ['stationnement payant', 'riverains garderont', 'abonnement annuel'],
    ['école élémentaire Jean-Moulin', 'validé', 'rénovation'],
  ]);
  const parN0 = CONSEIL.map((texte) => extractKeyTerms(texte, vides, { top: 3 })
    .terms.map((t) => t.text));
  assert.ok(parN0.every((termes) => termes.includes('conseil municipal')));
  assert.ok(!premiers.some((termes) => termes.includes('conseil municipal')));

  // Et ce que N1 ne gagne pas, dit ici plutôt que tu : sur ces documents
  // courts, un terme présent une fois dans son document et nulle part ailleurs
  // vaut log(4), comme tous ses voisins.
  const logQuatre = Math.floor(Math.log(4) * 10000 + 0.5) / 10000;
  assert.deepEqual(parN1.documents[0].terms.map((t) => t.score),
    [logQuatre, logQuatre, logQuatre]);
  assert.equal(parN1.documents[0].tied_at_cut, 8);
});

test("une égalité se départage par le sens, pas par l'alphabet", () => {
  // Commentaire : « What breaks the tie has to mean something — the longer
  // phrase first […] then the one that appears earliest. »
  const vides = [...VIDES_FR, 'sera', 'seront', 'été', 'étaient', 'était'];
  const termes = extractKeyTermsInCorpus(CONSEIL, vides, { top: 12 }).documents[0].terms;
  const logQuatre = Math.floor(Math.log(4) * 10000 + 0.5) / 10000;
  const aEgalite = termes.filter((t) => t.score === logQuatre);
  assert.ok(aEgalite.length >= 9);
  assert.equal(aEgalite[0].text, 'nouvelle médiathèque');
  assert.equal(aEgalite[0].key.split(' ').length, 2);
  const unMot = aEgalite.filter((t) => t.key.split(' ').length === 1);
  assert.deepEqual(unMot.map((t) => t.first), [...unMot.map((t) => t.first)].sort((a, b) => a - b));
  const ordre = aEgalite.map((t) => t.text);
  assert.ok(ordre.indexOf('nouvelle médiathèque') < ordre.indexOf('approuvé'));
});

test('le rapport dit combien de termes sont à égalité avec le dernier retenu', () => {
  // Commentaire : « How many terms outside the cut share the score of the last
  // one kept: a caller that reads « the top five » of twelve equals should
  // know. »
  const vides = [...VIDES_FR, 'sera', 'seront', 'été', 'étaient', 'était'];
  assert.equal(extractKeyTermsInCorpus(CONSEIL, vides, { top: 3 }).documents[0].tied_at_cut, 8);
  assert.equal(extractKeyTermsInCorpus(CONSEIL, vides, { top: 100 }).documents[0].tied_at_cut, 0);
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

test('aucune entrée ne lève, et la raison nomme ce qui a été reçu', () => {
  // R14 : la raison dit ce que le code a constaté — le type reçu.
  assert.equal(extractKeyTermsInCorpus(null, VIDES_FR).reason, 'expected a list, not object');
  assert.equal(extractKeyTermsInCorpus('texte', VIDES_FR).reason, 'expected a list, not string');
  for (const entree of [null, undefined, 42, 'texte', {}]) {
    const rapport = extractKeyTermsInCorpus(entree, VIDES_FR);
    assert.deepEqual(rapport.documents, []);
    assert.ok(rapport.reason.startsWith('expected a list, not '));
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
  assert.deepEqual(textes(rapport, 0).slice(0, 3), ['moulins', 'café', 'moulin']);
  assert.deepEqual(textes(rapport, 2).slice(0, 3), ['vélos électriques', 'batterie', 'vélo']);
});

test('production : la lecture tient la classe de latence annoncée', () => {
  const debut = performance.now();
  for (let i = 0; i < 100; i += 1) extractKeyTermsInCorpus(CORPUS, VIDES_FR);
  assert.ok(performance.now() - debut < 30_000);
});
