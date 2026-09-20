/**
 * A table published in a web page, turned into a rectangular grid.
 *
 * Rung N0. The rows and the cells are elements the HTML specification names,
 * so reading them is parsing. What is not parsing is the one thing that makes
 * tables hard: a cell can span several columns or several rows, and the markup
 * grid is then not the data grid. « Total » written once over three columns is
 * one cell in the source and three cells in the table a reader sees.
 *
 * This rung builds the grid a reader sees. A spanned cell is repeated over the
 * places it covers, and every repeat is flagged — a caller that adds up a
 * column would otherwise count the same amount twice without knowing it. The
 * other choice, leaving holes, misaligns every column after the span, which is
 * worse because nothing tells you.
 *
 * Two more things are reported rather than smoothed over. A table inside a
 * cell of another table is a table of its own: its text does not leak into the
 * cell that holds it, and the holder is flagged. And the caption, when the
 * page wrote one, comes back with the grid, because it is usually what the
 * columns mean.
 */

import { parseHTML } from 'linkedom';

// The largest spans the HTML specification allows, and they are not the same
// number: colspan « must be greater than zero and less than or equal to 1000 »,
// rowspan « must be greater than zero and less than or equal to 65534 ». The
// grid-forming algorithm repeats both caps. A page can claim more than it
// draws, and past these the claim is capped rather than believed — `capped` in
// the report counts how often.
export const MAX_COLSPAN = 1000;
export const MAX_ROWSPAN = 65534;

// « For this attribute, the value zero means that the cell is to span all the
// remaining rows in the row group. » Kept as zero here and resolved in
// `gridOf`, which is the only place that knows how many rows follow. Row
// groups are not tracked, so « the row group » is read as « the table », which
// is the same thing on a table with one `tbody` — the ordinary case.
export const TO_END_OF_GROUP = 0;

/**
 * Every table of `html`, as the rectangular grid a reader sees.
 *
 * A cell that spans is repeated over what it covers, and each repeat says so.
 */
export function extractTables(html) {
  if (typeof html !== 'string') {
    return { tables: [], reason: `expected text, not ${typeof html}` };
  }
  const { document } = parseHTML(`<html><body>${html}</body></html>`);

  // Listed in the order the page opens them, so a table that holds another
  // comes before it — the order a reader would give.
  const found = [];
  const collect = (node) => {
    if (node.tagName === 'TABLE') found.push(node);
    for (const child of node.children ?? []) collect(child);
  };
  collect(document.body);

  const tables = found.map((table) => {
    const cells = rowsOf(table).map((row) => row.map(cellOf));
    const { grid, padded } = gridOf(cells);
    const capped = cells.flat().filter((cell) => cell.capped).length;
    const caption = ownCaption(table);
    return {
      rows: grid,
      columns: grid.length ? grid[0].length : 0,
      // How many cells the rectangular padding added, and how many spans the
      // caps cut back. Without them, `columns` says a width and never says
      // where it came from.
      padded,
      capped,
      caption: caption ? caption.split(/\s+/).filter(Boolean).join(' ') : null,
      nested: table.querySelector('table') !== null,
    };
  });
  return { tables, reason: null };
}

/** The rows of this table, and not those of a table inside it. */
function rowsOf(table) {
  const rows = [];
  // True while the last row opened is the implicit one a stray cell created.
  let orphan = false;
  const walk = (node) => {
    for (const child of node.children) {
      if (child.tagName === 'TABLE') continue;
      if (child.tagName === 'TR') {
        rows.push([]);
        orphan = false;
      } else if (child.tagName === 'TD' || child.tagName === 'TH') {
        // « in table body »: a cell met outside a `tr` opens one. Adding it to
        // the row that just closed would widen every row of the table.
        if (rows.length === 0 || !orphan) { rows.push([]); orphan = true; }
        rows[rows.length - 1].push(child);
        continue;
      }
      if (child.tagName === 'TR') {
        for (const cell of child.children) {
          if (cell.tagName === 'TD' || cell.tagName === 'TH') rows[rows.length - 1].push(cell);
        }
        orphan = false;
      } else {
        walk(child);
      }
    }
  };
  walk(table);
  return rows;
}

function cellOf(cell) {
  const colspan = span(cell.getAttribute('colspan'), MAX_COLSPAN);
  const rowspan = span(cell.getAttribute('rowspan'), MAX_ROWSPAN, true);
  return {
    text: ownText(cell),
    header: cell.tagName === 'TH',
    colspan: colspan.value,
    rowspan: rowspan.value,
    capped: colspan.capped || rowspan.capped,
  };
}

/** The text this element carries itself, a table inside it excepted. */
function ownText(element) {
  let out = '';
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) out += child.nodeValue;
      else if (child.nodeType === 1 && child.tagName !== 'TABLE') walk(child);
    }
  };
  walk(element);
  return out;
}

function ownCaption(table) {
  for (const child of table.children) {
    if (child.tagName === 'CAPTION') return ownText(child);
  }
  return null;
}

/** The markup rows, spread over the places their spans cover. */
function gridOf(rows) {
  const grid = [];
  rows.forEach((row, index) => {
    while (grid.length <= index) grid.push([]);
    let column = 0;
    for (const cell of row) {
      while (column < grid[index].length && grid[index][column] !== null) column += 1;
      const value = {
        text: cell.text.split(/\s+/).filter(Boolean).join(' '),
        header: cell.header,
        repeated: false,
      };
      // A rowspan of zero covers every row left in the group.
      const downTo = cell.rowspan === TO_END_OF_GROUP ? rows.length - index : cell.rowspan;
      for (let down = 0; down < downTo; down += 1) {
        while (grid.length <= index + down) grid.push([]);
        const line = grid[index + down];
        for (let across = 0; across < cell.colspan; across += 1) {
          while (line.length <= column + across) line.push(null);
          if (line[column + across] === null) {
            line[column + across] = down === 0 && across === 0
              ? value : { ...value, repeated: true };
          }
        }
      }
      column += cell.colspan;
    }
  });
  const width = grid.reduce((most, line) => Math.max(most, line.length), 0);
  let padded = 0;
  const full = grid.map((line) => {
    const complete = [...line];
    while (complete.length < width) complete.push(null);
    padded += complete.filter((cell) => cell === null).length;
    return complete.map((cell) => cell ?? { text: '', header: false, repeated: false });
  });
  return { grid: full, padded };
}

/** One span attribute, read as the standard reads it. */
function span(value, largest, zeroAllowed = false) {
  const number = Number.parseInt(String(value), 10);
  if (Number.isNaN(number)) return { value: 1, capped: false };
  if (zeroAllowed && number === 0) return { value: TO_END_OF_GROUP, capped: false };
  if (number > largest) return { value: largest, capped: true };
  return { value: Math.max(1, number), capped: false };
}
