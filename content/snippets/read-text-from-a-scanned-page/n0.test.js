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

const latin1 = (text) => Buffer.from(text, 'latin1');

/** Assemble a small but valid PDF whose single page draws `content`. */
function buildPdf(content, { compress = true } = {}) {
  const stream = compress ? zlib.deflateSync(latin1(content)) : latin1(content);
  const flate = compress ? '/Filter /FlateDecode ' : '';
  const image = zlib.deflateSync(PIXELS);
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
          `/BitsPerComponent 8 /Filter /FlateDecode /Length ${image.length} >>\nstream\n`,
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
