import {
  closestBlock,
  unwrap,
  isElement,
  isFontSizeSpan,
  isMention,
} from "../dom";
import { textNodesInRange, setRange } from "../selection";
import { normalizeInlines } from "../normalize";
import { getStyle, setStyle } from "../css";
import { FONT_SIZES } from "../constants";
import { formatFontFamily } from "../sanitize";

/**
 * The single engine behind every inline format. A `spec` describes how the
 * format looks in the DOM:
 *
 *   matches(el)          -> the element carries this format
 *   create(value)        -> builds the wrapper
 *   sameValue(el, value) -> the element already holds exactly that value
 *   read(el)             -> the value the element carries
 */
export interface InlineSpec<V = unknown, R = unknown> {
  // Method syntax on purpose: it keeps `value` bivariant, so a spec for a
  // specific value type can be passed where any spec is accepted.
  matches(el: HTMLElement): boolean;
  create(value: V): HTMLElement;
  read(el: HTMLElement): R;
}

// What `linkSpec.create` takes: the attributes the link is written with.
export interface LinkValue {
  href: string;
  target: string | null;
  rel: string | null;
}

// Pulls `node` out of `ancestor`, splitting it into as many pieces as needed.
// Fully contained nodes are moved, not cloned, so their identities survive.
function isolateFrom(node: Node, ancestor: HTMLElement) {
  const parent = ancestor.parentNode;
  if (!parent) return;

  const afterRange = document.createRange();
  afterRange.setStartAfter(node);
  afterRange.setEndAfter(ancestor);
  const after = afterRange.extractContents();

  const beforeRange = document.createRange();
  beforeRange.setStartBefore(ancestor);
  beforeRange.setEndBefore(node);
  const before = beforeRange.extractContents();

  parent.insertBefore(before, ancestor);
  parent.insertBefore(after, ancestor.nextSibling);
  unwrap(ancestor);
}

function matchingAncestor<V, R>(
  root: Node,
  node: Node,
  spec: InlineSpec<V, R>,
): HTMLElement | null {
  let current = node.parentNode;
  while (current && current !== root) {
    if (isElement(current) && spec.matches(current)) return current;
    current = current.parentNode;
  }
  return null;
}

function stripSpec<V, R>(root: Node, text: Node, spec: InlineSpec<V, R>) {
  let ancestor = matchingAncestor(root, text, spec);
  let guard = 0;
  while (ancestor && guard++ < 20) {
    isolateFrom(text, ancestor);
    ancestor = matchingAncestor(root, text, spec);
  }
}

function selectTexts(texts: Text[]) {
  if (!texts.length) return;
  const range = document.createRange();
  range.setStart(texts[0], 0);
  const last = texts[texts.length - 1];
  range.setEnd(last, last.data.length);
  setRange(range);
}

function finish(root: HTMLElement, texts: Text[]) {
  const blocks = new Set<HTMLElement>();
  for (const text of texts) {
    if (!text.parentNode) continue;
    blocks.add(closestBlock(root, text) || root);
  }
  blocks.forEach((block) => normalizeInlines(block));
}

export function applyInline<V, R>(
  root: HTMLElement,
  range: Range,
  spec: InlineSpec<V, R>,
  value?: V,
): boolean {
  const texts = textNodesInRange(range);
  if (!texts.length) return false;

  texts.forEach((text) => stripSpec(root, text, spec));

  for (const text of texts) {
    if (!text.parentNode) continue;
    // A mention is an atom: format around it, never inside it.
    if (isMention(text.parentNode)) continue;
    const wrapper = spec.create(value as V);
    text.parentNode.insertBefore(wrapper, text);
    wrapper.appendChild(text);
  }

  finish(root, texts);
  selectTexts(texts);
  return true;
}

export function removeInline<V, R>(
  root: HTMLElement,
  range: Range,
  spec: InlineSpec<V, R>,
): boolean {
  const texts = textNodesInRange(range);
  if (!texts.length) return false;

  texts.forEach((text) => stripSpec(root, text, spec));
  finish(root, texts);
  selectTexts(texts);
  return true;
}

/**
 * @returns {*} the value when uniform, `null` when absent, `'mixed'` when it varies.
 */
export function queryInline<V, R>(
  root: Node,
  range: Range,
  spec: InlineSpec<V, R>,
): R | "mixed" | null {
  if (range.collapsed) {
    const container = range.startContainer;
    const node =
      container.nodeType === Node.TEXT_NODE
        ? container
        : container.childNodes[range.startOffset] ||
          container.lastChild ||
          container;
    const ancestor = matchingAncestor(root, node, spec);
    return ancestor ? spec.read(ancestor) : null;
  }

  const probe = range.cloneRange();
  const container = probe.commonAncestorContainer;
  const texts: Text[] = [];

  // A selection inside a single text node has that node as its
  // commonAncestorContainer, and a TreeWalker rooted at text yields nothing.
  if (container.nodeType === Node.TEXT_NODE) {
    texts.push(container as Text);
  } else {
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null,
    );
    let node = walker.nextNode() as Text | null;
    while (node) {
      if (node.data.trim() && probe.intersectsNode(node)) texts.push(node);
      node = walker.nextNode() as Text | null;
    }
  }
  if (!texts.length) return null;

  let result: R | null | undefined;
  for (const text of texts) {
    const ancestor = matchingAncestor(root, text, spec);
    const value = ancestor ? spec.read(ancestor) : null;
    if (result === undefined) result = value;
    else if (result !== value) return "mixed";
  }
  return result === undefined ? null : result;
}

const tagSpec = (tag: string): InlineSpec<unknown, boolean> => ({
  matches: (el) => el.tagName === tag.toUpperCase(),
  create: () => document.createElement(tag),
  read: () => true,
});

export const boldSpec = tagSpec("strong");
export const italicSpec = tagSpec("i");
export const underlineSpec = tagSpec("u");

export const fontFamilySpec: InlineSpec<string, string | null> = {
  matches: (el) => el.tagName === "SPAN" && !!getStyle(el, "font-family"),
  create: (value) => {
    const span = document.createElement("span");
    setStyle(span, "font-family", formatFontFamily(value));
    return span;
  },
  read: (el) => getStyle(el, "font-family"),
};

export const fontColorSpec: InlineSpec<string, string | null> = {
  matches: (el) => el.tagName === "SPAN" && !!getStyle(el, "color"),
  create: (value) => {
    const span = document.createElement("span");
    setStyle(span, "color", value);
    return span;
  },
  read: (el) => getStyle(el, "color"),
};

export const fontSizeSpec: InlineSpec<string | null, string | null> = {
  matches: (el) => isFontSizeSpan(el),
  create: (value) => {
    const span = document.createElement("span");
    const size = FONT_SIZES.find((s) => s.model === value);
    span.className = size!.className as string;
    return span;
  },
  read: (el) => {
    const size = FONT_SIZES.find(
      (s) => s.className && el.classList.contains(s.className),
    );
    return size ? size.model : null;
  },
};

export const linkSpec: InlineSpec<LinkValue, string | null> = {
  matches: (el) => el.tagName === "A",
  create: (value) => {
    const a = document.createElement("a");
    // Attribute order survives serialization, so it is part of the contract.
    if (value.target) a.setAttribute("target", value.target);
    if (value.rel) a.setAttribute("rel", value.rel);
    a.setAttribute("href", value.href);
    return a;
  },
  read: (el) => el.getAttribute("href"),
};
