/**
 * Detect the language of a text by asking a general-purpose model.
 *
 * Rung N3. This is the option people reach for first. It is here so you can
 * see what it costs, not because this entry recommends it.
 *
 * Note what the code has to do that N0 did not: send only an excerpt, retry on
 * failure, parse an answer that is only probably valid JSON, normalise a code
 * the model may write in capitals, with a region or with stray spaces, and
 * refuse an answer that is outside the list it was given. That plumbing is the
 * real cost of this rung, and it is the part your tests have to cover, because
 * the model itself is not testable.
 *
 * The one thing this rung genuinely adds is that it needs no sample of the
 * language. The one thing it cannot do is tell you it is wrong.
 */

// The provider named here is an example, not a recommendation: the reasoning
// holds for any general-purpose model API, and the client is swappable. Pass
// any object with a `complete({ prompt, temperature })` method.
export const MODEL = 'gpt-4.1-mini'; // an example id: check the parameters your model accepts

// Only the first characters are sent, a few sentences: N0 and N1 already name
// the language of a single sentence, and the model bills every token past it.
// That excerpt is the whole cost control — there is no cap on the input,
// because a cap would refuse a long email that costs exactly the same as a
// short one.
export const EXCERPT_CHARACTERS = 600;

export class DetectionUnavailable extends Error {}

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

/** The exact request sent to the model. Exported so a test can read it. */
export function buildPrompt(languages, excerpt) {
  return [
    'Identify the language of the text below.',
    'Answer with JSON only: an object with the key `language`, whose value is',
    'a two-letter ISO 639-1 code chosen from this list:',
    `${[...languages].sort().join(', ')}, or \`und\` if the text is in none of them.`,
    '',
    'Text:',
    excerpt,
  ].join('\n');
}

/**
 * The code of the detected language, or null when the text is blank or the
 * model says it is in none of the languages it was offered.
 *
 * @param {string} text
 * @param {string[]} languages the codes the model may choose from
 * @param {object} options
 * @param {{complete: Function}} [options.client] injected so this can be
 *   tested without a network call; defaults to a real provider client
 * @param {number} [options.attempts]
 */
export async function detect(text, languages, { client, attempts = 3 } = {}) {
  // Counted in characters, as Python counts them: `length` would count an
  // emoji twice, and `slice` could cut one in half.
  const characters = [...text];

  // A blank text costs nothing to refuse and cannot say anything. A long one is
  // not refused: only its first characters are ever sent.
  if (!text.trim()) return null;

  client ??= await providerClient();
  const excerpt = characters.slice(0, EXCERPT_CHARACTERS).join('');
  const answer = await ask(client, excerpt, languages, attempts);

  // "fr", "FR", "fr-CA" and the locale form "fr_CA" are all read as "fr". A
  // language name such as "French" is not a code, and is refused below.
  const code = String(answer.language ?? '').trim().toLowerCase().replace('_', '-').split('-')[0];
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
      // No content at all (a refusal) is as unusable as prose.
      const parsed = typeof answer === 'string' ? JSON.parse(answer) : null;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
      lastError = new Error('the model answered something that is not an object');
    } catch (error) {
      // Only what the provider or the decoder can raise. A TypeError from this
      // file is a bug, and retrying it would pay three bills for it.
      if (error instanceof TypeError || error instanceof ReferenceError) throw error;
      lastError = error;
    }
  }
  throw new DetectionUnavailable(String(lastError));
}
