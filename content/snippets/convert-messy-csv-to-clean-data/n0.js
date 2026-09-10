/**
 * Read a messy CSV: detect its dialect, normalise its encoding, coerce its
 * types, and write down every row it refuses.
 *
 * Rung N0. Node's standard library only, parser included.
 *
 * Three jobs, in that order, because each one needs the previous one done.
 * Bytes have to become text before a delimiter can be counted, and a delimiter
 * has to be known before a column can be typed.
 *
 * The third job is the point of the whole snippet. A cleaner that silently
 * drops the rows it does not understand is worse than no cleaner at all: it
 * hands back a tidy file and hides the part you needed to look at. Every
 * refusal here says which line, which column, and why.
 */

const DELIMITERS = [',', ';', '\t', '|'];
const SAMPLE_LINES = 20;

// ---------------------------------------------------------------------------
// 1. Encoding
// ---------------------------------------------------------------------------

const BOMS = [
  [[0xef, 0xbb, 0xbf], 'utf-8'],
  [[0xff, 0xfe], 'utf-16le'],
  [[0xfe, 0xff], 'utf-16be'],
];

// The five byte values cp1252 leaves undefined. Python's codec refuses them,
// so they are mapped to the replacement character here too: both versions of
// this snippet have to return the same text for the same bytes.
const UNDEFINED_IN_CP1252 = /[\u0081\u008d\u008f\u0090\u009d]/g;

/**
 * Turn bytes into text, guessing only when there is nothing else to go on.
 *
 * A byte order mark is a statement about the file, so it wins. Failing that,
 * strict UTF-8 either succeeds, and then it is almost certainly right, or
 * fails, and the file is one of the single-byte encodings a spreadsheet still
 * exports. cp1252 is by far the most common of those.
 *
 * UTF-32 is left out on purpose: no spreadsheet writes it, and pretending to
 * support an encoding you have never seen in a real file is how a cleaner
 * acquires code nobody can test.
 *
 * @param {Uint8Array} data
 * @returns {string}
 */
export function decodeText(data) {
  for (const [bom, encoding] of BOMS) {
    if (bom.every((byte, i) => data[i] === byte)) {
      // The decoder drops the mark itself, which is what we want.
      return new TextDecoder(encoding).decode(data);
    }
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(data);
  } catch {
    return new TextDecoder('windows-1252').decode(data).replace(UNDEFINED_IN_CP1252, '\ufffd');
  }
}

// ---------------------------------------------------------------------------
// 2. Dialect
// ---------------------------------------------------------------------------

/** Count delimiters that separate fields, not those sitting inside one. */
function countOutsideQuotes(line, delimiter, quote) {
  let count = 0;
  let inside = false;
  for (const char of line) {
    if (char === quote) inside = !inside;
    else if (char === delimiter && !inside) count += 1;
  }
  return count;
}

/**
 * Guess the delimiter first, then the quote character.
 *
 * In that order, and not the other way round: counting delimiters needs to
 * know what a quoted field looks like, but a quote character cannot be
 * recognised without a delimiter to anchor it against. So the count assumes
 * the usual double quote, and the quote character is then looked for with the
 * delimiter in hand.
 *
 * The candidate that wins is the one whose count is the same on the most
 * lines. A file separated by semicolons whose free-text column is full of
 * commas still lands on its feet, because the comma count varies from line to
 * line while the semicolon count does not.
 *
 * @returns {{delimiter: string, quote: string}}
 */
export function detectDialect(text) {
  const sample = text.split('\n').slice(0, SAMPLE_LINES).filter((line) => line.trim() !== '');
  let delimiter = ',';
  let best = [-1, -1];
  for (const candidate of DELIMITERS) {
    const counts = sample.map((line) => countOutsideQuotes(line, candidate, '"'));
    if (counts.length === 0 || counts[0] === 0) continue; // separates nothing
    const agree = counts.filter((c) => c === counts[0]).length / counts.length;
    const score = [agree, counts[0]];
    if (score[0] > best[0] || (score[0] === best[0] && score[1] > best[1])) {
      delimiter = candidate;
      best = score;
    }
  }

  // A quote character only counts when it opens a field: at the start of a
  // line, or straight after the delimiter.
  const opens = {};
  for (const quote of ['"', "'"]) {
    opens[quote] = sample.reduce(
      (total, line) => total + (line.startsWith(quote) ? 1 : 0) + (line.split(delimiter + quote).length - 1),
      0,
    );
  }
  return { delimiter, quote: opens["'"] > opens['"'] ? "'" : '"' };
}

// ---------------------------------------------------------------------------
// 3. The parser
// ---------------------------------------------------------------------------

/**
 * Read records, with the line each one starts on.
 *
 * Quoted fields, doubled quotes, delimiters and newlines inside a quoted
 * field: written out because a CSV parser is a thirty-line state machine, not
 * a dependency. A quote only opens a field at the start of one, which is what
 * lets `a"b` stay the three characters somebody actually typed.
 *
 * @returns {Array<[number, string[]]>}
 */
export function parseRecords(text, delimiter, quote) {
  const records = [];
  let fields = [];
  let field = '';
  let quoted = false;
  let atFieldStart = true;
  let line = 1;
  let start = 1;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === quote && text[i + 1] === quote) {
        field += quote; // a doubled quote is one literal quote
        i += 1;
      } else if (char === quote) {
        quoted = false;
      } else {
        if (char === '\n') line += 1;
        field += char;
      }
    } else if (char === quote && atFieldStart) {
      quoted = true;
      atFieldStart = false;
    } else if (char === delimiter) {
      fields.push(field);
      field = '';
      atFieldStart = true;
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      fields.push(field);
      records.push([start, fields]);
      fields = [];
      field = '';
      atFieldStart = true;
      line += 1;
      start = line;
    } else {
      field += char;
      atFieldStart = false;
    }
  }
  // A file that does not end with a newline still ends with a record.
  if (field !== '' || fields.length > 0) {
    fields.push(field);
    records.push([start, fields]);
  }
  return records;
}

// ---------------------------------------------------------------------------
// 4. Types, and the journal of what did not fit
// ---------------------------------------------------------------------------

const SPACES = /[\s\u00a0\u202f]/g;
const INTEGER = /^[+-]?\d+$/;
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_FIRST = /^(\d{2})[/.](\d{2})[/.](\d{4})$/;
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const TRUE_WORDS = new Set(['true', 'yes', 'y', '1', 'vrai', 'oui', 'o']);
const FALSE_WORDS = new Set(['false', 'no', 'n', '0', 'faux', 'non']);

function toInteger(raw) {
  const text = raw.replace(SPACES, '');
  if (!INTEGER.test(text)) throw new TypeError('not an integer');
  return Number(text);
}

/**
 * Accept the decimal marks a European spreadsheet actually writes.
 *
 * When a comma and a dot are both present, the last one is the decimal mark
 * and the other groups the thousands. When only a comma is present it is the
 * decimal mark, which is the convention across most of the continent.
 */
function toNumber(raw) {
  let text = raw.replace(SPACES, '');
  if (text.includes(',') && text.includes('.')) {
    const grouping = text.lastIndexOf('.') > text.lastIndexOf(',') ? ',' : '.';
    text = text.split(grouping).join('');
  }
  text = text.split(',').join('.');
  if (!NUMBER.test(text)) throw new TypeError('not a number');
  return Number(text);
}

function daysInMonth(year, month) {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return month === 2 && leap ? 29 : MONTH_LENGTHS[month - 1];
}

/** Return an ISO date, or refuse. Day-first is assumed outside ISO form. */
function toDate(raw) {
  const iso = ISO_DATE.exec(raw.trim());
  const dayFirst = DAY_FIRST.exec(raw.trim());
  if (!iso && !dayFirst) throw new TypeError('not a date');
  const [year, month, day] = iso ? iso.slice(1) : [dayFirst[3], dayFirst[2], dayFirst[1]];
  // Built-in date objects roll 31 February over to 2 March instead of refusing
  // it, so the calendar is checked by hand.
  const [y, m, d] = [year, month, day].map(Number);
  if (y < 1 || m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) {
    throw new TypeError('not a real date');
  }
  return `${year}-${month}-${day}`;
}

function toBoolean(raw) {
  const text = raw.trim().toLowerCase();
  if (TRUE_WORDS.has(text)) return true;
  if (FALSE_WORDS.has(text)) return false;
  throw new TypeError('not a true or false value');
}

export const COERCERS = {
  text: (raw) => raw.trim(),
  integer: toInteger,
  number: toNumber,
  date: toDate,
  boolean: toBoolean,
};

/** One value the schema refuses, carrying the column and the reason. */
export class Rejected extends Error {
  constructor(column, reason) {
    super(`${column}: ${reason}`);
    this.column = column;
    this.reason = reason;
  }
}

/**
 * Coerce one row, or refuse it at the first value that does not fit.
 *
 * First failure wins: a row is refused once, naming the column that caused it.
 * Whoever repairs the file then has one thing to look at rather than a list of
 * consequences.
 */
export function coerceRow(header, fields, schema) {
  const row = {};
  header.forEach((name, i) => {
    const value = (fields[i] ?? '').trim();
    const coerce = COERCERS[schema[name] ?? 'text'];
    if (!coerce) throw new Error(`unknown type ${schema[name]} for column ${name}`);
    // An empty cell is missing, not malformed.
    if (value === '') row[name] = null;
    else {
      try {
        row[name] = coerce(value);
      } catch (error) {
        throw new Rejected(name, error.message);
      }
    }
  });
  return row;
}

/**
 * Return the rows that survived, and a journal of everything refused.
 *
 * `data` is the raw bytes of the file and `schema` maps a column name to one
 * of the keys of COERCERS. A column absent from the schema is kept as text.
 *
 * The journal is the whole point. Each entry carries the line, the column and
 * the reason, plus the fields as they were read, so the refusal can be acted
 * on without opening the file again. Hand it back to whoever produced the
 * file, or to rung N3, which repairs those rows and only those.
 *
 * @param {Uint8Array} data
 * @param {Record<string,string>} schema
 */
export function cleanCsv(data, schema) {
  const text = decodeText(data);
  const { delimiter, quote } = detectDialect(text);

  let header = null;
  const rows = [];
  const rejects = [];
  for (const [line, fields] of parseRecords(text, delimiter, quote)) {
    // A blank line carries nothing, in any dialect.
    if (fields.length === 0 || (fields.length === 1 && fields[0] === '')) continue;
    if (header === null) {
      header = fields.map((name) => name.trim());
    } else if (fields.length !== header.length) {
      const plural = header.length === 1 ? '' : 's';
      const reason = `expected ${header.length} field${plural}, found ${fields.length}`;
      rejects.push({ line, column: '', reason, fields });
    } else {
      try {
        rows.push(coerceRow(header, fields, schema));
      } catch (refusal) {
        if (!(refusal instanceof Rejected)) throw refusal;
        rejects.push({ line, column: refusal.column, reason: refusal.reason, fields });
      }
    }
  }
  return { columns: header ?? [], delimiter, quote, rows, rejects };
}
