import test from 'node:test';
import assert from 'node:assert/strict';

import { MAX_CHARACTERS, SEPARATORS, checkCompanyNumber } from './n0.js';

// Deux numéros qui ne diffèrent que par l'inversion « 09 » → « 90 », et que la
// clé accepte tous les deux. Le premier est celui qu'on voulait saisir.
const VOULU = '382209401';
const SAISI = '382290401';

// La Poste : le siège satisfait Luhn, l'établissement de Rennes ne le satisfait
// pas et reste un SIRET valide (règle INSEE de la somme multiple de cinq).
const LA_POSTE_SIEGE = '35600000000048';
const LA_POSTE_RENNES = '35600000009075';

// Entrées ordinaires d'un public francophone : ce qu'on copie d'un extrait
// Kbis, d'un tableur ou d'une mention légale.
const BANALES = [
  '732 829 320',
  '732829320',
  '732.829.320',
  '732 829 320 00074',
  '73282932000074',
  '732 829 320',
  '732 829 320',
  ' 732829320 ',
  '732-829-320-00074',
  LA_POSTE_RENNES,
];

/** La clé de Luhn seule, sans l'exception de La Poste : cinq lignes. */
function luhnSimple(numero) {
  let total = 0;
  [...numero].reverse().forEach((caractere, rang) => {
    let chiffre = Number(caractere);
    if (rang % 2 === 1) {
      chiffre *= 2;
      if (chiffre > 9) chiffre -= 9;
    }
    total += chiffre;
  });
  return total % 10 === 0;
}

const sommeDesChiffres = (numero) => [...numero].reduce((t, c) => t + Number(c), 0);

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : un numéro bien formé peut ne désigner personne', () => {
  // « 000000000 passe » : la clé dit la forme, pas l'existence.
  assert.deepEqual(checkCompanyNumber('000000000'), {
    valid: true,
    kind: 'SIREN',
    compact: '000000000',
    reason: null,
  });
  assert.equal(checkCompanyNumber('00000000000000').valid, true);
  // Témoin : la clé refuse bien quelque chose — le même numéro à un chiffre près.
  assert.equal(checkCompanyNumber('000000001').valid, false);
});

test("point de rupture : l'inversion 09 → 90 passe la clé", () => {
  // « 382 209 401 saisi 382 290 401 passe aussi » : Luhn ne voit pas 09 ↔ 90.
  assert.equal(checkCompanyNumber(VOULU).valid, true);
  assert.equal(checkCompanyNumber(SAISI).valid, true);
  assert.notEqual(VOULU, SAISI);
  const ecarts = [...VOULU].map((c, i) => (c === SAISI[i] ? -1 : i)).filter((i) => i >= 0);
  assert.deepEqual(ecarts, [4, 5]);
  assert.equal(VOULU.slice(4, 6), '09');
  assert.equal(SAISI.slice(4, 6), '90');
});

test("point de rupture : témoin, une faute d'un seul chiffre est toujours refusée", () => {
  let passees = 0;
  for (const base of [VOULU, SAISI, '732829320', '000000000']) {
    for (let rang = 0; rang < 9; rang += 1) {
      for (const chiffre of '0123456789') {
        if (chiffre === base[rang]) continue;
        const faute = base.slice(0, rang) + chiffre + base.slice(rang + 1);
        if (checkCompanyNumber(faute).valid) passees += 1;
      }
    }
  }
  assert.equal(passees, 0);
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('le SIRET de Rennes échoue à Luhn et reste valide', () => {
  // Docstring : « 35600000009075, the Rennes establishment, fails Luhn and is
  // valid ». C'est la raison mesurée de prendre la bibliothèque plutôt que
  // d'écrire la clé.
  assert.equal(luhnSimple(LA_POSTE_RENNES), false);
  assert.equal(checkCompanyNumber(LA_POSTE_RENNES).valid, true);
  // La règle INSEE pour La Poste : la somme des quatorze chiffres est un multiple de cinq.
  assert.equal(sommeDesChiffres(LA_POSTE_RENNES) % 5, 0);
  // Témoin : le siège, lui, satisfait les deux règles.
  assert.equal(luhnSimple(LA_POSTE_SIEGE), true);
  assert.equal(checkCompanyNumber(LA_POSTE_SIEGE).valid, true);
});

test("l'exception ne vaut que pour le SIREN de La Poste", () => {
  const autre = '73282932000004';
  assert.equal(sommeDesChiffres(autre) % 5, 0);
  assert.equal(luhnSimple(autre), false);
  assert.equal(checkCompanyNumber(autre).valid, false);
});

test('le rapport dit quelle clé a été appliquée', () => {
  assert.equal(checkCompanyNumber('732829320').kind, 'SIREN');
  assert.equal(checkCompanyNumber('73282932000074').kind, 'SIRET');
});

test("la longueur décide quand l'appelant ne déclare rien", () => {
  assert.equal(checkCompanyNumber('7328293200').reason, '10 digits: expected nine or fourteen');
  assert.equal(checkCompanyNumber('7328293200').kind, null);
});

test("l'appelant peut déclarer le type attendu", () => {
  const rapport = checkCompanyNumber('732 829 320', { expected: 'SIRET' });
  assert.equal(rapport.valid, false);
  assert.equal(rapport.reason, 'SIRET is 14 digits, got 9');
  assert.equal(rapport.kind, 'SIRET');
  // Témoin : déclarer le bon type ne change rien au résultat.
  assert.equal(checkCompanyNumber('732 829 320', { expected: 'SIREN' }).valid, true);
});

test("les séparateurs sont ceux qu'on colle, et rien d'autre", () => {
  for (const separateur of SEPARATORS) {
    assert.equal(checkCompanyNumber(`732${separateur}829${separateur}320`).valid, true);
  }
  assert.equal(checkCompanyNumber('FR44732829320').valid, false);
  assert.equal(checkCompanyNumber('FR44732829320').reason, 'not digits and separators only');
  assert.equal(checkCompanyNumber('SIREN : 732 829 320').valid, false);
});

test('aucune entrée ne lève', () => {
  for (const entree of [null, undefined, 0, 732829320, [], {}, Symbol('x'), '', 'x'.repeat(10_000)]) {
    const rapport = checkCompanyNumber(entree);
    assert.equal(rapport.valid, false);
    assert.equal(typeof rapport.reason, 'string');
    assert.ok(rapport.reason.length > 0);
  }
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test("production : entrée banale, ce qu'on colle d'un extrait Kbis", () => {
  for (const banale of BANALES) {
    const rapport = checkCompanyNumber(banale);
    assert.equal(rapport.valid, true, banale);
    assert.match(rapport.compact, /^[0-9]+$/);
  }
});

test('production : entrée vide', () => {
  assert.deepEqual(checkCompanyNumber(''), {
    valid: false,
    kind: null,
    compact: '',
    reason: 'not digits and separators only',
  });
  // Une chaîne faite de séparateurs seuls ne devient pas un numéro vide valide.
  assert.equal(checkCompanyNumber('   ').valid, false);
});

test('production : entrée très grande et terminaison rapide', () => {
  const enorme = '7'.repeat(1_000_000);
  const debut = performance.now();
  const rapport = checkCompanyNumber(enorme);
  assert.ok(performance.now() - debut < 5000);
  assert.equal(rapport.valid, false);
  assert.equal(rapport.reason, `longer than ${MAX_CHARACTERS} characters`);
});

test('production : encodages inattendus', () => {
  // Chiffres arabo-indiens : ce sont des chiffres pour Unicode, pas pour la clé.
  assert.equal(checkCompanyNumber('٧٣٢٨٢٩٣٢٠').valid, false);
  // Marque d'ordre des octets, largeur nulle, emoji : refusés, pas nettoyés.
  for (const parasite of ['﻿', '​', '🏢']) {
    assert.equal(checkCompanyNumber(`${parasite}732829320`).valid, false);
  }
  // Espaces insécables, eux, sont des séparateurs déclarés.
  assert.equal(checkCompanyNumber('732 829 320').valid, true);
  assert.equal(checkCompanyNumber('732 829 320').valid, true);
});

test('production : valeurs aux limites', () => {
  // Huit, neuf, dix chiffres.
  assert.equal(checkCompanyNumber('73282932').reason, '8 digits: expected nine or fourteen');
  assert.equal(checkCompanyNumber('732829320').valid, true);
  assert.equal(checkCompanyNumber('7328293200').reason, '10 digits: expected nine or fourteen');
  // Treize, quatorze, quinze.
  assert.equal(checkCompanyNumber('7328293200007').kind, null);
  assert.equal(checkCompanyNumber('73282932000074').valid, true);
  assert.equal(checkCompanyNumber('732829320000741').kind, null);
  // Exactement le plafond, et un caractère de plus.
  const auPlafond = '732829320'.padStart(MAX_CHARACTERS, ' ');
  assert.equal(auPlafond.length, MAX_CHARACTERS);
  assert.equal(checkCompanyNumber(auPlafond).valid, true);
  assert.equal(
    checkCompanyNumber(` ${auPlafond}`).reason,
    `longer than ${MAX_CHARACTERS} characters`,
  );
});

test("production : un numéro invalide dans un lot n'empêche pas les autres", () => {
  const lot = ['732829320', 'pas un numéro', '73282932000074', '', LA_POSTE_RENNES];
  const rapports = lot.map((numero) => checkCompanyNumber(numero));
  assert.deepEqual(
    rapports.map((r) => r.valid),
    [true, false, true, false, true],
  );
});

test('production : le contrôle tient la classe de latence annoncée', () => {
  // latency « <1 ms » : dix mille contrôles en moins de dix secondes, soit la
  // borne large de la charte (marge de dix sur la mesure du relevé).
  const debut = performance.now();
  for (let i = 0; i < 10_000; i += 1) checkCompanyNumber('732 829 320 00074');
  assert.ok(performance.now() - debut < 10_000);
});
