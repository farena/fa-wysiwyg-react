import { FONT_FAMILIES, FONT_SIZES, EXTERNAL_LINK_RE, INDENTABLE_TAGS } from "./constants";
import { isElement, isText, unwrap, replaceTag } from "./dom";
import { keepStyles, parseStyle, setStyle, getStyle, serializeStyle } from "./css";
import type { StyleDecl } from "./css";
import { readIndent, writeIndent } from "./indent";
import { normalizeBlockContainers, distributeInlinesOverBlocks } from "./normalize";
import { purifyInput } from "./purify";

export type SanitizeSource = "paste" | "data";

// Elements dropped together with everything inside them.
const DROP_WITH_CONTENT = [
  "SCRIPT",
  "STYLE",
  "HEAD",
  "META",
  "LINK",
  "TITLE",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "FORM",
  "INPUT",
  "BUTTON",
  "SELECT",
  "TEXTAREA",
  "NOSCRIPT",
];

// Tags mapped onto their equivalent in the contract.
const TAG_MAP: Record<string, string> = {
  B: "STRONG",
  EM: "I",
  H1: "P",
  H5: "P",
  H6: "P",
  DIV: "P",
  SECTION: "P",
  ARTICLE: "P",
  BLOCKQUOTE: "P",
  PRE: "P",
  ADDRESS: "P",
};

// Tags that vanish leaving their content behind: not part of the contract.
const UNWRAP = [
  "S",
  "STRIKE",
  "DEL",
  "INS",
  "SUB",
  "SUP",
  "CODE",
  "KBD",
  "SMALL",
  "MARK",
  "ABBR",
  "CITE",
  "Q",
  "LABEL",
  "HEADER",
  "FOOTER",
  "MAIN",
  "ASIDE",
  "NAV",
  "DL",
  "DT",
  "DD",
  "CENTER",
];

const STRUCTURAL = [
  "UL",
  "OL",
  "LI",
  "FIGURE",
  "TABLE",
  "THEAD",
  "TBODY",
  "TFOOT",
  "TR",
  "TD",
  "TH",
  "COL",
  "COLGROUP",
  "CAPTION",
  "IMG",
  "BR",
  "P",
  "H2",
  "H3",
  "H4",
  "STRONG",
  "I",
  "U",
  "A",
  "SPAN",
];

const BLOCK_LIKE = ["P", "H2", "H3", "H4", "LI", "TD", "TH"];

const ALIGN_VALUES = ["left", "right", "center", "justify"];

const SAFE_PROTOCOL = /^(https?:|mailto:|tel:|#|\/|\.)/i;

const FAMILY_VALUES = FONT_FAMILIES.filter((f) => f.model).map((f) => f.model as string);
const SIZE_CLASSES = FONT_SIZES.filter((s) => s.className).map((s) => s.className as string);

const normalizeWs = (value: string): string => value.replace(/\s+/g, " ").trim();

// A family is accepted only when it matches exactly the form the serializer
// writes; any other quoting variant is dropped along with the span. That is what
// keeps a document from drifting: `Lucida Sans Unicode, Lucida Grande,
// sans-serif` unquoted does not survive.
const familyMatches = (value: string, model: string): boolean =>
  normalizeWs(value) === normalizeWs(formatFontFamily(model));

// Every family containing a space gets quoted, not just the first:
// `Lucida Sans Unicode, Lucida Grande, sans-serif` comes out as
// `'Lucida Sans Unicode', 'Lucida Grande', sans-serif`.
export const formatFontFamily = (model: string): string =>
  model
    .split(",")
    .map((family) => family.trim())
    .map((family) => (/\s/.test(family) && !/^['"]/.test(family) ? `'${family}'` : family))
    .join(", ");

function dropDangerous(root: HTMLElement): void {
  for (const el of Array.from(root.querySelectorAll("*"))) {
    if (DROP_WITH_CONTENT.includes(el.tagName)) {
      el.parentNode?.removeChild(el);
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || name === "srcdoc") el.removeAttribute(attr.name);
    }
    if (el.tagName === "A") {
      const href = el.getAttribute("href") || "";
      if (href && !SAFE_PROTOCOL.test(href.trim())) el.removeAttribute("href");
    }
  }
  // Comments, including Word's conditional ones.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT, null);
  const comments: Node[] = [];
  let comment = walker.nextNode();
  while (comment) {
    comments.push(comment);
    comment = walker.nextNode();
  }
  comments.forEach((c) => c.parentNode && c.parentNode.removeChild(c));
}

function cleanWordArtifacts(root: HTMLElement): void {
  for (const el of Array.from(root.querySelectorAll("*"))) {
    // Office namespaces: <o:p>, <w:sdt>, <v:shape>.
    if (el.tagName.includes(":")) {
      unwrap(el);
      continue;
    }
    const cls = el.getAttribute("class");
    if (cls && /(^|\s)(Mso|docs-)/.test(cls)) el.removeAttribute("class");
    const style = el.getAttribute("style");
    if (style && /mso-/i.test(style)) {
      const kept = parseStyle(el).filter((d) => !d.prop.startsWith("mso-"));
      if (kept.length) el.setAttribute("style", kept.map((d) => `${d.prop}:${d.value};`).join(""));
      else el.removeAttribute("style");
    }
  }
}

// Inline font-weight / font-style / text-decoration are translated into the
// contract's tags.
function liftImplicitFormats(el: HTMLElement): void {
  const weight = getStyle(el, "font-weight");
  const style = getStyle(el, "font-style");
  const decoration = getStyle(el, "text-decoration") || getStyle(el, "text-decoration-line");
  let target: HTMLElement = el;

  if (weight && /^(bold|[6-9]00)$/i.test(weight.trim())) {
    const strong = document.createElement("strong");
    el.parentNode!.insertBefore(strong, el);
    strong.appendChild(el);
    target = strong;
  }
  if (style && /italic|oblique/i.test(style)) {
    const italic = document.createElement("i");
    target.parentNode!.insertBefore(italic, target);
    italic.appendChild(target);
    target = italic;
  }
  if (decoration && /underline/i.test(decoration)) {
    const underline = document.createElement("u");
    target.parentNode!.insertBefore(underline, target);
    underline.appendChild(target);
  }
}

function convertFontTag(el: Element): HTMLElement {
  const span = replaceTag(el, "span");
  const color = span.getAttribute("color");
  const face = span.getAttribute("face");
  span.removeAttribute("color");
  span.removeAttribute("face");
  span.removeAttribute("size");
  if (color) setStyle(span, "color", color);
  if (face) setStyle(span, "font-family", face);
  return span;
}

// Strict mode: anything that does not fit the contract is discarded.
/**
 * <span> style policy, the same on paste and on load.
 *
 *   color             any value, exactly as it comes
 *   font-family       only on an exact match with one of the configured families
 *   font-size         never as a style; size lives in the text-* classes
 *   background-color  discarded
 *
 * Attributes are not rewritten when nothing changes: removing and re-adding them
 * sends them to the end, and that changes how the HTML serializes.
 */
function cleanSpan(span: HTMLElement, strict: boolean): void {
  if (strict) liftImplicitFormats(span);

  const family = getStyle(span, "font-family");
  const color = getStyle(span, "color");
  const match = family ? FAMILY_VALUES.find((model) => familyMatches(family, model)) : null;

  const decls: StyleDecl[] = [];
  if (color) decls.push({ prop: "color", value: normalizeWs(color) });
  if (match) decls.push({ prop: "font-family", value: formatFontFamily(match) });

  const style = serializeStyle(decls);
  if ((span.getAttribute("style") || "") !== style) {
    if (style) span.setAttribute("style", style);
    else span.removeAttribute("style");
  }

  const classes = Array.from(span.classList);
  const kept = classes.filter((c) => SIZE_CLASSES.includes(c) || c === "mention");
  if (kept.length !== classes.length) {
    if (kept.length) span.setAttribute("class", kept.join(" "));
    else span.removeAttribute("class");
  }

  for (const attr of Array.from(span.attributes)) {
    if (!["style", "class", "data-mention"].includes(attr.name)) span.removeAttribute(attr.name);
  }
  if (!span.attributes.length) unwrap(span);
}

function cleanAttributes(el: HTMLElement, strict: boolean): void {
  const tag = el.tagName;

  if (tag === "A") {
    const href = el.getAttribute("href");
    if (!href) {
      unwrap(el);
      return;
    }
    // External links always get all three attributes rewritten, always in this
    // order, both on paste and on load.
    for (const attr of Array.from(el.attributes)) el.removeAttribute(attr.name);
    if (EXTERNAL_LINK_RE.test(href)) {
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer");
    }
    el.setAttribute("href", href);
    return;
  }

  if (tag === "IMG") {
    for (const attr of Array.from(el.attributes)) {
      if (!["src", "alt", "width", "height"].includes(attr.name)) el.removeAttribute(attr.name);
    }
    const src = el.getAttribute("src") || "";
    if (!SAFE_PROTOCOL.test(src.trim()) && !src.startsWith("data:image/")) {
      el.parentNode?.removeChild(el);
    }
    return;
  }

  if (tag === "TD" || tag === "TH") {
    for (const attr of Array.from(el.attributes)) {
      if (!["colspan", "rowspan", "style"].includes(attr.name)) el.removeAttribute(attr.name);
    }
    keepStyles(el, strict ? ["text-align"] : ["text-align", "width", "background-color"]);
    return;
  }

  if (tag === "FIGURE") {
    const cls = el.classList.contains("image") ? "image" : "table";
    for (const attr of Array.from(el.attributes)) el.removeAttribute(attr.name);
    el.setAttribute("class", cls);
    return;
  }

  if (tag === "TABLE" || tag === "TBODY" || tag === "THEAD" || tag === "TFOOT" || tag === "TR") {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name !== "style") el.removeAttribute(attr.name);
    }
    keepStyles(el, strict ? [] : ["width", "height"]);
    return;
  }

  if (BLOCK_LIKE.includes(tag) || tag === "UL" || tag === "OL") {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name !== "style") el.removeAttribute(attr.name);
    }
    // Only text-align and the indentation survive, in permissive mode too:
    // everything else is discarded (old content carries stray margins and
    // paddings) so that opening and saving produces the same HTML it started
    // with. They are rewritten in the contract's order, which is the order this
    // reads them in.
    const align = getStyle(el, "text-align");
    const indent = INDENTABLE_TAGS.includes(tag) ? readIndent(el) : 0;
    keepStyles(el, []);
    if (align && ALIGN_VALUES.includes(align.trim().toLowerCase())) {
      setStyle(el, "text-align", align.trim().toLowerCase());
    }
    if (indent) writeIndent(el, indent);
    return;
  }

  if (tag === "STRONG" || tag === "I" || tag === "U" || tag === "BR") {
    for (const attr of Array.from(el.attributes)) el.removeAttribute(attr.name);
  }
}

/**
 * @param {string} html
 * @param {{ source: 'paste'|'data' }} options
 * @returns {string}
 */
export function sanitizeHtml(
  html: string | null | undefined,
  { source = "data" }: { source?: SanitizeSource } = {},
): string {
  if (!html) return "";
  const strict = source === "paste";

  // DOMPurify goes first and removes anything dangerous; the rest of this
  // function only has to map what is left onto the contract.
  const safe = purifyInput(html);

  // DOMParser builds an inert document: no scripts run, no <img src> is fetched.
  const doc = new DOMParser().parseFromString(`<body>${safe}</body>`, "text/html");
  const root = doc.body;

  dropDangerous(root);
  if (strict) cleanWordArtifacts(root);

  // Depth-first: by the time a node is unwrapped, its children are already handled.
  const all = Array.from(root.querySelectorAll<HTMLElement>("*")).reverse();

  for (const el of all) {
    if (!el.parentNode) continue;
    let node = el;

    if (node.tagName === "FONT") node = convertFontTag(node);

    if (UNWRAP.includes(node.tagName)) {
      unwrap(node);
      continue;
    }

    const mapped = TAG_MAP[node.tagName];
    if (mapped) node = replaceTag(node, mapped.toLowerCase());

    if (!STRUCTURAL.includes(node.tagName)) {
      unwrap(node);
      continue;
    }

    if (node.tagName === "SPAN") {
      cleanAttributes(node, strict);
      cleanSpan(node, strict);
      continue;
    }

    cleanAttributes(node, strict);
  }

  distributeInlinesOverBlocks(root);
  normalizeBlockContainers(root);

  // Stray whitespace between blocks: left alone, every setData adds an empty paragraph.
  for (const node of Array.from(root.childNodes)) {
    if (isText(node) && !node.data.trim()) root.removeChild(node);
  }

  return root.innerHTML;
}

export { isElement };
