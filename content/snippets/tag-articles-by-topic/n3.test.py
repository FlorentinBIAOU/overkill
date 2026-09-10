"""
These tests inject a local double instead of calling a provider.

What they prove: the request carries the article and the whole taxonomy, the
answer is decoded, oversized input is refused before anything is spent,
failures are retried, invented topics are dropped, and an unusable answer does
not quietly become an untagged article.

What they do not prove: that the model tags well. That is why this snippet is
declared `verification: stubbed` on the entry, and why the page says so next to
the code.
"""

import json

import pytest

from _harness.fake_llm import FakeLLM
from n3 import MAX_CHARACTERS, TaggingUnavailable, tag

# The same controlled vocabulary as N0. On this rung it is no longer a list of
# terms to match, only the list of names the model is allowed to answer with.
TOPICS = ["cybersécurité", "fiscalité", "recrutement", "télétravail"]

ARTICLE = "Les indemnités de télétravail versées aux salariés sont soumises à l'impôt."


def test_tags_what_the_model_reports():
    client = FakeLLM(response='["télétravail"]')
    assert tag(ARTICLE, TOPICS, client=client) == ["télétravail"]


def test_an_article_comes_back_with_several_topics():
    client = FakeLLM(response=json.dumps(["télétravail", "fiscalité"]))
    # In the order of the taxonomy, not the order the model happened to use:
    # two identical calls must file an article the same way twice.
    assert tag(ARTICLE, TOPICS, client=client) == ["fiscalité", "télétravail"]


def test_sends_the_article_and_the_whole_taxonomy_in_the_prompt():
    client = FakeLLM(response="[]")
    tag(ARTICLE, TOPICS, client=client)
    prompt = client.last_request["prompt"]
    assert ARTICLE in prompt
    for topic in TOPICS:
        assert topic in prompt
    # Temperature zero, because a taxonomy that changes between two identical
    # calls is not a taxonomy.
    assert client.last_request["temperature"] == 0


def test_an_empty_answer_is_a_legitimate_answer():
    client = FakeLLM(response="[]")
    assert tag("Le restaurant du coin a changé de carte.", TOPICS, client=client) == []


def test_a_topic_the_taxonomy_does_not_know_is_dropped():
    """A model asked for four topics will still offer a fifth of its own."""
    client = FakeLLM(response=json.dumps(["actualité juridique", "Fiscalité"]))
    # Case is forgiven, since only the spelling of a known topic is restored.
    # An invented topic is not: it would create a tag in your database.
    assert tag(ARTICLE, TOPICS, client=client) == ["fiscalité"]


def test_refuses_oversized_input_before_spending_anything():
    client = FakeLLM(response="[]")
    with pytest.raises(ValueError):
        tag("x" * (MAX_CHARACTERS + 1), TOPICS, client=client)
    assert client.call_count == 0


def test_retries_a_provider_failure():
    client = FakeLLM(response="[]", fail_times=2)
    tag(ARTICLE, TOPICS, client=client, attempts=3)
    assert client.call_count == 3


def test_gives_up_after_the_last_attempt():
    client = FakeLLM(response="[]", fail_times=5)
    with pytest.raises(TaggingUnavailable):
        tag(ARTICLE, TOPICS, client=client, attempts=3)
    assert client.call_count == 3


def test_breaking_point_an_unusable_answer_raises_rather_than_tagging_nothing():
    """
    The breaking point claimed on the entry: the model can answer anything,
    including prose where JSON was asked for.

    An empty list is a legitimate answer here — plenty of articles carry no
    topic. So a function that shrugged and returned an empty list on a broken
    answer would make a failure indistinguishable from a correct result, and
    the articles would quietly fall out of every topic page on the site.

    It raises instead, and the caller decides whether to retry later or to file
    the article for a human.
    """
    client = FakeLLM(response="Bien sûr ! Voici les thèmes de cet article :")
    with pytest.raises(TaggingUnavailable):
        tag(ARTICLE, TOPICS, client=client)
