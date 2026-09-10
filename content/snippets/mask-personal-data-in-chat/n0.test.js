import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mask, normalise } from './n0.js';

test('masks an email', () => {
  assert.equal(mask('write to me at jean.dupont@example.com'), 'write to me at [email]');
});

test('masks a phone number however it is spaced', () => {
  for (const written of ['0612345678', '06 12 34 56 78', '06.12.34.56.78', '+33 6 12 34 56 78']) {
    assert.ok(mask(`call me on ${written}`).includes('[phone]'), written);
  }
});

test('masks an IBAN spaced or not', () => {
  for (const written of ['FR7630006000011234567890189', 'FR76 3000 6000 0112 3456 7890 189']) {
    assert.ok(mask(`account ${written} please`).includes('[iban]'), written);
  }
});

test('leaves ordinary text alone', () => {
  const text = 'The meeting is at 10, room 4, bring the 2024 report.';
  assert.equal(mask(text), text);
});

test('handles an empty string', () => {
  assert.equal(mask(''), '');
});

test('normalisation collapses typographic spaces', () => {
  assert.equal(normalise('06 12'), '06 12');
  assert.equal(normalise('06 12'), '06 12');
});

test('breaking point: deliberate obfuscation', () => {
  // The breaking point claimed on the entry: spelled-out digits and lookalike
  // characters walk straight past the pattern. Asserting the failure here
  // keeps the claim on the page honest.
  const spelled = 'call me on zero six twelve thirty-four';
  assert.equal(mask(spelled), normalise(spelled));
  assert.ok(!mask('O6 I2 34 56 78').includes('[phone]'));
});
