import { closestTag, unwrap } from "../dom";
import { setRange, snapshotSelection, restoreSelection } from "../selection";
import { normalizeInlines } from "../normalize";
import { closestBlock } from "../dom";
import { applyInline, removeInline, linkSpec } from "./inline";
import type { LinkValue } from "./inline";
import { DEFAULT_PROTOCOL, EXTERNAL_LINK_RE } from "../constants";

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A bare URL or email at the end of the text, for autolinking.
const AUTOLINK_RE =
  /(^|[\s\u00a0(])((?:https?:\/\/|www\.)[^\s<>()[\]]+[^\s<>()[\].,;:!?]|[^\s@<>()[\]]+@[^\s@<>()[\]]+\.[a-z]{2,})$/i;

export function normalizeHref(value: string | null | undefined): string {
  const href = (value || "").trim();
  if (!href) return "";
  if (href.startsWith("#") || href.startsWith("/")) return href;
  // The scheme is checked before the email shape: `mailto:a@b.com` also looks
  // like an email, and used to end up with a second `mailto:` glued on.
  if (HAS_SCHEME.test(href)) return href;
  if (LOOKS_LIKE_EMAIL.test(href)) return `mailto:${href}`;
  return `${DEFAULT_PROTOCOL}${href}`;
}

export const isExternal = (href: string | null | undefined): boolean =>
  EXTERNAL_LINK_RE.test(href || "");

// External links get target and rel; internal ones are left bare.
export function linkAttributes(href: string): LinkValue {
  return isExternal(href)
    ? { href, target: "_blank", rel: "noopener noreferrer" }
    : { href, target: null, rel: null };
}

export const findLink = (root: Node, node: Node): HTMLAnchorElement | null =>
  closestTag(root, node, "A") as HTMLAnchorElement | null;

export function applyLink(
  root: HTMLElement,
  range: Range,
  rawHref: string,
): boolean {
  const href = normalizeHref(rawHref);
  if (!href) return false;
  return applyInline(root, range, linkSpec, linkAttributes(href));
}

// Editing an existing link keeps the element: the selection is left untouched.
export function updateLink(
  root: HTMLElement,
  linkEl: Element,
  rawHref: string,
): boolean {
  const href = normalizeHref(rawHref);
  if (!href) return false;
  const attrs = linkAttributes(href);
  const snapshot = snapshotSelection(root);
  linkEl.removeAttribute("target");
  linkEl.removeAttribute("rel");
  linkEl.removeAttribute("href");
  if (attrs.target) linkEl.setAttribute("target", attrs.target);
  if (attrs.rel) linkEl.setAttribute("rel", attrs.rel);
  linkEl.setAttribute("href", attrs.href);
  restoreSelection(root, snapshot);
  return true;
}

export function unlink(
  root: HTMLElement,
  range: Range | null,
  linkEl?: Element | null,
): boolean {
  if (linkEl) {
    const block = closestBlock(root, linkEl) || root;
    const first = linkEl.firstChild;
    const last = linkEl.lastChild;
    unwrap(linkEl);
    normalizeInlines(block);
    if (first && last && first.parentNode) {
      const next = document.createRange();
      next.setStartBefore(first);
      next.setEndAfter(last);
      setRange(next);
    }
    return true;
  }
  return removeInline(root, range as Range, linkSpec);
}

/**
 * Turns the URL that was just finished into a link.
 * Called when a space or an Enter is typed.
 */
export function autoLink(root: HTMLElement, range: Range): boolean {
  if (!range.collapsed) return false;
  const node = range.startContainer as Text;
  if (node.nodeType !== Node.TEXT_NODE) return false;
  if (findLink(root, node)) return false;

  const before = node.data.slice(0, range.startOffset);
  const match = AUTOLINK_RE.exec(before);
  if (!match) return false;

  const text = match[2];
  const start = range.startOffset - text.length;
  const href = normalizeHref(
    text.startsWith("www.") ? `${DEFAULT_PROTOCOL}${text}` : text,
  );

  const target = document.createRange();
  target.setStart(node, start);
  target.setEnd(node, range.startOffset);

  applyInline(root, target, linkSpec, linkAttributes(href));

  // applyInline leaves the selection covering the link: collapsing it to the
  // end puts the caret back where it was before the separator was typed.
  const sel = window.getSelection();
  if (sel && sel.rangeCount) sel.collapseToEnd();
  return true;
}
