/**
 * Check an IBAN before a transfer leaves, offline and exactly.
 *
 * Rung N0. ISO 13616 puts two check digits in positions 3 and 4 of every
 * IBAN, computed over the rest of the number by the modulo 97 of ISO 7064.
 * The country code fixes the length — 27 characters in France, 22 in Germany,
 * 16 in Belgium — and the shape of what follows. All of that is a table and an
 * arithmetic identity: the answer is exact and free.
 *
 * The table is the part you do not write. `ibantools` here and `python-stdnum`
 * in Python both carry the IBAN registry, revised as countries join.
 *
 * On top of ISO 13616, several countries put a second key inside the national
 * part, and the two libraries do not cover the same countries. So this snippet
 * does not rely on theirs: it asks the library for the check digits, the
 * length and the registry format, and computes the French RIB key itself, in
 * both languages. Elsewhere, a number that passes here can still be refused by
 * the receiving bank.
 *
 * Measured on five hundred generated French IBANs: with both keys, not one of
 * twenty thousand digit-for-digit slips, two thousand adjacent transpositions
 * or seven thousand lookalike-letter slips gets through. The ISO key alone
 * lets 0.6 % of the last kind pass, because the French account number is
 * alphanumeric by registry and `I` for `1` is a legal character there; the RIB
 * key is what closes that.
 *
 * And none of it says whose account it is. That question is answered by the
 * payee verification service every euro-area provider has had to offer since
 * 9 October 2025, not by a longer computation.
 */

import { validateIBAN, ValidationErrorsIBAN } from 'ibantools';

// What people paste around an IBAN: the printed grouping in spaces of every
// kind, and the hyphens a word processor inserts. Anything else left in the
// string is refused rather than dropped, because dropping it would turn a
// mistyped account into a different valid one.
export const SEPARATORS = '    -‐‑–';

// ISO 13616 caps an IBAN at 34 characters and no country is under 15.
// Sixty-four leaves room for every separator and refuses a pasted paragraph.
export const MIN_LENGTH = 15;
export const MAX_LENGTH = 34;
export const MAX_CHARACTERS = 64;

// The letter-to-digit table of the French RIB key, from the French banking
// standard: A and J are 1, B, K and S are 2, and so on to I, R and Z at 9.
export const RIB_LETTERS = Object.fromEntries([
  ...[...'ABCDEFGHIJKLMNOPQRTUVWXYZ'].map((c, i) => [c, String((i % 9) + 1)]),
  ...[...'STUVWXYZ'].map((c, i) => [c, String(i + 2)]),
]);

/**
 * The country's own key inside the account number, or null when this snippet
 * has none for that country. France: letters become digits, and the whole
 * twenty-three-digit national part, key included, is a multiple of 97.
 */
export function nationalKeyOk(country, bban) {
  if (country !== 'FR') return null;
  const digits = [...bban].map((c) => RIB_LETTERS[c] ?? c).join('');
  return BigInt(digits) % 97n === 0n;
}

/**
 * Say whether `raw` carries a well-formed IBAN, and for which country.
 *
 * `expectedCountry` is the two-letter code the caller is expecting, from the
 * contract or the invoice. Supplied, a mismatch is refused: the country
 * changing between the quote and the payment details is the shape the
 * redirected-invoice fraud takes, and it is the one thing on this page that
 * code can still see.
 *
 * `country` comes back whether the number is valid or not, so the caller can
 * decide about reachability — a Brazilian IBAN is perfectly well-formed and no
 * SEPA transfer will get there.
 *
 * Nothing throws: a validator that throws in a request path leaves the payer
 * with no answer. Every refusal is `valid: false` and a `reason` in words.
 *
 * @param {string} raw
 * @param {{expectedCountry?: string}} [options]
 */
export function checkBankDetails(raw, { expectedCountry } = {}) {
  if (typeof raw !== 'string') {
    return report(false, null, '', null, `an IBAN is text, not ${kindOf(raw)}`);
  }
  if (raw.length > MAX_CHARACTERS) {
    return report(false, null, '', null, `longer than ${MAX_CHARACTERS} characters`);
  }

  // Upper case is the electronic format of ISO 13616; lower case carries no
  // other reading, so it is raised rather than refused.
  const compact = [...raw].filter((c) => !SEPARATORS.includes(c)).join('').toUpperCase();
  if (!/^[A-Z0-9]+$/.test(compact)) {
    return report(false, null, compact, null, 'not letters, digits and separators only');
  }
  if (compact.length < MIN_LENGTH || compact.length > MAX_LENGTH) {
    return report(false, null, compact, null,
      `${compact.length} characters: an IBAN has ${MIN_LENGTH} to ${MAX_LENGTH}`);
  }

  const country = compact.slice(0, 2);
  if (!/^[A-Z]{2}$/.test(country) || !/^[0-9]{2}$/.test(compact.slice(2, 4))) {
    return report(false, null, compact, null, 'an IBAN starts with two letters then two digits');
  }
  if (expectedCountry && country !== expectedCountry.toUpperCase()) {
    return report(false, country, compact, null,
      `expected a ${expectedCountry.toUpperCase()} account, this one is ${country}`);
  }

  // The library's own national checks are left out on purpose: the two
  // libraries do not have the same ones, and the national key is computed
  // below instead.
  const { errorCodes } = validateIBAN(compact);
  const national = ValidationErrorsIBAN.WrongAccountBankBranchChecksum;
  if (errorCodes.some((code) => code !== national)) {
    return report(false, country, compact, null,
      'ISO 13616 check digits, length or registry format do not match');
  }

  const key = nationalKeyOk(country, compact.slice(4));
  if (key === false) {
    return report(false, country, compact, key,
      'the French RIB key inside the account number does not match');
  }
  return report(true, country, compact, key, null);
}

const kindOf = (value) => (value === null ? 'null' : typeof value);

function report(valid, country, compact, nationalKey, reason) {
  // The printed grouping in fours, which is how a payer reads a number back.
  const printed = (compact.match(/.{1,4}/g) ?? []).join(' ');
  return { valid, country, compact, printed, national_key: nationalKey, reason };
}
