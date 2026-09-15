/**
 * Ces tests injectent un double local au lieu de charger un vrai encodeur.
 *
 * Ce qu'ils prouvent : les descriptions de thèmes sont encodées une fois et non
 * à chaque article, les vecteurs sont ramenés à la longueur un, le cosinus est
 * calculé et trié comme l'extrait le dit, le seuil coupe où il dit couper, et
 * un thème ajouté au dictionnaire sert tout de suite, sans exemple étiqueté.
 *
 * Ce qu'ils ne prouvent pas : que le modèle comprend quoi que ce soit. Le
 * double est un sac de mots haché ; tout ce qu'il score est son propre
 * comportement, pas celui de l'encodeur de la fiche.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeEncoder } from '../_harness/fake-model.mjs';
import { MODEL_NAME, buildLabeller, score, tag } from './n2.js';

const TOPICS = {
  cybersécurité: 'La cybersécurité des entreprises : hameçonnage, rançongiciel et fuite de données.',
  fiscalité: 'La fiscalité des entreprises : impôt, TVA et déclaration fiscale.',
  recrutement: "Le recrutement des salariés : offre, candidature et entretien d'embauche.",
  télétravail: 'Le télétravail des salariés : travail à distance, bureau et domicile.',
};

// L'encodeur réel de l'extrait rend 384 nombres par texte ; le double a la même largeur.
const DIMENSIONS = 384;

// Quatre phrases de cybersécurité, puis une ligne sur l'amende non déductible de l'impôt.
const LONG_ARTICLE =
  "La campagne d'hameçonnage imitait un message de la banque. " +
  'Les salariés ont reçu un courriel frauduleux les invitant à saisir leur ' +
  'identifiant sur un faux site. ' +
  "Le correctif publié la veille n'avait pas encore été installé partout, et " +
  'la fuite de données a touché plusieurs milliers de clients. ' +
  "L'entreprise a porté plainte, puis rappelé les règles internes. " +
  "Le service juridique précise au passage que l'amende éventuelle n'est pas " +
  "déductible de l'impôt.";

const REMOTE_WORK_ARTICLE =
  "Depuis le printemps, l'équipe ne se retrouve au bureau que le mardi. " +
  "Le reste de la semaine, chacun s'organise depuis chez lui, et les " +
  'réunions se tiennent en visioconférence.';

const makeLabeller = (topics = TOPICS) => buildLabeller(topics, new FakeEncoder(DIMENSIONS));

/** Un encodeur dont chaque vecteur est donné, pour calculer un cosinus à la main. */
const fixedEncoder = (vectors) => ({ encode: async (texts) => texts.map((t) => vectors[t]) });

/** Imite `extract(texts, { pooling: 'mean' })` : des lignes Float32Array (avant `.tolist()`, tableaux de nombres). */
class Float32Encoder extends FakeEncoder {
  async encode(texts) {
    return (await super.encode(texts)).map((row) => Float32Array.from(row));
  }
}

/**
 * Imite la fenêtre de l'encodeur réel : Transformers.js tronque au
 * `model_max_length` du tokeniseur, 512 jetons pour
 * Xenova/paraphrase-multilingual-MiniLM-L12-v2. Approximation : 512 mots.
 */
class TruncatingEncoder extends FakeEncoder {
  async encode(texts) {
    return super.encode(texts.map((t) => t.split(/\s+/).slice(0, 512).join(' ')));
  }
}

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : le score est un cosinus, pas une probabilité', async () => {
  const labeller = await buildLabeller(
    { a: 'pour', b: 'contre' },
    fixedEncoder({ pour: [1, 0], contre: [-1, 0], article: [-3, -4] }),
  );
  const scored = await score(labeller, 'article');
  assert.ok(Math.abs(scored.a + 0.6) < 1e-12 && Math.abs(scored.b - 0.6) < 1e-12);
  const total = Object.values(await score(await makeLabeller(), LONG_ARTICLE)).reduce((x, y) => x + y, 0);
  assert.ok(Math.abs(total - 1) > 0.01);
});

test('point de rupture : un seul seuil pour tous les thèmes', () => {
  assert.equal(tag.length, 2); // labeller, article ; le seuil a une valeur par défaut
  assert.match(tag.toString(), /^async function tag\(labeller, article, threshold = 0\.3\)/);
});

test('point de rupture : avec le double, la fiscalité passe sous le seuil et le seuil bas fait entrer le télétravail', async () => {
  // Assertions existantes, gardées : elles décrivent le double, pas l'encodeur réel.
  const labeller = await makeLabeller();
  assert.deepEqual(await tag(labeller, LONG_ARTICLE), ['cybersécurité']);
  assert.deepEqual(await tag(labeller, LONG_ARTICLE, 0.15), ['cybersécurité', 'fiscalité', 'télétravail']);
});

test('INFIRMÉ : « Aucun seuil ne sépare les deux » ; avec le double même, 0,165 garde la fiscalité sans le télétravail', async () => {
  const labeller = await makeLabeller();
  await assert.rejects(async () => {
    for (let step = 0; step <= 1000; step += 1) {
      const kept = await tag(labeller, LONG_ARTICLE, step / 1000);
      assert.ok(!kept.includes('fiscalité') || kept.includes('télétravail'), String(step / 1000));
    }
  }, assert.AssertionError);
});

// ---------------------------------------------------------------------------
// Nom, docstring, commentaires
// ---------------------------------------------------------------------------

test('étiquette un article avec le thème le plus proche', async () => {
  const article = "La campagne d'hameçonnage imitait un message de la banque, et la fuite de données a suivi.";
  const labeller = await makeLabeller();
  assert.deepEqual(await tag(labeller, article), ['cybersécurité']);
  assert.equal(Number((await score(labeller, article))['cybersécurité'].toFixed(4)), 0.5692);
});

test('un article porte plusieurs thèmes, ou aucun', async () => {
  const article = "Les indemnités de télétravail versées aux salariés sont soumises à la TVA et à l'impôt.";
  assert.deepEqual(await tag(await makeLabeller(), article), ['télétravail', 'fiscalité']);
  assert.deepEqual(await tag(await makeLabeller(), 'Le restaurant du coin a changé de carte.'), []);
});

test('les descriptions sont encodées une fois et non à chaque article', async () => {
  const encoder = new FakeEncoder(DIMENSIONS);
  const labeller = await buildLabeller(TOPICS, encoder);
  assert.deepEqual(encoder.calls, [Object.values(TOPICS)]);
  await tag(labeller, 'un article');
  await tag(labeller, 'un autre article');
  assert.deepEqual(encoder.calls.slice(1), [['un article'], ['un autre article']]);
});

test('un article vide score zéro partout', async () => {
  const labeller = await makeLabeller();
  assert.deepEqual(new Set(Object.values(await score(labeller, ''))), new Set([0]));
  assert.deepEqual(await tag(labeller, ''), []);
});

test('un nouveau thème coûte une ligne et aucun exemple étiqueté', async () => {
  const article =
    'La région finance une partie du matériel acheté par les entreprises ' +
    "industrielles, via un guichet de subvention ouvert jusqu'en juin.";
  assert.deepEqual(await tag(await makeLabeller(), article), []);
  const extended = {
    ...TOPICS,
    subventions:
      'Les subventions publiques : la subvention de la région, le guichet ' + "d'aide et le financement du matériel.",
  };
  assert.deepEqual(await tag(await makeLabeller(extended), article), ['subventions']);
});

test('ce que le double ne peut pas prouver', async () => {
  const labeller = await makeLabeller();
  const scored = await score(labeller, REMOTE_WORK_ARTICLE);
  assert.equal(scored['télétravail'], scored['cybersécurité']);
  assert.equal(scored['télétravail'], scored.recrutement);
  assert.deepEqual(await tag(labeller, REMOTE_WORK_ARTICLE), []);
});

test('le score est le cosinus entre l’article et chaque description', async () => {
  const labeller = await buildLabeller({ A: 'a', B: 'b' }, fixedEncoder({ a: [3, 4], b: [0, 2], article: [4, 3] }));
  const scored = await score(labeller, 'article');
  assert.ok(Math.abs(scored.A - 24 / 25) < 1e-12);
  assert.ok(Math.abs(scored.B - 6 / 10) < 1e-12);
});

test('les thèmes sortent du plus proche au plus lointain, puis par nom', async () => {
  const labeller = await buildLabeller(
    { zeta: 'x', beta: 'y', alpha: 'z' },
    fixedEncoder({ x: [1, 0], y: [1, 1], z: [1, 0], article: [1, 0] }),
  );
  assert.deepEqual(await tag(labeller, 'article', 0.5), ['alpha', 'zeta', 'beta']);
});

test('l’encodeur est injecté, et par défaut c’est le vrai', async () => {
  assert.equal(MODEL_NAME, 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');
  await assert.rejects(() => buildLabeller(TOPICS), (error) => {
    assert.equal(error.code, 'ERR_MODULE_NOT_FOUND');
    assert.match(error.message, /@xenova\/transformers/);
    return true;
  });
});

test('un encodeur qui rend des Float32Array est accepté', async () => {
  const plain = await makeLabeller();
  const shaped = await buildLabeller(TOPICS, new Float32Encoder(DIMENSIONS));
  assert.deepEqual(await tag(shaped, LONG_ARTICLE), await tag(plain, LONG_ARTICLE));
  const a = (await score(shaped, LONG_ARTICLE)).fiscalité;
  const b = (await score(plain, LONG_ARTICLE)).fiscalité;
  assert.ok(Math.abs(a - b) < 1e-6);
});

test('la plomberie est déterministe', async () => {
  const labeller = await makeLabeller();
  const first = await score(labeller, LONG_ARTICLE);
  for (let i = 0; i < 5; i += 1) assert.deepEqual(await score(labeller, LONG_ARTICLE), first);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : un dictionnaire de thèmes vide', async () => {
  const labeller = await buildLabeller({}, new FakeEncoder(DIMENSIONS));
  assert.deepEqual(await tag(labeller, LONG_ARTICLE), []);
});

test('production : mille thèmes et un article de 100 Ko terminent vite', async () => {
  const topics = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`thème ${i}`, `description numéro ${i} de la rubrique`]));
  const labeller = await buildLabeller(topics, new FakeEncoder(DIMENSIONS));
  const start = performance.now();
  await tag(labeller, LONG_ARTICLE.repeat(200));
  assert.ok(performance.now() - start < 5000);
});

test('production : valeurs aux limites du seuil', async () => {
  const labeller = await makeLabeller();
  const scored = await score(labeller, LONG_ARTICLE);
  const exact = scored['cybersécurité'];
  assert.ok((await tag(labeller, LONG_ARTICLE, exact)).includes('cybersécurité'));
  assert.ok(!(await tag(labeller, LONG_ARTICLE, exact + 1e-9)).includes('cybersécurité'));
  assert.equal((await tag(labeller, LONG_ARTICLE, -1)).length, 4);
});

test('production : encodage NFD, emoji, BOM ne font pas lever', async () => {
  const labeller = await makeLabeller();
  for (const article of [LONG_ARTICLE.normalize('NFD'), `﻿${LONG_ARTICLE} 🙂`, '​']) {
    assert.ok(Array.isArray(await tag(labeller, article)));
  }
});

test('DÉFAUT : un article plus long que la fenêtre de l’encodeur n’est jugé que sur son début', async () => {
  const filler = Array(58).fill("La campagne d'hameçonnage imitait un message de la banque.").join(' ');
  const article = `${filler} La TVA, l'impôt et la déclaration fiscale des entreprises.`;
  // Témoin : sans fenêtre, la dernière phrase change le score de la fiscalité.
  const plain = await makeLabeller();
  assert.ok((await score(plain, article)).fiscalité > (await score(plain, filler)).fiscalité + 0.001);
  const truncated = await buildLabeller(TOPICS, new TruncatingEncoder(DIMENSIONS));
  await assert.rejects(async () => {
    assert.ok((await score(truncated, article)).fiscalité > (await score(truncated, filler)).fiscalité + 0.001);
  }, assert.AssertionError);
});

test('DÉFAUT : des vecteurs de mauvaise forme ne font pas lever', async () => {
  // Moins de vecteurs que de thèmes : TypeError (vecteur absent). Largeurs
  // différentes ou NaN : le score vaut NaN et le thème disparaît en silence.
  const widths = () => {
    let calls = 0;
    return { encode: async (texts) => texts.map(() => ((calls += 1) <= 2 ? [1, 0, 0] : [1, 0])) };
  };
  const nan = () => {
    let calls = 0;
    return { encode: async (texts) => texts.map(() => ((calls += 1) <= 2 ? [1, 0] : [Number.NaN, 0])) };
  };
  await assert.rejects(async () => {
    for (const encoder of [widths(), nan()]) {
      await assert.rejects(async () => tag(await buildLabeller({ a: 'x', b: 'y' }, encoder), 'article'));
    }
  }, assert.AssertionError);
});
