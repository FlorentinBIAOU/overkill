/**
 * Score a comment by asking a general-purpose model.
 *
 * Rung N3. The rung that hands the most away: what each category means, the
 * calibration, the right to appeal, and the text of your users' comments,
 * which leaves your premises on every call.
 *
 * Before writing this, look at whether your provider publishes a moderation
 * endpoint. The one taken as an example here does, it is not metered, and it
 * scores thirteen fixed categories. If the harms you care about are on that
 * list, this file is the expensive way to get them. What it buys, and the only
 * thing it buys, is a category that is yours: the last one below names giving
 * out where somebody lives, which no fixed taxonomy on this page carries — not
 * the provider's thirteen, and not the labels of the model at N2.
 *
 * You name the categories; the model decides what they mean. Everything else
 * here — capping the input, retrying, refusing to act on an answer that is not
 * the shape you asked for — is plumbing you own, and it is where the bugs of
 * this rung live. It is also all your tests can reach, because the judgement
 * itself is not testable.
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

// The first four are on the provider's own moderation endpoint too. The last
// one is not, and it is the reason this file exists.
export const CATEGORIES = ['harassment', 'hate', 'violence', 'self_harm', 'personal_information'];

const PROMPT = [
  'Rate the comment below on each moderation category. Answer with JSON',
  'only: an object mapping each category to a score between 0 and 1.',
  `Categories: ${CATEGORIES.join(', ')}`,
  'personal_information means giving out where somebody lives, works, or how',
  'to reach them, without their consent.',
  '',
  'Comment:',
].join('\n');

export const MAX_CHARACTERS = 4000;
export const DEFAULT_THRESHOLDS = { block: 0.9, review: 0.6 };

export class ModerationUnavailable extends Error {}

/**
 * Decide what to do with one comment: block, send to review, or allow.
 *
 * @param {string} comment
 * @param {object} options
 * @param {{complete: Function}} [options.client] injected so this can be
 *   tested without a network call; defaults to a real provider client
 * @param {{block: number, review: number}} [options.thresholds]
 * @param {number} [options.attempts]
 */
export async function moderate(comment, { client, thresholds = DEFAULT_THRESHOLDS, attempts = 3 } = {}) {
  // The provider bills every token of the prompt. The cap counts characters
  // (code points, as Python does), not tokens, and is checked before any call:
  // the caller decides where a longer comment goes instead. On a forum that is
  // the review queue, not the bin — a comment of four thousand and one
  // characters is not an anomaly.
  if ([...comment].length > MAX_CHARACTERS) {
    throw new RangeError(`comment longer than ${MAX_CHARACTERS} characters`);
  }

  client ??= await providerClient();
  const scores = await ask(client, comment, attempts);
  const [category, score] = Object.entries(scores).reduce((best, row) => (row[1] > best[1] ? row : best));
  let action = 'allow';
  if (score >= thresholds.block) action = 'block';
  else if (score >= thresholds.review) action = 'review';
  return { action, category, score, scores };
}

/**
 * Keep the categories that came back as a number in range, and nothing else.
 *
 * A category the model invented is dropped, one it omitted is simply absent.
 * An answer with none of them left is unusable, and unusable is thrown rather
 * than quietly turned into "allow".
 */
async function ask(client, comment, attempts) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const answer = await client.complete({
        prompt: `${PROMPT}\n${comment}`,
        // Temperature zero, because a moderation decision that changes between
        // two identical calls cannot be explained to the person it hit.
        temperature: 0,
      });
      // No content (a refusal) and anything but a JSON object are unusable.
      const parsed = typeof answer === 'string' ? JSON.parse(unfenced(answer)) : null;
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        lastError = new Error('the answer is not a JSON object');
        continue;
      }
      const scores = Object.fromEntries(CATEGORIES.filter((n) => isScore(parsed[n])).map((n) => [n, parsed[n]]));
      if (Object.keys(scores).length > 0) return scores;
      lastError = new Error('no category came back as a score in range');
    } catch (error) {
      lastError = error;
    }
  }
  throw new ModerationUnavailable(String(lastError));
}

/** A number the caller can act on, rather than whatever came back. */
/**
 * A JSON answer wrapped whole in one code fence is read; nothing else is.
 *
 * Prose around it, a second block, or a fence never closed is a failed answer,
 * and it is asked for again rather than salvaged.
 */
function unfenced(answer) {
  const text = answer.trim();
  const fences = text.match(/```/g)?.length ?? 0;
  if (text.startsWith('```') && text.endsWith('```') && fences === 2) {
    const inner = text.slice(3, -3);
    return inner.startsWith('json') ? inner.slice(4) : inner;
  }
  return text;
}

function isScore(value) {
  return typeof value === 'number' && value >= 0 && value <= 1;
}
