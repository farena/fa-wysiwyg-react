import DOMPurify, { type Config } from "dompurify";

// A second, independent line of defense around the editor's own sanitizer.
//
// `sanitize.ts` is what maps arbitrary HTML onto the contract. DOMPurify is
// what guarantees it is safe: it is maintained against real XSS vectors
// (mutation XSS, namespace confusion, DOM clobbering) that a contract filter
// is not designed to track. Both run, so a gap in one is covered by the other.

/**
 * Input pass: run on everything that enters the editor, before the contract
 * sanitizer sees it. It only removes what is dangerous and keeps everything
 * else (<b>, <div>, <font>…), because the contract sanitizer still has to map
 * those onto their equivalents instead of losing them.
 */
const INPUT_CONFIG: Config = {
  USE_PROFILES: { html: true },
  // DOMPurify drops `target` by default; the contract writes it on every link.
  ADD_ATTR: ["target"],
};

/**
 * Output pass: run on what `getData` returns. This one is an allow-list of
 * exactly the contract, so even if a bug let something else through, the HTML
 * that reaches the application cannot carry it.
 */
const OUTPUT_CONFIG: Config = {
  ALLOWED_TAGS: [
    "p",
    "h2",
    "h3",
    "h4",
    "ul",
    "ol",
    "li",
    "strong",
    "i",
    "u",
    "a",
    "span",
    "br",
    "figure",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "td",
    "th",
    "col",
    "colgroup",
    "caption",
    "img",
  ],
  ALLOWED_ATTR: [
    "style",
    "class",
    "href",
    "target",
    "rel",
    "data-mention",
    "colspan",
    "rowspan",
    "src",
    "alt",
    "width",
    "height",
  ],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
};

export const purifyInput = (html: string): string =>
  DOMPurify.sanitize(html, INPUT_CONFIG) as string;

export const purifyOutput = (html: string): string =>
  DOMPurify.sanitize(html, OUTPUT_CONFIG) as string;
