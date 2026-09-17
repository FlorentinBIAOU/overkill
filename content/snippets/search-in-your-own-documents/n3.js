/**
 * Answer a question from your own documents: retrieval-augmented generation.
 *
 * Rung N3. The model only knows of your handbook what the prompt carries. So
 * retrieval comes first — N0, N1 or N2 finds the passages — and the model
 * writes the sentence from them.
 *
 * Everything below is plumbing, and the plumbing is where the bugs are: how
 * many passages to send and how long each may be, what the model is allowed to
 * say when they do not answer, how to decode a reply that is only probably
 * JSON, and what to do when it cites a passage nobody sent.
 *
 * That last check earns its lines, and it is worth knowing exactly what it
 * buys: it catches an invented source. It cannot catch an invented sentence
 * hung on a real one: it compares identifiers, and never reads the sentence.
 */

// The provider named here is an example, not a recommendation: the reasoning
// holds for any general-purpose model API, and the client is swappable. Pass
// any object with a `complete({ prompt, temperature })` method.
export const MODEL = 'gpt-4.1-mini'; // an example id: check the parameters your model accepts

export async function providerClient(sdk, model = MODEL) {
  if (!sdk) {
    const { OpenAI } = await import('openai');
    sdk = new OpenAI();
  }
  return {
    async complete({ prompt, temperature }) {
      const response = await sdk.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
      });
      return response.choices[0].message.content;
    },
  };
}

export const MAX_PASSAGES = 4;
export const MAX_CHARACTERS = 1500; // per passage
export const MAX_QUESTION = 1000; // characters
export const NO_ANSWER = 'je ne sais pas';

const PROMPT = (passages, question) => [
  'Answer the question using only the passages below.',
  `If they do not contain the answer, answer exactly: ${NO_ANSWER}`,
  'Answer with JSON only: {"answer": "...", "sources": ["id", ...]},',
  'where every id is one of the passage ids you were given.',
  '',
  'Passages:',
  passages,
  '',
  `Question: ${question}`,
].join('\n');

export class AnswerUnavailable extends Error {}

export class AnswerNotGrounded extends Error {}

/** The first `max` characters, counted in code points as Python does, so no emoji is cut in two. */
const head = (text, max) => [...text.slice(0, 2 * max)].slice(0, max).join('');

/**
 * @param {string} question
 * @param {{id: string|number, text: string}[]} passages retrieved, best first
 * @param {object} options
 * @param {{complete: Function}} [options.client] injected so this can be
 *   tested without a network call; defaults to a real provider client
 */
export async function answer(question, passages, { client, attempts = 2, maxPassages = MAX_PASSAGES } = {}) {
  // The provider bills every character of the prompt: refuse before any call.
  if ([...question].length > MAX_QUESTION) {
    throw new RangeError(`question longer than ${MAX_QUESTION} characters`);
  }
  const kept = passages.slice(0, maxPassages);
  if (kept.length === 0 || !question.trim()) {
    // Nothing retrieved, or nothing asked. There is nothing to answer from,
    // and no reason to pay for a call that can only invent.
    return { answer: NO_ANSWER, sources: [] };
  }

  client ??= await providerClient();
  const block = kept.map((p) => `[${p.id}] ${head(p.text, MAX_CHARACTERS)}`).join('\n\n');
  const reply = await ask(client, PROMPT(block, question), attempts);

  const text = reply.answer.trim();
  const sent = new Map(kept.map((p) => [String(p.id), p.id])); // ids may be numbers: compare as text
  const unknown = reply.sources.filter((source) => !sent.has(String(source)));
  if (unknown.length > 0) {
    throw new AnswerNotGrounded(`the model cited ${unknown}, which it was never sent`);
  }
  const sources = reply.sources.map((source) => sent.get(String(source)));
  if (!text) throw new AnswerUnavailable('the model answered without an answer');
  if (text.toLowerCase().replace(/[ .!]+$/, '') === NO_ANSWER) { // "Je ne sais pas." is the same answer
    return { answer: NO_ANSWER, sources };
  }
  if (sources.length === 0) {
    throw new AnswerNotGrounded('an answer that cites nothing cannot be checked');
  }
  return { answer: text, sources };
}

async function ask(client, prompt, attempts) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      // Temperature zero narrows the sampling. It does not make the call
      // deterministic: the provider documents chat completions as
      // non-deterministic by default, and the entry says so.
      const parsed = decode(await client.complete({ prompt, temperature: 0 }));
      const isId = (s) => typeof s === 'string' || Number.isInteger(s);
      if (typeof parsed?.answer === 'string' && Array.isArray(parsed.sources) && parsed.sources.every(isId)) {
        return parsed;
      }
      lastError = new Error('the model answered something that is not the object asked for');
    } catch (error) {
      lastError = error;
    }
  }
  throw new AnswerUnavailable(String(lastError));
}

/**
 * JSON, or JSON wrapped whole in one code fence. No text at all (a refusal) is
 * unusable, and so is anything else around the object: prose before or after
 * it, a second block, or a fence opened and never closed. Salvaging those would
 * be guessing which part of a badly shaped answer to believe.
 */
function decode(reply) {
  if (typeof reply !== 'string') throw new Error('the model returned no text');
  const trimmed = reply.trim();
  const fences = trimmed.match(/```/g)?.length ?? 0;
  if (trimmed.startsWith('```') && trimmed.endsWith('```') && fences === 2) {
    const inner = trimmed.slice(3, -3);
    return JSON.parse(inner.startsWith('json') ? inner.slice(4) : inner);
  }
  return JSON.parse(trimmed);
}
