/**
 * Sort a contact form submission by asking a general-purpose model.
 *
 * Rung N3. It is here so you can see what it costs, not because this entry
 * recommends it.
 *
 * Note what the code has to do that N0 did not: refuse an empty or oversized
 * input before paying for a call, ask again when the provider fails or answers
 * something unusable, every attempt being billed, parse an answer that is only
 * probably valid JSON, and refuse to guess when none of the attempts is usable.
 * That plumbing is the real cost of this rung, and it is the part your tests
 * have to cover, because a test against a double says nothing of how the model
 * judges.
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
  if (!message.trim()) throw new RangeError('empty submission: there is nothing to classify');
  // A model charges by the token, and a form field is a place where anyone can
  // paste a novel. Refusing oversized input is not an optimisation, it is a
  // cost control. Counted in code points, as Python counts characters.
  if ([...message].length > MAX_CHARACTERS) throw new RangeError(`submission longer than ${MAX_CHARACTERS} characters`);

  client ??= await providerClient();
  const verdict = await ask(client, message, attempts);
  return { spam: verdict.spam, reason: String(verdict.reason ?? '') };
}

async function ask(client, message, attempts) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    let answer;
    try {
      // Temperature zero, the low end of the range, which the provider
      // documents as more focused and deterministic. It does not promise
      // that two identical calls agree.
      answer = await client.complete({ prompt: `${PROMPT}\n${message}`, temperature: 0 });
    } catch (error) {
      lastError = error; // any provider failure is retried
      continue;
    }
    const verdict = parse(answer);
    if (verdict) return verdict;
    lastError = new Error('the model answered without a usable verdict');
  }
  throw new ClassificationUnavailable(String(lastError));
}

/** The verdict in `answer`, or null: no text, not JSON, or no boolean `spam`. */
function parse(answer) {
  if (typeof answer !== 'string') return null; // the SDK types the content as nullable
  // A JSON answer wrapped whole in one code fence is read; nothing else is: a
  // fence opened and never closed, or prose around it, is a failed answer.
  const trimmed = answer.trim();
  const fenced = trimmed.startsWith('```') && trimmed.endsWith('```') && trimmed.split('```').length === 3;
  const text = fenced ? trimmed.slice(3, -3).replace(/^json/, '') : trimmed;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed.spam === 'boolean' ? parsed : null;
  } catch {
    return null;
  }
}
