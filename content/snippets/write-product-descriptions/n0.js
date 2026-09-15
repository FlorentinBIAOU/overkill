/**
 * Write a product description by filling slot templates.
 *
 * Rung N0. Deterministic, no dependency. A template is not the poor relation
 * of a model: it never claims a feature the product does not have, it renders
 * in the time it takes to read a dictionary, and every sentence it can
 * possibly produce was written and approved by a human being before it
 * shipped.
 *
 * Three things separate a template that survives a real catalogue from the one
 * everybody writes in ten minutes and throws away in a week.
 *
 * First, a missing attribute must not leave a hole in a sentence. Each block
 * of the description offers several wordings; only those whose slots are all
 * filled are eligible, and the ones using the most attributes are preferred. A
 * product with no colour list simply gets no colour sentence, instead of
 * « Disponible en . ».
 *
 * Second, agreement is not optional in a sales page. The markers `{un}`, `{e}`
 * and `{s}` carry the grammatical gender of the category noun and the number
 * of the enumerated list, so « Garantie deux ans » and « Points forts » come
 * out right without a second template per case.
 *
 * Third, an enumeration is written with commas and one conjunction at the end,
 * never dumped as a comma-separated list.
 *
 * What this cannot do is the subject of the breaking-point test next to it.
 */

// A slot in a wording: an attribute name, or one of the grammar markers.
const SLOT = /\{(\w+)\}/g;

// The description is built block by block, in this order. Inside a block, the
// wordings say the same thing with different attributes and different words:
// the ones that can be filled are kept, the most informative of those win, and
// the product draws one of them.
export const BLOCKS = [
  [ // What the product is.
    '{name} : {un} {category} en {material}, pensé{e} pour {audience}.',
    '{name}, {un} {category} en {material} pour {audience}.',
    '{name} : {un} {category} en {material}.',
    '{name}, {un} {category} en {material}.',
    '{name} : {un} {category} pour {audience}.',
    '{name} : {un} {category}.',
    '{name}, {un} {category}.',
  ],
  [ // What it brings.
    'Point{s} fort{s} : {features}.',
    'Au programme : {features}.',
    'Côté équipement : {features}.',
  ],
  [ // What there is to choose.
    'Disponible en {colours}.',
    'À choisir en {colours}.',
    'Existe en {colours}.',
  ],
  [ // What you are promised.
    'Garanti{e} {warranty}.',
    'La garantie court sur {warranty}.',
    'Livré{e} avec {warranty} de garantie.',
  ],
];

// The three markers above that carry grammar rather than an attribute value.
const GRAMMAR = ['un', 'e', 's'];

/**
 * Render the description of one product.
 *
 * `product` maps an attribute name to a string or to an array of strings. Only
 * the attributes actually present are used. `gender` holds the grammatical
 * gender of the category noun and defaults to masculine, which is the only
 * piece of grammar a product database never stores and a French sentence
 * always needs.
 *
 * @param {Record<string, string|string[]>} product
 * @param {{conjunction?: string}} [options]
 */
export function describe(product, { conjunction = 'et' } = {}) {
  const { values, plural } = slotsOf(product, conjunction);
  const feminine = String(product.gender ?? 'm').toLowerCase().startsWith('f');
  const sentences = [];
  for (const wordings of BLOCKS) {
    const usable = usableWordings(wordings, values);
    if (usable.length > 0) {
      const drawn = usable[variant(String(product.name ?? ''), usable.length)];
      sentences.push(fill(drawn, values, plural, feminine));
    }
  }
  return sentences.join(' ');
}

/**
 * The wordings that can be filled, and among those the most informative.
 *
 * A wording is dropped as soon as one of its slots has no value. Of those that
 * remain, only the ones using the most attributes are kept: an attribute the
 * shop took the trouble to fill in must not be left out because the draw fell
 * on a shorter sentence. Several wordings usually tie, and that tie is where
 * the variety of this rung lives.
 */
function usableWordings(wordings, values) {
  const scored = [];
  for (const wording of wordings) {
    const slots = slotsIn(wording).filter((slot) => !GRAMMAR.includes(slot));
    if (slots.every((slot) => Object.hasOwn(values, slot))) scored.push([slots.length, wording]);
  }
  const best = Math.max(0, ...scored.map(([count]) => count));
  return scored.filter(([count]) => count === best).map(([, wording]) => wording);
}

/** The slot names a wording asks for, in order. */
function slotsIn(wording) {
  return [...wording.matchAll(SLOT)].map((match) => match[1]);
}

/**
 * Attribute values as insertable text, and the names that are plural.
 *
 * A value of null, a NULL column, is an attribute the product does not have:
 * it must not reach a sentence as the word « null ».
 */
function slotsOf(product, conjunction) {
  const values = {};
  const plural = new Set();
  for (const [key, raw] of Object.entries(product)) {
    let value = raw;
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      const items = value.filter((item) => item !== null && item !== undefined).map((item) => String(item).trim()).filter(Boolean);
      if (items.length > 1) plural.add(key);
      value = enumerate(items, conjunction);
    }
    if (String(value).trim()) values[key] = String(value).trim();
  }
  return { values, plural };
}

/** « ardoise, sable et bronze » : commas, then the conjunction once. */
function enumerate(items, conjunction) {
  if (items.length < 2) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items.at(-1)}`;
}

/** Write the attributes and the grammar markers into one wording. */
function fill(wording, values, plural, feminine) {
  const slots = slotsIn(wording);
  // The grammar markers are written last, so an attribute called `s` or `e`
  // cannot quietly take their place.
  const filled = {
    ...values,
    un: feminine ? 'une' : 'un',
    e: feminine ? 'e' : '',
    s: slots.some((slot) => plural.has(slot)) ? 's' : '',
  };
  return wording.replace(SLOT, (_, slot) => filled[slot]);
}

/**
 * Draw one wording out of `count`, the same one for the same product.
 *
 * Summing the code points is deliberately crude. It has one job: give the same
 * answer as the Python version of this snippet, so a catalogue rendered by
 * either reads identically. The name is composed first (NFC), so an accent
 * typed as two code points draws the same wording as one.
 */
function variant(seed, count) {
  let total = 0;
  for (const char of seed.normalize('NFC')) total += char.codePointAt(0);
  return total % count;
}
