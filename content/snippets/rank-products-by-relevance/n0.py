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
outside is brought back onto it rather than left to swamp the others. A weight
of two really does mean twice as much, and the score, a mean over weights that
cannot be negative, stays inside the same scale.

Brought back, and not refused: a margin of -0.05 is a real thing — end-of-season
stock sold at a loss — and this function is called on every page of results. One
badly filled product must not take the whole category page down with it. The
products whose signals had to be moved come back named, so that the fault is
visible rather than silent. The weights are another matter: they come from the
code, and a weight that is not a finite number, zero or above, is refused.

The sort is stable, so two products the score cannot separate stay in the
order the catalogue gave them. An unstable sort would reshuffle equal results
between two page loads, and nobody would be able to reproduce a complaint.
"""

import math
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

    It is a share, not a relevance score. On a one-word query every product
    that holds the word scores 1.0, and the ranking is then decided entirely by
    stock, margin and popularity. If you already run a search engine — BM25 in
    PostgreSQL, Elasticsearch, Meilisearch — put its score here instead,
    normalised to nought-to-one. The value of this rung is the arbitration
    between the four weights, not this signal.
    """
    wanted = terms(query)
    if not wanted:
        return 0.0
    haystack = terms(product["title"] + " " + " ".join(product.get("tags", ())))
    found = sum(1 for term in wanted if any(word.startswith(term) for word in haystack))
    return found / len(wanted)


# The signals that come from the catalogue rather than from the query, and can
# therefore arrive out of scale.
FROM_DATA = ("margin", "popularity")


def on_scale(value) -> tuple[float, bool]:
    """
    Bring a value onto the nought-to-one scale, and say whether it had to move.

    Anything that is not a finite number reads as nought: a margin arriving as
    None, as a string or as NaN is a data fault, not a ranking signal, and it
    is reported rather than trusted.
    """
    number = value if isinstance(value, (int, float)) and not isinstance(value, bool) else None
    if number is None or not math.isfinite(number):
        return 0.0, True
    bounded = min(max(float(number), 0.0), 1.0)
    return bounded, bounded != float(number)


def out_of_scale(product: dict) -> list[str]:
    """The catalogue signals `signals` had to move, named for the caller."""
    return [name for name in FROM_DATA if on_scale(product[name])[1]]


def signals(product: dict, query: str) -> dict[str, float]:
    """The four signals, each on the same nought-to-one scale."""
    measured = {
        "text": text_match(query, product),
        "availability": 1.0 if product["in_stock"] else 0.0,
    }
    for name in FROM_DATA:
        measured[name] = on_scale(product[name])[0]
    return measured


def score(measured: dict[str, float], weights: dict[str, float]) -> float:
    """Weighted mean of the signals, so the score stays on the same scale."""
    missing = [name for name in SIGNALS if name not in weights]
    if missing:
        raise ValueError(f"every signal needs a weight, and these have none: {', '.join(missing)}")
    for name in SIGNALS:
        weight = weights[name]
        ok = isinstance(weight, (int, float)) and not isinstance(weight, bool) and math.isfinite(weight)
        if not ok or weight < 0:
            # Unlike a signal, a weight comes from the code, not from the
            # catalogue: it is refused rather than brought back into line.
            raise ValueError(f"a weight must be a finite number, nought or above: {name} is {weight!r}")
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
    which signal held it back. `out_of_scale` names the catalogue signals that
    had to be brought back onto the scale, so that a margin of -0.05 shows up
    in the output instead of taking the page down.
    """
    scored = []
    for product in products:
        measured = signals(product, query)
        scored.append({
            "product": product,
            "score": score(measured, weights),
            "signals": measured,
            "out_of_scale": out_of_scale(product),
        })
    # Stable: products the score cannot separate keep their catalogue order.
    scored.sort(key=lambda row: -row["score"])
    return scored
