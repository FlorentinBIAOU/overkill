import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isHidingContactDetails, shape, train } from './n1.js';

// A small labelled set, the kind an afternoon of tagging produces.
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

const model = train(
  [...HIDING, ...ORDINARY],
  [...HIDING.map(() => 1), ...ORDINARY.map(() => 0)],
);

test('shape folds digits and lookalikes', () => {
  assert.equal(shape('O6 I2 34'), 'DD DD DD');
  assert.ok(shape('call me on zero six').includes('D'));
});

test('shape keeps words and drops punctuation', () => {
  assert.equal(shape('hi! my number, ok?'), 'hi my number ok');
});

test('shape does not fold letters that carry no digit', () => {
  // Folding unconditionally would turn "loll" into 1011.
  assert.equal(shape('loll that is funny'), 'loll that is funny');
});

test('catches a spelled-out number that N0 misses', () => {
  assert.ok(isHidingContactDetails(model, 'call me on zero six twelve thirty four'));
});

test('catches lookalike characters', () => {
  assert.ok(isHidingContactDetails(model, 'reach me at O6 I2 34 56 78'));
});

test('leaves ordinary messages alone', () => {
  for (const message of ORDINARY) {
    assert.ok(!isHidingContactDetails(model, message), message);
  }
});

test('the threshold is yours to set', () => {
  // A threshold of zero blocks everything, which is the point of exposing it.
  assert.ok(isHidingContactDetails(model, 'there are six items left in stock', 0));
});

test('breaking point: an evasion absent from the training set', () => {
  // The model only knows the evasions it was shown. Homoglyphs from another
  // script, and Roman numerals, carry no digit and no known digit word, so
  // nothing survives the shaping. Every new trick costs a new round of
  // labelling. That is the real price of this rung.
  assert.ok(!isHidingContactDetails(model, 'reach me at Об Іb ЗЧ'));
  assert.ok(!isHidingContactDetails(model, 'call me on VI XII XXXIV LVI'));
});
