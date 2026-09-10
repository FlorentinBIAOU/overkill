/**
 * Sample a test data set from the distributions observed in production.
 *
 * Rung N1. No dependency, no file written, and still no network: the
 * distributions come from the caller, as the result of a `GROUP BY` would.
 *
 * What this buys over N0. A schema says a quantity is between one and nine; it
 * does not say that most orders are for one item and almost none for nine.
 * Data drawn uniformly inside the bounds gives every rare case the same weight
 * as the common one, so a cache hit rate measured on it means nothing, a page
 * laid out for it looks nothing like the real one, and the slow query stays
 * fast.
 *
 * What is sampled here is the marginal distribution of each column, one column
 * at a time: the observed count per category, and the observed count per
 * bucket of a numeric column. Nothing is fitted and nothing is learnt — the
 * observed table is the model. Which also means the joint distribution is
 * lost, and the tests next to this file show what that costs.
 *
 * Determinism works exactly as in N0, and for the same reason: a data set that
 * is only reproducible on average is not reproducible.
 */

const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;

// Unit separator: it joins the parts of a cell key, and appears in none of them.
const UNIT = '\u001f';

/** FNV-1a on 32 bits, identical to the Python version of this file. */
export function stableHash(text) {
  let digest = FNV_OFFSET;
  for (const char of text) {
    digest = Math.imul(digest ^ char.codePointAt(0), FNV_PRIME) >>> 0;
  }
  return digest;
}

/** One 32-bit integer per cell, independent of the other cells. */
export function draw(seed, field, row) {
  return stableHash(`${seed}${UNIT}${field}${UNIT}${row}`);
}

/**
 * Index of the bucket a drawn integer falls into, in proportion to `counts`.
 *
 * Cumulating integers rather than normalising to probabilities keeps the
 * result exact, and identical in both languages: no floating point is involved
 * anywhere in the decision.
 */
export function pick(counts, number) {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total <= 0) throw new RangeError('a distribution needs at least one observation');
  let target = number % total;
  for (let index = 0; index < counts.length; index += 1) {
    if (target < counts[index]) return index;
    target -= counts[index];
  }
  throw new Error('unreachable: the target is below the total');
}

function value(spec, seed, field, row) {
  switch (spec.type) {
    case 'categorical': {
      // `counts` maps a label to its observed count, straight out of a
      // `GROUP BY`. A label seen zero times is never drawn, which is the
      // honest behaviour: it did not happen.
      //
      // The labels are sorted rather than taken in the order the query
      // returned them, so the same observed table always gives the same data.
      // It is also what keeps the two languages together: an object reorders
      // its numeric-looking keys, and a postcode is one of those.
      const labels = Object.keys(spec.counts).sort();
      return labels[pick(labels.map((label) => spec.counts[label]), draw(seed, field, row))];
    }
    case 'histogram': {
      const { edges, counts } = spec;
      if (edges.length !== counts.length + 1) {
        throw new RangeError('a histogram needs one more edge than it has buckets');
      }
      const bucket = pick(counts, draw(seed, field, row));
      const [low, high] = [edges[bucket], edges[bucket + 1]];
      // A second, independent draw places the value inside its bucket. Within
      // a bucket the shape is unknown, so uniform is the only honest choice.
      return low + (draw(seed, `${field}${UNIT}within`, row) % Math.max(high - low, 1));
    }
    default:
      throw new RangeError(`unknown distribution type ${JSON.stringify(spec.type)}`);
  }
}

/**
 * Return `count` rows, each column sampled from its own observed distribution.
 *
 * `distributions` maps a field name to either
 * {type: 'categorical', counts: {label: observed count}} or
 * {type: 'histogram', edges, counts}, where the buckets are half-open and
 * `edges` holds one more value than `counts`.
 */
export function sampleRows(distributions, count, seed) {
  const rows = [];
  for (let row = 0; row < count; row += 1) {
    const built = {};
    for (const [field, spec] of Object.entries(distributions)) {
      built[field] = value(spec, seed, field, row);
    }
    rows.push(built);
  }
  return rows;
}
