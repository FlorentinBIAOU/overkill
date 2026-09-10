from n0 import score_sentences, split_sentences, summarise

# A short internal report, the kind of document someone actually pastes in.
REPORT = (
    "The support team migrated the ticketing system to a new platform in March. "
    "The migration moved every open ticket to the new platform without losing a "
    "single attachment. "
    "Every agent was trained on the new platform during the two weeks before the switch. "
    "The old platform stayed available in read-only mode for a month afterwards. "
    "Agents report that search on the new platform is faster than it was before. "
    "One customer complained about the new ticket numbering, so the team kept the "
    "old numbers visible. "
    "The migration is finished and the old platform has been shut down."
)

# A document whose conclusion is spread across its two ends. The first sentence
# and the last one are each true and each incomplete; put together they say the
# Lyon assembly line stops at the end of March. No sentence says that.
SUPPLY = "The Rouen plant supplies every battery cell used on the Lyon assembly line."
CLOSURE = "The Rouen plant will close at the end of March."
FACTORY = " ".join(
    [
        SUPPLY,
        "The warehouse in Rouen keeps four weeks of packaging material on site.",
        "Packaging is ordered from two suppliers, and the second supplier was added last year.",
        "The warehouse team works two shifts, and a third shift is added before the summer.",
        "Deliveries leave the warehouse every morning except on Sunday.",
        "The warehouse floor was repainted in April and the racks were replaced at the same time.",
        "A new forklift was bought for the warehouse, and two drivers were trained on it.",
        "The packaging supplier in Lille raised its prices, and the warehouse renegotiated the contract.",
        "The warehouse now reports its stock levels every week instead of every month.",
        "Staff turnover in the warehouse fell after the shift pattern was changed.",
        CLOSURE,
    ]
)


def test_returns_the_asked_number_of_sentences():
    assert len(split_sentences(summarise(REPORT, max_sentences=3))) == 3
    assert len(split_sentences(summarise(REPORT, max_sentences=5))) == 5


def test_every_sentence_of_the_summary_comes_from_the_document():
    """Extractive means quoted. Nothing here is written, only chosen."""
    for sentence in split_sentences(summarise(REPORT, max_sentences=3)):
        assert sentence in REPORT


def test_keeps_document_order_rather_than_score_order():
    summary = split_sentences(summarise(REPORT, max_sentences=4))
    positions = [split_sentences(REPORT).index(s) for s in summary]
    assert positions == sorted(positions)


def test_picks_the_opening_and_the_dense_sentences():
    summary = summarise(REPORT, max_sentences=3)
    assert summary.startswith("The support team migrated the ticketing system")
    assert "trained on the new platform" in summary


def test_a_single_sentence_document_is_its_own_summary():
    text = "The plant will close at the end of March."
    assert summarise(text, max_sentences=3) == text


def test_an_empty_document_gives_an_empty_summary():
    assert summarise("", max_sentences=3) == ""
    assert summarise("   \n  ", max_sentences=3) == ""


def test_asking_for_more_sentences_than_exist_returns_the_document():
    text = "First point. Second point. Third point."
    assert summarise(text, max_sentences=10) == text


def test_a_long_sentence_does_not_win_by_length_alone():
    """
    Density, not volume. A rambling sentence made of connectives scores near
    zero however long it is, which is the whole reason for dividing by length.
    """
    padding = (
        "It is, as it has been said, in the way that they were and that there "
        "was, of the sort that this is and that it has been."
    )
    text = REPORT + " " + padding
    assert padding not in summarise(text, max_sentences=3)


def test_breaking_point_two_ideas_ten_pages_apart_are_never_joined():
    """
    The breaking point claimed on the entry: an extractive summary does not
    relate two ideas separated by ten pages, and it never rewrites.

    Both halves of the argument are in this document. The closing sentence is
    short, late, and uses vocabulary the rest of the document never repeats,
    so it scores lowest of all eleven sentences and is dropped first. The
    reader of the summary learns that Rouen supplies Lyon, and never learns
    that Rouen is closing.

    Widening the summary does not save it: the conclusion is not a sentence
    anyone wrote, so no selection of sentences can contain it. Only a method
    that writes new text can state it, which is what the rungs above do.
    """
    sentences = split_sentences(FACTORY)
    scores = score_sentences(sentences)
    assert scores.index(min(scores)) == sentences.index(CLOSURE)

    summary = summarise(FACTORY, max_sentences=3)
    assert SUPPLY in summary
    assert CLOSURE not in summary

    # Even at eight sentences out of eleven, the second premise is still out.
    assert CLOSURE not in summarise(FACTORY, max_sentences=8)

    # And no sentence of the document states the conclusion, so no extractive
    # summary of any width could ever return it.
    assert not any("assembly" in s and "March" in s for s in sentences)
