/**
 * Label each line of the invoice, then read the value out of the line.
 *
 * Rung N1. N0 asked « what does this line say ». This asks « where does this
 * line sit, and what does it look like »: how far down the page, how indented,
 * how wordy, how many amounts, and whether the value hangs on the right-hand
 * side.
 *
 * Those features survive a change of supplier, which is exactly what the
 * labels of N0 do not. Training is a few dozen labelled lines, and logistic
 * regression is short enough to be read rather than imported.
 */

const AMOUNT = /\d{1,3}(?:[\s.]\d{3})*[,.]\d{2}/g;
const MONTHS = 'janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre';
const DATE = new RegExp(`\\d{1,2}/\\d{1,2}/\\d{2,4}|\\d{1,2}\\s+(?:${MONTHS})\\s+\\d{4}`);
const REFERENCE = /\b(?:[A-Za-z]{1,3}[-/])?\d[\dA-Za-z/-]{3,}/;

/** The lines that carry something, indentation kept: it is a feature. */
export function pageLines(text) {
  return text.split('\n').filter((line) => line.trim() !== '');
}

/** Where the line sits and what it looks like. Never what it says. */
export function lineFeatures(line, index, count) {
  const text = line.trim();
  const amounts = text.match(AMOUNT) ?? [];
  const letters = text.replace(/[^\p{L}]/gu, '');
  const words = text.split(/\s+/).filter(Boolean);
  return [
    index / Math.max(count - 1, 1), //                    how far down the page
    index === count - 1 ? 1 : 0, //                       the very last line
    Math.min(line.length - line.trimStart().length, 40) / 40, // indentation
    Math.min(words.length, 12) / 12, //                   how wordy
    (text.match(/\d/g) ?? []).length / text.length, //    digit share
    Math.min(amounts.length, 3) / 3, //                   how many amounts
    DATE.test(text) ? 1 : 0,
    REFERENCE.test(text) ? 1 : 0,
    // A value hanging on the right of the line, the way a totals block does.
    amounts.length && text.lastIndexOf(amounts.at(-1)) > text.length / 2 ? 1 : 0,
    letters && letters === letters.toUpperCase() ? 1 : 0,
  ];
}

/**
 * One binary classifier per label, each trained on every line.
 *
 * The weighting matters more than the optimiser: three lines out of thirty
 * carry a field, and an unweighted fit answers « other » to everything and is
 * right nine times in ten.
 */
function trainOne(rows, targets, label, epochs, rate) {
  const wanted = targets.map((t) => (t === label ? 1 : 0));
  const positives = wanted.reduce((a, b) => a + b, 0);
  const weights = new Float64Array(rows[0].length);
  let bias = 0;
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    for (let i = 0; i < rows.length; i += 1) {
      const balance = rows.length / (2 * (wanted[i] ? positives : rows.length - positives));
      let z = bias;
      for (let j = 0; j < weights.length; j += 1) z += weights[j] * rows[i][j];
      const error = (1 / (1 + Math.exp(-z)) - wanted[i]) * balance;
      for (let j = 0; j < weights.length; j += 1) weights[j] -= rate * error * rows[i][j];
      bias -= rate * error;
    }
  }
  return { weights, bias };
}

/** `labels` carries one label per non-blank line of each document. */
export function train(documents, labels, { epochs = 400, rate = 0.3 } = {}) {
  const rows = [];
  const targets = [];
  documents.forEach((document, d) => {
    const lines = pageLines(document);
    lines.forEach((line, i) => rows.push(lineFeatures(line, i, lines.length)));
    targets.push(...labels[d]);
  });
  const classes = [...new Set(targets)].sort();
  return { classes, models: classes.map((c) => trainOne(rows, targets, c, epochs, rate)) };
}

function score(model, row) {
  let z = model.bias;
  for (let j = 0; j < row.length; j += 1) z += model.weights[j] * row[j];
  return 1 / (1 + Math.exp(-z));
}

function reference(line) {
  return line.match(REFERENCE)?.[0] ?? null;
}

function date(line) {
  return line.match(DATE)?.[0] ?? null;
}

/** The rightmost amount: an item line carries a quantity and a unit price. */
function total(line) {
  const amounts = line.match(AMOUNT);
  if (!amounts) return null;
  let cleaned = amounts.at(-1).replace(/[^\d,.]/g, '');
  if (cleaned.includes(',')) cleaned = cleaned.replaceAll('.', '').replace(',', '.');
  return Number(cleaned);
}

const READERS = { invoice_number: reference, date, total };

/**
 * For each field, walk the lines from the most likely down.
 *
 * The model points at a line; reading a date or an amount out of it is still
 * ours to do, and a line the model likes but that holds no value is not an
 * answer.
 */
export function extractFields(model, text) {
  const lines = pageLines(text);
  const rows = lines.map((line, i) => lineFeatures(line, i, lines.length));
  const fields = {};
  for (const [name, read] of Object.entries(READERS)) {
    const column = model.classes.indexOf(name);
    const ranked = rows
      .map((row, i) => [score(model.models[column], row), i])
      .sort((a, b) => b[0] - a[0]);
    fields[name] = null;
    for (const [, i] of ranked) {
      const value = read(lines[i]);
      if (value !== null) {
        fields[name] = value;
        break;
      }
    }
  }
  return fields;
}
