"""
Mask personal data in a chat message: normalisation, then regular expressions.

Rung N0. Deterministic, standard library only.

Two things make this work.

First, the patterns read a normalised copy of the message, where every
character is written in its plain form: compatibility folding brings full-width
digits back to ordinary ones, and the spaces of French typography, the
zero-width characters and the soft hyphen become a plain space. The labels are
then put into the message as it was written, so a message with nothing to mask
comes back unchanged, apart from the composition of its accents (NFC), which
changes nothing on screen.

Second, the phone pattern tolerates the separators people type between digits
— a space, a dot, a dash or a slash, one or two of them — and an IBAN is only
masked when its check digits add up.
"""

import re
import unicodedata

# Characters that can sit inside a number without looking like a separator:
# the spaces of French typography, the soft hyphen, the zero-width space and
# joiners, the word joiner and the byte order mark.
INVISIBLE_OR_SPACE = re.compile("[\u00a0\u00ad\u2007\u2009\u200a\u200b\u200c\u200d\u202f\u2060\ufeff]")

# The lookbehind starts a match only at the beginning of a word: without it, a
# long run of letters with no @ takes quadratic time.
EMAIL = re.compile(r"(?<![\w.+-])[\w.+-]+@[\w-]+(?:\.[\w-]+)+")

# French numbers: 0X XX XX XX XX, +33 X XX XX XX XX, or +33 (0)X XX XX XX XX.
# Between digits: a space, a dot, a dash or a slash, one or two of them, or nothing.
SEP = r"[ ./-]{0,2}"
PHONE = re.compile(rf"(?<![\d+])(?:\+{SEP}33{SEP}(?:\(0\){SEP})?|0)[1-9](?:{SEP}\d){{8}}(?!\d)", re.ASCII)

# IBAN: two letters, two check digits, then the account number in groups of
# four, spaced or not, in either case. The check digits decide, not the pattern.
IBAN = re.compile(r"(?<![A-Z0-9])[A-Z]{2} ?\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?(?![A-Z0-9])", re.I | re.ASCII)

# Order matters: an email may contain digits that would otherwise be read as
# the start of a phone number.
PATTERNS = ((EMAIL, "[email]"), (IBAN, "[iban]"), (PHONE, "[phone]"))


def normalise(text: str) -> str:
    """Write every character in its plain form: a digit as a digit, a space as a space."""
    return "".join(_plain(char) for char in text)


def _plain(char: str) -> str:
    return " " if INVISIBLE_OR_SPACE.match(char) else unicodedata.normalize("NFKC", char)


def is_valid_iban(candidate: str) -> bool:
    """ISO 13616: the first four characters go to the end, letters count 10 to 35, modulo 97 is 1."""
    compact = candidate.replace(" ", "").upper()
    return len(compact) >= 15 and int("".join(str(int(c, 36)) for c in compact[4:] + compact[:4])) % 97 == 1


def iban_prefix(candidate: str) -> str:
    """The longest valid IBAN at the start of `candidate`, cut at a space: the pattern may swallow the next word."""
    cuts = [len(candidate)] + [space.start() for space in re.finditer(" ", candidate)][::-1]
    return next((candidate[:cut] for cut in cuts if is_valid_iban(candidate[:cut])), "")


def mask(text: str) -> str:
    """
    Replace contact details with a label naming what was removed.

    A label beats a row of asterisks: whoever reads the thread later can see
    that a phone number was removed, not merely that something was.
    """
    text = unicodedata.normalize("NFC", text)
    plain, origin = "", []  # origin[i]: the character of `text` that plain character i comes from
    for index, char in enumerate(text):
        plain += _plain(char)
        origin += [index] * (len(plain) - len(origin))

    covered = [None] * len(text)  # (label, first character) of the match covering each character
    for pattern, label in PATTERNS:
        for match in pattern.finditer(plain):
            found = iban_prefix(match.group()) if label == "[iban]" else match.group()
            if not found:
                continue
            start, end = origin[match.start()], origin[match.start() + len(found) - 1] + 1
            if all(cover is None for cover in covered[start:end]):
                covered[start:end] = [(label, start)] * (end - start)

    # Each character is kept, replaced by its label where a match starts, or dropped.
    return "".join(
        char if cover is None else cover[0] if cover[1] == index else ""
        for index, (char, cover) in enumerate(zip(text, covered))
    )
