/**
 * Read the header fields of an invoice from text that has already been
 * extracted: keyword anchors, then regular expressions.
 *
 * Rung N0. No model, no training set, no service. It reads the invoices of the
 * supplier whose labels it was written for.
 *
 * The method is the one anybody reaches for: find the line carrying the label,
 * then read the value that follows it on that line. The labels are ordered
 * from the most specific to the least, because "Total TTC" and "Total HT"
 * are one word apart and the wrong one is a plausible number.
 *
 * That ordering is also where the approach ends. See the test.
 */

// An amount, signed or not, with two decimals: "1 234,56" and "1.234,56" in French,
// "1,234.56" in English. Exactly three digits per group keeps "2 38,50" apart,
// a quantity then a price; "2 380,50" still reads as one number. At most four
// groups, up to the trillions, so that a long run of digit groups is read in
// linear time.
export const AMOUNT = /[-\u2212]?(?<![\d.,])\d{1,3}(?:(?:[\s.]\d{3}){0,4},|(?:[\s,]\d{3}){0,4}\.)\d{2}(?![.,]?\d)/;
const DATE = /\d{1,2}\/\d{1,2}\/\d{2,4}/;
const REFERENCE = /\b(?:[A-Za-z]{1,3}[-/])?\d[\dA-Za-z/-]{3,}/;

/** Turn a written amount into a number the caller can compute with. */
export function parseAmount(raw) {
  // An AMOUNT match always ends on two decimals: whatever the separators, the
  // last two digits are the cents.
  const cents = Number(raw.replace(/\D/g, '')) / 100;
  return ['-', '\u2212'].includes(raw.trimStart()[0]) ? -cents : cents;
}

const trim = (raw) => raw.trim();

// Per field: the labels to look for, most specific first, the pattern the value
// must match after the label, and how to read the match.
const FIELDS = {
  invoice_number: [['facture n°', 'facture no', 'n° facture'], REFERENCE, trim],
  date: [['date'], DATE, trim],
  total: [['total ttc', 'montant ttc', 'total'], AMOUNT, parseAmount],
};

/**
 * First value matching `pattern` after one of `labels`, on the same line.
 *
 * A label that appears on a line holding no value is skipped rather than
 * accepted, because a column heading is a label too.
 */
export function findAfterLabel(text, labels, pattern) {
  // Every run of spaces, a non-breaking one included, reads as one space.
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, ' '));
  for (const label of labels) {
    for (const line of lines) {
      const position = line.toLowerCase().indexOf(label);
      if (position === -1) continue;
      const match = line.slice(position + label.length).match(pattern);
      if (match) return match[0];
    }
  }
  return null;
}

/** Read the invoice number, the date and the total from extracted text. */
export function extractFields(text) {
  const fields = {};
  for (const [name, [labels, pattern, read]] of Object.entries(FIELDS)) {
    const raw = findAfterLabel(text, labels, pattern);
    fields[name] = raw === null ? null : read(raw);
  }
  return fields;
}
