import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mask as maskN0 } from './n0.js';
import { isHidingContactDetails, shape, train } from './n1.js';

// Un petit jeu étiqueté, celui qu'un après-midi d'étiquetage produit.
const HIDING = [
  'call me on zero six twelve thirty four fifty six',
  'reach me at O6 I2 34 56 78',
  'my number is 06 12 34 56 78',
  'ring zero six one two three four five six seven eight',
  'phone: 0 6 1 2 3 4 5 6 7 8',
  'text me on o6.i2.34.56.78',
  'contact seven eight nine four five six one two',
  'my line is O6-I2-34-56-78 thanks',
];

const ORDINARY = [
  'the meeting is at ten in room four',
  'we shipped version two point three yesterday',
  'there are six items left in stock',
  'please review the 2024 report before friday',
  'invoice 4512 is still unpaid',
  'the build takes about three minutes',
  'chapter seven covers the migration',
  'we need four more seats for the workshop',
];

const LABELS = [...HIDING.map(() => 1), ...ORDINARY.map(() => 0)];
const model = train([...HIDING, ...ORDINARY], LABELS);

/** Le score n'est pas exporté : on le retrouve par dichotomie sur le seuil. */
function score(m, message) {
  let low = 0;
  let high = 1;
  for (let i = 0; i < 50; i += 1) {
    const middle = (low + high) / 2;
    if (isHidingContactDetails(m, message, middle)) low = middle;
    else high = middle;
  }
  return low;
}

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : des homoglyphes cyrilliques passent au travers', () => {
  const cyrillic = 'reach me at Об Іb ЗЧ';
  assert.ok(!shape(cyrillic).split(' ').includes('D')); // aucun chiffre ne survit
  assert.equal(shape(cyrillic), 'reach me at об іb зч');
  assert.ok(!isHidingContactDetails(model, cyrillic));
  // Témoin : les sosies latins, eux, sont attrapés.
  assert.ok(isHidingContactDetails(model, 'reach me at O6 I2 34 56 78'));
});

test('point de rupture : des chiffres romains passent au travers', () => {
  const roman = 'call me on VI XII XXXIV LVI';
  assert.equal(shape(roman), 'call me on vi xii xxxiv lvi');
  assert.ok(!isHidingContactDetails(model, roman));
  assert.ok(isHidingContactDetails(model, 'call me on zero six twelve thirty four'));
});

test('point de rupture : le modèle ne connaît que les contournements montrés', () => {
  const german = 'call me on null sechs zwölf';
  assert.ok(!shape(german).split(' ').includes('D'));
  assert.ok(!isHidingContactDetails(model, german));
  assert.ok(isHidingContactDetails(model, 'call me on zero six twelve thirty four'));
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('la mise en forme replie chiffres et sosies', () => {
  assert.equal(shape('O6 I2 34'), 'DD DD DD');
  assert.equal(shape('call me on zero six'), 'call me on D D');
});

test('la mise en forme garde les mots et retire la ponctuation', () => {
  assert.equal(shape('hi! my number, ok?'), 'hi my number ok');
});

test('la mise en forme ne replie pas les lettres sans chiffre réel', () => {
  assert.equal(shape('loll that is funny'), 'loll that is funny');
  assert.equal(shape('l0ll'), 'DDDD');
});

test('la casse compte pour les sosies', () => {
  assert.equal(shape('l0'), 'DD');
  assert.equal(shape('L0'), 'l0');
});

test('attrape un numéro en lettres que N0 laisse passer', () => {
  const message = 'call me on zero six twelve thirty four';
  assert.equal(maskN0(message), message);
  assert.ok(isHidingContactDetails(model, message));
});

test('attrape les caractères sosies', () => {
  assert.ok(isHidingContactDetails(model, 'reach me at O6 I2 34 56 78'));
});

test('laisse passer les messages ordinaires', () => {
  for (const message of ORDINARY) {
    assert.ok(!isHidingContactDetails(model, message), message);
  }
});

test('le seuil est à vous', () => {
  const messages = [...HIDING, ...ORDINARY, 'reach me at 07 98 76 54 32', 'call me on VI XII XXXIV LVI'];
  const flagged = (threshold) => messages.filter((m) => isHidingContactDetails(model, m, threshold)).length;
  const counts = [0, 0.3, 0.5, 0.7, 1].map(flagged);
  assert.deepEqual(counts, [...counts].sort((a, b) => b - a));
  assert.equal(counts[0], messages.length);
  assert.equal(counts.at(-1), 0);
});

test('attrape les emojis touches parce qu’ils portent de vrais chiffres', () => {
  const keycaps = 'call me on 0️⃣6️⃣ 1️⃣2️⃣ 3️⃣4️⃣';
  assert.equal(maskN0(keycaps), keycaps);
  assert.ok(isHidingContactDetails(model, keycaps));
});

test('des chiffres posés à côté de call pèsent plus qu’à côté de mots neutres', () => {
  const number = '07 98 76 54 32';
  assert.ok(score(model, `call me on ${number}`) > score(model, `the code is ${number}`));
});

test('entraîné sur des formes, il attrape un numéro jamais vu', () => {
  const unseen = 'reach me at 07 98 76 54 32';
  assert.ok(HIDING.every((m) => !m.includes('07 98')));
  assert.ok(isHidingContactDetails(model, unseen));
});

test('INFIRMÉ : unavailable_reason N2 dit que N1 traite déjà les adresses ; la mise en forme retire @ et le point', async () => {
  await assert.rejects(async () => {
    assert.notEqual(shape('write to jean.dupont@example.com'), shape('write to jean dupont example com'));
  }, assert.AssertionError);
});

test('n1 est écrit en entier, sans dépendance, avec un vecteur haché de taille fixe', () => {
  // Docstring : « Written out in full rather than pulled from a library » ; commentaire : « no vocabulary to build or ship ».
  const source = readFileSync(new URL('./n1.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s|require\(/m);
  assert.deepEqual(Object.keys(model).sort(), ['bias', 'weights']);
  assert.equal(model.weights.length, 512);
});

test('INFIRMÉ : « logistic regression on hashed character n-grams is forty lines » ; n1.js compte 55 lignes de code', async () => {
  const source = readFileSync(new URL('./n1.js', import.meta.url), 'utf8');
  const codeLines = source.split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*\*|$)/.test(line));
  await assert.rejects(async () => {
    assert.ok(codeLines.length <= 40, `${codeLines.length} lignes`);
  }, assert.AssertionError);
});

test('n1 est déterministe', () => {
  const again = train([...HIDING, ...ORDINARY], LABELS);
  assert.deepEqual([...again.weights], [...model.weights]);
  assert.equal(again.bias, model.bias);
});

test("une décision prend moins d'une milliseconde", () => {
  const runs = [];
  for (let r = 0; r < 5; r += 1) {
    const start = performance.now();
    for (let i = 0; i < 50; i += 1) isHidingContactDetails(model, 'reach me at O6 I2 34 56 78');
    runs.push((performance.now() - start) / 50);
  }
  assert.ok(Math.min(...runs) < 1);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : un message vide rend une décision', () => {
  assert.equal(shape(''), '');
  assert.equal(isHidingContactDetails(model, ''), false);
});

test('production : un message de cent Ko termine vite', () => {
  const start = performance.now();
  assert.equal(isHidingContactDetails(model, 'please review the report '.repeat(4000)), false);
  isHidingContactDetails(model, 'a'.repeat(100_000));
  assert.ok(performance.now() - start < 2000);
});

test('DÉFAUT : les chiffres pleine largeur ne sont pas repliés (\\d sans drapeau u), Python les replie', async () => {
  await assert.rejects(async () => {
    assert.equal(shape('call me on ０６ １２'), 'call me on DD DD');
  }, assert.AssertionError);
});

test('DÉFAUT : sans normalisation, « zéro » en NFD est coupé et n’est plus un chiffre en lettres', async () => {
  const composed = 'appelle au zéro six';
  await assert.rejects(async () => {
    assert.equal(shape(composed.normalize('NFD')), shape(composed));
  }, assert.AssertionError);
});

test("DÉFAUT : un jeu d'entraînement vide est accepté, et le modèle obtenu signale tous les messages", async () => {
  await assert.rejects(async () => {
    let empty;
    try {
      empty = train([], []);
    } catch {
      return;
    }
    assert.equal(isHidingContactDetails(empty, 'bonjour'), false);
  }, assert.AssertionError);
});
