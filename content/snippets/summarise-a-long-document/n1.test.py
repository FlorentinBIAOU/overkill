from n1 import sentence_features, split_sentences, summarise, train

# Four documents whose summary sentences someone has ticked off. A real corpus
# is a few dozen of these; four is enough to show what the model learns, which
# here is that the opening, the sentence carrying a figure, and the wrap-up are
# what a reader keeps.
DOCUMENTS = [
    [
        "The payment service was unavailable for most of Tuesday morning.",
        "A configuration change was deployed at 8 in the morning and rolled back at 11.",
        "The on-call engineer was paged twice before the cause was found.",
        "Support answered the calls that came in during the outage.",
        "The queue drained on its own once the change was reverted.",
        "Overall the payment service lost a morning of availability.",
    ],
    [
        "The regional sales review covers the shops in the north.",
        "2 shops opened during the period and one closed.",
        "The staff in Lille asked for a second till.",
        "Deliveries arrive on Tuesday and on Friday.",
        "The window display was changed for the season.",
        "Therefore the north region grew despite the closure.",
    ],
    [
        "The migration project moved the archive to the new storage.",
        "40 nights of copying were needed to move the archive.",
        "The old drives were kept in the basement for now.",
        "Nobody reported a missing file during the check.",
        "The copy tool was written by the infrastructure team.",
        "In conclusion the archive migration is complete.",
    ],
    [
        # This one opens on a formality, so the model cannot simply learn
        # "the first sentence is always in".
        "The committee met on Thursday in the small room.",
        "The budget for the next year was presented to the committee.",
        "Three members asked about the training line.",
        "The training line was raised by 12 in the budget.",
        "The coffee machine will be replaced.",
        "Finally the committee approved the budget.",
    ],
]

LABELS = [[1, 1, 0, 0, 0, 1], [1, 1, 0, 0, 0, 1], [1, 1, 0, 0, 0, 1], [0, 1, 0, 1, 0, 1]]

AUDIT_LEAD = "The warehouse audit looked at how stock is counted."
AUDIT_FIGURE = "The count needs 2 people and takes a full day."
AUDIT_WRAP_UP = "Overall the audit recommends counting the spare parts aisle weekly."
AUDIT = " ".join(
    [
        AUDIT_LEAD,
        "The count is done by hand on the last Friday of the month.",
        AUDIT_FIGURE,
        "The audit found that the count matches the system in most aisles.",
        "The aisle holding spare parts was the only one out of line.",
        AUDIT_WRAP_UP,
    ]
)

# The same two-ended document the N0 test uses.
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


def make_model():
    return train(DOCUMENTS, LABELS)


def test_features_read_position_length_figures_cues_and_echo():
    sentences = DOCUMENTS[0]
    lead, length, figure, cue, echo = sentence_features(sentences, 0)
    assert lead == 1.0 and figure == 0.0 and cue == 0.0
    assert 0.0 < length < 1.0
    assert echo == 1.0  # the opening echoes itself entirely

    _, _, figure, cue, _ = sentence_features(sentences, 1)
    assert figure == 1.0 and cue == 0.0  # "8" and "11" are figures

    _, _, _, cue, _ = sentence_features(sentences, 5)
    assert cue == 1.0  # "Overall"


def test_the_length_feature_saturates_on_a_very_long_sentence():
    """A single rambling sentence must not stretch the scale for the rest."""
    long_one = ["Short one.", " ".join(["word"] * 200) + "."]
    assert sentence_features(long_one, 1)[1] == 1.0


def test_keeps_the_wrap_up_a_fixed_lead_bonus_would_drop():
    model = make_model()
    summary = summarise(model, AUDIT, max_sentences=3)
    assert AUDIT_LEAD in summary
    assert AUDIT_FIGURE in summary
    # The last sentence of the document, and the one a reader would keep.
    assert AUDIT_WRAP_UP in summary


def test_the_two_best_sentences_are_the_opening_and_the_wrap_up():
    model = make_model()
    assert summarise(model, AUDIT, max_sentences=2) == f"{AUDIT_LEAD} {AUDIT_WRAP_UP}"


def test_the_summary_is_still_made_of_the_document_own_sentences():
    model = make_model()
    for sentence in split_sentences(summarise(model, AUDIT, max_sentences=3)):
        assert sentence in AUDIT


def test_keeps_document_order():
    model = make_model()
    summary = split_sentences(summarise(model, AUDIT, max_sentences=4))
    positions = [split_sentences(AUDIT).index(s) for s in summary]
    assert positions == sorted(positions)


def test_a_single_sentence_document_is_its_own_summary():
    model = make_model()
    text = "The plant will close at the end of March."
    assert summarise(model, text, max_sentences=3) == text


def test_an_empty_document_gives_an_empty_summary():
    model = make_model()
    assert summarise(model, "", max_sentences=3) == ""
    assert summarise(model, "   \n ", max_sentences=3) == ""


def test_breaking_point_surface_features_score_the_look_not_the_content():
    """
    The ceiling of this rung, in two parts.

    First, the features describe a sentence from the outside. A sentence that
    is early, carries a figure, opens with a cue word and repeats the words of
    the title looks exactly like a summary sentence, and is picked, even when
    what it says is that somebody ordered clipboards. The real finding of the
    audit — an aisle miscounted for months — has none of those markers and is
    left out. No amount of extra labelling fixes this: the model is not being
    shown the meaning of the sentence, so it cannot weigh it.

    Second, this rung is still extractive. On the two-ended document it does
    better than N0, retrieving both premises. It still does not state the
    conclusion they imply, because stating it would mean writing a sentence
    nobody wrote, and nothing in this file writes anything.
    """
    model = make_model()

    decoy = "Overall the warehouse audit ordered 6 new clipboards for counting stock."
    finding = "The spare parts aisle has been miscounted every month since the spring."
    dressed_up = " ".join(
        [
            "The warehouse audit looked at how stock is counted.",
            decoy,
            finding,
            "Nobody has reconciled the spare parts aisle against the supplier notes.",
            "The counting staff work on the last Friday of each month.",
            "The clipboards will be delivered next week.",
        ]
    )
    summary = summarise(model, dressed_up, max_sentences=2)
    assert decoy in summary
    assert finding not in summary

    both_premises = summarise(model, FACTORY, max_sentences=2)
    assert SUPPLY in both_premises and CLOSURE in both_premises
    # Both halves are there, and the conclusion still is not: no sentence of
    # the document says the Lyon line stops, so no selection can return it.
    assert not any(
        "assembly" in s and "March" in s for s in split_sentences(both_premises)
    )
