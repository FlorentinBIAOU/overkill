/**
 * Parse an address with a self-hosted statistical parser.
 *
 * Rung N2. libpostal is a parser trained on tens of millions of addresses from
 * open worldwide data. It labels a token from its context, like N1, but its
 * training set is the planet: the German number that comes after the street,
 * the British postcode that is not five digits, the Japanese order that starts
 * with the prefecture. It runs on your machine, so no address ever leaves it.
 *
 * What you own on this rung is not the model. It is the batch, the size cap,
 * the mapping from its label set to yours, and the answer to "what does the
 * code do when the parser returns something we cannot use". The model is a
 * black box with a fixed list of labels and no confidence score, and the last
 * function below is where that becomes your problem.
 */

// A postal address is a short line. Anything longer is a paste, and feeding it
// to the parser only produces confident nonsense more slowly.
export const MAX_CHARACTERS = 300;

export const FIELDS = ['number', 'street', 'complement', 'postcode', 'city'];

// libpostal's label set is its own, and wider than ours. Two of its labels can
// land in one of our fields, and everything unmapped is dropped on purpose: an
// unmapped label that silently became a field would be a surprise in a letter.
const COMPONENTS = {
  house_number: 'number',
  road: 'street',
  unit: 'complement',
  level: 'complement',
  staircase: 'complement',
  entrance: 'complement',
  postcode: 'postcode',
  city: 'city',
};

export class ParsingUnavailable extends Error {}

/** The real parser: a native binding and its data files, loaded once. */
export class LibpostalParser {
  static async load() {
    const postal = await import('node-postal'); // a large local install
    return new LibpostalParser((address) => postal.parser.parse_address(address));
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
 * The whole batch goes in one call. Parsing addresses one by one is the usual
 * way this rung is made slow, because the model is loaded once and a batch of a
 * hundred is one pass through it.
 */
export async function parseAddresses(addresses, parser, { attempts = 2 } = {}) {
  const model = parser ?? (await LibpostalParser.load());
  const batch = [...addresses];
  for (const address of batch) {
    if (address.length > MAX_CHARACTERS) {
      throw new RangeError(`address longer than ${MAX_CHARACTERS} characters`);
    }
  }
  if (batch.length === 0) return [];

  const rows = await predict(model, batch, attempts);
  if (rows.length !== batch.length) {
    throw new ParsingUnavailable('the parser returned one row per address, and did not');
  }
  return rows.map(toFields);
}

/** Retry once: loading the data files is the call that fails, and once. */
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
  const fields = Object.fromEntries(FIELDS.map((name) => [name, '']));
  for (const [label, value] of Object.entries(row ?? {})) {
    const field = COMPONENTS[label];
    if (field && typeof value === 'string' && value.trim()) {
      fields[field] = `${fields[field]} ${value.trim()}`.trim();
    }
  }
  return fields;
}
