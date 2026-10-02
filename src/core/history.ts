import { snapshotSelection, restoreSelection } from "./selection";
import type { SelectionSnapshot } from "./selection";
import { normalizeRoot } from "./normalize";

const LIMIT = 100;
const COALESCE_MS = 500;

export type HistoryKind = "typing" | "command" | "paste";

export interface HistoryEntry {
  html: string;
  selection: SelectionSnapshot | null;
}

export interface HistoryOptions {
  limit?: number;
  coalesceMs?: number;
}

/**
 * In-house undo stack.
 *
 * The native undo is unusable: every mutation goes through the Range API and
 * `document.execCommand('undo')` knows nothing about them. Each entry stores the
 * innerHTML plus an index path for the selection; a cloned Range does not
 * survive replacing the innerHTML.
 */
export default class History {
  root: HTMLElement;
  limit: number;
  coalesceMs: number;
  stack: HistoryEntry[];
  index: number;
  lastAt: number;
  lastBlock: string | null;
  lastKind?: HistoryKind | null;
  isRestoring: boolean;

  constructor(root: HTMLElement, { limit = LIMIT, coalesceMs = COALESCE_MS }: HistoryOptions = {}) {
    this.root = root;
    this.limit = limit;
    this.coalesceMs = coalesceMs;
    this.stack = [];
    this.index = -1;
    this.lastAt = 0;
    this.lastBlock = null;
    this.isRestoring = false;
    this.reset(root.innerHTML);
  }

  get canUndo(): boolean {
    return this.index > 0;
  }

  get canRedo(): boolean {
    return this.index < this.stack.length - 1;
  }

  reset(html: string): void {
    this.stack = [{ html, selection: null }];
    this.index = 0;
    this.lastAt = 0;
    this.lastBlock = null;
  }

  // Updates the stored selection of the current state, without adding an entry.
  touch(): void {
    if (this.isRestoring || this.index < 0) return;
    this.stack[this.index].selection = snapshotSelection(this.root);
  }

  /**
   * @param {'typing'|'command'|'paste'} kind
   */
  record(kind: HistoryKind = "command"): void {
    if (this.isRestoring) return;

    const html = this.root.innerHTML;
    const current = this.stack[this.index];
    if (current && current.html === html) {
      this.touch();
      return;
    }

    const now = Date.now();
    const block = this.currentBlockKey();
    const coalesce =
      kind === "typing" &&
      this.lastKind === "typing" &&
      now - this.lastAt < this.coalesceMs &&
      block === this.lastBlock &&
      this.index > 0;

    if (coalesce) {
      // The current entry is rewritten: a typing burst counts as one step.
      this.stack[this.index] = { html, selection: snapshotSelection(this.root) };
    } else {
      this.stack = this.stack.slice(0, this.index + 1);
      this.stack.push({ html, selection: snapshotSelection(this.root) });
      if (this.stack.length > this.limit) this.stack.shift();
      this.index = this.stack.length - 1;
    }

    this.lastAt = now;
    this.lastKind = kind;
    this.lastBlock = block;
  }

  undo(): boolean {
    if (!this.canUndo) return false;
    // The current entry records where the caret was before undoing.
    this.touch();
    this.index -= 1;
    this.apply(this.stack[this.index]);
    return true;
  }

  redo(): boolean {
    if (!this.canRedo) return false;
    this.index += 1;
    this.apply(this.stack[this.index]);
    return true;
  }

  apply(entry: HistoryEntry): void {
    this.isRestoring = true;
    try {
      this.root.innerHTML = entry.html;
      normalizeRoot(this.root);
      restoreSelection(this.root, entry.selection);
    } finally {
      this.isRestoring = false;
      this.lastKind = null;
      this.lastBlock = null;
      this.lastAt = 0;
    }
  }

  // Key of the block holding the caret, so coalescing breaks when it moves on.
  currentBlockKey(): string | null {
    const snapshot = snapshotSelection(this.root);
    return snapshot ? snapshot.startPath.slice(0, 1).join(".") : null;
  }
}
