/**
 * Read a scanned page by handing the image to a general-purpose multimodal
 * model.
 *
 * Rung N3. The page goes out whole, to a model that returns a transcription.
 *
 * Note what the code has to do that N0 did not: recognise the image format,
 * cap what it sends, encode the bytes, retry on failure, parse an answer that
 * is only probably valid JSON, and refuse an answer it cannot use. That
 * plumbing is the real cost of this rung, and it is the part the tests have to
 * cover, because the model itself is not testable.
 *
 * And note what none of that plumbing can do: tell whether the transcription
 * is what the page says. A model that reads is also a model that writes.
 */

export const PROMPT = [
  'Transcribe the page in the image, exactly as it is printed, keeping the',
  'line breaks. Answer with JSON only: an object with keys `text` and',
  '`unreadable`, where `text` is the transcription and `unreadable` is the',
  'list of fragments you could not read. Never guess at a fragment you',
  'cannot read: leave « ... » in the text and name it in `unreadable`.',
].join('\n');

// The formats the provider's vision input lists: PNG, JPEG, WEBP and GIF (not
// animated, which this check does not see). Anything else, a TIFF included, is
// refused before it is sent: convert it first.
const SIGNATURES = [
  [/^\x89PNG\r\n\x1a\n/, 'image/png'],
  [/^\xff\xd8\xff/, 'image/jpeg'],
  [/^RIFF[\s\S]{4}WEBP/, 'image/webp'],
  [/^GIF8[79]a/, 'image/gif'],
];

// A cap on what is encoded and uploaded; base64 makes the request a third
// larger than the file. It is not a cost control: the provider bills an image
// by its dimensions, not by its bytes.
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

// The provider named here is an example, not a recommendation: the reasoning
// holds for any general-purpose model API, and the client is swappable. Pass
// any object with a `complete({ prompt, image, temperature })` method.
export const MODEL = 'gpt-4.1-mini'; // an example id: check the parameters your model accepts

export async function providerClient(sdk, model = MODEL) {
  if (!sdk) {
    const { OpenAI } = await import('openai');
    sdk = new OpenAI();
  }
  return {
    async complete({ prompt, image, temperature }) {
      // The image travels inside the message, as a data URL.
      const url = `data:${image.mediaType};base64,${image.data}`;
      const response = await sdk.chat.completions.create({
        model,
        messages: [{
          role: 'user',
          content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url } }],
        }],
        temperature,
      });
      return response.choices[0].message.content;
    },
  };
}

export class ReadingUnavailable extends Error {}

/**
 * Transcribe one page image, and say what the model admits it could not read.
 *
 * @param {Buffer|Uint8Array} imageBytes
 * @param {object} options
 * @param {{complete: Function}} [options.client] injected so this can be
 *   tested without a network call; defaults to a real provider client
 * @param {number} [options.attempts]
 * @param {number} [options.maxBytes]
 */
export async function readPage(imageBytes, { client, attempts = 3, maxBytes = MAX_IMAGE_BYTES } = {}) {
  client ??= await providerClient();
  const bytes = Buffer.from(imageBytes);
  const mediaType = mediaTypeOf(bytes);
  if (bytes.length > maxBytes) throw new RangeError(`image larger than ${maxBytes} bytes`);

  const answer = await ask(client, bytes, mediaType, attempts);
  const { text, unreadable = [] } = answer;
  if (typeof text !== 'string' || !Array.isArray(unreadable)) {
    throw new ReadingUnavailable('the model answered JSON that is not a transcription');
  }

  // Two doubts, and neither is a confidence: what the model admits it could
  // not read, and a page that came back empty. See the test file.
  const review = unreadable.length > 0 || text.trim() === '';
  return { text, unreadable: unreadable.map(String), review };
}

/** Read the format from the bytes, rather than trusting a file extension. */
function mediaTypeOf(bytes) {
  const head = bytes.subarray(0, 12).toString('latin1');
  for (const [signature, mediaType] of SIGNATURES) {
    if (signature.test(head)) return mediaType;
  }
  throw new TypeError('unrecognised image format');
}

async function ask(client, bytes, mediaType, attempts) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const answer = await client.complete({
        prompt: PROMPT,
        // Base64 is how an image travels in a JSON request body.
        image: { mediaType, data: bytes.toString('base64') },
        // The lowest temperature: the SDK documents lower values as more
        // focused and deterministic.
        temperature: 0,
      });
      if (typeof answer !== 'string') {
        lastError = new Error('the model answered no text'); // a refusal comes back as no content
        continue;
      }
      const parsed = JSON.parse(answer);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
      lastError = new Error('the model answered something that is not an object');
    } catch (error) {
      lastError = error;
    }
  }
  throw new ReadingUnavailable(String(lastError));
}
