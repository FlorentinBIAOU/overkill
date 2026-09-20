/**
 * Sort a pile of PDFs into the pages that need OCR and the pages that do not.
 *
 * Rung N0. OCR and vision models are billed by the page, and most of the pages
 * in an archive do not need either: a PDF written by an accounting tool, a
 * word processor or a print driver already carries its text, exactly, next to
 * its drawing instructions. Reading that text costs nothing and cannot be
 * wrong, because no recognition happened.
 *
 * So the decision is taken per page, not per document. A contract exported
 * from a word processor with a scanned signature page at the end is one file
 * with two kinds of page in it, and sending the whole thing to OCR pays for
 * the pages that were already readable.
 *
 * Two numbers per page are enough, and this is the part a model would replace
 * with a guess: how many non-space characters the page yields, and how many
 * images it draws. Text and no image is a page to leave alone. An image and
 * almost no text is a scan — and « almost » matters, because a scanned page
 * often carries a header or a page number in real text, which a rule that only
 * asks « is there any text » counts as a readable page.
 *
 * `pdf.js` reads the page here, `pypdf` in Python. Neither is asked to
 * recognise anything.
 */

// A page of an ordinary document yields a few thousand characters; a header, a
// reference or a page number yields a few dozen. Anything under this, with an
// image on the page, is a scan wearing a label. Raise it for dense documents,
// lower it for forms.
export const MIN_CHARACTERS = 120;

/**
 * Say, page by page, which ones have to go to OCR.
 *
 * The answer is a plan: `needs_ocr` is the list of page numbers to pay for,
 * `readable` the ones to read for free, `unreadable` the ones that carry
 * neither text nor image and that OCR would not help either.
 *
 * `load` is injected by the tests; in production it is pdf.js.
 */
export async function triagePages(pdfBytes, { minCharacters = MIN_CHARACTERS, load } = {}) {
  // Imported here, and only here: nothing else in this file needs it.
  const pdfjs = load ?? (await import('pdfjs-dist/legacy/build/pdf.mjs'));
  const painted = new Set([
    pdfjs.OPS.paintImageXObject,
    pdfjs.OPS.paintInlineImageXObject,
    pdfjs.OPS.paintImageMaskXObject,
    pdfjs.OPS.paintImageXObjectRepeat,
  ]);

  const report = [];
  try {
    const document = await pdfjs.getDocument({
      data: new Uint8Array(pdfBytes), isEvalSupported: false,
    }).promise;
    for (let number = 1; number <= document.numPages; number += 1) {
      /* eslint-disable no-await-in-loop -- pdf.js hands pages out one at a time */
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      const operators = await page.getOperatorList();
      /* eslint-enable no-await-in-loop */
      const text = content.items.map((item) => item.str ?? '').join('');
      const characters = [...text].filter((character) => !/\s/u.test(character)).length;
      const images = operators.fnArray.filter((code) => painted.has(code)).length;
      report.push({ page: number, characters, images, verdict: verdictOf(characters, images, minCharacters) });
    }
  } catch (error) {
    return { pages: [], needs_ocr: [], readable: [], unreadable: [],
      reason: `this file could not be opened as a PDF: ${error.message}` };
  }

  const numbers = (kind) => report.filter((p) => p.verdict === kind).map((p) => p.page);
  return {
    pages: report,
    needs_ocr: numbers('scan'),
    readable: numbers('text'),
    unreadable: numbers('blank'),
    reason: null,
  };
}

function verdictOf(characters, images, minCharacters) {
  // The order matters. A page with enough text is readable whatever it also
  // draws; below that, an image is what OCR is for, and nothing at all is a
  // page OCR would return empty — which is worth knowing before paying.
  if (characters >= minCharacters) return 'text';
  return images ? 'scan' : 'blank';
}
