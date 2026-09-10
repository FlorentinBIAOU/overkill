/**
 * Read a scanned page by handing the image to a general-purpose multimodal
 * model.
 *
 * Rung N3. This is the option people reach for first, and on this entry it
 * does buy something real: a model that sees the page reads a handwritten
 * annotation in the margin, a stamp across a table, a column layout an OCR
 * engine flattens.
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

// The signatures a scanner produces. Anything else is refused rather than sent
// and charged for, because a provider will reject it too.
const SIGNATURES = [
  [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'image/png'],
  [[0xff, 0xd8, 0xff], 'image/jpeg'],
  [[0x49, 0x49, 0x2a, 0x00], 'image/tiff'],
  [[0x4d, 0x4d, 0x00, 0x2a], 'image/tiff'],
];

// A page scan larger than this is a photograph of a desk, not a page. A model
// charges by what it is given, so refusing it is a cost control, not an
// optimisation.
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

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
  if (!client) {
    // Needs a key and a network, so it is never reached in the tests.
    const { OpenAI } = await import('openai');
    client = new OpenAI();
  }

  const bytes = Buffer.from(imageBytes);
  const mediaType = mediaTypeOf(bytes);
  if (bytes.length > maxBytes) throw new RangeError(`image larger than ${maxBytes} bytes`);

  const answer = await ask(client, bytes, mediaType, attempts);
  const { text, unreadable = [] } = answer;
  if (typeof text !== 'string' || !Array.isArray(unreadable)) {
    throw new ReadingUnavailable('the model answered JSON that is not a transcription');
  }

  // What the model admits it could not read is the only doubt it reports. It
  // is worth having, and it is not a confidence: see the test file.
  return { text, unreadable: unreadable.map(String), review: unreadable.length > 0 };
}

/** Read the format from the bytes, rather than trusting a file extension. */
function mediaTypeOf(bytes) {
  for (const [signature, mediaType] of SIGNATURES) {
    if (signature.every((byte, i) => bytes[i] === byte)) return mediaType;
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
        // Temperature zero: a transcription that changes between two identical
        // calls cannot be checked by anyone.
        temperature: 0,
      });
      const parsed = JSON.parse(answer);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
      lastError = new Error('the model answered something that is not an object');
    } catch (error) {
      lastError = error;
    }
  }
  throw new ReadingUnavailable(String(lastError));
}
