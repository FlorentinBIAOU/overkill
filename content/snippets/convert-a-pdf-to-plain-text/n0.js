/**
 * Get the text out of a PDF, in the order it is meant to be read.
 *
 * Rung N0. A PDF does not store a text: it stores instructions for drawing
 * glyphs at coordinates. Turning them back into characters is what `pdf.js`
 * does here, and what `pypdf` or `pdftotext` do in Python — the Python snippet
 * of this entry calls neither, it goes through `pdfplumber`, which is the one
 * that also hands out the position of every word. None of them needs a model:
 * the characters are in the file, exactly, and no recognition happens.
 *
 * What they do not do is decide in which order those characters are meant to
 * be read. A word processor exporting two columns often draws them line by
 * line, left then right, so the naïve reading gives « La boulangerie Martin
 * fête Clémentine Martin a repris ». The columns are found here instead, by
 * looking for the vertical gutters — the bands of the page where no word sits
 * — and each one is read from top to bottom before the next begins.
 *
 * A page with more than two bands is not reordered at all. Two columns is
 * what a word processor exports; three or more, on a page nobody here
 * typeset, is a table, a form or a price list, and the gutters of a table are
 * as wide as those of a text. Reading its bands top to bottom would give all
 * the part numbers, then all the designations, then all the prices, and the
 * link between MC-4501 and 19,90 would be gone. Those pages are read in page
 * order, and `reason` says so on the page that got it. What to do next is the
 * `extract-tables-from-a-pdf` entry, which reads the grid instead of the
 * prose.
 *
 * The count of bands is all this rule has, and it is what is portable: how
 * many words a line holds depends on how the extractor cut the runs, and
 * `pdf.js` and `pdfplumber` do not cut them the same way. So a table of
 * exactly two columns — a label on the left, an amount on the right — is still
 * read as two columns, and still transposed. That is the first line of the
 * breaking point, not a footnote.
 *
 * One thing is deliberately left alone: a word cut at the end of a line stays
 * cut. Gluing « généra- » and « tions » back together is one line of code and
 * would also glue « Boulogne- » and « Billancourt », which is a different
 * town. The caller knows its corpus; this function does not guess, and it
 * counts those lines in `hyphenated_lines` so the caller can decide for its
 * own.
 */

// Two words are on the same line if their baselines are within this many points.
export const SAME_LINE = 3.0;

// A band of the page this wide with no word in it is a gutter between columns.
// An ordinary word space is under five points; a column gutter is twenty to
// forty. Twenty-five sits between the two. It is the default of `minGutter`,
// which the caller can move: a page laid out in a tighter grid needs a smaller
// one, and a page with wide word spacing a larger.
export const MIN_GUTTER = 25.0;

// Above this many bands, the page is not a document in columns: it is a table,
// a form or a price list, and reading its bands top to bottom would transpose
// it. Two is the layout a word processor exports; three or more, on a page the
// caller did not typeset, is a grid.
export const MAX_COLUMNS = 2;


/**
 * The text of the document, page by page, read column by column.
 *
 * `columns` in each page's report is how many bands the code found, which is
 * what tells a caller that the page was not a simple column of prose. It says
 * what was found, not what was done: when those bands are a grid rather than
 * columns, the page is read in page order and its `reason` says so. Reordering
 * a table transposes it, and a transposed table is a wrong text, not an
 * incomplete one.
 *
 * `hyphenated_lines` counts the lines that end on a hyphen, because this
 * function never glues them back and the caller may want to.
 *
 * @param {Uint8Array} pdfBytes
 * @param {{pages?: number[], load?: object, minGutter?: number}} [options]
 */
export async function readText(pdfBytes, { pages, load, minGutter = MIN_GUTTER } = {}) {
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
      const bands = findColumns(words, { minGutter });
      let reason = null;
      let reading = bands;
      if (bands.length > MAX_COLUMNS) {
        // The bands are kept in `columns`: the caller is told what was found
        // as well as what was done with it.
        reading = [[bands[0][0], bands.at(-1)[1]]];
        reason = 'this page looks like a table: read in page order';
      }
      const blocks = reading.map((band) => columnText(words, band)).filter(Boolean);
      const text = blocks.join('\n\n');
      read.push({
        page: number,
        columns: bands.length,
        text,
        hyphenated_lines: text.split('\n').filter((line) => line.endsWith('-')).length,
        reason,
      });
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
export function findColumns(words, { minGutter = MIN_GUTTER } = {}) {
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
      if (gap >= minGutter && position - gap > start) {
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

/** The words of one band, grouped into lines, top to bottom. */
function linesOf(words, band) {
  const middle = words.filter((w) => (w.x + w.end) / 2 >= band[0] && (w.x + w.end) / 2 < band[1]);
  const lines = [];
  for (const word of middle.sort((a, b) => b.y - a.y || a.x - b.x)) {
    const last = lines.at(-1);
    if (last && Math.abs(last[0].y - word.y) <= SAME_LINE) last.push(word);
    else lines.push([word]);
  }
  return lines;
}

/** The words of one band, read top to bottom, left to right. */
function columnText(words, band) {
  return linesOf(words, band).map((line) => line.map((word) => word.text).join(' ')).join('\n');
}
