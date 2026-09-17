/**
 * Build a test data set from a schema and a seed.
 *
 * Rung N0. No dependency, no file written: the function returns an array of
 * rows that a test can hand straight to the code under test.
 *
 * Determinism is the whole point. The same seed and the same schema give
 * exactly the same rows, in JavaScript as in Python, for as long as this code
 * is left unchanged. That is what makes a failing test replayable and a regression reproducible: the
 * seed printed next to a failure is enough to rebuild the data that caused it.
 *
 * Which is why the generator is written out here instead of being taken from
 * the platform. Python's `random` takes a seed, JavaScript's `Math.random` does
 * not, so a data set built on them cannot be handed from one language to the
 * other, nor compared between a back end and a front end. A library like Faker
 * would not settle it either: its own documentation says the values a given
 * seed produces may change from one version to the next.
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
// Stands in for UNIT inside a part, and is escaped itself.
const ESCAPE = '\u001e';

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

/** Keep UNIT out of a part, so that two different cells never share a key. */
function part(text) {
  return String(text).replaceAll(ESCAPE, `${ESCAPE}0`).replaceAll(UNIT, `${ESCAPE}1`);
}


/**
 * Scramble the low bits of a hash, the `fmix32` of MurmurHash3.
 *
 * FNV-1a leaves its last byte close to the last byte it was fed. Here the last
 * byte fed is the last digit of the row number, and everything before it is the
 * same for a whole column: without this step, `draw(…, row) % 2` is just the
 * parity of the row, one column alternates strictly, and two columns that
 * should be independent come out perfectly anticorrelated.
 *
 * Three shifts and two multiplications on 32 bits, written the same way in both
 * languages so that a seed gives the same data in each.
 */
export function finalise(digest) {
  let h = digest >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** The single source of randomness: one 32-bit integer per cell. */
export function draw(seed, field, row) {
  return finalise(stableHash(`${part(seed)}${UNIT}${part(field)}${UNIT}${row}`));
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
      const span = spec.days ?? 1;
      if (!Number.isInteger(span) || span < 1) {
        throw new RangeError(`a date field needs a whole number of days from 1, not ${span}`);
      }
      const start = Date.parse(`${spec.start}T00:00:00Z`);
      return new Date(start + (number % span) * DAY).toISOString().slice(0, 10);
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
