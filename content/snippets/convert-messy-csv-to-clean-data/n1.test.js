/**
 * The labelled columns live here, never in the snippet.
 *
 * Twenty-one columns, the kind an afternoon of tagging produces. That is the
 * real size of the training set this rung needs, and showing it is part of the
 * argument: a classifier is only cheap if its labelling is.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanCsv } from './n0.js';
import { classify, columnFeatures, inferSchema, train } from './n1.js';

const LABELLED = {
  integer: [
    ['1', '2', '3', '4', '5', '6'],
    ['1024', '2048', '4096', '8192'],
    ['12', '7', '103', '5', '88', '41'],
    ['-3', '14', '0', '27', '5'],
  ],
  number: [
    ['1.5', '2.75', '3.0', '4.25'],
    ['12,50', '0,99', '1234,56', '7,10'],
    ['-0.5', '10.25', '3.75', '0.1'],
    ['100.0', '250.5', '99.99', '12.30'],
  ],
  date: [
    ['2023-04-12', '2023-05-01', '2024-01-09'],
    ['01/05/2023', '12/11/2022', '30/06/2021'],
    ['09.01.2024', '28.02.2023', '15.07.2022'],
    ['2020-12-31', '2021-01-01', '2022-06-15', '2023-03-03'],
  ],
  boolean: [
    ['yes', 'no', 'yes', 'no', 'yes'],
    ['true', 'false', 'true', 'true', 'false'],
    ['0', '1', '1', '0', '1', '0'],
    ['oui', 'non', 'oui', 'non'],
  ],
  text: [
    ['Alice', 'Bob', 'Carol', 'Dan'],
    ['Paris', 'Lyon', 'Marseille', 'Lille'],
    ['a short note', 'another note here', 'something else entirely'],
    ['AB1', 'CD2', 'EF3', 'GH4'],
    ['thé vert', 'café au lait', "jus d'orange"],
  ],
};

const COLUMNS = Object.values(LABELLED).flat();
const LABELS = Object.entries(LABELLED).flatMap(([kind, columns]) => columns.map(() => kind));

const HEADER = ['id', 'name', 'joined', 'amount', 'active'];
const ROWS = [
  ['1', 'Alice', '2023-04-12', '12.50', 'yes'],
  ['2', 'Bob', '2023-05-01', '3.99', 'no'],
  ['3', 'Carol', '2023-06-30', '120.00', 'yes'],
  ['4', 'Dan', '2023-07-14', '7.25', 'no'],
  ['5', 'Eve', '2023-08-02', '45.10', 'yes'],
];

const model = train(COLUMNS, LABELS);

test('features are proportions between zero and one', () => {
  const features = columnFeatures(['12', '7', '103']);
  assert.ok(features.every((value) => value >= 0 && value <= 1));
  assert.equal(features[0], 1); // all digits
  assert.equal(features[3], 0); // none contains a letter
  // Twice as many values of the same shape give the same shape traits: they
  // are proportions, not counts. Only the traits that describe the sample
  // itself, such as how many values are distinct, move.
  const deeper = columnFeatures(['12', '7', '103', '44', '9', '271']);
  assert.deepEqual(deeper.slice(0, 5), features.slice(0, 5));
});

test('infers the schema of a file nobody documented', () => {
  assert.deepEqual(inferSchema(model, HEADER, ROWS), {
    id: 'integer',
    name: 'text',
    joined: 'date',
    amount: 'number',
    active: 'boolean',
  });
});

test('the inferred schema is what rung N0 takes', () => {
  const data = Buffer.from(
    'id,name,joined,amount,active\n' +
      '1,Alice,2023-04-12,12.50,yes\n' +
      '2,Bob,2023-05-01,3.99,no\n' +
      '3,Carol,2023-06-30,120.00,yes\n' +
      '4,Dan,2023-07-14,7.25,no\n' +
      '5,Eve,2023-08-02,45.10,yes\n',
    'utf8',
  );
  const result = cleanCsv(data, inferSchema(model, HEADER, ROWS));
  assert.deepEqual(result.rejects, []);
  assert.deepEqual(result.rows[0], {
    id: 1,
    name: 'Alice',
    joined: '2023-04-12',
    amount: 12.5,
    active: true,
  });
});

test('columns with little or nothing in them', () => {
  // No evidence at all: text, and the model is not consulted.
  assert.equal(classify(model, ['', '  ', '']), 'text');
  assert.equal(classify(model, []), 'text');
  // A column that is mostly empty is still typed on what it does contain.
  assert.equal(classify(model, ['2023-04-12', '', '', '2024-01-09', '']), 'date');
  // A single value is thin evidence, but it is evidence.
  assert.equal(classify(model, ['2023-04-12']), 'date');
});

test('the limit of this rung: an identifier that looks like a number', () => {
  // A postcode is not a quantity, and neither is a product reference. Both are
  // made of digits, so every trait this rung measures says integer, and the
  // classifier says integer. It is not wrong about the shape; it has no way to
  // be right about the meaning.
  //
  // The cost is silent, which is what makes it worth a test: rung N0 then
  // coerces the value and the leading zero is gone for good. Nothing is
  // rejected, because nothing failed.
  const postcodes = ['01000', '06400', '75014', '02100', '13008'];
  assert.equal(classify(model, postcodes), 'integer');

  const result = cleanCsv(Buffer.from('postcode\n01000\n06400\n75014\n', 'utf8'), {
    postcode: classify(model, postcodes),
  });
  assert.deepEqual(result.rejects, []);
  assert.deepEqual(
    result.rows.map((row) => row.postcode),
    [1000, 6400, 75014],
  );
});
