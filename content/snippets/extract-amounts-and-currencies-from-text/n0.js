/**
 * Find the amounts quoted in a text, with the currency written next to them.
 *
 * Rung N0. An amount in running text is a number with a mark beside it — a
 * symbol, an ISO 4217 code, or the word in the reader's language. That mark is
 * what tells an amount from the invoice number three words earlier, and
 * looking for the number without it is what makes an extractor return « 2026 »
 * as a total.
 *
 * The reference tool is `price-parser` in Python. It reads one price out of
 * one string, which is what a scraped price field is, and this entry's test
 * shows where that stops: on a French invoice line that carries a document
 * number, a date and a total, it returns the document number; and on a
 * document whose heading reads « Montants en euros » while the line quotes a
 * sum in dollars, it hands back the euro of the heading. In JavaScript nothing
 * maintained does even that much.
 *
 * The one thing a text cannot settle is the separator. « 1,859 » is a
 * thousands group under one convention and three decimals under the other, and
 * both are ordinary — a rounded sum on one side, a fuel price on the other. So
 * the caller declares the convention their documents are written in, and any
 * number whose reading depends on that declaration comes back marked
 * `ambiguous`. Nothing is guessed in silence, and nothing is turned into a
 * float on the way: the value is the digits that were written.
 */

// The decimal sign each convention uses. The caller declares one; there is no
// default, because a default is precisely the silent guess this entry exists
// to refuse.
export const CONVENTIONS = { fr: ',', en: '.' };

// What a currency mark can look like, and what it may stand for. A symbol that
// several currencies share is not resolved here: the candidates are returned.
export const SYMBOLS = {
  '€': ['EUR'],
  '£': ['GBP'],
  '₹': ['INR'],
  '¥': ['JPY', 'CNY'],
  $: ['USD', 'CAD', 'AUD', 'NZD', 'SGD', 'HKD'],
  kr: ['SEK', 'NOK', 'DKK'],
};
export const CODES = ['EUR', 'GBP', 'USD', 'CHF', 'JPY', 'CAD', 'AUD', 'CNY',
  'SEK', 'NOK', 'DKK', 'INR', 'PLN', 'CZK'];
export const WORDS = {
  euro: ['EUR'], euros: ['EUR'], 'livre sterling': ['GBP'], 'livres sterling': ['GBP'],
  pound: ['GBP'], pounds: ['GBP'], 'franc suisse': ['CHF'], 'francs suisses': ['CHF'],
  yen: ['JPY'], dollar: SYMBOLS.$, dollars: SYMBOLS.$,
};

// A number as it is written: groups separated by spaces, dots, commas or
// apostrophes. The shapes are checked afterwards, not here. The digits are
// written out rather than taken from « \\d », which matches every Unicode digit
// in Python and only the ten in JavaScript — and « ١٢٣ » is not a value this
// rung knows how to hand to an accountant.
const NUMBER = /[0-9][0-9 \u00a0\u202f.,']*[0-9]|[0-9]/g;

// A code or a word only counts when it stands on its own; a symbol always
// does. The lookarounds say « not touching a letter or a digit », written
// without \b so that the Python side can say exactly the same thing.
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const MARK = new RegExp([
  ...Object.keys(SYMBOLS).sort((a, b) => b.length - a.length).map(escape),
  ...[...CODES, ...Object.keys(WORDS).sort((a, b) => b.length - a.length)]
    .map((w) => `(?<![\\p{L}\\p{N}])${w}(?![\\p{L}\\p{N}])`),
].join('|'), 'giu');

const SPACES = /[\u00a0\u202f']/g;

// How far a mark may sit from its number: one space, or none. A mark further
// away belongs to something else — a heading, the sentence before.
const GAP = /^[ \u00a0\u202f]?$/;
const GAP_HEAD = /^[ \u00a0\u202f]?/;

/**
 * Every number in `text` that carries a currency mark, read exactly.
 *
 * `convention` is « fr » or « en » — the decimal sign the caller's documents
 * use. It is required: without it, a number written « 1,234 » has two readings
 * a thousand apart and the code would have to pick one alone.
 */
export function extractAmounts(text, convention) {
  if (typeof text !== 'string') {
    return { amounts: [], unmarked: 0, reason: `expected text, not ${typeof text}` };
  }
  if (!(convention in CONVENTIONS)) {
    const noms = Object.keys(CONVENTIONS).sort();
    return { amounts: [], unmarked: 0, reason: `declare a convention among [${noms.map((n) => `'${n}'`).join(', ')}]` };
  }

  const amounts = [];
  let unmarked = 0;
  for (const match of text.matchAll(NUMBER)) {
    const [codes, mark] = markBeside(text, match);
    if (codes === null) {
      // A number with no mark beside it. It may be an amount whose currency is
      // written once in a heading, and it may be a date or a reference;
      // counting them is all this rung can honestly say.
      unmarked += 1;
      continue;
    }
    const [value, ambiguous] = readNumber(match[0], convention);
    if (value === null) continue;
    amounts.push({
      text: match[0],
      value,
      mark,
      currency: codes.length === 1 ? codes[0] : null,
      currency_candidates: codes,
      ambiguous,
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return { amounts, unmarked, reason: null };
}

/** The currency mark touching this number, before it or after it. */
function markBeside(text, match) {
  const before = text.slice(Math.max(0, match.index - 24), match.index);
  for (const mark of before.matchAll(MARK)) {
    if (GAP.test(before.slice(mark.index + mark[0].length))) {
      return [codesOf(mark[0]), mark[0]];
    }
  }
  const end = match.index + match[0].length;
  const after = text.slice(end, end + 24);
  const head = GAP_HEAD.exec(after)[0].length;
  const mark = new RegExp(MARK.source, 'iu').exec(after.slice(head));
  if (mark && mark.index === 0) return [codesOf(mark[0]), mark[0]];
  return [null, null];
}

export function codesOf(mark) {
  const upper = mark.toUpperCase();
  if (CODES.includes(upper)) return [upper];
  return SYMBOLS[mark] ?? WORDS[mark.toLowerCase()];
}

/**
 * The digits that were written, as a decimal string, and whether the reading
 * depended on the declared convention.
 */
export function readNumber(raw, convention) {
  const decimalSign = CONVENTIONS[convention];
  const clean = raw.replace(SPACES, ' ');
  const kinds = new Set([...clean].filter((c) => ' .,'.includes(c)));
  if (kinds.size === 0) return [clean, false];

  const last = Math.max(...[...kinds].map((c) => clean.lastIndexOf(c)));
  const tail = clean.length - last - 1;
  const sign = clean[last];
  let decimal;
  let ambiguous = false;
  if (kinds.size > 1 || clean.split(sign).length - 1 > 1 || sign === ' ') {
    // Several kinds of separator, or the same one twice: the last one is the
    // decimal sign and the others group the thousands. A space never is a
    // decimal sign.
    decimal = sign !== ' ';
  } else if (tail !== 3) {
    // A thousands group is exactly three digits, always.
    decimal = true;
  } else {
    // « 1,234 » — three digits behind one separator. Only the convention the
    // caller declared can read this, and the caller is told.
    decimal = sign === decimalSign;
    ambiguous = true;
  }

  const parts = (decimal ? clean.slice(0, last) : clean).split(/[ .,]/);
  if (!parts[0] || (parts.length > 1
      && (parts[0].length > 3 || parts.slice(1).some((p) => p.length !== 3)))) {
    return [null, false]; // not a number: « 3, 4 », « 12 5 », « 1,2345,6 »
  }
  const whole = parts.join('');
  return [decimal ? `${whole}.${clean.slice(last + 1)}` : whole, ambiguous];
}
