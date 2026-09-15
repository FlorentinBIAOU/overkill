/**
 * Guess what each column holds, instead of writing the schema by hand.
 *
 * Rung N1. Rung N0 needs a schema: somebody has to declare that `joined` holds
 * dates and `amount` holds numbers. On a file with three columns that takes a
 * minute. On the two hundred columns of an export nobody documented, it does
 * not happen, and the file gets loaded as text.
 *
 * The classifier never looks at a value on its own. It looks at eight traits
 * of a column taken as a whole — how often a value is all digits, how often it
 * carries a decimal mark, how many distinct values there are — and learns
 * which combination goes with which type, from columns labelled by hand.
 *
 * Written out rather than pulled from a library: one logistic regression per
 * type, fitted by gradient descent.
 *
 * The output is exactly the schema `cleanCsv` of rung N0 takes as its second
 * argument. This rung replaces the typing, not the cleaning.
 */

const SPACES = /[\s\u00a0\u202f]/g;
const ALL_DIGITS = /^[+-]?\d+$/;
const DECIMAL = /^[+-]?\d*[.,]\d+$/;
const DATE_SHAPE = /^\d{2,4}[-/.]\d{1,2}[-/.]\d{2,4}$/;
const LETTER = /\p{L}/u;

const BOOLEAN_WORDS = new Set(
  ['true', 'false', 'yes', 'no', 'y', 'n', '0', '1', 'vrai', 'faux', 'oui', 'non'],
);
const LONG_VALUE = 20; // a length past which a column reads as free text

export const FEATURE_NAMES = [
  'all digits',
  'decimal mark',
  'date shape',
  'contains a letter',
  'boolean word',
  'distinct ratio',
  'mean length',
  'empty ratio',
];

/**
 * Describe one column with eight numbers, all between zero and one.
 *
 * Blank values are set aside before the proportions are taken, and counted
 * separately: a column that is mostly empty is a fact about the file, not
 * about the type.
 *
 * The distinct ratio depends on the size of the sample: it falls as the
 * sample grows. Small integers repeated, 0 to 3, read as integer on eight rows
 * and as boolean on two hundred, and rung N0 then refuses every 2 and every 3,
 * in its journal.
 */
export function columnFeatures(values) {
  const filled = values.map((value) => value.trim()).filter((value) => value !== '');
  if (filled.length === 0) return new Array(FEATURE_NAMES.length).fill(0);
  const bare = filled.map((value) => value.replace(SPACES, ''));
  const count = filled.length;
  const share = (list, test) => list.filter(test).length / count;
  return [
    share(bare, (v) => ALL_DIGITS.test(v)),
    share(bare, (v) => DECIMAL.test(v)),
    share(bare, (v) => DATE_SHAPE.test(v)),
    share(filled, (v) => LETTER.test(v)),
    share(filled, (v) => BOOLEAN_WORDS.has(v.toLowerCase())),
    new Set(filled).size / count,
    Math.min(filled.reduce((total, v) => total + v.length, 0) / count, LONG_VALUE) / LONG_VALUE,
    (values.length - count) / values.length,
  ];
}

/** One logistic regression, fitted by gradient descent on a tiny data set. */
function fitOne(rows, targets, epochs, rate) {
  const weights = new Float64Array(rows[0].length);
  let bias = 0;
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    for (let i = 0; i < rows.length; i += 1) {
      let z = bias;
      for (let j = 0; j < weights.length; j += 1) z += weights[j] * rows[i][j];
      const error = 1 / (1 + Math.exp(-z)) - targets[i];
      for (let j = 0; j < weights.length; j += 1) weights[j] -= rate * error * rows[i][j];
      bias -= rate * error;
    }
  }
  return { weights, bias };
}

/**
 * `columns` is a list of column samples, `labels` the type name of each.
 *
 * The type names are the ones rung N0 coerces to: text, integer, number,
 * date, boolean. One regression is fitted per type, each answering "is it
 * this one?", and the strongest answer wins.
 */
export function train(columns, labels, { epochs = 600, rate = 0.5 } = {}) {
  const rows = columns.map(columnFeatures);
  const kinds = [...new Set(labels)].sort();
  // As scikit-learn does: with fewer than two types there is nothing to learn.
  if (kinds.length < 2) throw new RangeError('training needs columns of at least two types');
  const models = kinds.map((kind) =>
    fitOne(rows, labels.map((label) => (label === kind ? 1 : 0)), epochs, rate),
  );
  return { kinds, models };
}

/**
 * The type of one column.
 *
 * A column with nothing in it is text, and the model is not consulted: there
 * is no evidence to weigh, and text is the type that loses nothing.
 */
export function classify(model, values) {
  if (!values.some((value) => value.trim() !== '')) return 'text';
  const features = columnFeatures(values);
  let best = model.kinds[0];
  let bestScore = -Infinity;
  model.kinds.forEach((kind, k) => {
    const { weights, bias } = model.models[k];
    let z = bias;
    for (let j = 0; j < weights.length; j += 1) z += weights[j] * features[j];
    if (z > bestScore) {
      bestScore = z;
      best = kind;
    }
  });
  return best;
}

/**
 * Build the schema that `cleanCsv` of rung N0 asks for.
 *
 * Only the first `sample` rows are read. On a file sorted, or one that changes
 * as it goes, they are not the whole column: whole amounts on the first two
 * hundred rows and decimals after give integer, and rung N0 then refuses every
 * decimal, in its journal.
 */
export function inferSchema(model, header, rows, sample = 200) {
  const schema = {};
  header.forEach((name, index) => {
    const values = rows.slice(0, sample).map((row) => row[index] ?? '');
    schema[name] = classify(model, values);
  });
  return schema;
}
