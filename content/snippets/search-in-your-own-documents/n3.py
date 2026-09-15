"""
Answer a question from your own documents: retrieval-augmented generation.

Rung N3. The model only knows of your handbook what the prompt carries. So
retrieval comes first — N0, N1 or N2 finds the passages — and the model writes
the sentence from them.

Everything below is plumbing, and the plumbing is where the bugs are: how many
passages to send and how long each may be, what the model is allowed to say
when they do not answer, how to decode a reply that is only probably JSON, and
what to do when it cites a passage nobody sent.

That last check earns its lines, and it is worth knowing exactly what it buys:
it catches an invented source. It cannot catch an invented sentence hung on a
real one: it compares identifiers, and never reads the sentence.
"""

from __future__ import annotations

import json

# The provider named here is an example, not a recommendation: the reasoning
# holds for any general-purpose model API, and the client is swappable. Pass
# any object with a `complete(prompt=..., temperature=...)` method.
MODEL = "gpt-4.1-mini"  # an example id: check the parameters your model accepts

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
MAX_QUESTION = 1000  # characters
NO_ANSWER = "je ne sais pas"


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


class AnswerUnavailable(Exception):
    """The provider could not be reached, or answered something unusable."""


class AnswerNotGrounded(Exception):
    """The answer cites a passage that was never sent, or cites nothing."""


def answer(question: str, passages: list[dict], client=None, *, attempts: int = 2,
           max_passages: int = MAX_PASSAGES) -> dict:
    """`passages` are the retrieved dicts with keys id and text, best first."""
    # The provider bills every character of the prompt: refuse before any call.
    if len(question) > MAX_QUESTION:
        raise ValueError(f"question longer than {MAX_QUESTION} characters")
    kept = passages[:max_passages]
    if not kept or not question.strip():
        # Nothing retrieved, or nothing asked. There is nothing to answer from,
        # and no reason to pay for a call that can only invent.
        return {"answer": NO_ANSWER, "sources": []}

    client = client or ProviderClient()
    block = "\n\n".join(f"[{p['id']}] {p['text'][:MAX_CHARACTERS]}" for p in kept)
    reply = _ask(client, PROMPT.format(no_answer=NO_ANSWER, passages=block, question=question),
                 attempts)

    text = reply["answer"].strip()
    sent = {str(p["id"]): p["id"] for p in kept}  # ids may be integers: compare as text
    unknown = [source for source in reply["sources"] if str(source) not in sent]
    if unknown:
        raise AnswerNotGrounded(f"the model cited {unknown}, which it was never sent")
    sources = [sent[str(source)] for source in reply["sources"]]
    if not text:
        raise AnswerUnavailable("the model answered without an answer")
    if text.lower().rstrip(" .!") == NO_ANSWER:  # "Je ne sais pas." is the same answer
        return {"answer": NO_ANSWER, "sources": sources}
    if not sources:
        raise AnswerNotGrounded("an answer that cites nothing cannot be checked")
    return {"answer": text, "sources": sources}


def _ask(client, prompt: str, attempts: int) -> dict:
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            # Temperature zero narrows the sampling. It does not make the call
            # deterministic: the provider documents chat completions as
            # non-deterministic by default, and the entry says so.
            parsed = _decode(client.complete(prompt=prompt, temperature=0))
            if isinstance(parsed, dict) and isinstance(parsed.get("answer"), str) \
                    and isinstance(parsed.get("sources"), list) \
                    and all(isinstance(s, (str, int)) and not isinstance(s, bool) for s in parsed["sources"]):
                return parsed
            last_error = ValueError("the model answered something that is not the object asked for")
        except Exception as error:  # noqa: BLE001 - any provider failure is retried
            last_error = error
    raise AnswerUnavailable(str(last_error))


def _decode(reply) -> object:
    """JSON, possibly wrapped in a ```json fence. No text at all (a refusal) is unusable."""
    if not isinstance(reply, str):
        raise ValueError("the model returned no text")
    text = reply.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1].rsplit("```", 1)[0]
    return json.loads(text)
