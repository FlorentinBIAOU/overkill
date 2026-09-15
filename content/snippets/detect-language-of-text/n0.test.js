import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PROFILE_SIZE, detect, distance, profile, ranked, trigrams } from './n0.js';
import essai from '../../tryouts/live/detect-language-of-text.js';

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

const FRENCH = 'La réunion de lundi est reportée au mercredi suivant, merci de prévenir les participants.';
const MIXED = 'La réunion de lundi est reportée au mercredi suivant. '
  + 'Please let the London team know as soon as you can.';

/** How far the winner is ahead of the runner-up. */
function gap(text, profiles = PROFILES) {
  const scores = ranked(text, profiles);
  return scores[1][1] - scores[0][1];
}

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : « chat » ressort en anglais', () => {
  assert.equal(detect('chat', PROFILES), 'en');
  assert.equal(detect(FRENCH, PROFILES), 'fr');
});

test('INFIRMÉ : la fiche dit que les quatre trigrammes de « chat » sont ceux de l’anglais, deux seulement sont dans le profil anglais', async () => {
  // « hat » et « at␣ » sont dans le profil anglais ; « ␣ch » et « cha » ne sont
  // dans aucun profil et coûtent le maximum partout.
  await assert.rejects(async () => {
    const grams = trigrams('chat');
    assert.deepEqual(grams, [' ch', 'cha', 'hat', 'at ']);
    assert.ok(grams.every((gram) => PROFILES.get('en').has(gram)));
  });
});

test('point de rupture : sur « ça va », les trois langues sont à la distance maximale et l’ordre alphabétique répond', () => {
  const scores = Object.fromEntries(ranked('ça va', PROFILES));
  assert.equal(scores.fr, 300);
  assert.equal(scores.en, 300);
  assert.equal(scores.es, 300);
  assert.equal(detect('ça va', PROFILES), 'en');
  // Witness: the tie-break is alphabetical, not the order of the profiles.
  const reordered = new Map(['fr', 'es', 'en'].map((name) => [name, PROFILES.get(name)]));
  assert.equal(detect('ça va', reordered), 'en');
});

test('point de rupture : sur une phrase française suivie d’une anglaise, l’espagnol arrive deuxième', () => {
  assert.deepEqual(ranked(MIXED, PROFILES).map(([name]) => name), ['fr', 'es', 'en']);
  assert.ok(gap(MIXED) < gap(FRENCH));
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('détecte une phrase dans chaque langue', () => {
  assert.equal(detect(FRENCH, PROFILES), 'fr');
  assert.equal(detect('The meeting on Monday has been moved to the following Wednesday, please tell the attendees.', PROFILES), 'en');
  assert.equal(detect('La reunión del lunes se ha trasladado al miércoles siguiente, avisad a los participantes.', PROFILES), 'es');
});

test('un profil classe les trigrammes fréquents en tête', () => {
  assert.deepEqual([...PROFILES.get('en').keys()].slice(0, 3), [' th', 'the', 'he ']);
  assert.equal([...PROFILES.get('fr').keys()][0], ' le');
  assert.equal([...PROFILES.get('es').keys()][0], ' de');
  assert.ok(PROFILES.get('fr').size <= 300);
});

test('le modèle entier tient en quelques centaines de chaînes de trois caractères', () => {
  assert.equal(PROFILE_SIZE, 300);
  for (const reference of PROFILES.values()) {
    assert.ok(reference.size >= 100 && reference.size <= PROFILE_SIZE);
    assert.ok([...reference.keys()].every((gram) => gram.length === 3));
  }
});

test('chaque langue classe ses trigrammes cités mieux que les autres langues', () => {
  const cited = { fr: ['ent', 'les', 'eur'], en: ['the', 'ing'], es: ['que', 'los'] };
  for (const [language, grams] of Object.entries(cited)) {
    for (const gram of grams) {
      const own = PROFILES.get(language).get(gram);
      for (const [other, reference] of PROFILES) {
        if (other !== language) assert.ok(own < (reference.get(gram) ?? PROFILE_SIZE), `${language} ${gram} ${other}`);
      }
    }
  }
});

test('le bourrage d’espaces distingue l’article du milieu de mot', () => {
  assert.deepEqual(trigrams('les'), [' le', 'les', 'es ']);
  const inside = trigrams('tables');
  assert.ok(inside.includes('les'));
  assert.ok(!inside.includes(' le'));
});

test('un rang survit à un échantillon quatre fois plus long et à un texte quatre fois plus court', () => {
  // Vrai pour la répétition du même texte ; un échantillon différent change les rangs.
  assert.deepEqual(profile(Array(4).fill(SAMPLES.fr).join(' ')), PROFILES.get('fr'));
  const longText = Array(4).fill(FRENCH).join(' ');
  for (const reference of PROFILES.values()) {
    assert.equal(distance(longText, reference), distance(FRENCH, reference));
  }
});

test('les chiffres, la ponctuation et les symboles ne produisent aucun trigramme', () => {
  assert.deepEqual(trigrams('14 30 !!! ... 2026 € % #'), []);
  const noisy = `RÉF 4471-B / 14h30 / 06 12 34 56 78 / ${FRENCH} / #9921 €€€ 100 %`;
  assert.equal(detect(noisy, PROFILES), 'fr');
});

test('à égalité de compte, le profil est trié alphabétiquement', () => {
  assert.deepEqual([...profile('ba ab')], [[' ab', 0], [' ba', 1], ['ab ', 2], ['ba ', 3]]);
  assert.deepEqual(profile('ab ba'), profile('ba ab'));
});

test('un trigramme absent de la langue coûte le maximum', () => {
  assert.equal(distance('zzz', PROFILES.get('fr')), PROFILE_SIZE);
  assert.equal(distance('', PROFILES.get('fr')), PROFILE_SIZE);
});

test('ranked rend toutes les langues et l’écart entre les deux premières', () => {
  const scores = ranked(FRENCH, PROFILES);
  assert.deepEqual(scores.map(([name]) => name).sort(), ['en', 'es', 'fr']);
  const values = scores.map(([, value]) => value);
  assert.deepEqual(values, [...values].sort((a, b) => a - b));
  assert.ok(gap(FRENCH) > 0);
});

test('detect rend toujours une langue, même quand il ne devrait pas', () => {
  assert.equal(detect('', PROFILES), 'en');
  assert.equal(detect('!!! 123', PROFILES), 'en');
});

test('escalate_when : l’écart tombe à zéro sur deux mots', () => {
  assert.equal(gap('ça va'), 0);
  assert.ok(gap(FRENCH) > 0);
});

test('l’extrait est déterministe et n’importe rien', () => {
  const again = new Map(Object.entries(SAMPLES).map(([name, sample]) => [name, profile(sample)]));
  assert.deepEqual(ranked(MIXED, again), ranked(MIXED, PROFILES));
  const source = readFileSync(new URL('./n0.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s|\brequire\(|\bimport\(|\bfetch\(/m);
});

test('la casse, les accents manquants et la ponctuation ne changent pas la réponse', () => {
  const shouted = 'LA REUNION DE LUNDI EST REPORTEE AU MERCREDI SUIVANT !!! MERCI DE PREVENIR LES PARTICIPANTS...';
  assert.equal(detect(shouted, PROFILES), 'fr');
  const punctuated = "Réunion : lundi ?? non — mercredi (14h30) ; merci d'avertir les participants, s'il vous plaît.";
  assert.equal(detect(punctuated, PROFILES), 'fr');
  assert.equal(detect('LA REUNION DEL LUNES SE HA TRASLADADO AL MIERCOLES SIGUIENTE!!!', PROFILES), 'es');
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : texte vide et texte sans lettre rendent une distance maximale sans exception', () => {
  const max = [['en', 300], ['es', 300], ['fr', 300]];
  assert.deepEqual(ranked('', PROFILES), max);
  assert.deepEqual(ranked('   \n\t ', PROFILES), max);
});

test('production : sans aucun profil, detect lève au lieu d’inventer une langue', () => {
  assert.deepEqual(ranked(FRENCH, new Map()), []);
  assert.throws(() => detect(FRENCH, new Map()), TypeError);
});

test('production : un texte d’un million de caractères termine dans une borne large', () => {
  const big = Array(12_000).fill(FRENCH).join(' ');
  const debut = performance.now();
  assert.equal(detect(big, PROFILES), 'fr');
  assert.ok(performance.now() - debut < 15_000);
});

test('production : un mot de cent mille lettres termine sans exception', () => {
  const debut = performance.now();
  assert.equal(detect('a'.repeat(100_000), PROFILES), 'en');
  assert.ok(performance.now() - debut < 15_000);
});

test('production : accents décomposés, même classement que les accents composés', () => {
  assert.deepEqual(ranked(FRENCH.normalize('NFD'), PROFILES), ranked(FRENCH, PROFILES));
});

test('production : espaces insécables, largeur nulle, BOM et emoji ne changent pas la langue', () => {
  for (const text of [
    FRENCH.replaceAll(' ', '\u00a0'),
    FRENCH.replace('réunion', 'réu\u200bnion'),
    `\ufeff${FRENCH}`,
    `🎉 ${FRENCH} 👍`,
  ]) {
    assert.equal(detect(text, PROFILES), 'fr', JSON.stringify(text.slice(0, 12)));
  }
});

test('production : taille de profil aux limites', () => {
  assert.deepEqual([...profile(SAMPLES.fr, 1)], [[' le', 0]]);
  assert.equal(profile(SAMPLES.fr, 0).size, 0);
  assert.equal(distance(FRENCH, PROFILES.get('fr'), 0), 0);
});

// ---------------------------------------------------------------------------
// L'essai de la fiche
// ---------------------------------------------------------------------------

test('essai : le message de support et le même message crié ressortent en français', () => {
  for (const cas of essai.cases.filter((c) => !c.fails)) {
    assert.equal(essai.run(cas.input, 'fr').verdict.label, 'français');
    assert.equal(essai.run(cas.input, 'en').verdict.label, 'French');
  }
});

test('essai : « chat » ressort en anglais avec un écart large, et le cas est marqué en échec', () => {
  // why : « ressort en anglais, avec un écart large qui a toutes les apparences
  // de la confiance. Quatre trigrammes seulement ».
  const cas = essai.cases.find((c) => c.input === 'chat');
  assert.equal(cas.fails, true);
  assert.equal(essai.run('chat', 'fr').verdict.label, 'anglais');
  assert.equal(trigrams('chat').length, 4);
  assert.ok(gap('chat') > gap(FRENCH));
});

test('essai : le message bilingue a l’espagnol en deuxième et un écart qui s’effondre', () => {
  const cas = essai.cases.find((c) => c.input === MIXED);
  assert.equal(cas.fails, true);
  const sortie = essai.run(MIXED, 'fr');
  assert.equal(sortie.verdict.label, 'français');
  assert.equal(sortie.rows.rows[1][0], 'espagnol');
  assert.ok(gap(MIXED) < gap(FRENCH) / 2);
});

test('essai : sur « ça va », la sortie dit que l’ordre alphabétique répond', () => {
  assert.match(essai.run('ça va', 'fr').verdict.detail, /ordre alphabétique/);
  assert.match(essai.run('ça va', 'en').verdict.detail, /alphabetical tie-break/);
  assert.equal(essai.level, 'N0');
});
