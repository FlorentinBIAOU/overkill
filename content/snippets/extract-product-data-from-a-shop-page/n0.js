/**
 * Read the product a shop page already publishes about itself.
 *
 * Rung N0. Almost every shop built on a commerce platform emits its product as
 * JSON-LD, in a `<script type="application/ld+json">` block, because search
 * engines ask for it. The name, the reference, the brand, the price, the
 * currency and the availability are already there, named by schema.org, typed,
 * and written by the shop itself. Reading them is parsing JSON.
 *
 * That is the whole of this rung, and it is why writing selectors — or sending
 * the page to a model — is the most documented piece of over-engineering in
 * web scraping: both go looking in the rendering for what the page states in
 * plain text a few lines above.
 *
 * Two things are refused rather than guessed. A page may carry several
 * products — the one it is about, and the carousel of related items — and
 * nothing in the format says which is which, so every one found is returned
 * and the caller chooses. And a price written « 1 234,56 » is not a number for
 * schema.org, which asks for a dot: rather than read it as one thousand or as
 * one, the price comes back as null with the raw text beside it.
 */

// schema.org writes availability as a URL, a bare name, or an http URL from
// before the site moved to https. All three mean the same thing.
const AVAILABILITY = /^(?:https?:\/\/schema\.org\/)?(\w+)$/;

// A price is a number with a dot, says schema.org. Anything else is text.
const PRICE = /^-?\d+(?:\.\d+)?$/;

/**
 * Every schema.org Product the page declares, in the order they appear.
 *
 * `source` says where the answer came from, so a caller that finds nothing
 * knows whether the page is silent or whether its JSON-LD is broken.
 *
 * @param {string} html
 */
export function readProducts(html) {
  if (typeof html !== 'string') {
    return { source: null, products: [], reason: `expected HTML, not ${kindOf(html)}` };
  }

  const nodes = [];
  let broken = 0;
  for (const block of blocks(html)) {
    try {
      nodes.push(...flatten(JSON.parse(block)));
    } catch {
      broken += 1;
    }
  }

  const products = nodes.filter(isProduct).map(product);
  if (products.length > 0) return { source: 'json-ld', products, reason: null };
  const reason = broken ? 'the JSON-LD on this page could not be parsed' : 'no JSON-LD product';
  return { source: null, products: [], reason };
}

/**
 * The JSON-LD script blocks, scanned rather than matched.
 *
 * A regular expression would do it in one line and would be a denial of
 * service on a page you did not write: « <script type="application/ld+json"> »
 * repeated twenty thousand times with no closing tag makes the engine retry
 * from every opening. This walks the string once.
 */
function blocks(html) {
  const found = [];
  const lower = html.toLowerCase();
  let cursor = 0;
  for (;;) {
    const start = lower.indexOf('<script', cursor);
    if (start < 0) return found;
    const opening = lower.indexOf('>', start);
    const closing = opening >= 0 ? lower.indexOf('</script', opening) : -1;
    if (opening < 0 || closing < 0) return found;
    if (lower.slice(start, opening).includes('application/ld+json')) {
      found.push(html.slice(opening + 1, closing));
    }
    cursor = closing + '</script'.length;
  }
}

/** Every node of the document: a graph, a list of blocks, or one object. */
function flatten(value, depth = 0) {
  if (depth > 8) return [];
  if (Array.isArray(value)) return value.flatMap((item) => flatten(item, depth + 1));
  if (typeof value !== 'object' || value === null) return [];
  const found = [value];
  for (const key of ['@graph', 'mainEntity', 'itemListElement', 'item']) {
    if (key in value) found.push(...flatten(value[key], depth + 1));
  }
  return found;
}

function isProduct(node) {
  const kinds = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
  return kinds.includes('Product');
}

function product(node) {
  const offers = flatten(node.offers);
  const offer = offers.length > 0 ? offers[0] : {};
  const rawPrice = offer.price;
  const price = rawPrice === undefined || rawPrice === null ? null : String(rawPrice);
  const brand = node.brand;
  const availability = offer.availability;
  const match = typeof availability === 'string' ? AVAILABILITY.exec(availability) : null;
  return {
    name: text(node.name),
    sku: text(node.sku),
    gtin: text(node.gtin ?? node.gtin13 ?? node.gtin8),
    brand: text(typeof brand === 'object' && brand !== null ? brand.name : brand),
    // null when the shop did not write a number, with the text it did write
    // beside it: a price read wrong is worse than a price not read.
    price: price !== null && PRICE.test(price) ? Number(price) : null,
    price_text: price,
    currency: text(offer.priceCurrency),
    availability: match ? match[1] : text(availability),
  };
}

const text = (value) => (typeof value === 'string' ? value.trim() : null);

const kindOf = (value) => (value === null ? 'null' : typeof value);
