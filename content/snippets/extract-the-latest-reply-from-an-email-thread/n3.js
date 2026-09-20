/**
 * Ask a model which lines of a thread the last sender wrote.
 *
 * Rung N3. It exists for the one case rung N0 cannot settle: a reply that is
 * not above the quote but inside it, line by line, under the sentences it
 * answers. No marker separates those lines from the ones around them — the
 * client wrote none — and a model reads them the way a human does.
 *
 * The guard is what makes this rung defensible, and it is unusually strong
 * here because the answer is not text but line numbers. The model is given the
 * thread numbered, and returns the numbers of the lines it believes the last
 * sender wrote; anything that is not a line of the message that was sent is
 * dropped, and `dropped` says which. So the reply returned is made of lines of
 * the thread, in their order, and never of a sentence the model found likelier.
 *
 * Two operating conditions. The thread is cut to a budget from the end,
 * because the reply being looked for is normally near the top; a thread longer
 * than the budget whose reply is at the very bottom is cut away before it is
 * read. And the cost is a call per message: this rung is for the threads rung
 * N0 has flagged, not for a mailbox.
 */

// The budget, in characters. A thread that does not fit is cut, not refused.
export const MAX_CHARACTERS = 6000;

// A single code fence around the whole answer is a common shape, and refusing
// it would buy another call for nothing.
const FENCE = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/;

const LINE_END = /\r\n|\r|\n/;

export const MODEL = 'gpt-4.1-mini'; // an example id: check the parameters your model accepts

const PROMPT = [
  'Here is an email thread, one numbered line per line.',
  'Return the numbers of the lines written by the person who sent this message,'
  + ' and not the lines of the messages quoted under it.',
  'Answer with JSON only: {"lines": [numbers]}.',
  '',
  'Thread:',
].join('\n');

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

export class ReadingUnavailable extends Error {}

/**
 * The lines of the thread a model attributes to the last sender.
 *
 * @param {string} message
 * @param {{client?: {complete: Function}, attempts?: number}} [options]
 */
export async function readReply(message, { client, attempts = 3 } = {}) {
  client ??= await providerClient();
  const thread = message.slice(0, MAX_CHARACTERS);
  const lines = thread.split(LINE_END);
  const answer = await ask(client, lines, attempts);

  const kept = [];
  const dropped = [];
  const asked = answer && typeof answer === 'object' ? answer.lines ?? [] : [];
  for (const number of Array.isArray(asked) ? asked : []) {
    if (Number.isInteger(number) && number >= 1 && number <= lines.length
        && !lines[number - 1].trimStart().startsWith('>')) {
      kept.push(number);
    } else {
      // Not a line of what was sent, or a line of the quoted thread.
      dropped.push(number);
    }
  }

  const numbers = [...new Set(kept)].sort((a, b) => a - b);
  const reply = numbers.map((number) => lines[number - 1]).join('\n').trim();
  return { source: 'model', reply, lines: numbers, dropped, characters_sent: thread.length };
}

async function ask(client, lines, attempts) {
  const numbered = lines.map((line, index) => `${index + 1}: ${line}`).join('\n');
  const prompt = `${PROMPT}\n${numbered}`;
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const answer = await client.complete({ prompt, temperature: 0 });
      if (typeof answer !== 'string') {
        lastError = new Error('the model answered no text'); // a refusal has no content
        continue;
      }
      const fenced = FENCE.exec(answer);
      return JSON.parse(fenced ? fenced[1] : answer);
    } catch (error) {
      lastError = error;
    }
  }
  throw new ReadingUnavailable(String(lastError));
}
