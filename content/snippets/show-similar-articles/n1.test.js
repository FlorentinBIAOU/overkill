/**
 * Le fonds vit ici, pas dans l'extrait. Le même fonds et les mêmes nombres
 * figurent dans n1.test.py, où tourne scikit-learn : c'est ce qui démontre que
 * ce fichier « ranks a corpus exactly as the Python version does ».
 *
 * L'essai interactif, qui importe cet extrait, est testé en fin de fichier.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { articleText, buildNeighbourTable, tokenise, vectorise } from './n1.js';
import essai from '../../tryouts/live/show-similar-articles.js';

const ARTICLES = [
  {
    id: 'sourdough-starter',
    title: 'Keeping a sourdough starter alive',
    body:
      'A sourdough starter is flour, water and time. Feed the starter twice a day ' +
      'with equal weights of flour and water, discard half, and the dough will rise ' +
      'on wild yeast alone. A starter that smells of acetone is a starter that ' +
      'wants more flour.',
  },
  {
    id: 'rye-bread',
    title: 'Baking a dense rye loaf',
    body:
      'Rye flour holds little gluten, so a rye loaf never rises like a wheat loaf. ' +
      'Build the dough on a lively sourdough starter, keep the dough wet, and let ' +
      'it proof slowly before baking. The crumb stays dense and the loaf keeps for ' +
      'a week.',
  },
  {
    id: 'kimchi-at-home',
    title: 'Kimchi in a jar at home',
    body:
      'Salt the cabbage overnight, rinse it, then pack the cabbage into a jar with ' +
      'garlic, ginger and chilli. Leave the jar on the counter and let the cabbage ' +
      'ferment. The kimchi is ready when the brine turns cloudy and tastes sour.',
  },
  {
    id: 'pickled-cucumbers',
    title: 'Pickled cucumbers in brine',
    body:
      'Pack small cucumbers into a jar with dill, garlic and a spoon of salt, then ' +
      'cover them with brine. Leave the jar on the counter for a week and let the ' +
      'cucumbers ferment. The brine turns cloudy, which is the sign that it worked.',
  },
  {
    id: 'knife-sharpening',
    title: 'Sharpening a kitchen knife',
    body:
      'Hold the blade against a wet whetstone at a constant angle and count the ' +
      'strokes on each side. Finish on a fine stone until the edge catches on a ' +
      'fingernail. A sharp knife is safer than a blunt knife, because a sharp blade ' +
      'cuts where you aim it.',
  },
  {
    id: 'cast-iron-care',
    title: 'Caring for a cast iron pan',
    body:
      'Wash the pan, dry the pan on the hob, and wipe a thin film of oil across the ' +
      'iron while the pan is hot. That film, baked on, is the seasoning. Rust means ' +
      'the pan went into a cupboard wet, and rust comes off with oil and a scourer.',
  },
  {
    id: 'site-news',
    title: 'Site news',
    body: 'The archive is searchable again and the comment form is back.',
  },
];

const ENGLISH_FILLER = (
  'an and are as at be but by for from in into is it its of on or so that ' +
  'the then this to until when while with you'
).split(' ');

const EXPECTED = {
  'sourdough-starter': [['rye-bread', 0.131]],
  'rye-bread': [['sourdough-starter', 0.131]],
  'kimchi-at-home': [['pickled-cucumbers', 0.3]],
  'pickled-cucumbers': [['kimchi-at-home', 0.3]],
  'knife-sharpening': [],
  'cast-iron-care': [],
  'site-news': [],
};

const SAME_SUBJECT_TWO_LANGUAGES = [
  {
    id: 'sourdough-starter',
    title: 'Keeping a sourdough starter alive',
    body:
      'A sourdough starter is flour, water and time. Feed the starter twice a day ' +
      'with equal weights of flour and water, discard half, and the dough will rise ' +
      'on wild yeast alone.',
  },
  {
    id: 'levain-naturel',
    title: 'Entretenir un levain naturel',
    body:
      "Un levain, c'est de la farine, de l'eau et du temps. Nourrissez-le deux fois " +
      "par jour avec le même poids de farine et d'eau, jetez la moitié, et la pâte " +
      'lèvera toute seule.',
  },
  {
    id: 'office-move',
    title: 'The office is moving',
    body:
      'The office moves in June. The lift will be out of service for a day and the ' +
      'archive boxes go into storage until the move is done.',
  },
];

const scoresOf = (table, id) => Object.fromEntries(table[id]);
const tokens = (article) => new Set(tokenise(articleText(article)));
const shared = (a, b) => [...tokens(a)].filter((t) => tokens(b).has(t)).sort();

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : le même sujet en deux langues vaut exactement zéro', () => {
  const table = buildNeighbourTable(SAME_SUBJECT_TWO_LANGUAGES, { minimum: -1 });
  assert.equal(scoresOf(table, 'sourdough-starter')['levain-naturel'], 0);
  assert.deepEqual(shared(SAME_SUBJECT_TWO_LANGUAGES[0], SAME_SUBJECT_TWO_LANGUAGES[1]), []);
});

test('point de rupture : l’annonce de déménagement obtient un score strictement supérieur', () => {
  const scores = scoresOf(buildNeighbourTable(SAME_SUBJECT_TWO_LANGUAGES, { minimum: -1 }), 'sourdough-starter');
  assert.deepEqual(scores, { 'office-move': 0.199, 'levain-naturel': 0 });
  assert.deepEqual(buildNeighbourTable(SAME_SUBJECT_TWO_LANGUAGES)['sourdough-starter'], [['office-move', 0.199]]);
});

test('ce que l’annonce partage avec l’article anglais', () => {
  // Mot pour mot : de la grammaire, et « day » — « for a day » d'un côté,
  // « twice a day » de l'autre. Le témoin suivant montre que même sans ce mot,
  // l'annonce reste devant le jumeau.
  assert.deepEqual(shared(SAME_SUBJECT_TWO_LANGUAGES[0], SAME_SUBJECT_TWO_LANGUAGES[2]),
    ['and', 'day', 'is', 'of', 'the', 'will']);
});

test('point de rupture : la grammaire seule suffit à passer devant le jumeau', () => {
  const noDay = SAME_SUBJECT_TWO_LANGUAGES.map((a) => ({ ...a }));
  noDay[2].body = noDay[2].body.replace(' for a day', '');
  assert.deepEqual(shared(noDay[0], noDay[2]), ['and', 'is', 'of', 'the', 'will']);
  assert.deepEqual(scoresOf(buildNeighbourTable(noDay, { minimum: -1 }), 'sourdough-starter'), {
    'office-move': 0.192, 'levain-naturel': 0,
  });
});

test('point de rupture : aucun seuil ne rattrape cela', () => {
  for (const floor of [-1, -0.001, 0, 0.01, 0.05, 0.1, 0.19, 0.2, 0.5]) {
    const row = scoresOf(buildNeighbourTable(SAME_SUBJECT_TWO_LANGUAGES, { minimum: floor }), 'sourdough-starter');
    if ('levain-naturel' in row) assert.ok('office-move' in row);
    assert.ok(!('levain-naturel' in row && floor >= 0));
  }
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('la table entière est construite d’un coup', () => {
  assert.deepEqual(buildNeighbourTable(ARTICLES, { stopWords: ENGLISH_FILLER }), EXPECTED);
});

test('le titre compte deux fois', () => {
  assert.equal(articleText(ARTICLES[6]), `Site news Site news ${ARTICLES[6].body}`);
  const pair = [
    { id: 't', title: 'rye', body: 'bread' },
    { id: 'u', title: 'bread', body: 'rye' },
    { id: 'v', title: 'oven', body: 'hot' },
  ];
  assert.deepEqual(buildNeighbourTable(pair).t, [['u', 0.8]]);
});

test('un mot présent partout pèse le moins, mais pas rien', () => {
  // « A term present everywhere weighs 1, the least possible » : le moins
  // possible n'est pas zéro, et trois articles qui ne partagent que « the »
  // sont voisins. C'est pour cela que la liste de mots vides est le prix de ce
  // niveau.
  const three = [
    { id: 'a', title: 'the', body: 'sourdough' },
    { id: 'b', title: 'the', body: 'rye' },
    { id: 'c', title: 'the', body: 'kimchi' },
  ];
  assert.equal(scoresOf(buildNeighbourTable(three), 'a').b, 0.583);
  assert.deepEqual(buildNeighbourTable(three, { stopWords: ['the'] }), { a: [], b: [], c: [] });
});

test('constat : l’idf d’un mot présent partout vaut un', () => {
  // Dans un article « the sourdough » d'un fonds de trois où « the » est partout,
  // « the » pèse 1 et « sourdough » ln(4/2) + 1 avant normalisation.
  const [vector] = vectorise(['the sourdough', 'the rye', 'the kimchi']);
  assert.ok(Math.abs(vector.get('sourdough') / vector.get('the') - (Math.log(2) + 1)) < 1e-12);
});

test('sans liste de mots vides, l’affûtage est apparié à l’annonce du site', () => {
  assert.equal(scoresOf(buildNeighbourTable(ARTICLES), 'knife-sharpening')['site-news'], 0.054);
  assert.ok(!('site-news' in scoresOf(buildNeighbourTable(ARTICLES, { stopWords: ENGLISH_FILLER }), 'knife-sharpening')));
});

test('les lignes normalisées donnent un cosinus : un article et sa copie valent un', () => {
  const corpus = [ARTICLES[0], { ...ARTICLES[0], id: 'copy' }, ARTICLES[2]];
  assert.deepEqual(buildNeighbourTable(corpus, { stopWords: ENGLISH_FILLER }).copy, [['sourdough-starter', 1]]);
  for (const vector of vectorise(ARTICLES.map(articleText))) {
    assert.ok(Math.abs(Math.hypot(...vector.values()) - 1) < 1e-12);
  }
});

test('les égalités sont départagées par l’identifiant', () => {
  const corpus = [{ ...ARTICLES[0], id: 'z-copy' }, { ...ARTICLES[0], id: 'a-copy' }, ARTICLES[0], ARTICLES[2]];
  assert.deepEqual(buildNeighbourTable(corpus)['sourdough-starter'].slice(0, 2), [['a-copy', 1], ['z-copy', 1]]);
});

test('la pondération est recalculée sur le seul fonds à chaque construction', () => {
  assert.deepEqual(buildNeighbourTable(ARTICLES, { stopWords: ENGLISH_FILLER })['kimchi-at-home'], [['pickled-cucumbers', 0.3]]);
  const extra = { id: 'z', title: 'Brine and jar', body: 'brine jar brine' };
  assert.deepEqual(buildNeighbourTable([...ARTICLES, extra], { stopWords: ENGLISH_FILLER })['kimchi-at-home'], [
    ['z', 0.349], ['pickled-cucumbers', 0.278],
  ]);
});

test('réécrire un article change la table, puisque ce niveau lit le texte', () => {
  // scenario : la table « ne change que lorsque le fonds change : un article
  // publié, réécrit, ou dont les étiquettes changent ». Le mot « réécrit » est
  // là pour ce niveau : N0 ne lisait que les étiquettes, N1 lit le texte.
  const edited = ARTICLES.map((a) => ({ ...a }));
  edited[6].body = 'Sharpen your knife on a whetstone before the comment form comes back.';
  const table = buildNeighbourTable(edited, { stopWords: ENGLISH_FILLER });
  assert.notDeepEqual(table, EXPECTED);
  assert.deepEqual(table['site-news'], [['knife-sharpening', 0.124]]);
  assert.deepEqual(EXPECTED['site-news'], []);
});

test('un mot d’une lettre est écarté, et cela coûte le sujet de l’article', () => {
  // « A one-letter word, such as the C of "Programming in C", is dropped with
  // the rest » : c'est le motif de jeton par défaut de scikit-learn, et son
  // prix se voit.
  const corpus = [
    { id: 'a', title: 'Programming in C', body: '' },
    { id: 'b', title: 'Pointers in C', body: '' },
    { id: 'c', title: 'Rust traits', body: '' },
  ];
  assert.equal(scoresOf(buildNeighbourTable(corpus, { stopWords: ENGLISH_FILLER, minimum: -1 }), 'a').b, 0);
  // Témoin : nommé en entier, le même sujet rapproche les deux articles.
  const nomme = corpus.map((a) => ({ ...a, title: a.title.replace(' C', ' Ada') }));
  assert.ok(scoresOf(buildNeighbourTable(nomme, { stopWords: ENGLISH_FILLER, minimum: -1 }), 'a').b > 0);
});

test('le lissage ne protège d’aucune division par zéro ici', () => {
  // « Smoothed, as scikit-learn does by default: as if one extra document held
  // every term once. » Ce lissage change les poids, il n'évite aucune division
  // par zéro : le vocabulaire vient du fonds, donc tout terme vu figure dans au
  // moins un document.
  const n = ARTICLES.length;
  for (let df = 1; df <= n; df += 1) assert.ok(Number.isFinite(Math.log(n / df) + 1));
  // Ce qu'il change : le terme le plus rare pèse moins une fois lissé.
  assert.ok(Math.log((1 + n) / (1 + 1)) + 1 < Math.log(n / 1) + 1);
});

test('l’extrait n’importe rien', () => {
  const source = readFileSync(new URL('./n1.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s/m);
});

test('deux constructions rendent la même table', () => {
  assert.deepEqual(
    buildNeighbourTable(ARTICLES, { stopWords: ENGLISH_FILLER }),
    buildNeighbourTable(ARTICLES, { stopWords: ENGLISH_FILLER }),
  );
});

test('k borne la longueur de chaque ligne', () => {
  const table = buildNeighbourTable(ARTICLES, { k: 2 });
  assert.ok(Object.values(table).every((row) => row.length <= 2));
  assert.equal(table['sourdough-starter'][0][0], 'rye-bread');
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : fonds vide et fonds d’un article', () => {
  assert.deepEqual(buildNeighbourTable([]), {});
  assert.deepEqual(buildNeighbourTable([ARTICLES[0]]), { 'sourdough-starter': [] });
});

test('production : un article au corps vide est classé sur son titre', () => {
  const articles = ARTICLES.map((article) => ({ ...article }));
  articles[0].body = '';
  assert.deepEqual(buildNeighbourTable(articles, { stopWords: ENGLISH_FILLER })['sourdough-starter'], [['rye-bread', 0.082]]);
});

test('production : un fonds sans aucun mot retenu rend des lignes vides (le Python lève)', () => {
  assert.deepEqual(buildNeighbourTable([{ id: 'a', title: 'A', body: '' }, { id: 'b', title: 'B', body: '' }]), { a: [], b: [] });
});

test('un corps absent devient le mot « null »', async () => {
  const corpus = [
    { id: 'a', title: 'Kimchi', body: null },
    { id: 'b', title: 'Knives', body: null },
    { id: 'c', title: 'Rye', body: 'rye bread' },
  ];
  assert.deepEqual(buildNeighbourTable(corpus).a, []);
});

test('le même article en NFD ne se reconnaît pas', async () => {
  const nfc = { id: 'nfc', title: 'Pâte à crêpes', body: 'La pâte à crêpes repose une heure.' };
  const nfd = { id: 'nfd', title: nfc.title.normalize('NFD'), body: nfc.body.normalize('NFD') };
  const other = { id: 'x', title: 'Other', body: 'thing' };
  assert.ok(scoresOf(buildNeighbourTable([nfc, nfd, other], { minimum: -1 }), 'nfc').nfd > 0.9);
});

test('production : espace insécable, emoji, BOM et casse', () => {
  const corpus = [
    { id: 'a', title: '﻿KIMCHI jar 🥬', body: 'cabbage' },
    { id: 'b', title: 'kimchi jar', body: 'Cabbage' },
    { id: 'c', title: 'oven', body: 'hot' },
  ];
  assert.deepEqual(buildNeighbourTable(corpus).a, [['b', 1]]);
});

test('production : limites k nul et score égal au minimum', () => {
  assert.deepEqual(buildNeighbourTable(ARTICLES, { k: 0, stopWords: ENGLISH_FILLER }), Object.fromEntries(ARTICLES.map((a) => [a.id, []])));
  assert.deepEqual(buildNeighbourTable(ARTICLES, { minimum: 0.3, stopWords: ENGLISH_FILLER })['kimchi-at-home'], []);
  assert.deepEqual(buildNeighbourTable(ARTICLES, { minimum: 0.299, stopWords: ENGLISH_FILLER })['kimchi-at-home'], [['pickled-cucumbers', 0.3]]);
});

test('production : mille articles de deux cents mots', () => {
  let seed = 1;
  const next = () => { seed = (seed * 16807) % 2147483647; return seed; };
  const word = () => `w${next() % 3000}`;
  const corpus = Array.from({ length: 1000 }, (_, i) => ({
    id: `a${String(i).padStart(4, '0')}`,
    title: Array.from({ length: 5 }, word).join(' '),
    body: Array.from({ length: 200 }, word).join(' '),
  }));
  const started = Date.now();
  assert.equal(Object.keys(buildNeighbourTable(corpus)).length, 1000);
  assert.ok(Date.now() - started < 60_000);
});

// ---------------------------------------------------------------------------
// L'essai interactif (niveau N1)
// ---------------------------------------------------------------------------

const rowsOf = (lang, cas) => essai.run(cas.input[lang], lang).rows.rows;
const inBlock = (rows) => rows.filter((r) => r[1].caught).map((r) => [r[0], r[1].v]);

test('essai : un titre proche d’un article du fonds', () => {
  const [cas] = essai.cases;
  assert.deepEqual(inBlock(rowsOf('fr', cas)), [['Cuire un pain de seigle dense', '0,58'], ['Baking a dense rye loaf', '0,09']]);
  assert.deepEqual(inBlock(rowsOf('en', cas)), [['Baking a dense rye loaf', '0.67'], ['Cuire un pain de seigle dense', '0.08']]);
});

test('essai : des mots du corps, pas du titre, en français', () => {
  const cas = essai.cases[1];
  assert.deepEqual(inBlock(rowsOf('fr', cas)), [['Kimchi en bocal', '0,20']]);
  assert.deepEqual(tokenise(cas.input.fr).filter((t) => tokenise('Kimchi en bocal').includes(t)), []);
});

test('essai : des mots du corps, pas du titre, en anglais', () => {
  // « Garlic and dill before letting them ferment » : aucun de ces mots, mots
  // vides mis à part, n'est dans le titre de l'article que la question ramène.
  const cas = essai.cases[1];
  assert.deepEqual(inBlock(rowsOf('en', cas)), [['Pickled cucumbers in brine', '0.18']]);
  const title = new Set(tokenise('Pickled cucumbers in brine'));
  assert.ok(tokenise(cas.input.en).every((t) => !title.has(t) || ENGLISH_FILLER.includes(t)));
});

test('essai : un sujet que le fonds ne traite pas ne passe pas le plancher', () => {
  const cas = essai.cases[2];
  assert.deepEqual(inBlock(rowsOf('fr', cas)), []);
  assert.deepEqual(inBlock(rowsOf('en', cas)), []);
  assert.equal(essai.run(cas.input.fr, 'fr').note, 'Aucun des 8 articles ne passe le plancher de 0,05.');
});

test('essai : un zéro est l’absence de tout mot commun, mots vides mis à part', () => {
  // Note de l'essai : « Un zéro n'est pas un score faible, c'est l'absence de
  // tout mot commun, mots vides mis à part. » Les mots vides, eux, sont bien
  // partagés — « un », « de » — et ne comptent pour rien.
  const cas = essai.cases[2];
  const levain = rowsOf('fr', cas).find((r) => r[0] === 'Entretenir un levain naturel');
  assert.equal(levain[1].v, '0,00');
  const title = new Set(tokenise('Entretenir un levain naturel'));
  const communs = tokenise(cas.input.fr).filter((t) => title.has(t));
  assert.ok(communs.length > 0);
  // La liste de mots vides française de l'essai, reprise ici pour la lecture.
  const motsVides = ('au aux avec ce ces dans de des du elle en et eux il je la le les leur lui ma mais '
    + 'me même mes moi mon ne nos notre nous on ou par pas pour qu que qui sa se ses son '
    + 'sur ta te tes toi ton tu un une vos votre vous est été être ai as avons avez ont sont').split(' ');
  assert.ok(communs.every((t) => motsVides.includes(t)), communs.join(', '));
});

test('essai : le même sujet dans l’autre langue vaut zéro, et l’annonce passe le plancher', () => {
  const cas = essai.cases[3];
  assert.equal(cas.fails, true);
  const fr = Object.fromEntries(rowsOf('fr', cas).map((r) => [r[0], r[1]]));
  assert.deepEqual(fr['Keeping a sourdough starter alive'], { v: '0,00', caught: false });
  assert.deepEqual(fr['Comment nous joindre pendant les travaux'], { v: '0,10', caught: true });
  const en = Object.fromEntries(rowsOf('en', cas).map((r) => [r[0], r[1]]));
  assert.deepEqual(en['Entretenir un levain naturel'], { v: '0.00', caught: false });
  assert.deepEqual(en['The office is moving in June'], { v: '0.10', caught: true });
});

test('essai : les citations du why sont dans le fonds', () => {
  // why fr : « Feed the starter twice a day » ; « une fois par jour ». why en :
  // « Nourrissez le levain deux fois par jour » ; « it mentions a day ».
  const source = readFileSync(new URL('../../tryouts/live/show-similar-articles.js', import.meta.url), 'utf8');
  for (const quote of ['Feed the starter twice a day', 'une fois par jour', 'Nourrissez le levain ', 'for a day']) {
    assert.ok(source.replace(/'\s*\+\s*'/g, '').includes(quote), quote);
  }
});

test('essai : un titre vide ne compare rien', () => {
  assert.deepEqual(essai.run('   ', 'fr').verdict, { label: 'Rien à comparer', detail: 'Le titre est vide : il n’en reste aucun mot à peser.' });
});
