import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { detect, ngrams, probabilities, train } from './n1.js';
import * as n0 from './n0.js';

// One paragraph per language, the same samples the trigram profiles of N0 are
// built from. The samples live here, not in the snippet.
const SAMPLES = {
  fr: `
    Le train est arrivé avec un quart d'heure de retard, et personne sur le quai
    n'a semblé s'en étonner. Les voyageurs sont descendus lentement, leurs sacs à
    la main, puis la gare a retrouvé son calme habituel. Dans la salle d'attente,
    une femme lisait un journal tandis que son fils comptait les carreaux du sol.
    Il faisait froid dehors, mais le soleil de la fin du mois de mars donnait aux
    toits une couleur qui ne dure jamais très longtemps. Nous avons marché jusqu'au
    centre de la ville, où les commerces ouvraient les uns après les autres. Le
    boulanger nous a expliqué que la farine avait encore augmenté cette année, et
    que ses clients ne comprenaient pas toujours pourquoi le prix du pain suivait.
  `,
  en: `
    The train arrived a quarter of an hour late, and nobody on the platform seemed
    surprised by it. The passengers came down slowly, their bags in hand, and then
    the station went back to its usual quiet. In the waiting room a woman was
    reading a newspaper while her son counted the tiles on the floor. It was cold
    outside, but the sun at the end of March gave the roofs a colour that never
    lasts very long. We walked into the centre of the town, where the shops were
    opening one after another. The baker explained that flour had gone up again
    this year, and that his customers did not always understand why the price of
    bread followed.
  `,
  es: `
    El tren llegó con un cuarto de hora de retraso, y nadie en el andén pareció
    sorprenderse. Los viajeros bajaron despacio, con sus bolsas en la mano, y luego
    la estación volvió a su calma de siempre. En la sala de espera una mujer leía
    un periódico mientras su hijo contaba las baldosas del suelo. Hacía frío fuera,
    pero el sol de finales de marzo daba a los tejados un color que nunca dura
    mucho tiempo. Caminamos hasta el centro de la ciudad, donde las tiendas abrían
    una tras otra. El panadero nos explicó que la harina había subido otra vez este
    año, y que sus clientes no siempre entendían por qué el precio del pan seguía.
  `,
};

const MODEL = train(SAMPLES);
const N0_PROFILES = new Map(Object.entries(SAMPLES).map(([name, sample]) => [name, n0.profile(sample)]));

const FRENCH = 'La réunion de lundi est reportée au mercredi suivant, merci de prévenir les participants.';
const SPANISH = 'La reunión del lunes se ha trasladado al miércoles siguiente, avisad a los participantes.';
const MIXED = 'La réunion de lundi est reportée au mercredi suivant. '
  + 'Please let the London team know as soon as you can.';
const PORTUGUESE = 'O comboio chegou com um quarto de hora de atraso e ninguém na plataforma pareceu surpreendido.';
const GERMAN = 'Der Zug kam eine Viertelstunde zu spät an, und niemand auf dem Bahnsteig schien überrascht zu sein.';
const THRESHOLD = 0.9;

function n0Gap(text) {
  const scores = n0.ranked(text, N0_PROFILES);
  return scores[1][1] - scores[0][1];
}

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : sur le texte bilingue, le modèle répond français avec une quasi-certitude', () => {
  assert.ok(probabilities(MODEL, MIXED).fr > 0.99);
  assert.equal(detect(MODEL, MIXED, THRESHOLD), 'fr');
  // Witness: the same threshold does abstain on « ça va ».
  assert.equal(detect(MODEL, 'ça va', THRESHOLD), null);
});

test('point de rupture : le modèle n’a plus l’hésitation de N0 sur le texte bilingue', () => {
  assert.ok(n0Gap(MIXED) < n0Gap(FRENCH) / 2);
  assert.ok(probabilities(MODEL, MIXED).fr > 0.99);
  assert.ok(probabilities(MODEL, FRENCH).fr > 0.99);
});

test('point de rupture : un texte portugais ressort en espagnol au-dessus du seuil', () => {
  assert.equal(detect(MODEL, PORTUGUESE, THRESHOLD), 'es');
  assert.equal(detect(MODEL, SPANISH, THRESHOLD), 'es');
});

test('point de rupture : un texte allemand ressort en anglais au-dessus du seuil', () => {
  assert.equal(detect(MODEL, GERMAN, THRESHOLD), 'en');
  assert.equal(detect(MODEL, 'The meeting on Monday has been moved to Wednesday.', THRESHOLD), 'en');
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('détecte une phrase dans chaque langue', () => {
  assert.equal(detect(MODEL, FRENCH), 'fr');
  assert.equal(detect(MODEL, 'The meeting on Monday has been moved to the following Wednesday, please tell the attendees.'), 'en');
  assert.equal(detect(MODEL, SPANISH), 'es');
});

test('les traits sont des n-grammes d’un à trois caractères bornés aux mots', () => {
  const grams = ngrams('les tables');
  assert.deepEqual(new Set(grams.map((gram) => gram.length)), new Set([1, 2, 3]));
  assert.ok(grams.includes(' le') && grams.includes('les'));
  assert.ok(!grams.some((gram) => gram.trim().includes(' ')));
});

test('les probabilités somment à un sur les seules langues apprises', () => {
  for (const text of ['The meeting is on Monday.', PORTUGUESE, GERMAN, '']) {
    const scores = probabilities(MODEL, text);
    assert.deepEqual(Object.keys(scores).sort(), ['en', 'es', 'fr']);
    assert.ok(Math.abs(Object.values(scores).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  }
});

test('la réponse dit de combien la première langue devance les autres', () => {
  const scores = probabilities(MODEL, 'ça va');
  assert.ok(scores.fr > scores.es && scores.es > scores.en);
  assert.ok(scores.fr - scores.es > 0 && scores.fr - scores.es < 1);
});

test('un seul mot suffit quand il est distinctif', () => {
  assert.ok(probabilities(MODEL, 'Bonjour').fr > 0.9);
  assert.ok(probabilities(MODEL, 'Hola').es > 0.9);
});

test('la casse, les accents manquants et la ponctuation ne changent pas la réponse', () => {
  const shouted = 'LA REUNION DE LUNDI EST REPORTEE AU MERCREDI SUIVANT !!! MERCI DE PREVENIR LES PARTICIPANTS...';
  assert.equal(detect(MODEL, shouted), 'fr');
  const punctuated = "Réunion : lundi ?? non — mercredi (14h30) ; merci d'avertir les participants, s'il vous plaît.";
  assert.equal(detect(MODEL, punctuated), 'fr');
  assert.equal(detect(MODEL, 'LA REUNION DEL LUNES SE HA TRASLADADO AL MIERCOLES SIGUIENTE!!!'), 'es');
});

test('il sait s’abstenir là où N0 devait répondre', () => {
  assert.ok(probabilities(MODEL, 'ça va').fr < THRESHOLD);
  assert.equal(detect(MODEL, 'ça va', THRESHOLD), null);
  assert.equal(n0.detect('ça va', N0_PROFILES), 'en');
  // With no text at all, the answer is the prior and nothing else.
  assert.equal(detect(MODEL, '', 0.5), null);
});

test('à minimum zéro, il rend toujours un nom, comme N0', () => {
  assert.equal(detect(MODEL, ''), 'en');
  assert.ok(['fr', 'en', 'es'].includes(detect(MODEL, '12 !!')));
});

test('un lissage léger : un caractère jamais vu ne disqualifie pas la langue', () => {
  assert.equal(MODEL.counts.get('fr').get('ñ'), undefined);
  assert.equal(detect(MODEL, `${FRENCH} ñ`, THRESHOLD), 'fr');
  assert.equal(detect(MODEL, 'ñ'), 'es');
});

test('le modèle est une table de comptes', () => {
  const english = MODEL.counts.get('en');
  const total = [...english.values()].reduce((a, b) => a + b, 0);
  assert.equal(total, ngrams(SAMPLES.en).length);
  assert.ok([...english.values()].every(Number.isInteger));
});

test('verdict : la probabilité de N1 monte à la quasi-certitude quand l’écart de N0 s’effondre', () => {
  assert.ok(n0Gap(MIXED) < 5);
  assert.ok(probabilities(MODEL, MIXED).fr > 0.99);
});

test('INFIRMÉ : verdict_rationale dit que le seuil de N1 protège des textes courts, « chat » passe le seuil en anglais', async () => {
  await assert.rejects(async () => {
    assert.equal(detect(MODEL, 'ça va', THRESHOLD), null);
    assert.equal(detect(MODEL, 'chat', THRESHOLD), null);
  });
});

test('« chat » est anglais avec certitude', () => {
  assert.ok(probabilities(MODEL, 'chat').en > 0.9);
});

test('deux entraînements sur les mêmes échantillons rendent les mêmes probabilités', () => {
  assert.deepEqual(probabilities(train(SAMPLES), MIXED), probabilities(MODEL, MIXED));
});

test('l’extrait n’importe rien', () => {
  // docstring js : « Written out in full rather than pulled from a library » ; data_egress: none.
  const source = readFileSync(new URL('./n1.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s|\brequire\(|\bimport\(|\bfetch\(/m);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : texte vide et texte blanc rendent la loi a priori', () => {
  for (const text of ['', '   \n\t ']) {
    assert.ok(Object.values(probabilities(MODEL, text)).every((value) => Math.abs(value - 1 / 3) < 1e-12));
  }
});

test('production : une seule langue apprise rend cette langue avec probabilité un', () => {
  const single = train({ fr: SAMPLES.fr });
  assert.deepEqual(probabilities(single, GERMAN), { fr: 1 });
  assert.equal(detect(single, GERMAN, THRESHOLD), 'fr');
});

test('production : un texte d’un million de caractères termine sans débordement numérique', () => {
  // Commentaire : « multiplying a few thousand small numbers underflows to zero ».
  const big = Array(12_000).fill(FRENCH).join(' ');
  const debut = performance.now();
  const scores = probabilities(MODEL, big);
  assert.equal(scores.fr, 1);
  assert.ok(Math.abs(Object.values(scores).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.ok(performance.now() - debut < 20_000);
});

test('production : accents décomposés, espaces insécables, largeur nulle, BOM et emoji', () => {
  for (const text of [
    FRENCH.normalize('NFD'),
    FRENCH.replaceAll(' ', '\u00a0'),
    FRENCH.replace('réunion', 'réu\u200bnion'),
    `\ufeff${FRENCH}`,
    `🎉 ${FRENCH} 👍`,
  ]) {
    assert.equal(detect(MODEL, text, THRESHOLD), 'fr', JSON.stringify(text.slice(0, 12)));
  }
});

test('production : seuil exactement égal, juste au-dessus, et à un', () => {
  const top = Math.max(...Object.values(probabilities(MODEL, '')));
  assert.equal(detect(MODEL, '', top), 'en');
  assert.equal(detect(MODEL, '', top + 1e-9), null);
  assert.equal(detect(MODEL, MIXED, 1), null);
});
