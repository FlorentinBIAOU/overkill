/**
 * Detect the language of a text by asking a general-purpose model.
 *
 * Rung N3. This is the option people reach for first. It is here so you can
 * see what it costs, not because this entry recommends it.
 *
 * Note what the code has to do that N0 did not: cap the input, send only an
 * excerpt, retry on failure, parse an answer that is only probably valid
 * JSON, normalise a code the model may write in half a dozen ways, and refuse
 * an answer that is outside the list it was given. That plumbing is the real
 * cost of this rung, and it is the part your tests have to cover, because the
 * model itself is not testable.
 *
 * The one thing this rung genuinely adds is that it needs no sample of the
 * language. The one thing it cannot do is tell you it is wrong.
 */

export const MAX_CHARACTERS = 8000;

// A language is decided in the first few sentences. Sending the whole
// document is not thoroughness, it is paying by the token for nothing.
export const EXCERPT_CHARACTERS = 600;

export class DetectionUnavailable extends Error {}

/** The exact request sent to the model. Exported so a test can read it. */
export function buildPrompt(languages, excerpt) {
  return [
    'Identify the language of the text below.',
    'Answer with JSON only: an object with keys `language` and `confidence`,',
    'where `language` is a two-letter ISO 639-1 code chosen from this list:',
    `${[...languages].sort().join(', ')}, or \`und\` if the text is in none of them.`,
    '',
    'Text:',
    excerpt,
  ].join('\n');
}

/**
 * The code of the detected language, or null when the model says the text is
 * in none of the languages it was offered.
 *
 * @param {string} text
 * @param {string[]} languages the codes the model may choose from
 * @param {object} options
 * @param {{complete: Function}} [options.client] injected so this can be
 *   tested without a network call; defaults to a real provider client
 * @param {number} [options.attempts]
 */
export async function detect(text, languages, { client, attempts = 3 } = {}) {
  if (!client) {
    // Needs a key and a network, so it is never reached in the tests.
    const { OpenAI } = await import('openai');
    client = new OpenAI();
  }

  // A model charges by the token. Refusing oversized input is not an
  // optimisation, it is a cost control.
  if (text.length > MAX_CHARACTERS) {
    throw new RangeError(`text longer than ${MAX_CHARACTERS} characters`);
  }

  const answer = await ask(client, text.slice(0, EXCERPT_CHARACTERS), languages, attempts);

  // Models answer "fr", "FR", "fr-CA" and "French" for the same thing.
  // Everything but the first is a bug waiting to reach production.
  const code = String(answer.language ?? '').trim().toLowerCase().split('-')[0];
  if (code === 'und') return null;
  if (![...languages].includes(code)) {
    throw new DetectionUnavailable(`the model answered a language outside the list: ${code}`);
  }
  return code;
}

async function ask(client, excerpt, languages, attempts) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const answer = await client.complete({
        prompt: buildPrompt(languages, excerpt),
        // Temperature zero, because a routing decision that changes between
        // two identical calls cannot be reviewed.
        temperature: 0,
      });
      const parsed = JSON.parse(answer);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
      lastError = new Error('the model answered something that is not an object');
    } catch (error) {
      lastError = error;
    }
  }
  throw new DetectionUnavailable(String(lastError));
}
