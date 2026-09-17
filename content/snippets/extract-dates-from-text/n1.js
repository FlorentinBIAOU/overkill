/**
 * Read the dates a pattern cannot: a mature date parser.
 *
 * Rung N1. Rung N0 enumerates the shapes it knows, and a relative deadline has
 * no shape to enumerate: "dans 15 jours" has to be counted from a date. That
 * counting, in several languages, is what a date parser library does.
 * `chrono-node` here, `dateparser` in Python: local, free, deterministic, and
 * installed rather than written.
 *
 * Two things have to be told to it that a pattern never needed. Which languages
 * the text may be in — `chrono` has one parser per language, and the French one
 * reads nothing English. And which date to count from: `reference` has no
 * default here, on purpose, because the date to count from is the date of the
 * document, not the date of the run. "jeudi prochain" in an email received
 * three weeks ago is not next Thursday.
 *
 * A snippet that hands the job to a library inherits the library, not a
 * specification: the two languages of this page do not have the same parser, and
 * they do not read the same things. On "3 janv. 2024" `dateparser` answers
 * 3 January 2025 and `chrono-node` answers nothing, where rung N0 answers
 * 3 January 2024 — which is why N0 stays underneath rather than beside. On
 * "jeudi prochain" they disagree too: 14 March for one, 21 March for the other.
 */

import * as chrono from 'chrono-node';

export const LANGUAGES = ['fr', 'en'];

/**
 * Return every date found in `text`, as { text: what was written, date }.
 *
 * `reference` is the date the relative expressions count from: the date of the
 * document. It is required, because a default would silently be the day of the
 * run, and a backlog reprocessed on Monday would move every deadline.
 *
 * `forwardDate` is the reading of a deadline: "le 3 janvier" in a March
 * document is the next one, not the one gone by.
 */
export function extractDates(text, reference, languages = LANGUAGES) {
  if (!(reference instanceof Date) || Number.isNaN(reference.getTime())) {
    throw new TypeError('reference must be a Date: the date of the document, not of the run');
  }
  // Asked for no language, this returns nothing, and says so rather than
  // quietly reading none — the Python library would read every language it knows.
  if (languages.length === 0) throw new RangeError('at least one language is needed');
  const found = [];
  for (const language of languages) {
    const parser = chrono[language];
    if (!parser) throw new RangeError(`chrono has no parser for ${language}`);
    for (const result of parser.parse(text, reference, { forwardDate: true })) {
      // One parser per language means the same words can be read twice: the
      // first language asked for wins, as in the Python version.
      const end = result.index + result.text.length;
      if (found.some((seen) => seen.index < end && result.index < seen.index + seen.text.length)) continue;
      found.push({ index: result.index, text: result.text, date: result.start.date() });
    }
  }
  found.sort((a, b) => a.index - b.index);
  return found.map(({ text: written, date }) => ({ text: written, date }));
}
