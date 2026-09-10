import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from './n0.js';

// The schema lives in the test, not in the snippet: it is example data, and the
// Python test declares exactly the same one, field for field.
const SCHEMA = {
  email: {
    required: true,
    pattern: '[^@\\s]+@[^@\\s]+\\.[a-z]{2,}',
    message: 'is not a valid email address',
  },
  display_name: { required: true, min: 2, max: 30 },
  age: { required: true, type: 'integer', min: 18, max: 130 },
  website: { pattern: 'https?://\\S+' },
};

const VALID = {
  email: 'ada@example.com',
  display_name: 'Ada',
  age: 36,
  website: 'https://example.com',
};

test('a valid submission passes', () => {
  assert.deepEqual(validate(VALID, SCHEMA), {});
});

test('an optional field may be absent', () => {
  const { website, ...rest } = VALID;
  assert.deepEqual(validate(rest, SCHEMA), {});
});

test('one error per faulty field, naming the field', () => {
  const errors = validate(
    { email: 'ada.example.com', display_name: 'A', age: 12, website: 'nope' },
    SCHEMA,
  );
  assert.deepEqual(errors, {
    email: 'is not a valid email address',
    display_name: 'must be at least 2 characters',
    age: 'must be at least 18',
    website: 'is not in the expected format',
  });
});

test('a missing required field is reported by name', () => {
  assert.deepEqual(validate({}, SCHEMA), {
    email: 'is required',
    display_name: 'is required',
    age: 'is required',
  });
});

test('an empty string counts as missing', () => {
  // This is what a browser posts for a field the user left alone.
  assert.equal(validate({ ...VALID, email: '' }, SCHEMA).email, 'is required');
});

test('a wrong type is reported before the bounds', () => {
  // "12" breaks two rules at once; only the first one is reported, so the user
  // fixes one thing at a time.
  assert.deepEqual(validate({ ...VALID, age: '12' }, SCHEMA), { age: 'must be of type integer' });
});

test('a value out of bounds', () => {
  assert.deepEqual(validate({ ...VALID, age: 150 }, SCHEMA), { age: 'must be at most 130' });
  assert.deepEqual(validate({ ...VALID, display_name: 'A'.repeat(31) }, SCHEMA), {
    display_name: 'must be at most 30 characters',
  });
});

test('a decimal is not an integer', () => {
  assert.deepEqual(validate({ ...VALID, age: 36.5 }, SCHEMA), { age: 'must be of type integer' });
});

test('breaking point: a well formed address that does not exist', () => {
  // The breaking point claimed on the entry: no rule can say whether an address
  // exists. This one is well formed, nobody reads mail there, and the validator
  // accepts it — deciding otherwise takes an external check, which is a
  // different need.
  assert.deepEqual(validate({ ...VALID, email: 'ada@no-such-mailbox.example' }, SCHEMA), {});
});
