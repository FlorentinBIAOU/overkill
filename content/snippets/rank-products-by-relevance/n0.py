"""
Rank products with a weighted score: text match, availability, margin, popularity.

Rung N0. Deterministic, standard library only, and above all arguable: the
four weights are arguments, not constants buried in the code. That is the
point of the whole approach. When sales say the top result is wrong, the
conversation is about a number a merchandiser can read, and the answer arrives
in an afternoon rather than in a retraining cycle.

Two decisions make it usable.

Every signal sits on the same nought-to-one scale before the weights touch it:
text and availability by construction, margin and popularity because a value
outside is refused rather than left to swamp the others. A weight of two
really does mean twice as much, and the score, a mean over weights that cannot
be negative, stays inside the same scale.

The sort is stable, so two products the score cannot separate stay in the
order the catalogue gave them. An unstable sort would reshuffle equal results
between two page loads, and nobody would be able to reproduce a complaint.
"""

import unicodedata

# The order the weights are applied in. Fixing it keeps the arithmetic
# identical everywhere, which is what makes a ranking reproducible.
SIGNALS = ("text", "availability", "margin", "popularity")

# A starting point, not a truth. These are the numbers to argue about.
DEFAULT_WEIGHTS = {"text": 6.0, "availability": 2.0, "margin": 1.0, "popularity": 3.0}


def fold(text: str) -> str:
    """
    Lowercase and drop accents, so that "crème" finds "creme".

    Only the diacritics Latin scripts use (U+0300 to U+036F) are dropped: in
    Devanagari or Arabic the vowel signs are marks too, and dropping them
    would turn one word into another.
    """
    decomposed = unicodedata.normalize("NFD", text.lower())
    return "".join(c for c in decomposed if not "\u0300" <= c <= "\u036f")


def terms(text: str) -> list[str]:
    """Split on anything that is not a letter, a mark or a digit."""
    letters = "".join(c if c.isalnum() or unicodedata.category(c)[0] == "M" else " " for c in fold(text))
    return letters.split()


def text_match(query: str, product: dict) -> float:
    """
    Share of the query terms found at the start of a word of the product.

    Prefix matching, not equality: a shopper who types "chauss" is looking
    for "chaussures", and "sandale" finds "sandales". Not the other way round:
    "sandales" does not find "sandale".
    """
    wanted = terms(query)
    if not wanted:
        return 0.0
    haystack = terms(product["title"] + " " + " ".join(product.get("tags", ())))
    found = sum(1 for term in wanted if any(word.startswith(term) for word in haystack))
    return found / len(wanted)


def signals(product: dict, query: str) -> dict[str, float]:
    """The four signals, each on the same nought-to-one scale."""
    for name in ("margin", "popularity"):
        if not 0.0 <= product[name] <= 1.0:
            raise ValueError(f"{name} must lie between 0 and 1, not {product[name]!r}")
    return {
        "text": text_match(query, product),
        "availability": 1.0 if product["in_stock"] else 0.0,
        "margin": product["margin"],
        "popularity": product["popularity"],
    }


def score(measured: dict[str, float], weights: dict[str, float]) -> float:
    """Weighted mean of the signals, so the score stays on the same scale."""
    if any(weights[name] < 0 for name in SIGNALS):
        raise ValueError("a weight cannot be negative: the score is a weighted mean")
    total = 0.0
    weighted = 0.0
    for name in SIGNALS:
        total += weights[name]
        weighted += weights[name] * measured[name]
    return weighted / total if total else 0.0


def rank(products: list[dict], query: str, weights: dict = DEFAULT_WEIGHTS) -> list[dict]:
    """
    Sort the catalogue, best first, and hand back the reason for each place.

    Returning the signals alongside the score costs nothing and settles most
    arguments before they start: whoever asks why a product came third can see
    which signal held it back.
    """
    scored = []
    for product in products:
        measured = signals(product, query)
        scored.append({"product": product, "score": score(measured, weights), "signals": measured})
    # Stable: products the score cannot separate keep their catalogue order.
    scored.sort(key=lambda row: -row["score"])
    return scored
