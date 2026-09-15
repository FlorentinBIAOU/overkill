import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
const model = train([...ABUSIVE, ...ORDINARY], LABELS);

/** Les n-grammes de 3 à 5 caractères que l'extrait hache, recalculés ici pour les compter. */
function grams(text) {
  const padded = ` ${text.toLowerCase()} `;
  const out = new Set();
  for (let n = 3; n <= 5; n += 1) for (let i = 0; i + n <= padded.length; i += 1) out.add(padded.slice(i, i + n));
  return out;
}

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test("point de rupture : l'hostilité sans forme apprise reste sous le seuil", () => {
  assert.ok(Math.abs(score(model, HOSTILE_UNSEEN) - 0.1396) < 1e-3);
  assert.ok(!isAbusive(model, HOSTILE_UNSEEN));
  assert.ok(isAbusive(model, 'get off this forum you blorptard'));
});

test('point de rupture : le signalement repasse au-dessus', () => {
  assert.ok(Math.abs(score(model, REPORT) - 0.8173) < 1e-3);
  assert.ok(isAbusive(model, REPORT));
  assert.ok(!isAbusive(model, 'thanks for the detailed explanation'));
});

test('INFIRMÉ : la phrase hostile « ne réemploie aucune forme vue à l’entraînement » ; elle en partage des dizaines', async () => {
  const seen = new Set([...ABUSIVE, ...ORDINARY].flatMap((c) => [...grams(c)]));
  await assert.rejects(async () => {
    assert.equal([...grams(HOSTILE_UNSEEN)].filter((g) => seen.has(g)).length, 0);
  }, assert.AssertionError);
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

test('chaque classe est pondérée par sa rareté pour ne pas tout laisser passer ; sur 2 insultes pour 36 commentaires, le modèle pondéré laisse tout passer (Python en attrape 2)', async () => {
  const comments = [...ABUSIVE.slice(0, 2), ...ORDINARY, ...ORDINARY, ...ORDINARY];
  const labels = [1, 1, ...new Array(36).fill(0)];
  const weighted = train(comments, labels);
  assert.ok(ABUSIVE.slice(4).some((c) => isAbusive(weighted, c)));
});

test('INFIRMÉ : « chaque poids peut être imprimé et discuté » ; un poids est une case de hachage partagée par plusieurs n-grammes', async () => {
  // 2 006 n-grammes distincts dans le corpus, 499 poids non nuls.
  const distinct = new Set([...ABUSIVE, ...ORDINARY].flatMap((c) => [...grams(c)])).size;
  const nonZero = [...model.weights].filter((w) => w !== 0).length;
  await assert.rejects(async () => {
    assert.equal(nonZero, distinct);
  }, assert.AssertionError);
});

test("DÉFAUT : le hachage FNV multiplie en flottant et perd ses bits bas ; 2 006 n-grammes n'occupent que 499 cases sur 1 024", async () => {
  // Réparties au hasard, 2 006 clés occuperaient environ 880 cases.
  const nonZero = [...model.weights].filter((w) => w !== 0).length;
  assert.equal(nonZero, 499);
  await assert.rejects(async () => {
    assert.ok(nonZero > 800);
  }, assert.AssertionError);
});

test('INFIRMÉ : « une régression logistique sur des n-grammes de caractères hachés tient en quarante lignes » ; n1.js en compte 41', async () => {
  const source = readFileSync(new URL('./n1.js', import.meta.url), 'utf8');
  const lines = source.split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*\*|$)/.test(line)).length;
  assert.equal(lines, 41);
  await assert.rejects(async () => {
    assert.ok(lines <= 40);
  }, assert.AssertionError);
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

test("un commentaire vide est jugé injurieux (score 0,67) ; Python le laisse passer (0,45)", async () => {
  assert.ok(!isAbusive(model, ''));
});

test("un corpus vide ou d'une seule classe est accepté, et le modèle obtenu signale tout", async () => {
  for (const [comments, labels] of [[[], []], [['you blorptard', 'what a flarnwit'], [1, 1]]]) {
    let trained;
    try {
      trained = train(comments, labels);
    } catch {
      continue;
    }
    assert.ok(!isAbusive(trained, 'thank you for the article'));
  }
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
