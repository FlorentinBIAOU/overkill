import { test } from 'node:test';
import assert from 'node:assert/strict';
import { score, tag, train } from './n1.js';

// A corpus the size of an afternoon of tagging: twenty-eight articles, four
// topics, some articles carrying two, one carrying none. It lives in the test
// because the corpus belongs to the newsroom, not to the snippet.
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

const MODEL = train(
  CORPUS.map(([article]) => article),
  CORPUS.map(([, topics]) => topics),
);

test('tags an article of a topic it was trained on', () => {
  const article =
    'Un message frauduleux invitait les salariés à saisir leur mot de passe ' +
    'sur un faux site de la banque.';
  assert.deepEqual(tag(MODEL, article), ['cybersécurité']);
});

test('an article comes back with two topics', () => {
  const article =
    'Les indemnités de télétravail versées aux salariés qui travaillent ' +
    "depuis chez eux entrent dans le calcul de l'impôt et de la TVA.";
  assert.deepEqual(tag(MODEL, article), ['fiscalité', 'télétravail']);
});

test('the topics do not compete for a single winner', () => {
  // One classifier per topic, each answering its own question. The scores are
  // therefore not a distribution and do not add up to one — which is exactly
  // what allows two topics to be right at the same time.
  const article = "Les indemnités de télétravail sont soumises à l'impôt et à la TVA.";
  const total = Object.values(score(MODEL, article)).reduce((a, b) => a + b, 0);
  assert.ok(total > 1);
});

test('an article outside every topic comes back empty', () => {
  assert.deepEqual(tag(MODEL, 'Le restaurant du coin a changé de carte.'), []);
  assert.deepEqual(tag(MODEL, ''), []);
});

test('the model only knows the topics of the corpus', () => {
  assert.deepEqual(MODEL.topics, ['cybersécurité', 'fiscalité', 'recrutement', 'télétravail']);
});

test('the threshold is yours to set', () => {
  // A second topic the model saw, but less clearly. Lowering the threshold
  // brings it back; that dial is the whole review policy of the newsroom.
  const article =
    "La prime de télétravail versée aux salariés est-elle soumise à l'impôt sur le revenu ?";
  assert.deepEqual(tag(MODEL, article), ['fiscalité']);
  assert.deepEqual(tag(MODEL, article, 0.3), ['fiscalité', 'télétravail']);
});

test('it clears the breaking point of N0', () => {
  // The article that defeats the controlled vocabulary of N0: remote work from
  // the first line to the last, and not one term of the topic's term list.
  // N1 reads "bureau", "semaine" and "visioconférence", which came with
  // the topic in the corpus, and tags it. This is the whole argument for
  // climbing one rung, and it is measured here rather than asserted on the page.
  const article =
    "Depuis le printemps, l'équipe ne se retrouve au bureau que le mardi. " +
    "Le reste de la semaine, chacun s'organise depuis chez lui, et les " +
    'réunions se tiennent en visioconférence.';
  assert.deepEqual(tag(MODEL, article), ['télétravail']);
});

test('breaking point: a topic absent from the labelled corpus', () => {
  // A classifier can only ever answer with a topic someone labelled. This
  // article is plainly about public subsidies, a subject the corpus never
  // names, so the topic simply does not exist for the model.
  //
  // Worse than silence: lowering the threshold to catch it does not surface a
  // missing topic, it files an article about subsidies under remote work. The
  // only repair is another round of hand-labelling, over the whole corpus,
  // every time the taxonomy grows.
  const article =
    'La région finance une partie du matériel acheté par les entreprises ' +
    "industrielles, via un guichet de subvention ouvert jusqu'en juin.";
  assert.ok(!MODEL.topics.includes('subventions'));
  assert.deepEqual(tag(MODEL, article), []);
  assert.deepEqual(tag(MODEL, article, 0.25), ['télétravail']);
});
