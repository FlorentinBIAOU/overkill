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
 * What the digits cannot say is whether 03/04/2024 is 3 April or 4 March. The
 * document usually says it somewhere else: one date in it whose first field is
 * above twelve can only be day-first, and that settles every other date of the
 * same document. Failing that, the caller may know the locale of the sender.
 * Failing that too, the snippet abstains: the date comes back without a day
 * rather than with a guess in the shape of a fact.
 */

// Month names in French and English, the two a French-language document mixes,
// with the abbreviations an invoice, a delivery note or an email actually use.
const MONTHS = new Map(['janvier january janv jan', 'fevrier february fevr fev feb',
  'mars march mar', 'avril april avr apr', 'mai may', 'juin june jun',
  'juillet july juil jul', 'aout august aou aug', 'septembre september sept sep',
  'octobre october oct', 'novembre november nov', 'decembre december dec']
  .flatMap((names, index) => names.split(' ').map((name) => [name, index + 1])));

// ASCII digits and full-width digits, read the same way in Python and JavaScript.
const D = '[0-9０-９]';
// A month name, its accents typed as one character or as a letter plus a mark.
const WORD = '(?<month>[\\p{L}\\p{M}]+)';
const ORDINAL = '(?:er|st|nd|rd|th)?';

// "3 avril 2024", "1er mars 2024", "3rd April 2024", "3 janv. 2024",
// "3 April, 2024", in any case. The full stop of an abbreviation and the comma
// that often follows the month are both optional.
const TEXTUAL = new RegExp(`(?<!${D})(?<day>${D}{1,2})${ORDINAL}\\s+${WORD}\\.?,?\\s+(?<year>${D}{4})(?!${D})`, 'giu');

// "March 3, 2024", "Mar 3, 2024". It only starts at the start of a word — and
// a combining mark is not the start of a word — so a long run of letters or of
// marks is read once, not once per character.
const MONTH_FIRST = new RegExp(`(?<!\\p{L})(?<!\\p{M})${WORD}\\.?\\s+(?<day>${D}{1,2})${ORDINAL},?\\s+(?<year>${D}{4})(?!${D})`, 'giu');

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

/**
 * Two-digit years as MySQL reads them: 00-69 are 2000-2069, 70-99 are 1970-1999.
 *
 * The pivot is right for deadlines and wrong for birth dates: "12/03/65" comes
 * out 2065. A field that holds dates of birth wants its own rule.
 */
function fullYear(written) {
  const year = number(written);
  return written.length === 4 ? year : year + (year < 70 ? 2000 : 1900);
}

function readTextual(match) {
  const month = MONTHS.get(fold(match.groups.month));
  return month ? toDate(number(match.groups.year), month, number(match.groups.day)) : null;
}

/** A date whose day nothing in the document settles. */
export const UNDECIDED = Symbol('undecided');

/** The three numeric fields, or null when the match is not a date at all. */
function fieldsOf(match) {
  const [first, second, third] = match.slice(1, 4);
  // A short year only with a padded day and month: "version 2.1.24" is no date.
  if (third.length === 2 && (first.length === 1 || second.length === 1)) return null;
  return [first, second, third];
}

/**
 * Read the day-month convention off the document itself.
 *
 * A numeric date whose first field is above twelve can only be day-first; one
 * whose second field is above twelve can only be month-first. A single such
 * date settles every ambiguous date of the same document, which is what a
 * person does when reading it. A document that carries both kinds contradicts
 * itself and settles nothing.
 *
 * Returns true for day-first, false for month-first, null when the document is
 * silent or contradicts itself.
 */
export function documentConvention(text) {
  let convention = null;
  for (const match of text.matchAll(NUMERIC)) {
    const fields = fieldsOf(match);
    // ISO carries its own order and proves nothing about the rest.
    if (fields === null || fields[0].length === 4) continue;
    const [first, second] = fields.map(number);
    const proof = first > 12 ? true : second > 12 ? false : null;
    if (proof === null) continue;
    if (convention !== null && convention !== proof) return null;
    convention = proof;
  }
  return convention;
}

function readNumeric(match, dayFirst) {
  const fields = fieldsOf(match);
  if (fields === null) return null;
  const [first, second, third] = fields;
  if (first.length === 4) return toDate(number(first), number(second), number(third)); // ISO order
  const settled = number(first) > 12 ? true : number(second) > 12 ? false : dayFirst;
  if (settled === null) return UNDECIDED;
  const [day, month] = settled ? [first, second] : [second, first];
  return toDate(fullYear(third), number(month), number(day));
}

/**
 * Return every real date in `text`, as { text: what was written, date }.
 *
 * `dayFirst` says how to read 03/04/2024 when the document does not. Left out,
 * the convention is read from the document itself, once, and applied to all of
 * it: see `documentConvention`. Passed, it is the caller's own knowledge — the
 * locale of the sender, the country of the supplier — and it wins over nothing,
 * because the document's own proof is stronger and is applied date by date
 * before it.
 *
 * A date the document does not settle and the caller did not settle comes back
 * with `date: null` instead of a day. That is the point: a guess in the shape
 * of a fact is worse than a hole, because nothing downstream can tell the two
 * apart.
 */
export function extractDates(text, dayFirst = null) {
  const convention = dayFirst === null ? documentConvention(text) : dayFirst;
  const found = [];
  const taken = new Uint8Array(text.length); // characters already read as a date
  for (const pattern of [TEXTUAL, MONTH_FIRST, NUMERIC]) {
    for (const match of text.matchAll(pattern)) {
      const [start, end] = [match.index, match.index + match[0].length];
      // A match that overlaps an accepted one is a second reading of the same
      // characters, not a second date.
      if (taken.subarray(start, end).includes(1)) continue;
      const date = pattern === NUMERIC ? readNumeric(match, convention) : readTextual(match);
      if (date) {
        found.push({ start, text: match[0], date: date === UNDECIDED ? null : date });
        taken.fill(1, start, end);
      }
    }
  }
  found.sort((a, b) => a.start - b.start);
  return found.map(({ text: written, date }) => ({ text: written, date }));
}
