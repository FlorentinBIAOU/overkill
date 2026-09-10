import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateRows } from './n0.js';

// The schema lives in the test, never in the snippet: the snippet shows a
// generator, not one company's order table.
//
// Every value below is invented. The addresses are built on example.test, a
// domain reserved for exactly this, so no message can ever leave for a real
// mailbox.
const ORDERS = {
  order_id: { type: 'sequence', prefix: 'ORD-', width: 5 },
  email: { type: 'sequence', prefix: 'user-', width: 4, suffix: '@example.test' },
  city: { type: 'choice', values: ['Paris', 'Lyon', 'Nantes', 'Lille'] },
  quantity: { type: 'int', min: 1, max: 9 },
  signed_up_on: { type: 'date', start: '2024-01-01', days: 365 },
  newsletter: { type: 'bool', true_percent: 30 },
};

// The exact rows expected for one seed. The same literal appears in
// n0.test.py: that is what pins the two implementations to each other, and it
// would break the moment either language drew a different number for the same
// cell.
const GOLDEN = [
  {
    order_id: 'ORD-00001',
    email: 'user-0001@example.test',
    city: 'Paris',
    quantity: 6,
    signed_up_on: '2024-01-27',
    newsletter: true,
  },
  {
    order_id: 'ORD-00002',
    email: 'user-0002@example.test',
    city: 'Lille',
    quantity: 5,
    signed_up_on: '2024-12-28',
    newsletter: false,
  },
  {
    order_id: 'ORD-00003',
    email: 'user-0003@example.test',
    city: 'Nantes',
    quantity: 8,
    signed_up_on: '2024-03-25',
    newsletter: false,
  },
];

test('produces the expected rows', () => {
  assert.deepEqual(generateRows(ORDERS, 3, 'orders-2024'), GOLDEN);
});

test('every row satisfies the schema', () => {
  const rows = generateRows(ORDERS, 300, 'orders-2024');
  assert.equal(rows.length, 300);
  for (const row of rows) {
    assert.deepEqual(Object.keys(row).sort(), Object.keys(ORDERS).sort());
    assert.ok(row.quantity >= 1 && row.quantity <= 9);
    assert.ok(ORDERS.city.values.includes(row.city));
    assert.ok(row.signed_up_on >= '2024-01-01' && row.signed_up_on <= '2024-12-30');
    assert.equal(typeof row.newsletter, 'boolean');
  }
  // A sequence field is unique by construction, which is what makes it usable
  // as a primary key in a fixture.
  assert.equal(new Set(rows.map((row) => row.order_id)).size, 300);
});

test('the same seed gives the same data, another seed does not', () => {
  // The property the whole rung rests on: a seed printed next to a failure is
  // enough to rebuild the data that caused it.
  assert.deepEqual(generateRows(ORDERS, 50, 'orders-2024'), generateRows(ORDERS, 50, 'orders-2024'));
  assert.notDeepEqual(generateRows(ORDERS, 50, 'orders-2024'), generateRows(ORDERS, 50, 'orders-2025'));
});

test('growing the set extends it instead of redrawing it', () => {
  // Asking for more rows keeps the ones already there, so a fixture can grow
  // without invalidating the expectations written against it.
  assert.deepEqual(generateRows(ORDERS, 20, 'orders-2024').slice(0, 5), generateRows(ORDERS, 5, 'orders-2024'));
});

test('adding a field leaves the other columns untouched', () => {
  // Each cell is drawn from its own key rather than from a running stream, so
  // a new column does not shift the values of the existing ones.
  const wider = { ...ORDERS, discount: { type: 'bool', true_percent: 10 } };
  const after = generateRows(wider, 10, 'orders-2024').map(({ discount, ...rest }) => rest);
  assert.deepEqual(after, generateRows(ORDERS, 10, 'orders-2024'));
});

test('an empty schema, and a single row', () => {
  assert.deepEqual(generateRows({}, 3, 'seed'), [{}, {}, {}]);
  assert.deepEqual(generateRows(ORDERS, 0, 'seed'), []);
  assert.equal(generateRows(ORDERS, 1, 'seed').length, 1);
});

test('an impossible constraint is refused rather than worked around', () => {
  assert.throws(() => generateRows({ age: { type: 'int', min: 80, max: 18 } }, 1, 'seed'), RangeError);
  assert.throws(() => generateRows({ city: { type: 'choice', values: [] } }, 1, 'seed'), RangeError);
  assert.throws(() => generateRows({ city: { type: 'postcode' } }, 1, 'seed'), RangeError);
});

/**
 * Stands in for the production code under test: the mailbox an address belongs
 * to, used as the key of an account.
 *
 * It has a bug, and the point of the test below is that generated data can
 * never show it.
 */
function accountKey(email) {
  return email.split('@')[0].toLowerCase();
}

test('breaking point: the data is visibly synthetic and hides a real bug', () => {
  // The breaking point claimed on the entry: the rows stay visibly synthetic,
  // and they do not reveal the bugs real data provokes.
  //
  // The demonstration is concrete. `accountKey` forgets that an address may
  // carry a plus tag, so two spellings of the same mailbox become two
  // accounts. The generator only ever emits one shape of address, and that
  // shape has no plus tag, no capital letter and no apostrophe. A suite built
  // on this data is green whatever the seed and whatever the row count.
  const addresses = generateRows(ORDERS, 500, 'orders-2024').map((row) => row.email);

  // The shapes real addresses take, and this generator never does.
  assert.ok(!addresses.some((address) => address.includes('+')));
  assert.ok(!addresses.some((address) => address !== address.toLowerCase()));
  assert.ok(!addresses.some((address) => address.includes("'")));

  // The suite passes: every generated address yields its own account key.
  const keys = addresses.map(accountKey);
  assert.equal(new Set(keys).size, keys.length);

  // In production, these two spellings reach one mailbox and must share one
  // account. They do not, and no seed will ever produce the pair that would
  // have caught it.
  assert.notEqual(accountKey('i.fontaine@example.test'), accountKey('i.fontaine+billing@example.test'));
});
