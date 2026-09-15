/**
 * Extract dates from text: one regular expression per format, then a real
 * calendar check.
 *
 * Rung N0. Deterministic, no dependency.
 *
 * The regular expression is the easy half. It finds groups of digits and knows
 * nothing else: 31/02/2024 matches it perfectly, and so does 29/02/2023.
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

// ASCII digits and full-width digits, read the same way in Python and JavaScript.
const D = '[0-9０-９]';
// A month name, its accents typed as one character or as a letter plus a mark.
const WORD = '(?<month>[\\p{L}\\p{M}]+)';
const ORDINAL = '(?:er|st|nd|rd|th)?';

// "3 avril 2024", "1er mars 2024", "3rd April 2024", in any case.
const TEXTUAL = new RegExp(`(?<!${D})(?<day>${D}{1,2})${ORDINAL}\\s+${WORD}\\s+(?<year>${D}{4})(?!${D})`, 'giu');

// "March 3, 2024". It only starts at the start of a word, so a long run of
// letters is read once, not once per letter.
const MONTH_FIRST = new RegExp(`(?<!\\p{L})${WORD}\\s+(?<day>${D}{1,2})${ORDINAL},?\\s+(?<year>${D}{4})(?!${D})`, 'giu');

// "12/03/2024", "12.03.24", "12-03-2024", and the ISO "2024-03-12". Never a
// piece of a longer dotted number: in "10.1.1.24", "1.1.24" is not a date.
const NUMERIC = new RegExp(`(?<!${D})(?<!${D}[/.-])(${D}{1,2}|${D}{4})[/.-](${D}{1,2})[/.-](${D}{2}|${D}{4})(?![/.-]?${D})`, 'gu');

/** Drop accents, so that "février" and "fevrier" reach the same entry. */
function fold(word) {
  return word.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '');
}

/** Full-width digits become ASCII digits before being read as a number. */
const number = (digits) => Number(digits.normalize('NFKC'));

/**
 * Real calendar validation, and the point of this rung.
 *
 * Building the date is not enough, because JavaScript rolls an impossible one
 * over instead of refusing it. Reading the parts back is the check.
 */
function toDate(year, month, day) {
  const value = new Date(0);
  value.setUTCFullYear(year, month - 1, day); // unlike Date.UTC, keeps year 24 as 24, not 1924
  const real = year >= 1 && value.getUTCFullYear() === year && value.getUTCMonth() === month - 1
    && value.getUTCDate() === day;
  return real ? value : null;
}

/** Two-digit years as MySQL reads them: 00-69 are 2000-2069, 70-99 are 1970-1999. */
function fullYear(written) {
  const year = number(written);
  return written.length === 4 ? year : year + (year < 70 ? 2000 : 1900);
}

function readTextual(match) {
  const month = MONTHS.get(fold(match.groups.month));
  return month ? toDate(number(match.groups.year), month, number(match.groups.day)) : null;
}

function readNumeric(match, dayFirst) {
  const [first, second, third] = match.slice(1, 4);
  if (first.length === 4) return toDate(number(first), number(second), number(third)); // ISO order
  // A short year only with a padded day and month: "version 2.1.24" is no date.
  if (third.length === 2 && (first.length === 1 || second.length === 1)) return null;
  const [day, month] = dayFirst ? [first, second] : [second, first];
  return toDate(fullYear(third), number(month), number(day));
}

/**
 * Return every real date in `text`, as { text: what was written, date }.
 *
 * `dayFirst` says how to read 03/04/2024. The digits cannot say, so the caller
 * decides once, for a whole document, and lives with it.
 */
export function extractDates(text, dayFirst = true) {
  const found = [];
  const taken = new Uint8Array(text.length); // characters already read as a date
  for (const pattern of [TEXTUAL, MONTH_FIRST, NUMERIC]) {
    for (const match of text.matchAll(pattern)) {
      const [start, end] = [match.index, match.index + match[0].length];
      // A match that overlaps an accepted one is a second reading of the same
      // characters, not a second date.
      if (taken.subarray(start, end).includes(1)) continue;
      const date = pattern === NUMERIC ? readNumeric(match, dayFirst) : readTextual(match);
      if (date) {
        found.push({ start, text: match[0], date });
        taken.fill(1, start, end);
      }
    }
  }
  found.sort((a, b) => a.start - b.start);
  return found.map(({ text: written, date }) => ({ text: written, date }));
}
