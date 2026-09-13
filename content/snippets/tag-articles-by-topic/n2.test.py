"""
These tests inject a local double instead of loading a real encoder.

What they prove: the topic descriptions are encoded once and not once per
article, the vectors are brought to length one, the cosine is computed and
sorted the way the snippet claims, the threshold cuts where it says it cuts,
and a topic added to the dictionary is usable immediately with no labelled
example.

What they do not prove: that the model understands anything. The double is a
bag of words, so on the article this rung exists for — a topic treated without
ever being named — it says nothing at all. That is asserted below rather than
hidden, and it is why the entry declares this snippet `stubbed`.

The double gives the same numbers in both languages, so the scores asserted
here are the ones asserted in n2.test.js.
"""

from _harness.fake_model import FakeEncoder
from n2 import build_labeller, score, tag

# A topic is a sentence, not a term list. Adding one is a one-line edit, which
# is the whole promise of this rung.
TOPICS = {
    "cybersécurité": "La cybersécurité des entreprises : hameçonnage, rançongiciel et fuite de données.",
    "fiscalité": "La fiscalité des entreprises : impôt, TVA et déclaration fiscale.",
    "recrutement": "Le recrutement des salariés : offre, candidature et entretien d'embauche.",
    "télétravail": "Le télétravail des salariés : travail à distance, bureau et domicile.",
}

# The real encoder of this snippet returns 384 numbers per text; the double is
# asked for the same width, so the test exercises the shape the snippet will
# actually meet.
DIMENSIONS = 384

# An article that is about one topic for four sentences, and mentions a second
# one in passing at the very end.
LONG_ARTICLE = (
    "La campagne d'hameçonnage imitait un message de la banque. "
    "Les salariés ont reçu un courriel frauduleux les invitant à saisir leur "
    "identifiant sur un faux site. "
    "Le correctif publié la veille n'avait pas encore été installé partout, et "
    "la fuite de données a touché plusieurs milliers de clients. "
    "L'entreprise a porté plainte, puis rappelé les règles internes. "
    "Le service juridique précise au passage que l'amende éventuelle n'est pas "
    "déductible de l'impôt."
)


def make_labeller(topics=None):
    return build_labeller(topics or TOPICS, encoder=FakeEncoder(DIMENSIONS))


def test_tags_an_article_with_the_topic_it_is_closest_to():
    article = "La campagne d'hameçonnage imitait un message de la banque, et la fuite de données a suivi."
    labeller = make_labeller()
    assert tag(labeller, article) == ["cybersécurité"]
    assert round(score(labeller, article)["cybersécurité"], 4) == 0.5692


def test_an_article_carries_several_topics_at_once():
    article = "Les indemnités de télétravail versées aux salariés sont soumises à la TVA et à l'impôt."
    assert tag(make_labeller(), article) == ["télétravail", "fiscalité"]


def test_the_descriptions_are_encoded_once_not_once_per_article():
    """The point of building a labeller: the expensive call happens up front."""
    encoder = FakeEncoder(DIMENSIONS)
    labeller = build_labeller(TOPICS, encoder=encoder)
    assert encoder.calls == [list(TOPICS.values())]
    tag(labeller, "un article")
    assert encoder.calls[1] == ["un article"]


def test_an_empty_article_scores_zero_everywhere():
    labeller = make_labeller()
    assert set(score(labeller, "").values()) == {0.0}
    assert tag(labeller, "") == []


def test_a_new_topic_costs_one_line_and_no_labelled_example():
    """
    This is what the rung buys, and it is exactly the breaking point of N1:
    there, a topic absent from the labelled corpus could never be answered.
    Here the topic is added to the dictionary and the next article carries it.
    """
    article = (
        "La région finance une partie du matériel acheté par les entreprises "
        "industrielles, via un guichet de subvention ouvert jusqu'en juin."
    )
    assert tag(make_labeller(), article) == []

    extended = dict(TOPICS)
    extended["subventions"] = (
        "Les subventions publiques : la subvention de la région, le guichet "
        "d'aide et le financement du matériel."
    )
    assert tag(make_labeller(extended), article) == ["subventions"]


def test_what_the_double_cannot_prove():
    """
    The article that defeats N0, and that N1 only caught because someone had
    labelled a dozen like it: remote work never named.

    A real encoder is supposed to place it near the topic sentence. The double
    is a bag of words, so it scores remote work exactly as high as computer
    security and recruitment — that is, on "le", "la" and "de", not on
    meaning. This test asserts the double's silence instead of implying a win
    nobody measured.
    """
    article = (
        "Depuis le printemps, l'équipe ne se retrouve au bureau que le mardi. "
        "Le reste de la semaine, chacun s'organise depuis chez lui, et les "
        "réunions se tiennent en visioconférence."
    )
    scored = score(make_labeller(), article)
    assert scored["télétravail"] == scored["cybersécurité"] == scored["recrutement"]
    assert tag(make_labeller(), article) == []


def test_breaking_point_a_cosine_is_not_a_probability():
    """
    The breaking point of this rung. The article above is four sentences of
    computer security and one line of tax law, and the tax topic is real: an
    editor would file it under both.

    The cosine of the whole article against the tax sentence is dragged down by
    everything else in the text, so the second topic falls under the threshold.
    Lowering the threshold until it comes back also lets in remote work, which
    the article never mentions.

    There is no threshold that separates them, because a cosine is not
    calibrated: it has no meaning to compare across topics, and the only honest
    way to pick one is to try it against articles someone has already tagged by
    hand — a labelled corpus, the very thing this rung promised to save.
    """
    labeller = make_labeller()
    assert tag(labeller, LONG_ARTICLE) == ["cybersécurité"]
    assert tag(labeller, LONG_ARTICLE, threshold=0.15) == [
        "cybersécurité",
        "fiscalité",
        "télétravail",
    ]
