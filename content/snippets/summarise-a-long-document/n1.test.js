import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sentenceFeatures, splitSentences, summarise, train } from './n1.js';

// Four documents whose summary sentences someone has ticked off. A real corpus
// is a few dozen of these; four is enough to show what the model learns, which
// here is that the opening, the sentence carrying a figure, and the wrap-up are
// what a reader keeps.
const DOCUMENTS = [
  [
    'The payment service was unavailable for most of Tuesday morning.',
    'A configuration change was deployed at 8 in the morning and rolled back at 11.',
    'The on-call engineer was paged twice before the cause was found.',
    'Support answered the calls that came in during the outage.',
    'The queue drained on its own once the change was reverted.',
    'Overall the payment service lost a morning of availability.',
  ],
  [
    'The regional sales review covers the shops in the north.',
    '2 shops opened during the period and one closed.',
    'The staff in Lille asked for a second till.',
    'Deliveries arrive on Tuesday and on Friday.',
    'The window display was changed for the season.',
    'Therefore the north region grew despite the closure.',
  ],
  [
    'The migration project moved the archive to the new storage.',
    '40 nights of copying were needed to move the archive.',
    'The old drives were kept in the basement for now.',
    'Nobody reported a missing file during the check.',
    'The copy tool was written by the infrastructure team.',
    'In conclusion the archive migration is complete.',
  ],
  [
    // This one opens on a formality, so the model cannot simply learn
    // "the first sentence is always in".
    'The committee met on Thursday in the small room.',
    'The budget for the next year was presented to the committee.',
    'Three members asked about the training line.',
    'The training line was raised by 12 in the budget.',
    'The coffee machine will be replaced.',
    'Finally the committee approved the budget.',
  ],
];

const LABELS = [
  [1, 1, 0, 0, 0, 1],
  [1, 1, 0, 0, 0, 1],
  [1, 1, 0, 0, 0, 1],
  [0, 1, 0, 1, 0, 1],
];

const model = train(DOCUMENTS, LABELS);

const AUDIT_LEAD = 'The warehouse audit looked at how stock is counted.';
const AUDIT_FIGURE = 'The count needs 2 people and takes a full day.';
const AUDIT_WRAP_UP = 'Overall the audit recommends counting the spare parts aisle weekly.';
const AUDIT = [
  AUDIT_LEAD,
  'The count is done by hand on the last Friday of the month.',
  AUDIT_FIGURE,
  'The audit found that the count matches the system in most aisles.',
  'The aisle holding spare parts was the only one out of line.',
  AUDIT_WRAP_UP,
].join(' ');

// The same two-ended document the N0 test uses.
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

test('features read position, length, figures, cues and echo', () => {
  const sentences = DOCUMENTS[0];
  const [lead, length, figure, cue, echo] = sentenceFeatures(sentences, 0);
  assert.equal(lead, 1);
  assert.equal(figure, 0);
  assert.equal(cue, 0);
  assert.ok(length > 0 && length < 1);
  assert.equal(echo, 1); // the opening echoes itself entirely

  assert.equal(sentenceFeatures(sentences, 1)[2], 1); // "8" and "11" are figures
  assert.equal(sentenceFeatures(sentences, 5)[3], 1); // "Overall"
});

test('the length feature saturates on a very long sentence', () => {
  // A single rambling sentence must not stretch the scale for the rest.
  const longOne = ['Short one.', `${new Array(200).fill('word').join(' ')}.`];
  assert.equal(sentenceFeatures(longOne, 1)[1], 1);
});

test('keeps the wrap-up a fixed lead bonus would drop', () => {
  const summary = summarise(model, AUDIT, 3);
  assert.ok(summary.includes(AUDIT_LEAD));
  assert.ok(summary.includes(AUDIT_FIGURE));
  // The last sentence of the document, and the one a reader would keep.
  assert.ok(summary.includes(AUDIT_WRAP_UP));
});

test('the two best sentences are the opening and the wrap-up', () => {
  assert.equal(summarise(model, AUDIT, 2), `${AUDIT_LEAD} ${AUDIT_WRAP_UP}`);
});

test('the summary is still made of the document own sentences', () => {
  for (const sentence of splitSentences(summarise(model, AUDIT, 3))) {
    assert.ok(AUDIT.includes(sentence), sentence);
  }
});

test('keeps document order', () => {
  const all = splitSentences(AUDIT);
  const positions = splitSentences(summarise(model, AUDIT, 4)).map((s) => all.indexOf(s));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});

test('a single-sentence document is its own summary', () => {
  const text = 'The plant will close at the end of March.';
  assert.equal(summarise(model, text, 3), text);
});

test('an empty document gives an empty summary', () => {
  assert.equal(summarise(model, '', 3), '');
  assert.equal(summarise(model, '   \n ', 3), '');
});

test('breaking point: surface features score the look, not the content', () => {
  // The ceiling of this rung, in two parts.
  //
  // First, the features describe a sentence from the outside. A sentence that
  // is early, carries a figure, opens with a cue word and repeats the words of
  // the title looks exactly like a summary sentence, and is picked, even when
  // what it says is that somebody ordered clipboards. The real finding of the
  // audit — an aisle miscounted for months — has none of those markers and is
  // left out. No amount of extra labelling fixes this: the model is not being
  // shown the meaning of the sentence, so it cannot weigh it.
  const decoy = 'Overall the warehouse audit ordered 6 new clipboards for counting stock.';
  const finding = 'The spare parts aisle has been miscounted every month since the spring.';
  const dressedUp = [
    'The warehouse audit looked at how stock is counted.',
    decoy,
    finding,
    'Nobody has reconciled the spare parts aisle against the supplier notes.',
    'The counting staff work on the last Friday of each month.',
    'The clipboards will be delivered next week.',
  ].join(' ');
  const summary = summarise(model, dressedUp, 2);
  assert.ok(summary.includes(decoy));
  assert.ok(!summary.includes(finding));

  // Second, this rung is still extractive. On the two-ended document it does
  // better than N0, retrieving both premises. It still does not state the
  // conclusion they imply, because stating it would mean writing a sentence
  // nobody wrote, and nothing in this file writes anything.
  const bothPremises = summarise(model, FACTORY, 2);
  assert.ok(bothPremises.includes(SUPPLY));
  assert.ok(bothPremises.includes(CLOSURE));
  assert.ok(
    !splitSentences(bothPremises).some((s) => s.includes('assembly') && s.includes('March')),
  );
});
