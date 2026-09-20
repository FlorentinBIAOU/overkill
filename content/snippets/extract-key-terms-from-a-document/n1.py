"""
The terms that tell this document apart from the others in the same folder.

Rung N1. Rung N0 reads one document and can only say what it repeats. Every
contract in a folder of contracts repeats « conditions générales de vente »,
and no amount of reading that one contract more carefully will reveal that the
phrase is worthless: the information is in the folder, not in the document.

So the candidates are the same as at rung N0 — the same cut, the same stop
list — and only the ranking changes. Each word gets the logarithm of how many
documents there are over how many contain it, and a phrase is worth the
average of its words, times how often the document says it. A word in every
document is then worth exactly nothing, which is the whole point.

One deliberate difference from the usual formula: `scikit-learn` smooths, and
floors that logarithm at one, so a term in every document still weighs
something. That is right when the weights feed a similarity — the entry on
showing similar articles uses the smoothed form for that reason. It is wrong
here: a term in every document of your collection is not a key term of any of
them, and rounding it to « a little » would put it back in the list.

The model is the collection. It is fitted in memory, in one pass, from the
documents you already hold; there is nothing to download and nothing to send.
"""

from __future__ import annotations

import math

from n0 import candidates_of, extract_key_terms

# Kept so the two rungs are told apart in a report that mixes them.
SOURCE = "corpus"


def extract_key_terms_in_corpus(documents, stop_words, *, top: int = 8) -> dict:
    """
    For each document, the phrases the rest of the collection does not share.

    `documents` is the collection itself: the ranking is only as good as what
    you compare against, and two documents are not a collection.
    """
    if not isinstance(documents, (list, tuple)):
        return {"documents": [], "reason": f"expected a list, not {type(documents).__name__}"}
    if len(documents) < 2:
        return {"documents": [], "reason": "a corpus of at least two documents is required"}
    stop = list(stop_words or [])
    if not stop:
        return {"documents": [], "reason": "a stop list is required, one per language"}

    per_document = [candidates_of(text if isinstance(text, str) else "", stop)
                    for text in documents]
    holders = {}
    for phrases in per_document:
        for word in {word for phrase in phrases for word in phrase.split(" ")}:
            holders[word] = holders.get(word, 0) + 1
    total = len(documents)
    idf = {word: math.log(total / count) for word, count in holders.items()}

    ranked = []
    for index, text in enumerate(documents):
        counted = extract_key_terms(text if isinstance(text, str) else "", stop,
                                    top=len(per_document[index]) or 1)["terms"]
        terms = [{"text": term["text"], "key": term["key"], "count": term["count"],
                  "first": term["first"],
                  "score": _rounded(term["count"] * _mean(term["key"], idf))}
                 for term in counted]
        # Equal scores are the ordinary case, not the exception: on a short
        # document every phrase appears once and in no other document, so every
        # one of them scores log(N). What breaks the tie has to mean something
        # — the longer phrase first, because it says more, then the one that
        # appears earliest, because a document states its subject early. The
        # key comes last, and only so that two languages answer in the same
        # order.
        terms.sort(key=lambda t: (-t["score"], -t["count"],
                                  -len(t["key"].split(" ")), t["first"], t["key"]))
        kept = terms[:top]
        # How many terms outside the cut share the score of the last one kept:
        # a caller that reads « the top five » of twelve equals should know.
        tied = 0
        if kept and len(terms) > len(kept):
            tied = sum(1 for term in terms[len(kept):] if term["score"] == kept[-1]["score"])
        ranked.append({"index": index, "terms": kept, "tied_at_cut": tied})
    return {"documents": ranked, "reason": None}


def _mean(key: str, idf: dict) -> float:
    words = key.split(" ")
    return sum(idf.get(word, 0.0) for word in words) / len(words)


def _rounded(value: float) -> float:
    """
    Four decimals, by the same two operations in both languages: Python and
    JavaScript do not round a half the same way, and a ranking must not depend
    on which one ran.
    """
    return math.floor(value * 10000 + 0.5) / 10000
