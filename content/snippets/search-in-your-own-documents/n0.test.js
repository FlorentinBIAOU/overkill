/**
 * Le fonds est un petit règlement intérieur, celui que toute entreprise a.
 *
 * Mêmes documents, mêmes requêtes et mêmes scores que n0.test.py, où tourne la
 * vraie table FTS5 de SQLite : ce fichier affirme reproduire ce qu'elle fait,
 * et c'est ce qui le tient honnête. L'essai interactif, qui importe cet
 * extrait, est testé en fin de fichier.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { buildIndex, search, tokenise } from './n0.js';
import { buildIndex as buildIndexN1, search as searchN1 } from './n1.js';
import essai from '../../tryouts/live/search-in-your-own-documents.js';

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

// Les six pages de l'essai.
const MANUEL = [
  ...HANDBOOK,
  {
    id: 'titres',
    title: 'Titres-restaurant',
    body: 'Un titre par jour de présence sur site. La part employeur est de soixante pour cent.',
  },
  {
    id: 'arret',
    title: 'Arrêt de travail',
    body: 'Le certificat médical part à la paie dans les quarante-huit heures. Le délai de '
      + 'carence est de trois jours.',
  },
];

const index = () => buildIndex(HANDBOOK);
const ids = (results) => results.map((result) => result.id);

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : une recherche par le sens', () => {
  assert.deepEqual(search(index(), 'combien de vacances puis-je poser'), []);
  assert.deepEqual(search(index(), 'puis-je travailler depuis chez moi'), []);
  // Témoin : les mêmes questions, dans les mots du document.
  assert.deepEqual(ids(search(index(), 'congés')), ['conges']);
  assert.equal(ids(search(index(), 'télétravail'))[0], 'teletravail');
});

test('point de rupture : « vacances » ne renvoie rien alors que la page s’intitule « Congés payés »', () => {
  assert.deepEqual(search(index(), 'combien de vacances puis-je poser'), []);
  assert.equal(HANDBOOK[0].title, 'Congés payés');
  assert.ok(!tokenise(HANDBOOK.map((d) => `${d.title} ${d.body}`).join(' ')).includes('vacances'));
  assert.deepEqual(search(index(), 'congés payés'), [{ id: 'conges', score: 3.1876 }]);
});

test('point de rupture : « congés responsable » ne renvoie rien faute d’une page portant les deux mots', () => {
  assert.deepEqual(search(index(), 'congés responsable'), []);
  assert.deepEqual(ids(search(index(), 'congés')), ['conges']);
  assert.deepEqual(ids(search(index(), 'responsable')), ['teletravail', 'materiel']);
  for (const document of HANDBOOK) {
    const words = new Set(tokenise(`${document.title} ${document.body}`));
    assert.ok(!(words.has('conges') && words.has('responsable')));
  }
});

test('point de rupture : le ET implicite aggrave le silence', () => {
  assert.deepEqual(search(index(), 'congés responsable'), []);
  assert.deepEqual(ids(searchN1(buildIndexN1(HANDBOOK), 'congés responsable')), ['conges', 'teletravail', 'materiel']);
  assert.deepEqual(search(index(), 'combien de vacances puis-je poser'), []);
  assert.deepEqual(ids(searchN1(buildIndexN1(HANDBOOK), 'combien de vacances puis-je poser')), ['frais', 'conges', 'materiel']);
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('le score est celui de bm25 de FTS5 au signe près', () => {
  // Commentaire : « Its bm25() is negated […]; the scores below are the plain
  // ones, bigger being better ». Les nombres sont ceux de la vraie table.
  assert.deepEqual(search(buildIndex(MANUEL), 'responsable'), [
    { id: 'teletravail', score: 0.7235 },
    { id: 'materiel', score: 0.6368 },
  ]);
});

test('les scores de FTS5 que le fichier JavaScript doit reproduire', () => {
  assert.deepEqual(search(index(), 'notes de frais'), [{ id: 'frais', score: 3.3722 }]);
  assert.deepEqual(search(index(), 'accord responsable'), [{ id: 'teletravail', score: 1.0534 }]);
  assert.deepEqual(search(index(), 'demi'), [{ id: 'conges', score: 0.6506 }]);
  const manuel = buildIndex(MANUEL);
  assert.deepEqual(search(manuel, 'notes de frais'), [{ id: 'frais', score: 5.1574 }]);
  assert.deepEqual(search(manuel, 'télétravail'), [
    { id: 'teletravail', score: 1.1988 },
    { id: 'conges', score: 0.6591 },
  ]);
  assert.deepEqual(search(manuel, 'trois jours'), [{ id: 'arret', score: 1.2796 }]);
});

test('Node 22 n’a pas node:sqlite sans drapeau, et sa version embarquée n’a pas FTS5', () => {
  // docstring : « Node 22 does ship `node:sqlite`, but it needs
  // --experimental-sqlite and the bundled build has no FTS5 module ».
  assert.match(process.version, /^v22\./);
  const plain = spawnSync(process.execPath, ['-e', "require('node:sqlite')"], { encoding: 'utf8' });
  assert.notEqual(plain.status, 0);
  assert.match(plain.stderr, /ERR_UNKNOWN_BUILTIN_MODULE/);
  const flagged = spawnSync(process.execPath, [
    '--experimental-sqlite', '-e',
    "const { DatabaseSync } = require('node:sqlite'); new DatabaseSync(':memory:').exec('CREATE VIRTUAL TABLE t USING fts5(a)')",
  ], { encoding: 'utf8' });
  assert.notEqual(flagged.status, 0);
  assert.match(flagged.stderr, /no such module: fts5/);
});

test('une requête pleine de syntaxe MATCH est cherchée, pas exécutée', () => {
  assert.deepEqual(tokenise('congés" paie'), ['conges', 'paie']);
  assert.deepEqual(ids(search(index(), 'congés" paie')), ['conges']);
  assert.deepEqual(search(index(), 'conges AND'), []);
  assert.deepEqual(search(index(), 'NEAR(congés paie)'), []);
  assert.deepEqual(search(index(), 'title:congés'), []);
});

test('une requête vide ne renvoie rien au lieu de lever', () => {
  for (const query of ['', '   ', '!?', '""', '«»']) {
    assert.deepEqual(search(index(), query), []);
  }
});

test('tous les termes de la requête doivent apparaître', () => {
  assert.deepEqual(search(index(), 'accord responsable'), [{ id: 'teletravail', score: 1.0534 }]);
  assert.deepEqual(search(index(), 'congés responsable'), []);
});

test('un titre l’emporte sur deux occurrences dans le corps', () => {
  assert.deepEqual(ids(search(index(), 'télétravail')), ['teletravail', 'conges']);
});

test('un mot du titre compte dix fois un mot du corps', () => {
  const filler = [0, 1, 2].map((i) => ({ id: `f${i}`, title: 'autre', body: 'a b c d e f g h i j' }));
  const title = { id: 'titre', title: 'zèbre', body: 'a b c d e f g h i j' };
  const ten = { id: 'corps', title: 'k', body: Array(10).fill('zèbre').join(' ') };
  const nine = { id: 'corps', title: 'k', body: `${Array(9).fill('zèbre').join(' ')} a` };
  assert.deepEqual(search(buildIndex([title, ten, ...filler]), 'zèbre'), [
    { id: 'corps', score: 0.6609 },
    { id: 'titre', score: 0.6609 },
  ]);
  assert.deepEqual(search(buildIndex([title, nine, ...filler]), 'zèbre'), [
    { id: 'titre', score: 0.6609 },
    { id: 'corps', score: 0.6532 },
  ]);
});

test('accents et casse ne comptent pas', () => {
  assert.deepEqual(search(index(), 'CONGÉS'), [{ id: 'conges', score: 1.5938 }]);
  assert.deepEqual(search(index(), 'conges'), search(index(), 'CONGÉS'));
});

test('le docstring dit « the same tokenizer » que FTS5, la ligature « ﬁ » est repliée ici et pas dans la table', async () => {
  // FTS5 (unicode61) indexe « ﬁchier » tel quel et ne le trouve ni par
  // « fichier » ni par « ﬁchier » depuis search() ; ce fichier le trouve.
  const connection = buildIndex([{ id: 'pdf', title: 'Envoyer un ﬁchier', body: '' }]);
  assert.deepEqual(search(connection, 'fichier'), []);
});

test('un mot présent dans la moitié des documents ou plus n’ajoute rien au score', () => {
  assert.deepEqual([...new Set(search(index(), 'le').map((r) => r.score))], [0]);
});

test('la limite est respectée', () => {
  assert.equal(search(index(), 'le', 2).length, 2);
});

test('l’extrait n’importe rien', () => {
  // risks.data_egress : none.
  const source = readFileSync(new URL('./n0.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s/m);
  assert.doesNotMatch(source, /import\(/);
});

test('deux index rendent les mêmes résultats', () => {
  for (const query of ['le', 'télétravail', 'notes de frais', 'responsable']) {
    assert.deepEqual(search(buildIndex(MANUEL), query), search(buildIndex(MANUEL), query));
  }
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : fonds vide et document sans texte', () => {
  assert.deepEqual(search(buildIndex([]), 'congés'), []);
  const connection = buildIndex([{ id: 'vide', title: '', body: '' }, { id: 'nul', title: null, body: 'congés' }]);
  assert.deepEqual(ids(search(connection, 'congés')), ['nul']);
});

test('production : dix mille pages et une page d’un million de mots', () => {
  const started = Date.now();
  const docs = Array.from({ length: 10_000 }, (_, i) => ({
    id: `d${String(i).padStart(5, '0')}`,
    title: `Page ${i}`,
    body: 'le salarié acquiert deux jours de congés payés par mois '.repeat(20),
  }));
  assert.equal(search(buildIndex(docs), 'congés payés').length, 5);
  const big = buildIndex([{ id: 'big', title: 'x', body: 'congés '.repeat(1_000_000) }]);
  assert.deepEqual(ids(search(big, 'congés')), ['big']);
  assert.ok(Date.now() - started < 30_000);
});

test('production : requête de vingt mille mots et cent mille guillemets', () => {
  const started = Date.now();
  assert.deepEqual(search(index(), Array.from({ length: 20_000 }, (_, i) => `mot${i}`).join(' ')), []);
  assert.deepEqual(ids(search(index(), `${'"'.repeat(100_000)}congés`)), ['conges']);
  assert.ok(Date.now() - started < 10_000);
});

test('production : NFD, espace insécable, BOM, emoji et casse mixte', () => {
  const connection = index();
  assert.deepEqual(ids(search(connection, 'congés'.normalize('NFD'))), ['conges']);
  assert.deepEqual(ids(search(connection, 'notes de frais')), ['frais']);
  assert.deepEqual(ids(search(connection, '﻿congés')), ['conges']);
  assert.deepEqual(ids(search(connection, 'congés 🌴')), ['conges']);
  assert.deepEqual(ids(search(connection, 'NoTeS dE fRaIs')), ['frais']);
  const nfd = buildIndex([{ id: 'nfd', title: 'Congés payés'.normalize('NFD'), body: '' }]);
  assert.deepEqual(ids(search(nfd, 'congés')), ['nfd']);
});

test('production : une espace de largeur nulle coupe le mot en deux', () => {
  assert.deepEqual(tokenise('con​gés'), ['con', 'ges']);
  assert.deepEqual(search(index(), 'con​gés'), []);
});

test('une élision dans la requête vide les résultats', async () => {
  assert.deepEqual(ids(search(index(), 'accord')), ['teletravail']);
  assert.deepEqual(ids(search(index(), 'l\'accord')), ['teletravail']);
});

test('production : limites zéro et un', () => {
  assert.deepEqual(search(index(), 'le', 0), []);
  assert.deepEqual(ids(search(index(), 'le', 1)), ['conges']);
});

test('une limite négative n’est pas refusée', async () => {
  // Deux pages pour « le » ici, trois en Python (LIMIT -1 de SQLite).
  let result;
  try {
    result = search(index(), 'le', -1);
  } catch (error) {
    if (error instanceof RangeError) return;
    throw error;
  }
  assert.deepEqual(result, []);
});

// ---------------------------------------------------------------------------
// L'essai interactif (niveau N0)
// ---------------------------------------------------------------------------

const input = (cas, lang) => (typeof cas.input === 'string' ? cas.input : cas.input[lang]);

test('essai : les pages de l’essai sont celles des tests, et elles sont six', () => {
  // note : « Six pages indexées ».
  const fr = essai.run('le', 'fr');
  assert.equal(fr.note, '4 pages sur 6 portent tous les mots cherchés.');
  assert.deepEqual(essai.run('trois jours', 'fr').rows.rows, [['Arrêt de travail', { v: '1,28', caught: true }]]);
});

test('essai : les mots du titre trouvent une seule page', () => {
  const [cas] = essai.cases;
  assert.deepEqual(essai.run(input(cas, 'fr'), 'fr').rows.rows, [['Notes de frais', { v: '5,16', caught: true }]]);
  assert.deepEqual(essai.run(input(cas, 'en'), 'en').rows.rows, [['Expense claims', { v: '5.14', caught: true }]]);
});

test('essai : un mot que deux pages emploient, le titre en tête', () => {
  const cas = essai.cases[1];
  assert.deepEqual(essai.run(input(cas, 'fr'), 'fr').rows.rows.map((r) => r[0]), ['Télétravail', 'Congés payés']);
  assert.deepEqual(essai.run(input(cas, 'en'), 'en').rows.rows.map((r) => r[0]), ['Remote working', 'Paid leave']);
});

test('essai : deux mots, une seule page', () => {
  const cas = essai.cases[2];
  assert.deepEqual(essai.run(input(cas, 'fr'), 'fr').rows.rows.map((r) => r[0]), ['Télétravail']);
  assert.deepEqual(essai.run(input(cas, 'en'), 'en').rows.rows.map((r) => r[0]), ['Remote working']);
});

test('essai : la question dans les mots du lecteur ne trouve rien, et le dit', () => {
  const cas = essai.cases[3];
  assert.equal(cas.fails, true);
  assert.deepEqual(essai.run(input(cas, 'fr'), 'fr').verdict, {
    label: 'Aucun résultat',
    detail: 'Aucune page ne contient : combien, vacances, puis, je, poser.',
  });
  assert.deepEqual(essai.run(input(cas, 'en'), 'en').verdict, {
    label: 'No result',
    detail: 'No page contains: how, much, holiday, can, i, book.',
  });
});

test('essai : en français, le ET implicite finit bien le travail', () => {
  // why fr : « Le ET implicite finit le travail ». Avec une règle OU, « de »
  // ramènerait des pages : c'est bien le ET qui achève le silence.
  const question = input(essai.cases[3], 'fr');
  assert.deepEqual(search(buildIndex(MANUEL), question), []);
  assert.ok(searchN1(buildIndexN1(MANUEL), question).length > 0);
});

const PAGES_EN = [
  { id: 'Paid leave', title: 'Paid leave', body: 'You earn two and a half days of paid leave for every month worked. The balance is printed on your payslip. Remote working changes nothing in that count, and a day of remote working is a day worked.' },
  { id: 'Remote working', title: 'Remote working', body: 'Two days a week are open, after written approval from your manager.' },
  { id: 'Expense claims', title: 'Expense claims', body: 'Expense claims are filed before the fifth of the month. The refund follows the payroll run of the month after.' },
  { id: 'IT equipment', title: 'IT equipment', body: 'Your workstation is replaced every four years. The request goes through your manager.' },
  { id: 'Meal vouchers', title: 'Meal vouchers', body: 'One voucher for every day spent on site. The employer pays sixty per cent of it.' },
  { id: 'Sick notes', title: 'Sick notes', body: 'The medical certificate reaches payroll within forty-eight hours. The waiting period is three days.' },
];

test('INFIRMÉ : le why anglais dit « The implicit AND finishes the job », aucun mot de la question n’est dans l’index', async () => {
  // Même fonds que l'essai : une requête ordinaire rend le score affiché.
  assert.deepEqual(search(buildIndex(PAGES_EN), 'expense claims'), [{ id: 'Expense claims', score: 5.1365 }]);
  const question = input(essai.cases[3], 'en');
  // Aucun des six mots n'est dans le règlement anglais : une règle OU ne
  // trouve rien non plus, le ET n'y est pour rien.
  assert.deepEqual(searchN1(buildIndexN1(PAGES_EN), question), []);
  await assert.rejects(async () => {
    assert.ok(searchN1(buildIndexN1(PAGES_EN), question).length > 0);
  });
});

test('essai : un mot présent dans la moitié des pages s’affiche à 0,00 partout', () => {
  // Constat : « paie » est dans trois pages sur six ; le poids plancher de
  // FTS5 fait afficher 0,00 sur chaque ligne.
  assert.deepEqual(essai.run('paie', 'fr').rows.rows.map((r) => r[1].v), ['0,00', '0,00', '0,00']);
});
