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

// La phrase d'un ticket de bogue, qui cite le texte cassé au lieu d'en souffrir.
const TICKET = 'Bug : on voit « Ã© » au lieu de « é » dans le PDF';
const TICKET_ABIME = 'Bug : on voit « é » au lieu de « é » dans le PDF';

// Le seul endroit où les deux extraits ne répondent pas la même chose.
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
  // La seule divergence entre les deux extraits, dite ici : `ftfy` ajoute une
  // règle que ce fichier n'a pas, et cet extrait laisse donc la phrase intacte.
  assert.equal(repairEncoding(A_TILDE_ESPACE).text, A_TILDE_ESPACE);
  assert.equal(repairEncoding('Ã tout de suite').changed, false);
});

test('aucune entrée ne lève', () => {
  for (const entree of [null, undefined, 0, 4.2, [], {}, Symbol('x')]) {
    const rapport = repairEncoding(entree);
    assert.equal(rapport.text, null);
    assert.equal(typeof rapport.reason, 'string');
    assert.ok(rapport.reason.length > 0);
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
