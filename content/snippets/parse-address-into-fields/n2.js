/**
 * Parse an address with a self-hosted statistical parser.
 *
 * Rung N2. libpostal is a parser trained on over a billion addresses from every
 * inhabited country. It labels a token from its context, like N1, but where N1
 * knows the eighteen French addresses it was tagged on, libpostal's training
 * covers the conventions of other countries too. Whether it reads a given one
 * right, nothing here measures. It runs on your machine, so no address leaves
 * it.
 *
 * What you own on this rung is not the model. It is the batch, the size cap,
 * the mapping from its label set to yours, and the answer to "what does the
 * code do when the parser returns something we cannot use". The model is a
 * black box with a fixed list of labels and no confidence score, and the last
 * function below is where that becomes your problem.
 */

// A postal address is short: La Poste's rules allow six lines of 38 characters.
// Anything longer is not an address line, and is refused before parsing.
export const MAX_CHARACTERS = 300;

export const FIELDS = ['number', 'street', 'complement', 'postcode', 'city'];

// libpostal's label set is its own, and wider than ours. Five of its labels
// land in our complement, "house" among them: libpostal's name for a building
// or a venue, where a French residence name goes. Everything unmapped is dropped
// on purpose: an unmapped label that silently became a field would be a
// surprise in a letter.
const COMPONENTS = {
  house_number: 'number',
  road: 'street',
  house: 'complement',
  unit: 'complement',
  level: 'complement',
  staircase: 'complement',
  entrance: 'complement',
  postcode: 'postcode',
  city: 'city',
};

export class ParsingUnavailable extends Error {}

/** The real parser: a native binding and its data files, loaded once per process on import. */
export class LibpostalParser {
  static async load() {
    // node-postal is CommonJS: imported from a module, its exports sit under
    // `default`, and `parser` is not detected as a named export.
    const { parser } = (await import('node-postal')).default;
    return new LibpostalParser((address) => parser.parse_address(address));
  }

  constructor(parseAddress) {
    this.parseAddress = parseAddress;
  }

  /** One label-to-value mapping per address, in the order given. */
  async predict(addresses) {
    return addresses.map((address) => merge(this.parseAddress(address)));
  }
}

/** libpostal yields {component, value} pairs, and repeats a component freely. */
function merge(components) {
  const merged = {};
  for (const { component, value } of components) {
    merged[component] = `${merged[component] ?? ''} ${value}`.trim();
  }
  return merged;
}

/**
 * Parse a batch of addresses into fields.
 *
 * `parser` is injected so this can be tested without installing the model. In
 * production it defaults to the real one above.
 *
 * The whole batch goes to the parser object in one call, but libpostal has no
 * batching: `LibpostalParser.predict` parses the addresses one after the other.
 */
export async function parseAddresses(addresses, parser, { attempts = 2 } = {}) {
  const batch = [...addresses];
  for (const address of batch) {
    // Code points, as Python counts them: an emoji is one character, not two.
    if ([...address].length > MAX_CHARACTERS) {
      throw new RangeError(`address longer than ${MAX_CHARACTERS} characters`);
    }
  }
  if (batch.length === 0) return [];
  const model = parser ?? (await LibpostalParser.load());

  const rows = await predict(model, batch, attempts);
  if (rows.length !== batch.length) {
    throw new ParsingUnavailable('the parser returned one row per address, and did not');
  }
  return rows.map(toFields);
}

/**
 * Retry a failed parse once. Loading is not retried: a parser that cannot load
 * its data files fails before this point, with its own error.
 */
async function predict(parser, batch, attempts) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await parser.predict(batch);
    } catch (error) {
      lastError = error;
    }
  }
  throw new ParsingUnavailable(String(lastError));
}

/** Keep the labels we mapped, join those that share a field, drop the rest. */
function toFields(row) {
  if (row !== null && row !== undefined && (typeof row !== 'object' || Array.isArray(row))) {
    throw new ParsingUnavailable('the parser returned something other than a mapping');
  }
  const fields = Object.fromEntries(FIELDS.map((name) => [name, '']));
  for (const [label, value] of Object.entries(row ?? {})) {
    const field = COMPONENTS[label];
    if (field && typeof value === 'string' && value.trim()) {
      fields[field] = `${fields[field]} ${value.trim()}`.trim();
    }
  }
  return fields;
}
