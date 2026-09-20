import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_FAMILIES, FAMILIES, UPS_BODY, checkDigit, findTrackingNumbers, upsCheckDigit,
} from './n0.js';

// Une confirmation d'expédition ordinaire : le public visé de la fiche.
const MAIL = `Bonjour,

Votre commande 1234567890 du 10 octobre 2026 est expédiée.
Numéro de suivi Colissimo : RB123456785GB.
Suivi UPS : 1Z9999W99999999997.

Cordialement,
Le service client — 0123456789`;

// Le numéro canonique d'UPS, celui que le transporteur donne en exemple : la
// somme pondérée de ses quinze caractères fait 96, donc la clé vaut 4.
const UPS_CANONIQUE = '1Z999AA10123456784';

// Le même, avec un chiffre du numéro de série abîmé par une recopie.
const ABIME = MAIL.replace('RB123456785GB', 'RB123456784GB');

const trouves = (texte, familles = DEFAULT_FAMILIES) => findTrackingNumbers(texte, familles)
  .found.map((t) => [t.text, t.family, t.checked]);

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : une famille sans chiffre de contrôle attrape tout', () => {
  const avec = trouves(MAIL, ['upu-s10', 'ups', 'ten-digits']);
  // Le numéro de commande et le numéro de téléphone du même message, tous deux
  // rendus comme des colis. Les deux exemples sont ceux de la fiche.
  assert.ok(avec.some(([t, f, c]) => t === '1234567890' && f === 'ten-digits' && c === false));
  assert.ok(avec.some(([t, f, c]) => t === '0123456789' && f === 'ten-digits' && c === false));
  assert.ok(MAIL.split('\n')[2].includes('1234567890'));
  assert.ok(MAIL.split('\n').at(-1).includes('0123456789'));
  // C'est la forme compacte qui est attrapée : le même numéro écrit à la
  // française, par paires, ne l'est pas. Le point de rupture le dit.
  assert.deepEqual(trouves('Appelez le 01 23 45 67 89', ['upu-s10', 'ups', 'ten-digits']), []);
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
  assert.equal(ups.checked, true);
  assert.equal(ups.why, null);
  assert.deepEqual(ups.carriers, ['UPS']);
});

test("un numéro UPS porte une clé, et elle est calculée", () => {
  // Commentaire : « The eighteenth character of a `1Z` number is a check digit
  // over the fifteen that precede it. » « Cette famille ne porte rien à
  // vérifier » était faux.
  assert.equal(UPS_BODY, 15);
  assert.equal(upsCheckDigit(UPS_CANONIQUE.slice(2, 2 + UPS_BODY)), 4);
  assert.equal(UPS_CANONIQUE.at(-1), '4');
  const canonique = findTrackingNumbers(UPS_CANONIQUE).found[0];
  assert.deepEqual([canonique.family, canonique.checked, canonique.why], ['ups', true, null]);
  const faux = findTrackingNumbers('1Z999AA10123456785').found[0];
  assert.equal(faux.text, '1Z999AA10123456785');
  assert.equal(faux.checked, false);
  assert.equal(faux.why, 'the UPS check digit does not match the rest of the number');
});

test('chaque famille a sa propre raison', () => {
  // Docstring de `verify` : « One reason per family, because they are not the
  // same statement. »
  const dix = findTrackingNumbers('0123456789', ['ten-digits']).found[0];
  assert.equal(dix.why, 'shape only: ten digits carry no key to check');
  const faux = findTrackingNumbers('1Z999AA10123456785').found[0];
  assert.equal(faux.why, 'the UPS check digit does not match the rest of the number');
  assert.notEqual(dix.why, faux.why);
});

test("un numéro collé à autre chose n'est pas un numéro", () => {
  assert.deepEqual(trouves('XRB123456785GBX'), []);
  assert.deepEqual(trouves('1Z9999W9999999999'), []);
});

test('la casse compte, parce que la norme la fixe', () => {
  assert.deepEqual(trouves('rb123456785gb'), []);
});

test('aucune entrée ne lève, et la raison nomme ce qui a été reçu', () => {
  // R14 : la raison dit ce que le code a constaté — le type reçu.
  assert.equal(findTrackingNumbers(null).reason, 'expected text, not object');
  assert.equal(findTrackingNumbers(42).reason, 'expected text, not number');
  for (const entree of [null, undefined, 42, [], {}, '']) {
    const rapport = findTrackingNumbers(entree);
    assert.deepEqual(rapport.found, []);
    if (typeof entree !== 'string') assert.ok(rapport.reason.startsWith('expected text, not '));
  }
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test("production : entrée banale, une confirmation d'expédition", () => {
  assert.deepEqual(trouves(MAIL), [
    ['RB123456785GB', 'upu-s10', true],
    ['1Z9999W99999999997', 'ups', true],
  ]);
});

test('production : entrée vide', () => {
  assert.deepEqual(findTrackingNumbers(''), { found: [], reason: null });
});

test('production : entrée très grande et terminaison rapide', () => {
  // Joints par un saut de ligne : collés bout à bout, le numéro de téléphone
  // de la fin toucherait le « Bonjour » de la copie suivante.
  const enorme = Array.from({ length: 20_000 }, () => MAIL).join('\n');
  const debut = performance.now();
  const rapport = findTrackingNumbers(enorme, ['upu-s10', 'ups', 'ten-digits']);
  assert.ok(performance.now() - debut < 60_000);
  assert.equal(rapport.found.length, 4 * 20_000);
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
