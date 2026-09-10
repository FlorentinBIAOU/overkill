"""
Answer a question from your own documents: retrieval-augmented generation.

Rung N3. The model has never read your handbook. Asked without it, it answers
from memory, confidently, about your company. So retrieval comes first — N0,
N1 or N2 finds the passages — and the model only writes the sentence.

Everything below is plumbing, and the plumbing is where the bugs are: how many
passages to send and how long each may be, what the model is allowed to say
when they do not answer, how to decode a reply that is only probably JSON, and
what to do when it cites a passage nobody sent.

That last check earns its lines, and it is worth knowing exactly what it buys:
it catches an invented source. It cannot catch an invented sentence hung on a
real one, and no amount of prompting turns it into a check that can.
"""

from __future__ import annotations

import json

PROMPT = (
    "Answer the question using only the passages below.\n"
    "If they do not contain the answer, answer exactly: {no_answer}\n"
    'Answer with JSON only: {{"answer": "...", "sources": ["id", ...]}},\n'
    "where every id is one of the passage ids you were given.\n\n"
    "Passages:\n{passages}\n\n"
    "Question: {question}"
)

MAX_PASSAGES = 4
MAX_CHARACTERS = 1500  # per passage
NO_ANSWER = "je ne sais pas"


class AnswerUnavailable(Exception):
    """The provider could not be reached, or answered something unusable."""


class AnswerNotGrounded(Exception):
    """The answer cites a passage that was never sent, or cites nothing."""


def answer(question: str, passages: list[dict], client=None, *, attempts: int = 2,
           max_passages: int = MAX_PASSAGES) -> dict:
    """`passages` are the retrieved dicts with keys id and text, best first."""
    if client is None:  # pragma: no cover - needs a key and a network
        from openai import OpenAI

        client = OpenAI()

    kept = passages[:max_passages]
    if not kept:
        # Retrieval found nothing. There is nothing to answer from, and no
        # reason to pay for a call that can only invent.
        return {"answer": NO_ANSWER, "sources": []}

    block = "\n\n".join(f"[{p['id']}] {p['text'][:MAX_CHARACTERS]}" for p in kept)
    reply = _ask(client, PROMPT.format(no_answer=NO_ANSWER, passages=block, question=question),
                 attempts)

    text = str(reply.get("answer", "")).strip()
    sources = [str(source) for source in reply.get("sources", [])]
    unknown = [source for source in sources if source not in {p["id"] for p in kept}]
    if unknown:
        raise AnswerNotGrounded(f"the model cited {unknown}, which it was never sent")
    if text and text != NO_ANSWER and not sources:
        raise AnswerNotGrounded("an answer that cites nothing cannot be checked")
    if not text:
        raise AnswerUnavailable("the model answered without an answer")
    return {"answer": text, "sources": sources}


def _ask(client, prompt: str, attempts: int) -> dict:
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            # Temperature zero: two identical questions must give one answer,
            # or nobody can review what the thing told a customer.
            parsed = json.loads(client.complete(prompt=prompt, temperature=0))
            if isinstance(parsed, dict):
                return parsed
            last_error = ValueError("the model answered something that is not an object")
        except Exception as error:  # noqa: BLE001 - any provider failure is retried
            last_error = error
    raise AnswerUnavailable(str(last_error))
