"""
A placeholder image without a model: an SVG derived from a hash of the identifier.

Rung N0. No file is written and no byte is downloaded: the function returns a
string of markup that a template can inline or a handler can serve.

Two properties carry the whole approach.

It is deterministic. The same identifier always yields exactly the same image,
on every machine, in every language, for ever. A placeholder that changed on
each render would flicker in a grid and defeat every HTTP cache.

Its arithmetic is integer. Hue, chroma and cell positions are computed without
a single division that could round differently from one runtime to another,
which is what lets the Python and the JavaScript version agree character for
character.
"""

# FNV-1a, the same constants as the rest of the catalogue, so that identifiers
# hash identically wherever they are hashed.
FNV_OFFSET = 2166136261
FNV_PRIME = 16777619
MASK32 = 0xFFFFFFFF

GRID = 5  # cells per side
COLUMNS = 3  # independent columns; the remaining two mirror them

ESCAPES = (("&", "&amp;"), ("<", "&lt;"), (">", "&gt;"), ('"', "&quot;"))


def stable_hash(text: str) -> int:
    """
    FNV-1a on 32 bits.

    Not the built-in hash: that one is salted per process, so it would give a
    different image every time the server restarted.
    """
    digest = FNV_OFFSET
    for char in text:
        digest = ((digest ^ ord(char)) * FNV_PRIME) & MASK32
    return digest


def _hex_colour(hue: int, saturation: int, lightness: int) -> str:
    """HSL to hexadecimal, in integers only, all three arguments in percent."""
    chroma = (255 * saturation * (100 - abs(2 * lightness - 100))) // 10000
    edge = (chroma * (60 - abs((hue % 120) - 60))) // 60
    floor = (255 * lightness) // 100 - chroma // 2
    wheel = (
        (chroma, edge, 0), (edge, chroma, 0), (0, chroma, edge),
        (0, edge, chroma), (edge, 0, chroma), (chroma, 0, edge),
    )
    red, green, blue = wheel[(hue // 60) % 6]
    return "#%02x%02x%02x" % (red + floor, green + floor, blue + floor)


def _escape(text: str) -> str:
    """The identifier ends up inside an attribute, so it is markup until escaped."""
    for character, entity in ESCAPES:
        text = text.replace(character, entity)
    return text


def placeholder_svg(identifier: str, size: int = 240) -> str:
    """
    Build a symmetric two-tone figure on a tinted ground.

    The high bits of the hash choose the hue, the low ones switch cells on and
    off. Mirroring the left columns onto the right ones costs one line and is
    what makes the result read as a mark rather than as noise.
    """
    digest = stable_hash(identifier)
    hue = (digest >> 16) % 360
    cell = size // GRID
    margin = (size - cell * GRID) // 2

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}"'
        f' viewBox="0 0 {size} {size}" role="img" aria-label="{_escape(identifier)}">',
        f'<rect width="{size}" height="{size}" fill="{_hex_colour(hue, 45, 90)}"/>',
    ]
    ink = _hex_colour(hue, 55, 42)
    for row in range(GRID):
        for column in range(GRID):
            mirrored = min(column, GRID - 1 - column)
            if not (digest >> (row * COLUMNS + mirrored)) & 1:
                continue
            x = margin + column * cell
            y = margin + row * cell
            parts.append(
                f'<rect x="{x}" y="{y}" width="{cell}" height="{cell}" fill="{ink}"/>'
            )
    parts.append("</svg>")
    return "".join(parts)
