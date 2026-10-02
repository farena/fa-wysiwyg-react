import { replaceTag, isElement, closestTag, removeStyleProp } from "../dom";
import {
  rootBlocksInRange,
  blocksInRange,
  snapshotSelection,
  restoreSelection,
} from "../selection";
import { normalizeInlines } from "../normalize";
import { MAX_INDENT } from "../constants";

const LIST_TAGS = ["UL", "OL"];

const isList = (node: Node | null | undefined): node is HTMLElement =>
  isElement(node) && LIST_TAGS.includes(node.tagName);
const isItem = (node: Node | null | undefined): node is HTMLLIElement =>
  isElement(node) && node.tagName === "LI";

// Nesting depth of an item: 0 at the top level of its list.
export function itemDepth(root: Node, li: Element): number {
  let depth = 0;
  let node = li.parentNode;
  while (node && node !== root) {
    if (isItem(node)) depth++;
    node = node.parentNode;
  }
  return depth;
}

// An item nests into the one above it, so the first item of a list has nowhere
// to go: a list whose first child is another list is not valid HTML.
export function canIndentItem(root: Node, li: Element): boolean {
  return isItem(li.previousElementSibling) && itemDepth(root, li) < MAX_INDENT;
}

export const canOutdentItem = (root: Node, li: Element): boolean =>
  itemDepth(root, li) > 0;

// Items whose own ancestor is in the selection too: nesting those would move
// them twice.
const outermost = (items: HTMLElement[]) =>
  items.filter(
    (li) => !items.some((other) => other !== li && other.contains(li)),
  );

/**
 * Indentation inside a list is nesting: the item moves into a list of its own
 * type inside the item above it, which is the structure the contract stores.
 *
 * Items are walked in document order, so a run of selected siblings all land in
 * the same sublist: once the first one has moved, the next one's previous
 * sibling is the item that now holds it.
 */
export function indentItems(root: Node, items: HTMLElement[]): boolean {
  let changed = false;
  for (const li of outermost(items)) {
    if (!canIndentItem(root, li)) continue;
    const list = li.parentNode as HTMLElement;
    const previous = li.previousElementSibling as HTMLElement;

    // A sublist already hanging from the item above is the one to join.
    const last = previous.lastElementChild;
    if (isList(last) && last.tagName === list.tagName) last.appendChild(li);
    else {
      const sublist = document.createElement(list.tagName.toLowerCase());
      previous.appendChild(sublist);
      sublist.appendChild(li);
    }

    // Nesting is what carries the level now; a margin from older content would
    // add a second one on top of it.
    removeStyleProp(li, "margin-left");
    changed = true;
  }
  return changed;
}

/**
 * One level out. Items below the one moving stay below it: they become its own
 * sublist, so nothing jumps a level.
 */
export function outdentItems(_root: Node, items: HTMLElement[]): boolean {
  let changed = false;
  for (const li of outermost(items)) {
    const list = li.parentNode as HTMLElement;
    const parentItem = list && list.parentNode;
    if (!isItem(parentItem)) continue;

    const following: Element[] = [];
    let next = li.nextElementSibling;
    while (next) {
      following.push(next);
      next = next.nextElementSibling;
    }

    parentItem.parentNode!.insertBefore(li, parentItem.nextSibling);

    if (following.length) {
      const sublist = document.createElement(list.tagName.toLowerCase());
      following.forEach((item) => sublist.appendChild(item));
      li.appendChild(sublist);
    }
    if (!list.children.length) list.parentNode!.removeChild(list);
    changed = true;
  }
  return changed;
}

const listItemsOf = (root: HTMLElement, range: Range) =>
  blocksInRange(root, range).filter((el) => el.tagName === "LI");

export function queryList(root: HTMLElement, range: Range): string | null {
  const blocks = blocksInRange(root, range);
  if (!blocks.length) return null;
  const tags = blocks.map((b) => {
    const list = closestTag(root, b, LIST_TAGS) as HTMLElement | null;
    return list ? list.tagName.toLowerCase() : null;
  });
  return tags.every((t) => t === tags[0]) ? tags[0] : "mixed";
}

/**
 * List toggle. Turns the blocks in the range into items of a new list, or back
 * into paragraphs when they already belong to a list of the same type.
 */
export function toggleList(
  root: HTMLElement,
  range: Range,
  tag: string,
): boolean {
  const snapshot = snapshotSelection(root);
  const current = queryList(root, range);

  if (current === tag) {
    unwrapItems(root, listItemsOf(root, range));
  } else if (current && current !== "mixed") {
    // Type change: the container is replaced, the items stay as they are.
    const items = listItemsOf(root, range);
    const lists = new Set(
      items.map((li) => li.parentNode as HTMLElement).filter(Boolean),
    );
    lists.forEach((list) => replaceTag(list, tag));
  } else {
    wrapBlocks(root, range, tag);
  }

  restoreSelection(root, snapshot);
  return true;
}

function wrapBlocks(root: HTMLElement, range: Range, tag: string) {
  const blocks = rootBlocksInRange(root, range).filter(
    (el) => isElement(el) && ["P", "H2", "H3", "H4"].includes(el.tagName),
  );
  if (!blocks.length) return;

  const list = document.createElement(tag);
  root.insertBefore(list, blocks[0]);
  for (const block of blocks) {
    const li = document.createElement("li");
    // Alignment travels from the block to the item.
    const align = block.getAttribute("style");
    if (align) li.setAttribute("style", align);
    while (block.firstChild) li.appendChild(block.firstChild);
    list.appendChild(li);
    block.parentNode!.removeChild(block);
  }
  mergeSiblingLists(root, list);
}

// Turns items back into paragraphs, splitting the list when needed.
/** @returns {HTMLElement[]} the paragraphs created, in order. */
export function unwrapItems(root: Node, items: HTMLElement[]): HTMLElement[] {
  const created: HTMLElement[] = [];
  for (const li of items) {
    const list = li.parentNode as HTMLElement;
    if (!isList(list)) continue;

    // A nested item comes out to the top level first: a paragraph cannot be
    // left sitting inside the item that held the sublist.
    if (isItem(list.parentNode)) {
      outdentItems(root, [li]);
      created.push(...unwrapItems(root, [li]));
      continue;
    }

    const p = document.createElement("p");
    const style = li.getAttribute("style");
    if (style) p.setAttribute("style", style);

    // Whatever was nested under the item outlives it as a list of its own,
    // right after the paragraph.
    const sublists: Node[] = [];
    while (li.firstChild) {
      const child = li.firstChild;
      li.removeChild(child);
      if (isList(child)) sublists.push(child);
      else p.appendChild(child);
    }
    if (!p.firstChild) p.appendChild(document.createElement("br"));

    const after = splitListAfter(list, li);
    const anchor = after || list.nextSibling;
    list.parentNode!.insertBefore(p, anchor);
    for (const sublist of sublists)
      list.parentNode!.insertBefore(sublist, anchor);
    list.removeChild(li);

    if (!list.children.length) list.parentNode!.removeChild(list);
    normalizeInlines(p);
    created.push(p);
  }
  return created;
}

// Splits the list, moving the items after `li` into a new one.
// Returns that list, or null when `li` was the last item.
function splitListAfter(
  list: HTMLElement,
  li: HTMLElement,
): HTMLElement | null {
  const following: Element[] = [];
  let next = li.nextElementSibling;
  while (next) {
    following.push(next);
    next = next.nextElementSibling;
  }
  if (!following.length) return null;

  const tail = document.createElement(list.tagName.toLowerCase());
  following.forEach((item) => tail.appendChild(item));
  list.parentNode!.insertBefore(tail, list.nextSibling);
  return tail;
}

// Two adjacent lists of the same type read as one, so they get merged.
function mergeSiblingLists(root: Node, list: Element): Element {
  const previous = list.previousElementSibling;
  if (previous && previous.tagName === list.tagName) {
    while (list.firstChild) previous.appendChild(list.firstChild);
    list.parentNode!.removeChild(list);
    return mergeSiblingLists(root, previous);
  }
  const next = list.nextElementSibling;
  if (next && next.tagName === list.tagName) {
    while (next.firstChild) list.appendChild(next.firstChild);
    next.parentNode!.removeChild(next);
  }
  return list;
}

export { LIST_TAGS, mergeSiblingLists, isList, isItem };
