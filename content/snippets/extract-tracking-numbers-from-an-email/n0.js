/**
 * The parcel references an email carries, and how far each one can be trusted.
 *
 * Rung N0. A tracking number is not free text: it is an identifier whose shape
 * a standard fixes, and the international one — UPU S10, used by every postal
 * operator and therefore by Colissimo and Chronopost — puts a check digit in
 * it. Two letters, eight digits, a check digit, two letters for the country:
 * the eleventh character is computed from the eight before it, and a number
 * with one digit wrong fails. That is the difference between finding a
 * candidate and identifying a reference.
 *
 * Everything else is shape. « 1Z » followed by sixteen characters is a UPS
 * number, and the prefix is distinctive enough to be worth returning; ten bare
 * digits is the shape of a DHL Express air waybill, and it is also the shape
 * of an order number, a customer number and a phone number without its leading
 * zero. Those families are declared and named, but they are not searched
 * unless the caller asks for them, because a rung that returns every
 * ten-digit number of an email as a parcel reference is worse than one that
 * returns nothing.
 *
 * What comes back therefore says three things: what was found, which family it
 * belongs to, and whether anything was actually verified. A candidate is never
 * handed back as an identification.
 */

// The service indicators the standard reserves: a valid S10 identifier never
// starts with one of them.
const RESERVED = new Set(['J', 'K', 'S', 'T', 'W']);

// The weighting factors of the S10 check digit, in the order of the serial
// number's eight digits.
export const WEIGHTS = [8, 6, 4, 2, 3, 5, 9, 7];

// Each family: what it looks like, who uses it, and whether anything in the
// number itself can be verified.
export const FAMILIES = {
  'upu-s10': {
    pattern: /(?<![0-9A-Za-z])([A-Z]{2})([0-9]{8})([0-9])([A-Z]{2})(?![0-9A-Za-z])/g,
    carriers: ['La Poste', 'Colissimo', 'Chronopost', 'postal operators'],
    verifiable: true,
  },
  ups: {
    pattern: /(?<![0-9A-Za-z])1Z[0-9A-Z]{16}(?![0-9A-Za-z])/g,
    carriers: ['UPS'],
    verifiable: false,
  },
  'ten-digits': {
    pattern: /(?<![0-9A-Za-z])[0-9]{10}(?![0-9A-Za-z])/g,
    carriers: ['DHL Express', 'and anything else written on ten digits'],
    verifiable: false,
  },
};

// The families searched when the caller does not say. The one left out is the
// one that matches an order number as readily as a parcel.
export const DEFAULT_FAMILIES = ['upu-s10', 'ups'];

/**
 * Every parcel reference candidate in `text`, with what could be verified.
 *
 * `families` is declared by the caller. Adding « ten-digits » finds DHL
 * Express numbers, and every other ten-digit number in the same message.
 */
export function findTrackingNumbers(text, families = DEFAULT_FAMILIES) {
  if (typeof text !== 'string') {
    return { found: [], reason: `expected text, not ${typeof text}` };
  }
  const unknown = [...families].filter((name) => !(name in FAMILIES));
  if (unknown.length) {
    return { found: [], reason: `unknown families: ${unknown.sort().join(', ')}` };
  }

  const found = [];
  for (const name of families) {
    const family = FAMILIES[name];
    for (const match of text.matchAll(family.pattern)) {
      const [checked, why] = verify(name, match);
      if (why === 'reserved') continue; // not an S10 identifier at all
      found.push({
        text: match[0],
        family: name,
        carriers: [...family.carriers],
        checked,
        why,
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }
  found.sort((a, b) => a.start - b.start
    || (a.family < b.family ? -1 : a.family > b.family ? 1 : 0));
  return { found, reason: null };
}

/** What the number itself proves, which is nothing outside S10. */
function verify(name, match) {
  if (name !== 'upu-s10') return [false, 'shape only: this family carries nothing to check'];
  const [, service, serial, digit] = match;
  if (RESERVED.has(service[0])) return [false, 'reserved'];
  if (checkDigit(serial) !== Number(digit)) {
    return [false, 'the check digit does not match the serial number'];
  }
  return [true, null];
}

/**
 * The S10 check digit of an eight-digit serial number.
 *
 * Weighted modulus 11, as the standard describes it: the weighted sum is
 * subtracted from eleven, 10 becomes 0 and 11 becomes 5.
 */
export function checkDigit(serial) {
  const total = [...serial].reduce((sum, figure, index) => sum + Number(figure) * WEIGHTS[index], 0);
  const remainder = 11 - (total % 11);
  return { 10: 0, 11: 5 }[remainder] ?? remainder;
}
