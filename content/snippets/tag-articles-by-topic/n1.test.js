/**
 * Tests du niveau N1 : TF-IDF et régression logistique un contre tous, écrits
 * à la main. Chaque test cite l'affirmation de la fiche qu'il démontre.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import essai from '../../tryouts/live/tag-articles-by-topic.js';
import { tag as tagN0 } from './n0.js';
import { score, tag, train } from './n1.js';

// Un fonds de la taille d'un après-midi d'étiquetage : vingt-huit articles,
// quatre thèmes, certains articles en portent deux, un n'en porte aucun. Il vit
// dans le test, parce que le fonds appartient à la rédaction et non à l'extrait.
const CORPUS = [
  ["La loi de finances relève le plafond du crédit d'impôt recherche pour les PME.", ['fiscalité']],
  ['Le taux de TVA applicable aux travaux de rénovation change au premier janvier.', ['fiscalité']],
  ['La déclaration fiscale des entreprises doit être déposée en ligne avant le 15 mai.', ['fiscalité']],
  ["L'administration fiscale précise le calcul de l'impôt sur les sociétés.", ['fiscalité']],
  ["Le barème de l'impôt sur le revenu est revalorisé pour tenir compte de l'inflation.", ['fiscalité']],
  ["Une facture sans mention de TVA expose l'entreprise à un redressement.", ['fiscalité']],
  ['Nous ouvrons un poste de développeur : les candidatures sont à envoyer avant la fin du mois.', ['recrutement']],
  ["L'entretien d'embauche se déroule en deux temps, un échange technique puis une rencontre avec l'équipe.", ['recrutement']],
  ["Le recrutement d'un profil senior demande plusieurs semaines de recherche.", ['recrutement']],
  ["Nous cherchons quelqu'un pour rejoindre l'équipe produit et l'accompagner sur la durée.", ['recrutement']],
  ['Trois cents candidatures sont arrivées pour une seule offre publiée la semaine dernière.', ['recrutement']],
  ["La période d'essai du nouveau salarié se termine à la fin du mois de mars.", ['recrutement']],
  ["L'équipe ne se retrouve au bureau que le mardi ; le reste de la semaine, chacun travaille depuis chez lui.", ['télétravail']],
  ['Les réunions se tiennent en visioconférence, ce qui demande un ordre du jour écrit.', ['télétravail']],
  ["Le télétravail deux jours par semaine est inscrit dans l'accord d'entreprise.", ['télétravail']],
  ['Travailler à distance depuis son domicile suppose des horaires clairs et un droit à la déconnexion.', ['télétravail']],
  ['Les bureaux ont été réduits de moitié depuis que chacun vient trois jours par semaine.', ['télétravail']],
  ["Un salarié installé loin du siège ne passe au bureau qu'une fois par mois.", ['télétravail']],
  ["Un rançongiciel a paralysé le système d'information d'une collectivité pendant plusieurs jours.", ['cybersécurité']],
  ["La campagne d'hameçonnage imitait un message de la banque de l'entreprise.", ['cybersécurité']],
  ['Changer les mots de passe ne suffit pas : il faut activer la double authentification.', ['cybersécurité']],
  ['Une fuite de données a exposé les adresses de milliers de clients.', ['cybersécurité']],
  ['Le correctif publié hier ferme une faille exploitée depuis une semaine.', ['cybersécurité']],
  ['Un message frauduleux invitait les salariés à saisir leur identifiant sur un faux site.', ['cybersécurité']],
  ['Le versement des indemnités de télétravail suit un régime de TVA particulier.', ['fiscalité', 'télétravail']],
  ["Le recrutement à distance impose de vérifier l'identité du candidat sans jamais le rencontrer.", ['recrutement', 'télétravail']],
  ["La prime versée aux salariés qui travaillent depuis chez eux entre dans l'assiette de l'impôt.", ['fiscalité', 'télétravail']],
  ['Le compte-rendu du conseil municipal est en ligne.', []],
];

const ARTICLES = CORPUS.map(([article]) => article);
const TOPICS = CORPUS.map(([, topics]) => topics);
const MODEL = train(ARTICLES, TOPICS);

const REMOTE_WORK_ARTICLE =
  "Depuis le printemps, l'équipe ne se retrouve au bureau que le mardi. " +
  "Le reste de la semaine, chacun s'organise depuis chez lui, et les " +
  'réunions se tiennent en visioconférence.';

const SUBSIDY_ARTICLE =
  'La région finance une partie du matériel acheté par les entreprises ' +
  "industrielles, via un guichet de subvention ouvert jusqu'en juin.";

const singleTopicArticles = (topic) =>
  CORPUS.filter(([, topics]) => topics.length === 1 && topics[0] === topic).map(([a]) => a);

const SOURCE = readFileSync(new URL('./n1.js', import.meta.url), 'utf8');

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : un thème absent du fonds étiqueté ressort vide', () => {
  assert.ok(!MODEL.topics.includes('subventions'));
  assert.deepEqual(tag(MODEL, SUBSIDY_ARTICLE), []);
  // Témoin : un article d'un thème étiqueté, au même seuil, est étiqueté.
  assert.deepEqual(
    tag(MODEL, 'Un message frauduleux invitait les salariés à saisir leur mot de passe sur un faux site.'),
    ['cybersécurité'],
  );
});

test('point de rupture : baisser le seuil classe l’article en télétravail', () => {
  const scored = score(MODEL, SUBSIDY_ARTICLE);
  const best = Object.keys(scored).sort((a, b) => scored[b] - scored[a])[0];
  assert.equal(best, 'télétravail');
  assert.deepEqual(tag(MODEL, SUBSIDY_ARTICLE, 0.25), ['télétravail']);
  assert.deepEqual(new Set(tag(MODEL, SUBSIDY_ARTICLE, 0)), new Set(MODEL.topics));
});

test('point de rupture : l’essai montre le même échec en français et en anglais', () => {
  // Cas 4 de l'essai : « L'article parle de subventions […] baisser le seuil
  // […] classe un article sur les subventions en télétravail ».
  const cas = essai.cases[3];
  assert.equal(cas.fails, true);
  const topRow = { fr: 'Télétravail', en: 'Remote work' };
  for (const lang of ['fr', 'en']) {
    const out = essai.run(cas.input[lang], lang);
    assert.equal(out.verdict.label, lang === 'fr' ? 'Aucune étiquette posée' : 'No tag attached');
    assert.equal(out.rows.rows[0][0].v, topRow[lang]);
  }
});

// ---------------------------------------------------------------------------
// Nom, docstring, commentaires
// ---------------------------------------------------------------------------

test('n1 est TF-IDF et un contre tous, écrit à la main sans dépendance', () => {
  // name ; docstring « Written out in full rather than pulled from a library ».
  assert.doesNotMatch(SOURCE, /\bimport\b|\brequire\(/);
  assert.equal(MODEL.classifiers.length, 4);
  assert.equal(MODEL.idf.length, MODEL.vocabulary.size);
});

test('bureau, visioconférence et domicile portent le thème du télétravail', () => {
  for (const word of ['bureau', 'visioconférence', 'domicile']) {
    const column = MODEL.vocabulary.get(word);
    MODEL.topics.forEach((topic, i) => {
      const weight = MODEL.classifiers[i].weights[column];
      if (topic === 'télétravail') assert.ok(weight > 0, word);
      else assert.ok(weight < 0, `${word} ${topic}`);
    });
  }
});

test('les thèmes ne se disputent pas un vainqueur unique', () => {
  const article = "Les indemnités de télétravail sont soumises à l'impôt et à la TVA.";
  const total = Object.values(score(MODEL, article)).reduce((a, b) => a + b, 0);
  assert.ok(total > 1);
});

test('chaque probabilité est indépendante des autres thèmes', () => {
  const article = "Les indemnités de télétravail sont soumises à l'impôt et à la TVA.";
  const twoTopics = train(ARTICLES, TOPICS.map((t) => t.filter((x) => x === 'fiscalité' || x === 'télétravail')));
  assert.equal(score(twoTopics, article).fiscalité, score(MODEL, article).fiscalité);
  const oneTopic = train(ARTICLES, TOPICS.map((t) => t.filter((x) => x === 'fiscalité')));
  assert.equal(score(oneTopic, article).fiscalité, score(MODEL, article).fiscalité);
});

test('un article ressort avec deux thèmes', () => {
  const article =
    'Les indemnités de télétravail versées aux salariés qui travaillent ' +
    "depuis chez eux entrent dans le calcul de l'impôt et de la TVA.";
  assert.deepEqual(tag(MODEL, article), ['fiscalité', 'télétravail']);
});

test('INFIRMÉ : « an article can come back with three tags » ; trois thèmes recopiés ressortent sans étiquette', () => {
  const article = ['cybersécurité', 'fiscalité', 'recrutement'].map((t) => singleTopicArticles(t).join(' ')).join(' ');
  assert.throws(() => {
    assert.deepEqual(tag(MODEL, article), ['cybersécurité', 'fiscalité', 'recrutement']);
  }, assert.AssertionError);
});

test('un article hors de tout thème ressort vide', () => {
  assert.deepEqual(tag(MODEL, 'Le restaurant du coin a changé de carte.'), []);
  assert.deepEqual(tag(MODEL, ''), []);
});

test('le modèle ne connaît que les thèmes du fonds', () => {
  assert.deepEqual(MODEL.topics, ['cybersécurité', 'fiscalité', 'recrutement', 'télétravail']);
});

test('étiquette un article d’un thème appris', () => {
  const article =
    'Un message frauduleux invitait les salariés à saisir leur mot de passe ' +
    'sur un faux site de la banque.';
  assert.deepEqual(tag(MODEL, article), ['cybersécurité']);
});

test('un article sans étiquette est un exemple négatif utile', () => {
  const withoutNegative = train(ARTICLES.slice(0, -1), TOPICS.slice(0, -1));
  const article = 'Le conseil municipal a voté le budget.';
  const max = (m) => Math.max(...Object.values(score(m, article)));
  assert.ok(max(MODEL) < max(withoutNegative) - 0.1);
});

test('INFIRMÉ : « "à distance" says more than "distance" alone » ; « à » est jeté, le bigramme n’existe pas', () => {
  assert.throws(() => assert.ok(MODEL.vocabulary.has('à distance')), assert.AssertionError);
});

test('les bigrammes sont des traits', () => {
  assert.ok(MODEL.vocabulary.has('travailler distance'));
  assert.ok(MODEL.vocabulary.has("d'impôt recherche") || MODEL.vocabulary.has('impôt recherche'));
});

test('le seuil est à vous', () => {
  const article = "La prime de télétravail versée aux salariés est-elle soumise à l'impôt sur le revenu ?";
  assert.deepEqual(tag(MODEL, article), ['fiscalité']);
  assert.deepEqual(tag(MODEL, article, 0.3), ['fiscalité', 'télétravail']);
});

test('monter le seuil retire des étiquettes, le baisser en ajoute', () => {
  const article = "La prime de télétravail versée aux salariés est-elle soumise à l'impôt sur le revenu ?";
  let previous;
  for (let step = 0; step <= 10; step += 1) {
    const kept = new Set(tag(MODEL, article, step / 10));
    if (previous) for (const t of kept) assert.ok(previous.has(t));
    previous = kept;
  }
  assert.ok(tag(MODEL, article, 0).length > 0);
  assert.deepEqual(tag(MODEL, article, 1), []);
});

test('le seuil n’est pas la seule molette : train en expose trois de plus', () => {
  // « it is the only dial here » : vrai pour `tag` ; en JavaScript, `train`
  // prend `epochs`, `rate` et `decay`, qui déplacent les scores.
  const stronger = train(ARTICLES, TOPICS, { decay: 0.05 });
  assert.ok(Math.abs(score(stronger, REMOTE_WORK_ARTICLE).télétravail - score(MODEL, REMOTE_WORK_ARTICLE).télétravail) > 0.1);
});

test('n1 rattrape le point de rupture de n0', () => {
  const vocabulary = {
    cybersécurité: ['cybersécurité', 'rançongiciel', 'hameçonnage', 'mot de passe'],
    fiscalité: ['fiscalité', 'impôt', 'TVA', "crédit d'impôt", 'déclaration fiscale'],
    recrutement: ['recrutement', 'embauche', 'candidat', "entretien d'embauche"],
    télétravail: ['télétravail', 'travail à distance', 'distanciel'],
  };
  assert.deepEqual(tagN0(REMOTE_WORK_ARTICLE, vocabulary), []);
  assert.deepEqual(tag(MODEL, REMOTE_WORK_ARTICLE), ['télétravail']);
});

test('n1 est déterministe', () => {
  assert.deepEqual(score(train(ARTICLES, TOPICS), REMOTE_WORK_ARTICLE), score(MODEL, REMOTE_WORK_ARTICLE));
});

test('une décision prend moins d’une milliseconde', () => {
  for (let i = 0; i < 50; i += 1) tag(MODEL, REMOTE_WORK_ARTICLE);
  let best = Infinity;
  for (let i = 0; i < 30; i += 1) {
    const start = performance.now();
    tag(MODEL, REMOTE_WORK_ARTICLE);
    best = Math.min(best, performance.now() - start);
  }
  assert.ok(best < 1, `${best} ms`);
});

test('l’essai étiquette ses trois premiers cas dans les deux langues', () => {
  const expected = [
    { fr: 'Étiquettes posées : Cybersécurité', en: 'Tags attached: Cybersecurity' },
    { fr: 'Étiquettes posées : Fiscalité, Télétravail', en: 'Tags attached: Remote work, Tax' },
    { fr: 'Étiquettes posées : Télétravail', en: 'Tags attached: Remote work' },
  ];
  expected.forEach((labels, i) => {
    assert.ok(!essai.cases[i].fails);
    for (const lang of ['fr', 'en']) assert.equal(essai.run(essai.cases[i].input[lang], lang).verdict.label, labels[lang]);
  });
});

test('l’essai entraîne quatre classifieurs sur 28 articles par langue', () => {
  // note : « Quatre classifieurs entraînés sur 28 articles étiquetés à la main ».
  const source = readFileSync(new URL('../../tryouts/live/tag-articles-by-topic.js', import.meta.url), 'utf8');
  for (const name of ['FONDS_FR', 'FONDS_EN']) {
    const block = source.slice(source.indexOf(`const ${name}`), source.indexOf('];', source.indexOf(`const ${name}`)));
    assert.equal(block.match(/^\s+\['/gm).length, 28, name);
  }
  for (const lang of ['fr', 'en']) assert.equal(essai.run('x', lang).rows.rows.length, 4);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('DÉFAUT : un fonds vide ou de longueurs différentes est accepté sans erreur', () => {
  // Python lève ValueError dans les deux cas. Ici, un fonds vide donne un
  // modèle sans thème qui ne pose jamais rien ; des listes de longueurs
  // différentes donnent des scores NaN, et aucun article n'est plus étiqueté.
  assert.throws(() => {
    assert.throws(() => train([], []));
    assert.throws(() => train(ARTICLES, TOPICS.slice(0, -2)));
  }, assert.AssertionError);
});

test('production : valeurs aux limites du seuil', () => {
  const exact = score(MODEL, REMOTE_WORK_ARTICLE).télétravail;
  assert.ok(tag(MODEL, REMOTE_WORK_ARTICLE, exact).includes('télétravail'));
  assert.ok(!tag(MODEL, REMOTE_WORK_ARTICLE, exact + 1e-9).includes('télétravail'));
  assert.equal(tag(MODEL, '', 0).length, 4);
});

test('production : un article de 700 Ko termine vite', () => {
  const article = ARTICLES.join(' ').repeat(300);
  const start = performance.now();
  tag(MODEL, article);
  assert.ok(performance.now() - start < 2000);
});

test('DÉFAUT : un fonds de trois cents articles ne s’entraîne pas', () => {
  // 300 articles de 500 mots : plus de 120 000 traits, et `Math.hypot(...vector)`
  // dépasse la pile (RangeError). Même en dessous, l'entraînement coûte
  // epochs × articles × traits × thèmes : 100 articles de 300 mots prennent
  // 0,4 s par époque, soit quatre minutes pour les 600 époques par défaut.
  // Le test borne une seule époque à 1 s ; Python entraîne le même fonds en 3,4 s.
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const lexicon = Array.from({ length: 3000 }, (_, i) => `mot${i}`);
  const articles = Array.from({ length: 300 }, () =>
    Array.from({ length: 500 }, () => lexicon[Math.floor(3000 * rnd() ** 2)]).join(' '),
  );
  const topics = articles.map((_, i) => [['a', 'b', 'c', 'd'][i % 4]]);
  assert.throws(() => {
    const start = performance.now();
    let model;
    try {
      model = train(articles, topics, { epochs: 1 });
    } catch (error) {
      assert.fail(`${error.name}: ${error.message}`);
    }
    assert.ok(performance.now() - start < 1000);
    assert.deepEqual(model.topics, ['a', 'b', 'c', 'd']);
  }, assert.AssertionError);
});

test('production : encodage NFD, insécables, emoji, BOM', () => {
  assert.deepEqual(tag(MODEL, REMOTE_WORK_ARTICLE.normalize('NFD')), ['télétravail']);
  assert.deepEqual(tag(MODEL, `﻿${REMOTE_WORK_ARTICLE.replaceAll(' ', ' ')} 🙂`), ['télétravail']);
  assert.deepEqual(tag(MODEL, REMOTE_WORK_ARTICLE.toUpperCase()), ['télétravail']);
});
