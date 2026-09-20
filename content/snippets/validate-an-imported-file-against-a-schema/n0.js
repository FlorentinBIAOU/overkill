/**
 * Validate an imported document against the schema it is supposed to follow.
 *
 * Rung N0. JSON Schema is a published standard, and a validator is a program
 * that applies it: every failure comes back with the place it happened and the
 * rule it broke. There is nothing to guess, and nothing to learn — a schema is
 * the contract, written once, and the same document validates the same way for
 * ever.
 *
 * `ajv` applies it here, `jsonschema` in Python. Two things they both do that
 * catch people out, and that this file settles rather than inherits.
 *
 * `format` is an annotation, not an assertion. The two libraries react to that
 * differently, and both reactions surprise somebody: `jsonschema` accepts
 * « 12/01/2026 » and « 2026-02-30 » against `"format": "date"` without a word,
 * while `ajv` refuses to compile the schema at all until the formats are
 * registered. Registering them, below, is what makes the two agree — and makes
 * both refuse those two dates.
 *
 * And a validator stops at the first failure unless it is told not to. An
 * import is checked once and corrected once, so every error is collected,
 * capped, and the report says how many were left out rather than pretending
 * there were none.
 *
 * What comes back is a path and a rule name for each failure. The wording of
 * the message belongs to the library and differs between the two; the path and
 * the rule are what your code should branch on.
 */

// `ajv` still defaults to draft-07; the 2020-12 dialect, the current one, is
// a separate entry point. Importing the default one instead refuses every
// schema that declares 2020-12, which is the shape the standard now publishes.
import AjvModule from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';

// Both packages are published as CommonJS and carry their class on `default`.
const Ajv = AjvModule.default ?? AjvModule;
const addFormats = addFormatsModule.default ?? addFormatsModule;

// A file with one systematic mistake produces one error per record. Two
// hundred is enough to see the pattern; the count says how many more there were.
export const MAX_ERRORS = 200;

// Compiling a schema costs far more than checking one document against it, and
// an import checks thousands against the same schema. The compiled form is
// kept here, keyed by the schema itself; the cap is what stops a caller that
// builds a new schema per record from filling memory.
const COMPILED = new Map();
export const MAX_COMPILED = 32;

/** The compiled validator for this schema, or null when it is not usable. */
function compiled(schema) {
  let key;
  try {
    key = JSON.stringify(schema) ?? 'undefined';
  } catch {
    return null;
  }
  if (!COMPILED.has(key)) {
    let validate = null;
    try {
      // The schema itself is checked first: a rule the standard does not
      // define — « objet » for « object » — would otherwise only surface as an
      // exception in the middle of a file, on the first value that uses it.
      const ajv = new Ajv({ allErrors: true, strictSchema: false });
      addFormats(ajv);
      validate = ajv.compile(schema);
    } catch {
      validate = null;
    }
    COMPILED.set(key, validate);
    if (COMPILED.size > MAX_COMPILED) COMPILED.delete(COMPILED.keys().next().value);
  }
  return COMPILED.get(key);
}

/**
 * Check `document` against `schema`, and return every failure.
 *
 * `errors` carries, for each one, the JSON Pointer of the value and the name
 * of the rule it broke — the two things a caller can act on — plus the
 * library's own message, which is for a human to read and not for code to
 * match on.
 *
 * A schema that is itself invalid is reported as such rather than thrown: on
 * an import path, a broken contract is an incident to log, not a crash.
 *
 * @param {unknown} document
 * @param {object} schema
 */
export function validateImport(document, schema) {
  const validate = compiled(schema);
  if (!validate) return report(false, [], 0, 'this schema is not usable');

  validate(document);
  const failures = [...(validate.errors ?? [])].sort(order);
  const kept = failures.slice(0, MAX_ERRORS).map((error) => ({
    path: error.instancePath,
    rule: error.keyword,
    message: error.message,
  }));
  return report(failures.length === 0, kept, failures.length, null);
}

/**
 * A single order, in both languages: by place in the document, then by rule.
 * An index sorts as a number, so record 10 comes after record 2 and not after
 * record 1 as a string comparison would have it.
 */
function order(a, b) {
  const steps = (error) => error.instancePath.split('/').slice(1)
    .map((step) => step.replace(/~1/g, '/').replace(/~0/g, '~'))
    .map((step) => (/^\d+$/.test(step) ? [0, Number(step), ''] : [1, 0, step]));
  const left = steps(a);
  const right = steps(b);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    if (i >= left.length) return -1;
    if (i >= right.length) return 1;
    for (let k = 0; k < 3; k += 1) {
      if (left[i][k] < right[i][k]) return -1;
      if (left[i][k] > right[i][k]) return 1;
    }
  }
  return a.keyword < b.keyword ? -1 : a.keyword > b.keyword ? 1 : 0;
}

const report = (valid, errors, total, reason) => ({
  valid, errors, error_count: total, truncated: total > errors.length, reason,
});
