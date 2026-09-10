"""
Suggest as the user types: a prefix tree, ordered by how often a term is searched.

Rung N0. Standard library only, and the whole index is a nest of dictionaries
that fits in the memory of the process serving the search bar.

Two decisions carry the approach.

First, the tree is keyed on a normalised spelling, accents folded and case
dropped, while each leaf keeps the original one. Someone typing "ec" finds
"écharpe", and still reads it spelled properly in the drop-down.

Second, the ordering is a plain sort on the usage count. Suggesting is not
retrieving: ten candidates under a prefix is a common case, and sorting ten
items at every keystroke costs nothing worth optimising.
"""

import unicodedata

# Marks the terms that end at a node. A character can never collide with it.
END = "\0"


def normalise(text: str) -> str:
    """Fold case and strip accents, so that "ec" reaches "écharpe"."""
    decomposed = unicodedata.normalize("NFD", text.casefold())
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def build(entries) -> dict:
    """
    Build the tree from pairs of (term, how often it was searched).

    Terms sharing a normalised spelling are kept side by side at the same
    leaf, rather than one silently replacing the other.
    """
    root: dict = {}
    for term, count in entries:
        node = root
        for char in normalise(term):
            node = node.setdefault(char, {})
        node.setdefault(END, []).append((count, term))
    return root


def _descend(root: dict, prefix: str):
    """Walk down to the node holding everything that starts with `prefix`."""
    node = root
    for char in prefix:
        node = node.get(char)
        if node is None:
            return None
    return node


def _collect(node: dict):
    """Every (count, term) stored under a node, in no particular order."""
    for key, value in node.items():
        if key == END:
            yield from value
        else:
            yield from _collect(value)


def suggest(root: dict, prefix: str, limit: int = 5) -> list[str]:
    """
    The most searched terms starting with `prefix`, most searched first.

    An empty prefix returns the most searched terms overall, which is what an
    empty search bar should offer. An unknown prefix returns nothing: the tree
    answers about the characters it was given, not about the ones it guesses.
    """
    node = _descend(root, normalise(prefix))
    if node is None:
        return []
    found = sorted(_collect(node), key=lambda pair: (-pair[0], pair[1]))
    return [term for _, term in found[:limit]]
