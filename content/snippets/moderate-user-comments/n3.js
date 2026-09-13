/**
 * Score a comment by asking a general-purpose model.
 *
 * Rung N3. The shortest code on the ladder to write, and the one that hands
 * the most away: what each category means, the calibration, the right to
 * appeal, and the text of your users' comments, which leaves your premises on
 * every call.
 *
 * You name the categories below; the model decides what they mean. Everything
 * else here — capping the input, retrying, refusing to act on an answer that
 * is not the shape you asked for — is plumbing you own, and it is where the
 * bugs of this rung live. It is also all your tests can reach, because the
 * judgement itself is not testable.
 */

export const CATEGORIES = ['harassment', 'hate', 'violence', 'self_harm'];

const PROMPT = [
  'Rate the comment below on each moderation category. Answer with JSON',
  'only: an object mapping each category to a score between 0 and 1.',
  `Categories: ${CATEGORIES.join(', ')}`,
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
  if (!client) {
    // Needs a key and a network, so it is never reached in the tests.
    const { OpenAI } = await import('openai');
    client = new OpenAI();
  }

  // A model charges by the token, and a comment that long is a bug or an
  // attack. Refusing it is a cost control, not an optimisation.
  if (comment.length > MAX_CHARACTERS) {
    throw new RangeError(`comment longer than ${MAX_CHARACTERS} characters`);
  }

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
      const parsed = JSON.parse(answer);
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
function isScore(value) {
  return typeof value === 'number' && value >= 0 && value <= 1;
}
