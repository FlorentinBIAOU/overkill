"""
Related articles from tag overlap, weighted by how rare each tag is.

Rung N0. Standard library, deterministic, and computed once for the whole
corpus instead of on every page view: the neighbours of an article do not
depend on who is reading it, so no reader should ever wait for this.

Counting shared tags is the obvious version, and it is the wrong one. A tag
every article carries says nothing about any of them; a tag three articles
carry says almost everything about those three. Weighting each tag by its
rarity is the whole difference between a useful block and one that files the
site announcement next to every article on the site.
"""

import math
from collections import Counter


def tag_weights(articles: list[dict]) -> dict[str, float]:
    """
    Inverse document frequency of every tag in the corpus.

    log(corpus size / tag count) is exactly zero for a tag carried by every
    article. That is the point, not a rounding accident: such a tag must not
    create any similarity at all.
    """
    counts = Counter(tag for article in articles for tag in set(article["tags"]))
    return {tag: math.log(len(articles) / count) for tag, count in counts.items()}


def _norm(vector: dict[str, float]) -> float:
    return math.sqrt(sum(weight * weight for weight in vector.values()))


def similarity(first_tags, second_tags, weights: dict[str, float]) -> float:
    """Cosine between two tag sets, each weighted by tag rarity."""
    first = {tag: weights.get(tag, 0.0) for tag in set(first_tags)}
    second = {tag: weights.get(tag, 0.0) for tag in set(second_tags)}
    shared = sum(first[tag] * second[tag] for tag in first.keys() & second.keys())
    norms = _norm(first) * _norm(second)
    # An article carrying only universal tags has a null vector, and no
    # neighbours. Saying nothing is the honest answer here.
    return shared / norms if norms else 0.0


def build_neighbour_table(articles: list[dict], k: int = 5, minimum: float = 0.0) -> dict:
    """
    Return `{article id: [(neighbour id, score), ...]}`, best neighbour first.

    Built offline, for the whole corpus at once, when an article is published
    or retagged. Rendering the block on a page is then a lookup in this table,
    never a search.
    """
    weights = tag_weights(articles)
    table = {}
    for article in articles:
        neighbours = []
        for other in articles:
            if other["id"] == article["id"]:
                continue
            score = round(similarity(article["tags"], other["tags"], weights), 3)
            if score > minimum:
                neighbours.append((other["id"], score))
        # Ties broken by identifier, so that two builds give the same page.
        neighbours.sort(key=lambda neighbour: (-neighbour[1], neighbour[0]))
        table[article["id"]] = neighbours[:k]
    return table
