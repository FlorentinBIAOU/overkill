/**
 * These tests inject a local double instead of loading a translation model.
 *
 * What they prove: the variables are hidden before the model sees the string,
 * the markers are put back afterwards, a moved variable is accepted, a lost
 * or rewritten one is reported rather than shipped, a failed call is retried,
 * and an empty answer throws instead of returning a blank interface string.
 *
 * What they do not prove: that the model translates well. That is why this
 * snippet is declared `verification: stubbed` on the entry, and why the page
 * says so next to the code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeSeq2Seq } from '../_harness/fake-model.mjs';
import { TranslationUnavailable, translate } from './n2.js';

/** A model that dies on its first calls, the way a real worker does. */
class FlakySeq2Seq extends FakeSeq2Seq {
  constructor(outputs, failTimes = 1) {
    super(outputs);
    this.failTimes = failTimes;
  }

  async generate(text) {
    if (this.failTimes > 0) {
      this.failTimes -= 1;
      this.calls.push(text);
      throw new Error('the model worker died');
    }
    return super.generate(text);
  }
}

test('translates a plain string', async () => {
  const model = new FakeSeq2Seq({ 'Save changes': 'Enregistrer les modifications' });
  const result = await translate('Save changes', { model });
  assert.equal(result.target, 'Enregistrer les modifications');
  assert.equal(result.review, false);
  assert.deepEqual(result.warnings, []);
});

test('the model never sees the variable', async () => {
  // Request building: a variable is hidden behind a marker, then restored.
  const model = new FakeSeq2Seq({ '⟦0⟧ items selected': '⟦0⟧ éléments sélectionnés' });
  const result = await translate('{count} items selected', { model });
  assert.deepEqual(model.calls, ['⟦0⟧ items selected']);
  assert.ok(!model.calls[0].includes('{count}'));
  assert.equal(result.target, '{count} éléments sélectionnés');
  assert.equal(result.review, false);
});

test('a moved variable is the model’s job, not a fault', async () => {
  const model = new FakeSeq2Seq({ 'Delete ⟦0⟧ of ⟦1⟧': 'Sur ⟦1⟧, supprimer ⟦0⟧' });
  const result = await translate('Delete {count} of {total}', { model });
  assert.equal(result.target, 'Sur {total}, supprimer {count}');
  assert.equal(result.review, false);
});

test('retries a model that failed', async () => {
  const model = new FlakySeq2Seq({ Save: 'Enregistrer' }, 1);
  const result = await translate('Save', { model, attempts: 2 });
  assert.equal(result.target, 'Enregistrer');
  assert.equal(model.calls.length, 2);
});

test('an empty answer throws rather than blanking the interface', async () => {
  const model = new FakeSeq2Seq({}, '   ');
  await assert.rejects(() => translate('Save', { model, attempts: 2 }), TranslationUnavailable);
  assert.equal(model.calls.length, 2);
});

test('an empty source is not worth a call', async () => {
  const model = new FakeSeq2Seq({});
  assert.equal((await translate('', { model })).target, '');
  assert.deepEqual(model.calls, []);
});

test('breaking point: a lost variable is caught, not shipped', async () => {
  // The breaking point of a model that reads a variable as text: it can drop
  // the marker entirely. The result would be a French sentence with no number
  // in it, and nobody reading English would ever notice.
  //
  // The snippet cannot stop the model from doing it. It can refuse to call
  // the result finished, which is what is asserted here.
  const model = new FakeSeq2Seq({ '⟦0⟧ items selected': 'Des éléments sélectionnés' });
  const result = await translate('{count} items selected', { model });
  assert.equal(result.review, true);
  assert.deepEqual(result.warnings, [
    'variables differ from the source: expected {count}, got none',
  ]);
});

test('breaking point: an invented variable is caught too', async () => {
  // The other way it breaks: the answer carries a brace the source never had.
  // The model is shown ⟦0⟧, never {count}, so it cannot translate the variable
  // name; it can still produce something brace-shaped, and the interface would
  // print that brace. The same check catches it.
  const model = new FakeSeq2Seq({ '⟦0⟧ items selected': '{compte} éléments sélectionnés' });
  const result = await translate('{count} items selected', { model });
  assert.equal(result.review, true);
  assert.ok(result.warnings[0].includes('expected {count}, got {compte}'));
});
