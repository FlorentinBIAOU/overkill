/**
 * Ces tests injectent un double local au lieu de charger CLD3.
 *
 * Ce qu'ils prouvent : ce que l'extrait fait de la réponse du modèle — le refus
 * sur « und », sur `is_reliable` faux, sous le seuil, sur un texte vide ; la
 * panne nommée ; et l'extrait envoyé, pas le message entier.
 *
 * Ce qu'ils ne prouvent pas : que CLD3 reconnaît une langue. Aucun test d'ici
 * ne le mesure, et la fiche ne l'affirme pas.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MAX_BYTES,
  MIN_BYTES,
  THRESHOLD,
  IdentificationUnavailable,
  cld3Identifier,
  loadedIdentifier,
  detect,
} from './n2.js';

/** La surface de `cld3-asm`, réduite à ce que l'extrait lit. */
function fakeIdentifier({ language = 'fr', probability = 0.99, isReliable = true, fail = null } = {}) {
  const texts = [];
  return {
    texts,
    find(text) {
      texts.push(text);
      if (fail) throw fail;
      return { language, probability, is_reliable: isReliable };
    },
  };
}

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : le code rendu est celui de CLD3, pas le vôtre', async () => {
  // « CLD3 answers in BCP-47 style, and tells Latin-script Hindi from
  // Devanagari Hindi with "hi-Latn". A caller expecting "hi" gets a code it has
  // never seen. »
  assert.equal(await detect('kaise ho', { identifier: fakeIdentifier({ language: 'hi-Latn' }) }), 'hi-Latn');
  // Témoin : l'hindi en devanagari rend « hi », et les deux sont la même langue.
  assert.equal(await detect('कैसे हो', { identifier: fakeIdentifier({ language: 'hi' }) }), 'hi');
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('une langue sûre est rendue', async () => {
  const identifier = fakeIdentifier({ language: 'fr', probability: 0.99 });
  assert.equal(await detect('Bonjour, je voudrais annuler ma commande.', { identifier }), 'fr');
  assert.deepEqual(identifier.texts, ['Bonjour, je voudrais annuler ma commande.']);
});

test('quatre refus, et ils ne sont pas le même dit quatre fois', async () => {
  // « Null on four counts […] an empty text, the code CLD3 uses for
  // "undetermined", its own `is_reliable` set to false, and a probability below
  // the threshold ».
  const vide = fakeIdentifier();
  assert.equal(await detect('', { identifier: vide }), null);
  assert.equal(await detect('   ', { identifier: vide }), null);
  assert.deepEqual(vide.texts, []); // un texte vide ne coûte même pas un appel
  assert.equal(await detect('xxxx', { identifier: fakeIdentifier({ language: 'und' }) }), null);
  assert.equal(await detect('xxxx', { identifier: fakeIdentifier({ isReliable: false }) }), null);
  assert.equal(await detect('xxxx', { identifier: fakeIdentifier({ probability: THRESHOLD - 1e-9 }) }), null);
  // Limite : exactement au seuil, la réponse est rendue.
  assert.equal(await detect('xxxx', { identifier: fakeIdentifier({ probability: THRESHOLD }) }), 'fr');
});

test('les deux poignées doivent s’accorder', async () => {
  // « CLD3 also carries its own `is_reliable` […] both have to agree ».
  assert.equal(await detect('x', { identifier: fakeIdentifier({ probability: 1, isReliable: false }) }), null);
  assert.equal(await detect('x', { identifier: fakeIdentifier({ probability: 0.1, isReliable: true }) }), null);
  assert.equal(await detect('x', { identifier: fakeIdentifier({ probability: 1, isReliable: true }) }), 'fr');
});

test('le seuil est à l’appelant', async () => {
  const identifier = fakeIdentifier({ probability: 0.5 });
  assert.equal(await detect('x', { identifier }), null);
  assert.equal(await detect('x', { identifier, threshold: 0.4 }), 'fr');
});

test('une panne de la bibliothèque est nommée', async () => {
  const identifier = fakeIdentifier({ fail: new Error('model not loaded') });
  await assert.rejects(() => detect('x', { identifier }), IdentificationUnavailable);
});

test('une réponse sans langue est inutilisable', async () => {
  const muet = { find: () => ({ probability: 1, is_reliable: true }) };
  await assert.rejects(() => detect('x', { identifier: muet }), /no language/);
});

/** La surface de `cld3-asm`, réduite à ce que l'adaptateur appelle. */
function fakeModule({ language = 'fr', probability = 0.99, isReliable = true } = {}) {
  const built = [];
  const texts = [];
  const loadModule = async () => ({
    create: (minBytes, maxBytes) => {
      built.push([minBytes, maxBytes]);
      return {
        findLanguage(text) {
          texts.push(text);
          return { language, probability, is_reliable: isReliable };
        },
      };
    },
  });
  return { built, texts, load: async () => ({ loadModule }) };
}

test('production : l’adaptateur appelle la surface du vrai kit', async () => {
  // « The real identifier, and the whole surface of the library this needs » :
  // `loadModule()`, puis `create(minBytes, maxBytes)`, puis `findLanguage(text)`
  // dont on lit `language`, `probability` et `is_reliable`.
  const module = fakeModule({ language: 'hi-Latn', probability: 0.81 });
  const identifier = await cld3Identifier({ load: module.load });
  assert.deepEqual(module.built, [[MIN_BYTES, MAX_BYTES]]);
  assert.deepEqual(identifier.find('kaise ho'), {
    language: 'hi-Latn',
    probability: 0.81,
    is_reliable: true,
  });
  assert.deepEqual(module.texts, ['kaise ho']);
  // Et l'appelant peut changer le plancher en connaissance de cause.
  const autre = fakeModule();
  await cld3Identifier({ minBytes: 0, maxBytes: 2000, load: autre.load });
  assert.deepEqual(autre.built, [[0, 2000]]);
});

test('le plancher et le plafond sont ceux de la bibliothèque', () => {
  // « The library's own defaults, read from its header: below 140 bytes it
  // returns "und", and it predicts on the first 700 bytes ». Les deux valeurs
  // sont `kMinNumBytesToConsider` et `kMaxNumBytesToConsider` de
  // `nnet_language_identifier.cc`, citées dans les sources de la fiche.
  assert.deepEqual([MIN_BYTES, MAX_BYTES], [140, 700]);
});

test('n2 ne charge cld3 que sans double', async () => {
  // « In production it defaults to the real one above ».
  const source = readFileSync(new URL('./n2.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import .* from 'cld3-asm'/m);
  assert.match(source, /import\('cld3-asm'\)/);
  const echoue = async () => {
    await assert.rejects(() => detect('Bonjour'), (error) => {
      assert.equal(error.code, 'ERR_MODULE_NOT_FOUND');
      assert.match(error.message, /cld3-asm/);
      return true;
    });
  };
  // Deux fois : un chargement raté n'est pas une réponse mise en cache.
  await echoue();
  await echoue();
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : un message très long part en entier, et le budget le coupe', async () => {
  // Le plafond d'octets est dans le modèle, pas dans l'extrait : rien n'est refusé.
  const identifier = fakeIdentifier();
  const long = 'Bonjour '.repeat(20_000);
  assert.equal(await detect(long, { identifier }), 'fr');
  assert.deepEqual(identifier.texts, [long]);
});

test('production : encodage inattendu et emoji', async () => {
  const identifier = fakeIdentifier();
  for (const text of ['Bonjour !', 'été ﻿', '🎉 Bonjour 🎉']) {
    assert.equal(await detect(text, { identifier }), 'fr');
  }
});

test('production : une probabilité absente est lue comme nulle', async () => {
  const partiel = { find: () => ({ language: 'fr', is_reliable: true }) };
  assert.equal(await detect('x', { identifier: partiel }), null);
});

// Ce test construit l'identifiant par défaut et le garde : il vient en dernier,
// après celui qui vérifie qu'un chargement raté n'est pas mis en cache.
test('l’identifiant par défaut n’est construit qu’une fois', async () => {
  // « Build one, keep it, do not build one per message ».
  const module = fakeModule();
  const premier = await loadedIdentifier({ load: module.load });
  const second = await loadedIdentifier({ load: module.load });
  assert.equal(premier, second);
  assert.deepEqual(module.built, [[MIN_BYTES, MAX_BYTES]]);
  assert.equal(await detect('Bonjour, la réunion de lundi est reportée.'), 'fr');
  assert.deepEqual(module.built, [[MIN_BYTES, MAX_BYTES]]);
});
