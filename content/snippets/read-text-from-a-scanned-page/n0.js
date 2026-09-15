/**
 * Read the text layer the document may already carry, before reaching for OCR.
 *
 * Rung N0. Standard library only: node:zlib to inflate the page streams, and
 * a reading of the text-showing operators inside them.
 *
 * A PDF produced by an accounting tool, a word processor or a print-to-PDF
 * driver carries its text next to its drawing instructions, already correct,
 * with no recognition step and therefore nothing to get wrong. Asking the
 * question first is one function call, and it answers the whole need whenever
 * the answer is yes.
 *
 * The point is the question, not the extractor. When the answer is no, this
 * function says so — it does not hand back an empty string, which a caller
 * would read as « the page is blank ».
 *
 * Which is why a no comes with one of two next steps. Nothing was shown at all:
 * the page is a picture, and a recognition engine is what comes next. Text is
 * there and this file cannot decode it — a font with its own table, an
 * encrypted document, a filter other than Flate: a full PDF library is what
 * comes next, and a recognition engine would be the wrong answer, since that
 * document was never a picture.
 */
import zlib from 'node:zlib';

// Under this many readable characters, what was found is a stamp, a page
// number or a stray label, not a text layer. Raise it for dense documents.
export const MIN_CHARACTERS = 24;

const STREAM = /stream\r?\n([\s\S]*?)[\r\n]*endstream/g;
const PAGE = /\/Type\s*\/Page[^s]/g;
const OBJECT_STREAM = /\/Type\s*\/ObjStm/; // PDF 1.5 packs objects, pages included, in these
const ENCRYPTED = /\/Encrypt\b/;
const UNDECODED = /\/(?:LZWDecode|ASCII85Decode|ASCIIHexDecode|Crypt)\b/;

// What the declaration of a stream says when its bytes are not page
// instructions: a picture, a font program, a colour profile, metadata. The
// whole declaration is read, from its `obj` keyword on: an image with an inline
// colour palette runs to kilobytes before it says `/Subtype /Image`.
const NOT_CONTENT = new RegExp(
  [
    '/Subtype\\s*/(?:Image|Type1C|CIDFontType0C|OpenType)',
    '/(?:DCTDecode|JPXDecode|CCITTFaxDecode|JBIG2Decode|RunLengthDecode)',
    '/Type\\s*/(?:Metadata|XRef)',
    '/(?:Length1|Alternate|ColorSpace|BitsPerComponent)\\b',
  ].join('|'),
);

// A string (with one level of balanced parentheses, which the spec allows
// unescaped), a hex string, a name, or an operator. One pass, left to right.
const TOKEN = /\((?:\\[\s\S]|[^\\()]|\((?:\\[\s\S]|[^\\()])*\))*\)|<[0-9A-Fa-f \t\n\r\f\v]*>|\/[^ \t\n\r\f\v/<>[\]()]*|[A-Za-z]+\*?|['"]/g;

// The four operators that put a string on the page. A string any other
// operator takes is not text: a marked-content property, a name, an argument.
const SHOW = new Set(['TJ', 'Tj', "'", '"']);
const NEW_LINE = new Set(['Td', 'TD', 'T*', 'ET']);

const ESCAPES = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' };
const ESCAPE = /\\(?:([0-7]{1,3})|([\s\S]))/g;

// WinAnsiEncoding is Windows code page 1252 (PDF 32000-1, annex D), not
// Latin-1: from 127 to 159 it holds the euro sign and typographic quotes, and a
// bullet on every unused code.
const WIN_ANSI = '•€•‚ƒ„…†‡ˆ‰Š‹Œ•Ž••‘’“”•–—˜™š›œ•žŸ';
const winAnsi = (text) => text.replace(/[\x7f-\x9f]/g, (c) => WIN_ANSI[c.charCodeAt(0) - 127]);

// A code no named encoding of a simple font puts a glyph on (annex D). A word
// processor subsets its fonts and renumbers their glyphs from one, so its
// strings come out of here with codes below 32: one of them is enough to know
// the bytes are not letters yet, and counting the rest would hand the caller
// gibberish to index.
function isControl(character) {
  const code = character.codePointAt(0);
  return (code < 32 && !'\t\n\f\r'.includes(character)) || (code >= 127 && code <= 159);
}

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
  let previous = 0;
  let pages = (document.match(PAGE) ?? []).length;
  let locked = ENCRYPTED.test(document);
  for (const match of document.matchAll(STREAM)) {
    const between = document.slice(previous, match.index);
    const declaration = between.slice(Math.max(0, between.lastIndexOf('obj')));
    previous = match.index + match[0].length;
    if (OBJECT_STREAM.test(declaration)) pages += (inflate(match[1]).match(PAGE) ?? []).length;
    else if (NOT_CONTENT.test(declaration)) continue;
    else if (UNDECODED.test(declaration)) locked = true;
    else chunks.push(readStream(inflate(match[1])));
  }

  const text = chunks.filter(Boolean).join('\n');
  const all = [...text];
  const controls = all.some(isControl);
  const characters = all.filter((c) => c.codePointAt(0) > 32 && !isControl(c) && c !== '\ufffd').length;
  const hasTextLayer = characters >= minCharacters && !controls && !locked;
  return { hasTextLayer, text, characters, pages, reason: hasTextLayer ? null : reasonFor(locked, controls) };
}

/** Why the answer is no, which is the part the caller acts on. */
function reasonFor(locked, controls) {
  if (locked) return 'encrypted or encoded content this function cannot open: this needs a full PDF library, not a scan';
  if (controls) return 'a text layer encoded by a font table: this needs a full PDF library, not a scan';
  return 'no text layer: this page is an image, and needs OCR';
}

function inflate(raw) {
  try {
    // Z_SYNC_FLUSH, because a stream may carry padding after the deflated
    // data, and a strict inflate would refuse it.
    return zlib.inflateSync(Buffer.from(raw, 'latin1'), { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString('latin1');
  } catch {
    return raw; // an uncompressed content stream is legal
  }
}

/** Read what the text objects of a content stream show, line by line. */
function readStream(data) {
  const lines = [];
  let current = [];
  let pending = [];
  let inText = false;
  for (const [token] of data.matchAll(TOKEN)) {
    if (token === 'BT') {
      inText = true;
      current = [];
      pending = [];
    } else if (!inText || token.startsWith('/')) {
      continue; // nothing outside BT ... ET shows a character
    } else if (token.startsWith('(')) pending.push(literal(token.slice(1, -1)));
    else if (token.startsWith('<')) pending.push(hexString(token.slice(1, -1)));
    else if (SHOW.has(token)) {
      current.push(...pending);
      pending = [];
    } else {
      // Kerning numbers inside a TJ array are not tokens: they space glyphs.
      pending = [];
      if (NEW_LINE.has(token) && current.length) {
        lines.push(current.join(''));
        current = [];
      }
      inText = token !== 'ET';
    }
  }
  return lines.join('\n');
}

/** A literal string: backslash escapes, and octal for everything else. */
function literal(body) {
  const bytes = body.replace(ESCAPE, (_, octal, char) =>
    octal ? String.fromCharCode(parseInt(octal, 8) & 0xff) : (ESCAPES[char] ?? char),
  );
  return winAnsi(bytes);
}

/** A hex string, as PDF writers emit for anything beyond ASCII. */
function hexString(body) {
  let digits = body.replace(/[ \t\n\r\f\v]/g, '');
  if (digits.length % 2) digits += '0'; // the spec pads a lone last digit with zero
  const raw = Buffer.from(digits, 'hex');
  if (raw[0] === 0xfe && raw[1] === 0xff) {
    // An odd byte left over is a broken character, as Python's decoder says.
    const odd = raw.length % 2;
    const units = Buffer.from(raw.subarray(2, raw.length - odd)).swap16();
    return units.toString('utf16le') + (odd ? '\ufffd' : '');
  }
  return winAnsi(raw.toString('latin1'));
}
