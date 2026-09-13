/**
 * Parse a postal address into fields: regular expressions anchored on the
 * postcode.
 *
 * Rung N0. Deterministic, no dependency, and short enough to read in one
 * sitting.
 *
 * Two things make this work.
 *
 * First, the postcode is the anchor. Five digits in a row cut a French address
 * in two: what comes before is the street line, what comes after is the town.
 * Recognising the town by its name would mean shipping a list of communes and
 * keeping it up to date.
 *
 * Second, the street type is read from a dictionary rather than guessed, so the
 * abbreviations people actually type — "av.", "bd", "imp." — come out as
 * one canonical spelling.
 */

// The street types of a French address, with the abbreviations people type.
// This is trade knowledge, not example data, so it belongs in the snippet.
export const STREET_TYPES = {
  r: 'rue', rue: 'rue',
  av: 'avenue', ave: 'avenue', avenue: 'avenue',
  bd: 'boulevard', bld: 'boulevard', boul: 'boulevard', boulevard: 'boulevard',
  imp: 'impasse', impasse: 'impasse',
  all: 'allée', allee: 'allée',
  ch: 'chemin', chemin: 'chemin',
  pl: 'place', place: 'place',
  rte: 'route', route: 'route',
  quai: 'quai', cours: 'cours', crs: 'cours',
  sq: 'square', square: 'square',
  voie: 'voie', passage: 'passage', sentier: 'sentier',
  chaussee: 'chaussée', fbg: 'faubourg', faubourg: 'faubourg',
  cite: 'cité', villa: 'villa', esplanade: 'esplanade',
};

export const FIELDS = ['number', 'street_type', 'street', 'postcode', 'city'];

// A house number, and the repetition index that may follow it: 8, 8 bis, 12B.
const HOUSE_NUMBER = /^(\d{1,4})\s*(bis|ter|quater|[a-z])?\b/i;

// A French postcode: five digits standing alone.
const POSTCODE = /\b\d{5}\b/g;

/** Reduce commas, line breaks and exotic spaces to a single plain space. */
export function normalise(text) {
  return text.normalize('NFKC').replaceAll(',', ' ').replace(/\s+/g, ' ').trim();
}

/** Lowercase, drop the accents and the trailing dot, for lookup only. */
export function fold(word) {
  return word.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\.+$/, '');
}

/**
 * Split an address into number, street type, street, postcode and town.
 *
 * Every field is a string, empty when the address does not carry it. Returning
 * an empty string rather than nothing at all keeps the caller from having to
 * test each field before printing it.
 */
export function parse(address) {
  const fields = Object.fromEntries(FIELDS.map((name) => [name, '']));
  let text = normalise(address);

  // The anchor. Take the last postcode: a street name may carry a year, and a
  // town never comes before its postcode in the French convention.
  const postcodes = [...text.matchAll(POSTCODE)];
  if (postcodes.length > 0) {
    const found = postcodes.at(-1);
    fields.postcode = found[0];
    fields.city = text.slice(found.index + found[0].length).trim();
    text = text.slice(0, found.index).trim();
  }

  const number = HOUSE_NUMBER.exec(text);
  if (number) {
    fields.number = number.slice(1).filter(Boolean).join(' ');
    text = text.slice(number[0].length).trim();
  }

  const words = text.split(' ').filter(Boolean);
  if (words.length > 0) {
    const canonical = STREET_TYPES[fold(words[0])];
    if (canonical) {
      // Rewrite the abbreviation, so two spellings of one street compare equal
      // downstream.
      fields.street_type = canonical;
      words[0] = canonical;
    }
    fields.street = words.join(' ');
  }
  return fields;
}
