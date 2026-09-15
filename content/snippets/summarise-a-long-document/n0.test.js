/**
 * Les deux documents des tests : un rapport court, et un document dont la
 * conclusion est répartie entre ses deux bouts. Les scores affirmés ici sont
 * ceux de n0.test.py, au bit près.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scoreSentences, splitSentences, summarise } from './n0.js';

const REPORT = [
  'The support team migrated the ticketing system to a new platform in March.',
  'The migration moved every open ticket to the new platform without losing a single attachment.',
  'Every agent was trained on the new platform during the two weeks before the switch.',
  'The old platform stayed available in read-only mode for a month afterwards.',
  'Agents report that search on the new platform is faster than it was before.',
  'One customer complained about the new ticket numbering, so the team kept the old numbers visible.',
  'The migration is finished and the old platform has been shut down.',
].join(' ');

const SUPPLY = 'The Rouen plant supplies every battery cell used on the Lyon assembly line.';
const CLOSURE = 'The Rouen plant will close at the end of March.';
const FACTORY = [
  SUPPLY,
  'The warehouse in Rouen keeps four weeks of packaging material on site.',
  'Packaging is ordered from two suppliers, and the second supplier was added last year.',
  'The warehouse team works two shifts, and a third shift is added before the summer.',
  'Deliveries leave the warehouse every morning except on Sunday.',
  'The warehouse floor was repainted in April and the racks were replaced at the same time.',
  'A new forklift was bought for the warehouse, and two drivers were trained on it.',
  'The packaging supplier in Lille raised its prices, and the warehouse renegotiated the contract.',
  'The warehouse now reports its stock levels every week instead of every month.',
  'Staff turnover in the warehouse fell after the shift pattern was changed.',
  CLOSURE,
].join(' ');

const FACTORY_SCORES = [
  0.3038461538461539, 0.27291666666666664, 0.1839285714285714, 0.2125, 0.2661111111111111,
  0.1421875, 0.15476190476190477, 0.17946428571428572, 0.2378205128205128, 0.18166666666666664,
  0.11363636363636365,
];

const WORD = /[\p{L}\p{N}]+/gu;

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : deux passages éloignés de dix phrases', () => {
  const sentences = splitSentences(FACTORY);
  assert.equal(sentences.length, 11);
  assert.equal(sentences.indexOf(CLOSURE) - sentences.indexOf(SUPPLY), 10);
});

test('point de rupture : la seconde est courte, tardive, et ses termes ne reparaissent nulle part', () => {
  const sentences = splitSentences(FACTORY);
  const lengths = sentences.map((s) => s.match(WORD).length);
  assert.equal(lengths.at(-1), 10);
  assert.deepEqual([...lengths].sort((a, b) => a - b).slice(0, 2), [9, 10]);
  const elsewhere = new Set(sentences.slice(0, -1).flatMap((s) => s.toLowerCase().match(WORD)));
  assert.deepEqual(['close', 'end', 'march'].filter((w) => elsewhere.has(w)), []);
  const counts = {};
  for (const w of FACTORY.toLowerCase().match(WORD)) counts[w] = (counts[w] ?? 0) + 1;
  assert.equal(Object.entries(counts).filter(([w]) => w.length > 2 && w !== 'the').sort((a, b) => b[1] - a[1])[0][0], 'warehouse');
});

test('point de rupture : elle est la moins bien notée des onze', () => {
  const scores = scoreSentences(splitSentences(FACTORY));
  assert.deepEqual(scores, FACTORY_SCORES);
  assert.equal(scores.indexOf(Math.min(...scores)), 10);
});

test('point de rupture : elle tombe la première, même à huit phrases sur onze', () => {
  assert.ok(summarise(FACTORY, 3).includes(SUPPLY));
  for (let width = 1; width <= 10; width += 1) assert.ok(!summarise(FACTORY, width).includes(CLOSURE), String(width));
  assert.ok(summarise(FACTORY, 11).includes(CLOSURE));
  const dressed = FACTORY.replace(CLOSURE, 'The Rouen warehouse will close at the end of March.');
  assert.ok(summarise(dressed, 8).includes('The Rouen warehouse will close'));
});

test('point de rupture : aucune sélection ne peut rendre la conclusion', () => {
  assert.ok(!splitSentences(summarise(FACTORY, 11)).some((s) => s.includes('assembly') && s.includes('March')));
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('rend le nombre de phrases demandé', () => {
  assert.equal(splitSentences(summarise(REPORT, 3)).length, 3);
  assert.equal(splitSentences(summarise(REPORT, 5)).length, 5);
});

test('chaque phrase du résumé vient du document', () => {
  for (let width = 1; width < 8; width += 1) {
    for (const sentence of splitSentences(summarise(REPORT, width))) assert.ok(REPORT.includes(sentence), sentence);
  }
});

test('garde l’ordre du document plutôt que celui des scores', () => {
  const all = splitSentences(REPORT);
  const positions = splitSentences(summarise(REPORT, 4)).map((s) => all.indexOf(s));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  const factory = splitSentences(FACTORY);
  const chosen = splitSentences(summarise(FACTORY, 5)).map((s) => factory.indexOf(s));
  assert.deepEqual(chosen, [0, 1, 3, 4, 8]);
  assert.deepEqual([...chosen].sort((a, b) => FACTORY_SCORES[b] - FACTORY_SCORES[a]), [0, 1, 4, 8, 3]);
});

test('choisit l’ouverture et les phrases denses', () => {
  const summary = summarise(REPORT, 3);
  assert.ok(summary.startsWith('The support team migrated the ticketing system'));
  assert.ok(summary.includes('trained on the new platform'));
});

test('une longue phrase ne gagne pas par sa taille', () => {
  const padding = 'It is, as it has been said, in the way that they were and that there was, '
    + 'of the sort that this is and that it has been.';
  assert.ok(!summarise(`${REPORT} ${padding}`, 3).includes(padding));
  const once = 'Every agent was trained on the new platform';
  const scores = scoreSentences(['The migration is done.', `${once}.`, `${once} ${once}.`]);
  assert.ok(Math.abs((scores[1] - 0.15 / 2) - (scores[2] - 0.15 / 3)) < 1e-12);
});

test('le bonus d’ouverture décroît avec le rang et ne gagne pas seul', () => {
  const scores = scoreSentences(['Ticket platform migration.', 'Ticket platform migration.', 'Ticket platform migration.']);
  assert.ok(scores[0] > scores[1] && scores[1] > scores[2]);
  assert.ok(Math.abs(scores[0] - scores[2] - 0.1) < 1e-12);
  assert.ok(!summarise(`It is what it is. ${REPORT}`, 3).startsWith('It is what it is.'));
});

test('les abréviations trompent le découpage', () => {
  assert.deepEqual(splitSentences('Dr. Smith signed the order. The plan works.'), ['Dr.', 'Smith signed the order.', 'The plan works.']);
});

test('la classe de mots est celle de Python, accents gardés, ponctuation et soulignement écartés', () => {
  // Commentaire : « The Python counterpart writes the same class as `[^\W_]` ».
  assert.deepEqual('Réunion_reportée, déjà ! n°2'.match(WORD), ['Réunion', 'reportée', 'déjà', 'n', '2']);
});

test('l’extrait n’importe rien', () => {
  assert.doesNotMatch(readFileSync(new URL('./n0.js', import.meta.url), 'utf8'), /^\s*import\s/m);
});

test('deux exécutions rendent le même résumé', () => {
  assert.equal(summarise(FACTORY, 4), summarise(FACTORY, 4));
});

test('verdict : N0 ne peut rien inventer, il ne sait que citer', () => {
  for (let width = 1; width <= 11; width += 1) {
    assert.ok(splitSentences(summarise(FACTORY, width)).every((s) => FACTORY.includes(s)));
  }
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : document vide, d’une phrase, et plus de phrases qu’il n’en existe', () => {
  assert.equal(summarise('', 3), '');
  assert.equal(summarise('   \n  ', 3), '');
  assert.equal(summarise('The plant will close at the end of March.', 3), 'The plant will close at the end of March.');
  assert.equal(summarise('First point. Second point. Third point.', 10), 'First point. Second point. Third point.');
  assert.equal(summarise(REPORT, 0), '');
});

test('production : un document d’un mégaoctet et demi', () => {
  const started = Date.now();
  assert.equal(splitSentences(summarise(REPORT.concat(' ').repeat(3000), 3)).length, 3);
  assert.ok(Date.now() - started < 10_000);
});

test('production : espace insécable, emoji et casse', () => {
  const text = 'The PLATFORM migration 🚀 is done. The platform works. Lunch was served.';
  assert.equal(summarise(text, 2), 'The PLATFORM migration 🚀 is done. The platform works.');
});

test('DÉFAUT : un document NFD coupe ses mots accentués', async () => {
  await assert.rejects(async () => {
    const text = 'La réunion a été reportée. La réunion aura lieu lundi. Le café est offert.';
    assert.deepEqual(scoreSentences(splitSentences(text.normalize('NFD'))), scoreSentences(splitSentences(text)));
  });
});

test('DÉFAUT : un document sans ponctuation finale est rendu entier', async () => {
  await assert.rejects(async () => {
    const transcript = 'the meeting started late\nwe discussed the budget\n'.repeat(500);
    assert.ok(summarise(transcript, 3).length < transcript.length / 2);
  });
});

test('DÉFAUT : un nombre de phrases négatif n’est pas refusé', async () => {
  await assert.rejects(async () => {
    let result;
    try {
      result = summarise(REPORT, -1);
    } catch (error) {
      if (error instanceof RangeError) return;
      throw error;
    }
    assert.equal(result, '');
  });
});
