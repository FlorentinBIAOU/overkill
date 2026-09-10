from n0 import fold, is_spam, reasons

GENUINE = {
    "name": "Claire Dubois",
    "email": "claire@example.com",
    "message": "Hello, I ordered a lamp last week and it arrived damaged. What should I do?",
    "website": "",
}


def test_accepts_a_genuine_enquiry():
    assert reasons(GENUINE, seconds_on_page=42) == []
    assert not is_spam(GENUINE, seconds_on_page=42)


def test_catches_a_filled_honeypot():
    bot = {**GENUINE, "website": "http://example.com"}
    assert reasons(bot, seconds_on_page=42) == ["honeypot filled"]


def test_catches_a_submission_faster_than_a_human_can_type():
    assert "submitted too fast" in reasons(GENUINE, seconds_on_page=0.4)


def test_catches_a_wall_of_links():
    fields = {**GENUINE, "message": "visit http://a.com and www.b.net and http://c.org and d.xyz"}
    assert "too many links" in reasons(fields, seconds_on_page=42)


def test_tolerates_the_one_link_a_customer_actually_sends():
    fields = {**GENUINE, "message": "the page http://example.com/order-4512 shows an error"}
    assert reasons(fields, seconds_on_page=42) == []


def test_names_the_banned_phrase_it_found():
    fields = {**GENUINE, "message": "We sell cheap backlink packages for your site."}
    assert reasons(fields, seconds_on_page=42) == ["banned phrase: backlink"]


def test_folding_survives_case_and_accents():
    assert fold("BÁCKLÎNK") == "backlink"
    fields = {**GENUINE, "message": "Cheap BÁCKLÎNKS, best prices."}
    assert "banned phrase: backlink" in reasons(fields, seconds_on_page=42)


def test_handles_an_empty_form_and_a_very_long_message():
    assert reasons({}, seconds_on_page=42) == []
    long_message = "I have a question about my order. " * 500
    assert reasons({**GENUINE, "message": long_message}, seconds_on_page=42) == []


def test_breaking_point_a_patient_bot_that_avoids_links():
    """
    The breaking point claimed on the entry: none of the four checks looks at
    intent. A script that waits before posting, leaves the hidden field alone,
    sends no link and avoids the vocabulary of the list walks straight through.

    Writing the failure down here is what keeps the entry honest: this rung
    stops the cheap flood, not the patient sender.
    """
    patient_bot = {
        "name": "Growth Team",
        "email": "outreach@example.com",
        "message": (
            "Good morning, I came across your company and I would like to discuss "
            "a partnership to increase your visibility. When would suit you?"
        ),
        "website": "",
    }
    assert reasons(patient_bot, seconds_on_page=30) == []
    assert not is_spam(patient_bot, seconds_on_page=30)
