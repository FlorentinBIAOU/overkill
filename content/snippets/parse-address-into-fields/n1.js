/**
 * Label every token of an address with a logistic regression on context traits.
 *
 * Rung N1. N0 reads the address it expects; this one reads the address it is
 * given. Each word is labelled on its own — number, street type, street name,
 * complement, postcode, town — from what it looks like and from what sits on
 * either side of it. Fields are then rebuilt from the labels.
 *
 * That is the whole gain: a complement in the middle of the line no longer
 * swallows the street, because "Bâtiment" is a word the model has seen in
 * that position, not an unexpected token in a fixed pattern.
 *
 * One binary regression per label, trained by plain gradient descent, and the
 * strongest one wins. Written out rather than pulled from a library, because
 * that is forty lines and it is the argument of this rung.
 */

// The labels are the fields, so the mapping back is a grouping and nothing more.
export const LABELS = ['number', 'street_type', 'street', 'complement', 'postcode', 'city'];

const TOKEN = /[\p{L}\p{N}]+/gu;

/** Words and numbers, punctuation dropped. */
export function tokenise(address) {
  return address.normalize('NFKC').match(TOKEN) ?? [];
}

/** Lowercase and accent-free, so "Allée" and "allee" share a trait. */
export function fold(word) {
  return word.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

const isDigits = (token) => /^\d+$/.test(token);

/**
 * What the token looks like, and what surrounds it.
 *
 * The neighbours carry most of the signal: five digits followed by one
 * capitalised word is a postcode and a town, wherever it sits in the line.
 */
export function features(tokens, i) {
  const token = tokens[i];
  return {
    [`token=${fold(token)}`]: 1,
    [`previous=${i > 0 ? fold(tokens[i - 1]) : '<start>'}`]: 1,
    [`next=${i + 1 < tokens.length ? fold(tokens[i + 1]) : '<end>'}`]: 1,
    digits: Number(isDigits(token)),
    five_digits: Number(isDigits(token) && token.length === 5),
    short_number: Number(isDigits(token) && token.length <= 3),
    capitalised: Number(token[0] !== token[0].toLowerCase()),
    position: i / tokens.length,
    last: Number(i === tokens.length - 1),
  };
}

/**
 * `examples` pairs an address with one label per token, in reading order.
 *
 * Tagging is the work of this rung, and mistagging it is the usual way the rung
 * is made to fail, so a misaligned example is rejected rather than quietly
 * learnt.
 */
export function train(examples, { epochs = 300, rate = 0.3 } = {}) {
  const rows = [];
  const targets = [];
  for (const [address, labels] of examples) {
    const tokens = tokenise(address);
    if (tokens.length !== labels.length) {
      throw new Error(`${tokens.length} tokens for ${labels.length} labels: ${address}`);
    }
    tokens.forEach((_, i) => {
      rows.push(features(tokens, i));
      targets.push(labels[i]);
    });
  }

  // One column per trait seen in training. A trait absent from this map is a
  // word the model never met, and it simply contributes nothing at prediction.
  const columns = new Map();
  const vectors = rows.map((row) =>
    Object.entries(row).map(([name, value]) => {
      if (!columns.has(name)) columns.set(name, columns.size);
      return [columns.get(name), value];
    }));

  const weights = {};
  for (const label of new Set(targets)) {
    const w = new Float64Array(columns.size + 1); // the last cell is the bias
    for (let epoch = 0; epoch < epochs; epoch += 1) {
      for (let i = 0; i < vectors.length; i += 1) {
        const target = targets[i] === label ? 1 : 0;
        const error = 1 / (1 + Math.exp(-score(w, vectors[i]))) - target;
        for (const [column, value] of vectors[i]) w[column] -= rate * error * value;
        w[columns.size] -= rate * error;
      }
    }
    weights[label] = w;
  }
  return { columns, weights };
}

/** Group the labelled tokens back into fields, in reading order. */
export function parse(model, address) {
  const fields = Object.fromEntries(LABELS.map((name) => [name, '']));
  const tokens = tokenise(address);
  tokens.forEach((token, i) => {
    const vector = vectorise(features(tokens, i), model.columns);
    const label = Object.keys(model.weights).reduce((best, candidate) =>
      score(model.weights[candidate], vector) > score(model.weights[best], vector) ? candidate : best);
    fields[label] = `${fields[label]} ${token}`.trim();
  });
  // The street type stays available on its own, and also opens the street, so
  // the output can be compared field by field with the rung below.
  fields.street = `${fields.street_type} ${fields.street}`.trim();
  return fields;
}

function vectorise(row, columns) {
  return Object.entries(row)
    .filter(([name]) => columns.has(name))
    .map(([name, value]) => [columns.get(name), value]);
}

function score(weights, vector) {
  let total = weights[weights.length - 1];
  for (const [column, value] of vector) total += weights[column] * value;
  return total;
}
