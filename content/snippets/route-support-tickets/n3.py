"""
Route a ticket by asking a general-purpose model.

Rung N3. This is the option people reach for first, and it is the shortest
piece of routing logic on the entry: no rules to maintain, no archive to
label, and a ticket in any language.

Note what the code has to do that N0 did not: cap the input size, retry a
provider that fails, parse an answer that is only probably JSON, and refuse a
team the model made up. That plumbing is the real cost of this rung, and it is
the part your tests have to cover, because the model itself is not testable.

Read the end of `route` closely. A model answers with words, and
words are not queues. The closed list is the only thing standing between a
confident answer and a ticket sitting in a queue nobody watches.
"""

from __future__ import annotations

import json

# The queues that exist. Business knowledge, and here also a safety rail.
TEAMS = ("billing", "technical", "shipping")
DEFAULT_TEAM = "general"

MAX_CHARACTERS = 4000

PROMPT = (
    "You are routing a customer support ticket to one team.\n"
    "Answer with JSON only: {{\"team\": \"...\"}} where team is one of: {teams}.\n"
    "If the ticket does not clearly belong to one of them, answer {default!r}.\n\n"
    "Ticket:\n{ticket}"
)


class RoutingUnavailable(Exception):
    """The provider could not be reached, or answered something unparseable."""


def route(ticket: str, client=None, *, attempts: int = 3) -> str:
    """
    The team that gets the ticket.

    `client` is injected so this function can be tested without a network
    call. In production it defaults to a real provider client.
    """
    if client is None:  # pragma: no cover - needs a key and a network
        from openai import OpenAI

        client = OpenAI()

    # A model charges by the token, and a ticket with a forwarded thread under
    # it is long. Refusing oversized input is not an optimisation, it is a
    # cost control.
    if len(ticket) > MAX_CHARACTERS:
        raise ValueError(f"ticket longer than {MAX_CHARACTERS} characters")

    answer = _ask(client, ticket, attempts)
    team = answer.get("team") if isinstance(answer, dict) else None
    team = str(team).strip().lower() if team is not None else ""
    # Two failures, two treatments. A provider that cannot answer is an
    # incident, and `_ask` above raises. A model that answers a team nobody
    # created is a normal Tuesday, and the ticket goes to the default queue.
    return team if team in TEAMS else DEFAULT_TEAM


def _ask(client, ticket: str, attempts: int) -> dict:
    prompt = PROMPT.format(teams=", ".join(TEAMS), default=DEFAULT_TEAM, ticket=ticket)
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            # Temperature zero, because a routing decision that changes
            # between two identical calls cannot be reviewed.
            return json.loads(client.complete(prompt=prompt, temperature=0))
        except Exception as error:  # noqa: BLE001 - any provider failure is retried
            last_error = error
    raise RoutingUnavailable(str(last_error))
