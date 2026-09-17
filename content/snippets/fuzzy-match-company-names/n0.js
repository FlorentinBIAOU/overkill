/**
 * Match two company names: normalise, drop the legal form, then Jaro-Winkler.
 *
 * Rung N0. Deterministic, no dependency. Two decisions carry the whole
 * result.
 *
 * First, the legal form is removed rather than compared, and only where a legal
 * form is written: at the end of the name, or at the front for the forms French
 * filings put there. "Boulangerie Martin SARL" and "Boulangerie Martin SAS" are
 * one trading name under two statuses; leaving SARL and SAS inside the strings
 * would push them apart for a reason nobody cares about.
 *
 * Second, the abbreviations a company register is full of are expanded before
 * anything is compared: "Ets Martin" and "Établissements Martin" are the same
 * company, and "&" and "et" are the same word.
 *
 * Third, Jaro-Winkler rather than a plain edit distance. It rewards a shared
 * opening — which is a problem here, not a feature: a French company name opens
 * on its trade and differs at the tail, so two chemists of one town score higher
 * than a real pair. That is the breaking point of this rung, and the reason a
 * score above the threshold is a pair to read, never a merge.
 *
 * Written out in full rather than pulled from a package: the algorithm is
 * thirty lines, and that is the argument of this entry.
 */

// Legal forms, French and foreign. This is business knowledge, not example
// data. No "spa": it is also a word of trading names, and dropping it would
// merge "Nordic Spa" with "Nordic SA".
const LEGAL_FORMS = new Set(
  'sarl sas sasu sa eurl sci snc scop selarl gie ltd limited plc gmbh ag inc llc corp bv nv srl'.split(' '),
);

// The forms a French filing also writes in front of the name. "sa" is not among
// them: it is an article in Catalan and Corsican trading names, and dropping a
// leading one would merge "Sa Nostra" with "Nostra". Nor is "nv", for the same
// reason in "NV Energy".
const LEADING_FORMS = new Set('sarl sas sasu eurl sci snc scop selarl gie'.split(' '));

// What a company register writes short. Expanded before anything is compared,
// because "Ets Martin" and "Établissements Martin" are one company and Jaro
// scores them 0.68.
const ABBREVIATIONS = {
  ets: 'etablissements', etab: 'etablissements', etabs: 'etablissements',
  ste: 'societe', stes: 'societes', cie: 'compagnie',
};

// Winkler looks at the first four characters only, and gives back a tenth of
// the score Jaro withheld for each of them that both names share.
const PREFIX_LENGTH = 4;
const PREFIX_SCALING = 0.1;

/** Lowercase, expand the abbreviations, strip accents and punctuation, drop the legal form. */
export function normalise(name) {
  // Latin diacritics only. Dropping every combining mark would take the vowels
  // of Devanagari and Thai with it, and "कमल उद्योग" and "कोमल उद्योग" would score 1.0.
  const folded = name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/gu, '');
  // "&" is the same word as "et" in a company name, and punctuation is about to
  // be dropped, which would make the two spellings differ by one word.
  const plain = folded.replaceAll('&', ' et ');
  // Letters, digits and the marks that belong to them, in every script: a
  // Cyrillic, Japanese or Devanagari name is kept, not emptied into a string
  // that would match every other emptied name.
  const words = (plain.match(/[\p{L}\p{N}\p{M}]+/gu) ?? []).map((w) => ABBREVIATIONS[w] ?? w);
  let kept = [...words];
  if (kept.length > 1 && LEADING_FORMS.has(kept[0])) kept = kept.slice(1);
  while (kept.length > 1 && LEGAL_FORMS.has(kept.at(-1))) kept = kept.slice(0, -1);
  // A name made of nothing but a legal form keeps it. Emptying it would make
  // it match every other emptied name perfectly, which is worse than useless.
  return (kept.length ? kept : words).join(' ');
}

/**
 * Share of characters found on both sides, discounted by their disorder.
 *
 * A character counts as found only if its twin sits less than half the length
 * of the longer name away: at most that half, minus one. That window is what separates Jaro from a plain count of
 * common letters.
 */
function jaro(a, b) {
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
  const matchedA = a.filter((_, i) => hitA[i]);
  const matchedB = b.filter((_, j) => hitB[j]);
  const m = matchedA.length;
  if (!m) return 0;
  const swaps = Math.floor(matchedA.filter((c, i) => c !== matchedB[i]).length / 2);
  return (m / a.length + m / b.length + (m - swaps) / m) / 3;
}

/** Jaro, raised towards 1 in proportion to the shared opening. */
export function jaroWinkler(left, right) {
  // Code points, as Python counts them, not UTF-16 units.
  const [a, b] = [[...left], [...right]];
  const score = left === right ? 1 : jaro(a, b);
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
