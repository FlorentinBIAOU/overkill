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
 * strict UTF-8 either succeeds, and the file is read as UTF-8, or
 * fails, and the file is read as cp1252, the Windows single-byte encoding for
 * Western European languages. cp1252 and not Latin-1, which has no euro
 * sign: a price column would come back with a control character in it.
 *
 * UTF-32, and UTF-16 without a mark, are not decoded: they come out full of
 * NUL characters, and `cleanCsv` refuses such a file in its journal.
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
 * The sample is twenty physical lines, not twenty records, because the records
 * cannot be cut out before the dialect is known. A quoted field that holds line
 * breaks — an address, a comment — is therefore counted line by line: a file
 * made of such fields is judged on very few of its records.
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

  // A quote character only counts when it both opens fields (at the start of
  // a line, or straight after the delimiter) and closes them (straight before
  // the delimiter, or at the end of a line). A lone apostrophe in front of a
  // value opens and closes nothing.
  const occurrences = (line, part) => line.split(part).length - 1;
  const wraps = {};
  for (const quote of ['"', "'"]) {
    const lines = sample.map((line) => line.replace(/\r$/, ''));
    const opens = lines.reduce((n, line) => n + line.startsWith(quote) + occurrences(line, delimiter + quote), 0);
    const closes = lines.reduce((n, line) => n + line.endsWith(quote) + occurrences(line, quote + delimiter), 0);
    wraps[quote] = Math.min(opens, closes);
  }
  return { delimiter, quote: wraps["'"] > wraps['"'] ? "'" : '"' };
}

// ---------------------------------------------------------------------------
// 3. The parser
// ---------------------------------------------------------------------------

// The default field limit of Python's csv module, so that both versions of this
// snippet refuse the same fields.
const FIELD_LIMIT = 131072;
const LINE_BREAK = /\r\n|\r|\n/g;

/**
 * Read records, with the line each one starts on and the problem, if any.
 *
 * Quoted fields, doubled quotes, delimiters and newlines inside a quoted
 * field. A quote only opens a field at the start of one, which is what lets
 * `a"b` stay the three characters somebody actually typed.
 *
 * A record that cannot be read — a quote opened and never closed, text after a
 * closing quote, a field over the limit — is refused with the line it starts
 * on, and reading resumes on the next line. Without that, one quote opened and
 * never closed swallows the rest of the file into a single field.
 *
 * @returns {Array<[number, string[], string?]>} the problem only on a refused record
 */
export function parseRecords(text, delimiter, quote) {
  const records = [];
  let fields = [];
  let field = '';
  let quoted = false;
  let closed = false;
  let atFieldStart = true;
  let line = 1;
  let start = 1;
  let recordAt = 0;

  const begin = (at, lineNumber) => {
    [fields, field, quoted, closed, atFieldStart] = [[], '', false, false, true];
    [recordAt, line, start] = [at, lineNumber, lineNumber];
  };
  // Refuse the record being read, and return where reading resumes.
  const refuse = (problem) => {
    LINE_BREAK.lastIndex = recordAt;
    const found = LINE_BREAK.exec(text);
    const end = found ? found.index : text.length;
    records.push([start, [text.slice(recordAt, end)], problem]);
    begin(found ? end + found[0].length : text.length, start + 1);
    return recordAt;
  };

  for (let i = 0; i <= text.length; i += 1) {
    if (i === text.length) {
      if (!quoted) break;
      i = refuse('quote opened and never closed') - 1;
      continue;
    }
    const char = text[i];
    if (quoted) {
      if (char === quote && text[i + 1] === quote) {
        field += quote; // a doubled quote is one literal quote
        i += 1;
      } else if (char === quote) {
        quoted = false;
        closed = true;
      } else {
        if (char === '\n') line += 1;
        field += char;
      }
    } else if (closed && char !== delimiter && char !== '\n' && char !== '\r') {
      i = refuse('text after a closing quote') - 1;
      continue;
    } else if (char === quote && atFieldStart) {
      quoted = true;
      atFieldStart = false;
    } else if (char === delimiter) {
      fields.push(field);
      field = '';
      closed = false;
      atFieldStart = true;
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      fields.push(field);
      records.push([start, fields]);
      begin(i + 1, line + 1);
    } else {
      field += char;
      atFieldStart = false;
    }
    if (field.length > FIELD_LIMIT) {
      i = refuse(`field longer than ${FIELD_LIMIT} characters`) - 1;
    }
  }
  // A file that does not end with a newline still ends with a record.
  if (field !== '' || fields.length > 0 || closed) {
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
// '1,234': one mark, three digits after it, at most three before. Reads as a
// thousands group or as a decimal, and nothing in the value says which.
const GROUPED = /^[+-]?\d{1,3}[,.]\d{3}$/;
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const TRUE_WORDS = new Set(['true', 'yes', 'y', '1', 'vrai', 'oui', 'o']);
const FALSE_WORDS = new Set(['false', 'no', 'n', '0', 'faux', 'non']);

function toInteger(raw) {
  const text = raw.replace(SPACES, '');
  if (!INTEGER.test(text)) throw new TypeError('not an integer');
  // Past 2^53 a Number is rounded without a word: keep such an integer exact.
  const value = Number(text);
  return Number.isSafeInteger(value) ? value : BigInt(text);
}

/**
 * Read a number, and refuse rather than guess when the mark is ambiguous.
 *
 * `decimal` is the convention of the file, declared by the caller: ',' or '.'.
 * Three cases, in order:
 *
 * - both marks present, or the same mark twice: the shape settles it. The last
 *   mark of the two is the decimal one, a mark repeated only groups;
 * - one mark, followed by exactly three digits, with at most three before:
 *   '12,500' is 12.5 under one convention and 12500 under the other. Without
 *   `decimal`, the value goes to the journal rather than being divided by a
 *   thousand in silence;
 * - one mark that cannot group, because the digits do not fall in threes:
 *   '12,50' is 12.5 whoever wrote it.
 *
 * A mark that contradicts the declared convention is refused too: under
 * `decimal = '.'`, '12,50' is not a number, it is a file read with the wrong
 * convention.
 */
function toNumber(raw, decimal = null) {
  let text = raw.replace(SPACES, '');
  if (decimal !== null && decimal !== ',' && decimal !== '.') {
    throw new TypeError("decimal must be ',' or '.'");
  }
  const marks = [',', '.'].filter((mark) => text.includes(mark));
  const repeated = (mark) => text.indexOf(mark) !== text.lastIndexOf(mark);
  let point;
  if (marks.length === 2) {
    point = text.lastIndexOf(',') > text.lastIndexOf('.') ? ',' : '.';
  } else if (marks.length === 1 && repeated(marks[0])) {
    point = null; // repeated, so it groups thousands: '1,234,567'
  } else if (marks.length === 1 && GROUPED.test(text)) {
    if (decimal === null) {
      throw new TypeError("ambiguous decimal mark: declare decimal=',' or decimal='.'");
    }
    point = marks[0] === decimal ? marks[0] : null;
  } else {
    point = marks.length === 1 ? marks[0] : null;
  }
  if (decimal !== null && point !== null && point !== decimal) {
    throw new TypeError(`decimal mark is not the '${decimal}' declared for the file`);
  }
  for (const mark of [',', '.']) {
    if (mark !== point) text = text.split(mark).join('');
  }
  if (point) text = text.split(point).join('.');
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

// Every coercer takes the declared decimal mark, so that the signature does
// not depend on the type: only `toNumber` has anything to do with it.
export const COERCERS = {
  text: (raw) => raw.trim(),
  integer: (raw) => toInteger(raw),
  number: toNumber,
  date: (raw) => toDate(raw),
  boolean: (raw) => toBoolean(raw),
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
export function coerceRow(header, fields, schema, decimal = null) {
  const row = {};
  header.forEach((name, i) => {
    const value = (fields[i] ?? '').trim();
    const coerce = COERCERS[schema[name] ?? 'text'];
    if (!coerce) throw new Error(`unknown type ${schema[name]} for column ${name}`);
    // An empty cell is missing, not malformed.
    if (value === '') row[name] = null;
    else {
      try {
        row[name] = coerce(value, decimal);
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
 * `decimal` declares the decimal mark of the file, ',' or '.'; without it a
 * value that the two conventions read differently is refused to the journal.
 *
 * The journal is the whole point. Each entry carries the line, the column and
 * the reason, plus the fields as they were read, so the refusal can be acted
 * on without opening the file again. Hand it back to whoever produced the
 * file, or to rung N3, which repairs those rows and only those.
 *
 * @param {Uint8Array} data
 * @param {Record<string,string>} schema
 * @param {','|'.'|null} decimal  the decimal mark declared for the file
 */
export function cleanCsv(data, schema, decimal = null) {
  const text = decodeText(data);
  const { delimiter, quote } = detectDialect(text);
  if (text.includes('\0')) {
    const reason = 'NUL characters: UTF-16 without a byte order mark, or UTF-32, not read';
    return { columns: [], delimiter, quote, rows: [], rejects: [{ line: 1, column: '', reason, fields: [] }] };
  }

  let header = null;
  let twice = [];
  const rows = [];
  const rejects = [];
  for (const [line, fields, problem] of parseRecords(text, delimiter, quote)) {
    if (problem) {
      rejects.push({ line, column: '', reason: problem, fields });
      continue;
    }
    // A blank line carries nothing, in any dialect.
    if (fields.length === 0 || (fields.length === 1 && fields[0] === '')) continue;
    if (header === null) {
      header = fields.map((name) => name.trim());
      twice = [...new Set(header.filter((name, i) => header.indexOf(name) !== i))].sort();
    } else if (twice.length > 0) {
      // A row keyed by name would lose one of the two values.
      rejects.push({ line, column: twice[0], reason: 'column name used twice', fields });
    } else if (fields.length !== header.length) {
      const plural = header.length === 1 ? '' : 's';
      const reason = `expected ${header.length} field${plural}, found ${fields.length}`;
      rejects.push({ line, column: '', reason, fields });
    } else {
      try {
        rows.push(coerceRow(header, fields, schema, decimal));
      } catch (refusal) {
        if (!(refusal instanceof Rejected)) throw refusal;
        rejects.push({ line, column: refusal.column, reason: refusal.reason, fields });
      }
    }
  }
  return { columns: header ?? [], delimiter, quote, rows, rejects };
}
