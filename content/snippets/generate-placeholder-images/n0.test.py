import xml.etree.ElementTree as ElementTree

from n0 import placeholder_svg, stable_hash

# The exact markup expected for one identifier. The same literal appears in
# n0.test.js: that is what pins the two implementations to each other, and it
# would break the moment either language rounded a colour differently.
GOLDEN_MUG = (
    '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"'
    ' viewBox="0 0 60 60" role="img" aria-label="mug-106">'
    '<rect width="60" height="60" fill="#dae8f0"/>'
    '<rect x="24" y="12" width="12" height="12" fill="#317fa6"/>'
    '<rect x="0" y="36" width="12" height="12" fill="#317fa6"/>'
    '<rect x="48" y="36" width="12" height="12" fill="#317fa6"/>'
    '<rect x="24" y="48" width="12" height="12" fill="#317fa6"/>'
    "</svg>"
)


def test_produces_the_expected_markup():
    assert placeholder_svg("mug-106", 60) == GOLDEN_MUG


def test_is_deterministic_and_identifier_dependent():
    assert placeholder_svg("sku-4451") == placeholder_svg("sku-4451")
    assert placeholder_svg("sku-4451") != placeholder_svg("sku-4452")


def test_the_figure_is_symmetric():
    # The mirrored pair of the third row, at x = 0 and x = 48 of a 60 pixel side.
    assert '<rect x="0" y="36"' in GOLDEN_MUG
    assert '<rect x="48" y="36"' in GOLDEN_MUG


def test_the_markup_is_well_formed_xml():
    root = ElementTree.fromstring(placeholder_svg("sku-4451"))
    assert root.tag == "{http://www.w3.org/2000/svg}svg"
    assert root.get("width") == "240"
    assert root.get("role") == "img"


def test_handles_an_empty_identifier():
    # A missing reference is exactly when a placeholder is needed, so an empty
    # identifier has to give an image rather than an exception.
    svg = placeholder_svg("")
    assert ElementTree.fromstring(svg).get("aria-label") == ""
    assert svg.startswith("<svg ") and svg.endswith("</svg>")


def test_handles_accents_and_characters_that_are_markup():
    accented = placeholder_svg("café-crème")
    assert ElementTree.fromstring(accented).get("aria-label") == "café-crème"

    escaped = placeholder_svg('chaise "Löw" & <co>')
    assert "&amp;" in escaped and "&lt;co&gt;" in escaped
    assert ElementTree.fromstring(escaped).get("aria-label") == 'chaise "Löw" & <co>'


def test_carries_no_external_dependency():
    svg = placeholder_svg("sku-4451")
    # The only URL in the output is the SVG namespace itself.
    assert svg.count("http") == 1
    for forbidden in ("<image", "href", "url(", "@font-face", "<script"):
        assert forbidden not in svg


def test_a_small_size_still_gives_whole_pixels():
    svg = placeholder_svg("mug-106", 7)
    assert 'width="1"' in svg
    assert ElementTree.fromstring(svg).get("width") == "7"


def test_breaking_point_a_placeholder_stays_a_placeholder():
    """
    The breaking point claimed on the entry: the hash decides the image, the
    meaning of the identifier never does.

    An identifier that says « red » does not give red, two variants of one
    product look unrelated, and nothing in the output resembles a photograph.
    If a real picture of the thing is needed, no rung of this entry helps.
    """
    def hue(identifier):
        return (stable_hash(identifier) >> 16) % 360

    # Red sits near 0 on the hue wheel. Naming it changes nothing.
    assert not (hue("red velvet sofa") < 30 or hue("red velvet sofa") > 330)

    # Two photographs of the same sofa would look alike. These do not.
    assert abs(hue("sofa-1") - hue("sofa-2")) > 30
    assert placeholder_svg("sofa-1") != placeholder_svg("sofa-2")

    # Whatever the product, the whole image is flat rectangles in two colours.
    svg = placeholder_svg("red velvet sofa")
    fills = {part.split('"')[0] for part in svg.split('fill="')[1:]}
    assert len(fills) == 2
    assert svg.count("<") == svg.count("<rect") + 2  # the svg element and its close
