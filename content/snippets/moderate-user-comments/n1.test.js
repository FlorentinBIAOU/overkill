import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stableHash } from '../_harness/fake-model.mjs';
import { review } from './n0.js';
import { isAbusive, score, train } from './n1.js';

// Un corpus de la taille d'un après-midi d'étiquetage. Les insultes sont inventées.
const ABUSIVE = [
  'you are a blorptard and everyone here knows it',
  'what a blorptard, go away',
  'typical bl0rptard behaviour on this forum',
  'shut up you zibbernaut',
  'only a zibbernaut would post that',
  'get lost you flarnwit',
  'this flarnwit ruins every thread',
  'nobody wants you here you blorptard',
  'another zibbernaut with an opinion nobody asked for',
  'you absolute flarnwit, learn to read',
  'stop posting zibbernaut nonsense',
  'the usual blorptard reply, well done',
];

const ORDINARY = [
  'great write-up, the third section helped a lot',
  'i disagree with the conclusion but the data is solid',
  'could you add a link to the source please',
  'thank you, this saved me an afternoon of work',
  'the second example does not compile on my machine',
  'i think there is a typo in the last paragraph',
  'has anyone tried this on a large corpus',
  'the diagram is much clearer than the text',
  'i had the same problem last week and your fix works',
  'looking forward to the next part of the series',
  'did you consider the case where the list is empty',
  'you are right about the second point, i was wrong',
];

const LABELS = [...ABUSIVE.map(() => 1), ...ORDINARY.map(() => 0)];
const HOSTILE_UNSEEN = 'people like you should not be allowed to have an account here';
const REPORT = 'he called me a blorptard, please remove his comment';
const TERMS = ['blorptard', 'zibbernaut', 'flarnwit'];
const INSULTS = new Set(['blorptard', 'bl0rptard', 'zibbernaut', 'flarnwit']);
const model = train([...ABUSIVE, ...ORDINARY], LABELS);
const SOURCE = readFileSync(new URL('./n1.js', import.meta.url), 'utf8');

/** Les n-grammes de 3 à 5 caractères que l'extrait hache, recalculés ici pour les compter. */
function grams(text) {
  const padded = ` ${text.normalize('NFKC').toLowerCase()} `;
  const out = new Set();
  for (let n = 3; n <= 5; n += 1) for (let i = 0; i + n <= padded.length; i += 1) out.add(padded.slice(i, i + n));
  return out;
}

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test("point de rupture : l'hostilité sans forme apprise reste sous le seuil", () => {
  assert.ok(Math.abs(score(model, HOSTILE_UNSEEN) - 0.3784) < 1e-3);
  assert.ok(!isAbusive(model, HOSTILE_UNSEEN));
  assert.ok(isAbusive(model, 'get off this forum you blorptard'));
});

test('point de rupture : le signalement passe au-dessus', () => {
  assert.ok(Math.abs(score(model, REPORT) - 0.8904) < 1e-3);
  assert.ok(isAbusive(model, REPORT));
  assert.ok(!isAbusive(model, 'thanks for the detailed explanation'));
});

test("point de rupture : la phrase hostile n'emploie aucune des insultes du corpus", () => {
  assert.ok(ABUSIVE.every((comment) => [...INSULTS].some((insult) => comment.includes(insult))));
  assert.ok(HOSTILE_UNSEEN.split(' ').every((word) => !INSULTS.has(word)));
  assert.ok(REPORT.includes('blorptard'));
});

test('un corpus plus fourni change les poids, pas ce que le modèle lit', () => {
  // « ce que le modèle lit : des n-grammes de caractères » : les cases non nulles
  // sont exactement celles des n-grammes du corpus, quel que soit le corpus.
  const extra = ['you are all flarnwits and zibbernauts', 'people like you should leave', 'nice work on the charts'];
  const larger = train([...ABUSIVE, ...ORDINARY, ...extra], [...LABELS, 1, 1, 0]);
  assert.notDeepEqual([...larger.weights], [...model.weights]);
  assert.notEqual(score(larger, HOSTILE_UNSEEN), score(model, HOSTILE_UNSEEN));
  for (const [trained, corpus] of [[model, [...ABUSIVE, ...ORDINARY]], [larger, [...ABUSIVE, ...ORDINARY, ...extra]]]) {
    const buckets = new Set(corpus.flatMap((c) => [...grams(c)]).map((g) => stableHash(g) % 1024));
    const nonZero = new Set([...trained.weights.keys()].filter((j) => trained.weights[j] !== 0));
    assert.deepEqual(nonZero, buckets);
  }
});

test('N0 et N1 tombent sur le même exemple du signalement', () => {
  assert.ok(review(REPORT, TERMS).flagged);
  assert.ok(isAbusive(model, REPORT));
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test("sépare le corpus sur lequel il a été entraîné", () => {
  for (const comment of ABUSIVE) assert.ok(isAbusive(model, comment), comment);
  for (const comment of ORDINARY) assert.ok(!isAbusive(model, comment), comment);
});

test('attrape les graphies qui déjouent une liste', () => {
  for (const evasion of ['you are a total blorptardd', 'what an obvious bl0rptard', 'flarn-wit']) {
    assert.ok(isAbusive(model, evasion), evasion);
    assert.ok(!review(evasion, TERMS).flagged, evasion);
  }
});

test("bl0rptard et blorptardd partagent l'essentiel de leurs traits", () => {
  const shown = grams('blorptard');
  for (const variant of ['bl0rptard', 'blorptardd']) {
    const own = [...grams(variant)];
    assert.ok(own.filter((g) => shown.has(g)).length / own.length > 0.5, variant);
  }
});

test('chaque classe est pondérée par sa rareté pour ne pas tout laisser passer', async () => {
  // 2 insultes pour 36 commentaires ordinaires. Le même code sans pondération
  // (pas constant) est chargé depuis le source de l'extrait.
  const comments = [...ABUSIVE.slice(0, 2), ...ORDINARY, ...ORDINARY, ...ORDINARY];
  const labels = [1, 1, ...new Array(36).fill(0)];
  const heldOut = ABUSIVE.slice(4);
  const weighted = train(comments, labels);
  assert.deepEqual(heldOut.filter((c) => isAbusive(weighted, c)), ['nobody wants you here you blorptard']);
  assert.ok(Math.abs(score(weighted, 'nobody wants you here you blorptard') - 0.568) < 1e-3);
  const formula = '(rate * labels.length) / (2 * counts[labels[i]])';
  assert.ok(SOURCE.includes(formula));
  const unweighted = await import(`data:text/javascript,${encodeURIComponent(SOURCE.replace(formula, 'rate'))}`);
  const flat = unweighted.train(comments, labels);
  assert.equal(heldOut.filter((c) => unweighted.isAbusive(flat, c)).length, 0);
  assert.ok(Math.max(...heldOut.map((c) => unweighted.score(flat, c))) < 0.3);
});

test('chaque poids peut être imprimé, mais un poids vaut pour tous les n-grammes de sa case', () => {
  // « to argue about one, list those n-grams first » : la liste se reconstruit ainsi.
  const byBucket = new Map();
  for (const g of new Set([...ABUSIVE, ...ORDINARY].flatMap((c) => [...grams(c)]))) {
    const bucket = stableHash(g) % 1024;
    byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), g]);
  }
  const shared = [...byBucket.values()].filter((list) => list.length > 1);
  assert.ok(shared.length > 100, `${shared.length} cases partagées`);
  // Chaque poids non nul du modèle a sa liste de n-grammes, et une liste seulement.
  assert.deepEqual(new Set([...model.weights.keys()].filter((j) => model.weights[j] !== 0)), new Set(byBucket.keys()));
});

test('production : le hachage 32 bits exact répartit les n-grammes sur plus de 800 cases', () => {
  // « Math.imul keeps the multiplication exact on 32 bits » : même empreinte que stableHash du harnais.
  const distinct = new Set([...ABUSIVE, ...ORDINARY].flatMap((c) => [...grams(c)]));
  const nonZero = [...model.weights].filter((w) => w !== 0).length;
  assert.equal(distinct.size, 2006);
  assert.equal(nonZero, 877);
  assert.equal(nonZero, new Set([...distinct].map((g) => stableHash(g) % 1024)).size);
});

test('hacher, entraîner et noter tiennent en quatre fonctions', () => {
  const functions = [...SOURCE.matchAll(/^(?:export )?function (\w+)/gm)].map((m) => m[1]);
  assert.deepEqual(functions, ['features', 'train', 'predict', 'score', 'isAbusive']);
  // isAbusive est la décision, pas le calcul : les quatre autres font le modèle.
});

test('assez petit pour vivre à côté du code, entraîné le temps d’une lecture, sans dépendance', () => {
  assert.equal(model.weights.length, 1024);
  const start = performance.now();
  train([...ABUSIVE, ...ORDINARY], LABELS);
  assert.ok(performance.now() - start < 2000);
  const source = readFileSync(new URL('./n1.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s|require\(/m);
});

test('le score est une probabilité', () => {
  const empty = score(model, '');
  assert.ok(empty >= 0 && empty <= 1);
  assert.ok(score(model, ABUSIVE[0]) > score(model, ORDINARY[0]));
});

test("le seuil est à l'appelant", () => {
  const comments = [...ABUSIVE, ...ORDINARY, HOSTILE_UNSEEN, REPORT];
  const counts = [0, 0.3, 0.5, 0.7, 1].map((t) => comments.filter((c) => isAbusive(model, c, t)).length);
  assert.deepEqual(counts, [...counts].sort((a, b) => b - a));
  assert.equal(counts[0], comments.length);
  assert.equal(counts.at(-1), 0);
});

test('n1 est déterministe', () => {
  const again = train([...ABUSIVE, ...ORDINARY], LABELS);
  assert.deepEqual([...again.weights], [...model.weights]);
  assert.equal(again.bias, model.bias);
});

test("une note prend moins d'une milliseconde", () => {
  const runs = [];
  for (let r = 0; r < 5; r += 1) {
    const start = performance.now();
    for (let i = 0; i < 50; i += 1) score(model, 'get off this forum you blorptard');
    runs.push((performance.now() - start) / 50);
  }
  assert.ok(Math.min(...runs) < 1);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test("production : un commentaire vide n'est pas signalé", () => {
  // « A comment with no n-gram to read scores 0: the bias alone is not evidence. »
  assert.equal(score(model, ''), 0);
  assert.ok(!isAbusive(model, ''));
});

test("DÉFAUT : un commentaire d'espaces n'est pas signalé et vaut 0 ; trois espaces notent 0,71, au-dessus du seuil", async () => {
  // Python : 0. Les n-grammes faits d'espaces sont hachés comme les autres.
  await assert.rejects(async () => {
    for (const blank of ['   ', '\n\t ']) {
      assert.equal(score(model, blank), 0, JSON.stringify(blank));
      assert.ok(!isAbusive(model, blank));
    }
  }, assert.AssertionError);
});

test("production : un corpus vide, d'une seule classe ou mal étiqueté est refusé", () => {
  for (const [comments, labels] of [[[], []], [['you blorptard', 'what a flarnwit'], [1, 1]], [['you blorptard', 'thanks'], [1, 0, 0]]]) {
    assert.throws(() => train(comments, labels), { name: 'RangeError', message: 'train needs labels 0 and 1, one per comment' });
  }
});

test('production : pleine largeur et ligatures sont lues comme les lettres ordinaires', () => {
  assert.equal(score(model, 'you are a ｂｌｏｒｐｔａｒｄ'), score(model, 'you are a blorptard'));
  assert.equal(score(model, 'this ﬂarnwit ruins'), score(model, 'this flarnwit ruins'));
});

test('production : un commentaire de cent Ko termine', () => {
  const start = performance.now();
  assert.ok(isAbusive(model, 'you blorptard '.repeat(7000)));
  assert.ok(performance.now() - start < 2000);
});

test('production : pleine largeur et NFD', () => {
  assert.ok(isAbusive(model, 'you are a ｂｌｏｒｐｔａｒｄ'));
  const nfd = score(model, 'quel flarnwît');
  assert.ok(nfd >= 0 && nfd <= 1);
});
