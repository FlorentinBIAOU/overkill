/**
 * Match two company names: normalise, drop the legal form, then Jaro-Winkler.
 *
 * Rung N0. Deterministic, no dependency, and short enough to read in one
 * sitting. Two decisions carry the whole result.
 *
 * First, the legal form is removed rather than compared. "Boulangerie Martin
 * SARL" and "Boulangerie Martin SAS" are one trading name under two
 * statuses; leaving SARL and SAS inside the strings would push them apart for
 * a reason nobody cares about.
 *
 * Second, Jaro-Winkler rather than a plain edit distance. It rewards a shared
 * opening, which is how company names actually vary: the head is the brand,
 * the tail is a form, a city or a scrap of punctuation.
 *
 * Written out in full rather than pulled from a package: the algorithm is
 * thirty lines, and that is the argument of this entry.
 */

// Legal forms, French and foreign. This is business knowledge, not example
// data: every real matching job carries a list like this one, and grows it.
const LEGAL_FORMS = new Set(
  'sarl sas sasu sa eurl sci snc ltd limited plc gmbh ag inc llc corp bv nv spa srl'.split(' '),
);

// Winkler looks at the first four characters only, and never gives back more
// than a tenth of the score Jaro withheld.
const PREFIX_LENGTH = 4;
const PREFIX_SCALING = 0.1;

/** Lowercase, strip accents and punctuation, drop the legal form. */
export function normalise(name) {
  const plain = name.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '');
  const words = plain.match(/[a-z0-9]+/g) ?? [];
  const kept = words.filter((w) => !LEGAL_FORMS.has(w));
  // A name made of nothing but a legal form keeps it. Emptying it would make
  // it match every other emptied name perfectly, which is worse than useless.
  return (kept.length ? kept : words).join(' ');
}

/**
 * Share of characters found on both sides, discounted by their disorder.
 *
 * A character counts as found only if its twin sits within half the length of
 * the longer name. That window is what separates Jaro from a plain count of
 * common letters.
 */
function jaro(a, b) {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const window = Math.max(Math.floor(Math.max(a.length, b.length) / 2) - 1, 0);
  const hitA = new Array(a.length).fill(false);
  const hitB = new Array(b.length).fill(false);
  for (let i = 0; i < a.length; i += 1) {
    for (let j = Math.max(0, i - window); j < Math.min(b.length, i + window + 1); j += 1) {
      if (!hitB[j] && b[j] === a[i]) {
        hitA[i] = true;
        hitB[j] = true;
        break;
      }
    }
  }
  const matchedA = [...a].filter((_, i) => hitA[i]);
  const matchedB = [...b].filter((_, j) => hitB[j]);
  const m = matchedA.length;
  if (!m) return 0;
  const swaps = Math.floor(matchedA.filter((c, i) => c !== matchedB[i]).length / 2);
  return (m / a.length + m / b.length + (m - swaps) / m) / 3;
}

/** Jaro, raised towards 1 in proportion to the shared opening. */
export function jaroWinkler(a, b) {
  const score = jaro(a, b);
  let prefix = 0;
  while (prefix < PREFIX_LENGTH && prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) {
    prefix += 1;
  }
  return score + prefix * PREFIX_SCALING * (1 - score);
}

/** Similarity of two company names, from 0 to 1. */
export function similarity(left, right) {
  return jaroWinkler(normalise(left), normalise(right));
}
