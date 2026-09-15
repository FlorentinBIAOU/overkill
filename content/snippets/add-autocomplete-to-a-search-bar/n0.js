/**
 * Suggest as the user types: a prefix tree, ordered by how often a term is searched.
 *
 * Rung N0. No dependency, and the whole index is a nest of maps that fits in
 * the memory of the process serving the search bar.
 *
 * Two decisions carry the approach.
 *
 * First, the tree is keyed on a normalised spelling, accents folded and case
 * dropped, while each leaf keeps the original one. Someone typing "ec" finds
 * "écharpe", and still reads it spelled properly in the drop-down.
 *
 * Second, the ordering is a plain sort on the usage count, done once per node
 * and kept there. The empty bar reaches the whole index, a first letter a good
 * share of it, and every user asks for both: sorting them again at each
 * keystroke is where the time would go. The price is memory, at most one
 * reference per term for each node a keystroke has reached.
 */

// Marks the terms that end at a node. A character can never collide with it.
const END = Symbol('term');

// Where a node keeps its ranked terms once a keystroke has asked for them.
const RANKED = Symbol('ranked');

/**
 * Fold case and strip accents, so that "ec" reaches "écharpe".
 *
 * Invisible characters (zero-width space, byte order mark) are dropped, and
 * runs of spaces, non-breaking ones included, become one space with none at
 * either end: what gets pasted into a search bar carries all of these.
 */
export function normalise(text) {
  // Upper then lower case folds "ß" into "ss", the same way in both languages,
  // and the final sigma is folded by hand. \p{M} holds the accents NFKD
  // detaches, \p{Cf} the invisible characters; NFKD has already turned
  // non-breaking spaces into plain ones.
  const folded = text.normalize('NFKD').toUpperCase().toLowerCase().replace(/ς/g, 'σ');
  const kept = folded.replace(/[\p{M}\p{Cf}]/gu, '').replace(/[\t\n\v\f\r]/g, ' ');
  return kept.split(' ').filter(Boolean).join(' ');
}

/**
 * Build the tree from pairs of [term, how often it was searched].
 *
 * Terms sharing a normalised spelling are kept side by side at the same leaf,
 * rather than one silently replacing the other.
 */
export function build(entries) {
  const root = new Map();
  for (const [term, count] of entries) {
    const key = normalise(term);
    let node = root;
    for (const char of key) node = node.get(char) ?? node.set(char, new Map()).get(char);
    if (!node.has(END)) node.set(END, []);
    node.get(END).push([count, key, term]);
  }
  return root;
}

/**
 * Every [count, key, term] stored under a node, in no particular order.
 *
 * A stack rather than recursion: one term of a hundred thousand characters in
 * the search log would otherwise overflow the call stack.
 */
function collect(root) {
  const found = [];
  const stack = [root];
  while (stack.length > 0) {
    for (const [key, value] of stack.pop()) {
      if (key === END) for (const entry of value) found.push(entry);
      else if (key !== RANKED) stack.push(value);
    }
  }
  return found;
}

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The most searched terms starting with `prefix`, most searched first.
 *
 * An empty prefix returns the most searched terms overall, which is what an
 * empty search bar should offer. An unknown prefix returns nothing: the tree
 * answers about the characters it was given, not about the ones it guesses.
 */
export function suggest(root, prefix, limit = 5) {
  // Walk down to the node holding everything that starts with the prefix; an
  // unknown prefix walks into an empty node, which holds nothing to suggest.
  let node = root;
  for (const char of normalise(prefix)) node = node.get(char) ?? new Map();
  if (!node.has(RANKED)) {
    // Sorted once per node, then read back. Equal counts fall back to the
    // normalised spelling, so "écharpe" comes before "zèbre".
    const found = collect(node);
    found.sort((a, b) => b[0] - a[0] || compare(a[1], b[1]) || compare(a[2], b[2]));
    node.set(RANKED, found);
  }
  return node.get(RANKED).slice(0, limit).map(([, , term]) => term);
}
