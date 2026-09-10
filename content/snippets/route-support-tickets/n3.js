/**
 * Route a ticket by asking a general-purpose model.
 *
 * Rung N3. This is the option people reach for first, and it is the shortest
 * piece of routing logic on the entry: no rules to maintain, no archive to
 * label, and a ticket in any language.
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
  if (!client) {
    // Needs a key and a network, so it is never reached in the tests.
    const { OpenAI } = await import('openai');
    client = new OpenAI();
  }

  // A model charges by the token, and a ticket with a forwarded thread under
  // it is long. Refusing oversized input is not an optimisation, it is a cost
  // control.
  if (ticket.length > MAX_CHARACTERS) {
    throw new RangeError(`ticket longer than ${MAX_CHARACTERS} characters`);
  }

  const answer = await ask(client, ticket, attempts);
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
      // Temperature zero, because a routing decision that changes between two
      // identical calls cannot be reviewed.
      const answer = await client.complete({ prompt: `${PROMPT}\n${ticket}`, temperature: 0 });
      return JSON.parse(answer);
    } catch (error) {
      lastError = error;
    }
  }
  throw new RoutingUnavailable(String(lastError));
}
