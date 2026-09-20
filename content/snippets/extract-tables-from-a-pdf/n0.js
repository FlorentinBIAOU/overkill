/**
 * Read the tables of a PDF, and say how they were read.
 *
 * Rung N0. A table in a PDF is not a table: it is text placed at coordinates,
 * sometimes with lines drawn around it. Two readings follow from that, and
 * they are not equally trustworthy.
 *
 * When the table is ruled, the lines say where the cells are, and reading it
 * is exact. That is what `pdfplumber` does on the Python side of this entry,
 * and there is no equivalent of it in JavaScript: no package reads the rules
 * of a PDF and pairs them into a grid. So this file does the other reading
 * only, the one that guesses the columns from where the words sit, and
 * `strategy` says so on every table it returns.
 *
 * The consequence is measured in the test, and it is the reason this entry
 * reports the strategy at all: on a ruled table whose designation wraps onto
 * two lines, the Python extract returns three rows with the two lines in one
 * cell, and this one returns four with the second line alone.
 *
 * The grouping below is the same code in both languages, so that on a table
 * with no rules — the common case in an emailed invoice — the two answer
 * exactly the same thing.
 *
 * That guess is made from the whole page, not from the table: the columns come
 * from every left edge seen on the page, address block and footer included.
 * That is why the reading keeps only the lines with at least two filled cells
 * — « SARL Le Moulin » alone on its line is the letterhead, not a row. What it
 * left out is not thrown away: `dropped_lines` holds the text of every line it
 * refused, so nothing read on the page is lost, and what is not a row is named
 * rather than silently rendered as one. Without that rule, the four lines of
 * letterhead of an emailed invoice come back as four rows with three empty
 * cells, and a caller iterating over `rows.slice(1)` reads a street address as
 * a part number.
 */

// Two words are on the same line if their baselines are within this many
// points. A ten-point font makes a line about twelve points tall, so three is
// generous without merging neighbouring rows.
export const SAME_LINE = 3.0;

// Two words belong to the same cell when the gap between them is no wider than
// this. A space in a ten-point font is under three points; the gap between two
// columns of a table is tens of points. Ten sits between the two.
export const SAME_CELL = 10.0;

// Two cells are in the same column when their left edges are within this.
export const SAME_COLUMN = 12.0;

// A line with fewer filled cells than this is not a row of the table: it is
// the letterhead, the invoice number, a page footer, a paragraph of prose, or
// the second half of a designation that wrapped. All of them go to
// `dropped_lines`, with their text.
export const MIN_FILLED_CELLS = 2;

/** How many cells of this line carry text. */
const filled = (row) => row.filter((cell) => cell).length;

/**
 * Every table of the document, page by page, with the reading that found it.
 *
 * `pages` is the list of page numbers to look at, counted from one; left out,
 * every page is read.
 *
 * @param {Uint8Array} pdfBytes
 * @param {{pages?: number[], load?: object}} [options]
 */
export async function readTables(pdfBytes, { pages, load } = {}) {
  const pdfjs = load ?? (await import('pdfjs-dist/legacy/build/pdf.mjs'));
  const found = [];
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
      const rows = groupIntoRows(words);
      const kept = rows.filter((row) => filled(row) >= MIN_FILLED_CELLS);
      const dropped = rows.filter((row) => filled(row) < MIN_FILLED_CELLS)
        .map((row) => row.filter((cell) => cell).join(' '));
      if (kept.length > 0) {
        found.push({ page: number, strategy: 'text', rows: kept, dropped_lines: dropped });
      }
    }
  } catch (error) {
    return { tables: [], reason: `this file could not be opened as a PDF: ${error.message}` };
  }
  return { tables: found, reason: null };
}

/**
 * Words with coordinates, turned into a grid.
 *
 * Lines first, by baseline; then the cells, by the gap between words; then the
 * columns, taken from the left edges seen across the whole page. A word is
 * never cut: it belongs to the column its left edge is nearest.
 */
export function groupIntoRows(words) {
  if (words.length === 0) return [];

  // Lines, by baseline.
  const lines = [];
  for (const word of [...words].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const last = lines.at(-1);
    if (last && Math.abs(last[0].y - word.y) <= SAME_LINE) last.push(word);
    else lines.push([word]);
  }

  // Cells, by the gap between words: « Moulin a cafe » is one cell, and the
  // eighty points that follow it are a column boundary.
  const celled = lines.map((line) => {
    const cells = [];
    for (const word of line) {
      const last = cells.at(-1);
      if (last && word.x - last.end <= SAME_CELL) {
        last.text = `${last.text} ${word.text}`;
        last.end = word.end;
      } else {
        cells.push({ ...word });
      }
    }
    return cells;
  });

  // Columns, from the left edges seen across the whole page.
  const columns = [];
  for (const x of celled.flat().map((cell) => cell.x).sort((a, b) => a - b)) {
    if (columns.length === 0 || x - columns.at(-1) > SAME_COLUMN) columns.push(x);
  }

  return celled.map((line) => {
    const row = Array(columns.length).fill('');
    for (const cell of line) {
      let index = 0;
      for (let i = 1; i < columns.length; i += 1) {
        if (Math.abs(columns[i] - cell.x) < Math.abs(columns[index] - cell.x)) index = i;
      }
      row[index] = `${row[index]} ${cell.text}`.trim();
    }
    return row;
  });
}
