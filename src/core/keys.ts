import {
  closestBlock,
  closestTag,
  rootBlockOf,
  isTableFigure,
  isImageFigure,
  isElement,
  isEmptyBlock,
  replaceTag,
  unwrap,
} from "./dom";
import {
  isAtBlockStart,
  isAtBlockEnd,
  setRange,
  collapseTo,
  lastTextPosition,
} from "./selection";
import { normalizeInlines } from "./normalize";
import {
  unwrapItems,
  outdentItems,
  isList,
  canOutdentItem,
} from "./commands/list";
import { FILLER_ATTR, BLOCK_TAGS } from "./constants";

const caretAtStartOf = (el: Node) => {
  const range = document.createRange();
  range.setStart(el, 0);
  range.collapse(true);
  setRange(range);
};

// Empties the selection before operating, so splitting cannot duplicate content.
function collapseSelection(root: HTMLElement, range: Range): Range {
  if (range.collapsed) return range;
  range.deleteContents();
  const block = closestBlock(root, range.startContainer);
  if (block) normalizeInlines(block);
  range.collapse(true);
  setRange(range);
  return range;
}

/**
 * Enter. Splits the block, keeping its tag and alignment — except at the end of
 * a heading, where the new block is a plain paragraph.
 */
export function handleEnter(root: HTMLElement, range: Range): boolean {
  const working = collapseSelection(root, range);
  const block = closestBlock(root, working.startContainer);
  if (!block) return false;

  if (block.tagName === "TD" || block.tagName === "TH")
    return splitInsideCell(block, working);

  const item = itemOf(root, block);
  if (item) return splitListItem(root, item, block, working);

  const atEnd = isAtBlockEnd(block, working);
  const isHeading = ["H2", "H3", "H4"].includes(block.tagName);
  const tag = atEnd && isHeading ? "p" : block.tagName.toLowerCase();
  return splitBlock(root, block, working, tag);
}

function splitBlock(
  _root: Node,
  block: HTMLElement,
  range: Range,
  tag: string,
): boolean {
  const tail = document.createRange();
  tail.setStart(range.startContainer, range.startOffset);
  tail.setEnd(block, block.childNodes.length);
  const fragment = tail.extractContents();

  const created = document.createElement(tag);
  // The new block inherits the style of the one it came out of: alignment and
  // indentation carry over to the next paragraph, which is what Enter means.
  const style = block.getAttribute("style");
  if (style) created.setAttribute("style", style);
  created.appendChild(fragment);

  block.parentNode!.insertBefore(created, block.nextSibling);

  if (!block.firstChild) block.appendChild(document.createElement("br"));
  if (!created.firstChild) created.appendChild(document.createElement("br"));

  normalizeInlines(block);
  normalizeInlines(created);
  caretAtStartOf(created);
  return true;
}

/**
 * Nearest <li> a block belongs to. A cell stops the search: inside a table the
 * cell is the container, even when the table itself sits in a list item.
 */
function itemOf(root: Node, block: HTMLElement): HTMLElement | null {
  const container = closestTag(root, block, ["LI", "TD", "TH"]);
  return container && container.tagName === "LI" ? container : null;
}

/**
 * Enter inside a list. It always produces a new <li>, never a second paragraph
 * inside the current one: an item that holds blocks is still a single item, so
 * the split has to happen on the item, not on the block the caret is in.
 * Shift+Enter is what puts a line break inside the item.
 */
function splitListItem(
  root: HTMLElement,
  item: HTMLElement,
  block: HTMLElement,
  range: Range,
): boolean {
  const lastInItem = block === item || lastBlockOf(item) === block;

  if (isEmptyBlock(block) && lastInItem) {
    // Enter on an empty item walks back out: one nesting level per press, and
    // from the top level, out of the list. The caret has to follow it, or the
    // next thing typed goes back where it came from.
    if (isEmptyBlock(item)) return leaveItem(root, item);

    // The empty block at the end belongs to the new item, not to this one.
    item.removeChild(block);
    flattenLoneParagraph(item);
    fillBlocks(item);
    return appendEmptyItem(item);
  }

  // A sublist belongs to the item that owns it and does not travel: Enter in
  // the item's own content splits that content, not the list hanging from it.
  const sublists = Array.from(item.children).filter(isList);
  for (const sublist of sublists) item.removeChild(sublist);

  const done = splitOwnContent(root, item, block, range);
  for (const sublist of sublists) item.appendChild(sublist);
  return done;
}

function leaveItem(root: HTMLElement, item: HTMLElement): boolean {
  if (canOutdentItem(root, item)) {
    outdentItems(root, [item]);
    caretAtStartOf(firstBlockOf(item));
    return true;
  }
  const [paragraph] = unwrapItems(root, [item]);
  if (paragraph) caretAtStartOf(paragraph);
  return true;
}

function splitOwnContent(
  _root: Node,
  item: HTMLElement,
  block: HTMLElement,
  range: Range,
): boolean {
  // Only an inner block can be cut in half; when the caret is in the <li>
  // itself there is nothing above it to leave behind.
  const inner = block !== item;
  const atStart = inner && isAtBlockStart(block, range);
  const atEnd = inner && isAtBlockEnd(block, range);

  const tail = document.createRange();
  tail.setStart(range.startContainer, range.startOffset);
  tail.setEnd(item, item.childNodes.length);
  const fragment = tail.extractContents();

  const created = document.createElement("li");
  // The new item inherits the style of the one it came out of: alignment and
  // indentation carry over, which is what Enter means.
  const style = item.getAttribute("style");
  if (style) created.setAttribute("style", style);
  created.appendChild(fragment);
  item.parentNode!.insertBefore(created, item.nextSibling);

  // Splitting at a block's edge leaves an empty half on the other side.
  if (atEnd) dropEmptyHalf(created, created.firstElementChild, true);
  if (atStart) dropEmptyHalf(item, item.lastElementChild, false);

  flattenLoneParagraph(item);
  flattenLoneParagraph(created);
  fillBlocks(item);
  fillBlocks(created);
  normalizeInlines(item);
  normalizeInlines(created);
  caretAtStartOf(firstBlockOf(created));
  return true;
}

function appendEmptyItem(item: HTMLElement): boolean {
  const created = document.createElement("li");
  const style = item.getAttribute("style");
  if (style) created.setAttribute("style", style);
  created.appendChild(document.createElement("br"));
  item.parentNode!.insertBefore(created, item.nextSibling);
  caretAtStartOf(created);
  return true;
}

// The empty half a split left behind. It is dropped unless it is all the item
// has: an item cannot be block-less on one side and blocks on the other. When
// it is kept and Enter ended a heading, it becomes a paragraph — same rule as
// outside a list.
function dropEmptyHalf(
  item: HTMLElement,
  half: Element | null,
  headingBecomesParagraph: boolean,
) {
  if (
    !isElement(half) ||
    !BLOCK_TAGS.includes(half.tagName) ||
    !isEmptyBlock(half)
  )
    return;
  if (item.children.length > 1) {
    item.removeChild(half);
    return;
  }
  if (headingBecomesParagraph && half.tagName !== "P") replaceTag(half, "p");
}

// A lone bare paragraph is not a block container: its content is the item's own.
// This is the same rule `normalizeBlockContainers` applies on a full pass.
function flattenLoneParagraph(item: HTMLElement) {
  if (item.childNodes.length !== 1) return;
  const only = item.firstElementChild;
  if (only && only.tagName === "P" && !only.attributes.length) unwrap(only);
}

function fillBlocks(item: HTMLElement) {
  for (const block of Array.from(item.children)) {
    if (BLOCK_TAGS.includes(block.tagName) && !block.firstChild) {
      block.appendChild(document.createElement("br"));
    }
  }
  if (!item.firstChild) item.appendChild(document.createElement("br"));
}

// Where the caret goes inside an item: its first block, or the item itself when
// it holds plain inline content.
function firstBlockOf(item: HTMLElement): Element {
  const first = item.firstElementChild;
  return first && BLOCK_TAGS.includes(first.tagName) ? first : item;
}

// Last block of the item's own content. A sublist is not part of it.
function lastBlockOf(item: Element): Element | null {
  const blocks = Array.from(item.children).filter((el) =>
    BLOCK_TAGS.includes(el.tagName),
  );
  return blocks[blocks.length - 1] || null;
}

// Inside a cell, Enter creates paragraphs: the cell is the container, not the block.
function splitInsideCell(cell: HTMLElement, range: Range): boolean {
  const inner = Array.from(cell.children).find(
    (child) => child.tagName === "P" && child.contains(range.startContainer),
  ) as HTMLElement | undefined;

  if (!inner) {
    // Bare content: it gets wrapped in a paragraph first so it can be split.
    // Moving the nodes out of the cell relocates the live range to the start of
    // the cell (that is what the DOM removal steps do), so the boundary point
    // has to be noted and restored afterwards; without that, Enter always splits
    // at offset 0.
    const container = range.startContainer;
    const offset = range.startOffset;
    const wrapper = document.createElement("p");
    while (cell.firstChild) wrapper.appendChild(cell.firstChild);
    cell.appendChild(wrapper);

    const restored = document.createRange();
    if (container === cell)
      restored.setStart(wrapper, Math.min(offset, wrapper.childNodes.length));
    else restored.setStart(container, offset);
    restored.collapse(true);
    return splitBlock(cell, wrapper, restored, "p");
  }
  return splitBlock(cell, inner, range, "p");
}

/**
 * Shift+Enter and Ctrl+Enter. At the end of a block a second filler <br> is
 * needed so the new line has height. It carries an attribute to mark it: an
 * unmarked trailing <br> is real content and is preserved.
 */
export function handleSoftBreak(root: HTMLElement, range: Range): boolean {
  const working = collapseSelection(root, range);
  const block = closestBlock(root, working.startContainer);
  if (!block) return false;

  const br = document.createElement("br");
  working.insertNode(br);

  if (isAtBlockEnd(block, positionAfter(br))) {
    const filler = document.createElement("br");
    filler.setAttribute(FILLER_ATTR, "");
    br.parentNode!.insertBefore(filler, br.nextSibling);
  }

  const next = document.createRange();
  next.setStartAfter(br);
  next.collapse(true);
  setRange(next);
  return true;
}

function positionAfter(node: Node): Range {
  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  return range;
}

/**
 * Backspace at the start of a block: merges it into the previous block.
 */
export function handleBackspaceAtStart(
  root: HTMLElement,
  range: Range,
): boolean {
  if (!range.collapsed) return false;
  const block = closestBlock(root, range.startContainer);
  if (!block || !isAtBlockStart(block, range)) return false;

  if (block.tagName === "TD" || block.tagName === "TH") return true; // never destroy the cell

  const item = itemOf(root, block);
  if (item) {
    // Between two blocks of the same item the break is an ordinary one: it gets
    // removed before the item itself is ever touched.
    const previousBlock = block !== item ? block.previousElementSibling : null;
    if (
      isElement(previousBlock) &&
      BLOCK_TAGS.includes(previousBlock.tagName)
    ) {
      return mergeInto(previousBlock, block);
    }
    // The first item leaves the list; the rest merge into the previous one,
    // which then holds two blocks. The paragraph break is not deleted, it is
    // kept inside the same <li>.
    const previousItem = item.previousElementSibling;
    if (!previousItem) return leaveItem(root, item);
    return mergeListItems(lineAbove(previousItem), item);
  }

  const rootBlock = rootBlockOf(root, block) || block;
  const previous = rootBlock.previousElementSibling;
  if (!previous) return true;

  if (isTableFigure(previous) || isImageFigure(previous)) {
    // A table is not deleted one character at a time: it gets selected.
    const selection = document.createRange();
    selection.selectNode(previous);
    setRange(selection);
    return true;
  }

  return mergeInto(previous, rootBlock);
}

/**
 * Delete at the end of a block: merges the next block into the current one.
 */
export function handleDeleteAtEnd(root: HTMLElement, range: Range): boolean {
  if (!range.collapsed) return false;
  const block = closestBlock(root, range.startContainer);
  if (!block || !isAtBlockEnd(block, range)) return false;
  if (block.tagName === "TD" || block.tagName === "TH") return true;

  const item = itemOf(root, block);
  if (item) {
    const nextBlock = block !== item ? block.nextElementSibling : null;
    if (isElement(nextBlock) && BLOCK_TAGS.includes(nextBlock.tagName)) {
      return mergeInto(block, nextBlock);
    }
    // A sublist comes before the next item: what reads as the following line is
    // its first entry, not the item after this one.
    const sublist = Array.from(item.children).find(isList);
    const nextItem =
      (sublist && sublist.firstElementChild) || item.nextElementSibling;
    // Only the last item falls through: what follows the list is a root block,
    // and merging it is the job of the code below.
    if (nextItem) return mergeListItems(item, nextItem);
  }

  const rootBlock = rootBlockOf(root, block) || block;
  const next = rootBlock.nextElementSibling;
  if (!next) return true;

  if (isTableFigure(next) || isImageFigure(next)) {
    const selection = document.createRange();
    selection.selectNode(next);
    setRange(selection);
    return true;
  }

  return mergeInto(rootBlock, next);
}

/**
 * Moves the block's content to the end of `host`. A lone <br> is left behind:
 * it is only there to give an empty block its height, and carrying it over
 * would add a line where the merge was meant to remove one.
 */
function drainInto(host: Node, donor: Node) {
  const onlyBreak =
    donor.childNodes.length === 1 &&
    isElement(donor.firstChild) &&
    donor.firstChild.tagName === "BR";
  if (onlyBreak) donor.removeChild(donor.firstChild);
  while (donor.firstChild) host.appendChild(donor.firstChild);
}

// Moves `source`'s content to the end of `target` and leaves the caret at the seam.
function mergeInto(target: Element, source: Element): boolean {
  const host =
    target.tagName === "UL" || target.tagName === "OL"
      ? target.lastElementChild
      : target;
  const donor =
    source.tagName === "UL" || source.tagName === "OL"
      ? source.firstElementChild
      : source;
  if (!host || !donor) return false;

  const filler = host.lastChild;
  if (
    isElement(filler) &&
    filler.tagName === "BR" &&
    host.childNodes.length === 1
  ) {
    host.removeChild(filler);
  }

  const { node, offset } = lastTextPosition(host);
  drainInto(host, donor);

  donor.parentNode!.removeChild(donor);
  if (source.parentNode && !source.childNodes.length)
    source.parentNode.removeChild(source);

  normalizeInlines(host);
  if (!host.firstChild) host.appendChild(document.createElement("br"));
  collapseTo(node, offset);
  return true;
}

/**
 * Joins two list items. The break between them is what Backspace deletes, so
 * the item's content continues the line the previous one ended on — an empty
 * item simply disappears. Only a second block inside the item stays a block,
 * and a sublist is not content at all: it hangs at the end, under everything
 * that was merged in.
 */
function mergeListItems(previous: Element, item: Element): boolean {
  const sublists = Array.from(item.children).filter(isList);
  for (const sublist of sublists) item.removeChild(sublist);

  const blocks = Array.from(item.children).filter((el) =>
    BLOCK_TAGS.includes(el.tagName),
  );
  const donor = blocks[0] || item;
  // A block landing next to loose inline content would leave the item half
  // wrapped, so the previous item gets a block of its own first.
  const host =
    lastBlockOf(previous) ||
    (blocks.length > 1 ? wrapOwnContent(previous) : previous);

  const filler = host.lastChild;
  if (
    isElement(filler) &&
    filler.tagName === "BR" &&
    host.childNodes.length === 1
  ) {
    host.removeChild(filler);
  }

  const { node, offset } = lastTextPosition(host);
  drainInto(host, donor);
  for (const block of blocks.slice(1)) previous.appendChild(block);
  for (const sublist of sublists) previous.appendChild(sublist);

  const list = item.parentNode!;
  list.removeChild(item);
  // The item may have been the only entry of a sublist: an empty one renders as
  // a stray bullet.
  if (isList(list) && !list.children.length) list.parentNode!.removeChild(list);

  normalizeInlines(host);
  if (!host.firstChild) host.appendChild(document.createElement("br"));
  collapseTo(node, offset);
  return true;
}

// Wraps the item's own content in a paragraph, leaving its sublists where they
// are. Returns that paragraph.
function wrapOwnContent(item: Element): HTMLElement {
  const paragraph = document.createElement("p");
  for (const child of Array.from(item.childNodes)) {
    if (isList(child)) continue;
    paragraph.appendChild(child);
  }
  item.insertBefore(paragraph, item.firstChild);
  return paragraph;
}

/**
 * The item that reads as the line above this one: not the previous sibling when
 * that one carries a sublist, but the deepest last entry hanging from it.
 */
function lineAbove(li: Element): Element {
  let current = li;
  for (;;) {
    const sublist = Array.from(current.children).filter(isList).pop();
    const last = sublist && sublist.lastElementChild;
    if (!last) return current;
    current = last;
  }
}
