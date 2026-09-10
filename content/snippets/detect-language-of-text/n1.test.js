import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detect, probabilities, train } from './n1.js';

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

test('detects a sentence in each language', () => {
  assert.equal(detect(MODEL, 'La réunion de lundi est reportée au mercredi suivant, merci de prévenir les participants.'), 'fr');
  assert.equal(detect(MODEL, 'The meeting on Monday has been moved to the following Wednesday, please tell the attendees.'), 'en');
  assert.equal(detect(MODEL, 'La reunión del lunes se ha trasladado al miércoles siguiente, avisad a los participantes.'), 'es');
});

test('probabilities sum to one over the known languages', () => {
  const scores = probabilities(MODEL, 'The meeting is on Monday.');
  assert.deepEqual(Object.keys(scores).sort(), ['en', 'es', 'fr']);
  assert.ok(Math.abs(Object.values(scores).reduce((a, b) => a + b, 0) - 1) < 1e-9);
});

test('a single word is enough when it is a distinctive one', () => {
  // Where N0 needs a paragraph to rank anything, weighing the evidence gets a
  // usable answer out of one word. This is what the rung buys.
  assert.ok(probabilities(MODEL, 'Bonjour').fr > 0.9);
  assert.ok(probabilities(MODEL, 'Hola').es > 0.9);
});

test('survives capitals, missing accents and punctuation', () => {
  const shouted = 'LA REUNION DE LUNDI EST REPORTEE AU MERCREDI SUIVANT !!! MERCI DE PREVENIR LES PARTICIPANTS...';
  assert.equal(detect(MODEL, shouted), 'fr');
  const punctuated = "Réunion : lundi ?? non — mercredi (14h30) ; merci d'avertir les participants, s'il vous plaît.";
  assert.equal(detect(MODEL, punctuated), 'fr');
  assert.equal(detect(MODEL, 'LA REUNION DEL LUNES SE HA TRASLADADO AL MIERCOLES SIGUIENTE!!!'), 'es');
});

test('it can abstain where N0 had to answer', () => {
  // Two words shared between French and Spanish spellings: the model says so
  // instead of picking one, which is the whole point of a threshold.
  assert.ok(probabilities(MODEL, 'ça va').fr < 0.9);
  assert.equal(detect(MODEL, 'ça va', 0.9), null);
  // With no text at all, the answer is the prior and nothing else.
  assert.equal(detect(MODEL, '', 0.5), null);
});

test('breaking point: the confidence saturates on a mixed text', () => {
  // The breaking point of this rung: the probability is a product over every
  // n-gram of the text, so it saturates long before the evidence justifies
  // it.
  //
  // On a French sentence followed by an English one, the model does not
  // hesitate the way N0 did. It answers French with a probability above
  // ninety-nine per cent, and the threshold that abstained on "ça va" never
  // fires. The number looks like a confidence and is not one.
  //
  // Short and ambiguous words fail the same way: "chat" is French for cat,
  // and the model is certain it is English.
  const mixed = 'La réunion de lundi est reportée au mercredi suivant. '
    + 'Please let the London team know as soon as you can.';
  assert.ok(probabilities(MODEL, mixed).fr > 0.99);
  assert.equal(detect(MODEL, mixed, 0.9), 'fr');
  assert.ok(probabilities(MODEL, 'chat').en > 0.9);
});

test('breaking point: a language it was never shown', () => {
  // The other half of the same flaw: the probabilities sum to one over the
  // training languages, so a language absent from the sample is not merely
  // missed, it is assigned. Portuguese comes back as Spanish, and German as
  // English, both above the threshold.
  //
  // Adding a language means retraining. Nothing in the answer warns you that
  // the true one was never on the list.
  const portuguese = 'O comboio chegou com um quarto de hora de atraso e ninguém na plataforma pareceu surpreendido.';
  const german = 'Der Zug kam eine Viertelstunde zu spät an, und niemand auf dem Bahnsteig schien überrascht zu sein.';
  assert.equal(detect(MODEL, portuguese, 0.9), 'es');
  assert.equal(detect(MODEL, german, 0.9), 'en');
});
