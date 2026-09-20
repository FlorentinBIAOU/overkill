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
The two agree on thirty-nine of this entry's forty-one strings; the two they
part on are the same rule, and it is named below.

That rule is `ftfy`'s: « Ã » followed by an ordinary space is read as the « à »
whose non-breaking space was lost in transit. It repairs one more real case and
rewrites one more correct sentence, and the JavaScript side does neither.

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

    `lossy` says the text already carries replacement characters. Those are
    bytes a decoder threw away before this function ever saw the string, and
    nothing here restores them.
    """
    if not isinstance(text, str):
        return _report(None, False, False, f"text is expected, not {type(text).__name__}")
    repaired = ftfy.fix_encoding(text)
    return _report(repaired, repaired != text, REPLACEMENT in repaired, None)


def _report(text, changed: bool, lossy: bool, reason: str | None) -> dict:
    return {"text": text, "changed": changed, "lossy": lossy, "reason": reason}
