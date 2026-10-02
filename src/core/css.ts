// The style attribute, handled as raw text.
//
// `el.style.*` is unusable here: the CSSOM re-serializes values and breaks the
// HTML contract. Chrome turns `hsl(0, 75%, 60%)` into `rgb(229, 89, 89)` and
// `'Courier New'` into `"Courier New"`. Reading and writing the attribute by
// hand preserves exactly what was there.

export interface StyleDecl {
  prop: string;
  value: string;
}

export function parseStyle(el: Element): StyleDecl[] {
  const raw = el.getAttribute ? el.getAttribute("style") : null;
  if (!raw) return [];
  return raw
    .split(";")
    .map((decl) => decl.trim())
    .filter(Boolean)
    .map((decl): StyleDecl | null => {
      const at = decl.indexOf(":");
      if (at === -1) return null;
      return { prop: decl.slice(0, at).trim().toLowerCase(), value: decl.slice(at + 1).trim() };
    })
    .filter((decl): decl is StyleDecl => Boolean(decl));
}

// Canonical form is `prop:value;`, with no spaces around the separators.
export function serializeStyle(decls: StyleDecl[]): string {
  return decls.map(({ prop, value }) => `${prop}:${value};`).join("");
}

export function getStyle(el: Element, prop: string): string | null {
  const found = parseStyle(el).find((d) => d.prop === prop);
  return found ? found.value : null;
}

export function setStyle(el: Element, prop: string, value: string | null | undefined): void {
  const decls = parseStyle(el).filter((d) => d.prop !== prop);
  if (value != null && value !== "") decls.push({ prop, value });
  if (!decls.length) el.removeAttribute("style");
  else el.setAttribute("style", serializeStyle(decls));
}

export function removeStyle(el: Element, prop: string): void {
  setStyle(el, prop, null);
}

// Keeps only the allowed properties. Returns true if any survived.
export function keepStyles(el: Element, allowed: string[]): boolean {
  const decls = parseStyle(el).filter((d) => allowed.includes(d.prop));
  if (!decls.length) {
    el.removeAttribute("style");
    return false;
  }
  el.setAttribute("style", serializeStyle(decls));
  return true;
}

export const sameStyle = (a: Element, b: Element): boolean =>
  (a.getAttribute("style") || "") === (b.getAttribute("style") || "");
