/**
 * Validate a phone number against the numbering plan of its country.
 *
 * Rung N0. Every country publishes which prefixes exist, how long a number is
 * behind each of them, and what kind of line it reaches. Google collects those
 * plans in libphonenumber and republishes them as they change —
 * `libphonenumber-js` here, `phonenumbers` in Python. Both are a table lookup:
 * no network, no key, and the same answer twice.
 *
 * The one thing this code refuses to do is guess. A number written
 * 06 12 34 56 78 is French only if somebody says so; the same digits are a
 * valid mobile number in several other countries. So the region is either
 * written in the number, as the leading +, or declared by the caller, or the
 * number is refused — never assumed from where the server happens to run.
 *
 * What comes back is the number in E.164, the region it belongs to, and the
 * kind of line. The kind is what tells a form that an SMS will never arrive:
 * in France a number starting 01 is a fixed line, and it is valid.
 */

// The `max` bundle, and not the default one: it is the metadata that carries
// the line types and the full per-country rules, which is what Python's
// `phonenumbers` ships by default.
import { parsePhoneNumberWithError } from 'libphonenumber-js/max';

// E.164 caps a number at fifteen digits. Forty characters leaves room for the
// spaces, dots and brackets people type, and refuses a pasted paragraph.
export const MAX_CHARACTERS = 40;

// Everything a phone number may carry besides digits. Digits are any Unicode
// decimal digit, category Nd, which is what the Python side matches too: a
// number typed in Arabic-Indic digits is a number.
export const PUNCTUATION = '+ .-()/';

// The space characters a word processor and a French keyboard put inside a
// number. libphonenumber has its own list of punctuation it steps over, and
// the narrow no-break space is not in it: a number grouped with those stops
// being read at the first one. They are levelled to an ordinary space, and
// nothing else is touched.
export const SPACES =
  '\t\n\r\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000';

/**
 * Say whether `raw` is a number that exists in a numbering plan.
 *
 * `defaultRegion` is the two-letter country the caller is expecting, and it is
 * required unless the number starts with +. There is no fallback: a silently
 * assumed region turns a Belgian mobile into a French one, and the caller
 * would never see it happen.
 *
 * Nothing throws. A number that cannot be read comes back as `valid: false`
 * with a `reason`, because a validator that throws in a request path leaves
 * the form with nothing to show.
 *
 * @param {string} raw
 * @param {{defaultRegion?: string}} [options]
 */
export function validatePhoneNumber(raw, { defaultRegion } = {}) {
  if (typeof raw !== 'string') {
    return report(false, null, null, null, `a phone number is text, not ${kindOf(raw)}`);
  }
  if (raw.length > MAX_CHARACTERS) {
    return report(false, null, null, null, `longer than ${MAX_CHARACTERS} characters`);
  }

  const written = [...raw].map((c) => (SPACES.includes(c) ? ' ' : c)).join('').replace(/^ +| +$/g, '');
  // Letters are refused rather than passed on. libphonenumber reads them as
  // the keys of a telephone keypad, so “06 12 34 56 78 poste 42” becomes a
  // longer number that is not the one anybody typed.
  if ([...written].some((c) => !PUNCTUATION.includes(c) && !/\p{Nd}/u.test(c))) {
    return report(false, null, null, null, 'contains something that is not a number');
  }
  if (!written.startsWith('+') && !defaultRegion) {
    return report(false, null, null, null,
      'no country code in the number and no region declared by the caller');
  }

  let parsed;
  try {
    parsed = parsePhoneNumberWithError(written, defaultRegion);
  } catch {
    // The two libraries do not word their parse errors the same way, and the
    // caller acts on the refusal, not on its wording.
    return report(false, null, null, null, 'cannot be read as a phone number');
  }

  const region = parsed.country ?? null;
  const kind = parsed.getType() ?? null;
  const e164 = parsed.number;

  if (!parsed.isValid()) {
    // `isPossible` only checks the length, so it separates a number that is
    // too short from one whose prefix is not allocated.
    const detail = parsed.isPossible()
      ? "no prefix of that country's plan matches"
      : 'the wrong length for its country';
    return report(false, region, kind, e164, `not in a numbering plan: ${detail}`);
  }
  return report(true, region, kind, e164, null);
}

const kindOf = (value) => (value === null ? 'null' : typeof value);

const report = (valid, region, type, e164, reason) => ({ valid, region, type, e164, reason });
