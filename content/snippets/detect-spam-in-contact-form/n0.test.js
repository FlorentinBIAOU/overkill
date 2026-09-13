import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fold, isSpam, reasons } from './n0.js';

const GENUINE = {
  name: 'Claire Dubois',
  email: 'claire@example.com',
  message: 'Hello, I ordered a lamp last week and it arrived damaged. What should I do?',
  website: '',
};

test('accepts a genuine enquiry', () => {
  assert.deepEqual(reasons(GENUINE, 42), []);
  assert.ok(!isSpam(GENUINE, 42));
});

test('catches a filled honeypot', () => {
  assert.deepEqual(reasons({ ...GENUINE, website: 'http://example.com' }, 42), ['honeypot filled']);
});

test('catches a submission faster than a human can type', () => {
  assert.ok(reasons(GENUINE, 0.4).includes('submitted too fast'));
});

test('catches a wall of links', () => {
  const message = 'visit http://a.com and www.b.net and http://c.org and d.xyz';
  assert.ok(reasons({ ...GENUINE, message }, 42).includes('too many links'));
});

test('tolerates the one link a customer actually sends', () => {
  const message = 'the page http://example.com/order-4512 shows an error';
  assert.deepEqual(reasons({ ...GENUINE, message }, 42), []);
});

test('counts a link once, not once per part of it', () => {
  // A customer who points at two pages is under the cap, and stays under it.
  const message = 'see http://example.com/a and http://example.com/b for the two photos';
  assert.deepEqual(reasons({ ...GENUINE, message }, 42), []);
});

test('names the banned phrase it found', () => {
  const message = 'We sell cheap backlink packages for your site.';
  assert.deepEqual(reasons({ ...GENUINE, message }, 42), ['banned phrase: backlink']);
});

test('folding survives case and accents', () => {
  assert.equal(fold('BÁCKLÎNK'), 'backlink');
  const message = 'Cheap BÁCKLÎNKS, best prices.';
  assert.ok(reasons({ ...GENUINE, message }, 42).includes('banned phrase: backlink'));
});

test('handles an empty form and a very long message', () => {
  assert.deepEqual(reasons({}, 42), []);
  const message = 'I have a question about my order. '.repeat(500);
  assert.deepEqual(reasons({ ...GENUINE, message }, 42), []);
});

test('breaking point: a patient bot that avoids links', () => {
  // None of the four checks looks at intent. A script that waits before
  // posting, leaves the hidden field alone, sends no link and avoids the
  // vocabulary of the list walks straight through. Writing the failure down
  // here is what keeps the entry honest: this rung stops the cheap flood, not
  // the patient sender.
  const patientBot = {
    name: 'Growth Team',
    email: 'outreach@example.com',
    message:
      'Good morning, I came across your company and I would like to discuss ' +
      'a partnership to increase your visibility. When would suit you?',
    website: '',
  };
  assert.deepEqual(reasons(patientBot, 30), []);
  assert.ok(!isSpam(patientBot, 30));
});
