/**
 * A placeholder image without a model: an SVG derived from a hash of the identifier.
 *
 * Rung N0. No file is written and no byte is downloaded: the function returns
 * a string of markup that a template can inline or a handler can serve.
 *
 * Two properties carry the whole approach.
 *
 * It is deterministic. The same identifier always yields exactly the same
 * image, on every machine, in every language, for ever. A placeholder that
 * changed on each render would flicker in a grid and defeat every HTTP cache.
 *
 * Its arithmetic is integer. Hue, chroma and cell positions are computed
 * without a single division that could round differently from one runtime to
 * another, which is what lets the JavaScript and the Python version agree
 * character for character.
 */

// FNV-1a, the same constants as the rest of the catalogue, so that identifiers
// hash identically wherever they are hashed.
const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;

const GRID = 5; // cells per side
const COLUMNS = 3; // independent columns; the remaining two mirror them

const ESCAPES = [['&', '&amp;'], ['<', '&lt;'], ['>', '&gt;'], ['"', '&quot;']];

/**
 * FNV-1a on 32 bits.
 *
 * Math.imul is what keeps it exact: a plain multiplication on numbers this
 * large loses precision past 2^53 and would silently drift away from the
 * integers Python computes.
 */
export function stableHash(text) {
  let digest = FNV_OFFSET;
  for (const char of text) {
    digest = Math.imul(digest ^ char.codePointAt(0), FNV_PRIME) >>> 0;
  }
  return digest;
}

/** HSL to hexadecimal, in integers only, all three arguments in percent. */
function hexColour(hue, saturation, lightness) {
  const chroma = Math.floor((255 * saturation * (100 - Math.abs(2 * lightness - 100))) / 10000);
  const edge = Math.floor((chroma * (60 - Math.abs((hue % 120) - 60))) / 60);
  const floor = Math.floor((255 * lightness) / 100) - Math.floor(chroma / 2);
  const wheel = [
    [chroma, edge, 0], [edge, chroma, 0], [0, chroma, edge],
    [0, edge, chroma], [edge, 0, chroma], [chroma, 0, edge],
  ];
  const channels = wheel[Math.floor(hue / 60) % 6];
  return `#${channels.map((v) => (v + floor).toString(16).padStart(2, '0')).join('')}`;
}

/** The identifier ends up inside an attribute, so it is markup until escaped. */
function escape(text) {
  let out = text;
  for (const [character, entity] of ESCAPES) out = out.split(character).join(entity);
  return out;
}

/**
 * Build a symmetric two-tone figure on a tinted ground.
 *
 * The high bits of the hash choose the hue, the low ones switch cells on and
 * off. Mirroring the left columns onto the right ones costs one line and is
 * what makes the result read as a mark rather than as noise.
 */
export function placeholderSvg(identifier, size = 240) {
  const digest = stableHash(identifier);
  const hue = (digest >>> 16) % 360;
  const cell = Math.floor(size / GRID);
  const margin = Math.floor((size - cell * GRID) / 2);

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"` +
      ` viewBox="0 0 ${size} ${size}" role="img" aria-label="${escape(identifier)}">`,
    `<rect width="${size}" height="${size}" fill="${hexColour(hue, 45, 90)}"/>`,
  ];
  const ink = hexColour(hue, 55, 42);
  for (let row = 0; row < GRID; row += 1) {
    for (let column = 0; column < GRID; column += 1) {
      const mirrored = Math.min(column, GRID - 1 - column);
      if (!((digest >>> (row * COLUMNS + mirrored)) & 1)) continue;
      const x = margin + column * cell;
      const y = margin + row * cell;
      parts.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${ink}"/>`);
    }
  }
  parts.push('</svg>');
  return parts.join('');
}
