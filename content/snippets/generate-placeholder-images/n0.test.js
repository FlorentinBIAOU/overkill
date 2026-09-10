import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeholderSvg, stableHash } from './n0.js';

// The exact markup expected for one identifier. The same literal appears in
// n0.test.py: that is what pins the two implementations to each other, and it
// would break the moment either language rounded a colour differently.
const GOLDEN_MUG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"' +
  ' viewBox="0 0 60 60" role="img" aria-label="mug-106">' +
  '<rect width="60" height="60" fill="#dae8f0"/>' +
  '<rect x="24" y="12" width="12" height="12" fill="#317fa6"/>' +
  '<rect x="0" y="36" width="12" height="12" fill="#317fa6"/>' +
  '<rect x="48" y="36" width="12" height="12" fill="#317fa6"/>' +
  '<rect x="24" y="48" width="12" height="12" fill="#317fa6"/>' +
  '</svg>';

// Node ships no XML parser, so well-formedness is checked by shape: an opening
// svg element, then nothing but self-closed rects with quoted attributes.
const WELL_FORMED = /^<svg (?:[\w-]+(?::[\w-]+)?="[^"<>]*" ?)+>(?:<rect (?:[\w-]+="[^"<>]*" ?)+\/>)*<\/svg>$/;

test('produces the expected markup', () => {
  assert.equal(placeholderSvg('mug-106', 60), GOLDEN_MUG);
});

test('is deterministic and identifier dependent', () => {
  assert.equal(placeholderSvg('sku-4451'), placeholderSvg('sku-4451'));
  assert.notEqual(placeholderSvg('sku-4451'), placeholderSvg('sku-4452'));
});

test('the figure is symmetric', () => {
  // The mirrored pair of the third row, at x = 0 and x = 48 of a 60 pixel side.
  assert.ok(GOLDEN_MUG.includes('<rect x="0" y="36"'));
  assert.ok(GOLDEN_MUG.includes('<rect x="48" y="36"'));
});

test('the markup is well formed', () => {
  const svg = placeholderSvg('sku-4451');
  assert.match(svg, WELL_FORMED);
  assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.includes('role="img"'));
});

test('handles an empty identifier', () => {
  // A missing reference is exactly when a placeholder is needed, so an empty
  // identifier has to give an image rather than an exception.
  const svg = placeholderSvg('');
  assert.match(svg, WELL_FORMED);
  assert.ok(svg.includes('aria-label=""'));
});

test('handles accents and characters that are markup', () => {
  assert.ok(placeholderSvg('café-crème').includes('aria-label="café-crème"'));

  const escaped = placeholderSvg('chaise "Löw" & <co>');
  assert.ok(escaped.includes('aria-label="chaise &quot;Löw&quot; &amp; &lt;co&gt;"'));
  assert.match(escaped, WELL_FORMED);
});

test('carries no external dependency', () => {
  const svg = placeholderSvg('sku-4451');
  // The only URL in the output is the SVG namespace itself.
  assert.equal(svg.split('http').length - 1, 1);
  for (const forbidden of ['<image', 'href', 'url(', '@font-face', '<script']) {
    assert.ok(!svg.includes(forbidden), forbidden);
  }
});

test('a small size still gives whole pixels', () => {
  const svg = placeholderSvg('mug-106', 7);
  assert.ok(svg.includes('width="1"'));
  assert.match(svg, WELL_FORMED);
});

test('breaking point: a placeholder stays a placeholder', () => {
  // The breaking point claimed on the entry: the hash decides the image, the
  // meaning of the identifier never does. An identifier that says "red" does
  // not give red, two variants of one product look unrelated, and nothing in
  // the output resembles a photograph. If a real picture of the thing is
  // needed, no rung of this entry helps.
  const hue = (identifier) => (stableHash(identifier) >>> 16) % 360;

  // Red sits near 0 on the hue wheel. Naming it changes nothing.
  assert.ok(hue('red velvet sofa') >= 30 && hue('red velvet sofa') <= 330);

  // Two photographs of the same sofa would look alike. These do not.
  assert.ok(Math.abs(hue('sofa-1') - hue('sofa-2')) > 30);
  assert.notEqual(placeholderSvg('sofa-1'), placeholderSvg('sofa-2'));

  // Whatever the product, the whole image is flat rectangles in two colours.
  const svg = placeholderSvg('red velvet sofa');
  const fills = new Set(svg.split('fill="').slice(1).map((part) => part.split('"')[0]));
  assert.equal(fills.size, 2);
  assert.equal(svg.split('<').length - 1, svg.split('<rect').length - 1 + 2);
});
