from n1 import is_hiding_contact_details, shape, train

# A small labelled set, the kind an afternoon of tagging produces.
HIDING = [
    "call me on zero six twelve thirty four fifty six",
    "reach me at O6 I2 34 56 78",
    "my number is 06 12 34 56 78",
    "ring zero six one two three four five six seven eight",
    "phone: 0 6 1 2 3 4 5 6 7 8",
    "text me on o6.i2.34.56.78",
    "contact seven eight nine four five six one two",
    "my line is O6-I2-34-56-78 thanks",
]

ORDINARY = [
    "the meeting is at ten in room four",
    "we shipped version two point three yesterday",
    "there are six items left in stock",
    "please review the 2024 report before friday",
    "invoice 4512 is still unpaid",
    "the build takes about three minutes",
    "chapter seven covers the migration",
    "we need four more seats for the workshop",
]


def make_model():
    return train(HIDING + ORDINARY, [1] * len(HIDING) + [0] * len(ORDINARY))


def test_shape_folds_digits_and_lookalikes():
    assert shape("O6 I2 34") == "DD DD DD"
    assert "D" in shape("call me on zero six")


def test_shape_keeps_words_and_drops_punctuation():
    assert shape("hi! my number, ok?") == "hi my number ok"


def test_shape_does_not_fold_letters_that_carry_no_digit():
    # Folding unconditionally would turn « loll » into 1011.
    assert shape("loll that is funny") == "loll that is funny"


def test_catches_a_spelled_out_number_that_n0_misses():
    model = make_model()
    assert is_hiding_contact_details(model, "call me on zero six twelve thirty four")


def test_catches_lookalike_characters():
    model = make_model()
    assert is_hiding_contact_details(model, "reach me at O6 I2 34 56 78")


def test_leaves_an_ordinary_message_alone():
    model = make_model()
    assert not is_hiding_contact_details(model, "the meeting is at ten in room four")


def test_threshold_is_yours_to_set():
    model = make_model()
    message = "there are six items left in stock"
    # A threshold of zero blocks everything, which is the point of exposing it.
    assert is_hiding_contact_details(model, message, threshold=0.0)


def test_catches_emoji_keycaps_because_they_contain_real_digits():
    model = make_model()
    assert is_hiding_contact_details(model, "call me on 0\ufe0f\u20e36\ufe0f\u20e3 1\ufe0f\u20e32\ufe0f\u20e3 3\ufe0f\u20e34\ufe0f\u20e3")


def test_breaking_point_an_evasion_absent_from_the_training_set():
    """
    The breaking point claimed on the entry: the model only knows the evasions
    it was shown. Homoglyphs from another script, and Roman numerals, carry no
    digit and no known digit word, so nothing survives the shaping.

    Every new trick costs a new round of labelling. That is the real price of
    this rung, and it is why the entry does not recommend it lightly.
    """
    model = make_model()
    cyrillic = "reach me at \u041e\u0431 \u0406b \u0417\u0427"
    roman = "call me on VI XII XXXIV LVI"
    assert not is_hiding_contact_details(model, cyrillic)
    assert not is_hiding_contact_details(model, roman)
