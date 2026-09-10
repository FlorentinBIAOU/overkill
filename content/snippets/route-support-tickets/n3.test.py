"""
These tests inject a local double instead of calling a provider.

What they prove: the prompt carries the ticket and the list of teams, the
answer is decoded, oversized input is refused before anything is spent,
failures are retried, an unparseable answer raises instead of routing at
random, and a team the model invented never becomes a queue.

What they do not prove: that the model reads tickets well. That is why this
snippet is declared `verification: stubbed` on the entry, and why the page
says so next to the code.
"""

import pytest

from _harness.fake_llm import FakeLLM
from n3 import DEFAULT_TEAM, MAX_CHARACTERS, RoutingUnavailable, route

BILLING = "Le prélèvement de mars est passé deux fois, merci de m'en rembourser un."


def test_routes_the_ticket_to_the_team_the_model_names():
    client = FakeLLM(response='{"team": "billing"}')
    assert route(BILLING, client=client) == "billing"


def test_sends_the_ticket_and_the_list_of_teams_at_temperature_zero():
    client = FakeLLM(response='{"team": "shipping"}')
    route("Mon colis n'est pas arrivé", client=client)
    prompt = client.last_request["prompt"]
    assert "Mon colis n'est pas arrivé" in prompt
    # The list of teams has to be in the prompt: a model cannot pick from a
    # list it was never shown.
    assert "billing, technical, shipping" in prompt
    assert client.last_request["temperature"] == 0


def test_a_team_written_in_another_case_is_still_a_team():
    # Models capitalise, and pad. Being strict here would send correct answers
    # to the default queue.
    client = FakeLLM(response='{"team": "  Billing "}')
    assert route(BILLING, client=client) == "billing"


def test_refuses_oversized_input_before_spending_anything():
    client = FakeLLM(response='{"team": "billing"}')
    with pytest.raises(ValueError):
        route("x" * (MAX_CHARACTERS + 1), client=client)
    assert client.call_count == 0


def test_retries_a_provider_failure():
    client = FakeLLM(response='{"team": "billing"}', fail_times=2)
    assert route(BILLING, client=client, attempts=3) == "billing"
    assert client.call_count == 3


def test_an_unparseable_answer_raises_rather_than_routing_at_random():
    # Prose where JSON was asked for. Falling back to a team here would hide a
    # provider incident behind a queue that keeps filling up.
    client = FakeLLM(response="Bien sûr ! Ce ticket concerne la facturation.")
    with pytest.raises(RoutingUnavailable):
        route(BILLING, client=client, attempts=2)
    assert client.call_count == 2


def test_an_answer_without_a_team_goes_to_the_default_queue():
    client = FakeLLM(response='{"reason": "not sure"}')
    assert route(BILLING, client=client) == DEFAULT_TEAM


def test_breaking_point_the_model_invents_a_queue():
    """
    The breaking point of this rung: the model answers words, not queues.

    Asked to pick from three teams, it confidently returns a fourth that
    sounds plausible and does not exist. Nothing in the answer says so — it is
    well-formed JSON, and the model is not hedging.

    The closed list catches it and the ticket goes to the default queue. Take
    that check out, as the first version of this kind of code usually does,
    and the ticket is filed into a team nobody created and nobody watches.
    """
    for invented in ('{"team": "customer success"}', '{"team": "Facturation"}',
                     '{"team": ["billing", "shipping"]}'):
        client = FakeLLM(response=invented)
        assert route(BILLING, client=client) == DEFAULT_TEAM
