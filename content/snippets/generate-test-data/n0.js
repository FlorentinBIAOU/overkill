/**
 * Build a test data set from a schema and a seed.
 *
 * Rung N0. No dependency, no file written: the function returns an array of
 * rows that a test can hand straight to the code under test.
 *
 * Determinism is the whole point. The same seed and the same schema give
 * exactly the same rows, on every machine, in both languages, for ever. That
 * is what makes a failing test replayable and a regression reproducible: the
 * seed printed next to a failure is enough to rebuild the data that caused it.
 *
 * Which is why the generator is written out here instead of being taken from
 * the platform. `Math.random` cannot be seeded at all, and the standard
 * generators of Python and JavaScript produce different sequences from the
 * same seed, so a data set built with them cannot be handed from one language
 * to the other, nor compared between a back end and a front end.
 *
 * Each cell is drawn from a hash of (seed, field, row) rather than from a
 * running stream. Adding a field to the schema therefore leaves every other
 * column untouched, instead of shifting the whole set by one draw.
 */

// FNV-1a, the same constants as the rest of the catalogue, so that a given
// string hashes identically wherever it is hashed.
const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;

// Unit separator: it joins the parts of a cell key, and appears in none of them.
const UNIT = '\u001f';

const DAY = 24 * 60 * 60 * 1000;

/**
 * FNV-1a on 32 bits.
 *
 * `Math.imul` is what keeps this identical to the Python version: a plain `*`
 * on numbers this large loses precision past 2^53 and silently drifts.
 */
export function stableHash(text) {
  let digest = FNV_OFFSET;
  for (const char of text) {
    digest = Math.imul(digest ^ char.codePointAt(0), FNV_PRIME) >>> 0;
  }
  return digest;
}

/** The single source of randomness: one 32-bit integer per cell. */
export function draw(seed, field, row) {
  return stableHash(`${seed}${UNIT}${field}${UNIT}${row}`);
}

/** Turn one drawn integer into one value that satisfies the field spec. */
function value(spec, number, row) {
  switch (spec.type) {
    case 'int': {
      const { min, max } = spec;
      if (min > max) throw new RangeError(`impossible range: min ${min} is above max ${max}`);
      return min + (number % (max - min + 1));
    }
    case 'choice': {
      if (!spec.values?.length) throw new RangeError('a choice field needs at least one value');
      return spec.values[number % spec.values.length];
    }
    case 'bool':
      // Percentages, not probabilities: an observed rate is read off a
      // dashboard as a percentage, and copied here as one.
      return number % 100 < (spec.true_percent ?? 50);
    case 'date': {
      const start = Date.parse(`${spec.start}T00:00:00Z`);
      return new Date(start + (number % (spec.days ?? 1)) * DAY).toISOString().slice(0, 10);
    }
    case 'sequence': {
      // Unique by construction, because an identifier that repeats turns a
      // test about duplicates into a test about the generator.
      const rank = String(row + (spec.start ?? 1)).padStart(spec.width ?? 4, '0');
      return `${spec.prefix ?? ''}${rank}${spec.suffix ?? ''}`;
    }
    default:
      throw new RangeError(`unknown field type ${JSON.stringify(spec.type)}`);
  }
}

/**
 * Return `count` rows, each field drawn independently from its own spec.
 *
 * `schema` maps a field name to a spec: {type: 'int', min, max},
 * {type: 'choice', values}, {type: 'bool', true_percent},
 * {type: 'date', start: 'YYYY-MM-DD', days} or
 * {type: 'sequence', prefix, width, suffix}.
 */
export function generateRows(schema, count, seed) {
  const rows = [];
  for (let row = 0; row < count; row += 1) {
    const built = {};
    for (const [field, spec] of Object.entries(schema)) {
      built[field] = value(spec, draw(seed, field, row), row);
    }
    rows.push(built);
  }
  return rows;
}
