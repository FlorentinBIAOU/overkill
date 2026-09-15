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
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import zlib from 'node:zlib';
import { MIN_CHARACTERS, readTextLayer } from './n0.js';

// Eight rows of a grey ramp. Pixels, not characters: every byte is below 64,
// so nothing in here can be mistaken for a text operator once inflated.
const PIXELS = Buffer.from(Array.from({ length: 64 * 8 }, (_, i) => i % 64));

/**
 * What a scanner really puts in the picture: bytes already compressed by JPEG.
 * The same congruential generator is written in the Python test, so both
 * languages are handed the very same bytes.
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
function buildPdf(content, { compress = true, photo = null, imageDict = null, trailer = '', extra = [] } = {}) {
  const raw = typeof content === 'string' ? latin1(content) : content;
  const stream = compress ? zlib.deflateSync(raw) : raw;
  const flate = compress ? '/Filter /FlateDecode ' : '';
  const image = photo ?? zlib.deflateSync(PIXELS);
  const imageFilter = photo ? '/DCTDecode' : '/FlateDecode';
  const declaration = imageDict ?? latin1(
    '<< /Type /XObject /Subtype /Image /Width 64 /Height 8 /ColorSpace /DeviceGray ' +
      `/BitsPerComponent 8 /Filter ${imageFilter} /Length ${image.length} >>`,
  );
  const bodies = [
    latin1('<< /Type /Catalog /Pages 2 0 R >>'),
    latin1('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    latin1(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources ' +
        '<< /Font << /F1 5 0 R >> /XObject << /Im0 6 0 R >> >> /Contents 4 0 R >>',
    ),
    Buffer.concat([latin1(`<< ${flate}/Length ${stream.length} >>\nstream\n`), stream, latin1('\nendstream')]),
    latin1('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),
    Buffer.concat([declaration, latin1('\nstream\n'), image, latin1('\nendstream')]),
    ...extra.map(latin1),
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
  tail += `trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R ${trailer}>>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.concat([out, latin1(tail)]);
}

const shownCodes = (codes) =>
  `BT /F1 12 Tf 72 780 Td (${codes.map((c) => `\\${c.toString(8).padStart(3, '0')}`).join('')}) Tj ET\n`;

/** Run the real n0.py on each document and return its reports, in this file's shape. */
function enPython(documents) {
  const racine = fileURLToPath(new URL('../../../', import.meta.url));
  const venv = `${racine}.venv-tools/bin/python`;
  const python = existsSync(venv) ? venv : 'python3';
  const script =
    'import sys, json, base64; sys.path.insert(0, sys.argv[1]); from n0 import read_text_layer; ' +
    'out = []\nfor b in json.load(sys.stdin):\n    r = read_text_layer(base64.b64decode(b))\n' +
    '    out.append({"hasTextLayer": r["has_text_layer"], "text": r["text"], "characters": r["characters"], ' +
    '"pages": r["pages"], "reason": r["reason"]})\njson.dump(out, sys.stdout)';
  const r = spawnSync(python, ['-c', script, fileURLToPath(new URL('.', import.meta.url))], {
    input: JSON.stringify(documents.map((d) => Buffer.from(d).toString('base64'))),
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

const TYPESET =
  'BT /F1 12 Tf 72 780 Td (Facture n\\370 2024-000431) Tj\n' +
  '0 -16 Td (\\311mise le 3 avril 2024) Tj\n' +
  '0 -16 Td [(Tot) -250 (al : 92,40 EUR)] TJ ET\n';

// What a scanner writes: one image, drawn to fill the page. No text at all.
const SCANNED = 'q 595 0 0 842 0 0 cm /Im0 Do Q\n';

// What a word processor writes: a subset font whose glyphs are renumbered from
// one, so the strings on the page are codes and not letters.
const GLYPH_CODES =
  'BT /F1 12 Tf 72 780 Td (\\001\\002\\003\\004\\005\\006\\007\\010\\016\\017\\020' +
  '\\021\\022\\023\\024\\025\\026\\027\\030\\031\\032\\033) Tj\n' +
  '0 -16 Td (\\001\\002\\003\\004\\005\\006\\007\\010\\016\\017\\020' +
  '\\021\\022\\023\\024\\025\\026\\027\\030\\031\\032\\033) Tj ET\n';

const PHOTO = photograph(250_000);

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : une page réellement scannée n’a pas de couche de texte', () => {
  const report = readTextLayer(buildPdf(SCANNED));
  assert.equal(report.pages, 1);
  assert.equal(report.hasTextLayer, false);
  assert.equal(report.characters, 0);
  assert.equal(report.reason, 'no text layer: this page is an image, and needs OCR');
  assert.deepEqual(Object.keys(report).sort(), ['characters', 'hasTextLayer', 'pages', 'reason', 'text']);
  assert.equal(readTextLayer(buildPdf(TYPESET)).hasTextLayer, true);
});

test('point de rupture : un scan dont l’image est un JPEG tient aussi', () => {
  const report = readTextLayer(buildPdf(SCANNED, { photo: PHOTO }));
  assert.equal(report.pages, 1);
  assert.equal(report.hasTextLayer, false);
  assert.equal(report.characters, 0);
  assert.match(report.reason, /OCR/);
});

test('point de rupture : le seuil range un numéro de page tamponné sous l’image', () => {
  const report = readTextLayer(buildPdf('BT /F1 10 Tf 300 40 Td (3) Tj ET\n'));
  assert.equal(report.text, '3');
  assert.equal(report.characters, 1);
  assert.ok(report.characters < MIN_CHARACTERS);
  assert.equal(report.hasTextLayer, false);
  assert.match(report.reason, /OCR/);
});

test('point de rupture : témoin, le seuil juste en dessous et juste au-dessus', () => {
  assert.equal(MIN_CHARACTERS, 24);
  assert.equal(readTextLayer(buildPdf(`BT (${'A'.repeat(23)}) Tj ET`)).hasTextLayer, false);
  assert.equal(readTextLayer(buildPdf(`BT (${'A'.repeat(24)}) Tj ET`)).hasTextLayer, true);
});

test('point de rupture : un export à police sous-ensemble compte zéro caractère et renvoie vers une bibliothèque PDF', () => {
  const report = readTextLayer(buildPdf(GLYPH_CODES));
  assert.equal(report.hasTextLayer, false);
  assert.equal(report.characters, 0);
  assert.equal(report.reason, 'a text layer encoded by a font table: this needs a full PDF library, not a scan');
  assert.ok(!report.reason.includes('OCR'));
});

test('un export à police sous-ensemble de quatre-vingts glyphes est refusé', () => {
  // Codes 1 à 80 : les codes 33 à 80 se lisent « ! » à « P », et la page passe pour lue.
  const codes = Array.from({ length: 400 }, (_, i) => ((i * 37) % 80) + 1);
  assert.equal(readTextLayer(buildPdf(shownCodes(codes))).hasTextLayer, false);
});

// ---------------------------------------------------------------------------
// Les autres affirmations du niveau
// ---------------------------------------------------------------------------

test('lit la couche de texte d’un PDF généré', () => {
  const report = readTextLayer(buildPdf(TYPESET));
  assert.equal(report.hasTextLayer, true);
  assert.deepEqual(report.text.split('\n'), ['Facture n\xf8 2024-000431', '\xc9mise le 3 avril 2024', 'Total : 92,40 EUR']);
  assert.equal(report.pages, 1);
  assert.equal(report.reason, null);
});

test('lit un flux de contenu non compressé', () => {
  assert.equal(readTextLayer(buildPdf(TYPESET, { compress: false })).text, readTextLayer(buildPdf(TYPESET)).text);
});

test('lit les échappements et les chaînes hexadécimales', () => {
  const content =
    'BT /F1 12 Tf 72 700 Td (Facture \\(copie\\) \\340 relire) Tj\n' +
    '0 -14 Td <52656D69736520656E206D61696E> Tj\n' +
    '0 -14 Td <FEFF00520065006D006900730065002000E9> Tj ET\n';
  assert.deepEqual(readTextLayer(buildPdf(content)).text.split('\n'), ['Facture (copie) \xe0 relire', 'Remise en main', 'Remise é']);
  assert.equal(readTextLayer(buildPdf('BT <41424> Tj ET')).text, 'AB@');
});

test('les nombres de crénage d’un tableau TJ ne portent aucun caractère', () => {
  assert.equal(readTextLayer(buildPdf('BT [(Fac) -120 (ture) 33 (s)] TJ ET')).text, 'Factures');
});

test('une chaîne qu’aucun opérateur ne montre n’est pas du texte', () => {
  // « /Span << /Lang (fr-FR) >> BDC (Facture) Tj » se lit « fr-FRFacture ».
  assert.equal(readTextLayer(buildPdf('BT /Span << /Lang (fr-FR) >> BDC (Facture) Tj EMC ET')).text, 'Facture');
});

test('une chaîne non montrée après une ligne montrée est écartée', () => {
  assert.equal(readTextLayer(buildPdf('BT (vue) Tj (jamais montre) Td (montre) Tj ET')).text, 'vue\nmontre');
});

test('rien hors d’un objet texte n’est lu', () => {
  assert.equal(readTextLayer(buildPdf('(hors objet) Tj BT (dedans) Tj ET (apres) Tj')).text, 'dedans');
});

test('une page dont un caractère sur dix se lit n’est pas lue', () => {
  assert.equal(readTextLayer(buildPdf(shownCodes([...Array(30).fill(65), ...Array(270).fill(1)]))).hasTextLayer, false);
  assert.equal(readTextLayer(buildPdf(shownCodes([...Array(30).fill(65), ...Array(30).fill(1)]))).hasTextLayer, true);
  assert.equal(readTextLayer(buildPdf(shownCodes([...Array(30).fill(65), ...Array(31).fill(1)]))).hasTextLayer, false);
});

test('les codes de contrôle 127 à 159 et le caractère de remplacement ne sont pas lisibles', () => {
  assert.equal(readTextLayer(buildPdf(shownCodes(Array(10).fill([127, 128, 150, 159]).flat()))).characters, 0);
  assert.equal(readTextLayer(buildPdf('BT <FEFFFFFD> Tj ET')).characters, 0);
});

test('seuil paramétrable pour les documents denses', () => {
  const doc = buildPdf(TYPESET);
  assert.equal(readTextLayer(doc, { minCharacters: 500 }).hasTextLayer, false);
  assert.equal(readTextLayer(doc, { minCharacters: 10 }).hasTextLayer, true);
});

test('Python et JavaScript rendent le même rapport', () => {
  const documents = [
    buildPdf(TYPESET), buildPdf(TYPESET, { compress: false }), buildPdf(SCANNED),
    buildPdf(SCANNED, { photo: PHOTO }), buildPdf(GLYPH_CODES),
    buildPdf('BT /F1 10 Tf 300 40 Td (3) Tj ET\n'), Buffer.alloc(0), Buffer.from('this is not a PDF at all'),
    buildPdf('BT <FEFF00520065006D006900730065002000E9> Tj ET'),
  ];
  assert.deepEqual(enPython(documents), documents.map((d) => readTextLayer(d)));
});

test('lit un document écrit dans un répertoire temporaire', () => {
  const directory = mkdtempSync(join(tmpdir(), 'scanned-'));
  try {
    const path = join(directory, 'facture.pdf');
    writeFileSync(path, buildPdf(TYPESET));
    assert.equal(readTextLayer(readFileSync(path)).hasTextLayer, true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('aucune dépendance hors de la bibliothèque standard', () => {
  const source = readFileSync(new URL('./n0.js', import.meta.url), 'utf8');
  assert.deepEqual([...source.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]), ['node:zlib']);
});

test('déterministe', () => {
  const doc = buildPdf(SCANNED, { photo: PHOTO });
  assert.deepEqual(readTextLayer(doc), readTextLayer(doc));
});

test('une page composée se lit en moins de dix millisecondes', () => {
  const doc = buildPdf(TYPESET);
  const debut = performance.now();
  for (let i = 0; i < 100; i += 1) readTextLayer(doc);
  assert.ok(performance.now() - debut < 1000);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : des octets qui ne sont pas un PDF ne lèvent pas', () => {
  const report = readTextLayer(Buffer.from('this is not a PDF at all'));
  assert.equal(report.hasTextLayer, false);
  assert.equal(report.pages, 0);
  assert.equal(readTextLayer(Buffer.alloc(0)).reason, 'no text layer: this page is an image, and needs OCR');
});

test('production : cent pages composées et un scan de vingt mégaoctets terminent vite', () => {
  let doc = '%PDF-1.4\n';
  for (let i = 0; i < 100; i += 1) doc += `${i} 0 obj\n<< /Type /Page >>\nendobj\n`;
  const flux = zlib.deflateSync(latin1(TYPESET));
  const parts = [latin1(doc)];
  for (let i = 0; i < 100; i += 1) parts.push(latin1('<< /Filter /FlateDecode >>\nstream\n'), flux, latin1('\nendstream\n'));
  const debut = performance.now();
  const report = readTextLayer(Buffer.concat(parts));
  assert.equal(report.pages, 100);
  assert.equal(report.text.split('Facture').length - 1, 100);
  assert.equal(readTextLayer(buildPdf(SCANNED, { photo: photograph(20_000_000) })).hasTextLayer, false);
  assert.ok(performance.now() - debut < 30_000);
});

test('production : UTF-16, NFD, emoji, insécable et BOM', () => {
  const texte = 'Facture\u00a0n° 2024 — cafe\u0301 🧾 \ufeffTotal : 92,40 €';
  const hexa = `FEFF${Buffer.from(texte, 'utf16le').swap16().toString('hex')}`;
  const report = readTextLayer(buildPdf(`BT <${hexa}> Tj ET`));
  assert.equal(report.text, texte);
  assert.equal(report.hasTextLayer, true);
});

test('un scan à palette de couleurs n’est pas déclaré lu', () => {
  // Dictionnaire d'image de plus de 300 octets : NOT_CONTENT ne voit plus
  // /Subtype /Image, les pixels sont lus, 24 778 caractères de bruit.
  const pixels = zlib.deflateSync(PHOTO);
  const palette = Buffer.from(Array.from({ length: 768 }, (_, i) => (i * 7) % 256)).toString('hex');
  const declaration = latin1(
    '<< /Type /XObject /Subtype /Image /Width 500 /Height 500 /BitsPerComponent 8 ' +
      `/Filter /FlateDecode /ColorSpace [/Indexed /DeviceRGB 255 <${palette}>] /Length ${pixels.length} >>`,
  );
  assert.equal(readTextLayer(buildPdf(SCANNED, { photo: pixels, imageDict: declaration })).hasTextLayer, false);
});

test('l’euro et l’apostrophe typographique d’une police WinAnsi sont lus', () => {
  // Décodés en Latin-1 : 0x80 et 0x92 ressortent en U+0080 et U+0092.
  assert.equal(readTextLayer(buildPdf('BT (Total : 92,40 \\200 \\222l\\222article) Tj ET')).text, 'Total : 92,40 € ’l’article');
});

test('un flux ASCII85 n’est pas renvoyé vers un OCR', () => {
  const zip = zlib.deflateSync(latin1(TYPESET));
  // ASCII85 d'Adobe, écrit ici faute de bibliothèque standard.
  let a85 = '<~';
  for (let i = 0; i < zip.length; i += 4) {
    const chunk = Buffer.alloc(4);
    zip.copy(chunk, 0, i, Math.min(i + 4, zip.length));
    const n = chunk.readUInt32BE(0);
    const size = Math.min(4, zip.length - i);
    if (n === 0 && size === 4) { a85 += 'z'; continue; }
    let v = n;
    const digits = [];
    for (let k = 0; k < 5; k += 1) { digits.unshift(String.fromCharCode(33 + (v % 85))); v = Math.floor(v / 85); }
    a85 += digits.slice(0, size + 1).join('');
  }
  a85 += '~>';
  const empty = zlib.deflateSync(Buffer.alloc(0));
  const base = buildPdf('');
  const oldPart = Buffer.concat([latin1(`<< /Filter /FlateDecode /Length ${empty.length} >>\nstream\n`), empty]);
  const at = base.indexOf(oldPart);
  assert.ok(at > 0);
  const doc = Buffer.concat([
    base.subarray(0, at),
    latin1(`<< /Filter [/ASCII85Decode /FlateDecode] /Length ${a85.length} >>\nstream\n${a85}`),
    base.subarray(at + oldPart.length),
  ]);
  assert.ok(!(readTextLayer(doc).reason ?? '').includes('OCR'));
});

test('un PDF chiffré n’est pas renvoyé vers un OCR', () => {
  const doc = buildPdf(photograph(400).subarray(4), {
    compress: false,
    trailer: '/Encrypt 7 0 R ',
    extra: ['<< /Filter /Standard /V 2 /R 3 /Length 128 /P -44 >>'],
  });
  assert.ok(!(readTextLayer(doc).reason ?? '').includes('OCR'));
});

test('des parenthèses équilibrées non échappées sont lues', () => {
  assert.equal(
    readTextLayer(buildPdf('BT (Facture (copie) numero 2024-000431 du 3 avril) Tj ET')).text,
    'Facture (copie) numero 2024-000431 du 3 avril',
  );
});

test('des pages rangées dans un flux d’objets sont comptées', () => {
  const objets = zlib.deflateSync(latin1('3 0 << /Type /Page /Parent 2 0 R /Contents 4 0 R >>'));
  const page = latin1(
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources ' +
      '<< /Font << /F1 5 0 R >> /XObject << /Im0 6 0 R >> >> /Contents 4 0 R >>',
  );
  const base = buildPdf(TYPESET);
  const at = base.indexOf(page);
  const doc = Buffer.concat([
    base.subarray(0, at),
    latin1(`<< /Type /ObjStm /N 1 /First 4 /Filter /FlateDecode /Length ${objets.length} >>\nstream\n`),
    objets,
    latin1('\nendstream'),
    base.subarray(at + page.length),
  ]);
  assert.equal(readTextLayer(doc).pages, 1);
});

test('un flux de BT sans ET ne fait pas exploser le temps', () => {
  // Temps quadratique : 80 000 « BT » prennent plusieurs secondes ici.
  const doc = buildPdf('BT '.repeat(80_000), { compress: false });
  const debut = performance.now();
  readTextLayer(doc);
  assert.ok(performance.now() - debut < 1000);
});

test('les deux langages donnent la même raison pour les codes 28 à 31', () => {
  // Python compte U+001C à U+001F comme des espaces, JavaScript non.
  const doc = buildPdf(shownCodes(Array(8).fill([28, 29, 30, 31]).flat()));
  assert.equal(enPython([doc])[0].reason, readTextLayer(doc).reason);
});

test('une chaîne UTF-16 impaire ne fait lever aucun des deux langages', () => {
  // Buffer.swap16 lève RangeError sur un nombre impair d'octets.
  assert.doesNotThrow(() => readTextLayer(buildPdf(`BT (${'A'.repeat(30)}) Tj <FEFF004100> Tj ET`)));
});
