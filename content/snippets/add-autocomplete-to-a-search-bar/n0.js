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
 * Second, the ordering is a plain sort on the usage count. Suggesting is not
 * retrieving: ten candidates under a prefix is a common case, and sorting ten
 * items at every keystroke costs nothing worth optimising.
 */

// Marks the terms that end at a node. A character can never collide with it.
const END = Symbol('term');

/** Fold case and strip accents, so that "ec" reaches "écharpe". */
export function normalise(text) {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
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
    let node = root;
    for (const char of normalise(term)) {
      if (!node.has(char)) node.set(char, new Map());
      node = node.get(char);
    }
    if (!node.has(END)) node.set(END, []);
    node.get(END).push([count, term]);
  }
  return root;
}

/** Walk down to the node holding everything that starts with `prefix`. */
function descend(root, prefix) {
  let node = root;
  for (const char of prefix) {
    node = node.get(char);
    if (node === undefined) return undefined;
  }
  return node;
}

/** Every [count, term] stored under a node, in no particular order. */
function collect(node, found = []) {
  for (const [key, value] of node) {
    if (key === END) found.push(...value);
    else collect(value, found);
  }
  return found;
}

/**
 * The most searched terms starting with `prefix`, most searched first.
 *
 * An empty prefix returns the most searched terms overall, which is what an
 * empty search bar should offer. An unknown prefix returns nothing: the tree
 * answers about the characters it was given, not about the ones it guesses.
 */
export function suggest(root, prefix, limit = 5) {
  const node = descend(root, normalise(prefix));
  if (node === undefined) return [];
  const found = collect(node);
  found.sort((a, b) => b[0] - a[0] || a[1].localeCompare(b[1]));
  return found.slice(0, limit).map(([, term]) => term);
}
