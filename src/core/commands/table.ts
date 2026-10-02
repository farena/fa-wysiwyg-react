import { closestTag, isTableFigure } from "../dom";
import { rootBlockOf } from "../dom";
import { collapseTo, firstTextPosition } from "../selection";

type Cell = HTMLTableCellElement;

// One position of the logical table matrix.
export interface MatrixEntry {
  cell: Cell;
  row: number;
  col: number;
  rowspan: number;
  colspan: number;
  isAnchor: boolean;
}

export interface TableMatrix {
  matrix: MatrixEntry[][];
  rows: HTMLTableRowElement[];
  width: number;
  height: number;
}

interface Located extends TableMatrix {
  row: number;
  col: number;
  entry: MatrixEntry;
}

export type RowPosition = "above" | "below";
export type ColumnPosition = "left" | "right";
export type CellDirection = "left" | "right" | "up" | "down";
export type SplitDirection = "vertically" | "horizontally";

const num = (cell: Element, attr: string) =>
  parseInt(cell.getAttribute(attr) || "1", 10) || 1;

export const cellOf = (root: Node, node: Node): Cell | null =>
  closestTag(root, node, ["TD", "TH"]) as Cell | null;
export const tableOf = (root: Node, node: Node): HTMLTableElement | null =>
  closestTag(root, node, "TABLE") as HTMLTableElement | null;
export const figureOf = (root: Node, node: Node): HTMLElement | null => {
  const table = tableOf(root, node);
  return table && isTableFigure(table.parentNode)
    ? (table.parentNode as HTMLElement)
    : null;
};

function newCell(tag = "td"): Cell {
  const cell = document.createElement(tag) as Cell;
  cell.appendChild(document.createElement("br"));
  return cell;
}

export function createTable(rows: number, cols: number): HTMLElement {
  const figure = document.createElement("figure");
  figure.className = "table";
  const table = document.createElement("table");
  const tbody = document.createElement("tbody");
  for (let r = 0; r < rows; r++) {
    const tr = document.createElement("tr");
    for (let c = 0; c < cols; c++) tr.appendChild(newCell());
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  figure.appendChild(table);
  return figure;
}

export function insertTable(
  root: HTMLElement,
  range: Range,
  rows: number,
  cols: number,
): HTMLElement {
  const figure = createTable(rows, cols);
  const block = rootBlockOf(root, range.startContainer);

  if (block) {
    const empty =
      !block.textContent.trim() && !block.querySelector("img, table");
    root.insertBefore(figure, block.nextSibling);
    if (empty && block.tagName === "P") root.removeChild(block);
  } else {
    root.appendChild(figure);
  }

  const first = figure.querySelector("td, th");
  if (first) {
    const { node, offset } = firstTextPosition(first);
    collapseTo(node, offset);
  }
  return figure;
}

/**
 * Logical table matrix, with colspan and rowspan resolved.
 * `matrix[r][c]` always points at the cell occupying that position, even when
 * the cell does not start there (`isAnchor` marks the origin of a span).
 */
export function buildMatrix(table: HTMLTableElement): TableMatrix {
  const rows = Array.from(table.rows);
  const matrix: MatrixEntry[][] = [];

  rows.forEach((row, r) => {
    if (!matrix[r]) matrix[r] = [];
    let c = 0;
    for (const cell of Array.from(row.cells)) {
      while (matrix[r][c]) c++;
      const colspan = num(cell, "colspan");
      const rowspan = num(cell, "rowspan");
      for (let dr = 0; dr < rowspan; dr++) {
        const target = r + dr;
        if (!matrix[target]) matrix[target] = [];
        for (let dc = 0; dc < colspan; dc++) {
          matrix[target][c + dc] = {
            cell,
            row: r,
            col: c,
            rowspan,
            colspan,
            isAnchor: dr === 0 && dc === 0,
          };
        }
      }
      c += colspan;
    }
  });

  const width = matrix.reduce((max, row) => Math.max(max, row.length), 0);
  return { matrix, rows, width, height: matrix.length };
}

function locate(table: HTMLTableElement, cell: Element): Located | null {
  const { matrix, width, height, rows } = buildMatrix(table);
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const entry = matrix[r] && matrix[r][c];
      if (entry && entry.isAnchor && entry.cell === cell) {
        return { matrix, width, height, rows, row: r, col: c, entry };
      }
    }
  }
  return null;
}

export function insertRow(
  table: HTMLTableElement,
  cell: Element,
  where: RowPosition,
) {
  const found = locate(table, cell);
  if (!found) return;
  const { matrix, width, row, entry } = found;
  const at = where === "above" ? row : row + entry.rowspan;

  const tr = document.createElement("tr");
  for (let c = 0; c < width; c++) {
    const above = at > 0 && matrix[at - 1] ? matrix[at - 1][c] : null;
    const below = matrix[at] ? matrix[at][c] : null;
    // A rowspan crossing the new row stretches instead of being duplicated.
    if (above && below && above.cell === below.cell) {
      above.cell.setAttribute(
        "rowspan",
        String(num(above.cell, "rowspan") + 1),
      );
      continue;
    }
    const reference = below || above;
    tr.appendChild(
      newCell(
        reference && reference.cell.tagName === "TH" && where === "above"
          ? "th"
          : "td",
      ),
    );
  }

  const rows = Array.from(table.rows);
  const anchorRow = rows[at];
  if (anchorRow) anchorRow.parentNode!.insertBefore(tr, anchorRow);
  else (table.tBodies[0] || table).appendChild(tr);
}

export function insertColumn(
  table: HTMLTableElement,
  cell: Element,
  where: ColumnPosition,
) {
  const found = locate(table, cell);
  if (!found) return;
  const { matrix, height, width, col, entry } = found;
  const at = where === "left" ? col : col + entry.colspan;
  const widened = new Set<Cell>();

  for (let r = 0; r < height; r++) {
    const row = matrix[r] || [];
    const left = at > 0 ? row[at - 1] : null;
    const right = at < width ? row[at] : null;

    // A cell crossing the insertion point widens instead of being duplicated.
    if (left && right && left.cell === right.cell) {
      if (!widened.has(left.cell)) {
        widened.add(left.cell);
        setSpan(left.cell, "colspan", num(left.cell, "colspan") + 1);
      }
      continue;
    }

    const domRow = table.rows[r];
    if (!domRow) continue;

    // First cell of this DOM row that starts at column `at` or later.
    const anchor = Array.from(domRow.cells).find((c) => {
      const entryOf = row.find((e) => e && e.cell === c);
      return entryOf && entryOf.col >= at;
    });

    const reference = right || left;
    const asHeader =
      reference && reference.cell.tagName === "TH" && where === "left";
    domRow.insertBefore(newCell(asHeader ? "th" : "td"), anchor || null);
  }
}

export function deleteRow(table: HTMLTableElement, cell: Element): boolean {
  const found = locate(table, cell);
  if (!found) return false;
  const { matrix, width, row } = found;
  if (table.rows.length <= 1) return false;

  const seen = new Set<Cell>();
  for (let c = 0; c < width; c++) {
    const entry = matrix[row] && matrix[row][c];
    if (!entry || seen.has(entry.cell)) continue;
    seen.add(entry.cell);
    const rowspan = num(entry.cell, "rowspan");
    if (rowspan > 1) {
      // The cell survives: it moves down a row and loses one unit of height.
      if (entry.row === row) {
        const nextRow = table.rows[row + 1];
        if (nextRow)
          nextRow.insertBefore(
            entry.cell,
            nextRow.cells[Math.min(c, nextRow.cells.length)] || null,
          );
      }
      setSpan(entry.cell, "rowspan", rowspan - 1);
    } else if (entry.row === row) {
      entry.cell.parentNode!.removeChild(entry.cell);
    }
  }

  const tr = table.rows[row];
  if (tr && !tr.cells.length) tr.parentNode!.removeChild(tr);
  return true;
}

export function deleteColumn(table: HTMLTableElement, cell: Element): boolean {
  const found = locate(table, cell);
  if (!found) return false;
  const { matrix, height, width, col } = found;
  if (width <= 1) return false;

  const seen = new Set<Cell>();
  for (let r = 0; r < height; r++) {
    const entry = matrix[r] && matrix[r][col];
    if (!entry || seen.has(entry.cell)) continue;
    seen.add(entry.cell);
    const colspan = num(entry.cell, "colspan");
    if (colspan > 1) setSpan(entry.cell, "colspan", colspan - 1);
    else entry.cell.parentNode!.removeChild(entry.cell);
  }

  for (const tr of Array.from(table.rows)) {
    if (!tr.cells.length) tr.parentNode!.removeChild(tr);
  }
  return true;
}

function setSpan(cell: Element, attr: string, value: number) {
  if (value > 1) cell.setAttribute(attr, String(value));
  else cell.removeAttribute(attr);
}

// Neighbour in the requested direction, or null when the table edge blocks it.
export function neighbour(
  table: HTMLTableElement,
  cell: Element,
  direction: CellDirection,
): Cell | null {
  const found = locate(table, cell);
  if (!found) return null;
  const { matrix, width, height, row, col, entry } = found;

  if (direction === "right") {
    const c = col + entry.colspan;
    if (c >= width) return null;
    const target = matrix[row] && matrix[row][c];
    return target &&
      target.isAnchor &&
      num(target.cell, "rowspan") === entry.rowspan
      ? target.cell
      : null;
  }
  if (direction === "left") {
    const c = col - 1;
    if (c < 0) return null;
    const target = matrix[row] && matrix[row][c];
    return target &&
      target.row === row &&
      num(target.cell, "rowspan") === entry.rowspan
      ? target.cell
      : null;
  }
  if (direction === "down") {
    const r = row + entry.rowspan;
    if (r >= height) return null;
    const target = matrix[r] && matrix[r][col];
    return target &&
      target.isAnchor &&
      num(target.cell, "colspan") === entry.colspan
      ? target.cell
      : null;
  }
  const r = row - 1;
  if (r < 0) return null;
  const target = matrix[r] && matrix[r][col];
  return target &&
    target.col === col &&
    num(target.cell, "colspan") === entry.colspan
    ? target.cell
    : null;
}

export function mergeCells(
  table: HTMLTableElement,
  cell: Cell,
  direction: CellDirection,
): Cell | null {
  const other = neighbour(table, cell, direction);
  if (!other) return null;

  const keep = direction === "left" || direction === "up" ? other : cell;
  const drop = keep === cell ? other : cell;

  if (direction === "left" || direction === "right") {
    setSpan(keep, "colspan", num(keep, "colspan") + num(drop, "colspan"));
  } else {
    setSpan(keep, "rowspan", num(keep, "rowspan") + num(drop, "rowspan"));
  }

  // The absorbed cell's content is kept as a separate paragraph.
  if (drop.textContent.trim()) {
    if (isBlankCell(keep)) keep.innerHTML = "";
    const paragraph = document.createElement("p");
    while (drop.firstChild) paragraph.appendChild(drop.firstChild);
    keep.appendChild(paragraph);
  }
  drop.parentNode!.removeChild(drop);
  return keep;
}

const isBlankCell = (cell: Element) =>
  !cell.textContent.trim() && !cell.querySelector("img");

/**
 * Splits a cell.
 *
 * The operation is named after the orientation of the cut: "vertically" splits
 * the cell into left and right, "horizontally" into top and bottom. The new cell
 * exists only in that row or column; the rest of the table compensates by
 * stretching spans, rather than gaining a whole row or column.
 */
export function splitCell(
  table: HTMLTableElement,
  cell: Element,
  direction: SplitDirection,
) {
  const found = locate(table, cell);
  if (!found) return;
  if (direction === "vertically") splitIntoColumns(table, cell, found);
  else splitIntoRows(table, cell, found);
}

function splitIntoColumns(
  _table: HTMLTableElement,
  cell: Element,
  found: Located,
) {
  const { matrix, height, row, col } = found;
  const colspan = num(cell, "colspan");
  const rowspan = num(cell, "rowspan");

  const created = newCell(cell.tagName.toLowerCase());
  setSpan(created, "rowspan", rowspan);

  if (colspan > 1) {
    // The cell already spans several columns: just share them out.
    const left = Math.ceil(colspan / 2);
    setSpan(cell, "colspan", left);
    setSpan(created, "colspan", colspan - left);
    cell.parentNode!.insertBefore(created, cell.nextSibling);
    return;
  }

  cell.parentNode!.insertBefore(created, cell.nextSibling);

  // Rows the split cell does not touch gain a column: whichever cell covers
  // that position stretches, so the table stays rectangular.
  const stretched = new Set<Cell>();
  for (let r = 0; r < height; r++) {
    if (r >= row && r < row + rowspan) continue;
    const entry = matrix[r] && matrix[r][col];
    if (!entry || stretched.has(entry.cell)) continue;
    stretched.add(entry.cell);
    setSpan(entry.cell, "colspan", num(entry.cell, "colspan") + 1);
  }
}

function splitIntoRows(table: HTMLTableElement, cell: Element, found: Located) {
  const { matrix, width, row, col } = found;
  const rowspan = num(cell, "rowspan");
  const colspan = num(cell, "colspan");

  if (rowspan > 1) {
    const top = Math.ceil(rowspan / 2);
    setSpan(cell, "rowspan", top);
    const targetRow = table.rows[row + top];
    if (targetRow) {
      const created = newCell(cell.tagName.toLowerCase());
      setSpan(created, "rowspan", rowspan - top);
      setSpan(created, "colspan", colspan);
      targetRow.insertBefore(
        created,
        targetRow.cells[Math.min(col, targetRow.cells.length)] || null,
      );
    }
    return;
  }

  const created = newCell(cell.tagName.toLowerCase());
  setSpan(created, "colspan", colspan);
  const newRow = document.createElement("tr");
  newRow.appendChild(created);
  const container = cell.parentNode!.parentNode!;
  container.insertBefore(newRow, cell.parentNode!.nextSibling);

  // Every other cell in the original row gains a row.
  const stretched = new Set<Cell>();
  for (let c = 0; c < width; c++) {
    if (c >= col && c < col + colspan) continue;
    const entry = matrix[row] && matrix[row][c];
    if (!entry || entry.cell === cell || stretched.has(entry.cell)) continue;
    stretched.add(entry.cell);
    setSpan(entry.cell, "rowspan", num(entry.cell, "rowspan") + 1);
  }
}

export function toggleHeaderRow(table: HTMLTableElement, cell: Element) {
  const found = locate(table, cell);
  if (!found) return;
  const first = table.rows[0];
  if (!first) return;
  const makeHeader = first.cells[0] && first.cells[0].tagName === "TD";
  for (const c of Array.from(first.cells))
    swapCellTag(c, makeHeader ? "th" : "td");
  moveHeaderRow(table, makeHeader);
}

// The header row lives in <thead>, and that is where it is looked for when the
// document is reopened: leaving it in <tbody> loses the header on the next save.
function moveHeaderRow(table: HTMLTableElement, intoHead: boolean) {
  const row = table.rows[0];
  if (!row) return;

  if (intoHead) {
    let head = table.tHead;
    if (!head) {
      head = document.createElement("thead");
      table.insertBefore(head, table.firstChild);
    }
    head.appendChild(row);
    return;
  }

  let body = table.tBodies[0];
  if (!body) {
    body = document.createElement("tbody");
    table.appendChild(body);
  }
  body.insertBefore(row, body.firstChild);
  if (table.tHead && !table.tHead.rows.length) table.removeChild(table.tHead);
}

export function toggleHeaderColumn(table: HTMLTableElement, cell: Element) {
  const found = locate(table, cell);
  if (!found) return;
  const firstCells = Array.from(table.rows)
    .map((row) => row.cells[0])
    .filter(Boolean);
  if (!firstCells.length) return;
  const makeHeader = firstCells[0].tagName === "TD";
  firstCells.forEach((c) => swapCellTag(c, makeHeader ? "th" : "td"));
}

function swapCellTag(cell: Element, tag: string): Element {
  if (cell.tagName === tag.toUpperCase()) return cell;
  const next = document.createElement(tag);
  for (const attr of Array.from(cell.attributes))
    next.setAttribute(attr.name, attr.value);
  while (cell.firstChild) next.appendChild(cell.firstChild);
  cell.parentNode!.replaceChild(next, cell);
  return next;
}

export function removeTable(_root: Node, table: HTMLTableElement) {
  const figure = isTableFigure(table.parentNode)
    ? (table.parentNode as HTMLElement)
    : table;
  const next = figure.nextElementSibling || figure.previousElementSibling;
  figure.parentNode!.removeChild(figure);
  if (next) {
    const { node, offset } = firstTextPosition(next);
    collapseTo(node, offset);
  }
}
