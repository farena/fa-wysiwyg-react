import { sanitizeHtml } from "./sanitize";
import { purifyOutput } from "./purify";
import { normalizeRoot, ensureNotEmpty, fillEmptyBlocks, normalizeWhitespace } from "./normalize";
import { isElement, isText, isTableFigure, isImageFigure } from "./dom";
import { FILLER_ATTR } from "./constants";

const EDITING_CLASS_RE = /^fa-wysiwyg(-|__)/;
const ZERO_WIDTH_RE = /\u200b/g;

const BLOCKS = "p, h2, h3, h4, li, td, th";

const isBlank = (el: Element): boolean =>
  !el.textContent.replace(/[\s\u00a0\u200b]/g, "").length && !el.querySelector("img, table");

// An empty document serializes to an empty string, not to <p></p>.
const isEmptyDocument = (root: Element): boolean =>
  root.children.length === 1 &&
  root.firstElementChild!.tagName === "P" &&
  isBlank(root.firstElementChild!);

function stripEditingArtifacts(root: Element): void {
  for (const el of Array.from(root.querySelectorAll("*"))) {
    for (const cls of Array.from(el.classList)) {
      if (EDITING_CLASS_RE.test(cls)) el.classList.remove(cls);
    }
    if (!el.getAttribute("class")) el.removeAttribute("class");
    el.removeAttribute("contenteditable");
    el.removeAttribute("data-placeholder");
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const texts: Text[] = [];
  let node = walker.nextNode() as Text | null;
  while (node) {
    texts.push(node);
    node = walker.nextNode() as Text | null;
  }
  for (const text of texts) {
    if (!ZERO_WIDTH_RE.test(text.data)) continue;
    text.data = text.data.replace(ZERO_WIDTH_RE, "");
    if (!text.data.length) text.parentNode!.removeChild(text);
  }
}

// Block closing, following the contract for line breaks exactly.
//
// An empty block is exported as <p>&nbsp;</p> and a block ending in a break as
// <p>text<br>&nbsp;</p>. While editing we add an extra <br> as filler so the
// line keeps its height, and that one has to be dropped here.
//
// A list item is the exception: it comes out as <li></li>. Its marker already
// gives the line away, so the &nbsp; would only be a character nobody typed
// sitting in the stored document.
function closeBlocks(root: Element): void {
  for (const block of Array.from(root.querySelectorAll(BLOCKS))) {
    if (block.querySelector("img, table")) continue;

    // 1. Filler <br>s are noise: they only gave the line its height. An
    //    unmarked trailing <br> is real content and is kept.
    for (const filler of Array.from(block.querySelectorAll(`br[${FILLER_ATTR}]`))) {
      filler.parentNode!.removeChild(filler);
    }
    let last = block.lastChild;
    while (last && isText(last) && !last.data.length) {
      const previous = last.previousSibling;
      block.removeChild(last);
      last = previous;
    }

    // 2. Block with no content: a single filler <br>, or nothing at all.
    const onlyBreak =
      block.childNodes.length === 1 &&
      isElement(block.firstChild) &&
      block.firstChild.tagName === "BR";
    if (onlyBreak || (isBlank(block) && !block.querySelector("br"))) {
      block.innerHTML = block.tagName === "LI" ? "" : "&nbsp;";
      continue;
    }

    // 3. A trailing break needs the &nbsp; so the empty line also exists
    //    outside the editor.
    if (last && isElement(last) && last.tagName === "BR") {
      block.appendChild(document.createTextNode("\u00a0"));
    }
  }
}

/**
 * Output HTML. Must follow the contract exactly.
 * @param {HTMLElement} root
 * @returns {string}
 */
export function getData(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement;
  clone.removeAttribute("contenteditable");

  stripEditingArtifacts(clone);
  normalizeRoot(clone);
  normalizeWhitespace(clone);

  if (isEmptyDocument(clone)) return "";

  closeBlocks(clone);

  // What leaves the editor is purified against the contract's allow-list, so
  // the application can store and render it as it comes.
  return purifyOutput(clone.innerHTML);
}

/**
 * Loads HTML into the editable root. Must accept anything the contract allows.
 * @param {HTMLElement} root
 * @param {string} html
 */
export function setData(root: HTMLElement, html: string | null | undefined): HTMLElement {
  root.innerHTML = sanitizeHtml(html || "", { source: "data" });

  // A block holding only &nbsp; is an empty block: normalizing it keeps the
  // user from having to delete an invisible character.
  for (const block of Array.from(root.querySelectorAll(BLOCKS))) {
    if (block.textContent === "\u00a0" && !block.children.length) block.textContent = "";
  }

  normalizeRoot(root);
  normalizeWhitespace(root);
  fillEmptyBlocks(root);
  ensureNotEmpty(root);
  return root;
}

export { isTableFigure, isImageFigure };
