/**
 * Ask the document whether it already carries its text, before reaching for OCR.
 *
 * Rung N0. One question, put to a PDF library, and an answer the caller can
 * act on.
 *
 * A PDF produced by an accounting tool, a word processor or a print-to-PDF
 * driver carries its text next to its drawing instructions, already correct,
 * with no recognition step and therefore nothing to get wrong. A scan of the
 * same document carries pixels. The two look alike in a mailbox, and nothing
 * downstream tells them apart unless somebody asks.
 *
 * The question is the point of this rung; the extractor is not. Writing the
 * extractor is the trap: inflating page streams and decoding the text-showing
 * operators is two hundred lines that still lose to the first font the file
 * renumbers for itself, which is what a word processor does on every export.
 * That work is done and shipped — `pdf.js` here, `pypdf` in Python,
 * `pdftotext` at a shell prompt — and what is left to write is the decision.
 *
 * Which is this: a page that carries no readable text is not an empty page,
 * and the function says so instead of handing back an empty string a caller
 * would read as « the page is blank ». A no comes with its next step.
 */

// Under this many readable characters, what was found is a stamp, a page
// number or a stray label, not a text layer. Raise it for dense documents.
export const MIN_CHARACTERS = 24;

/**
 * Say whether the document carries a text layer, and return it if it does.
 *
 * The answer is a report, not a string: `has_text_layer` is the decision the
 * caller acts on, and `reason` is what to tell them when it is false.
 *
 * `load` is injected by the tests; in production it is pdf.js.
 */
export async function readTextLayer(pdfBytes, { minCharacters = MIN_CHARACTERS, load } = {}) {
  // Imported here, and only here: nothing else in this file needs it.
  const getDocument = load ?? (await import('pdfjs-dist/legacy/build/pdf.mjs')).getDocument;
  let text;
  let pages = 0;
  try {
    const document = await getDocument({ data: new Uint8Array(pdfBytes), isEvalSupported: false }).promise;
    pages = document.numPages;
    const read = [];
    for (let number = 1; number <= pages; number += 1) {
      // eslint-disable-next-line no-await-in-loop -- pdf.js hands pages out one at a time
      const content = await (await document.getPage(number)).getTextContent();
      read.push(content.items.map((item) => item.str + (item.hasEOL ? '\n' : '')).join(''));
    }
    text = read.filter((page) => page.trim()).join('\n');
  } catch (error) {
    return report('', 0, 0, `this file could not be opened as a PDF: ${error.message}`);
  }

  const characters = [...text].filter((character) => !/\s/u.test(character)).length;
  if (characters >= minCharacters) return report(text, characters, pages, null);
  return report(text, characters, pages, 'no text layer: this page is an image, and needs OCR');
}

function report(text, characters, pages, reason) {
  return { has_text_layer: reason === null, text, characters, pages, reason };
}
