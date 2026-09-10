/**
 * Read a scanned page with a self-hosted optical recognition engine.
 *
 * Rung N2. When N0 answered « no text layer », something has to look at the
 * pixels. An engine like Tesseract does exactly that, on your machine: the
 * page never leaves it, there is no key and no quota, and the same image gives
 * the same reading every time.
 *
 * What you own on this rung is not the engine, it is everything around it: the
 * language you tell it to expect, the confidence under which a page goes to a
 * human, the cleaning of a text that comes back broken across lines, and the
 * answer to « what does the code do when the engine says nothing usable ».
 */

// The language matters more than anything else you can tune here: an engine
// reading French with an English model invents accents it has never seen.
export const LANGUAGE = 'fra';

// The engine reports how sure it is of each word. Below this, the page is
// still returned, but flagged: the text is a draft, not a reading.
export const DEFAULT_MIN_CONFIDENCE = 0.7;

export class OCRUnavailable extends Error {}

/** The real engine, started once and kept for the process. */
export class TesseractOCR {
  static async load(language = LANGUAGE) {
    const { createWorker } = await import('tesseract.js'); // pulls the language data once
    return new TesseractOCR(await createWorker(language));
  }

  constructor(worker) {
    this.worker = worker;
  }

  /** The text of one image, and how sure the engine is of it. */
  async read(imagePath) {
    const { data } = await this.worker.recognize(imagePath);
    // Word-level scores, on a hundred-point scale.
    const scores = data.words.filter((w) => w.text.trim()).map((w) => w.confidence);
    const total = scores.reduce((sum, score) => sum + score, 0);
    return { text: data.text, confidence: scores.length ? total / (100 * scores.length) : 0 };
  }
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
  const reader = engine ?? (await TesseractOCR.load());
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

/** Whitespace, and the hyphen a page break leaves inside a word. */
export function clean(text) {
  const lines = text
    .split('\n')
    .map((line) => line.replace(/[ \t\xa0]+/g, ' ').trim())
    .filter((line) => line !== '');
  // « exemp-\nlaire » is one word the scanner cut in two, not two words.
  return lines.join('\n').replace(/(\w)-\n(\w)/g, (_, before, after) => before + after);
}

/** A number the caller can act on, rather than whatever came back. */
function confidenceOf(value) {
  return typeof value === 'number' && value >= 0 && value <= 1 ? value : 0;
}
