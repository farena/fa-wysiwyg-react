// Pretty-printer for the lab's output panel. Visual only: it inserts line
// breaks and indentation between structural tags and never touches anything
// else, so what is shown is the stored HTML with whitespace added — entities,
// attributes and inline markup come out byte for byte as they went in.

// Tags that get a line of their own. Everything else (inline markup, <br>,
// <img>) stays on the line of the block it belongs to.
const STRUCTURAL = new Set([
  "ul",
  "ol",
  "li",
  "figure",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
  "p",
  "h2",
  "h3",
  "h4",
]);

const TOKENS = /<[^>]+>|[^<]+/g;
const TAG = /^<(\/?)\s*([a-z0-9]+)/i;

export function prettyHtml(html: string): string {
  if (!html) return "";

  const lines = [""];
  const openedAt: number[] = [];
  let depth = 0;

  const indent = () => "  ".repeat(depth);
  const append = (text: string) => {
    lines[lines.length - 1] += text;
  };
  const breakLine = () => {
    if (lines[lines.length - 1].trim()) lines.push(indent());
    else lines[lines.length - 1] = indent();
  };

  for (const token of html.match(TOKENS) || []) {
    const match = TAG.exec(token);
    const tag = match && match[2].toLowerCase();

    if (!tag || !STRUCTURAL.has(tag) || token.endsWith("/>")) {
      append(token);
      continue;
    }

    if (match[1]) {
      depth--;
      // A block whose content never broke the line keeps its closing tag on it:
      // <li>One</li> reads better than three lines.
      if (openedAt.pop() !== lines.length - 1) breakLine();
      append(token);
      continue;
    }

    breakLine();
    append(token);
    openedAt.push(lines.length - 1);
    depth++;
  }

  return lines.join("\n");
}
