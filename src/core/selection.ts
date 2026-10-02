import { isText, isElement, closestBlock, rootBlockOf } from "./dom";

// Tags that make the element around them a container rather than a block of
// its own.
const LEAF_CONTAINERS = ["P", "H2", "H3", "H4", "LI"];

/** A selection boundary: a node and an offset inside it. */
export interface TextPosition {
  node: Node;
  offset: number;
}

/** What `snapshotSelection` captures: live nodes plus index paths as fallback. */
export interface SelectionSnapshot {
  startPath: number[];
  startOffset: number;
  endPath: number[];
  endOffset: number;
  startNode: Node;
  endNode: Node;
}

export function getSelection(): Selection | null {
  return window.getSelection ? window.getSelection() : null;
}

// Current range, only when it lives inside the editable root.
export function getRange(root: Node): Range | null {
  const sel = getSelection();
  if (!sel || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;
  return range;
}

export function setRange(range: Range): void {
  const sel = getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
}

export function collapseTo(node: Node, offset: number): void {
  const sel = getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  setRange(range);
}

export function selectNodeContents(node: Node, toEnd = true): void {
  const range = document.createRange();
  range.selectNodeContents(node);
  range.collapse(!toEnd);
  setRange(range);
}

// Index path from the root down to the node. Survives replacing the innerHTML.
export function pathTo(root: Node, node: Node): number[] | null {
  const path: number[] = [];
  let current = node;
  while (current && current !== root) {
    const parent = current.parentNode;
    if (!parent) return null;
    path.unshift(Array.prototype.indexOf.call(parent.childNodes, current));
    current = parent;
  }
  return current === root ? path : null;
}

export function nodeAtPath(root: Node, path: number[]): Node {
  let current = root;
  for (const index of path) {
    if (!current.childNodes[index]) return current;
    current = current.childNodes[index];
  }
  return current;
}

/**
 * Snapshot of the selection, for the undo stack and for commands that rewrite
 * the content under it.
 *
 * It carries the boundaries twice. The nodes themselves are what a command that
 * only moves content around leaves intact — nesting a list item changes every
 * index on the way down to it, but the text node the caret sits in is the same
 * object afterwards. The index paths are the fallback, and the only thing that
 * survives replacing the root's innerHTML.
 */
export function snapshotSelection(root: Node): SelectionSnapshot | null {
  const range = getRange(root);
  if (!range) return null;
  const startPath = pathTo(root, range.startContainer);
  const endPath = pathTo(root, range.endContainer);
  if (!startPath || !endPath) return null;
  return {
    startPath,
    startOffset: range.startOffset,
    endPath,
    endOffset: range.endOffset,
    startNode: range.startContainer,
    endNode: range.endContainer,
  };
}

export function restoreSelection(root: Node, snapshot: SelectionSnapshot | null): boolean {
  if (!snapshot) return false;
  const sel = getSelection();
  if (!sel) return false;

  const live =
    snapshot.startNode &&
    root.contains(snapshot.startNode) &&
    root.contains(snapshot.endNode) &&
    snapshot.startNode.isConnected;

  try {
    const start = live ? snapshot.startNode : nodeAtPath(root, snapshot.startPath);
    const end = live ? snapshot.endNode : nodeAtPath(root, snapshot.endPath);
    const clamp = (node: Node, offset: number) =>
      Math.min(offset, isText(node) ? node.data.length : node.childNodes.length);
    sel.setBaseAndExtent(
      start,
      clamp(start, snapshot.startOffset),
      end,
      clamp(end, snapshot.endOffset),
    );
    return true;
  } catch {
    return false;
  }
}

// Top-level blocks touched by the range.
export function rootBlocksInRange(root: HTMLElement, range: Range): HTMLElement[] {
  const blocks: HTMLElement[] = [];
  for (const child of Array.from(root.children) as HTMLElement[]) {
    if (range.intersectsNode(child)) blocks.push(child);
  }
  if (!blocks.length) {
    const block = rootBlockOf(root, range.startContainer);
    if (block) blocks.push(block);
  }
  return blocks;
}

// Editable blocks (p/h2..h4/li/td/th) touched by the range.
export function blocksInRange(root: HTMLElement, range: Range): HTMLElement[] {
  const start = closestBlock(root, range.startContainer);
  const end = closestBlock(root, range.endContainer);
  if (!start) return [];
  if (start === end || !end) return [start];

  // Only direct children count as "holds other blocks": an <li> with a nested
  // list under it still owns the text written straight inside it, so it is a
  // block of its own.
  const all = Array.from(root.querySelectorAll<HTMLElement>("p, h2, h3, h4, li, td, th")).filter(
    (el) => !Array.from(el.children).some((child) => LEAF_CONTAINERS.includes(child.tagName)),
  );
  const from = all.indexOf(start);
  const to = all.indexOf(end);
  if (from === -1 || to === -1) return [start];
  return all.slice(Math.min(from, to), Math.max(from, to) + 1);
}

// Text nodes covered by the range, split at the boundaries.
export function textNodesInRange(range: Range): Text[] {
  if (range.collapsed) return [];

  if (isText(range.startContainer) && range.startOffset > 0) {
    const node = range.startContainer;
    const rest = node.splitText(range.startOffset);
    range.setStart(rest, 0);
    if (range.endContainer === node) {
      range.setEnd(rest, range.endOffset - node.data.length);
    }
  }
  if (isText(range.endContainer) && range.endOffset < range.endContainer.data.length) {
    range.endContainer.splitText(range.endOffset);
    range.setEnd(range.endContainer, (range.endContainer as Text).data.length);
  }

  const nodes: Text[] = [];
  const walker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
    null,
  );
  let node = walker.nextNode() as Text | null;
  while (node) {
    if (range.intersectsNode(node) && node.data.length) {
      const inside =
        range.comparePoint(node, 0) >= 0 && range.comparePoint(node, node.data.length) <= 0;
      if (inside) nodes.push(node);
    }
    node = walker.nextNode() as Text | null;
  }

  if (!nodes.length && isText(range.commonAncestorContainer))
    nodes.push(range.commonAncestorContainer);
  return nodes;
}

// True when the caret sits at the start of the block (ignoring empty nodes).
export function isAtBlockStart(block: Node, range: Range): boolean {
  if (!range.collapsed) return false;
  const probe = document.createRange();
  probe.selectNodeContents(block);
  probe.setEnd(range.startContainer, range.startOffset);
  return probe.toString().length === 0;
}

export function isAtBlockEnd(block: Node, range: Range): boolean {
  if (!range.collapsed) return false;
  const probe = document.createRange();
  probe.selectNodeContents(block);
  probe.setStart(range.startContainer, range.startOffset);
  return probe.toString().length === 0;
}

// Caret rect. A collapsed range can report a zero rect, so measure with a temporary span.
export function caretRect(range: Range): DOMRect {
  const rect = range.getBoundingClientRect();
  if (rect && (rect.width || rect.height || rect.top)) return rect;

  const probe = document.createElement("span");
  probe.appendChild(document.createTextNode("\u200b"));
  const clone = range.cloneRange();
  clone.insertNode(probe);
  const probeRect = probe.getBoundingClientRect();
  const parent = probe.parentNode;
  parent!.removeChild(probe);
  parent!.normalize();
  return probeRect;
}

// First text position inside the element, to drop the caret in.
export function firstTextPosition(el: Node): TextPosition {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
  const node = walker.nextNode();
  if (node) return { node, offset: 0 };
  return { node: el, offset: 0 };
}

export function lastTextPosition(el: Node): TextPosition {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
  let node: Text | null = null;
  let last = walker.nextNode() as Text | null;
  while (last) {
    node = last;
    last = walker.nextNode() as Text | null;
  }
  if (node) return { node, offset: node.data.length };
  return { node: el, offset: el.childNodes.length };
}

export const isSelectionInside = (root: Node): boolean | null => {
  const sel = getSelection();
  return !!sel && sel.anchorNode && root.contains(sel.anchorNode);
};

export { isElement, isText };
