/**
 * Quatre documents dont quelqu'un a coché les phrases de résumé. Les poids
 * comparés ici sont ceux que scikit-learn trouve dans n1.test.py.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { summarise as summariseN0 } from './n0.js';
import { sentenceFeatures, splitSentences, summarise, train } from './n1.js';

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
    'The committee met on Thursday in the small room.',
    'The budget for the next year was presented to the committee.',
    'Three members asked about the training line.',
    'The training line was raised by 12 in the budget.',
    'The coffee machine will be replaced.',
    'Finally the committee approved the budget.',
  ],
];

const LABELS = [[1, 1, 0, 0, 0, 1], [1, 1, 0, 0, 0, 1], [1, 1, 0, 0, 0, 1], [0, 1, 0, 1, 0, 1]];

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

const DECOY = 'Overall the warehouse audit ordered 6 new clipboards for counting stock.';
const FINDING = 'The spare parts aisle has been miscounted every month since the spring.';
const DRESSED_UP = [
  'The warehouse audit looked at how stock is counted.',
  DECOY,
  FINDING,
  'Nobody has reconciled the spare parts aisle against the supplier notes.',
  'The counting staff work on the last Friday of each month.',
  'The clipboards will be delivered next week.',
];

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : la phrase leurre a les quatre signes et est retenue', () => {
  const [position, , figure, cue, echo] = sentenceFeatures(DRESSED_UP, 1);
  assert.deepEqual([position, figure, cue, echo], [0.5, 1, 1, 0.375]);
  assert.ok(summarise(model, DRESSED_UP.join(' '), 2).includes(DECOY));
});

test('point de rupture : la vraie trouvaille n’a aucun de ces signes et reste dehors', () => {
  const [position, , figure, cue, echo] = sentenceFeatures(DRESSED_UP, 2);
  assert.deepEqual([Math.round(position * 1e4) / 1e4, figure, cue, echo], [0.3333, 0, 0, 0]);
  assert.ok(!summarise(model, DRESSED_UP.join(' '), 2).includes(FINDING));
});

test('point de rupture : étiqueter davantage n’y change rien', () => {
  const relabelled = train([...DOCUMENTS, ...Array(5).fill(DRESSED_UP)], [...LABELS, ...Array(5).fill([1, 0, 1, 1, 0, 0])]);
  const summary = summarise(relabelled, DRESSED_UP.join(' '), 2);
  assert.ok(summary.includes(DECOY) && !summary.includes(FINDING));
});

test('point de rupture : il retrouve les deux prémisses et n’énonce pas la conclusion', () => {
  const both = summarise(model, FACTORY, 2);
  assert.ok(both.includes(SUPPLY) && both.includes(CLOSURE));
  assert.ok(!splitSentences(both).some((s) => s.includes('assembly') && s.includes('March')));
  assert.ok(!summariseN0(FACTORY, 2).includes(CLOSURE));
});

// ---------------------------------------------------------------------------
// Autres affirmations du niveau
// ---------------------------------------------------------------------------

test('cinq traits : position, longueur, chiffre, mot-signal et reprise', () => {
  const sentences = DOCUMENTS[0];
  const [lead, length, figure, cue, echo] = sentenceFeatures(sentences, 0);
  assert.deepEqual([lead, figure, cue, echo], [1, 0, 0, 1]);
  assert.ok(length > 0 && length < 1);
  assert.equal(sentenceFeatures(sentences, 1)[2], 1);
  assert.equal(sentenceFeatures(sentences, 5)[3], 1);
  assert.equal(sentenceFeatures(sentences, 3).length, 5);
});

test('le trait de longueur sature sur une phrase très longue', () => {
  assert.equal(sentenceFeatures(['Short one.', `${new Array(200).fill('word').join(' ')}.`], 1)[1], 1);
  assert.equal(sentenceFeatures(['Short one.', `${new Array(24).fill('word').join(' ')}.`], 1)[1], 0.96);
});

test('la descente de gradient atterrit sur l’optimum de scikit-learn', () => {
  // docstring : « the objective minimised below is the same one » ; « enough
  // steps land on the one optimum whichever language walks towards it ».
  const sklearn = [0.496, 0.134, 1.281, 1.246, 1.061];
  model.weights.forEach((w, j) => assert.ok(Math.abs(w - sklearn[j]) < 2e-3, `${j}: ${w}`));
  assert.ok(Math.abs(model.bias - -0.944) < 2e-3);
  const longer = train(DOCUMENTS, LABELS, { epochs: 20000 });
  longer.weights.forEach((w, j) => assert.ok(Math.abs(w - model.weights[j]) < 1e-9));
});

test('garde l’ouverture, le chiffre et la conclusion de l’audit', () => {
  const summary = summarise(model, AUDIT, 3);
  assert.ok(summary.includes(AUDIT_LEAD) && summary.includes(AUDIT_FIGURE) && summary.includes(AUDIT_WRAP_UP));
  assert.equal(summarise(model, AUDIT, 2), `${AUDIT_LEAD} ${AUDIT_WRAP_UP}`);
});

test('une conclusion ne gagne que par ce qu’elle porte, jamais par sa place', () => {
  // « Position is coded as 1 / (rank + 1): the model can learn that early
  // sentences count for more or for less, never that the last one counts. A
  // closing sentence gains only through what it carries, a figure or a cue word
  // such as `overall`. »
  const plain = 'The audit recommends counting the spare parts aisle weekly.';
  const withoutCue = AUDIT.replace(AUDIT_WRAP_UP, plain);
  assert.ok(summarise(model, AUDIT, 3).includes(AUDIT_WRAP_UP));
  assert.ok(!summarise(model, withoutCue, 3).includes(plain));
  // Le trait de position ne sait pas dire « la dernière » : 1/(rang+1) décroît.
  const sentences = splitSentences(AUDIT);
  assert.equal(sentenceFeatures(sentences, sentences.length - 1)[0], 1 / sentences.length);
  assert.equal(sentenceFeatures(sentences, 0)[0], 1);
  // Témoin : N0 garde cette conclusion dans les deux cas.
  assert.ok(summariseN0(AUDIT, 3).includes(AUDIT_WRAP_UP));
  assert.ok(summariseN0(withoutCue, 3).includes(plain));
});

test('le résumé est toujours fait des phrases du document', () => {
  for (let width = 1; width < 7; width += 1) {
    assert.ok(splitSentences(summarise(model, AUDIT, width)).every((s) => AUDIT.includes(s)));
  }
});

test('garde l’ordre du document', () => {
  const all = splitSentences(AUDIT);
  const positions = splitSentences(summarise(model, AUDIT, 4)).map((s) => all.indexOf(s));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});

test('l’extrait n’importe rien', () => {
  assert.doesNotMatch(readFileSync(new URL('./n1.js', import.meta.url), 'utf8'), /^\s*import\s/m);
});

test('deux entraînements rendent les mêmes poids', () => {
  assert.deepEqual(train(DOCUMENTS, LABELS), model);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : document vide et d’une phrase', () => {
  assert.equal(summarise(model, '', 3), '');
  assert.equal(summarise(model, '   \n ', 3), '');
  assert.equal(summarise(model, 'The plant will close at the end of March.', 3), 'The plant will close at the end of March.');
  assert.equal(summarise(model, AUDIT, 0), '');
});

test('production : cinq mille phrases', () => {
  const big = Array.from({ length: 5000 }, (_, i) => `Sentence ${i} is about the warehouse stock.`).join(' ');
  const started = Date.now();
  assert.equal(splitSentences(summarise(model, big, 3)).length, 3);
  assert.ok(Date.now() - started < 10_000);
});

test('une transcription sans ponctuation finale est découpée par lignes', async () => {
  const transcript = 'the meeting started late\nwe discussed the budget\n'.repeat(500);
  assert.ok(summarise(model, transcript, 3).length < transcript.length / 2);
});

test('un nombre de phrases négatif est refusé, et zéro rend le vide', async () => {
  assert.throws(() => summarise(model, AUDIT, -1), RangeError);
  assert.equal(summarise(model, AUDIT, 0), '');
});
