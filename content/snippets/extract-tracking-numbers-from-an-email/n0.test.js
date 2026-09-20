import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_FAMILIES, FAMILIES, checkDigit, findTrackingNumbers } from './n0.js';

// Une confirmation d'expédition ordinaire : le public visé de la fiche.
const MAIL = `Bonjour,

Votre commande 1234567890 du 10 octobre 2026 est expédiée.
Numéro de suivi Colissimo : RB123456785GB.
Suivi UPS : 1Z9999W99999999999.

Cordialement,
Le service client`;

// Le même, avec un chiffre du numéro de série abîmé par une recopie.
const ABIME = MAIL.replace('RB123456785GB', 'RB123456784GB');

const trouves = (texte, familles = DEFAULT_FAMILIES) => findTrackingNumbers(texte, familles)
  .found.map((t) => [t.text, t.family, t.checked]);

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : une famille sans chiffre de contrôle attrape tout', () => {
  const avec = trouves(MAIL, ['upu-s10', 'ups', 'ten-digits']);
  assert.ok(avec.some(([t, f, c]) => t === '1234567890' && f === 'ten-digits' && c === false));
  assert.ok(MAIL.split('\n')[2].includes('1234567890'));
});

test('point de rupture : témoin, ce qui porte un contrôle est vérifié', () => {
  assert.ok(trouves(MAIL).some(([t, f, c]) => t === 'RB123456785GB' && f === 'upu-s10' && c));
  const refuse = findTrackingNumbers(ABIME).found[0];
  assert.equal(refuse.checked, false);
  assert.equal(refuse.why, 'the check digit does not match the serial number');
});

// ---------------------------------------------------------------------------
// Le chiffre de contrôle, confronté à la norme
// ---------------------------------------------------------------------------

test("l'exemple de la norme est reproduit", () => {
  assert.equal(checkDigit('47312482'), 9);
});

test("le contrôle attrape toute substitution d'un chiffre", () => {
  const serie = '47312482';
  const juste = checkDigit(serie);
  let passees = 0;
  for (let position = 0; position < 8; position += 1) {
    for (const chiffre of '0123456789') {
      if (chiffre === serie[position]) continue;
      const abime = serie.slice(0, position) + chiffre + serie.slice(position + 1);
      if (checkDigit(abime) === juste) passees += 1;
    }
  }
  assert.equal(passees, 0);
});

test('le contrôle attrape toute transposition de deux chiffres voisins', () => {
  const serie = '47312482';
  const juste = checkDigit(serie);
  let passees = 0;
  for (let position = 0; position < 7; position += 1) {
    if (serie[position] === serie[position + 1]) continue;
    const echange = serie.slice(0, position) + serie[position + 1] + serie[position]
      + serie.slice(position + 2);
    if (checkDigit(echange) === juste) passees += 1;
  }
  assert.equal(passees, 0);
});

test('un numéro tiré au hasard passe une fois sur dix', () => {
  const serie = '47312482';
  const acceptes = [...'0123456789'].filter((c) => checkDigit(serie) === Number(c)).length;
  assert.equal(acceptes, 1);
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('les indicatifs réservés par la norme ne sont pas des numéros', () => {
  assert.deepEqual(trouves('SA123456785GB'), []);
  assert.deepEqual(trouves('TA123456785GB'), []);
  assert.equal(trouves('RB123456785GB')[0][2], true);
});

test('les familles sans contrôle ne sont pas cherchées par défaut', () => {
  assert.deepEqual(DEFAULT_FAMILIES, ['upu-s10', 'ups']);
  assert.ok('ten-digits' in FAMILIES);
  assert.ok(trouves(MAIL).every(([, f]) => f !== 'ten-digits'));
});

test('une famille inconnue est nommée', () => {
  const rapport = findTrackingNumbers(MAIL, ['colissimo']);
  assert.deepEqual(rapport.found, []);
  assert.equal(rapport.reason, 'unknown families: colissimo');
});

test("chaque résultat dit ce qu'il vaut", () => {
  const ups = findTrackingNumbers(MAIL).found.find((t) => t.family === 'ups');
  assert.equal(ups.checked, false);
  assert.equal(ups.why, 'shape only: this family carries nothing to check');
  assert.deepEqual(ups.carriers, ['UPS']);
});

test("un numéro collé à autre chose n'est pas un numéro", () => {
  assert.deepEqual(trouves('XRB123456785GBX'), []);
  assert.deepEqual(trouves('1Z9999W9999999999'), []);
});

test('la casse compte, parce que la norme la fixe', () => {
  assert.deepEqual(trouves('rb123456785gb'), []);
});

test('aucune entrée ne lève', () => {
  for (const entree of [null, undefined, 42, [], {}, '']) {
    const rapport = findTrackingNumbers(entree);
    assert.deepEqual(rapport.found, []);
    if (typeof entree !== 'string') assert.ok(rapport.reason.startsWith('expected text'));
  }
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test("production : entrée banale, une confirmation d'expédition", () => {
  assert.deepEqual(trouves(MAIL), [
    ['RB123456785GB', 'upu-s10', true],
    ['1Z9999W99999999999', 'ups', false],
  ]);
});

test('production : entrée vide', () => {
  assert.deepEqual(findTrackingNumbers(''), { found: [], reason: null });
});

test('production : entrée très grande et terminaison rapide', () => {
  const enorme = MAIL.repeat(20_000);
  const debut = performance.now();
  const rapport = findTrackingNumbers(enorme, ['upu-s10', 'ups', 'ten-digits']);
  assert.ok(performance.now() - debut < 60_000);
  assert.equal(rapport.found.length, 3 * 20_000);
});

test('production : encodages inattendus', () => {
  assert.equal(trouves('﻿RB123456785GB')[0][2], true);
  assert.equal(trouves('Suivi : RB123456785GB')[0][2], true);
  assert.deepEqual(trouves('RB١٢٣٤٥٦٧٨٥GB'), []);
});

test('production : valeurs aux limites', () => {
  assert.equal(checkDigit('00000000'), 5);
  assert.equal(trouves('AB000000005FR')[0][2], true);
  assert.equal(trouves('RB123456785GB RB123456785FR').length, 2);
});

test("production : un numéro refusé n'empêche pas de lire les autres", () => {
  assert.deepEqual(trouves('RB123456784GB puis RB123456785GB').map((t) => t[2]), [false, true]);
});

test('production : la lecture tient la classe de latence annoncée', () => {
  const debut = performance.now();
  for (let i = 0; i < 10_000; i += 1) findTrackingNumbers(MAIL);
  assert.ok(performance.now() - debut < 20_000);
});
