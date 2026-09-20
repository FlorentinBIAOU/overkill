/**
 * Add up a column of a file, exactly, and say what was left out.
 *
 * Rung N0. Adding is what a computer did before it did anything else, so the
 * interesting part of this job is everywhere except the addition.
 *
 * It is in the arithmetic, first. A column of money added as floating-point
 * numbers drifts: this entry's test adds six ordinary amounts and shows the
 * answer is not the one the invoice prints. So nothing here becomes a float. A
 * value is read as the digits that were written, all the values are lined up
 * on the same number of decimals, and the sum is an integer addition — exact,
 * whatever the length of the column.
 *
 * It is in what is not a number, second. A real column has an empty cell, a
 * « n/a », a total line, a value with a currency symbol. Skipping them quietly
 * is how an average ends up being computed over eight hundred rows out of a
 * thousand without anyone noticing. Every value that could not be read comes
 * back with its row number and the reason.
 *
 * And it is in the average, which is the only result that can need rounding:
 * it is returned two decimals beyond the data, rounded away from zero, and
 * both the exact sum and the count come back so a caller can round otherwise.
 */

// What a number looks like in a file written for a program: a sign, digits,
// and at most one decimal separator. Grouping separators are not read here —
// the entry on extracting amounts from a text is where « 1 250,00 » is settled.
const NUMBER = /^[+-]?[0-9]+(?:[.,][0-9]+)?$/;

// The two decimal signs this rung knows. The caller declares one; a value that
// uses the other is not misread, it is refused and counted.
export const SIGNS = ['.', ','];

// How many decimals beyond the data's own the average is given with.
export const MEAN_EXTRA = 2;

/**
 * The count, the exact sum, the average and the bounds of a column.
 *
 * `values` is what a file gives: text, one item per row. Everything that is
 * not a number comes back in `skipped` rather than being passed over.
 */
export function aggregate(values, decimalSign = '.') {
  if (!SIGNS.includes(decimalSign)) {
    return report(null, [], `the decimal sign must be one of ${SIGNS.join(' ')}`);
  }
  if (!Array.isArray(values)) {
    // A text is iterable and is not a column: taken as one, it would be read
    // letter by letter.
    return report(null, [], 'expected a list of values');
  }

  const read = [];
  const skipped = [];
  let scale = 0;
  values.forEach((value, index) => {
    // A boolean is an integer in Python and is not one anywhere else: it is
    // refused on both sides rather than counted as 0 or 1.
    const numeric = typeof value === 'number' && Number.isFinite(value);
    const text = typeof value === 'string' ? value.trim() : (numeric ? String(value) : null);
    if (text === null || !NUMBER.test(text) || otherSign(text, decimalSign)) {
      skipped.push({ row: index, value, why: why(value, decimalSign) });
      return;
    }
    const [digits, places] = scaled(text, decimalSign);
    read.push([digits, places]);
    scale = Math.max(scale, places);
  });

  if (read.length === 0) {
    return report({
      count: 0, sum: null, mean: null, minimum: null, maximum: null, decimals: 0,
    }, skipped, null);
  }

  const aligned = read.map(([digits, places]) => digits * 10n ** BigInt(scale - places));
  const total = aligned.reduce((sum, item) => sum + item, 0n);
  const mean = halfAway(total * 10n ** BigInt(MEAN_EXTRA), BigInt(aligned.length));
  const least = aligned.reduce((low, item) => (item < low ? item : low));
  const most = aligned.reduce((high, item) => (item > high ? item : high));
  return report({
    count: aligned.length,
    sum: asText(total, scale),
    mean: asText(mean, scale + MEAN_EXTRA),
    minimum: asText(least, scale),
    maximum: asText(most, scale),
    decimals: scale,
  }, skipped, null);
}

/** The digits that were written, as an integer, and how many decimals. */
function scaled(text, sign) {
  const [whole, fraction = ''] = text.replace(sign, '.').split('.');
  return [BigInt(`${whole}${fraction}`), fraction.length];
}

function otherSign(text, sign) {
  return SIGNS.some((other) => other !== sign && text.includes(other));
}

function why(value, sign) {
  if (typeof value !== 'string' && !(typeof value === 'number' && Number.isFinite(value))) {
    return 'not text';
  }
  const text = String(value).trim();
  if (!text) return 'empty';
  if (otherSign(text, sign)) {
    const other = sign === SIGNS[1] ? SIGNS[0] : SIGNS[1];
    return `written with « ${other} » as the decimal sign`;
  }
  return 'not a number';
}

/** Rounded away from zero on a half, which is the rule stated in the docstring. */
function halfAway(numerator, denominator) {
  const sign = numerator < 0n ? -1n : 1n;
  const size = numerator < 0n ? -numerator : numerator;
  return sign * ((2n * size + denominator) / (2n * denominator));
}

/** The integer written back with its decimal point, and no float on the way. */
function asText(digits, places) {
  const sign = digits < 0n ? '-' : '';
  const body = (digits < 0n ? -digits : digits).toString().padStart(places + 1, '0');
  return places === 0 ? `${sign}${body}`
    : `${sign}${body.slice(0, -places)}.${body.slice(-places)}`;
}

function report(figures, skipped, reason) {
  return { figures, skipped, reason };
}
