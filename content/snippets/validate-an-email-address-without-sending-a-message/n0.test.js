import test from 'node:test';
import assert from 'node:assert/strict';
import validator from 'validator';

import { MAX_ADDRESS, MAX_LOCAL, checkEmailSyntax } from './n0.js';

// Les trente-deux adresses sur lesquelles les trois définitions sont comparées.
const BATTERIE = [
  'contact@exemple.fr', 'Contact@Exemple.FR', 'jean.dupont@exemple.fr',
  'jean+tag@exemple.fr', 'jean..dupont@exemple.fr', '.jean@exemple.fr',
  'jean.@exemple.fr', 'jean@exemple', 'jean@localhost', 'jean@[192.168.0.1]',
  'jean@exemple..fr', 'jean@-exemple.fr', 'jean@exemple-.fr',
  '"jean dupont"@exemple.fr', 'jean dupont@exemple.fr', 'jean@exemple.fr ',
  'jean@éxemple.fr', 'jéan@exemple.fr', 'jean@xn--xemple-9ua.fr',
  'jean@exemple.f', `${'a'.repeat(65)}@exemple.fr`, 'a@b.c',
  'jean@exemple.corporate', 'jean@gmial.com', 'jean@exemple.fr\n',
  'jean@@exemple.fr', '@exemple.fr', 'jean@', '', 'jean@exemple.fr.',
  'jean@1.2.3.4', 'jean@[IPv6:::1]',
];

// Entrées ordinaires d'un public francophone.
const BANALES = [
  'jean.dupont@exemple.fr',
  'Jean.Dupont@Exemple.FR',
  'contact@mairie-de-saint-etienne.fr',
  'j.dupont+facture@exemple.fr',
  'service-client@exemple.coop',
  '  contact@exemple.fr  ',
  'prenom.nom@exemple.bzh',
];

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : une faute de frappe sur le domaine passe', () => {
  // « "jean@gmial.com" passe, alors que le domaine est une faute de frappe sur
  // gmail.com, et "contact@exemple.fr" passe sur un domaine sans serveur de
  // courrier. »
  const faute = checkEmailSyntax('jean@gmial.com');
  assert.equal(faute.valid, true);
  assert.equal(faute.routable, true);
  assert.equal(checkEmailSyntax('contact@exemple.fr').valid, true);
  // La syntaxe ne distingue pas les deux domaines : ils ont la même forme.
  assert.equal(checkEmailSyntax('jean@gmail.com').valid, true);
});

test('point de rupture : témoin, la forme est bien contrôlée', () => {
  const refuse = checkEmailSyntax('jean@@exemple.fr');
  assert.equal(refuse.valid, false);
  assert.equal(refuse.reason, 'does not match the HTML definition of an email address');
  for (const mauvaise of ['@exemple.fr', 'jean@', 'jean dupont@exemple.fr',
    'jean@exemple.fr.', 'jean@-exemple.fr', 'jean@exemple..fr']) {
    assert.equal(checkEmailSyntax(mauvaise).valid, false, mauvaise);
  }
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('validator.js ne dit pas la même chose que la définition du navigateur', () => {
  // Docstring : « validator.js 13.15.35 […] return different verdicts […] the
  // browser's definition differs ». Le décompte à trois voix est dans le test
  // Python, qui a les deux bibliothèques ; ici on épingle les cas nommés.
  assert.equal(validator.isEmail('"jean dupont"@exemple.fr'), true);
  assert.equal(checkEmailSyntax('"jean dupont"@exemple.fr').valid, false);
  assert.equal(validator.isEmail('jean@exemple.f'), false);
  assert.equal(checkEmailSyntax('jean@exemple.f').valid, true);
  assert.equal(validator.isEmail('a@b.c'), false);
  assert.equal(checkEmailSyntax('a@b.c').valid, true);
  assert.equal(validator.isEmail('jean@localhost'), false);
  assert.equal(checkEmailSyntax('jean@localhost').valid, true);
  // Témoin : sur une adresse ordinaire, les deux disent oui.
  assert.equal(validator.isEmail('jean.dupont@exemple.fr'), true);
  assert.equal(checkEmailSyntax('jean.dupont@exemple.fr').valid, true);
});

test('une partie locale de soixante-cinq caractères est refusée', () => {
  // Docstring : « a sixty-five-character local part […] RFC 5321 caps it at
  // sixty-four ».
  const longue = `${'a'.repeat(65)}@exemple.fr`;
  const rapport = checkEmailSyntax(longue);
  assert.equal(rapport.valid, false);
  assert.equal(rapport.reason, `the part before the @ is over ${MAX_LOCAL} characters`);
  // Témoin : soixante-quatre passent.
  assert.equal(checkEmailSyntax(`${'a'.repeat(64)}@exemple.fr`).valid, true);
});

test('seul le domaine est mis en minuscules', () => {
  const rapport = checkEmailSyntax('Jean.DUPONT@Exemple.FR');
  assert.equal(rapport.normalised, 'Jean.DUPONT@exemple.fr');
  assert.equal(rapport.local, 'Jean.DUPONT');
  assert.equal(rapport.domain, 'exemple.fr');
});

test('un domaine sans point est valide et non routable', () => {
  const rapport = checkEmailSyntax('jean@localhost');
  assert.equal(rapport.valid, true);
  assert.equal(rapport.routable, false);
  // Témoin : le même compte sur un domaine public est routable.
  assert.equal(checkEmailSyntax('jean@exemple.fr').routable, true);
});

test('une adresse accentuée est refusée comme par le navigateur', () => {
  for (const accentuee of ['jéan@exemple.fr', 'jean@éxemple.fr']) {
    assert.equal(checkEmailSyntax(accentuee).valid, false, accentuee);
    assert.equal(validator.isEmail(accentuee), true, accentuee);
  }
  // Témoin : la forme punycode du même domaine passe.
  assert.equal(checkEmailSyntax('jean@xn--xemple-9ua.fr').valid, true);
});

test('les blancs de bord sont retirés comme le fait le navigateur', () => {
  assert.equal(checkEmailSyntax('  contact@exemple.fr\n').normalised, 'contact@exemple.fr');
  assert.equal(validator.isEmail('contact@exemple.fr\n'), false);
  // Témoin : un blanc à l'intérieur reste une faute.
  assert.equal(checkEmailSyntax('con tact@exemple.fr').valid, false);
});

test('aucune entrée ne lève', () => {
  for (const entree of [null, undefined, 0, 4.2, [], {}, Symbol('x'), '', 'x'.repeat(10_000)]) {
    const rapport = checkEmailSyntax(entree);
    assert.equal(rapport.valid, false);
    assert.equal(typeof rapport.reason, 'string');
    assert.ok(rapport.reason.length > 0);
  }
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test("production : entrée banale, ce qu'on saisit dans un formulaire", () => {
  for (const banale of BANALES) {
    const rapport = checkEmailSyntax(banale);
    assert.equal(rapport.valid, true, banale);
    assert.equal(rapport.routable, true, banale);
  }
});

test('production : entrée vide', () => {
  assert.equal(checkEmailSyntax('').valid, false);
  assert.equal(checkEmailSyntax('   ').valid, false);
  assert.equal(
    checkEmailSyntax('   ').reason,
    'does not match the HTML definition of an email address',
  );
});

test('production : entrée très grande et terminaison rapide', () => {
  // Une adresse d'un mégaoctet : l'expression régulière ne doit pas
  // s'effondrer. Le motif du standard n'a pas de retour arrière imbriqué, et
  // le test le vérifie plutôt que de le supposer.
  for (const enorme of [
    `${'a'.repeat(1_000_000)}@exemple.fr`,
    `a@${'b'.repeat(1_000_000)}`,
    `${'a'.repeat(500_000)}${'.'.repeat(500_000)}@exemple.fr`,
  ]) {
    const debut = performance.now();
    const rapport = checkEmailSyntax(enorme);
    assert.ok(performance.now() - debut < 5000);
    assert.equal(rapport.valid, false);
  }
});

test('production : encodages inattendus', () => {
  for (const parasite of ['﻿', '​', '🙂', ' ']) {
    assert.equal(checkEmailSyntax(`jean${parasite}@exemple.fr`).valid, false, parasite);
  }
  assert.equal(checkEmailSyntax('jéan@exemple.fr').valid, false);
  assert.equal(checkEmailSyntax('jean@EXEMPLE.FR').domain, 'exemple.fr');
});

test('production : valeurs aux limites', () => {
  for (const [longueur, attendu] of [[63, true], [64, true], [65, false]]) {
    assert.equal(checkEmailSyntax(`${'a'.repeat(longueur)}@exemple.fr`).valid, attendu);
  }
  const domaine = `@${'b'.repeat(60)}.fr`;
  const local = 'a'.repeat(MAX_ADDRESS - domaine.length);
  const auPlafond = local + domaine;
  assert.equal(auPlafond.length, MAX_ADDRESS);
  assert.equal(checkEmailSyntax(auPlafond).valid, false);
  const etiquettes = Array(4).fill('b'.repeat(61)).join('.');
  const adresse = `a@${etiquettes}`;
  assert.equal(checkEmailSyntax(adresse).valid, adresse.length <= MAX_ADDRESS);
});

test("production : une adresse invalide dans un lot n'empêche pas les autres", () => {
  const lot = ['jean@exemple.fr', 'pas une adresse', 'marie@exemple.fr', '', 'jean@localhost'];
  assert.deepEqual(
    lot.map((x) => checkEmailSyntax(x).valid),
    [true, false, true, false, true],
  );
});

test('production : le contrôle tient la classe de latence annoncée', () => {
  const debut = performance.now();
  for (let i = 0; i < 100_000; i += 1) checkEmailSyntax('jean.dupont@exemple.fr');
  assert.ok(performance.now() - debut < 10_000);
});

test('la batterie de comparaison tient trente-deux adresses', () => {
  assert.equal(BATTERIE.length, 32);
});
