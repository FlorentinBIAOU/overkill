import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jaroWinkler, normalise, similarity } from './n0.js';

const THRESHOLD = 0.85; // the cut a real deduplication run would use

test('the same company under two spellings', () => {
  assert.equal(similarity('Boulangerie Martin SARL', 'BOULANGERIE MARTIN'), 1);
});

test('accents, case and punctuation are ignored', () => {
  assert.equal(similarity('Café de la Gare SAS', 'CAFE DE LA GARE'), 1);
  assert.ok(similarity('Établissements Léon & Fils SA', 'ETABLISSEMENTS LEON ET FILS') > THRESHOLD);
});

test('a plural and a dropped form still match', () => {
  assert.ok(similarity('Menuiserie Dubois', 'Menuiseries Dubois SA') > THRESHOLD);
});

test('two different companies in one trade land above the threshold', () => {
  // Not the headline failure, but the one that bites first in production.
  // « Boulangerie Martin » and « Boulangerie Dupont » share a long opening,
  // which is exactly what Jaro-Winkler is built to reward. The score sails
  // over any threshold that also catches genuine variants, so a pair above
  // the cut is a candidate for review, never a decision.
  assert.ok(similarity('Boulangerie Martin SARL', 'Boulangerie Dupont SARL') > THRESHOLD);
});

test('normalisation drops the legal form', () => {
  assert.equal(normalise('Boulangerie Martin SARL'), 'boulangerie martin');
  // A name that is nothing but a legal form keeps it, rather than emptying
  // out and matching every other emptied name perfectly.
  assert.equal(normalise('SARL'), 'sarl');
});

test('an empty name matches nothing', () => {
  assert.equal(similarity('', 'Martin SARL'), 0);
  // Two empty names are identical by definition. The caller filters them out
  // before matching; the function will not decide that for you.
  assert.equal(similarity('', ''), 1);
});

test('Jaro-Winkler rewards a shared opening', () => {
  assert.ok(jaroWinkler('martin', 'martix') > jaroWinkler('nartin', 'xartin'));
});

test('breaking point: an acronym against the name it stands for', () => {
  // The breaking point claimed on the entry: two names of one company with no
  // characters in common. Jaro-Winkler compares characters. It has no idea
  // that SNCF is built from the initials below it, so the true pair scores
  // low — and, worse, lower than an unrelated company that merely starts with
  // the same letter. No threshold keeps the first and rejects the second.
  const expanded = 'Société Nationale des Chemins de fer Français';
  assert.ok(similarity('SNCF', expanded) < THRESHOLD);
  assert.ok(similarity('SNCF', 'Sanofi') > similarity('SNCF', expanded));
});
