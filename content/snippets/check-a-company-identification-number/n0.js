/**
 * Check a French company identification number, offline and exactly.
 *
 * Rung N0. A SIREN is nine digits, a SIRET fourteen, and the last digit of
 * each is computed from the ones before it. Checking it is arithmetic: the
 * answer is exact, it is the same every time, and it costs nothing.
 *
 * The arithmetic is not what you write. A standard-number library carries it —
 * `stdnum-js` here, `python-stdnum` in Python — and with it the exception a
 * hand-written Luhn gets wrong: every establishment of La Poste shares the
 * SIREN 356000000, and their SIRETs do not satisfy Luhn. The rule INSEE gives
 * for them is that the plain sum of the fourteen digits is a multiple of five.
 * 35600000009075, the Rennes establishment, fails Luhn and is valid.
 *
 * What the key proves is narrow, and the report says which one was applied so
 * the caller can tell. A number can be well-formed and belong to nobody:
 * 000000000 passes. Whether the company exists, and is still trading, is a
 * lookup in the Sirene register, not a harder computation.
 */

import { stdnum } from 'stdnum';

const { siren, siret } = stdnum.FR;

// The separators people paste around these numbers: the ordinary space, the
// non-breaking ones a spreadsheet inserts, the full stop, the hyphens.
// Anything else surviving the clean-up is refused rather than quietly dropped,
// which is what turns a mistyped number into a different valid one.
export const SEPARATORS = ' .  -‐‑–';

// Nine digits, or fourteen. Sixty-four characters leaves room for every
// separator anyone has pasted and refuses a pasted paragraph.
export const MAX_CHARACTERS = 64;

const VALIDATORS = {
  SIREN: [9, (value) => siren.validate(value).isValid],
  SIRET: [14, (value) => siret.validate(value).isValid],
};
const BY_LENGTH = { 9: 'SIREN', 14: 'SIRET' };

/**
 * Say whether `raw` carries a well-formed SIREN or SIRET.
 *
 * `expected` is the kind the caller is asking for, 'SIREN' or 'SIRET'. Left
 * out, the length decides — the only reading there is, since the two lengths
 * do not overlap — and `kind` in the report says which one was checked.
 *
 * Nothing here throws on bad input: a validator that throws in a request path
 * leaves the form with no answer to show. Every refusal comes back as
 * `valid: false` with a `reason` in plain words.
 *
 * @param {string} raw
 * @param {{expected?: 'SIREN'|'SIRET'}} [options]
 */
export function checkCompanyNumber(raw, { expected } = {}) {
  if (typeof raw !== 'string') {
    return report(false, null, '', `a company number is text, not ${kindOf(raw)}`);
  }
  if (raw.length > MAX_CHARACTERS) {
    return report(false, null, '', `longer than ${MAX_CHARACTERS} characters`);
  }

  const compact = [...raw].filter((character) => !SEPARATORS.includes(character)).join('');
  // Only ASCII digits: the checksum cannot be computed on Arabic-Indic or
  // other decimal digits, and the register uses ASCII.
  if (!/^[0-9]+$/.test(compact)) {
    return report(false, null, compact, 'not digits and separators only');
  }

  const kind = expected ?? BY_LENGTH[compact.length];
  if (!(kind in VALIDATORS)) {
    return report(false, null, compact, `${compact.length} digits: expected nine or fourteen`);
  }

  const [length, isValid] = VALIDATORS[kind];
  if (compact.length !== length) {
    return report(false, kind, compact, `${kind} is ${length} digits, got ${compact.length}`);
  }
  if (!isValid(compact)) {
    return report(false, kind, compact, `the check digit of this ${kind} does not match`);
  }
  return report(true, kind, compact, null);
}

const kindOf = (value) => (value === null ? 'null' : typeof value);

const report = (valid, kind, compact, reason) => ({ valid, kind, compact, reason });
