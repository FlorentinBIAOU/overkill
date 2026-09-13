/**
 * Tag articles by asking a general-purpose model.
 *
 * Rung N3. This is the option people reach for first, and on this entry it is
 * the only one that needs neither a term list, nor a labelled corpus, nor a
 * model file. It is here so you can see what it costs, not because this entry
 * recommends it.
 *
 * Note what the code has to do that N0 did not: cap the input size, retry on
 * failure, parse an answer that is only probably valid JSON, and keep only the
 * topics that exist in your taxonomy. That last one is not optional — a model
 * will happily invent a plausible topic — and it is why the vocabulary stays a
 * parameter here, exactly as it was on the bottom rung.
 *
 * That plumbing is the real cost of this rung, and it is the part your tests
 * have to cover, because the model itself is not testable.
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
  if (!client) {
    // Needs a key and a network, so it is never reached in the tests.
    const { OpenAI } = await import('openai');
    client = new OpenAI();
  }

  // A model charges by the token. Refusing oversized input is not an
  // optimisation, it is a cost control.
  if (article.length > MAX_CHARACTERS) {
    throw new RangeError(`article longer than ${MAX_CHARACTERS} characters`);
  }

  const reported = await ask(client, article, topics, attempts);

  // Keep only what the taxonomy knows, and answer in the taxonomy's own order.
  // A model that invents "actualité juridique" must not create a topic in
  // your database, and two identical calls must file an article the same way
  // twice.
  const answered = new Set(
    reported.filter((name) => typeof name === 'string').map((name) => name.trim().toLowerCase()),
  );
  return topics.filter((topic) => answered.has(topic.toLowerCase()));
}

async function ask(client, article, topics, attempts) {
  const prompt = `${PROMPT.replace('{topics}', topics.map((t) => `- ${t}`).join('\n'))}\n${article}`;
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const answer = await client.complete({
        prompt,
        // Temperature zero, because a taxonomy that changes between two
        // identical calls is not a taxonomy.
        temperature: 0,
      });
      const parsed = JSON.parse(answer);
      if (Array.isArray(parsed)) return parsed;
      lastError = new Error('the model answered something that is not a list');
    } catch (error) {
      lastError = error;
    }
  }
  throw new TaggingUnavailable(String(lastError));
}
