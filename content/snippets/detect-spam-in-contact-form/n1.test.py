from n1 import fold, is_spam, spam_score, train

# A small labelled set, the kind an afternoon spent in the inbox produces.
SPAM = [
    "Hello, we offer guaranteed first page ranking on Google for your website.",
    "Boost your traffic with our premium backlink packages at cheap prices.",
    "Dear sir, I can improve your website ranking within one month, low cost.",
    "Earn passive income trading crypto, join our telegram channel right now.",
    "We provide guest posting services on high authority blogs, best rates.",
    "Buy cheap followers and likes for your social media accounts today.",
    "Your website design looks outdated, we redesign it for a very low price.",
    "Congratulations, you have won a prize, click the link below to claim it.",
    "We are an offshore web development company, hire our developers cheap.",
    "Increase your sales with our bulk email marketing database of contacts.",
    "Dear owner, your domain is expiring, renew it today at a discount price.",
    "We sell verified leads for your industry, guaranteed results, free trial.",
    "Hello dear, I have a business proposal worth millions, reply for details.",
    "Get thousands of visitors to your website every month, no effort needed.",
    "Our agency offers unlimited traffic and top rankings, first month free.",
    "Special offer this week only, cheap logo design and unlimited revisions.",
]

GENUINE = [
    "Hello, I ordered a lamp last week and it arrived damaged, what should I do?",
    "Could you tell me if the workshop on tuesday is still open for registration?",
    "I would like a quote for repainting the shutters of a house near Nantes.",
    "Your online form refused my postcode, I live abroad, can you help me?",
    "Good morning, is the shop open on saturday afternoon during august?",
    "I sent an invoice three weeks ago and it is still unpaid, who do I contact?",
    "Do you deliver to Belgium, and how long does the delivery usually take?",
    "The instructions in the manual mention a part that was not in the box.",
    "I lost the receipt for a purchase made in june, can you send a copy?",
    "Hello, my order number 4512 has not moved for ten days, is it lost?",
    "Is the blue model still available in size medium, or is it discontinued?",
    "We are a school and would like to visit your workshop with fifteen pupils.",
    "The battery of the device I bought in march no longer holds a charge.",
    "Can I change the delivery address of an order that was placed yesterday?",
    "Hello, I would like to cancel my subscription before the next renewal.",
    "Your newsletter arrives twice, could you remove the duplicate address?",
]


def make_model():
    return train(SPAM + GENUINE, [1] * len(SPAM) + [0] * len(GENUINE))


MODEL = make_model()


def test_folding_removes_case_and_accents():
    assert fold("Commande Cassée") == "commande cassee"


def test_catches_a_solicitation_it_has_never_seen():
    assert is_spam(MODEL, "Hi, we can boost your google ranking with quality links, cheap offer.")


def test_leaves_a_new_customer_enquiry_alone():
    assert not is_spam(MODEL, "Hello, my parcel arrived yesterday but the box was open.")


def test_catches_the_spellings_that_walk_past_a_word_list():
    """Character n-grams see the shape of a word, not its exact letters."""
    for written in (
        "we sell b a c k l i n k s and cheap traffic, boost your rankings today",
        "we sell backl1nks and cheap seo packages, boost your ranking now",
    ):
        assert is_spam(MODEL, written), written


def test_survives_accents_and_a_very_long_message():
    assert not is_spam(MODEL, "Bonjour, ma commande est arrivée cassée, que dois-je faire ?")
    repeated = "Hello, I ordered a lamp last week and it arrived damaged. " * 20
    assert not is_spam(MODEL, repeated)


def test_the_threshold_is_yours_to_set():
    enquiry = "Hello, my parcel arrived yesterday but the box was open."
    # A threshold of zero rejects everything, which is the point of exposing it.
    assert is_spam(MODEL, enquiry, threshold=0.0)


def test_score_is_a_probability():
    assert 0.0 <= spam_score(MODEL, "anything at all") <= 1.0


def test_breaking_point_a_solicitation_written_in_the_register_of_a_customer():
    """
    The breaking point claimed on the entry: this rung learns the register of
    the messages it was shown. A sender who writes like a customer, short,
    polite, no offer, no price, no link, scores like a customer.

    It is the same message that walks past N0, and it walks past N1 too. The
    difference between the two rungs is the flood in between, not this sender.
    """
    patient_bot = (
        "Good morning, I came across your company and I would like to discuss "
        "a partnership to increase your visibility. When would suit you?"
    )
    assert spam_score(MODEL, patient_bot) < 0.5
    assert not is_spam(MODEL, patient_bot)
