import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidIBAN } from 'ibantools';

import {
  MAX_CHARACTERS,
  MAX_LENGTH,
  MIN_LENGTH,
  RIB_LETTERS,
  checkBankDetails,
  nationalKeyOk,
} from './n0.js';

// Deux comptes du même établissement, tous deux parfaitement formés, clé RIB
// comprise. C'est la forme que prend la facture au RIB changé : rien dans le
// numéro ne dit lequel est le vôtre.
const ATTENDU = 'FR7630006000011234567890189';
const SUBSTITUE = 'FR7630006000010987654321028';

// Un numéro dont la clé ISO 13616 est juste et dont la seule clé RIB est
// fausse : c'est le cas qu'il faut pour démontrer que l'extrait ajoute bien
// quelque chose à la bibliothèque.
const CLE_RIB_SEULE_FAUSSE = 'FR0630006000011234567890188';

// Deux IBAN monégasques : Monaco emploie la même clé que la France.
const MONEGASQUES = ['MC5811222000010123456789030', 'MC1112739000700011111000H79'];

// Les six confusions de saisie entre un chiffre et une lettre qui lui ressemble.
const SOSIES = { 0: 'O', 1: 'I', 2: 'Z', 5: 'S', 6: 'G', 8: 'B' };

// Entrées ordinaires d'un public francophone, souvent européen.
const BANALES = [
  'FR76 3000 6000 0112 3456 7890 189',
  'FR7630006000011234567890189',
  'fr76 3000 6000 0112 3456 7890 189',
  'FR76 3000 6000 0112 3456 7890 189',
  'FR76-3000-6000-0112-3456-7890-189',
  'BE62 5100 0754 7061',
  'DE89 3704 0044 0532 0130 00',
  'CH93 0076 2011 6238 5295 7',
  'MC58 1122 2000 0101 2345 6789 030',
  'LU28 0019 4006 4475 0000',
];

/** Les deux chiffres de contrôle d'ISO 13616, pour fabriquer des IBAN de test. */
function cleIso(pays, bban) {
  const etendu = [...(bban + pays + '00')].map((c) => parseInt(c, 36)).join('');
  return String(98n - (BigInt(etendu) % 97n)).padStart(2, '0');
}

/** La clé RIB française : celle que l'extrait recalcule. */
function cleRib(banque, guichet, compte) {
  const chiffres = [...(banque + guichet + compte)].map((c) => RIB_LETTERS[c] ?? c).join('');
  return String((97n - (BigInt(`${chiffres}00`) % 97n)) % 97n).padStart(2, '0');
}

/** Un générateur reproductible, pour ne dépendre d'aucune graine globale. */
function alea(graine) {
  let etat = graine >>> 0;
  return () => {
    etat = (etat * 1664525 + 1013904223) >>> 0;
    return etat / 2 ** 32;
  };
}

/** Des IBAN français valides, fabriqués, jamais ceux de quelqu'un. */
function ibansFrancais(nombre, graine = 3) {
  const suivant = alea(graine);
  const entier = (max) => Math.floor(suivant() * max);
  const sortie = [];
  while (sortie.length < nombre) {
    const banque = String(10000 + entier(90000));
    const guichet = String(entier(100000)).padStart(5, '0');
    const compte = String(entier(10 ** 11)).padStart(11, '0');
    const bban = banque + guichet + compte + cleRib(banque, guichet, compte);
    const candidat = `FR${cleIso('FR', bban)}${bban}`;
    if (checkBankDetails(candidat).valid) sortie.push(candidat);
  }
  return sortie;
}

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : deux comptes du même établissement passent tous les deux', () => {
  // « FR76 3000 6000 0112 3456 7890 189 et FR76 3000 6000 0109 8765 4321 028
  // passent toutes les deux » : la clé ne dit rien du titulaire.
  for (const numero of [ATTENDU, SUBSTITUE]) {
    const rapport = checkBankDetails(numero);
    assert.equal(rapport.valid, true, numero);
    assert.equal(rapport.national_key, true);
  }
  assert.equal(ATTENDU.slice(0, 4), 'FR76');
  assert.equal(SUBSTITUE.slice(0, 4), 'FR76');
  assert.equal(ATTENDU.slice(4, 14), '3000600001');
  assert.equal(SUBSTITUE.slice(4, 14), '3000600001');
  assert.notEqual(ATTENDU.slice(14), SUBSTITUE.slice(14));
});

test("point de rupture : témoin, aucune faute d'un chiffre ne passe", () => {
  let passees = 0;
  let essais = 0;
  for (const numero of ibansFrancais(100)) {
    for (let rang = 4; rang < numero.length; rang += 1) {
      for (const chiffre of '0123456789') {
        if (chiffre === numero[rang]) continue;
        essais += 1;
        const faute = numero.slice(0, rang) + chiffre + numero.slice(rang + 1);
        if (checkBankDetails(faute).valid) passees += 1;
      }
    }
  }
  // Le générateur est à graine fixe (3), donc le décompte est reproductible à
  // l'unité : il est asserté à l'égalité, pas dans une fourchette.
  assert.equal(essais, 20_700); // 100 IBAN × 23 positions × 9 autres chiffres
  assert.equal(passees, 0);
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('aucune transposition de deux caractères voisins ne passe', () => {
  let passees = 0;
  let essais = 0;
  for (const numero of ibansFrancais(100)) {
    for (let rang = 4; rang < numero.length - 1; rang += 1) {
      if (numero[rang] === numero[rang + 1]) continue;
      essais += 1;
      const permute =
        numero.slice(0, rang) + numero[rang + 1] + numero[rang] + numero.slice(rang + 2);
      if (checkBankDetails(permute).valid) passees += 1;
    }
  }
  // Docstring : « nor one of their 2 000 adjacent transpositions ».
  assert.equal(essais, 2_000);
  assert.equal(passees, 0);
});

test('la clé RIB ferme ce que la clé ISO laisse passer', () => {
  // Docstring : « The ISO key alone lets 32 of those 6 892 pass — 0.46 % […]
  // the RIB key is what closes that ». Les deux contrôles sur les mêmes
  // entrées, et les trois chiffres publiés assertés à l'égalité : le
  // générateur est à graine fixe (3), donc rien n'autorise une fourchette.
  let seuleIso = 0;
  let ensemble = 0;
  let passees = 0;
  for (const numero of ibansFrancais(500)) {
    for (let rang = 4; rang < numero.length; rang += 1) {
      if (!(numero[rang] in SOSIES)) continue;
      ensemble += 1;
      const faute = numero.slice(0, rang) + SOSIES[numero[rang]] + numero.slice(rang + 1);
      // Le contrôle ISO 13616 seul : le numéro est allé jusqu'à la clé
      // nationale, donc les chiffres de contrôle et le format l'ont laissé passer.
      const rapport = checkBankDetails(faute);
      if (rapport.valid || rapport.national_key === false) seuleIso += 1;
      if (rapport.valid) passees += 1;
    }
  }
  assert.equal(ensemble, 6_892);
  assert.equal(seuleIso, 32);
  assert.equal(passees, 0);
  assert.equal(Math.round((100 * seuleIso) / ensemble * 100) / 100, 0.46);
});

test('la clé RIB est celle de la norme bancaire française', () => {
  // Commentaire : « A and J are 1, B, K and S are 2, and so on to I, R and Z at 9 ».
  assert.equal(
    [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((c) => RIB_LETTERS[c]).join(''),
    '12345678912345678923456789',
  );
  assert.equal(nationalKeyOk('FR', ATTENDU.slice(4)), true);
  assert.equal(nationalKeyOk('FR', SUBSTITUE.slice(4)), true);
  // Un numéro qui passe la clé ISO et échoue à la seule clé RIB : c'est
  // celui-là qu'il faut, sans « ou ». `ibantools` le refuse aussi, ce que la
  // docstring dit et ce que ce test vérifie.
  assert.equal(isValidIBAN(CLE_RIB_SEULE_FAUSSE), false);
  const rapport = checkBankDetails(CLE_RIB_SEULE_FAUSSE);
  assert.equal(rapport.valid, false);
  assert.equal(rapport.national_key, false);
  assert.equal(rapport.reason, 'the RIB key inside the account number does not match');
});

test('Monaco porte la même clé que la France', () => {
  // Commentaire : « Monaco uses the French banking standard: its national part
  // is twenty-three characters too and satisfies the same modulo 97. »
  for (const numero of MONEGASQUES) {
    const rapport = checkBankDetails(numero);
    assert.equal(rapport.country, 'MC', numero);
    assert.equal(rapport.national_key, true, numero);
    assert.equal(rapport.valid, true, numero);
  }
  assert.equal(checkBankDetails('DE89370400440532013000').national_key, null);
});

test("la clé nationale n'est pas calculée hors de France", () => {
  // Docstring : « or null when this snippet has none for that country ».
  assert.equal(nationalKeyOk('DE', '370400440532013000'), null);
  assert.equal(checkBankDetails('DE89370400440532013000').national_key, null);
  assert.equal(checkBankDetails('BE62510007547061').national_key, null);
});

test('le pays est rendu même quand le numéro est refusé', () => {
  assert.equal(checkBankDetails('FR7630006000011234567890188').country, 'FR');
  // Un IBAN brésilien est bien formé, et aucun virement SEPA n'y arrive.
  const bresilien = checkBankDetails('BR1800360305000010009795493C1');
  assert.equal(bresilien.valid, true);
  assert.equal(bresilien.country, 'BR');
});

test('le pays attendu refuse le détournement vers un autre pays', () => {
  const rapport = checkBankDetails('LU280019400644750000', { expectedCountry: 'FR' });
  assert.equal(rapport.valid, false);
  assert.equal(rapport.reason, 'expected a FR account, this one is LU');
  // Témoin : le pays attendu ne change rien quand il correspond.
  assert.equal(checkBankDetails(ATTENDU, { expectedCountry: 'fr' }).valid, true);
});

test('la casse est relevée, pas refusée', () => {
  assert.equal(checkBankDetails('fr7630006000011234567890189').compact, ATTENDU);
});

test('le numéro est rendu groupé par quatre', () => {
  assert.equal(checkBankDetails(ATTENDU).printed, 'FR76 3000 6000 0112 3456 7890 189');
});

test('aucune entrée ne lève, et la raison nomme ce qui a été reçu', () => {
  // Docstring : « Nothing raises ». R14 : la raison dit ce que le code a
  // constaté — le type reçu.
  assert.equal(checkBankDetails(null).reason, 'an IBAN is text, not null');
  assert.equal(checkBankDetails(76.3).reason, 'an IBAN is text, not number');
  assert.equal(checkBankDetails([]).reason, 'an IBAN is text, not object');
  for (const entree of [null, undefined, 0, 76.3, [], {}, Symbol('x'), '', 'x'.repeat(10_000)]) {
    const rapport = checkBankDetails(entree);
    assert.equal(rapport.valid, false);
    assert.equal(typeof rapport.reason, 'string');
    assert.ok(rapport.reason.length > 0);
  }
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test("production : entrée banale, ce qu'on colle d'une facture", () => {
  for (const banale of BANALES) {
    const rapport = checkBankDetails(banale);
    assert.equal(rapport.valid, true, banale);
    assert.equal(rapport.country, banale.trim().slice(0, 2).toUpperCase());
  }
});

test('production : entrée vide', () => {
  assert.equal(checkBankDetails('').reason, 'not letters, digits and separators only');
  assert.equal(checkBankDetails('    ').valid, false);
});

test('production : entrée très grande et terminaison rapide', () => {
  const enorme = `FR76${'3'.repeat(1_000_000)}`;
  const debut = performance.now();
  const rapport = checkBankDetails(enorme);
  assert.ok(performance.now() - debut < 5000);
  assert.equal(rapport.reason, `longer than ${MAX_CHARACTERS} characters`);
});

test('production : encodages inattendus', () => {
  const fines = 'FR76 3000 6000 0112 3456 7890 189';
  assert.equal(checkBankDetails(fines).valid, true);
  for (const parasite of ['﻿', '​', '💶', '٧']) {
    assert.equal(checkBankDetails(`${parasite}${ATTENDU}`).valid, false);
  }
  assert.equal(checkBankDetails('FRÉ76300060000112345678901').valid, false);
});

test('production : valeurs aux limites', () => {
  assert.equal(
    checkBankDetails('FR763000600001').reason,
    `14 characters: an IBAN has ${MIN_LENGTH} to ${MAX_LENGTH}`,
  );
  assert.equal(
    checkBankDetails('FR7630006000011').reason,
    'ISO 13616 check digits, length or registry format do not match',
  );
  const trenteCinq = `FR76${'3'.repeat(31)}`;
  assert.equal(trenteCinq.length, 35);
  assert.equal(
    checkBankDetails(trenteCinq).reason,
    `35 characters: an IBAN has ${MIN_LENGTH} to ${MAX_LENGTH}`,
  );
  const auPlafond = ATTENDU.padStart(MAX_CHARACTERS, ' ');
  assert.equal(auPlafond.length, MAX_CHARACTERS);
  assert.equal(checkBankDetails(auPlafond).valid, true);
  assert.equal(
    checkBankDetails(` ${auPlafond}`).reason,
    `longer than ${MAX_CHARACTERS} characters`,
  );
  assert.equal(
    checkBankDetails('7630006000011234567890189F').reason,
    'an IBAN starts with two letters then two digits',
  );
});

test("production : un IBAN invalide dans un lot n'empêche pas les autres", () => {
  const lot = [ATTENDU, 'pas un IBAN', 'BE62510007547061', '', SUBSTITUE];
  assert.deepEqual(
    lot.map((x) => checkBankDetails(x).valid),
    [true, false, true, false, true],
  );
});

test('production : le contrôle tient la classe de latence annoncée', () => {
  const debut = performance.now();
  for (let i = 0; i < 10_000; i += 1) checkBankDetails('FR76 3000 6000 0112 3456 7890 189');
  assert.ok(performance.now() - debut < 10_000);
});
