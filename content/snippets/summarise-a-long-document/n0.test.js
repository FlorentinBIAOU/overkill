import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreSentences, splitSentences, summarise } from './n0.js';

// A short internal report, the kind of document someone actually pastes in.
const REPORT = [
  'The support team migrated the ticketing system to a new platform in March.',
  'The migration moved every open ticket to the new platform without losing a single attachment.',
  'Every agent was trained on the new platform during the two weeks before the switch.',
  'The old platform stayed available in read-only mode for a month afterwards.',
  'Agents report that search on the new platform is faster than it was before.',
  'One customer complained about the new ticket numbering, so the team kept the old numbers visible.',
  'The migration is finished and the old platform has been shut down.',
].join(' ');

// A document whose conclusion is spread across its two ends. The first
// sentence and the last one are each true and each incomplete; put together
// they say the Lyon assembly line stops at the end of March. No sentence says
// that.
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

test('returns the asked number of sentences', () => {
  assert.equal(splitSentences(summarise(REPORT, 3)).length, 3);
  assert.equal(splitSentences(summarise(REPORT, 5)).length, 5);
});

test('every sentence of the summary comes from the document', () => {
  // Extractive means quoted. Nothing here is written, only chosen.
  for (const sentence of splitSentences(summarise(REPORT, 3))) {
    assert.ok(REPORT.includes(sentence), sentence);
  }
});

test('keeps document order rather than score order', () => {
  const all = splitSentences(REPORT);
  const positions = splitSentences(summarise(REPORT, 4)).map((s) => all.indexOf(s));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});

test('picks the opening and the dense sentences', () => {
  const summary = summarise(REPORT, 3);
  assert.ok(summary.startsWith('The support team migrated the ticketing system'));
  assert.ok(summary.includes('trained on the new platform'));
});

test('a single-sentence document is its own summary', () => {
  const text = 'The plant will close at the end of March.';
  assert.equal(summarise(text, 3), text);
});

test('an empty document gives an empty summary', () => {
  assert.equal(summarise('', 3), '');
  assert.equal(summarise('   \n  ', 3), '');
});

test('asking for more sentences than exist returns the document', () => {
  const text = 'First point. Second point. Third point.';
  assert.equal(summarise(text, 10), text);
});

test('a long sentence does not win by length alone', () => {
  // Density, not volume. A rambling sentence made of connectives scores near
  // zero however long it is, which is the whole reason for dividing by length.
  const padding =
    'It is, as it has been said, in the way that they were and that there was, ' +
    'of the sort that this is and that it has been.';
  assert.ok(!summarise(`${REPORT} ${padding}`, 3).includes(padding));
});

test('breaking point: two ideas ten pages apart are never joined', () => {
  // The breaking point claimed on the entry: an extractive summary does not
  // relate two ideas separated by ten pages, and it never rewrites.
  //
  // Both halves of the argument are in this document. The closing sentence is
  // short, late, and uses vocabulary the rest of the document never repeats,
  // so it scores lowest of all eleven sentences and is dropped first. The
  // reader of the summary learns that Rouen supplies Lyon, and never learns
  // that Rouen is closing.
  const sentences = splitSentences(FACTORY);
  const scores = scoreSentences(sentences);
  assert.equal(scores.indexOf(Math.min(...scores)), sentences.indexOf(CLOSURE));

  const summary = summarise(FACTORY, 3);
  assert.ok(summary.includes(SUPPLY));
  assert.ok(!summary.includes(CLOSURE));

  // Even at eight sentences out of eleven, the second premise is still out.
  assert.ok(!summarise(FACTORY, 8).includes(CLOSURE));

  // And no sentence of the document states the conclusion, so no extractive
  // summary of any width could ever return it. Only a method that writes new
  // text can state it, which is what the rungs above do.
  assert.ok(!sentences.some((s) => s.includes('assembly') && s.includes('March')));
});
