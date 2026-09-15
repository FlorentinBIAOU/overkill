/**
 * Validate a form on the server: a declarative schema, one error per field.
 *
 * Rung N0. Deterministic, no dependency. The whole point of this entry is that
 * a validator worth having fits in forty lines, so the rules stay readable and
 * every refusal can be explained to the person who typed the form.
 *
 * Three decisions carry the design.
 *
 * First, the schema is data, not code. It can be written next to the form, read
 * by someone who does not write JavaScript, and handed to the Python version
 * that guards the same form on the other side. A pattern means the same thing
 * on both sides only with explicit classes: the shorthands for a digit and a
 * word character reach beyond ASCII in Python and stop at it in JavaScript, so
 * write [0-9] and [A-Za-z].
 *
 * Second, the answer is a mapping of field name to message, never a boolean. A
 * form that answers "no" without saying which field is wrong sends the user
 * hunting, and sends the developer to the logs.
 *
 * Third, one message per field: checks stop at the first broken rule. Telling
 * someone their password is too short *and* badly formed at once is noise; fix
 * the first thing, resubmit, see the next.
 */

// The types a form field can hold once decoded. `Number.isInteger` rejects
// NaN, Infinity and 1.5 in one go, which is what a form needs.
const TYPES = {
  string: (v) => typeof v === 'string',
  integer: (v) => Number.isInteger(v),
};

/** Return the first broken rule as a message, or null if the value passes. */
export function check(value, rule) {
  const kind = rule.type ?? 'string';
  if (!TYPES[kind](value)) return `must be of type ${kind}`;
  // For a string the bounds read as a length; for a number, as a value.
  // The length counts code points once composed (NFC), as the Python version
  // does: "é" counts one however it was typed, and an emoji made of several
  // code points, such as a flag, still counts several.
  const text = String(value).normalize('NFC');
  const [size, unit] = kind === 'string' ? [[...text].length, ' characters'] : [value, ''];
  if (rule.min !== undefined && size < rule.min) return `must be at least ${rule.min}${unit}`;
  if (rule.max !== undefined && size > rule.max) return `must be at most ${rule.max}${unit}`;
  // Anchored, so a pattern matches the whole field and not a fragment of it.
  if (rule.pattern !== undefined && !new RegExp(`^(?:${rule.pattern})$`).test(text)) {
    return rule.message ?? 'is not in the expected format';
  }
  return null;
}

/**
 * Check a submitted form against a schema, and return {field: message}.
 *
 * An empty object means the form is valid. A missing key, an explicit null and
 * an empty string are the same thing here, because that is what a browser posts
 * for a field the user left alone.
 */
export function validate(data, schema) {
  // A field the schema does not declare is refused, not ignored: whoever
  // stores the submission would otherwise store it too.
  const errors = {};
  for (const field of Object.keys(data)) {
    if (!Object.hasOwn(schema, field)) errors[field] = 'is not a field of this form';
  }
  for (const [field, rule] of Object.entries(schema)) {
    const value = data[field];
    if (value === undefined || value === null || value === '') {
      if (rule.required) errors[field] = 'is required';
      continue;
    }
    const message = check(value, rule);
    if (message !== null) errors[field] = message;
  }
  return errors;
}
