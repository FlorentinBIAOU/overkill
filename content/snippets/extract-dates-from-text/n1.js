/**
 * Decide whether 03/04/2024 is 3 April or 4 March, with a light classifier.
 *
 * Rung N1. Rules still find the candidates, exactly as N0 does: a date is a
 * shape, and a shape is what regular expressions are for. What a rule cannot
 * do is read 03/04/2024, because nothing in those digits says which field is
 * the day. N0 answers by asking the caller to pick one convention for a whole
 * document, which is wrong the moment a document quotes a supplier from abroad.
 *
 * The convention is not in the digits, it is in the prose around them. That is
 * a classification problem, and a few hundred labelled sentences are enough.
 *
 * Logistic regression on word counts is written out here rather than pulled
 * from a library, because it is short enough to read. That is the whole
 * argument of this rung.
 */

const CANDIDATE = /(?<!\d)(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?!\d)/g;
const WINDOW = 40; // characters of context kept on each side of a candidate

/**
 * The words around a date, with every digit removed.
 *
 * Removing the digits is what stops the classifier memorising the dates of the
 * training set instead of learning the habits of the prose around them.
 */
export function context(text, start, end) {
  const around = `${text.slice(Math.max(0, start - WINDOW), start)} ${text.slice(end, end + WINDOW)}`;
  return around.toLowerCase().replace(/\d+/g, ' ');
}

/** Word counts of one context, normalised so that long sentences do not shout. */
function features(text) {
  const counts = new Map();
  for (const word of text.match(/\p{L}+/gu) ?? []) counts.set(word, (counts.get(word) ?? 0) + 1);
  const norm = Math.hypot(...counts.values());
  return new Map([...counts].map(([word, count]) => [word, count / norm]));
}

/** Probability that this context comes from a document writing the day first. */
function probability(model, row) {
  let z = model.bias;
  for (const [word, value] of row) z += (model.weights.get(word) ?? 0) * value;
  return 1 / (1 + Math.exp(-z));
}

function firstContext(text) {
  const [match] = text.matchAll(CANDIDATE);
  return match ? context(text, match.index, match.index + match[0].length) : '';
}

/** `labels` is 1 when the text writes the day first, 0 when the month comes first. */
export function train(texts, labels, { epochs = 300, rate = 0.5 } = {}) {
  const rows = texts.map((text) => features(firstContext(text)));
  const model = { weights: new Map(), bias: 0 };
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    rows.forEach((row, i) => {
      const error = probability(model, row) - labels[i];
      for (const [word, value] of row) {
        model.weights.set(word, (model.weights.get(word) ?? 0) - rate * error * value);
      }
      model.bias -= rate * error;
    });
  }
  return model;
}

/** Real calendar validation, kept from N0: a regular expression accepts 31 February. */
function toDate(year, month, day) {
  const value = new Date(Date.UTC(year, month - 1, day));
  const real = value.getUTCFullYear() === year && value.getUTCMonth() === month - 1 && value.getUTCDate() === day;
  return real ? value : null;
}

/** Return every real date in `text`, reading each one the way its context suggests. */
export function extractDates(model, text) {
  const found = [];
  for (const match of text.matchAll(CANDIDATE)) {
    const [first, second, year] = match.slice(1).map(Number);
    const [start, end] = [match.index, match.index + match[0].length];
    // The rules settle what they can; the classifier only sees what is left.
    const dayFirst = second > 12 ? false : first > 12 ? true
      : probability(model, features(context(text, start, end))) >= 0.5;
    const date = toDate(year, dayFirst ? second : first, dayFirst ? first : second);
    if (date) found.push({ text: match[0], date });
  }
  return found;
}
