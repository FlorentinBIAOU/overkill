/**
 * Tag articles by asking a general-purpose model.
 *
 * Rung N3. On this entry it is the only rung that needs neither a term list,
 * nor a labelled corpus, nor a model file. It is here so you can see what it
 * costs, not because this entry recommends it.
 *
 * Note what the code has to do that N0 did not: cap the input size, retry on
 * failure, parse an answer that is only probably valid JSON, and keep only the
 * topics that exist in your taxonomy. That last one is not optional — nothing
 * stops a model from answering a name that is not on the list — and it is why
 * the vocabulary stays a parameter here, exactly as it was on the bottom rung.
 *
 * That plumbing is the real cost of this rung, and it is the part your tests
 * have to cover, because a test against a double says nothing of how the model
 * tags.
 */

const PROMPT = [
  'Tag the article below with the topics it covers.',
  'Choose only from this list, and answer with the spellings given:',
  '{topics}',
  'An article may cover several topics, or none at all.',
  'Answer with JSON only: a list of topic names, empty if none apply.',
  '',
  'Article:',
].join('\n');

export const MAX_CHARACTERS = 12000;

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

export class TaggingUnavailable extends Error {}

/**
 * The topics of the article, in the order of the taxonomy.
 *
 * @param {string} article
 * @param {string[]} topics the controlled vocabulary, as on rung N0
 * @param {object} options
 * @param {{complete: Function}} [options.client] injected so this can be
 *   tested without a network call; defaults to a real provider client
 * @param {number} [options.attempts]
 */
export async function tag(article, topics, { client, attempts = 3 } = {}) {
  // A model charges by the token. Refusing oversized input is not an
  // optimisation, it is a cost control. Counted in code points, as Python
  // counts characters.
  if ([...article].length > MAX_CHARACTERS) {
    throw new RangeError(`article longer than ${MAX_CHARACTERS} characters`);
  }
  // No text or no topic: the answer is known, and asking would still be billed.
  if (!article.trim() || topics.length === 0) return [];
  return ask(client ?? (await providerClient()), article, topics, attempts);
}

/** The same name whatever its case, its spacing or its Unicode form. */
const key = (name) => name.normalize('NFC').trim().toLowerCase();

async function ask(client, article, topics, attempts) {
  const prompt = `${PROMPT.replace('{topics}', topics.map((t) => `- ${t}`).join('\n'))}\n${article}`;
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    let answer;
    try {
      // Temperature zero, the low end of the range, which the provider
      // documents as more focused and deterministic. It does not promise
      // that two identical calls agree.
      answer = await client.complete({ prompt, temperature: 0 });
    } catch (error) {
      lastError = error; // any provider failure is retried
      continue;
    }
    try {
      return decode(answer, topics);
    } catch (error) {
      lastError = error; // an unusable answer is asked for again
    }
  }
  throw new TaggingUnavailable(String(lastError));
}

/**
 * Keep only what the taxonomy knows, in the taxonomy's own order. A model that
 * answers "actualité juridique" must not create a topic in your database, and
 * the order of its answer must not decide the order of yours.
 */
function decode(answer, topics) {
  if (typeof answer !== 'string') throw new Error('the model returned no text');
  // A Markdown code fence around the JSON is unwrapped, not counted as a failure.
  const parsed = JSON.parse(answer.trim().replace(/^```(?:json)?/, '').replace(/```$/, ''));
  // A list of anything but names, or of names none of which is on the list,
  // must not pass for the legitimate empty answer.
  if (!Array.isArray(parsed) || !parsed.every((name) => typeof name === 'string')) {
    throw new Error('the model answered something that is not a list of names');
  }
  const answered = new Set(parsed.map(key));
  const kept = topics.filter((topic) => answered.has(key(topic)));
  if (parsed.length && !kept.length) {
    throw new Error('the model answered only names that are not in the taxonomy');
  }
  return kept;
}
