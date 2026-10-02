import {
  isElement,
  isText,
  isTableFigure,
  isImageFigure,
  isMention,
  unwrap,
  replaceTag,
} from "./dom";
import { parseStyle, serializeStyle, getStyle } from "./css";
import type { StyleDecl } from "./css";
import { BLOCK_TAGS, BLOCK_STYLE_ORDER, INDENTABLE_TAGS } from "./constants";
import { readIndent, indentValue } from "./indent";

// Tags allowed as direct children of the editable root.
const ROOT_ALLOWED = ["P", "H2", "H3", "H4", "UL", "OL"];

// Inline tags allowed inside a block.
const INLINE_ALLOWED = ["STRONG", "I", "U", "A", "SPAN", "BR"];

const isAllowedRootChild = (node: Node): boolean =>
  isElement(node) &&
  (ROOT_ALLOWED.includes(node.tagName) || isTableFigure(node) || isImageFigure(node));

// Cheap guard: runs on every `input`. It keeps the top-level invariants without
// touching the inside of blocks, so the caret never moves.
export function guardStructure<T extends Element>(root: T): T {
  let pending: HTMLElement | null = null;

  for (const node of Array.from(root.childNodes)) {
    if (isAllowedRootChild(node)) {
      pending = null;
      continue;
    }

    if (isText(node)) {
      // Stray whitespace between blocks is noise. Real text has to be wrapped.
      if (!node.data.trim()) {
        root.removeChild(node);
        continue;
      }
      if (!pending) {
        pending = document.createElement("p");
        root.insertBefore(pending, node);
      }
      pending.appendChild(node);
      continue;
    }

    if (isElement(node)) {
      // Loose inline content at the root joins the same paragraph as the text
      // beside it. `a<br>b` has to give <p>a<br>b</p>: one block, not two.
      if (INLINE_ALLOWED.includes(node.tagName)) {
        if (!pending) {
          pending = document.createElement("p");
          root.insertBefore(pending, node);
        }
        pending.appendChild(node);
        continue;
      }

      pending = null;
      // Browsers drop stray <div>s in when editing at the boundaries.
      if (node.tagName === "DIV" || node.tagName === "FIGURE") {
        replaceTag(node, "p");
        continue;
      }
      unwrap(node);
    }
  }

  // A mention edited by hand stops being a mention.
  for (const span of Array.from(root.querySelectorAll("span.mention"))) {
    if (span.textContent !== span.getAttribute("data-mention")) unwrap(span);
  }

  ensureNotEmpty(root);
  fillEmptyBlocks(root);
  return root;
}

export function ensureNotEmpty(root: Node): void {
  if (!root.firstChild) {
    const p = document.createElement("p");
    p.appendChild(document.createElement("br"));
    root.appendChild(p);
  }
}

// An empty block needs a <br> to have height and be clickable.
export function fillEmptyBlocks(root: ParentNode): void {
  for (const block of Array.from(root.querySelectorAll("p, h2, h3, h4, li, td, th"))) {
    if (!block.firstChild) block.appendChild(document.createElement("br"));
  }
}

// Full normalization: only on setData, paste, undo/redo and the getData clone.
export function normalizeRoot<T extends Element>(root: T): T {
  // Tables and lists are fixed before the guard runs: the guard unwraps
  // anything it does not recognize as a valid root child, and a <table> without
  // its <figure class="table"> falls exactly in that bucket.
  distributeInlinesOverBlocks(root);
  normalizeTables(root);
  normalizeLists(root);
  guardStructure(root);
  normalizeBlockContainers(root);

  for (const block of Array.from(root.children)) {
    if (isTableFigure(block) || isImageFigure(block)) continue;
    normalizeInlines(block);
  }

  normalizeBlockStyles(root);
  fillEmptyBlocks(root);
  ensureNotEmpty(root);
  return root;
}

function normalizeLists(root: Element): void {
  for (const list of Array.from(root.querySelectorAll("ul, ol"))) {
    for (const child of Array.from(list.childNodes)) {
      if (isElement(child) && child.tagName === "LI") continue;
      if (isText(child) && !child.data.trim()) {
        list.removeChild(child);
        continue;
      }
      const li = document.createElement("li");
      list.insertBefore(li, child);
      li.appendChild(child);
    }
    if (!list.children.length) list.parentNode!.removeChild(list);
  }
  // An <li> outside a list is not valid.
  for (const li of Array.from(root.querySelectorAll("li"))) {
    const parent = li.parentNode as Element | null;
    if (parent && parent !== root && (parent.tagName === "UL" || parent.tagName === "OL")) continue;
    replaceTag(li, "p");
  }
}

function normalizeTables(root: Element): void {
  for (const figure of Array.from(root.querySelectorAll("figure.table"))) {
    const table = figure.querySelector("table");
    if (!table) {
      figure.parentNode!.removeChild(figure);
      continue;
    }
    // Loose rows always end up wrapped in a <tbody>.
    const loose = Array.from(table.children).filter((c) => c.tagName === "TR");
    if (loose.length) {
      const tbody = document.createElement("tbody");
      table.insertBefore(tbody, loose[0]);
      loose.forEach((tr) => tbody.appendChild(tr));
    }
    for (const row of Array.from(table.querySelectorAll("tr"))) {
      if (!row.children.length) row.parentNode!.removeChild(row);
    }
    if (!table.querySelector("tr")) figure.parentNode!.removeChild(figure);
  }
  // A table without its <figure class="table"> breaks the content styles.
  for (const table of Array.from(root.querySelectorAll("table"))) {
    if (isTableFigure(table.parentNode)) continue;
    const figure = document.createElement("figure");
    figure.className = "table";
    table.parentNode!.insertBefore(figure, table);
    figure.appendChild(table);
  }
}

const attributesOf = (el: Element): string =>
  Array.from(el.attributes)
    .map((a) => `${a.name}=${a.value}`)
    .sort()
    .join("|");

const canMerge = (a: Node | null, b: Node | null): boolean =>
  isElement(a) &&
  isElement(b) &&
  INLINE_ALLOWED.includes(a.tagName) &&
  a.tagName === b.tagName &&
  a.tagName !== "BR" &&
  !isMention(a) &&
  !isMention(b) &&
  attributesOf(a) === attributesOf(b);

// Merges identical inline wrappers and drops the empty ones.
// Without this, applying bold three times produces <strong><strong><strong>.
export function normalizeInlines<T extends Node>(el: T): T {
  if (!isElement(el)) return el;

  for (const child of Array.from(el.children)) {
    if (isTableFigure(child) || isImageFigure(child)) continue;
    normalizeInlines(child);
  }

  // Unnest a wrapper identical to its parent: <strong><strong>x</strong></strong>.
  for (const child of Array.from(el.children)) {
    if (canMerge(el, child) && el.childNodes.length === 1) {
      unwrap(child);
      break;
    }
  }

  let node = el.firstChild;
  while (node) {
    const next = node.nextSibling;
    if (next && canMerge(node, next)) {
      while (next.firstChild) node.appendChild(next.firstChild);
      el.removeChild(next);
      normalizeInlines(node);
      continue;
    }
    if (
      isElement(node) &&
      INLINE_ALLOWED.includes(node.tagName) &&
      node.tagName !== "BR" &&
      !node.childNodes.length
    ) {
      el.removeChild(node);
      node = next;
      continue;
    }
    node = next;
  }

  canonicalizeInlines(el);

  el.normalize();
  return el;
}

/**
 * Canonical nesting order for inline formats: they always serialize in the same
 * order regardless of the order they were applied in. Without this, the same
 * text with the same formatting would be stored two different ways depending on
 * how the user built it.
 */
const NESTING_ORDER: Record<string, number> = { A: 1, SPAN: 2, U: 3, I: 4, STRONG: 5 };

// Property order inside the font span's style attribute.
const STYLE_ORDER = ["color", "font-family"];

// Properties whose value is compacted on serialization. font-family is not one
// of them: there the spaces after the commas are kept.
const COMPACTED = ["color", "background-color"];

// Values can arrive as `hsl( 210, 65%, 20% )`, with spaces against the
// parentheses too; reading them back compacts the whole thing.
const compactValue = (prop: string, value: string): string =>
  COMPACTED.includes(prop)
    ? value.replace(/,\s+/g, ",").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")")
    : value;

const isFontSpan = (el: Node | null): el is HTMLElement =>
  isElement(el) && el.tagName === "SPAN" && !isMention(el);

const rankOf = (el: Node | null): number | undefined =>
  isElement(el) && !isMention(el) ? NESTING_ORDER[(el as Element).tagName] : undefined;

function canonicalizeInlines(el: Element): void {
  mergeFontSpans(el);
  reorderNesting(el);
  Array.from(el.querySelectorAll("span")).forEach((span) => {
    if (isFontSpan(span)) orderSpanAttributes(span);
  });
}

// Every font attribute lives in a single <span>, never in nested ones.
function mergeFontSpans(root: Element): void {
  let merged = true;
  let guard = 0;
  while (merged && guard++ < 10) {
    merged = false;
    for (const span of Array.from(root.querySelectorAll("span"))) {
      if (!span.parentNode || !isFontSpan(span)) continue;
      const parent = span.parentNode;
      if (!isFontSpan(parent) || parent.childNodes.length !== 1) continue;

      for (const cls of Array.from(span.classList)) parent.classList.add(cls);
      const decls = parseStyle(parent);
      for (const decl of parseStyle(span)) {
        if (!decls.some((d) => d.prop === decl.prop)) decls.push(decl);
      }
      if (decls.length) parent.setAttribute("style", serializeStyle(decls));
      unwrap(span);
      merged = true;
    }
  }
}

function reorderNesting(root: Element): void {
  let swapped = true;
  let guard = 0;
  while (swapped && guard++ < 20) {
    swapped = false;
    for (const child of Array.from(root.querySelectorAll("a, span, u, i, strong"))) {
      const parent = child.parentNode;
      if (!parent || !isElement(parent) || parent === root) continue;
      const parentRank = rankOf(parent);
      const childRank = rankOf(child);
      if (parentRank === undefined || childRank === undefined) continue;
      if (parentRank <= childRank) continue;
      liftChild(parent, child);
      swapped = true;
      break;
    }
  }
}

// Lifts `child` above `parent`, splitting `parent` when needed:
// <strong>a<i>b</i>c</strong> -> <strong>a</strong><i><strong>b</strong></i><strong>c</strong>
function liftChild(parent: Element, child: Element): void {
  const host = parent.parentNode;
  if (!host) return;

  const head = document.createRange();
  head.setStart(parent, 0);
  head.setEndBefore(child);
  const before = head.extractContents();

  const tail = document.createRange();
  tail.setStartAfter(child);
  tail.setEnd(parent, parent.childNodes.length);
  const after = tail.extractContents();

  if (before.childNodes.length) {
    const clone = parent.cloneNode(false);
    clone.appendChild(before);
    host.insertBefore(clone, parent);
  }
  if (after.childNodes.length) {
    const clone = parent.cloneNode(false);
    clone.appendChild(after);
    host.insertBefore(clone, parent.nextSibling);
  }

  host.insertBefore(child, parent);
  while (child.firstChild) parent.appendChild(child.firstChild);
  child.appendChild(parent);
}

// Attribute order defines how the element serializes: class first, and inside
// the style, color before font-family.
function orderSpanAttributes(span: Element): void {
  const classes = Array.from(span.classList);
  const decls = parseStyle(span);
  if (!classes.length && !decls.length) return;

  decls.sort((a, b) => {
    const rank = (d: StyleDecl) => {
      const at = STYLE_ORDER.indexOf(d.prop);
      return at === -1 ? STYLE_ORDER.length : at;
    };
    return rank(a) - rank(b);
  });

  const compacted = decls.map((d) => ({ prop: d.prop, value: compactValue(d.prop, d.value) }));

  for (const attr of Array.from(span.attributes)) span.removeAttribute(attr.name);
  if (classes.length) span.setAttribute("class", classes.join(" "));
  if (compacted.length) span.setAttribute("style", serializeStyle(compacted));
}

/**
 * Canonical form of a block's style attribute: the declarations the contract
 * allows, in the contract's order, with the indentation quantized to a level.
 * The commands write one property at a time, so without this the same block
 * serializes differently depending on whether it was aligned or indented first.
 */
export function normalizeBlockStyles<T extends ParentNode>(root: T): T {
  for (const block of Array.from(root.querySelectorAll("p, h2, h3, h4, li"))) {
    if (!block.getAttribute("style")) continue;

    const decls: StyleDecl[] = [];
    const align = getStyle(block, "text-align");
    const indent = INDENTABLE_TAGS.includes(block.tagName) ? indentValue(readIndent(block)) : null;
    if (align) decls.push({ prop: "text-align", value: align.trim().toLowerCase() });
    if (indent) decls.push({ prop: "margin-left", value: indent });
    decls.sort((a, b) => BLOCK_STYLE_ORDER.indexOf(a.prop) - BLOCK_STYLE_ORDER.indexOf(b.prop));

    const style = serializeStyle(decls);
    if (style) block.setAttribute("style", style);
    else block.removeAttribute("style");
  }
  return root;
}

const LEAF_BLOCKS = "p, h2, h3, h4, li, td, th";
const COLLAPSIBLE = /[ \t\n\r\f]+/g;

const isBreak = (node: Node | null | undefined): boolean =>
  isElement(node) && node.tagName === "BR";

/**
 * Whitespace normalization.
 *
 * HTML collapses runs of spaces when rendering, so they are collapsed on
 * serialization too, and the spaces that would sit against a line break — and
 * therefore be lost — become &nbsp;. Without this, plain text with <br>s comes
 * back different from what it went in as.
 */
export function normalizeWhitespace(root: ParentNode): void {
  for (const block of Array.from(root.querySelectorAll(LEAF_BLOCKS))) {
    if (block.querySelector(LEAF_BLOCKS)) continue; // leaf blocks only
    collapseInBlock(block);
  }
}

function collapseInBlock(block: Element): void {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  const markers: Node[] = [];
  let node = walker.nextNode();
  while (node) {
    if (isText(node) || isBreak(node)) markers.push(node);
    node = walker.nextNode();
  }

  markers.forEach((marker, index) => {
    if (!isText(marker)) return;

    let data = marker.data.replace(COLLAPSIBLE, " ");
    const previous = markers[index - 1];
    const next = markers[index + 1];

    // A space at the start of a block, or right after a break, is invisible.
    if (data.startsWith(" ") && (!previous || isBreak(previous))) data = data.slice(1);
    // One right before a break does show, but only as &nbsp;.
    if (data.endsWith(" ") && next && isBreak(next)) data = `${data.slice(0, -1)}\u00a0`;
    // One at the end of a block is invisible, so it is dropped.
    if (data.endsWith(" ") && !next) data = data.slice(0, -1);

    if (data === marker.data) return;
    if (!data.length) marker.parentNode!.removeChild(marker);
    else marker.data = data;
  });
}

/**
 * Blocks inside <li>, <td> and <th>.
 *
 * They are kept when the container ends up with more than one — which is what
 * joining two list items with Backspace produces — and a lone block is unwrapped,
 * the normal case. Loose text sitting beside a block gets its own <p>. Without
 * this, opening and saving a document with multi-paragraph items merges them into
 * one and the break is lost.
 */
const INLINE_WRAPPERS = "strong, i, u, a, span";

/**
 * Blocks inside an inline wrapper.
 *
 * Google Docs pastes `<b style="font-weight:normal"><p>...</p></b>`. Leaving it
 * produces invalid HTML, and unwrapping the inline loses the formatting. The
 * inline is distributed into each block instead.
 */
export function distributeInlinesOverBlocks<T extends ParentNode>(root: T): T {
  const isBlockish = (node: Node): node is HTMLElement =>
    isElement(node) && (BLOCK_TAGS.includes(node.tagName) || isList(node) || isTableFigure(node));

  let changed = true;
  let guard = 0;
  while (changed && guard++ < 10) {
    changed = false;
    for (const el of Array.from(root.querySelectorAll(INLINE_WRAPPERS))) {
      const parent = el.parentNode;
      if (!parent || !Array.from(el.childNodes).some(isBlockish)) continue;

      let pending: Node | null = null;
      for (const child of Array.from(el.childNodes)) {
        if (isBlockish(child)) {
          pending = null;
          if (BLOCK_TAGS.includes(child.tagName)) {
            const clone = el.cloneNode(false);
            while (child.firstChild) clone.appendChild(child.firstChild);
            child.appendChild(clone);
          }
          parent.insertBefore(child, el);
          continue;
        }
        if (!pending) {
          pending = el.cloneNode(false);
          parent.insertBefore(pending, el);
        }
        pending.appendChild(child);
      }
      parent.removeChild(el);
      changed = true;
    }
  }
  return root;
}

export function normalizeBlockContainers<T extends ParentNode>(root: T): T {
  for (const parent of Array.from(root.querySelectorAll("li, td, th"))) {
    const blocks = Array.from(parent.children).filter((c) => BLOCK_TAGS.includes(c.tagName));
    if (!blocks.length) continue;

    // Indentation whitespace does not count as loose content.
    for (const node of Array.from(parent.childNodes)) {
      if (isText(node) && !node.data.trim()) parent.removeChild(node);
    }

    // Only a bare <p> is unwrapped. A heading, or a paragraph with alignment,
    // is kept: those live inside the <li> and losing them would erase
    // formatting from the document.
    const lone = blocks.length === 1 && parent.childNodes.length === 1 ? blocks[0] : null;
    if (lone && lone.tagName === "P" && !lone.attributes.length) {
      unwrap(lone);
      continue;
    }
    wrapLooseRuns(parent);
  }

  // A block that ended up containing other blocks (typical when pasting nested
  // <div>s) is dissolved: the inner block is the one that counts. Dissolving the
  // inner one instead would merge paragraphs that were separate.
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 10) {
    changed = false;
    for (const el of Array.from(root.querySelectorAll("p, h2, h3, h4"))) {
      if (!el.parentNode) continue;
      if (!Array.from(el.children).some((child) => BLOCK_TAGS.includes(child.tagName))) continue;
      unwrap(el);
      changed = true;
    }
  }
  return root;
}

// Wraps runs of inline content that ended up loose next to a sibling block.
function wrapLooseRuns(parent: Element): void {
  let pending: HTMLElement | null = null;
  for (const node of Array.from(parent.childNodes)) {
    if (
      isElement(node) &&
      (BLOCK_TAGS.includes(node.tagName) || isList(node) || isTableFigure(node))
    ) {
      pending = null;
      continue;
    }
    if (!pending) {
      pending = document.createElement("p");
      parent.insertBefore(pending, node);
    }
    pending.appendChild(node);
  }
}

const isList = (node: Node | null | undefined): boolean =>
  isElement(node) && (node.tagName === "UL" || node.tagName === "OL");
