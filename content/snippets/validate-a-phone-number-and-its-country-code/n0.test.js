import test from 'node:test';
import assert from 'node:assert/strict';

import { MAX_CHARACTERS, validatePhoneNumber } from './n0.js';

// Le Bénin est passé à dix chiffres : l'ancienne forme à huit n'est plus dans
// le plan, la nouvelle y est.
const BENIN_ANCIEN = '+229 97 12 34 56';
const BENIN_ACTUEL = '+229 01 97 12 34 56';

// Les mêmes chiffres, deux pays, deux natures de ligne.
const AMBIGU = '0470 12 34 56';

// Entrées ordinaires du public visé : francophone, souvent européen ou africain.
const BANALES = [
  ['06 12 34 56 78', 'FR', '+33612345678', 'MOBILE'],
  ['01 23 45 67 89', 'FR', '+33123456789', 'FIXED_LINE'],
  ['+33 6 12 34 56 78', undefined, '+33612345678', 'MOBILE'],
  ['0033 6 12 34 56 78', 'FR', '+33612345678', 'MOBILE'],
  ['+32 470 12 34 56', undefined, '+32470123456', 'MOBILE'],
  ['+41 79 123 45 67', undefined, '+41791234567', 'MOBILE'],
  ['+225 07 12 34 56 78', undefined, '+2250712345678', 'MOBILE'],
  ['+221 77 123 45 67', undefined, '+221771234567', 'MOBILE'],
  ['+212 6 12 34 56 78', undefined, '+212612345678', 'MOBILE'],
  ['+237 6 71 23 45 67', undefined, '+237671234567', 'MOBILE'],
];

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test("point de rupture : un numéro béninois d'hier est refusé aujourd'hui", () => {
  const rapport = validatePhoneNumber(BENIN_ANCIEN);
  assert.equal(rapport.valid, false);
  assert.equal(rapport.region, 'BJ');
  assert.equal(rapport.reason, "not in a numbering plan: no prefix of that country's plan matches");
  // Le numéro est bien lu, et la longueur seule ne suffit pas à le refuser :
  // c'est le préfixe qui n'est plus attribué.
  assert.equal(rapport.e164, '+22997123456');
});

test('point de rupture : témoin, la forme actuelle passe', () => {
  assert.deepEqual(validatePhoneNumber(BENIN_ACTUEL), {
    valid: true,
    region: 'BJ',
    type: 'MOBILE',
    e164: '+2290197123456',
    reason: null,
  });
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test("la région n'est jamais devinée", () => {
  const rapport = validatePhoneNumber('06 12 34 56 78');
  assert.equal(rapport.valid, false);
  assert.equal(
    rapport.reason,
    'no country code in the number and no region declared by the caller',
  );
  // Témoin : le même numéro avec le + n'a besoin de rien.
  assert.equal(validatePhoneNumber('+33 6 12 34 56 78').valid, true);
});

test('les mêmes chiffres donnent deux pays et deux natures de ligne', () => {
  const francais = validatePhoneNumber(AMBIGU, { defaultRegion: 'FR' });
  const belge = validatePhoneNumber(AMBIGU, { defaultRegion: 'BE' });
  assert.equal(francais.valid, true);
  assert.equal(belge.valid, true);
  assert.deepEqual([francais.e164, francais.type], ['+33470123456', 'FIXED_LINE']);
  assert.deepEqual([belge.e164, belge.type], ['+32470123456', 'MOBILE']);
  // Témoin : hors de ces deux pays, les mêmes chiffres ne sont pas un numéro.
  assert.equal(validatePhoneNumber(AMBIGU, { defaultRegion: 'CH' }).valid, false);
});

test("la nature de la ligne dit qu'un SMS n'arrivera pas", () => {
  const fixe = validatePhoneNumber('01 23 45 67 89', { defaultRegion: 'FR' });
  assert.equal(fixe.valid, true);
  assert.equal(fixe.type, 'FIXED_LINE');
  const mobile = validatePhoneNumber('06 12 34 56 78', { defaultRegion: 'FR' });
  assert.equal(mobile.valid, true);
  assert.equal(mobile.type, 'MOBILE');
});

test('la raison sépare la longueur du préfixe', () => {
  assert.equal(
    validatePhoneNumber('+33 6 45').reason,
    'not in a numbering plan: the wrong length for its country',
  );
  assert.equal(
    validatePhoneNumber(BENIN_ANCIEN).reason,
    "not in a numbering plan: no prefix of that country's plan matches",
  );
});

test('aucune entrée ne lève', () => {
  for (const entree of [null, undefined, 0, 33.6, [], {}, Symbol('x'), '', 'x'.repeat(10_000), '+++']) {
    const rapport = validatePhoneNumber(entree, { defaultRegion: 'FR' });
    assert.equal(rapport.valid, false);
    assert.equal(typeof rapport.reason, 'string');
    assert.ok(rapport.reason.length > 0);
  }
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test("production : entrée banale, ce qu'on saisit dans un formulaire", () => {
  for (const [ecrit, region, e164, nature] of BANALES) {
    const rapport = validatePhoneNumber(ecrit, { defaultRegion: region });
    assert.equal(rapport.valid, true, ecrit);
    assert.equal(rapport.e164, e164, ecrit);
    assert.equal(rapport.type, nature, ecrit);
  }
});

test('production : entrée vide', () => {
  assert.equal(validatePhoneNumber('', { defaultRegion: 'FR' }).valid, false);
  assert.equal(validatePhoneNumber('   ', { defaultRegion: 'FR' }).valid, false);
  assert.equal(
    validatePhoneNumber('').reason,
    'no country code in the number and no region declared by the caller',
  );
});

test('production : entrée très grande et terminaison rapide', () => {
  const enorme = `+33${'6'.repeat(1_000_000)}`;
  const debut = performance.now();
  const rapport = validatePhoneNumber(enorme);
  assert.ok(performance.now() - debut < 5000);
  assert.equal(rapport.reason, `longer than ${MAX_CHARACTERS} characters`);
});

test('production : encodages inattendus', () => {
  // Espaces de toutes largeurs, points, tirets, parenthèses : le numéro lu
  // reste le même. L'espace fine insécable est celle que la bibliothèque ne
  // traverse pas d'elle-même, et que l'extrait nivelle avant de l'appeler.
  for (const ecrit of [
    '06 12 34 56 78',
    '06.12.34.56.78',
    '06-12-34-56-78',
    '(0)6 12 34 56 78',
    '06 12 34 56 78',
    '06 12 34 56 78',
    '06　12　34　56　78',
  ]) {
    assert.equal(validatePhoneNumber(ecrit, { defaultRegion: 'FR' }).e164, '+33612345678', ecrit);
  }
  // Les chiffres arabo-indiens sont des chiffres : la bibliothèque les
  // convertit, et le numéro lu est le même.
  const arabes = '\u0660\u0666\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668';
  assert.equal(validatePhoneNumber(arabes, { defaultRegion: 'FR' }).e164, '+33612345678');
  // Largeur nulle, marque d'ordre des octets, emoji : ce ne sont ni des
  // chiffres ni de la ponctuation de numéro, et ils sont refusés.
  for (const parasite of ['\u200b', '\ufeff', '\u260e\ufe0f']) {
    const rapport = validatePhoneNumber(`06 12 34 56 78${parasite}`, { defaultRegion: 'FR' });
    assert.equal(rapport.valid, false, parasite);
    assert.equal(rapport.reason, 'contains something that is not a number');
  }
});

test('production : un mot collé au numéro est refusé et non lu en chiffres', () => {
  // Commentaire : « libphonenumber reads them as the keys of a telephone
  // keypad, so “06 12 34 56 78 poste 42” becomes a longer number that is not
  // the one anybody typed. » La garde refuse avant d'appeler.
  const rapport = validatePhoneNumber('06 12 34 56 78 poste 42', { defaultRegion: 'FR' });
  assert.equal(rapport.valid, false);
  assert.equal(rapport.e164, null);
  assert.equal(rapport.reason, 'contains something that is not a number');
  // Témoin : le même numéro sans le mot passe.
  assert.equal(validatePhoneNumber('06 12 34 56 78', { defaultRegion: 'FR' }).valid, true);
});

test('production : valeurs aux limites', () => {
  const auPlafond = '+33 6 12 34 56 78'.padStart(MAX_CHARACTERS);
  assert.equal(auPlafond.length, MAX_CHARACTERS);
  assert.equal(validatePhoneNumber(auPlafond).valid, true);
  assert.equal(
    validatePhoneNumber(` ${auPlafond}`).reason,
    `longer than ${MAX_CHARACTERS} characters`,
  );
  assert.equal(validatePhoneNumber('+3361234567').valid, false);
  assert.equal(validatePhoneNumber('+336123456789').valid, false);
  assert.equal(validatePhoneNumber('+33612345678').valid, true);
});

test("production : un numéro invalide dans un lot n'empêche pas les autres", () => {
  const lot = ['+33612345678', 'pas un numéro', BENIN_ACTUEL, '', BENIN_ANCIEN, '+32470123456'];
  assert.deepEqual(
    lot.map((x) => validatePhoneNumber(x).valid),
    [true, false, true, false, false, true],
  );
});

test('production : le contrôle tient la classe de latence annoncée', () => {
  const debut = performance.now();
  for (let i = 0; i < 10_000; i += 1) {
    validatePhoneNumber('06 12 34 56 78', { defaultRegion: 'FR' });
  }
  assert.ok(performance.now() - debut < 20_000);
});
