import test from 'node:test';
import assert from 'node:assert/strict';

import { REPLACEMENT, repairEncoding } from './n0.js';

// Ce qu'un import venu d'un système ancien met dans une base : des octets
// UTF-8 relus comme du Windows-1252.
const CASSES = {
  'CrÃ©dit Agricole': 'Crédit Agricole',
  'Rue des FrÃ¨res-LumiÃ¨re': 'Rue des Frères-Lumière',
  'ThÃ©Ã¢tre': 'Théâtre',
  'Ã€ bientÃ´t': 'À bientôt',
  'naÃ¯ve': 'naïve',
  'MÃ¼ller': 'Müller',
  'Ã‰quipe': 'Équipe',
  'câ€™est': 'c’est',
  'â‚¬ 12,50': '€ 12,50',
  'ÃŸ': 'ß',
  'Ã…ngstrÃ¶m': 'Ångström',
  'ÐŸÑ€Ð¸Ð²ÐµÑ‚': 'Привет',
  'ÃƒÂ©tÃƒÂ©': 'été',
};

// Des chaînes déjà correctes, que la réparation ne doit pas toucher.
const CORRECTES = [
  'Crédit Agricole', 'Île-de-France', 'À bientôt', 'naïve', 'Ångström',
  'Đà Nẵng', 'Привет', 'Müller', 'cœur', 'garçon', '€ 12,50', '« Bonjour »',
  'L’été à Nice', 'São Paulo', 'Mãe', 'Ãs vezes', 'Ål', 'Ærø', 'Þór',
  'Boulogne-Billancourt',
];

/**
 * L'accident lui-même : des octets UTF-8 relus comme du Windows-1252 relâché.
 * Les mojibakes ci-dessous sont produits par lui, pas écrits à la main.
 */
const W1252 = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ';
const casser = (texte) => [...new TextEncoder().encode(texte)]
  .map((b) => (b >= 0x80 && b <= 0x9f ? W1252[b - 0x80] : String.fromCharCode(b)))
  .join('');

// Ce que `ftfy` refuse de réparer et que ce fichier répare : une chaîne courte
// dont la réparation ouvrirait sur une majuscule accentuée.
const REFUSEES_PAR_FTFY = Object.fromEntries(
  ['Île-de-France', 'Îles Canaries', 'Îlot', 'Œuvre'].map((m) => [casser(m), m]),
);

// Un texte qui porte déjà un caractère de remplacement : l'octet est parti en
// amont, et ce fichier laisse la chaîne tranquille.
const DEJA_PERDU = `Ã${REPLACEMENT}ambe`;

// Cinq accidents empilés : ce fichier en défait ROUNDS = 4 et s'arrête.
const QUINTUPLE = [1, 2, 3, 4, 5].reduce((texte) => casser(texte), 'été');

// La phrase d'un ticket de bogue, qui cite le texte cassé au lieu d'en souffrir.
const TICKET = 'Bug : on voit « Ã© » au lieu de « é » dans le PDF';
const TICKET_ABIME = 'Bug : on voit « é » au lieu de « é » dans le PDF';

// Une des trois divergences entre les deux extraits : celle où ftfy en fait
// plus. Les deux autres sont au-dessus, et ce sont celles où il en fait moins.
const A_TILDE_ESPACE = 'Le caractère Ã se prononce a-tilde';

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test("point de rupture : le texte qui parle de l'encodage est réparé aussi", () => {
  const rapport = repairEncoding(TICKET);
  assert.equal(rapport.text, TICKET_ABIME);
  assert.equal(rapport.changed, true);
  // La phrase réparée ne dit plus rien : les deux côtés du « au lieu de » sont
  // devenus identiques.
  const [avant, apres] = rapport.text.split(' au lieu de ');
  assert.ok(avant.endsWith('« é »'));
  assert.ok(apres.startsWith('« é »'));
});

test('point de rupture : témoin, vingt chaînes correctes ressortent inchangées', () => {
  // « Témoin dans le même test : vingt chaînes déjà correctes, dont
  // « São Paulo » et « Ångström », ressortent inchangées. »
  assert.equal(CORRECTES.length, 20);
  for (const correcte of CORRECTES) {
    const rapport = repairEncoding(correcte);
    assert.equal(rapport.text, correcte, correcte);
    assert.equal(rapport.changed, false, correcte);
  }
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test("les cas ordinaires d'un import sont réparés", () => {
  for (const [casse, attendu] of Object.entries(CASSES)) {
    const rapport = repairEncoding(casse);
    assert.equal(rapport.text, attendu, casse);
    assert.equal(rapport.changed, true, casse);
  }
});

test('deux tours du même accident sont défaits', () => {
  assert.equal(repairEncoding('ÃƒÂ©tÃƒÂ©').text, 'été');
  assert.equal(repairEncoding('Ã©tÃ©').text, 'été');
});

test("un texte à moitié cassé ressort avec l'autre moitié intacte", () => {
  const melange = 'Un mélange : Crédit Agricole et CrÃ©dit Mutuel';
  assert.equal(repairEncoding(melange).text, 'Un mélange : Crédit Agricole et Crédit Mutuel');
});

test("l'apostrophe typographique n'est jamais redressée", () => {
  // Docstring : « `ftfy`'s wider `fix_text` straightens them, which turns
  // « L'été à Nice », already correct, into a version with a straight
  // apostrophe ». Cet extrait ne touche que l'encodage.
  assert.equal(repairEncoding('L’été à Nice').text, 'L’été à Nice');
  assert.equal(repairEncoding('“guillemets” ‘simples’').changed, false);
});

test("le drapeau lossy dit que des octets ont déjà été perdus", () => {
  const perdu = repairEncoding(`Cr${REPLACEMENT}dit Agricole`);
  assert.equal(perdu.lossy, true);
  assert.equal(perdu.changed, false);
  assert.equal(perdu.text, `Cr${REPLACEMENT}dit Agricole`);
  const entier = repairEncoding('CrÃ©dit Agricole');
  assert.deepEqual([entier.lossy, entier.changed], [false, true]);
});

test("rien n'est réparé en silence", () => {
  assert.equal(repairEncoding('Crédit').changed, false);
  assert.equal(repairEncoding('CrÃ©dit').changed, true);
});

test("un a-tilde suivi d'une espace n'est pas lu comme un a accent grave", () => {
  // Une divergence entre les deux extraits, dite ici : `ftfy` ajoute une règle
  // que ce fichier n'a pas, et cet extrait laisse donc la phrase intacte.
  assert.equal(repairEncoding(A_TILDE_ESPACE).text, A_TILDE_ESPACE);
  assert.equal(repairEncoding('Ã tout de suite').changed, false);
});

test('les chaînes courtes que ftfy refuse sont réparées ici', () => {
  // Docstring : « This file repairs four short strings that `ftfy` declines ».
  // C'est la forme d'une cellule de tableur et d'une colonne `region`, donc
  // l'entrée ordinaire du public de cette fiche.
  for (const [casse, attendu] of Object.entries(REFUSEES_PAR_FTFY)) {
    const rapport = repairEncoding(casse);
    assert.equal(rapport.text, attendu, casse);
    assert.equal(rapport.changed, true, casse);
  }
  // Témoin : le même mot déjà correct ne bouge pas.
  assert.equal(repairEncoding('Île-de-France').changed, false);
});

test('un texte qui porte déjà un caractère de remplacement est laissé tranquille', () => {
  // Docstring : « It also leaves a text that already carries a replacement
  // character alone, where `ftfy` reads that character as a byte and drops the
  // one in front of it. »
  const rapport = repairEncoding(DEJA_PERDU);
  assert.equal(rapport.text, DEJA_PERDU);
  assert.equal(rapport.changed, false);
  assert.equal(rapport.lossy, true);
  // Témoin : le même mot dont l'octet n'a pas été jeté se répare.
  const intact = repairEncoding(casser('Ïambe'));
  assert.deepEqual([intact.text, intact.lossy], ['Ïambe', false]);
});

test("au-delà de ROUNDS tours, ce qui reste n'est pas réparé", () => {
  // Docstring : « it unwinds any depth of stacked accidents, where this file
  // stops after ROUNDS ». Quatre tours passent, le cinquième reste.
  const quadruple = [1, 2, 3, 4].reduce((texte) => casser(texte), 'été');
  assert.equal(repairEncoding(quadruple).text, 'été');
  assert.equal(repairEncoding(QUINTUPLE).text, 'Ã©tÃ©');
});

test('aucune entrée ne lève, et la raison nomme ce qui a été reçu', () => {
  // R14 : la raison dit ce que le code a constaté — le type reçu.
  assert.equal(repairEncoding(null).reason, 'text is expected, not null');
  assert.equal(repairEncoding(0).reason, 'text is expected, not number');
  assert.equal(repairEncoding([]).reason, 'text is expected, not object');
  for (const entree of [null, undefined, 0, 4.2, [], {}, Symbol('x')]) {
    const rapport = repairEncoding(entree);
    assert.equal(rapport.text, null);
    assert.ok(rapport.reason.startsWith('text is expected, not '));
  }
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : entrée banale, une colonne de noms importée', () => {
  const colonne = ['Crédit Agricole', 'CrÃ©dit Mutuel', 'Boulogne-Billancourt',
    'Rue des FrÃ¨res-LumiÃ¨re', 'L’été à Nice'];
  const repares = colonne.map(repairEncoding);
  assert.deepEqual(repares.map((r) => r.changed), [false, true, false, true, false]);
  assert.equal(repares[1].text, 'Crédit Mutuel');
});

test('production : entrée vide', () => {
  assert.deepEqual(repairEncoding(''), { text: '', changed: false, lossy: false, reason: null });
});

test('production : entrée très grande et terminaison rapide', () => {
  const enorme = 'CrÃ©dit Agricole, '.repeat(50_000);
  const debut = performance.now();
  const rapport = repairEncoding(enorme);
  assert.ok(performance.now() - debut < 30_000);
  assert.ok(rapport.text.startsWith('Crédit Agricole, Crédit'));
});

test('production : encodages inattendus', () => {
  for (const parasite of ['﻿', '​', '🙂', ' ', ' ']) {
    assert.equal(repairEncoding(`Crédit${parasite}Agricole`).changed, false, parasite);
  }
  assert.equal(repairEncoding('café').text, 'café');
  assert.equal(repairEncoding('ð\u009f\u0099\u0082').text, '🙂');
});

test('production : valeurs aux limites', () => {
  assert.equal(repairEncoding('Ã').changed, false);
  assert.equal(repairEncoding('Ã©').text, 'é');
  assert.equal(repairEncoding('Ã¨Ã').text, 'èÃ');
  // Une forme trop longue, interdite par la norme, n'est pas décodée.
  assert.equal(repairEncoding('À€').changed, false);
  assert.equal(repairEncoding('í ½').changed, false);
  assert.deepEqual(repairEncoding('ï¿½'), {
    text: REPLACEMENT, changed: true, lossy: true, reason: null,
  });
});

test("production : une chaîne illisible dans un lot n'empêche pas les autres", () => {
  const lot = ['CrÃ©dit', null, 'Ã©tÃ©', '', `Cr${REPLACEMENT}dit`];
  assert.deepEqual(
    lot.map((v) => repairEncoding(v).text),
    ['Crédit', null, 'été', '', `Cr${REPLACEMENT}dit`],
  );
});

test('production : la réparation tient la classe de latence annoncée', () => {
  const debut = performance.now();
  for (let i = 0; i < 10_000; i += 1) repairEncoding('Rue des FrÃ¨res-LumiÃ¨re');
  assert.ok(performance.now() - debut < 20_000);
});
