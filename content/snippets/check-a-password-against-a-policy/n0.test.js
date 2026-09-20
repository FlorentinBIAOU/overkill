import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  MAXIMUM, MINIMUM, MINIMUM_WITH_SECOND_FACTOR, RANGE_URL, checkPassword, pwnedCount,
} from './n0.js';

// La liste de fuites que le double sert. Ce sont les mots de passe qui ont
// réellement fuité par millions ; leur compte ici est celui du double, pas
// celui du service.
const FUITES = {
  motdepasse: 9_999,
  'Motdepasse1!': 42,
  'correct horse battery staple': 120,
  azertyuiopqsdfghjklm: 7,
  aaaaaaaaaaaaaaaa: 3,
};

// Vingt-deux caractères, le prénom et l'année de naissance de la fille du
// titulaire : absent de toute liste de fuite, et personne ne devrait l'accepter.
const FILLE = 'Clementine-2019-Martin';

const BANALES = ['le chat dort sur le radiateur', "j'habite au 12 rue des Lilas",
  'Mon café du matin est trop chaud', FILLE];

const sha1 = (mot) => createHash('sha1').update(mot, 'utf8').digest('hex').toUpperCase();

/**
 * Le service Have I Been Pwned, remplacé par une plage locale.
 *
 * `vues` recueille les adresses demandées : c'est ce qui permet de vérifier
 * que le mot de passe ne sort jamais.
 */
function double(vues) {
  return async (url) => {
    if (vues) vues.push(url);
    const prefixe = url.slice(RANGE_URL.length);
    const lignes = Object.entries(FUITES)
      .filter(([mot]) => sha1(mot).slice(0, 5) === prefixe)
      .map(([mot, n]) => `${sha1(mot).slice(5)}:${n}`);
    for (let i = lignes.length; i < 800; i += 1) {
      lignes.push(`${i.toString(16).toUpperCase().padStart(35, '0')}:0`);
    }
    return lignes.join('\r\n');
  };
}

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test("point de rupture : le contrôle ne connaît que ce qui a déjà fuité", async () => {
  assert.deepEqual(await checkPassword(FILLE, { fetchRange: double() }), {
    acceptable: true, reasons: [], breaches: 0, length: 22,
  });
});

test("point de rupture : témoin, un mot de passe assez long mais fuité est refusé", async () => {
  const rapport = await checkPassword('correct horse battery staple', { fetchRange: double() });
  assert.equal(rapport.length, 28);
  assert.ok(rapport.length >= MINIMUM);
  assert.equal(rapport.acceptable, false);
  assert.deepEqual(rapport.reasons, ['breached']);
  assert.equal(rapport.breaches, 120);
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('le mot de passe ne sort jamais, seuls cinq caractères de son haché', async () => {
  const vues = [];
  const mot = 'le chat dort sur le radiateur';
  await checkPassword(mot, { fetchRange: double(vues) });
  assert.equal(vues.length, 1);
  const adresse = vues[0];
  assert.equal(adresse, RANGE_URL + sha1(mot).slice(0, 5));
  assert.equal(adresse.slice(RANGE_URL.length).length, 5);
  assert.ok(!adresse.includes(mot));
  assert.ok(!adresse.includes(sha1(mot)));
  assert.ok(!adresse.includes(sha1(mot).slice(5)));
});

test("la liste n'est interrogée que si la réponse peut encore changer", async () => {
  const vues = [];
  await checkPassword('court', { fetchRange: double(vues) });
  assert.deepEqual(vues, []);
  await checkPassword('le chat dort sur le radiateur', { fetchRange: double(vues) });
  assert.equal(vues.length, 1);
});

test("aucune règle de composition n'est imposée", async () => {
  assert.deepEqual(
    (await checkPassword('aaaaaaaaaaaaaaaa', { fetchRange: double() })).reasons, ['breached'],
  );
  assert.equal(
    (await checkPassword('le chat dort sur le radiateur', { fetchRange: double() })).acceptable,
    true,
  );
  assert.deepEqual(
    (await checkPassword('Motdepasse1!', { fetchRange: double() })).reasons, ['too-short'],
  );
});

test('deux écritures du même mot de passe sont le même mot de passe', async () => {
  const compose = 'le café du matin est trop chaud'.normalize('NFC');
  const decompose = 'le café du matin est trop chaud'.normalize('NFD');
  assert.notEqual(compose, decompose);
  const vues = [];
  await checkPassword(compose, { fetchRange: double(vues) });
  await checkPassword(decompose, { fetchRange: double(vues) });
  assert.equal(vues[0], vues[1]);
  assert.deepEqual(
    await checkPassword(compose, { fetchRange: double() }),
    await checkPassword(decompose, { fetchRange: double() }),
  );
});

test('un mot du contexte est refusé', async () => {
  const rapport = await checkPassword('boulangerie-martin', {
    context: ['Boulangerie-Martin'], fetchRange: double(),
  });
  assert.ok(rapport.reasons.includes('context-word'));
  assert.equal(
    (await checkPassword('boulangerie-martin', { fetchRange: double() })).acceptable, true,
  );
});

test("le plancher descend quand il y a un second facteur", async () => {
  const mot = 'aubergine12';
  assert.equal(mot.length, 11);
  assert.deepEqual((await checkPassword(mot, { fetchRange: double() })).reasons, ['too-short']);
  assert.equal(
    (await checkPassword(mot, { secondFactor: true, fetchRange: double() })).acceptable, true,
  );
});

test("pwnedCount rend zéro quand le suffixe n'est pas dans la plage", async () => {
  assert.equal(await pwnedCount('motdepasse', double()), 9_999);
  assert.equal(await pwnedCount(FILLE, double()), 0);
});

test('aucune entrée ne lève', async () => {
  for (const entree of [null, undefined, 0, 4.2, [], {}, Symbol('x')]) {
    const rapport = await checkPassword(entree, { fetchRange: double() });
    assert.equal(rapport.acceptable, false);
    assert.deepEqual(rapport.reasons, ['not-text']);
  }
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : entrée banale, une phrase de passe française', async () => {
  for (const banale of BANALES) {
    const rapport = await checkPassword(banale, { fetchRange: double() });
    assert.equal(rapport.acceptable, true, banale);
    assert.equal(rapport.breaches, 0, banale);
  }
});

test('production : entrée vide', async () => {
  assert.deepEqual(await checkPassword('', { fetchRange: double() }), {
    acceptable: false, reasons: ['too-short'], breaches: null, length: 0,
  });
});

test('production : entrée très grande et terminaison rapide', async () => {
  const enorme = 'a'.repeat(1_000_000);
  const debut = performance.now();
  const rapport = await checkPassword(enorme, { fetchRange: double() });
  assert.ok(performance.now() - debut < 5000);
  assert.deepEqual(rapport.reasons, ['too-long']);
  const vues = [];
  await checkPassword(enorme, { fetchRange: double(vues) });
  assert.deepEqual(vues, []);
});

test('production : encodages inattendus', async () => {
  for (const mot of ['mon chat 🐈 dort sur le radiateur',
    'le chat dort sur le radiateur',
    'le chat​dort sur le radiateur']) {
    assert.equal((await checkPassword(mot, { fetchRange: double() })).acceptable, true, mot);
  }
  const chats = '🐈'.repeat(15);
  assert.equal((await checkPassword(chats, { fetchRange: double() })).length, 15);
  assert.equal((await checkPassword(chats, { fetchRange: double() })).acceptable, true);
});

test('production : valeurs aux limites', async () => {
  for (const [longueur, attendu] of [[MINIMUM - 1, ['too-short']], [MINIMUM, []], [MINIMUM + 1, []]]) {
    const rapport = await checkPassword('b'.repeat(longueur), { fetchRange: double() });
    assert.deepEqual(rapport.reasons, attendu, String(longueur));
  }
  for (const [longueur, attendu] of [[MAXIMUM, []], [MAXIMUM + 1, ['too-long']]]) {
    const rapport = await checkPassword('c'.repeat(longueur), { fetchRange: double() });
    assert.deepEqual(rapport.reasons, attendu, String(longueur));
  }
  const court = 'd'.repeat(MINIMUM_WITH_SECOND_FACTOR - 1);
  assert.deepEqual(
    (await checkPassword(court, { secondFactor: true, fetchRange: double() })).reasons,
    ['too-short'],
  );
  assert.deepEqual(
    (await checkPassword('d'.repeat(MINIMUM_WITH_SECOND_FACTOR),
      { secondFactor: true, fetchRange: double() })).reasons,
    [],
  );
});

test("production : un mot de passe refusé n'empêche pas de vérifier les suivants", async () => {
  const lot = [FILLE, null, 'motdepasse', '', 'le chat dort sur le radiateur'];
  const vus = [];
  for (const mot of lot) vus.push((await checkPassword(mot, { fetchRange: double() })).acceptable);
  assert.deepEqual(vus, [true, false, false, false, true]);
});

test('production : le contrôle tient la classe de latence annoncée', async () => {
  // latency « ~100 ms » : la classe est celle de l'aller-retour réseau, que le
  // double ne mesure pas. Ce test ne borne que la part locale — hachage,
  // normalisation, comparaison — sur dix mille contrôles.
  const fetchRange = double();
  const debut = performance.now();
  for (let i = 0; i < 10_000; i += 1) {
    await checkPassword('le chat dort sur le radiateur', { fetchRange });
  }
  assert.ok(performance.now() - debut < 60_000);
});
