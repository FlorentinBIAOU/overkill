/**
 * Get the text out of a PDF, in the order it is meant to be read.
 *
 * Rung N0. A PDF does not store a text: it stores instructions for drawing
 * glyphs at coordinates. Reading them is what `pdf.js` does here, and `pypdf`
 * or `pdftotext` in Python, and none of them needs a model — the characters
 * are in the file, exactly, and no recognition happens.
 *
 * What they do not do is decide in which order those characters are meant to
 * be read. A word processor exporting two columns often draws them line by
 * line, left then right, so the naïve reading gives « La boulangerie Martin
 * fête Clémentine Martin a repris ». The columns are found here instead, by
 * looking for the vertical gutters — the bands of the page where no word sits
 * — and each one is read from top to bottom before the next begins.
 *
 * One thing is deliberately left alone: a word cut at the end of a line stays
 * cut. Gluing « généra- » and « tions » back together is one line of code and
 * would also glue « Boulogne- » and « Billancourt », which is a different
 * town. The caller knows its corpus; this function does not guess.
 */

// Two words are on the same line if their baselines are within this many points.
export const SAME_LINE = 3.0;

// A band of the page this wide with no word in it is a gutter between columns.
// An ordinary word space is under five points; a column gutter is twenty to
// forty. Twenty-five sits between the two.
export const MIN_GUTTER = 25.0;

/**
 * The text of the document, page by page, read column by column.
 *
 * `columns` in each page's report is how many the code found, which is what
 * tells a caller that the page was not a simple column of prose.
 *
 * @param {Uint8Array} pdfBytes
 * @param {{pages?: number[], load?: object}} [options]
 */
export async function readText(pdfBytes, { pages, load } = {}) {
  const pdfjs = load ?? (await import('pdfjs-dist/legacy/build/pdf.mjs'));
  const read = [];
  try {
    const document = await pdfjs.getDocument({
      data: new Uint8Array(pdfBytes), isEvalSupported: false,
    }).promise;
    for (let number = 1; number <= document.numPages; number += 1) {
      if (pages && !pages.includes(number)) continue;
      // eslint-disable-next-line no-await-in-loop -- pdf.js hands pages out one at a time
      const content = await (await document.getPage(number)).getTextContent();
      const words = content.items
        .filter((item) => (item.str ?? '').trim())
        .map((item) => ({
          text: item.str.trim(),
          x: item.transform[4],
          end: item.transform[4] + item.width,
          y: item.transform[5],
        }));
      const bands = findColumns(words);
      const blocks = bands.map((band) => columnText(words, band)).filter(Boolean);
      read.push({ page: number, columns: bands.length, text: blocks.join('\n\n') });
    }
  } catch (error) {
    return { pages: [], reason: `this file could not be opened as a PDF: ${error.message}` };
  }
  return { pages: read, reason: null };
}

/**
 * The horizontal bands the page's text sits in, left to right.
 *
 * The page is swept one point at a time; a run of points no word overlaps,
 * wider than a gutter, separates two columns.
 */
export function findColumns(words) {
  if (words.length === 0) return [];
  const left = Math.floor(Math.min(...words.map((word) => word.x)));
  const right = Math.floor(Math.max(...words.map((word) => word.end))) + 1;
  const busy = new Uint8Array(right - left);
  for (const word of words) {
    for (let p = Math.floor(word.x) - left; p < Math.floor(word.end) - left; p += 1) busy[p] = 1;
  }

  const bands = [];
  let start = 0;
  let gap = 0;
  for (let position = 0; position < busy.length; position += 1) {
    if (busy[position]) {
      if (gap >= MIN_GUTTER && position - gap > start) {
        bands.push([left + start, left + position - gap]);
        start = position - gap;
      }
      gap = 0;
    } else {
      gap += 1;
    }
  }
  bands.push([left + start, right]);
  return bands;
}

/** The words of one band, read top to bottom, left to right. */
function columnText(words, band) {
  const middle = words.filter((w) => (w.x + w.end) / 2 >= band[0] && (w.x + w.end) / 2 < band[1]);
  const lines = [];
  for (const word of middle.sort((a, b) => b.y - a.y || a.x - b.x)) {
    const last = lines.at(-1);
    if (last && Math.abs(last[0].y - word.y) <= SAME_LINE) last.push(word);
    else lines.push([word]);
  }
  return lines.map((line) => line.map((word) => word.text).join(' ')).join('\n');
}
