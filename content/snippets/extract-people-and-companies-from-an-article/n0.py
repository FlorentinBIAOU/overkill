"""
The proper names an article carries, typed only where something proves the type.

Rung N0. In French as in English a proper name is capitalised, so finding the
candidates is a scan. Saying what each one *is* — a person, a company, a place
— is the hard half, and nothing in the letters themselves says it: « Boulanger »
is a family name and a chain of shops, « Orange » is a company and a fruit,
« Lyon » is a city and a surname.

So this rung types a name only when the sentence proves it. « M. » or « Mme »
before it proves a person; a legal form such as « SARL » or « Ltd » after it,
or « la société » before it, proves a company. Everything else comes back as
`unknown`, which is what the sentence actually supports. Guessing from the
shape of the word is how « Boulanger a livré le colis » becomes a bakery.

Two limits are counted rather than hidden. A single capitalised word opening a
sentence is not returned, because most of them are just the first word of the
sentence; `skipped_at_sentence_start` says how many were passed over. And the
markers below are French and English ones: they are a declared list, they are
meant to be extended, and a text that carries none of them comes back entirely
`unknown`.
"""

from __future__ import annotations

import re

# What proves a person, before the name.
HONORIFICS = {"m", "m.", "mme", "mlle", "dr", "dr.", "me", "pr", "prof", "prof.",
              "mr", "mr.", "mrs", "mrs.", "ms", "ms.", "miss", "sir"}

# What proves a company, after the name.
LEGAL_FORMS = {"sarl", "sas", "sasu", "sa", "snc", "sci", "eurl", "scop", "gie",
               "gmbh", "ag", "ltd", "ltd.", "inc", "inc.", "llc", "plc", "bv", "nv", "spa"}

# What proves a company, before the name. Two words at most, lowercase.
ORG_LEADS = {("la", "société"), ("l", "entreprise"), ("le", "groupe"), ("la", "marque"),
             ("the", "company"), ("the", "firm"), ("the", "group"), ("l", "enseigne")}

# Lowercase words a name may contain without being cut: « Jean de La Fontaine »,
# « Ludwig van Beethoven », « Banque de France ». « et » and « and » are
# deliberately absent, although « Marks and Spencer » wants them: keeping them
# merges « Alex Ferguson et Acme » into a single name, and inventing one entity
# out of two is worse than returning one name in two pieces.
PARTICLES = {"de", "du", "des", "da", "della", "van", "von", "der", "den", "ten",
             "of", "la", "le", "les", "el", "al", "d", "l", "o"}

# A word, with neither full stop nor apostrophe inside it. « M. » is therefore
# the token « M » followed by a separator, which keeps an honorific out of the
# name, and « L'enseigne » is two tokens, which keeps the article out of it.
WORD = re.compile(r"[^\W\d_][\w-]*", re.UNICODE)

# What two words of one name may be separated by: a space, or the apostrophe
# French elides on — « Jean d'Artagnan » is one name.
JOINS = re.compile(r"[ \t\r\n\f\v\u00a0\u202f]+|['’]")
SENTENCE_END = re.compile(r"[.!?…:;\n\r]\s*\Z")


def extract_names(text) -> dict:
    """
    The proper names of `text`, each with what the sentence proves about it.

    `type` is « person », « company » or « unknown », and `evidence` says what
    proved it. A name with no evidence is never typed by its spelling.
    """
    if not isinstance(text, str):
        return {"names": [], "skipped_at_sentence_start": 0,
                "reason": f"expected text, not {type(text).__name__}"}

    tokens = [(m.group(), m.start(), m.end()) for m in WORD.finditer(text)]
    names, skipped, index = [], 0, 0
    while index < len(tokens):
        length = _run_length(tokens, index, text)
        if length == 0:
            index += 1
            continue
        start, end = tokens[index][1], tokens[index + length - 1][2]
        opens = index == 0 or SENTENCE_END.search(text[tokens[index - 1][2]:start])
        kind, evidence = _typed(tokens, index, length)
        if length > 1 and tokens[index][0].lower() in HONORIFICS:
            start = tokens[index + 1][1]  # « Mme » is not part of the name
        alone = tokens[index][0].lower()
        ordinary = alone in PARTICLES or alone in HONORIFICS or len(alone) == 1
        if length == 1 and opens and kind == "unknown" and not ordinary:
            # « Lumière a livré le colis. » — most sentence openers are not
            # names, and this rung has no way to tell which ones are. An
            # opener that is plainly a determiner is not even counted.
            skipped += 1
        elif not (length == 1 and ordinary):
            names.append({"text": text[start:end], "type": kind, "evidence": evidence,
                          "start": start, "end": end})
        index += length
    return {"names": names, "skipped_at_sentence_start": skipped, "reason": None}


def _run_length(tokens, index: int, text: str) -> int:
    """How many tokens from `index` belong to one capitalised run."""
    if not tokens[index][0][:1].isupper():
        return 0
    length, last = 1, index
    while last + 1 < len(tokens):
        word = tokens[last + 1][0]
        if not JOINS.fullmatch(text[tokens[last][2]:tokens[last + 1][1]]):
            break
        if word[:1].isupper():
            last += 1
        elif word.lower() in PARTICLES and last + 2 < len(tokens) \
                and tokens[last + 2][0][:1].isupper():
            last += 2  # a particle only counts between two capitalised words
        else:
            break
        length = last - index + 1
    return length


def _typed(tokens, index: int, length: int):
    """What the sentence proves about this run, and the word that proves it."""
    before = [tokens[i][0].lower() for i in range(max(0, index - 2), index)]
    run = [tokens[i][0].lower() for i in range(index, index + length)]
    after = tokens[index + length][0].lower() if index + length < len(tokens) else ""
    if before and before[-1] in HONORIFICS:
        return "person", before[-1]
    if length > 1 and run[0] in HONORIFICS:
        return "person", run[0]  # « Sir Alex », written without a full stop
    if run[-1] in LEGAL_FORMS and length > 1:
        return "company", run[-1]
    if after in LEGAL_FORMS:
        return "company", after
    if len(before) == 2 and tuple(before) in ORG_LEADS:
        # « l'entreprise » is two tokens; it is written back as one word.
        return "company", ("'" if len(before[0]) == 1 else " ").join(before)
    return "unknown", None
