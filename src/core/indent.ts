// Block indentation, stored as `margin-left` on the block itself.
//
// It lives apart from the command because the sanitizer needs to read and write
// levels too: what arrives from the database is quantized on load, so a margin
// written by another editor lands on a level the buttons can walk up and down.

import { getStyle, setStyle } from "./css";
import { INDENT_STEP, INDENT_UNIT, MAX_INDENT } from "./constants";

const LENGTH_RE = /^(-?[\d.]+)([a-z%]*)$/i;

/**
 * Indentation level of a block, from its `margin-left`. Anything that is not a
 * positive length in the contract's unit reads as 0 — `margin-left:0px`, the
 * one old content carries most, included — and a value between two levels is
 * quantized to the nearest one.
 *
 * @returns {number} 0 to MAX_INDENT
 */
export function readIndent(el: Element): number {
  const value = getStyle(el, "margin-left");
  if (!value) return 0;

  const match = value.trim().match(LENGTH_RE);
  if (!match || (match[2] && match[2].toLowerCase() !== INDENT_UNIT)) return 0;

  const level = Math.round(Number(match[1]) / INDENT_STEP);
  if (!Number.isFinite(level)) return 0;
  return clampLevel(level);
}

// Level 0 removes the declaration: an unindented block carries no margin.
export function writeIndent(el: Element, level: number): void {
  setStyle(el, "margin-left", indentValue(level));
}

// The `margin-left` a level is written as, or null for level 0.
export function indentValue(level: number): string | null {
  const clamped = clampLevel(level);
  return clamped ? `${clamped * INDENT_STEP}${INDENT_UNIT}` : null;
}

export const clampLevel = (level: number): number => Math.min(Math.max(level, 0), MAX_INDENT);
