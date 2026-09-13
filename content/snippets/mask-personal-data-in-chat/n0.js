/**
 * Mask personal data in a chat message: normalisation, then regular expressions.
 *
 * Rung N0. Deterministic, no dependency, fast enough that you will never find
 * it in a profile.
 *
 * Two things make this work.
 *
 * First, normalisation only changes how a character is written. Compatibility
 * folding brings full-width digits and the narrow spaces of French typography
 * back to their plain forms; the invisible joiners it leaves behind are turned
 * into a space. Going further — stripping punctuation, say — would destroy the
 * very characters an email address is made of.
 *
 * Second, each pattern tolerates the separators people actually type inside a
 * number, instead of assuming one canonical form.
 */

// The space characters French typography puts inside numbers, plus the word
// joiner that compatibility folding leaves in place.
const UNUSUAL_SPACES = /[     ⁠]/g;

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

// French numbers: 0X XX XX XX XX, or +33 X XX XX XX XX. The separator between
// digits may be a space, a dot or a dash, or absent.
const SEP = '[ .-]?';
const PHONE = new RegExp(`(?<![\\d+])(?:\\+${SEP}33${SEP}|0)[1-9](?:${SEP}\\d){8}(?!\\d)`, 'g');

// IBAN: two letters, two check digits, then up to thirty alphanumerics,
// conventionally grouped in fours.
const IBAN = /(?<![A-Z0-9])[A-Z]{2} ?\d{2}(?: ?[A-Z0-9]){10,28}(?![A-Z0-9])/g;

// Order matters: an email may contain digits that would otherwise be read as
// the start of a phone number.
const PATTERNS = [
  [EMAIL, '[email]'],
  [IBAN, '[iban]'],
  [PHONE, '[phone]'],
];

/** Reduce the many spellings of a space to a plain one. */
export function normalise(text) {
  return text.normalize('NFKC').replace(UNUSUAL_SPACES, ' ');
}

/**
 * Replace contact details with a label naming what was removed.
 *
 * A label beats a row of asterisks: whoever reads the thread later can see
 * that a phone number was removed, not merely that something was.
 */
export function mask(text) {
  let out = normalise(text);
  for (const [pattern, label] of PATTERNS) {
    out = out.replace(pattern, label);
  }
  return out;
}
