"""
Suggest as the user types: a prefix tree, ordered by how often a term is searched.

Rung N0. Standard library only, and the whole index is a nest of dictionaries
that fits in the memory of the process serving the search bar.

Two decisions carry the approach.

First, the tree is keyed on a normalised spelling, accents folded and case
dropped, while each leaf keeps the original one. Someone typing "ec" finds
"écharpe", and still reads it spelled properly in the drop-down.

Second, the ordering is a plain sort on the usage count, done once per node
and kept there. The empty bar reaches the whole index, a first letter a good
share of it, and every user asks for both: sorting them again at each
keystroke is where the time would go. The price is memory, at most one
reference per term for each node a keystroke has reached.
"""

import unicodedata

# Marks the terms that end at a node. It is not a string, so no character can
# collide with it.
END = object()

# Where a node keeps its ranked terms once a keystroke has asked for them.
RANKED = object()

# Categories M* are the accents NFKD detaches; Cf holds the invisible characters.
DROPPED = {"Mn", "Mc", "Me", "Cf"}
# NFKD has already turned non-breaking spaces into plain ones; these are the
# other spaces. The final sigma is folded by hand: JavaScript keeps it.
FOLD = str.maketrans("\t\n\v\f\rς", "     σ")


def normalise(text: str) -> str:
    """
    Fold case and strip accents, so that "ec" reaches "écharpe".

    Invisible characters (zero-width space, byte order mark) are dropped, and
    runs of spaces, non-breaking ones included, become one space with none at
    either end: what gets pasted into a search bar carries all of these.
    """
    # Upper then lower case folds "ß" into "ss", the same way in both languages.
    # "ẞ" is the capital of "ß" and upper-casing leaves it alone; written as
    # "ß" first, the pair folds to "ss" on both sides.
    folded = unicodedata.normalize("NFKD", text.replace("\u1e9e", "ß")).upper().lower().translate(FOLD)
    kept = "".join(c for c in folded if unicodedata.category(c) not in DROPPED)
    return " ".join(word for word in kept.split(" ") if word)


def build(entries) -> dict:
    """
    Build the tree from pairs of (term, how often it was searched).

    Terms sharing a normalised spelling are kept side by side at the same
    leaf, rather than one silently replacing the other.
    """
    root: dict = {}
    for term, count in entries:
        key = normalise(term)
        node = root
        for char in key:
            node = node.setdefault(char, {})
        node.setdefault(END, []).append((count, key, term))
    return root


def _descend(root: dict, prefix: str) -> dict:
    """The node holding everything that starts with `prefix`, empty if none does."""
    node = root
    for char in prefix:
        node = node.get(char, {})
    return node


def _collect(node: dict):
    """
    Every (count, key, term) stored under a node, in no particular order.

    A stack rather than recursion: one term of a hundred thousand characters in
    the search log would otherwise overflow the call stack.
    """
    stack = [node]
    while stack:
        for key, value in stack.pop().items():
            if key is END:
                yield from value
            elif key is not RANKED:
                stack.append(value)


def suggest(root: dict, prefix: str, limit: int = 5) -> list[str]:
    """
    The most searched terms starting with `prefix`, most searched first.

    An empty prefix returns the most searched terms overall, which is what an
    empty search bar should offer. An unknown prefix returns nothing: the tree
    answers about the characters it was given, not about the ones it guesses.
    """
    node = _descend(root, normalise(prefix))
    if RANKED not in node:
        # Sorted once per node, then read back. Equal counts fall back to the
        # normalised spelling, so "écharpe" comes before "zèbre".
        node[RANKED] = sorted(_collect(node), key=lambda entry: (-entry[0], entry[1], entry[2]))
    return [term for _, _, term in node[RANKED][:limit]]
