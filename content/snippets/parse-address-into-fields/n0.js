/**
 * Parse a postal address into fields: regular expressions anchored on the
 * postcode.
 *
 * Rung N0. Deterministic, no dependency.
 *
 * Two things make this work.
 *
 * First, the postcode is the anchor. Five digits in a row cut a French address
 * in two: what comes before is the street line, what comes after is the town.
 * Recognising the town by its name would mean shipping a list of communes and
 * keeping it up to date.
 *
 * Second, the street type and the complement are read from dictionaries rather
 * than guessed, so the abbreviations people actually type — "av.", "bd", "bât",
 * "appt" — come out as one canonical spelling. The complement is the part the
 * postal standard puts on lines of its own, and a one-line form receives mixed
 * into the street; its keywords are a closed list, which is why a dictionary
 * settles it.
 *
 * What this does not do is check that the address exists. Splitting without
 * checking gives clean fields that can still be wrong: "8 rue des Lilas,
 * 75011 Lyon" splits perfectly and names no real place. The national geocoding
 * service is what answers that, and it is a separate step.
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

// The complement keywords of a French address, with the abbreviations people
// type. Trade knowledge again, and a closed list: the postal standard gives
// each of these a line of its own, and a one-line form gets them mixed into the
// street.
export const COMPLEMENTS = {
  bat: 'bâtiment', batt: 'bâtiment', batiment: 'bâtiment', immeuble: 'immeuble',
  esc: 'escalier', escalier: 'escalier',
  app: 'appartement', apt: 'appartement', appt: 'appartement', appartement: 'appartement',
  etage: 'étage', porte: 'porte', hall: 'hall', entree: 'entrée',
  res: 'résidence', residence: 'résidence', lotissement: 'lotissement',
  'lieu-dit': 'lieu-dit', lieudit: 'lieu-dit',
  bp: 'BP', cs: 'CS', tsa: 'TSA', cedex: 'CEDEX', chez: 'chez',
};

export const FIELDS = ['number', 'street_type', 'street', 'complement', 'postcode', 'city'];

// A house number or a range of them, and the repetition index that may follow:
// 8, 8-10, 8 bis, 12B. A lone letter counts only when it touches the number, so
// the "r" of "8 r des Lilas" stays a street type.
const HOUSE_NUMBER = /^(\d{1,4}(?:-\d{1,4})?)(?:\s*(bis|ter|quater)\b|([a-z])\b)?/i;

// A French postcode: five digits standing alone.
const POSTCODE = /\b\d{5}\b/g;

/** Reduce commas, line breaks, exotic spaces and byte order marks to a single plain space. */
export function normalise(text) {
  return text.normalize('NFKC').replaceAll(',', ' ').replace(/\s+/g, ' ').trim();
}

/** Lowercase, drop the accents and the trailing dot, for lookup only. */
export function fold(word) {
  return word.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\.+$/, '');
}

/** What follows a complement keyword: a number, a single letter, another keyword. */
function isDesignator(word) {
  return /^\d+$/.test(word) || /^\p{L}$/u.test(word) || fold(word) in COMPLEMENTS;
}

/**
 * Take the complement out of the street line, and return the two parts.
 *
 * Mid-line, a complement keyword opens a complement that runs to the end of the
 * line — "8 rue des Lilas Bât C Apt 12" — but only when it is followed by what a
 * complement is followed by: a number, a single letter, another keyword.
 * Without that condition "rue de la Porte Maillot" would lose half its name to
 * the word "Porte".
 *
 * At the start of the line, the complement closes where the street opens: the
 * first street type, and the house number in front of it if there is one.
 * "Résidence du Parc 3 rue de la Paix" cuts before the 3. With no street type at
 * all, the whole line is the complement: "Lieu-dit Les Granges".
 */
function cutComplement(words) {
  const opening = words.findIndex((word, i) => fold(word) in COMPLEMENTS
    && (i === 0 || i === words.length - 1 || isDesignator(words[i + 1])));
  if (opening === -1) return [words, []];
  if (opening > 0) return [words.slice(0, opening), words.slice(opening)];

  const street = words.findIndex((word, i) => i > 0 && fold(word) in STREET_TYPES);
  if (street === -1) return [[], words];
  const before = words[street - 1];
  const closing = street > 1 && /^\d{1,4}(?:-\d{1,4})?$/.test(before) ? street - 1 : street;
  return [words.slice(closing), words.slice(0, closing)];
}

/**
 * Split an address into number, street type, street, complement, postcode and
 * town.
 *
 * Every field is a string, empty when the address does not carry it. Returning
 * an empty string rather than nothing at all keeps the caller from having to
 * test each field before printing it.
 */
export function parse(address) {
  const fields = Object.fromEntries(FIELDS.map((name) => [name, '']));
  let text = normalise(address);

  // The anchor. Take the last run of five digits: in a French address the
  // postcode and the town close the address, so a five-digit number earlier in
  // the line is not taken for the postcode.
  const postcodes = [...text.matchAll(POSTCODE)];
  if (postcodes.length > 0) {
    const found = postcodes.at(-1);
    fields.postcode = found[0];
    fields.city = text.slice(found.index + found[0].length).trim();
    text = text.slice(0, found.index).trim();
  }

  const [line, complement] = cutComplement(text.split(' ').filter(Boolean));
  fields.complement = complement.join(' ');
  text = line.join(' ');

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
