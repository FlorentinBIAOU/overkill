/**
 * The sample documents are built here, in the test, and never on disk outside
 * a temporary directory.
 *
 * Building them by hand is the point: a PDF that carries text and a PDF that
 * carries a photograph of the same text differ by a handful of bytes, and
 * those bytes are what this rung reads.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import zlib from 'node:zlib';
import { MIN_CHARACTERS, readTextLayer } from './n0.js';

// Eight rows of a grey ramp. Pixels, not characters: every byte is below 64,
// so nothing in here can be mistaken for a text operator once inflated.
const PIXELS = Buffer.from(Array.from({ length: 64 * 8 }, (_, i) => i % 64));

/**
 * What a scanner really puts in the picture: bytes already compressed by JPEG.
 *
 * They do not inflate, so they are read exactly as they lie. A quarter of a
 * megabyte of them is one page at a modest resolution, and there is no reason
 * at all why `BT`, a bracket and `Tj` should not all turn up in there by
 * chance. The same congruential generator is written in the Python test, so
 * both languages are handed the very same bytes.
 */
function photograph(length) {
  const bytes = Buffer.alloc(length + 4);
  bytes.set([0xff, 0xd8, 0xff, 0xe0]); // the marker that opens a JPEG
  let state = 1;
  for (let i = 0; i < length; i += 1) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    bytes[i + 4] = (state >>> 16) & 0xff;
  }
  return bytes;
}

const latin1 = (text) => Buffer.from(text, 'latin1');

/** Assemble a small but valid PDF whose single page draws `content`. */
function buildPdf(content, { compress = true, photo = null } = {}) {
  const stream = compress ? zlib.deflateSync(latin1(content)) : latin1(content);
  const flate = compress ? '/Filter /FlateDecode ' : '';
  const image = photo ?? zlib.deflateSync(PIXELS);
  const imageFilter = photo ? '/DCTDecode' : '/FlateDecode';
  const bodies = [
    latin1('<< /Type /Catalog /Pages 2 0 R >>'),
    latin1('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    latin1(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources ' +
        '<< /Font << /F1 5 0 R >> /XObject << /Im0 6 0 R >> >> /Contents 4 0 R >>',
    ),
    Buffer.concat([latin1(`<< ${flate}/Length ${stream.length} >>\nstream\n`), stream, latin1('\nendstream')]),
    latin1('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),
    Buffer.concat([
      latin1(
        '<< /Type /XObject /Subtype /Image /Width 64 /Height 8 /ColorSpace /DeviceGray ' +
          `/BitsPerComponent 8 /Filter ${imageFilter} /Length ${image.length} >>\nstream\n`,
      ),
      image,
      latin1('\nendstream'),
    ]),
  ];

  let out = latin1('%PDF-1.4\n');
  const offsets = [];
  bodies.forEach((body, index) => {
    offsets.push(out.length);
    out = Buffer.concat([out, latin1(`${index + 1} 0 obj\n`), body, latin1('\nendobj\n')]);
  });

  const start = out.length;
  let tail = `xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) tail += `${String(offset).padStart(10, '0')} 00000 n \n`;
  tail += `trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.concat([out, latin1(tail)]);
}

const TYPESET =
  'BT /F1 12 Tf 72 780 Td (Facture n\\370 2024-000431) Tj\n' +
  '0 -16 Td (\\311mise le 3 avril 2024) Tj\n' +
  '0 -16 Td [(Tot) -250 (al : 92,40 EUR)] TJ ET\n';

// What a scanner writes: one image, drawn to fill the page. No text at all.
const SCANNED = 'q 595 0 0 842 0 0 cm /Im0 Do Q\n';

// What a word processor writes: a subset font whose glyphs are renumbered from
// one, so the strings on the page are codes and not letters. The page carries
// its text; turning it back into letters needs the font's own table.
const GLYPH_CODES =
  'BT /F1 12 Tf 72 780 Td (\\001\\002\\003\\004\\005\\006\\007\\010\\016\\017\\020' +
  '\\021\\022\\023\\024\\025\\026\\027\\030\\031\\032\\033) Tj\n' +
  '0 -16 Td (\\001\\002\\003\\004\\005\\006\\007\\010\\016\\017\\020' +
  '\\021\\022\\023\\024\\025\\026\\027\\030\\031\\032\\033) Tj ET\n';

test('reads the text layer of a generated PDF', () => {
  const report = readTextLayer(buildPdf(TYPESET));
  assert.equal(report.hasTextLayer, true);
  assert.deepEqual(report.text.split('\n'), [
    'Facture n\xf8 2024-000431',
    '\xc9mise le 3 avril 2024',
    'Total : 92,40 EUR',
  ]);
  assert.equal(report.pages, 1);
  assert.equal(report.reason, null);
});

test('reads an uncompressed content stream', () => {
  assert.ok(readTextLayer(buildPdf(TYPESET, { compress: false })).text.includes('Facture'));
});

test('reads escapes and hex strings', () => {
  // Parentheses escaped, an octal byte, a hex string, and a hex string in
  // UTF-16 with its byte-order mark: four spellings one document may mix.
  const content =
    'BT /F1 12 Tf 72 700 Td (Facture \\(copie\\) \\340 relire) Tj\n' +
    '0 -14 Td <52656D69736520656E206D61696E> Tj\n' +
    '0 -14 Td <FEFF00520065006D006900730065002000E9> Tj ET\n';
  assert.deepEqual(readTextLayer(buildPdf(content)).text.split('\n'), [
    'Facture (copie) \xe0 relire',
    'Remise en main',
    'Remise é',
  ]);
});

test('reads a document written to a temporary directory', () => {
  // The only file this test suite writes, and it is removed straight after.
  const directory = mkdtempSync(join(tmpdir(), 'scanned-'));
  try {
    const path = join(directory, 'facture.pdf');
    writeFileSync(path, buildPdf(TYPESET));
    assert.equal(readTextLayer(readFileSync(path)).hasTextLayer, true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a stamped page number is not a text layer', () => {
  // A scanner that stamps the page number as real text leaves one character
  // of text on an image. Counting characters is what keeps that from passing
  // for a document that can be read without OCR.
  const report = readTextLayer(buildPdf('BT /F1 10 Tf 300 40 Td (3) Tj ET\n'));
  assert.equal(report.text, '3');
  assert.ok(report.characters < MIN_CHARACTERS);
  assert.equal(report.hasTextLayer, false);
});

test('bytes that are not a PDF do not throw', () => {
  const report = readTextLayer(Buffer.from('this is not a PDF at all'));
  assert.equal(report.hasTextLayer, false);
  assert.equal(report.pages, 0);
});

test('breaking point: a really scanned page has no text layer', () => {
  // The breaking point claimed on the entry: a page that was really scanned
  // carries no text layer, and no amount of parsing will invent one.
  //
  // The document below is valid, has one page, and that page is a photograph.
  // What matters is not that the extraction returns nothing — it is that the
  // function says why. An empty string would read as « this page is blank »,
  // and the caller would file an empty document instead of sending it to an
  // OCR engine.
  const report = readTextLayer(buildPdf(SCANNED));
  assert.equal(report.pages, 1);
  assert.equal(report.hasTextLayer, false);
  assert.equal(report.characters, 0);
  assert.match(report.reason, /OCR/);
});

test('breaking point: a scan whose picture is a JPEG holds just as well', () => {
  // The same claim on the document a scanner really produces. Its picture is
  // already compressed, so it does not inflate and is read byte for byte; a
  // quarter of a megabyte of such bytes holds `BT`, a bracket and `Tj` by
  // chance many times over.
  //
  // Which is why the streams a page does not draw text from are left alone. A
  // reader that walked all of them would report several thousand characters
  // here, and the caller would file a scanned page as already read.
  const report = readTextLayer(buildPdf(SCANNED, { photo: photograph(250_000) }));
  assert.equal(report.pages, 1);
  assert.equal(report.hasTextLayer, false);
  assert.equal(report.characters, 0);
  assert.match(report.reason, /OCR/);
});

test('a text layer this function cannot decode is not called readable', () => {
  // The other honest no, and the one that costs the most when it is got wrong.
  //
  // A word processor exports its text through a subset font whose glyphs are
  // renumbered from one. The page does carry its text, and this function does
  // not carry the table that turns those codes back into letters. Counting
  // them would report a readable page and hand back gibberish to index.
  //
  // So the answer is no, and the reason is not the OCR one: a recognition
  // engine is the wrong tool for a document that was never a picture.
  const report = readTextLayer(buildPdf(GLYPH_CODES));
  assert.equal(report.hasTextLayer, false);
  assert.equal(report.characters, 0);
  assert.match(report.reason, /font table/);
  assert.ok(!report.reason.includes('OCR'));
});
