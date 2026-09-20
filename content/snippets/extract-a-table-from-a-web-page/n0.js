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

// The largest span the HTML specification allows: « greater than zero and
// less than or equal to 1000 ». A page can claim more than it draws, and past
// this the claim is capped rather than believed.
export const MAX_SPAN = 1000;

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
    const grid = gridOf(rowsOf(table).map((row) => row.map(cellOf)));
    const caption = ownCaption(table);
    return {
      rows: grid,
      columns: grid.length ? grid[0].length : 0,
      caption: caption ? caption.split(/\s+/).filter(Boolean).join(' ') : null,
      nested: table.querySelector('table') !== null,
    };
  });
  return { tables, reason: null };
}

/** The rows of this table, and not those of a table inside it. */
function rowsOf(table) {
  const rows = [];
  const walk = (node) => {
    for (const child of node.children) {
      if (child.tagName === 'TABLE') continue;
      if (child.tagName === 'TR') {
        rows.push([]);
      } else if (child.tagName === 'TD' || child.tagName === 'TH') {
        // A cell written with no row of its own: a browser puts one round it.
        if (rows.length === 0) rows.push([]);
        rows[rows.length - 1].push(child);
        continue;
      }
      if (child.tagName === 'TR') {
        for (const cell of child.children) {
          if (cell.tagName === 'TD' || cell.tagName === 'TH') rows[rows.length - 1].push(cell);
        }
      } else {
        walk(child);
      }
    }
  };
  walk(table);
  return rows;
}

function cellOf(cell) {
  return {
    text: ownText(cell),
    header: cell.tagName === 'TH',
    colspan: span(cell.getAttribute('colspan')),
    rowspan: span(cell.getAttribute('rowspan')),
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
      for (let down = 0; down < cell.rowspan; down += 1) {
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
  return grid.map((line) => {
    const full = [...line];
    while (full.length < width) full.push(null);
    return full.map((cell) => cell ?? { text: '', header: false, repeated: false });
  });
}

function span(value) {
  const number = Number.parseInt(String(value), 10);
  return Number.isNaN(number) ? 1 : Math.max(1, Math.min(MAX_SPAN, number));
}
