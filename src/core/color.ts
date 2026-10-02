/**
 * Color conversions for the picker.
 *
 * The picker works in HSV, the natural space for a saturation square plus a hue
 * bar. What gets stored is HSL in its compact form, `hsl(210,65%,20%)`, which is
 * the canonical form of the HTML contract.
 */

export interface Hsv {
  h: number;
  s: number;
  v: number;
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** @returns {{h: number, s: number, v: number}} h in 0-360, s and v in 0-1 */
export function hexToHsv(hex: string | null | undefined): Hsv | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return rgbToHsv(rgb);
}

export function hexToRgb(hex: string | null | undefined): Rgb | null {
  const value = String(hex || "")
    .trim()
    .replace(/^#/, "");
  const full = value.length === 3 ? value.replace(/./g, (c) => c + c) : value;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const delta = max - min;

  let h = 0;
  if (delta) {
    if (max === rr) h = ((gg - bb) / delta) % 6;
    else if (max === gg) h = (bb - rr) / delta + 2;
    else h = (rr - gg) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s: max ? delta / max : 0, v: max };
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const sector = Math.floor(h / 60) % 6;
  const table = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ];
  const [r, g, b] = table[sector < 0 ? sector + 6 : sector];
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

export function hsvToHex(hsv: Hsv): string {
  const { r, g, b } = hsvToRgb(hsv);
  const part = (n: number) => n.toString(16).padStart(2, "0");
  return `${part(r)}${part(g)}${part(b)}`;
}

/** Rounded HSL, in the form the serializer writes. */
export function hsvToHsl({ h, s, v }: Hsv): Hsl {
  const l = v * (1 - s / 2);
  const sl = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l);
  return {
    h: Math.round(h),
    s: Math.round(sl * 100),
    l: Math.round(l * 100),
  };
}

export function formatHsl(hsv: Hsv): string {
  const { h, s, l } = hsvToHsl(hsv);
  return `hsl(${h},${s}%,${l}%)`;
}

/**
 * Reads the color the text already has, so the picker opens on it.
 * Accepts hex, `rgb()` and `hsl()`, which covers anything that can be stored.
 *
 * @returns {{h: number, s: number, v: number} | null}
 */
export function parseColor(value: string | null | undefined): Hsv | null {
  const input = String(value || "").trim();
  if (!input) return null;

  if (input.startsWith("#")) return hexToHsv(input);

  const rgb = input.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (rgb) {
    return rgbToHsv({ r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) });
  }

  const hsl = input.match(/^hsla?\(\s*([\d.]+)[\s,]+([\d.]+)%[\s,]+([\d.]+)%/i);
  if (hsl) return hslToHsv(Number(hsl[1]), Number(hsl[2]) / 100, Number(hsl[3]) / 100);

  return null;
}

function hslToHsv(h: number, s: number, l: number): Hsv {
  const v = l + s * Math.min(l, 1 - l);
  return { h: clamp(h, 0, 360), s: v ? 2 * (1 - l / v) : 0, v };
}
