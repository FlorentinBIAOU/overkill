import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detect, profile, ranked } from './n0.js';

// One paragraph per language is enough to rank three hundred trigrams. The
// samples live here, not in the snippet: the snippet builds a profile from
// whatever sample you give it.
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

const PROFILES = new Map(Object.entries(SAMPLES).map(([name, sample]) => [name, profile(sample)]));

/** How far the winner is ahead of the runner-up. */
function gap(text) {
  const scores = ranked(text, PROFILES);
  return scores[1][1] - scores[0][1];
}

test('detects a sentence in each language', () => {
  assert.equal(detect('La réunion de lundi est reportée au mercredi suivant, merci de prévenir les participants.', PROFILES), 'fr');
  assert.equal(detect('The meeting on Monday has been moved to the following Wednesday, please tell the attendees.', PROFILES), 'en');
  assert.equal(detect('La reunión del lunes se ha trasladado al miércoles siguiente, avisad a los participantes.', PROFILES), 'es');
});

test('a profile ranks the frequent trigrams first', () => {
  // The top of the English profile is the definite article, cut into the
  // three padded trigrams it produces. The French profile starts with its
  // own. This is the whole model, and it is readable.
  assert.deepEqual([...PROFILES.get('en').keys()].slice(0, 3), [' th', 'the', 'he ']);
  assert.equal([...PROFILES.get('fr').keys()][0], ' le');
  assert.equal([...PROFILES.get('es').keys()][0], ' de');
  assert.ok(PROFILES.get('fr').size <= 300);
});

test('survives capitals, missing accents and punctuation', () => {
  // What a support ticket typed in a hurry actually looks like. Accents are a
  // signal, but they are not the only one, so losing them is survivable.
  const shouted = 'LA REUNION DE LUNDI EST REPORTEE AU MERCREDI SUIVANT !!! MERCI DE PREVENIR LES PARTICIPANTS...';
  assert.equal(detect(shouted, PROFILES), 'fr');
  const punctuated = "Réunion : lundi ?? non — mercredi (14h30) ; merci d'avertir les participants, s'il vous plaît.";
  assert.equal(detect(punctuated, PROFILES), 'fr');
  assert.equal(detect('LA REUNION DEL LUNES SE HA TRASLADADO AL MIERCOLES SIGUIENTE!!!', PROFILES), 'es');
});

test('an empty text still returns something', () => {
  // Every language is at maximum distance, so the answer is the first name in
  // alphabetical order. Nothing about the text justifies it.
  assert.equal(detect('', PROFILES), 'en');
});

test('breaking point: a very short text', () => {
  // The first breaking point claimed on the entry: below a handful of words
  // there are not enough trigrams to rank anything.
  //
  // "chat" is French for cat, and the detector reads it as English, because
  // the four trigrams it produces are the ones English uses in "that" and
  // "what". "ça va" produces trigrams no profile has ever seen, and the
  // answer is then decided by the alphabetical tie-break alone.
  assert.equal(detect('chat', PROFILES), 'en');
  const scores = Object.fromEntries(ranked('ça va', PROFILES));
  assert.equal(scores.fr, 300);
  assert.equal(scores.en, 300);
  assert.equal(scores.es, 300);
  assert.equal(detect('ça va', PROFILES), 'en');
});

test('breaking point: a text that mixes two languages', () => {
  // The second breaking point: the function has to name one language, and a
  // bilingual message has two.
  //
  // Worse than the arbitrary winner is the runner-up. On a French sentence
  // followed by an English one, the second-placed language is Spanish, which
  // is not in the text at all: the two halves interfere and the ranking stops
  // meaning anything. The gap collapses, and that collapse is the only
  // warning the caller ever gets.
  const mixed = 'La réunion de lundi est reportée au mercredi suivant. '
    + 'Please let the London team know as soon as you can.';
  assert.deepEqual(ranked(mixed, PROFILES).map(([name]) => name), ['fr', 'es', 'en']);
  assert.ok(gap(mixed) < gap('La réunion de lundi est reportée au mercredi suivant, merci de prévenir les participants.'));
});
