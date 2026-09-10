/**
 * Read the header fields of an invoice from text that has already been
 * extracted: keyword anchors, then regular expressions.
 *
 * Rung N0. No model, no training set, no service. Two hours of work and you
 * can read every invoice from the supplier you wrote it for.
 *
 * The method is the one anybody reaches for: find the line carrying the label,
 * then read the value that follows it on that line. The labels are ordered
 * from the most specific to the least, because « Total TTC » and « Total HT »
 * are one word apart and the wrong one is a plausible number.
 *
 * That ordering is also where the approach ends. See the test.
 */

// French amounts: a comma before the decimals, a space or a dot every three
// digits. Requiring exactly three digits per group is what keeps the pattern
// from swallowing a quantity and a unit price as one number.
export const AMOUNT = /\d{1,3}(?:[\s.]\d{3})*[,.]\d{2}/;
const DATE = /\d{1,2}\/\d{1,2}\/\d{2,4}/;
const REFERENCE = /\b(?:[A-Za-z]{1,3}[-/])?\d[\dA-Za-z/-]{3,}/;

/** Turn a written amount into a number the caller can compute with. */
export function parseAmount(raw) {
  let cleaned = raw.replace(/[^\d,.]/g, '');
  // A comma means French spelling: the dots left are thousands separators.
  if (cleaned.includes(',')) cleaned = cleaned.replaceAll('.', '').replace(',', '.');
  return Number(cleaned);
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
  const lines = text.split('\n');
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
