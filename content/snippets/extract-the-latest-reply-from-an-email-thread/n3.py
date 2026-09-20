"""
Ask a model which lines of a thread the last sender wrote.

Rung N3. It exists for the one case rung N0 cannot settle: a reply that is not
above the quote but inside it, line by line, under the sentences it answers.
No marker separates those lines from the ones around them — the client wrote
none — and a model reads them the way a human does.

The guard is what makes this rung defensible, and it is unusually strong here
because the answer is not text but line numbers. The model is given the thread
numbered, and returns the numbers of the lines it believes the last sender
wrote; anything that is not a line of the message that was sent is dropped, and
`dropped` says which. So the reply returned is made of lines of the thread, in
their order, and never of a sentence the model found likelier.

Two operating conditions. The thread is cut to a budget from the end, because
the reply being looked for is normally near the top; a thread longer than the
budget whose reply is at the very bottom is cut away before it is read. And the
cost is a call per message: this rung is for the threads rung N0 has flagged,
not for a mailbox.
"""

from __future__ import annotations

import json
import re

# The budget, in characters. A thread that does not fit is cut, not refused.
MAX_CHARACTERS = 6000

# A single code fence around the whole answer is a common shape, and refusing
# it would buy another call for nothing.
FENCE = re.compile(r"\A\s*```(?:json)?\s*(.*?)\s*```\s*\Z", re.DOTALL)

LINE_END = re.compile(r"\r\n|\r|\n")

MODEL = "gpt-4.1-mini"  # an example id: check the parameters your model accepts

PROMPT = (
    "Here is an email thread, one numbered line per line.\n"
    "Return the numbers of the lines written by the person who sent this "
    "message, and not the lines of the messages quoted under it.\n"
    'Answer with JSON only: {{"lines": [numbers]}}.\n\n'
    "Thread:\n{thread}"
)


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


class ReadingUnavailable(Exception):
    """The provider could not be reached, or answered something unusable."""


def read_reply(message: str, client=None, *, attempts: int = 3) -> dict:
    """
    The lines of the thread a model attributes to the last sender.

    `client` is injected so this function can be tested without a network call.
    In production it defaults to a real provider client.
    """
    client = client or ProviderClient()
    thread = message[:MAX_CHARACTERS]
    lines = LINE_END.split(thread)
    answer = _ask(client, lines, attempts)

    kept, dropped = [], []
    for number in answer.get("lines", []) if isinstance(answer, dict) else []:
        if isinstance(number, int) and 1 <= number <= len(lines) \
                and not lines[number - 1].lstrip().startswith(">"):
            kept.append(number)
        else:
            # Not a line of what was sent, or a line of the quoted thread.
            dropped.append(number)

    kept = sorted(set(kept))
    reply = "\n".join(lines[number - 1] for number in kept).strip()
    return {"source": "model", "reply": reply, "lines": kept, "dropped": dropped,
            "characters_sent": len(thread)}


def _ask(client, lines, attempts: int) -> dict:
    numbered = "\n".join(f"{number}: {line}" for number, line in enumerate(lines, 1))
    prompt = PROMPT.format(thread=numbered)
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            answer = client.complete(prompt=prompt, temperature=0)
            if not isinstance(answer, str):  # a refusal comes back as no content
                last_error = ValueError("the model answered no text")
                continue
            fenced = FENCE.match(answer)
            return json.loads(fenced.group(1) if fenced else answer)
        except Exception as error:  # noqa: BLE001 - any provider failure is retried
            last_error = error
    raise ReadingUnavailable(str(last_error))
