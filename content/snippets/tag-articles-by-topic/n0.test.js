/**
 * Tests du niveau N0 : vocabulaire contrôlé, correspondance après repli des
 * suffixes. Chaque test cite l'affirmation de la fiche qu'il démontre.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lemmatise, normalise, stems, tag } from './n0.js';

// Le vocabulaire contrôlé d'une petite rédaction : quatre thèmes, et les termes
// qu'un rédacteur inscrirait pour chacun. Il vit dans le test, parce qu'il
// appartient à la rédaction et non au code.
const VOCABULARY = {
  cybersécurité: ['cybersécurité', 'rançongiciel', 'hameçonnage', 'mot de passe'],
  fiscalité: ['fiscalité', 'impôt', 'TVA', "crédit d'impôt", 'déclaration fiscale'],
  recrutement: ['recrutement', 'embauche', 'candidat', "entretien d'embauche"],
  télétravail: ['télétravail', 'travail à distance', 'distanciel'],
};

const REMOTE_WORK_ARTICLE =
  "Depuis le printemps, l'équipe ne se retrouve au bureau que le mardi. " +
  "Le reste de la semaine, chacun s'organise depuis chez lui, et les " +
  'réunions se tiennent en visioconférence.';

const SOURCE = readFileSync(new URL('./n0.js', import.meta.url), 'utf8');

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : un thème traité sans jamais être nommé', () => {
  // « L'équipe ne se retrouve au bureau que le mardi, les réunions se tiennent
  // en visioconférence » : aucun terme de la liste, l'article ressort vide.
  const cited = 'L’équipe ne se retrouve au bureau que le mardi, les réunions se tiennent en visioconférence';
  assert.deepEqual(tag(cited, VOCABULARY), []);
  assert.deepEqual(tag(REMOTE_WORK_ARTICLE, VOCABULARY), []);
  // Témoin : le même article, le thème nommé une fois, est étiqueté.
  assert.deepEqual(tag(`${cited}, le télétravail est la règle`, VOCABULARY), ['télétravail']);
});

test('point de rupture : la citation anglaise ressort sans étiquette', () => {
  const vocabulary = { 'remote work': ['remote work', 'working from home', 'telework'] };
  const cited = 'The team is only in the office on Tuesdays, meetings are held over video';
  assert.deepEqual(tag(cited, vocabulary), []);
  assert.deepEqual(tag(`${cited}; remote work is the rule`, vocabulary), ['remote work']);
});

test('point de rupture : la seule réparation est d’ajouter un terme', () => {
  const patched = { ...VOCABULARY, télétravail: [...VOCABULARY.télétravail, 'visioconférence'] };
  assert.deepEqual(tag(REMOTE_WORK_ARTICLE, patched), ['télétravail']);
  // L'article suivant, écrit autrement, repasse au travers.
  assert.deepEqual(tag('Chacun travaille depuis chez lui trois jours par semaine.', patched), []);
});

// ---------------------------------------------------------------------------
// Nom et docstring
// ---------------------------------------------------------------------------

test('INFIRMÉ : « lemmatisation » ; les formes fléchies d’un terme ne sont pas ramenées au terme', () => {
  assert.throws(() => {
    assert.deepEqual(tag('Nous embauchons deux développeurs.', { recrutement: ['embaucher'] }), ['recrutement']);
    assert.deepEqual(tag('Des avantages fiscaux pour les PME.', { fiscalité: ['avantage fiscal'] }), ['fiscalité']);
    assert.deepEqual(tag('Remote working is the norm.', { 'remote work': ['remote work'] }), ['remote work']);
  }, assert.AssertionError);
});

test('n0 est déterministe', () => {
  const article = "Le candidat a évoqué le télétravail et la TVA lors de l'entretien d'embauche.";
  const first = tag(article, VOCABULARY);
  for (let i = 0; i < 20; i += 1) assert.deepEqual(tag(article, VOCABULARY), first);
  const reversed = Object.fromEntries(Object.entries(VOCABULARY).reverse());
  assert.deepEqual(tag(article, reversed), first);
});

test('n0 n’emploie aucune dépendance', () => {
  // « no dependency » ; risks `vendor_lock: none`.
  assert.doesNotMatch(SOURCE, /\bimport\b|\brequire\(/);
});

test('chaque étiquette se remonte jusqu’au terme qui l’a produite', () => {
  // `tag` ne rend que les thèmes ; la trace se refait avec `stems`, exportée.
  const article = 'Le versement des indemnités de télétravail suit un régime de TVA particulier.';
  assert.deepEqual(tag(article, VOCABULARY), ['fiscalité', 'télétravail']);
  const haystack = stems(article);
  const traced = Object.fromEntries(
    Object.entries(VOCABULARY).map(([topic, terms]) => [topic, terms.filter((t) => haystack.includes(stems(t)))]),
  );
  assert.deepEqual(traced, { cybersécurité: [], fiscalité: ['TVA'], recrutement: [], télétravail: ['télétravail'] });
});

test('l’article et le vocabulaire passent par la même chaîne', () => {
  const article = 'changez vos mots de passe';
  assert.ok(!stems(article).includes(` ${normalise('mots de passe')} `));
  assert.ok(stems(article).includes(stems('mots de passe')));
});

test('un article porte plusieurs thèmes à la fois', () => {
  const article =
    'La loi de finances précise le régime de TVA applicable aux indemnités ' +
    "de télétravail, et prolonge le crédit d'impôt recherche.";
  assert.deepEqual(tag(article, VOCABULARY), ['fiscalité', 'télétravail']);
});

test('un article hors du vocabulaire ne porte aucun thème', () => {
  assert.deepEqual(tag('Le restaurant du coin a changé de carte.', VOCABULARY), []);
  assert.deepEqual(tag('', VOCABULARY), []);
});

test('étiquette un article du thème qu’il nomme', () => {
  assert.deepEqual(tag("La campagne d'hameçonnage imitait un message de la banque.", VOCABULARY), ['cybersécurité']);
});

test('casse, accents et pluriels ne coûtent rien', () => {
  for (const article of ['les impôts et la TVA', 'LES IMPÔTS ET LA TVA', "l'impôt et la tva", 'les impots et la tva']) {
    assert.deepEqual(tag(article, VOCABULARY), ['fiscalité'], article);
  }
  assert.equal(normalise('Fiscalité'), 'fiscalite');
  assert.equal(normalise('FISCALITE'), 'fiscalite');
});

test('un terme de plusieurs mots se trouve au pluriel de ses mots', () => {
  assert.deepEqual(tag('changez vos mots de passe', VOCABULARY), ['cybersécurité']);
  assert.equal(lemmatise('mots'), 'mot');
  assert.equal(normalise('Hameçonnage'), 'hameconnage');
});

test('un radical ne se trouve jamais dans un mot plus long', () => {
  assert.deepEqual(tag('un vieillard impotent', VOCABULARY), []);
  assert.equal(stems('impôts'), ' impot ');
  assert.deepEqual(tag('un impôt nouveau', VOCABULARY), ['fiscalité']);
});

test('le repli ne retire qu’une terminaison et garde trois lettres', () => {
  assert.equal(lemmatise('recrutements'), 'recrut');
  assert.equal(lemmatise('taxes'), 'tax');
  assert.equal(lemmatise('mes'), 'mes');
  assert.equal(lemmatise('rues'), 'rue');
});

test('les terminaisons qui se recouvrent sont essayées de la plus longue à la plus courte', () => {
  const suffixes = JSON.parse(SOURCE.match(/const SUFFIXES = (\[[^\]]*\])/)[1].replaceAll("'", '"'));
  suffixes.forEach((longer, i) => {
    for (const shorter of suffixes.slice(i + 1)) assert.ok(!shorter.endsWith(longer) || shorter === longer);
  });
  const lengths = suffixes.map((s) => s.length);
  assert.notDeepEqual(lengths, [...lengths].sort((a, b) => b - a));
});

test('le repli de suffixes confond aussi des mots distincts', () => {
  assert.equal(stems('poste'), ' post ');
  assert.equal(stems('post'), ' post ');
  assert.deepEqual(tag('Son post sur LinkedIn a fait réagir.', { recrutement: ['poste'] }), ['recrutement']);
});

test('INFIRMÉ : `minTerms` compte des termes distincts ; une seule mention de « crédit d’impôt » en compte deux', () => {
  assert.throws(() => {
    assert.deepEqual(tag("Le crédit d'impôt recherche est prolongé.", VOCABULARY, 2), []);
  }, assert.AssertionError);
});

test('minTerms compte des termes distincts, pas des occurrences', () => {
  assert.deepEqual(tag('Le candidat a signé hier.', VOCABULARY), ['recrutement']);
  assert.deepEqual(tag('Le candidat a signé hier.', VOCABULARY, 2), []);
  assert.deepEqual(tag('Candidat, candidat, candidat.', VOCABULARY, 2), []);
});

test('le thème le mieux étayé passe en premier', () => {
  const article =
    "Après l'entretien d'embauche, le candidat a demandé si le télétravail " +
    'était possible ; le recrutement est signé.';
  assert.deepEqual(tag(article, VOCABULARY), ['recrutement', 'télétravail']);
});

test('à égalité, les thèmes sont dans l’ordre alphabétique', () => {
  // Vrai en JavaScript (`localeCompare`) ; infirmé en Python, voir n0.test.py.
  const vocabulary = { économie: ['budget'], fiscalité: ['budget'], Zèbre: ['budget'], armée: ['budget'] };
  assert.deepEqual(tag('Le budget est voté.', vocabulary), ['armée', 'économie', 'fiscalité', 'Zèbre']);
});

test('le vocabulaire est un paramètre', () => {
  assert.deepEqual(tag('Le candidat a signé hier.', VOCABULARY), ['recrutement']);
  assert.deepEqual(tag('Le candidat a signé hier.', { 'ressources humaines': ['candidat'] }), ['ressources humaines']);
});

test('un article se traite en moins d’une milliseconde', () => {
  const words = 'la loi de finances précise le régime applicable aux indemnités versées salariés équipe'.split(' ');
  const article = Array.from({ length: 500 }, (_, i) => words[(i * 7) % words.length]).join(' ');
  for (let i = 0; i < 50; i += 1) tag(article, VOCABULARY);
  let best = Infinity;
  for (let i = 0; i < 20; i += 1) {
    const start = performance.now();
    tag(article, VOCABULARY);
    best = Math.min(best, performance.now() - start);
  }
  assert.ok(best < 1, `${best} ms`);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : entrées vides', () => {
  assert.deepEqual(tag('', VOCABULARY), []);
  assert.deepEqual(tag('Un article.', {}), []);
  assert.deepEqual(tag('Un article.', { vide: [] }), []);
});

test('DÉFAUT : `minTerms` à zéro n’est pas refusé et étiquette tous les thèmes sans terme', () => {
  assert.throws(() => {
    let out;
    try {
      out = tag('', VOCABULARY, 0);
    } catch {
      return;
    }
    assert.deepEqual(out, []);
  }, assert.AssertionError);
});

test('production : valeurs aux limites de minTerms', () => {
  const article = "L'entretien d'embauche du candidat pour le recrutement.";
  assert.deepEqual(tag(article, VOCABULARY, 4), ['recrutement']);
  assert.deepEqual(tag(article, VOCABULARY, 5), []);
  assert.deepEqual(tag(article, VOCABULARY, 1), ['recrutement']);
});

test('production : un gros volume termine vite', () => {
  const article =
    'La loi de finances précise le régime de TVA applicable aux indemnités ' +
    "de télétravail, et prolonge le crédit d'impôt recherche. ";
  const vocabulary = Object.fromEntries(
    Array.from({ length: 200 }, (_, i) => [`thème ${i}`, [`terme${i}`, `expression numéro ${i}`, 'impôt']]),
  );
  const start = performance.now();
  const out = tag(article.repeat(3000), vocabulary);
  assert.ok(performance.now() - start < 5000);
  assert.equal(out.length, 200);
});

test('production : encodage NFD, insécables, apostrophe, emoji, BOM', () => {
  const nfd = 'Le télétravail'.normalize('NFD');
  assert.notEqual(nfd, 'Le télétravail');
  assert.deepEqual(tag(nfd, VOCABULARY), ['télétravail']);
  assert.deepEqual(tag('crédit d’impôt', VOCABULARY), ['fiscalité']);
  assert.deepEqual(tag("crédit d'impôt", VOCABULARY), ['fiscalité']);
  assert.deepEqual(tag('﻿TÉLÉTRAVAIL 🙂', VOCABULARY), ['télétravail']);
  assert.deepEqual(tag('Le TéLéTrAvAiL', VOCABULARY), ['télétravail']);
});

test('DÉFAUT : un caractère invisible dans un mot cache le terme', () => {
  assert.throws(() => {
    assert.deepEqual(tag('Le télé­travail progresse.', VOCABULARY), ['télétravail']);
    assert.deepEqual(tag('Le télé​travail progresse.', VOCABULARY), ['télétravail']);
  }, assert.AssertionError);
});

test('DÉFAUT : « oe » et la ligature « œ » ne se rencontrent pas', () => {
  assert.throws(() => {
    assert.deepEqual(tag("Le coût de la main-d'oeuvre augmente.", { emploi: ["main-d'œuvre"] }), ['emploi']);
  }, assert.AssertionError);
});
