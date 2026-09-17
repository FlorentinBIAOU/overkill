/**
 * Read an invoice: the structured file first, the page only if there is none.
 *
 * Rung N0. No model, no training set, no service.
 *
 * Since 1 September 2026 every business in France has to be able to receive
 * its invoices in a structured electronic format, through an approved
 * platform, and the minimum set of formats is UBL, CII and Factur-X, all
 * three carrying the European semantic standard EN 16931. That changes the
 * order of operations for this job: when the invoice arrives structured, its
 * fields are not extracted, they are read, and the answer is exact.
 * Extraction is for what is left — a supplier outside France, a till receipt,
 * an invoice from before the reform, the backlog.
 *
 * So this file has two doors and one rule: say which door the answer came
 * through. A number read from XML and a number read from a line of text are
 * not worth the same, and the caller has to be able to tell them apart.
 *
 * Getting the XML out of a Factur-X PDF is not this file's job: it is an
 * attached file inside the PDF, and any PDF library lists it. What arrives
 * here is the XML itself, or the text of a page.
 */
import { XMLParser } from 'fast-xml-parser';

// The five fields, named by their business term in EN 16931, then by the local
// name of the element and of its parent in each of the two syntaxes. One pair
// is enough to find them without carrying a page of namespace declarations.
const SUMMATION = 'SpecifiedTradeSettlementHeaderMonetarySummation';
const STRUCTURED = {
  // BT-1, BT-2: /rsm:ExchangedDocument/ram:ID and /ram:IssueDateTime/udt:DateTimeString
  invoice_number: [['ExchangedDocument', 'ID'], ['Invoice', 'ID']],
  date: [['IssueDateTime', 'DateTimeString'], ['Invoice', 'IssueDate']],
  // BT-109, BT-110, BT-112
  total_excluding_vat: [[SUMMATION, 'TaxBasisTotalAmount'], ['LegalMonetaryTotal', 'TaxExclusiveAmount']],
  vat: [[SUMMATION, 'TaxTotalAmount'], ['TaxTotal', 'TaxAmount']],
  total: [[SUMMATION, 'GrandTotalAmount'], ['LegalMonetaryTotal', 'TaxInclusiveAmount']],
};

export class UnreadableInvoice extends Error {}

// Namespaces dropped, attributes ignored, values left as written: an amount is
// read here and not by the parser.
const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: false,
  ignoreDeclaration: true,
});

/**
 * Read the fields of a UBL or CII invoice, and check the one sum EN 16931
 * makes a rule.
 *
 * That rule, BR-CO-15, is the cheapest guard there is against a reading that
 * is well-formed and wrong: total with VAT = total without VAT + VAT. It does
 * not apply to the extended profile, so a false `totals_agree` is a reason to
 * look, not a reason to reject.
 */
export function readStructured(xml) {
  const document = parser.parse(String(xml));
  const [rootName] = Object.keys(document);
  const syntax = rootName === 'CrossIndustryInvoice' ? 0 : 1;
  if (syntax === 1 && rootName !== 'Invoice') {
    throw new UnreadableInvoice(`neither CII nor UBL: ${rootName}`);
  }
  const values = new Map();
  collect(document, '', values);
  const fields = Object.fromEntries(
    Object.entries(STRUCTURED).map(([name, keys]) => [name, values.get(keys[syntax].join('/'))]),
  );
  if (fields.invoice_number === undefined) throw new UnreadableInvoice('no invoice number in the document');
  return {
    source: 'structured',
    invoice_number: fields.invoice_number,
    date: readDate(fields.date),
    total_excluding_vat: readAmount(fields.total_excluding_vat),
    vat: readAmount(fields.vat),
    total: readAmount(fields.total),
    totals_agree: totalsAgree(fields),
  };
}

/** Every (parent, child) pair of the tree, first one wins, as in Python. */
function collect(node, name, values) {
  for (const [child, value] of Object.entries(node)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== null && typeof first === 'object') collect(first, child, values);
    else if (!values.has(`${name}/${child}`)) values.set(`${name}/${child}`, String(first ?? '').trim());
  }
}

/** CII writes 20260915, UBL writes 2026-09-15; the caller gets one shape. */
function readDate(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  return digits.length >= 8 ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}` : null;
}

/** An amount in the two syntaxes is a decimal point and nothing else. */
function readAmount(raw) {
  const value = Number(raw);
  return raw === undefined || raw === '' || Number.isNaN(value) ? null : Math.round(value * 100) / 100;
}

/** Null when the invoice does not carry the three amounts the rule needs. */
function totalsAgree(fields) {
  const [without, vat, total] = ['total_excluding_vat', 'vat', 'total'].map((n) => readAmount(fields[n]));
  if (without === null || vat === null || total === null) return null;
  return Math.abs(without + vat - total) < 0.005;
}

// ---------------------------------------------------------------------------
// The other door: a page of text, for what the reform does not cover
// ---------------------------------------------------------------------------

// An amount, signed or not, with two decimals: "1 234,56" and "1.234,56" in French,
// "1,234.56" in English. Exactly three digits per group keeps "2 38,50" apart,
// a quantity then a price; "2 380,50" still reads as one number. At most four
// groups, up to the trillions, so that a long run of digit groups is read in
// linear time.
export const AMOUNT = /[-−]?(?<![\d.,])\d{1,3}(?:(?:[\s.]\d{3}){0,4},|(?:[\s,]\d{3}){0,4}\.)\d{2}(?![.,]?\d)/;
const DATE = /\d{1,2}\/\d{1,2}\/\d{2,4}/;
const REFERENCE = /\b(?:[A-Za-z]{1,3}[-/])?\d[\dA-Za-z/-]{3,}/;

/** Turn a written amount into a number the caller can compute with. */
export function parseAmount(raw) {
  // An AMOUNT match always ends on two decimals: whatever the separators, the
  // last two digits are the cents.
  const cents = Number(raw.replace(/\D/g, '')) / 100;
  return ['-', '−'].includes(raw.trimStart()[0]) ? -cents : cents;
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

/**
 * Read the invoice number, the date and the total from extracted text.
 *
 * Three fields, and no arithmetic to check them against: what the structured
 * door gets for nothing, this one cannot have.
 */
export function extractFields(text) {
  const fields = { source: 'text' };
  for (const [name, [labels, pattern, read]] of Object.entries(FIELDS)) {
    const raw = findAfterLabel(text, labels, pattern);
    fields[name] = raw === null ? null : read(raw);
  }
  return { ...fields, total_excluding_vat: null, vat: null, totals_agree: null };
}

/**
 * One invoice, whichever way it arrived, and the door it came through.
 *
 * `document` is the structured file when the platform delivered one — bytes of
 * UBL or CII, or the `factur-x.xml` your PDF library handed you — and the text
 * of the page when it did not. Nothing here decides that for you: the type of
 * what you pass in does.
 */
export function readInvoice(document) {
  if (typeof document !== 'string') return readStructured(new TextDecoder().decode(document));
  return extractFields(document);
}
