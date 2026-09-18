"""
Route a ticket by asking a general-purpose model.

Rung N3. No rules to maintain and no archive to label: the team names go in
the prompt, and the model answers with one of them.

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


# The provider named here is an example, not a recommendation: the reasoning
# holds for any general-purpose model API, and the client is swappable. Pass
# any object with a `complete(prompt=..., temperature=...)` method.
MODEL = "gpt-4.1-mini"  # an example id: check the parameters your model accepts


class ProviderClient:
    """The one call this snippet makes, on top of the provider's SDK."""

    def __init__(self, sdk=None, model: str = MODEL):
        if sdk is None:  # pragma: no cover - needs a key and a network
            from openai import OpenAI

            sdk = OpenAI()
        self.sdk, self.model = sdk, model

    def complete(self, *, prompt: str, temperature: float) -> str:
        response = self.sdk.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
        )
        return response.choices[0].message.content


class RoutingUnavailable(Exception):
    """The provider could not be reached, or answered something unparseable."""


def route(ticket: str, client=None, *, attempts: int = 3) -> str:
    """
    The team that gets the ticket.

    `client` is injected so this function can be tested without a network
    call. In production it defaults to a real provider client.
    """
    client = client or ProviderClient()

    # The provider bills every token of the prompt, and a ticket with a
    # forwarded thread or a pasted log under it is long. The cap counts
    # characters, not tokens, and it truncates rather than raising: a router
    # that throws leaves the ticket nowhere, and the team is usually decided by
    # the first paragraph anyway. What is cut is said to nobody, which is why
    # the caller gets the ticket back only through its queue.
    answer = _ask(client, ticket[:MAX_CHARACTERS], attempts)
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
            # The lowest temperature: the SDK documents lower values as more
            # focused and deterministic.
            answer = client.complete(prompt=prompt, temperature=0)
            if not isinstance(answer, str):  # a refusal comes back as no content
                last_error = ValueError("the model answered no text")
                continue
            return json.loads(answer)
        except Exception as error:  # noqa: BLE001 - any provider failure is retried
            last_error = error
    raise RoutingUnavailable(str(last_error))
