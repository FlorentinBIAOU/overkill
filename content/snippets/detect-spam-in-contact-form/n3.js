/**
 * Sort a contact form submission by asking a general-purpose model.
 *
 * Rung N3. This is the option people reach for first. It is here so you can
 * see what it costs, not because this entry recommends it.
 *
 * Note what the code has to do that N0 did not: cap the input size, retry a
 * provider that failed, parse an answer that is only probably valid JSON, and
 * refuse to guess when the answer is unusable. That plumbing is the real cost
 * of this rung, and it is the part your tests have to cover, because the model
 * itself is not testable.
 *
 * Note too what it cannot do. The message goes into the same prompt as the
 * instructions, and nothing in the protocol tells the model which of the two
 * to obey.
 */

const PROMPT = [
  'You moderate the contact form of a small company.',
  'Decide whether the submission below is unsolicited commercial spam.',
  'Answer with JSON only: {"spam": true or false, "reason": "one short sentence"}',
  '',
  'Submission:',
].join('\n');

export const MAX_CHARACTERS = 4000;

export class ClassificationUnavailable extends Error {}

/**
 * Return `{ spam, reason }` for one form submission.
 *
 * @param {string} message
 * @param {object} options
 * @param {{complete: Function}} [options.client] injected so this can be
 *   tested without a network call; defaults to a real provider client
 * @param {number} [options.attempts]
 */
export async function classify(message, { client, attempts = 3 } = {}) {
  if (!client) {
    // Needs a key and a network, so it is never reached in the tests.
    const { OpenAI } = await import('openai');
    client = new OpenAI();
  }

  // A model charges by the token, and a form field is a place where anyone can
  // paste a novel. Refusing oversized input is not an optimisation, it is a
  // cost control.
  if (message.length > MAX_CHARACTERS) {
    throw new RangeError(`submission longer than ${MAX_CHARACTERS} characters`);
  }

  const verdict = await ask(client, message, attempts);
  return { spam: verdict.spam, reason: String(verdict.reason ?? '') };
}

async function ask(client, message, attempts) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const answer = await client.complete({
        prompt: `${PROMPT}\n${message}`,
        // Temperature zero, because a moderation decision that changes between
        // two identical calls cannot be reviewed.
        temperature: 0,
      });
      const parsed = JSON.parse(answer);
      if (parsed && typeof parsed.spam === 'boolean') return parsed;
      lastError = new Error('the model answered without a usable verdict');
    } catch (error) {
      lastError = error;
    }
  }
  throw new ClassificationUnavailable(String(lastError));
}
