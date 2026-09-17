/**
 * Mask contact details in a chat message: normalisation, then regular
 * expressions.
 *
 * Rung N0. Deterministic, no dependency. Contact details, and those only: a
 * phone number, an email address, an IBAN. A name, a postal address or a date
 * of birth are personal data too, and nothing here touches them.
 *
 * Two things make this work.
 *
 * First, the patterns read a normalised copy of the message, where every
 * character is written in its plain form: compatibility folding brings
 * full-width digits back to ordinary ones, and the spaces of French
 * typography, the zero-width characters and the soft hyphen become a plain
 * space. The labels are then put into the message as it was written, so a
 * message with nothing to mask comes back unchanged, apart from the
 * composition of its accents (NFC), which changes nothing on screen.
 *
 * Second, the phone patterns tolerate the separators people type between
 * digits — a space, a dot, a dash or a slash, one or two of them — and an IBAN
 * is only masked when its check digits add up.
 */

// Characters that can sit inside a number without looking like a separator:
// the spaces of French typography, the soft hyphen, the zero-width space and
// joiners, the word joiner and the byte order mark.
const INVISIBLE_OR_SPACE = /[\u00a0\u00ad\u2007\u2009\u200a\u200b\u200c\u200d\u202f\u2060\ufeff]/;

// The lookbehind starts a match only at the beginning of a word: without it, a
// long run of letters with no @ takes quadratic time. The `u` flag and \p{…}
// classes let accented letters in, as \w does in Python.
const EMAIL = /(?<![\p{L}\p{N}_.+-])[\p{L}\p{N}_.+-]+@[\p{L}\p{N}_-]+(?:\.[\p{L}\p{N}_-]+)+/gu;

// French numbers: 0X XX XX XX XX, +33 X XX XX XX XX, or +33 (0)X XX XX XX XX.
// Between digits: a space, a dot, a dash or a slash, one or two of them, or nothing.
const SEP = '[ ./-]{0,2}';
const PHONE = new RegExp(`(?<![\\d+])(?:\\+${SEP}33${SEP}(?:\\(0\\)${SEP})?|0)[1-9](?:${SEP}\\d){8}(?!\\d)`, 'g');

// Any other country: a code introduced by + or 00, then eight to fifteen
// digits in all. Fifteen is the maximum length of a number in recommendation
// ITU-T E.164, so a longer run of digits is something else and stays untouched.
// Without this pattern a Belgian, Swiss or British number goes through
// unmasked, which on a marketplace is not an evasion, it is a user.
const INTERNATIONAL = new RegExp(`(?<![\\d+])(?:\\+|00)${SEP}\\d(?:${SEP}\\d){7,14}(?!\\d)`, 'g');

// IBAN: two letters, two check digits, then the account number in groups of
// four, spaced or not. Upper case only, the way ISO 13616 prints one: read in
// either case, any sentence whose words happened to fall in fours and whose
// digits happened to pass the check would be masked — "le 10 mars 2023 pour"
// does. The check digits decide the rest, not the pattern.
const IBAN = /(?<![A-Z0-9])[A-Z]{2} ?\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?(?![A-Z0-9])/g;

// Order matters: an email may contain digits that would otherwise be read as
// the start of a phone number, and the French pattern is tried before the
// international one so that "+33 (0)6 …" is read as one number.
const PATTERNS = [[EMAIL, '[email]'], [IBAN, '[iban]'], [PHONE, '[phone]'], [INTERNATIONAL, '[phone]']];

const plain = (char) => (INVISIBLE_OR_SPACE.test(char) ? ' ' : char.normalize('NFKC'));

/** Write every character in its plain form: a digit as a digit, a space as a space. */
export function normalise(text) {
  return [...text].map(plain).join('');
}

/** ISO 13616: the first four characters go to the end, letters count 10 to 35, modulo 97 is 1. */
function isValidIban(candidate) {
  const compact = candidate.replace(/ /g, '').toUpperCase();
  const digits = [...compact.slice(4) + compact.slice(0, 4)].map((c) => parseInt(c, 36)).join('');
  return compact.length >= 15 && BigInt(digits) % 97n === 1n;
}

/** The longest valid IBAN at the start of `candidate`, cut at a space: the pattern may swallow the next word. */
function ibanPrefix(candidate) {
  const cuts = [candidate.length, ...[...candidate.matchAll(/ /g)].map((space) => space.index).reverse()];
  const cut = cuts.find((at) => isValidIban(candidate.slice(0, at)));
  return cut === undefined ? '' : candidate.slice(0, cut);
}

/**
 * Replace contact details with a label naming what was removed.
 *
 * A label beats a row of asterisks: whoever reads the thread later can see
 * that a phone number was removed, not merely that something was.
 */
export function mask(text) {
  const chars = [...text.normalize('NFC')];
  const origin = []; // origin[i]: the character that code unit i of the plain copy comes from
  let copy = '';
  chars.forEach((char, index) => {
    copy += plain(char);
    while (origin.length < copy.length) origin.push(index);
  });

  const covered = new Array(chars.length).fill(null); // [label, first character] of the match covering each character
  for (const [pattern, label] of PATTERNS) {
    for (const match of copy.matchAll(pattern)) {
      const found = label === '[iban]' ? ibanPrefix(match[0]) : match[0];
      if (!found) continue;
      const start = origin[match.index];
      const end = origin[match.index + found.length - 1] + 1;
      if (covered.slice(start, end).every((cover) => cover === null)) covered.fill([label, start], start, end);
    }
  }

  // Each character is kept, replaced by its label where a match starts, or dropped.
  return chars.map((char, i) => (covered[i] === null ? char : covered[i][1] === i ? covered[i][0] : '')).join('');
}
