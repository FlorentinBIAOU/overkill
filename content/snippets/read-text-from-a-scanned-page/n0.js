/**
 * Read the text layer the document may already carry, before reaching for OCR.
 *
 * Rung N0. Standard library only: node:zlib to inflate the page streams, and
 * a reading of the text-showing operators inside them.
 *
 * Most « scanned pages » were never scanned. A PDF produced by an accounting
 * tool, a word processor or a print-to-PDF driver carries its text next to its
 * drawing instructions, already correct, with no recognition step and
 * therefore nothing to get wrong. Asking the question first is one function
 * call, and it answers the whole need whenever the answer is yes.
 *
 * The point is the question, not the extractor. When the answer is no, this
 * function says so — it does not hand back an empty string, which a caller
 * would read as « the page is blank ».
 */
import zlib from 'node:zlib';

// Under this many non-space characters, what was found is a stamp, a page
// number or a stray label, not a text layer. Raise it for dense documents.
export const MIN_CHARACTERS = 24;

const STREAM = /stream\r?\n([\s\S]*?)[\r\n]*endstream/g;
const PAGE = /\/Type\s*\/Page[^s]/g;

// Inside a content stream: a string being shown, or an operator that moves the
// cursor to another line. Kerning numbers inside a TJ array are skipped on
// purpose — they space glyphs, they do not carry characters.
const TOKEN = /\((?:\\[\s\S]|[^\\()])*\)|<[0-9A-Fa-f\s]*>|\bTd\b|\bTD\b|\bT\*|\bET\b/g;

const ESCAPES = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' };
const ESCAPE = /\\(?:([0-7]{1,3})|([\s\S]))/g;

/**
 * Say whether the document carries a text layer, and return it if it does.
 *
 * The answer is a report, not a string: `hasTextLayer` is the decision the
 * caller acts on, and `reason` is what to tell them when it is false.
 *
 * @param {Buffer|Uint8Array} pdfBytes
 * @param {{minCharacters?: number}} [options]
 */
export function readTextLayer(pdfBytes, { minCharacters = MIN_CHARACTERS } = {}) {
  // Latin-1 maps each byte to one character, so a regular expression can walk
  // the file without ever corrupting the compressed parts it steps over.
  const document = Buffer.from(pdfBytes).toString('latin1');

  const chunks = [];
  for (const [, stream] of document.matchAll(STREAM)) {
    const text = readStream(Buffer.from(stream, 'latin1'));
    if (text) chunks.push(text);
  }

  const text = chunks.join('\n');
  const characters = [...text].filter((c) => !/\s/.test(c)).length;
  const hasTextLayer = characters >= minCharacters;
  return {
    hasTextLayer,
    text,
    characters,
    pages: (document.match(PAGE) ?? []).length,
    reason: hasTextLayer ? null : 'no text layer: this page is an image, and needs OCR',
  };
}

/** Inflate the stream if it is compressed, then read what it shows. */
function readStream(raw) {
  let data;
  try {
    // Z_SYNC_FLUSH, because a stream may carry padding after the deflated
    // data, and a strict inflate would refuse it.
    data = zlib.inflateSync(raw, { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString('latin1');
  } catch {
    data = raw.toString('latin1'); // an uncompressed content stream is legal
  }

  const lines = [];
  let current = [];
  for (const [token] of data.matchAll(TOKEN)) {
    if (token.startsWith('(')) current.push(literal(token.slice(1, -1)));
    else if (token.startsWith('<')) current.push(hexString(token.slice(1, -1)));
    else if (current.length) {
      lines.push(current.join(''));
      current = [];
    }
  }
  if (current.length) lines.push(current.join(''));
  return lines.join('\n');
}

/**
 * A literal string: backslash escapes, and octal for everything else.
 *
 * The result stays in Latin-1, because a simple font encodes one byte per
 * character. A font with its own encoding table needs that table, which is
 * another job.
 */
function literal(body) {
  return body.replace(ESCAPE, (_, octal, char) =>
    octal ? String.fromCharCode(parseInt(octal, 8) & 0xff) : (ESCAPES[char] ?? char),
  );
}

/** A hex string, as PDF writers emit for anything beyond ASCII. */
function hexString(body) {
  let digits = body.replace(/\s/g, '');
  if (digits.length % 2) digits += '0'; // the spec pads a lone last digit with zero
  const raw = Buffer.from(digits, 'hex');
  if (raw[0] === 0xfe && raw[1] === 0xff) {
    return Buffer.from(raw.subarray(2)).swap16().toString('utf16le');
  }
  return raw.toString('latin1');
}
