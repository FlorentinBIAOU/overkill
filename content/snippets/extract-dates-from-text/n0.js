/**
 * Extract dates from text: one regular expression per format, then a real
 * calendar check.
 *
 * Rung N0. Deterministic, no dependency, and the whole of it fits on a screen.
 *
 * The regular expression is the easy half. It finds three groups of digits and
 * knows nothing else: 31/02/2024 matches it perfectly, and so does 29/02/2023.
 *
 * The second half is what makes the difference, and in JavaScript it needs
 * care: `new Date(2024, 1, 31)` does not fail, it quietly rolls over to
 * 2 March. The only honest check is to build the date and read its parts back.
 *
 * What the digits cannot say is whether 03/04/2024 is 3 April or 4 March. No
 * amount of pattern matching settles that, so the caller settles it once.
 */

// Month names in French and English, the two a French-language document mixes.
const MONTHS = new Map(['janvier january', 'fevrier february', 'mars march', 'avril april',
  'mai may', 'juin june', 'juillet july', 'aout august', 'septembre september',
  'octobre october', 'novembre november', 'decembre december']
  .flatMap((names, index) => names.split(' ').map((name) => [name, index + 1])));

// "3 avril 2024", "1er mars 2024".
const TEXTUAL = /(?<!\d)(\d{1,2})(?:er)?\s+(\p{L}+)\s+(\d{4})(?!\d)/gu;

// "12/03/2024", "12.03.24", "12-03-2024", and the ISO "2024-03-12". Years are
// two or four digits, never three: that is what keeps "1.2.3" out.
const NUMERIC = /(?<!\d)(\d{1,2}|\d{4})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?!\d)/g;

/** Drop accents, so that "février" and "fevrier" reach the same entry. */
function fold(word) {
  return word.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '');
}

/**
 * Real calendar validation, and the point of this rung.
 *
 * Building the date is not enough, because JavaScript rolls an impossible one
 * over instead of refusing it. Reading the parts back is the check.
 */
function toDate(year, month, day) {
  const value = new Date(Date.UTC(year, month - 1, day));
  const real = value.getUTCFullYear() === year && value.getUTCMonth() === month - 1 && value.getUTCDate() === day;
  return real ? value : null;
}

/** Two-digit years on the usual pivot: 69 reads as 2069, 70 as 1970. */
function fullYear(year) {
  return year >= 100 ? year : year + (year < 70 ? 2000 : 1900);
}

function readTextual(match) {
  const month = MONTHS.get(fold(match[2]));
  return month ? toDate(Number(match[3]), month, Number(match[1])) : null;
}

function readNumeric(match, dayFirst) {
  const [first, second, third] = match.slice(1).map(Number);
  if (match[1].length === 4) return toDate(first, second, third); // ISO order
  const [day, month] = dayFirst ? [first, second] : [second, first];
  return toDate(fullYear(third), month, day);
}

/**
 * Return every real date in `text`, as { text: what was written, date }.
 *
 * `dayFirst` says how to read 03/04/2024. The digits cannot say, so the caller
 * decides once, for a whole document, and lives with it.
 */
export function extractDates(text, dayFirst = true) {
  const found = [];
  for (const pattern of [TEXTUAL, NUMERIC]) {
    for (const match of text.matchAll(pattern)) {
      const [start, end] = [match.index, match.index + match[0].length];
      // A match that overlaps an accepted one is a second reading of the same
      // characters, not a second date.
      if (found.some((item) => item.start < end && start < item.end)) continue;
      const date = pattern === TEXTUAL ? readTextual(match) : readNumeric(match, dayFirst);
      if (date) found.push({ start, end, text: match[0], date });
    }
  }
  found.sort((a, b) => a.start - b.start);
  return found.map(({ text: written, date }) => ({ text: written, date }));
}
