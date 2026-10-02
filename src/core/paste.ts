import { sanitizeHtml } from "./sanitize";
import { closestBlock, rootBlockOf, isElement } from "./dom";
import { setRange } from "./selection";
import { normalizeInlines, normalizeRoot, normalizeWhitespace, guardStructure } from "./normalize";

const ROOT_LEVEL = "P, H2, H3, H4, UL, OL, FIGURE";

function fromPlainText(text: string): string {
  return text
    .split(/\r?\n\r?\n+/)
    .map((paragraph) => {
      const escaped = paragraph
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\r?\n/g, "<br>");
      return `<p>${escaped || "<br>"}</p>`;
    })
    .join("");
}

/**
 * @param {HTMLElement} root
 * @param {Range} range
 * @param {DataTransfer} clipboard
 * @returns {boolean} true when something was inserted
 */
export function handlePaste(root: HTMLElement, range: Range, clipboard: DataTransfer): boolean {
  const html = clipboard.getData("text/html");
  const plain = clipboard.getData("text/plain");
  const source = html ? sanitizeHtml(html, { source: "paste" }) : fromPlainText(plain || "");
  if (!source.trim()) return false;

  const holder = document.createElement("div");
  holder.innerHTML = source;
  // Word and Google Docs wrappers leave empty blocks at the edges. They have to
  // go before normalizing, because afterwards they are indistinguishable from an
  // empty paragraph the user meant to keep.
  trimEmptyEdges(holder);
  // Full normalization, not just the guard: pasted content can bring stray
  // tables, lists or nested blocks that the guard leaves alone.
  normalizeRoot(holder);
  normalizeWhitespace(holder);

  if (!range.collapsed) {
    range.deleteContents();
    range.collapse(true);
  }

  const blocks = Array.from(holder.children) as HTMLElement[];
  if (!blocks.length) return false;

  const block = closestBlock(root, range.startContainer);
  const rootBlock = rootBlockOf(root, range.startContainer);

  // A single text block is pasted inline, without splitting the target block.
  if (blocks.length === 1 && ["P", "H2", "H3", "H4"].includes(blocks[0].tagName)) {
    const fragment = document.createDocumentFragment();
    while (blocks[0].firstChild) fragment.appendChild(blocks[0].firstChild);
    const last = fragment.lastChild;
    range.insertNode(fragment);
    if (block) normalizeInlines(block);
    if (last && last.parentNode) {
      const after = document.createRange();
      after.setStartAfter(last);
      after.collapse(true);
      setRange(after);
    }
    return true;
  }

  if (!rootBlock) {
    blocks.forEach((child) => root.appendChild(child));
    return true;
  }

  return insertBlocks(root, range, rootBlock, blocks);
}

function insertBlocks(
  root: HTMLElement,
  range: Range,
  rootBlock: HTMLElement,
  blocks: HTMLElement[],
): boolean {
  // The target block is split and the pasted blocks go in between.
  const tail = document.createRange();
  tail.setStart(range.startContainer, range.startOffset);
  tail.setEnd(rootBlock, rootBlock.childNodes.length);
  const remainder = tail.extractContents();

  const first = blocks[0];

  // The first pasted block merges into whatever was before the caret. When it
  // is a list, what merges is its first item and the rest stays a list.
  if (first.tagName === "UL" || first.tagName === "OL") {
    const item = first.firstElementChild;
    if (item) {
      while (item.firstChild) rootBlock.appendChild(item.firstChild);
      first.removeChild(item);
    }
    if (!first.children.length) blocks.shift();
  } else if (first.tagName === "FIGURE") {
    // A table never merges into the paragraph: it lands as its own block.
  } else {
    while (first.firstChild) rootBlock.appendChild(first.firstChild);
    blocks.shift();
  }
  normalizeInlines(rootBlock);

  let anchor = rootBlock;
  for (const child of blocks) {
    anchor.parentNode!.insertBefore(child, anchor.nextSibling);
    anchor = child;
  }

  const caretHost = anchor === rootBlock ? rootBlock : anchor;
  const caretNode = caretHost.lastChild;

  // extractContents leaves an empty text node when the cut falls inside one:
  // counting nodes would report a false remainder and add a spare paragraph.
  const hasRemainder = Array.from(remainder.childNodes).some(
    (node) => isElement(node) || (node as Text).data.length,
  );

  if (hasRemainder) {
    if (caretHost.matches && caretHost.matches(ROOT_LEVEL) && caretHost.tagName !== "FIGURE") {
      caretHost.appendChild(remainder);
      normalizeInlines(caretHost);
    } else {
      const trailing = document.createElement("p");
      // What was after the caret keeps the block's style: alignment and
      // indentation belong to the text, not to the paste.
      const style = rootBlock.getAttribute("style");
      if (style) trailing.setAttribute("style", style);
      trailing.appendChild(remainder);
      anchor.parentNode!.insertBefore(trailing, anchor.nextSibling);
    }
  }

  if (caretNode && caretNode.parentNode) {
    const after = document.createRange();
    if (isElement(caretNode) && caretNode.tagName === "BR") after.setStartBefore(caretNode);
    else after.setStartAfter(caretNode);
    after.collapse(true);
    setRange(after);
  }

  guardStructure(root);
  return true;
}

export { fromPlainText };

const isMeaningful = (node: Node): boolean =>
  isElement(node) && (!!node.textContent.trim() || !!node.querySelector("img, table"));

function trimEmptyEdges(holder: HTMLElement): void {
  while (holder.firstChild && !isMeaningful(holder.firstChild)) {
    holder.removeChild(holder.firstChild);
  }
  while (holder.lastChild && !isMeaningful(holder.lastChild)) {
    holder.removeChild(holder.lastChild);
  }
}
