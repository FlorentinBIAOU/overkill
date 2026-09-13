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
 *
 * Which is why there are two ways of saying no, and they call for two different
 * next steps. Nothing was shown at all: the page is a picture, and a recognition
 * engine is what comes next. Plenty was shown and none of it reads: the text is
 * there, behind a font table this file does not carry, and a recognition engine
 * would be the wrong answer entirely — that document was never a picture.
 */
import zlib from 'node:zlib';

// Under this many readable characters, what was found is a stamp, a page
// number or a stray label, not a text layer. Raise it for dense documents.
export const MIN_CHARACTERS = 24;

// A character that says something once decoded. A word processor subsets its
// fonts and renumbers their glyphs from one, so its strings come out of here as
// control codes: text in the document, and not text yet on this side. Counting
// those would report a readable page and hand the caller gibberish to index.
function readable(character) {
  const code = character.codePointAt(0);
  return code > 32 && code !== 127 && !(code >= 128 && code <= 159) && code !== 0xfffd;
}

const STREAM = /stream\r?\n([\s\S]*?)[\r\n]*endstream/g;
const PAGE = /\/Type\s*\/Page[^s]/g;

// How much of the declaration that introduces a stream is read to find out
// what the stream holds. A stream dictionary is short; three hundred characters
// reach the keys that matter.
const HEADER = 300;

// What that declaration says when the bytes are not page instructions: a
// picture, a font program, a colour profile, a bundle of objects, metadata.
// Skipping those is the difference between a scanned page that reports no text
// layer and one that reports several thousand characters of noise.
const NOT_CONTENT = new RegExp(
  [
    '/Subtype\\s*/(?:Image|Type1C|CIDFontType0C|OpenType)',
    '/(?:DCTDecode|JPXDecode|CCITTFaxDecode|JBIG2Decode|RunLengthDecode)',
    '/Type\\s*/(?:Metadata|ObjStm|XRef)',
    '/(?:Length1|Alternate|ColorSpace|BitsPerComponent)\\b',
  ].join('|'),
);

// A text object, from BT to ET. Nothing outside one shows a character, so
// nothing outside one is read. Belt and braces with the filter above: a
// photograph read as prose yields thousands of characters of noise, and the
// caller would file an unread document as read.
const TEXT_OBJECT = /\bBT\b([\s\S]*?)\bET\b/g;

// Inside a text object: a string, the operator that shows one, or an operator
// that moves the cursor to another line. Kerning numbers inside a TJ array are
// skipped on purpose — they space glyphs, they do not carry characters.
const TOKEN = /\((?:\\[\s\S]|[^\\()])*\)|<[0-9A-Fa-f\s]*>|\bTJ\b|\bTj\b|'|"|\bTd\b|\bTD\b|\bT\*/g;

// The four operators that put a string on the page. A string no operator shows
// is not text: it is a name, an argument, or a coincidence in a picture.
const SHOW = new Set(['TJ', 'Tj', "'", '"']);

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
  for (const match of document.matchAll(STREAM)) {
    const declaration = document.slice(Math.max(0, match.index - HEADER), match.index);
    if (NOT_CONTENT.test(declaration)) continue;
    const text = readStream(Buffer.from(match[1], 'latin1'));
    if (text) chunks.push(text);
  }

  const text = chunks.join('\n');
  const characters = [...text].filter(readable).length;
  const shown = [...text].filter((c) => !/\s/.test(c)).length;
  // Enough readable characters, and most of what was shown among them. A page
  // whose strings decode one character in ten has not been read, whatever the
  // count says, and calling that a text layer files an unread document.
  const hasTextLayer = characters >= minCharacters && characters * 2 >= shown;
  return {
    hasTextLayer,
    text,
    characters,
    pages: (document.match(PAGE) ?? []).length,
    reason: hasTextLayer ? null : reasonFor(shown, minCharacters),
  };
}

/**
 * Why the answer is no, which is the part the caller acts on.
 *
 * Two different noes, and they call for two different next steps. Nothing was
 * shown at all: the page is a picture, and it needs OCR. Plenty was shown and
 * none of it reads: the text is there, behind a font table this function does
 * not have, and OCR is the wrong answer — a full PDF library is the right one.
 */
function reasonFor(shown, minCharacters) {
  if (shown < minCharacters) return 'no text layer: this page is an image, and needs OCR';
  return 'a text layer encoded by a font table: this needs a full PDF library, not a scan';
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
  for (const [, body] of data.matchAll(TEXT_OBJECT)) {
    let current = [];
    let pending = [];
    for (const [token] of body.matchAll(TOKEN)) {
      if (token.startsWith('(')) pending.push(literal(token.slice(1, -1)));
      else if (token.startsWith('<')) pending.push(hexString(token.slice(1, -1)));
      else if (SHOW.has(token)) {
        current.push(...pending);
        pending = [];
      } else if (current.length) {
        lines.push(current.join(''));
        current = [];
        pending = [];
      }
    }
    if (current.length) lines.push(current.join(''));
  }
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
