"""
These tests inject a local double instead of calling a provider.

What they prove: the retrieved passages really travel inside the prompt, the
pack is capped in number and in length, nothing is asked of the model when
retrieval found nothing, a failure is retried, an unusable reply raises, and an
answer citing a passage nobody sent is refused.

What they do not prove: that the answer is true. The last test below shows
exactly how far the grounding check goes, and where it stops. That is why the
entry declares this snippet `verification: stubbed`.
"""

import json

import pytest

from _harness.fake_llm import FakeLLM
from n3 import MAX_CHARACTERS, NO_ANSWER, AnswerNotGrounded, AnswerUnavailable, answer

# What a search over the handbook returned for the question below.
PASSAGES = [
    {"id": "conges", "text": "Le salarié acquiert deux jours et demi de congés payés "
                             "par mois de travail effectif."},
    {"id": "frais", "text": "Les notes de frais se déposent avant le cinq du mois."},
]

QUESTION = "combien de jours de congés par mois ?"


def test_returns_the_answer_and_its_sources():
    client = FakeLLM(response=json.dumps({"answer": "Deux jours et demi par mois.",
                                          "sources": ["conges"]}))
    assert answer(QUESTION, PASSAGES, client=client) == {
        "answer": "Deux jours et demi par mois.",
        "sources": ["conges"],
    }


def test_every_retrieved_passage_travels_inside_the_prompt():
    client = FakeLLM(response=json.dumps({"answer": NO_ANSWER, "sources": []}))
    answer(QUESTION, PASSAGES, client=client)
    prompt = client.last_request["prompt"]
    for passage in PASSAGES:
        assert passage["text"] in prompt
        assert f"[{passage['id']}]" in prompt  # so the model can cite it
    assert QUESTION in prompt
    assert client.last_request["temperature"] == 0


def test_only_the_best_passages_are_sent():
    # Retrieval returns a ranking; the prompt takes the head of it. Sending
    # everything found is how a context window fills up with noise.
    client = FakeLLM(response=json.dumps({"answer": NO_ANSWER, "sources": []}))
    answer(QUESTION, PASSAGES, client=client, max_passages=1)
    assert PASSAGES[1]["text"] not in client.last_request["prompt"]


def test_a_very_long_passage_is_cut_before_it_is_sent():
    client = FakeLLM(response=json.dumps({"answer": NO_ANSWER, "sources": []}))
    long_passage = [{"id": "conges", "text": "x" * (MAX_CHARACTERS + 100)}]
    answer(QUESTION, long_passage, client=client)
    assert "x" * MAX_CHARACTERS in client.last_request["prompt"]
    assert "x" * (MAX_CHARACTERS + 1) not in client.last_request["prompt"]


def test_nothing_retrieved_means_nothing_asked():
    client = FakeLLM(response="{}")
    assert answer(QUESTION, [], client=client) == {"answer": NO_ANSWER, "sources": []}
    assert client.call_count == 0


def test_the_model_may_say_it_does_not_know_without_citing_anything():
    client = FakeLLM(response=json.dumps({"answer": NO_ANSWER, "sources": []}))
    assert answer(QUESTION, PASSAGES, client=client)["sources"] == []


def test_retries_a_provider_failure():
    client = FakeLLM(response=json.dumps({"answer": NO_ANSWER, "sources": []}), fail_times=1)
    answer(QUESTION, PASSAGES, client=client, attempts=2)
    assert client.call_count == 2


def test_prose_where_json_was_asked_for_raises():
    client = FakeLLM(response="Bien sûr ! Vous avez droit à…")
    with pytest.raises(AnswerUnavailable):
        answer(QUESTION, PASSAGES, client=client)


def test_a_citation_nobody_sent_is_refused():
    # The clearest sign of an invented answer, and the cheapest to catch.
    client = FakeLLM(response=json.dumps({"answer": "Voir l'accord d'entreprise.",
                                          "sources": ["accord-2019"]}))
    with pytest.raises(AnswerNotGrounded):
        answer(QUESTION, PASSAGES, client=client)


def test_an_answer_that_cites_nothing_is_refused():
    client = FakeLLM(response=json.dumps({"answer": "Trente jours ouvrés.", "sources": []}))
    with pytest.raises(AnswerNotGrounded):
        answer(QUESTION, PASSAGES, client=client)


def test_breaking_point_a_real_citation_on_an_invented_sentence():
    """
    The breaking point of this rung: the check above reads the citations, not
    the answer.

    Here the model cites the passage it was actually given, and writes a
    sentence that passage flatly contradicts — the handbook says two and a half
    days a month, the answer says thirty days on arrival. Every check in this
    snippet passes, and the answer comes back with a source next to it, which
    is precisely what makes it convincing.

    Whoever reads it has to open the passage to find out, which is the work
    retrieval was supposed to save. There is no line of code below that fixes
    this; there is a human, or there is a risk you accept knowingly.
    """
    invented = "Vous avez trente jours ouvrés de congés dès l'embauche."
    client = FakeLLM(response=json.dumps({"answer": invented, "sources": ["conges"]}))
    result = answer(QUESTION, PASSAGES, client=client)
    assert result == {"answer": invented, "sources": ["conges"]}
    assert "deux jours et demi" in PASSAGES[0]["text"]  # what the source really says
