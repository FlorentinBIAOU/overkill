"""
Repair text that was decoded with the wrong character set.

Rung N0. « CrÃ©dit Agricole » is not damaged text: it is « Crédit Agricole »
whose UTF-8 bytes were read as if they were Windows-1252. The operation is
exactly invertible — write the characters back out as Windows-1252 bytes, read
those bytes as UTF-8 — and that is a byte identity, not a judgement.

`ftfy` does it in Python and has done for a decade. It also knows the variants:
two rounds of the same accident, a Windows-1252 that should have been
Cyrillic, a UTF-8 read as UTF-16. There is no port of it in JavaScript, so the
snippet there writes the main transformation itself, in about thirty lines.

The two agree on thirty-nine of this entry's forty-seven strings, and they part
in both directions.

`ftfy` weighs the whole string before repairing, and declines when what would
come out is a short run opening on an accented capital: `fix_encoding` leaves
« ÃŽle-de-France » exactly as it is, and repairs the same word inside
« RÃ©gion ÃŽle-de-France ». « ÃŽles Canaries », « ÃŽlot » and « Å’uvre » fail
the same way — which is the shape of a spreadsheet cell and of a `region`
column, the very thing this entry is about. The JavaScript side has no such
heuristic and repairs all four.

`ftfy` also reads an existing replacement character as a byte: « Ã » + U+FFFD +
« ambe » comes back as U+FFFD + « ambe », and the « Ã » is gone. The JavaScript
side leaves that string alone.

In the other direction, `ftfy` carries one rule this snippet does not — « Ã »
followed by an ordinary space is read as the « à » whose non-breaking space was
lost in transit, which repairs one more real case and rewrites one more correct
sentence — and it unwinds any depth of stacked accidents, where the JavaScript
side stops after four.

Two things this file does on purpose. It calls `fix_encoding` and not
`fix_text`: the latter also straightens quotation marks, which turns « L'été à
Nice », already correct, into a version with a straight apostrophe — a silent
rewrite of French typography. And it returns `changed` rather than repairing in
place, because a repair that nobody recorded is indistinguishable from data
that was always like that.
"""

from __future__ import annotations

import ftfy

# The character a decoder writes when it gave up: the byte is gone, and no
# round trip brings it back.
REPLACEMENT = "�"


def repair_encoding(text) -> dict:
    """
    Undo a wrong decoding, and say whether anything was undone.

    `changed` is the flag a caller logs: the repair is a rewrite of somebody's
    data, and it is wrong often enough — see this entry's breaking point — that
    it must not happen in silence.

    `lossy` says the text that comes back carries replacement characters.
    Those are bytes a decoder threw away, usually before this function ever
    saw the string, and nothing here restores them. When the input already
    carries one, `ftfy` reads it as a byte and can drop the character in front
    of it — see the header — so a `lossy` text is one to import again, not one
    to repair.
    """
    if not isinstance(text, str):
        return _report(None, False, False, f"text is expected, not {type(text).__name__}")
    repaired = ftfy.fix_encoding(text)
    return _report(repaired, repaired != text, REPLACEMENT in repaired, None)


def _report(text, changed: bool, lossy: bool, reason: str | None) -> dict:
    return {"text": text, "changed": changed, "lossy": lossy, "reason": reason}
