/**
 * What a model call will cost, before making it, from figures you provide.
 *
 * Rung N0. A provider bills tokens, publishes a price per million of them, and
 * the arithmetic between the two is a multiplication. What makes this worth a
 * page is not the multiplication: it is everything this code refuses to guess.
 *
 * It never names a price. Prices change every quarter and differ per model,
 * per region and per contract; the two prices are parameters, and every amount
 * that comes back is in whatever unit you passed them in. A snippet that
 * carried a price would be wrong before it was read.
 *
 * It says whether the tokens were counted or estimated. Counting them needs
 * the tokeniser your provider uses; estimating them from a character count
 * needs a ratio, and a ratio is not a constant of nature — it depends on the
 * language, on the punctuation, on whether the text is prose or JSON. Both are
 * allowed here, and the report says which one was used, because an estimate
 * presented as a count is the failure this page exists to avoid.
 *
 * And it answers the question that decides: `break_even_items` is the number
 * of calls at which the bill reaches the one-off cost of the thing the call
 * would replace. That number, not the price per million, is what says whether
 * the call is worth making.
 */

// A price or a ratio as it is written: digits, optionally a decimal point.
// Nothing becomes a float here — money is counted in integers.
const NUMBER = /^[0-9]+(?:\.[0-9]+)?$/;

// The unit the published prices use. It is a parameter because it is a
// convention, not a law: some providers quote per thousand tokens.
export const PER = 1_000_000;

// How many decimals the amounts come back with, unless the prices carry more.
export const DECIMALS = 6;

/**
 * The tokens a job will use and what it will cost, in your own unit.
 *
 * `tokensIn` and `tokensOut` are either a whole number of tokens — counted
 * with your provider's tokeniser — or a pair `{characters,
 * characters_per_token}`, which is an estimate and is reported as one.
 */
export function estimateCost(items, tokensIn, tokensOut, priceIn, priceOut, options = {}) {
  const { per = PER, fixedAlternative = null, decimals = DECIMALS } = options;
  if (!Number.isInteger(items) || items < 0) {
    return report(null, null, null, 'items must be a whole number, zero or more');
  }
  const prices = {};
  for (const [name, price] of [['in', priceIn], ['out', priceOut]]) {
    const parsed = parseNumber(price);
    if (parsed === null) {
      return report(null, null, null, `the ${name} price must be written in digits`);
    }
    prices[name] = parsed;
  }
  if (!Number.isInteger(per) || per <= 0) {
    return report(null, null, null, 'the price unit must be a whole number of tokens');
  }

  const counts = {};
  const sources = [];
  for (const [name, value] of [['in', tokensIn], ['out', tokensOut]]) {
    const [count, source] = tokensOf(value);
    if (count === null) {
      return report(null, null, null, `the ${name} tokens are neither a count nor an estimate`);
    }
    counts[name] = count;
    sources.push(source);
  }

  const scale = Math.max(decimals, prices.in[1], prices.out[1]);
  const perItem = ['in', 'out']
    .reduce((sum, name) => sum + amountOf(counts[name], prices[name], per, scale), 0n);
  const total = perItem * BigInt(items);

  let breakEven = null;
  if (fixedAlternative !== null && fixedAlternative !== undefined) {
    const fixed = parseNumber(fixedAlternative);
    if (fixed === null) {
      return report(null, null, null, "the alternative's cost must be written in digits");
    }
    if (perItem > 0n) {
      const fixedScaled = fixed[0] * 10n ** BigInt(scale - fixed[1]);
      // The first call whose bill reaches the alternative's cost.
      breakEven = Number((fixedScaled + perItem - 1n) / perItem);
    }
  }

  const tokens = {
    in: counts.in,
    out: counts.out,
    total: counts.in + counts.out,
    source: sources[0] === sources[1] ? sources[0] : 'mixed',
  };
  const cost = { per_item: asText(perItem, scale), total: asText(total, scale), decimals: scale };
  return report(tokens, cost, breakEven, null);
}

/** A counted number of tokens, or an estimate from a number of characters. */
function tokensOf(value) {
  if (Number.isInteger(value) && value >= 0) return [value, 'counted'];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const characters = value.characters;
    // The key is spelled the same in both languages, so one report can be
    // compared with the other.
    const ratio = parseNumber(value.characters_per_token);
    if (Number.isInteger(characters) && characters >= 0 && ratio && ratio[0] > 0n) {
      // A part of a token is billed as a token: the estimate rounds up.
      const numerator = BigInt(characters) * 10n ** BigInt(ratio[1]);
      return [Number((numerator + ratio[0] - 1n) / ratio[0]), 'estimated'];
    }
  }
  return [null, null];
}

function amountOf(tokens, price, per, scale) {
  const [digits, places] = price;
  const numerator = BigInt(tokens) * digits * 10n ** BigInt(scale - places);
  const unit = BigInt(per);
  return (2n * numerator + unit) / (2n * unit); // rounded away from zero on a half
}

/** A written number as an integer and its number of decimals. */
function parseNumber(value) {
  if (Number.isInteger(value) && value >= 0) return [BigInt(value), 0];
  if (typeof value !== 'string' || !NUMBER.test(value.trim())) return null;
  const [whole, fraction = ''] = value.trim().split('.');
  return [BigInt(`${whole}${fraction}`), fraction.length];
}

function asText(digits, places) {
  const body = digits.toString().padStart(places + 1, '0');
  return places === 0 ? body : `${body.slice(0, -places)}.${body.slice(-places)}`;
}

function report(tokens, cost, breakEven, reason) {
  return { tokens, cost, break_even_items: breakEven, reason };
}
