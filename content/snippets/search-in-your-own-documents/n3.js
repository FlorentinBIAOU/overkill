/**
 * Answer a question from your own documents: retrieval-augmented generation.
 *
 * Rung N3. The model has never read your handbook. Asked without it, it
 * answers from memory, confidently, about your company. So retrieval comes
 * first — N0, N1 or N2 finds the passages — and the model only writes the
 * sentence.
 *
 * Everything below is plumbing, and the plumbing is where the bugs are: how
 * many passages to send and how long each may be, what the model is allowed to
 * say when they do not answer, how to decode a reply that is only probably
 * JSON, and what to do when it cites a passage nobody sent.
 *
 * That last check earns its lines, and it is worth knowing exactly what it
 * buys: it catches an invented source. It cannot catch an invented sentence
 * hung on a real one, and no amount of prompting turns it into a check that
 * can.
 */

export const MAX_PASSAGES = 4;
export const MAX_CHARACTERS = 1500; // per passage
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

/**
 * @param {string} question
 * @param {{id: string, text: string}[]} passages retrieved, best first
 * @param {object} options
 * @param {{complete: Function}} [options.client] injected so this can be
 *   tested without a network call; defaults to a real provider client
 */
export async function answer(question, passages, { client, attempts = 2, maxPassages = MAX_PASSAGES } = {}) {
  if (!client) {
    // Needs a key and a network, so it is never reached in the tests.
    const { OpenAI } = await import('openai');
    client = new OpenAI();
  }

  const kept = passages.slice(0, maxPassages);
  if (kept.length === 0) {
    // Retrieval found nothing. There is nothing to answer from, and no reason
    // to pay for a call that can only invent.
    return { answer: NO_ANSWER, sources: [] };
  }

  const block = kept.map((p) => `[${p.id}] ${p.text.slice(0, MAX_CHARACTERS)}`).join('\n\n');
  const reply = await ask(client, PROMPT(block, question), attempts);

  const text = String(reply.answer ?? '').trim();
  const sources = (reply.sources ?? []).map(String);
  const known = new Set(kept.map((p) => p.id));
  const unknown = sources.filter((source) => !known.has(source));
  if (unknown.length > 0) {
    throw new AnswerNotGrounded(`the model cited ${unknown}, which it was never sent`);
  }
  if (text && text !== NO_ANSWER && sources.length === 0) {
    throw new AnswerNotGrounded('an answer that cites nothing cannot be checked');
  }
  if (!text) throw new AnswerUnavailable('the model answered without an answer');
  return { answer: text, sources };
}

async function ask(client, prompt, attempts) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      // Temperature zero: two identical questions must give one answer, or
      // nobody can review what the thing told a customer.
      const parsed = JSON.parse(await client.complete({ prompt, temperature: 0 }));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
      lastError = new Error('the model answered something that is not an object');
    } catch (error) {
      lastError = error;
    }
  }
  throw new AnswerUnavailable(String(lastError));
}
