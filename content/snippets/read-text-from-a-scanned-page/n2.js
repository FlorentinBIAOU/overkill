/**
 * Read a scanned page with a self-hosted optical recognition engine.
 *
 * Rung N2. When N0 answered « no text layer », something has to look at the
 * pixels. An engine like Tesseract does exactly that, on your machine: the
 * page never leaves it, and there is no key and no quota.
 *
 * What you own on this rung is not the engine, it is everything around it: the
 * language you tell it to expect, the confidence under which a page goes to a
 * human, the cleaning of a text that comes back broken across lines, and the
 * answer to « what does the code do when the engine says nothing usable ».
 */

// The language data the engine loads, named by its Tesseract code: `fra` for
// French documents.
export const LANGUAGE = 'fra';

// The engine reports how sure it is of each word. Below this, the page is
// still returned, but flagged: the text is a draft, not a reading.
export const DEFAULT_MIN_CONFIDENCE = 0.7;

export class OCRUnavailable extends Error {}

/** The real engine: one worker, started on first use and kept for the process. */
export class TesseractOCR {
  static async load(language = LANGUAGE) {
    // tesseract.js downloads the language data from a CDN unless `langPath`
    // points at local files.
    const { createWorker } = await import('tesseract.js');
    return new TesseractOCR(await createWorker(language));
  }

  constructor(worker) {
    this.worker = worker;
  }

  /** The text of one image, and how sure the engine is of it. */
  async read(imagePath) {
    const { data } = await this.worker.recognize(imagePath);
    // Since tesseract.js 6, words are not returned unless asked for; `confidence`
    // is the engine's mean word score, out of a hundred.
    return { text: data.text, confidence: data.confidence / 100 };
  }
}

let worker; // a promise, so two pages read at once still share one worker

function defaultEngine() {
  worker ??= TesseractOCR.load().catch((error) => {
    worker = undefined; // a failed start is not kept: the next page tries again
    throw error;
  });
  return worker;
}

/**
 * Read one page image, and say whether a human should check the result.
 *
 * `engine` is injected so this can be tested without installing the binary or
 * the language data. In production it defaults to the real engine above.
 *
 * @param {string} imagePath
 * @param {{read: Function}} [engine]
 * @param {{minConfidence?: number, attempts?: number}} [options]
 */
export async function readPage(imagePath, engine, { minConfidence = DEFAULT_MIN_CONFIDENCE, attempts = 2 } = {}) {
  const reader = engine ?? (await defaultEngine());
  const reading = await read(reader, imagePath, attempts);
  if (typeof reading?.text !== 'string') {
    throw new OCRUnavailable('the engine owed a reading, and did not give one');
  }

  const text = clean(reading.text);
  const confidence = confidenceOf(reading.confidence);
  // A doubtful page is not thrown away: it goes to a human with the text and
  // the score that earned the doubt. Throwing it away would cost the reading
  // that was, most of the time, almost right.
  return { text, confidence, review: text === '' || confidence < minConfidence };
}

/** One page per call, and a failed call is retried, not swallowed. */
async function read(engine, imagePath, attempts) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await engine.read(imagePath);
    } catch (error) {
      lastError = error;
    }
  }
  throw new OCRUnavailable(String(lastError));
}

/** Whitespace, and the hyphen a line break leaves inside a word. */
export function clean(text) {
  const lines = text
    .split('\n')
    .map((line) => line.replace(/[ \t\xa0]+/g, ' ').trim())
    .filter((line) => line !== '');
  // « exemp-\nlaire » is one word the scanner cut in two, not two words. Letters
  // only: « 2024-\n000431 » is a reference, and keeps its hyphen.
  return lines.join('\n').replace(/(\p{L})-\n(\p{L})/gu, (_, before, after) => before + after);
}

/** A number the caller can act on, rather than whatever came back. */
function confidenceOf(value) {
  return typeof value === 'number' && value >= 0 && value <= 1 ? value : 0;
}
