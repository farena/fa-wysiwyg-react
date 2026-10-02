import { isMention, closestBlock } from "./dom";
import { setRange } from "./selection";

/** Where an open mention sits: what was typed after the marker, and where. */
export interface MentionContext {
  query: string;
  textNode: Text;
  markerOffset: number;
  caretOffset: number;
}

/**
 * Detects the mention marker immediately before the caret.
 *
 * It only fires when the marker starts the block or follows a space: `abc#def`
 * does not open the dropdown.
 */
export function detectMention(
  root: Node,
  range: Range | null,
  marker = "#",
): MentionContext | null {
  if (!range || !range.collapsed) return null;

  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return null;
  if (isMention(node.parentNode)) return null;
  if (!closestBlock(root, node)) return null;

  const text = node as Text;
  const before = text.data.slice(0, range.startOffset);
  const markerOffset = before.lastIndexOf(marker);
  if (markerOffset === -1) return null;

  const query = before.slice(markerOffset + marker.length);
  // A space after the marker closes the mention.
  if (/[\s\u00a0]/.test(query)) return null;

  const previous = markerOffset > 0 ? before[markerOffset - 1] : null;
  if (previous && !/[\s\u00a0([{]/.test(previous)) return null;

  return { query, textNode: text, markerOffset, caretOffset: range.startOffset };
}

export function filterFeed(feed: string[], query: string, limit = 100): string[] {
  const needle = query.toLowerCase();
  return feed.filter((item) => item.toLowerCase().includes(needle)).slice(0, limit);
}

/**
 * Replaces the marker text with the mention.
 *
 * The caret ends up after the space that follows the span. `setStartAfter(span)`
 * is not enough: in Chrome the caret falls back inside the span on the next
 * keystroke.
 */
export function insertMention(
  _root: Node, // unused; kept so the signature matches the other helpers
  context: MentionContext,
  value: string,
): { span: HTMLSpanElement; space: Text } | null {
  const { textNode, markerOffset, caretOffset } = context;
  if (!textNode.parentNode) return null;

  const target = document.createRange();
  target.setStart(textNode, markerOffset);
  target.setEnd(textNode, Math.min(caretOffset, textNode.data.length));
  target.deleteContents();

  const span = document.createElement("span");
  span.className = "mention";
  span.setAttribute("data-mention", value);
  span.textContent = value;

  // &nbsp; rather than a plain space: at the end of a block a plain space
  // collapses and the caret cannot stand after it. guardStructure downgrades it
  // to a plain space as soon as the mention is no longer last, which is what the
  // contract stores.
  const space = document.createTextNode("\u00a0");
  target.insertNode(space);
  target.insertNode(span);

  // insertNode splits the text node and leaves empty remnants behind; without
  // cleaning them up, `span.nextSibling` is not the space just inserted.
  for (const node of Array.from(span.parentNode!.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && !(node as Text).data.length)
      span.parentNode!.removeChild(node);
  }

  const after = document.createRange();
  after.setStart(space, 1);
  after.collapse(true);
  setRange(after);

  return { span, space };
}
