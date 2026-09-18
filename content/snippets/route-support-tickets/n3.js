/**
 * Route a ticket by asking a general-purpose model.
 *
 * Rung N3. No rules to maintain and no archive to label: the team names go in
 * the prompt, and the model answers with one of them.
 *
 * Note what the code has to do that N0 did not: cap the input size, retry a
 * provider that fails, parse an answer that is only probably JSON, and refuse
 * a team the model made up. That plumbing is the real cost of this rung, and
 * it is the part your tests have to cover, because the model itself is not
 * testable.
 *
 * Read the end of `route` closely. A model answers with words, and words are
 * not queues. The closed list is the only thing standing between a confident
 * answer and a ticket sitting in a queue nobody watches.
 */

// The queues that exist. Business knowledge, and here also a safety rail.
export const TEAMS = ['billing', 'technical', 'shipping'];
export const DEFAULT_TEAM = 'general';

export const MAX_CHARACTERS = 4000;

const PROMPT = [
  'You are routing a customer support ticket to one team.',
  `Answer with JSON only: {"team": "..."} where team is one of: ${TEAMS.join(', ')}.`,
  `If the ticket does not clearly belong to one of them, answer '${DEFAULT_TEAM}'.`,
  '',
  'Ticket:',
].join('\n');

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

export class RoutingUnavailable extends Error {}

/**
 * The team that gets the ticket.
 *
 * @param {string} ticket
 * @param {object} options
 * @param {{complete: Function}} [options.client] injected so this can be
 *   tested without a network call; defaults to a real provider client
 * @param {number} [options.attempts]
 */
export async function route(ticket, { client, attempts = 3 } = {}) {
  client ??= await providerClient();

  // The provider bills every token of the prompt, and a ticket with a
  // forwarded thread or a pasted log under it is long. The cap counts
  // characters, not tokens — code points, as in Python — and it truncates
  // rather than throwing: a router that throws leaves the ticket nowhere, and
  // the team is usually decided by the first paragraph anyway.
  const sent = [...ticket].slice(0, MAX_CHARACTERS).join('');

  const answer = await ask(client, sent, attempts);
  const named = answer && typeof answer.team === 'string' ? answer.team.trim().toLowerCase() : '';
  // Two failures, two treatments. A provider that cannot answer is an
  // incident, and `ask` above throws. A model that answers a team nobody
  // created is a normal Tuesday, and the ticket goes to the default queue.
  return TEAMS.includes(named) ? named : DEFAULT_TEAM;
}

async function ask(client, ticket, attempts) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      // The lowest temperature: the SDK documents lower values as more focused
      // and deterministic.
      const answer = await client.complete({ prompt: `${PROMPT}\n${ticket}`, temperature: 0 });
      if (typeof answer !== 'string') {
        lastError = new Error('the model answered no text'); // a refusal comes back as no content
        continue;
      }
      return JSON.parse(answer);
    } catch (error) {
      lastError = error;
    }
  }
  throw new RoutingUnavailable(String(lastError));
}
