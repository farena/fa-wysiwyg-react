import debounce from "../core/debounce";
import History from "../core/history";
import { getData, setData } from "../core/serialize";
import { guardStructure } from "../core/normalize";
import { computeState, EMPTY_STATE, type EditorState } from "../core/state";
import { handlePaste } from "../core/paste";
import { detectMention, filterFeed, insertMention } from "../core/mentions";
import { isOutOfView } from "../core/position";
import {
  getRange,
  setRange,
  caretRect,
  lastTextPosition,
  collapseTo,
  isSelectionInside,
} from "../core/selection";
import {
  handleEnter,
  handleSoftBreak,
  handleBackspaceAtStart,
  handleDeleteAtEnd,
} from "../core/keys";
import {
  applyInline,
  removeInline,
  boldSpec,
  italicSpec,
  underlineSpec,
  fontFamilySpec,
  fontSizeSpec,
  fontColorSpec,
  type InlineSpec,
} from "../core/commands/inline";
import { setBlockTag, setAlignment, changeIndent } from "../core/commands/block";
import { toggleList } from "../core/commands/list";
import {
  applyLink,
  updateLink,
  unlink,
  findLink,
  autoLink,
} from "../core/commands/link";
import * as table from "../core/commands/table";
import type { TableSize } from "./FaTableGrid";
import type { TableCommand } from "./FaTableBalloon";

const EMIT_DEBOUNCE = 300;
const ZWSP = "\u200b";

type MentionContext = NonNullable<ReturnType<typeof detectMention>>;

/** What the controller needs from the component's props. */
export interface ControllerProps {
  disabled: boolean;
  autocompleteOpts?: string[] | null;
  onChange?: (html: string) => void;
  onFocus?: (event: FocusEvent) => void;
  onBlur?: (event: FocusEvent) => void;
}

/** The part of the controller's state that React renders. */
export interface EditorView {
  state: EditorState;
  focused: boolean;
  empty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  linkOpen: boolean;
  linkHref: string;
  linkEditing: boolean;
  tableOpen: boolean;
  mentionOpen: boolean;
  mentionItems: string[];
  mentionActive: number;
}

/**
 * Everything the editor does to the DOM, kept out of React.
 *
 * The editable is driven through the Range API, not through React's render
 * cycle: React only ever renders an empty <div contenteditable> and never
 * touches what is inside it. This class holds the editing state and pushes
 * the slice that has to be painted (toolbar state, balloons) through
 * `onView`. Reads go through `this.view`, which is updated synchronously, so
 * a handler always sees what the previous one wrote — the same guarantee the
 * Vue version got from its reactive `this`.
 */
export default class FaWysiwygController {
  view: EditorView = {
    state: { ...EMPTY_STATE },
    focused: false,
    empty: true,
    canUndo: false,
    canRedo: false,
    linkOpen: false,
    linkHref: "",
    linkEditing: false,
    tableOpen: false,
    mentionOpen: false,
    mentionItems: [],
    mentionActive: 0,
  };

  props: ControllerProps = { disabled: false };
  onView: (view: EditorView) => void = () => {};

  root: HTMLElement | null = null;
  history: History | null = null;
  composing = false;
  lastEmittedData: string | null = null;

  // References to DOM nodes: they live here, never in React state.
  linkTarget: Element | null = null;
  tableFigure: Element | null = null;
  mentionAnchor: Range | null = null;
  mentionContext: MentionContext | null = null;
  savedRange: Range | null = null;
  mentionSpace: Text | null = null;
  lastRange: Range | null = null;
  stateFrame: number | null = null;

  emitChange = debounce(() => this.flushChange(), EMIT_DEBOUNCE, {
    leading: true,
  });

  // The history entry is only created once typing stops, so canUndo has to be
  // re-read here: in `onInput` it still holds the previous value.
  recordTyping = debounce(() => {
    if (!this.history) return;
    this.history.record("typing");
    this.syncFlags();
  }, 400);

  // --- View -----------------------------------------------------------------

  update(patch: Partial<EditorView>) {
    this.view = { ...this.view, ...patch };
    this.onView(this.view);
  }

  get mentionFeed() {
    const options = this.props.autocompleteOpts;
    if (!options) return null;
    return options.filter((option) => option.startsWith("#"));
  }

  // --- Lifecycle ------------------------------------------------------------

  setProps(props: ControllerProps) {
    this.props = props;
  }

  attach(root: HTMLElement, value: string, onView: (view: EditorView) => void) {
    this.onView = onView;
    this.root = root;
    setData(root, value);
    this.history = new History(root);
    this.lastEmittedData = value;
    this.syncFlags();
    root.addEventListener("beforeinput", this.onBeforeInput);
    document.addEventListener("selectionchange", this.onSelectionChange);
  }

  detach() {
    if (this.root) {
      this.root.removeEventListener("beforeinput", this.onBeforeInput);
    }
    document.removeEventListener("selectionchange", this.onSelectionChange);
    if (this.stateFrame) cancelAnimationFrame(this.stateFrame);
    this.stateFrame = null;
    this.emitChange.cancel();
    this.recordTyping.cancel();
    this.root = null;
  }

  // --- Public API -----------------------------------------------------------

  focus = () => {
    const root = this.root;
    if (!root) return;
    root.focus();
    const last = root.lastElementChild;
    if (!last) return;
    const { node, offset } = lastTextPosition(last);
    collapseTo(node, offset);
  };

  getData = () => (this.root ? getData(this.root) : "");

  // --- Data cycle -----------------------------------------------------------

  // Only reload when the change comes from outside; otherwise the caret jumps.
  receive(value: string) {
    if (value === this.lastEmittedData) return;
    this.load(value);
  }

  load(value: string) {
    const root = this.root;
    if (!root || !this.history) return;
    setData(root, value);
    this.history.reset(root.innerHTML);
    this.closeAllBalloons();
    this.syncFlags();

    // Data arriving from outside is re-emitted already normalized. Without
    // this the parent and the editor hold two different representations of the
    // same content, and the user's first keystroke produces a diff that does
    // not correspond to what they typed.
    const data = getData(root);
    this.lastEmittedData = data;
    if (data !== value) this.props.onChange?.(data);
  }

  flushChange() {
    if (!this.root) return;
    const data = getData(this.root);
    this.lastEmittedData = data;
    this.props.onChange?.(data);
  }

  syncFlags() {
    const root = this.root;
    if (!root) return;
    const patch: Partial<EditorView> = {
      empty: !(root.textContent || "").replace(/[\s\u00a0\u200b]/g, "").length,
    };
    if (this.history) {
      patch.canUndo = this.history.canUndo;
      patch.canRedo = this.history.canRedo;
    }
    this.update(patch);
  }

  // Called after every mutation we make ourselves.
  commit(kind: "typing" | "command" | "paste" = "command") {
    if (!this.root || !this.history) return;
    guardStructure(this.root);
    this.history.record(kind);
    this.syncFlags();
    this.emitChange();
    this.refreshState();
  }

  refreshState = () => {
    if (this.stateFrame) return;
    this.stateFrame = requestAnimationFrame(() => {
      this.stateFrame = null;
      this.updateState();
    });
  };

  // --- Content events -------------------------------------------------------

  onBeforeInput = (event: InputEvent) => {
    if (this.props.disabled || this.composing) return;
    const root = this.root;
    if (!root) return;
    const range = getRange(root);
    if (!range) return;

    const type = event.inputType;

    // Browsers ship their own formatting shortcuts that would produce tags
    // the contract does not include, <s> among them. The ones the editor does
    // implement are caught on keydown, before they ever reach this point.
    if (type.startsWith("format")) {
      event.preventDefault();
      return;
    }

    if (type === "insertParagraph") {
      event.preventDefault();
      autoLink(root, range);
      handleEnter(root, getRange(root) || range);
      this.commit();
      return;
    }

    if (type === "insertLineBreak") {
      event.preventDefault();
      handleSoftBreak(root, range);
      this.commit();
      return;
    }

    if (type === "deleteContentBackward" && handleBackspaceAtStart(root, range)) {
      event.preventDefault();
      this.commit();
      return;
    }

    if (type === "deleteContentForward" && handleDeleteAtEnd(root, range)) {
      event.preventDefault();
      this.commit();
    }
  };

  onInput = (event?: InputEvent) => {
    if (this.composing) return;
    const root = this.root;
    if (!root || !this.history || this.history.isRestoring) return;

    guardStructure(root);
    this.releaseMentionSpace();
    if (event && event.inputType === "insertText" && event.data === " ") {
      this.tryAutoLink();
    }
    this.recordTyping();
    this.syncFlags();
    this.emitChange();
    this.refreshState();
    this.updateMentions();
  };

  onCompositionStart = () => {
    this.composing = true;
  };

  onCompositionEnd = () => {
    this.composing = false;
    this.onInput();
  };

  onKeydown = (event: KeyboardEvent) => {
    if (this.props.disabled) return;

    // Mentions claim the arrow keys before any other handler.
    if (this.view.mentionOpen && this.onMentionKeydown(event)) return;

    const meta = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (meta && key === "z" && !event.shiftKey) {
      event.preventDefault();
      return this.runHistory("undo");
    }
    if (meta && (key === "y" || (event.shiftKey && key === "z"))) {
      event.preventDefault();
      return this.runHistory("redo");
    }
    if (meta && key === "b") {
      event.preventDefault();
      return this.onCommand("bold");
    }
    if (meta && key === "i") {
      event.preventDefault();
      return this.onCommand("italic");
    }
    if (meta && key === "u") {
      event.preventDefault();
      return this.onCommand("underline");
    }
    if (meta && key === "k") {
      event.preventDefault();
      return this.onCommand("link");
    }
    if (event.key === "Tab" && this.moveBetweenCells(event.shiftKey)) {
      event.preventDefault();
      return;
    }
    // Both are supported: shift+enter is the muscle memory, ctrl+enter the label.
    if (event.key === "Enter" && (meta || event.shiftKey)) {
      event.preventDefault();
      const root = this.root;
      const range = root && getRange(root);
      if (!root || !range) return;
      handleSoftBreak(root, range);
      this.commit();
      return;
    }
  };

  /**
   * Tab inside a table jumps to the next cell, and on the last one adds a
   * row. It is the only comfortable way to walk a table from the keyboard.
   *
   * @returns true when the Tab was consumed
   */
  moveBetweenCells(backwards: boolean) {
    const root = this.root;
    if (!root) return false;
    const range = getRange(root);
    if (!range) return false;

    const cell = table.cellOf(root, range.startContainer);
    const tableEl = cell && table.tableOf(root, cell);
    if (!cell || !tableEl) return false;

    const cells = Array.from(tableEl.querySelectorAll("td, th"));
    const index = cells.indexOf(cell);
    let target: Element | undefined = cells[index + (backwards ? -1 : 1)];

    if (!target) {
      if (backwards) return true;
      table.insertRow(tableEl, cell, "below");
      const rows = (tableEl as HTMLTableElement).rows;
      const row = rows[rows.length - 1];
      target = row && row.cells[0];
    }
    if (!target) return true;

    // The target cell's content is left selected rather than the caret placed
    // at the end: tabbing and typing replaces what was there.
    const selection = document.createRange();
    selection.selectNodeContents(target);
    setRange(selection);
    this.commit();
    return true;
  }

  // Autolink runs from `input`, not from `keydown`: on keydown the space is
  // not in the DOM yet and the caret sits one character back, which cut the
  // URL short by a character.
  tryAutoLink() {
    const root = this.root;
    if (!root) return;
    const range = getRange(root);
    if (!range || !range.collapsed) return;
    if (range.startContainer.nodeType !== Node.TEXT_NODE || range.startOffset === 0) {
      return;
    }

    const probe = range.cloneRange();
    probe.setStart(probe.startContainer, probe.startOffset - 1);
    probe.collapse(true);
    if (autoLink(root, probe)) {
      setRange(range);
      this.commit();
    }
  }

  onClick = (event: MouseEvent) => {
    // A link inside the editor must not navigate.
    const target = event.target as Element | null;
    const link = target && target.closest && target.closest("a");
    if (link && this.root && this.root.contains(link)) event.preventDefault();
    this.refreshState();
  };

  onFocus = (event: FocusEvent) => {
    this.update({ focused: true });
    this.props.onFocus?.(event);
  };

  onBlur = (event: FocusEvent) => {
    this.update({ focused: false });
    this.props.onBlur?.(event);
  };

  onPaste = (event: ClipboardEvent) => {
    if (this.props.disabled) return;
    event.preventDefault();
    const root = this.root;
    if (!root) return;
    const range = getRange(root);
    if (!range || !event.clipboardData) return;
    if (handlePaste(root, range, event.clipboardData)) this.commit("paste");
  };

  onSelectionChange = () => {
    if (!this.root || !isSelectionInside(this.root)) return;
    // The last valid selection is remembered: panels with a text field (the
    // color picker's hex input) take focus away from the editable, and the
    // selection with it, but the command still has to apply to whatever was
    // selected.
    this.lastRange = getRange(this.root);
    this.refreshState();
    this.updateMentions();
  };

  // --- State and balloons ---------------------------------------------------

  updateState() {
    const root = this.root;
    if (!root) return;
    const range = getRange(root);
    this.update({ state: computeState(root, range) });
    this.syncLinkBalloon(range);
    this.syncTableBalloon();
  }

  syncLinkBalloon(range: Range | null) {
    if (this.view.linkEditing) return;
    const link = this.view.state.link as Element | null;
    if (!link || !range) {
      this.linkTarget = null;
      this.update({ linkOpen: false });
      return;
    }
    this.linkTarget = link;
    this.update({ linkHref: link.getAttribute("href") || "", linkOpen: true });
  }

  syncTableBalloon() {
    const cell = this.view.state.cell as Element | null;
    if (!cell || this.props.disabled || !this.root) {
      this.tableFigure = null;
      this.update({ tableOpen: false });
      return;
    }
    this.tableFigure =
      table.figureOf(this.root, cell) || (this.view.state.table as Element | null);
    this.update({ tableOpen: !!this.tableFigure });
  }

  // Live anchors for the balloons. Returning null hides them, which is what
  // happens when the anchor scrolls out of the editor's visible area.
  linkRect = () => {
    if (this.linkTarget && this.linkTarget.isConnected) {
      return this.clampToContent(this.linkTarget.getBoundingClientRect());
    }
    return this.savedRange ? this.clampToContent(caretRect(this.savedRange)) : null;
  };

  tableRect = () => {
    if (!this.tableFigure || !this.tableFigure.isConnected) return null;
    return this.clampToContent(this.tableFigure.getBoundingClientRect());
  };

  mentionRect = () => {
    if (!this.mentionAnchor) return null;
    try {
      return this.clampToContent(caretRect(this.mentionAnchor));
    } catch {
      return null;
    }
  };

  clampToContent(rect: DOMRect) {
    const root = this.root;
    if (!root) return null;
    return isOutOfView(rect, root.getBoundingClientRect()) ? null : rect;
  }

  closeAllBalloons() {
    this.linkTarget = null;
    this.tableFigure = null;
    this.update({ linkOpen: false, linkEditing: false, tableOpen: false });
    this.closeMentions();
  }

  // --- Toolbar commands -----------------------------------------------------

  // Gives the editable back the selection it had before a panel stole focus.
  // A live Range moves with the DOM, but once its container has left the tree
  // it is no longer usable.
  restoreLastRange() {
    const range = this.lastRange;
    const root = this.root;
    if (!range || !root || !root.contains(range.startContainer)) return;
    setRange(range);
  }

  onCommand = (name: string, value?: unknown) => {
    if (this.props.disabled) return;
    if (name === "undo" || name === "redo") return this.runHistory(name);

    const root = this.root;
    if (!root) return;
    if (!isSelectionInside(root)) this.restoreLastRange();
    if (!isSelectionInside(root)) this.focus();
    const range = getRange(root);
    if (!range) return;

    const state = this.view.state;
    const handlers: Record<string, () => unknown> = {
      bold: () => this.toggleInline(range, boldSpec, true, state.bold),
      italic: () => this.toggleInline(range, italicSpec, true, state.italic),
      underline: () => this.toggleInline(range, underlineSpec, true, state.underline),
      fontFamily: () => this.setInline(range, fontFamilySpec, value),
      fontSize: () => this.setInline(range, fontSizeSpec, value),
      fontColor: () => this.setInline(range, fontColorSpec, value),
      heading: () => setBlockTag(root, range, value as string),
      alignment: () => setAlignment(root, range, value as string),
      indent: () => changeIndent(root, range, 1),
      outdent: () => changeIndent(root, range, -1),
      bulletedList: () => toggleList(root, range, "ul"),
      numberedList: () => toggleList(root, range, "ol"),
      insertTable: () => {
        const size = value as TableSize;
        return table.insertTable(root, range, size.rows, size.cols);
      },
      link: () => this.openLinkBalloon(range),
    };

    const handler = handlers[name];
    if (!handler) return;
    if (handler() !== false && name !== "link") this.commit();
  };

  toggleInline(range: Range, spec: InlineSpec, value: unknown, isActive: boolean) {
    if (isActive) return removeInline(this.root!, range, spec) || this.clearPending();
    return this.applyOrPend(range, spec, value);
  }

  setInline(range: Range, spec: InlineSpec, value: unknown) {
    if (value == null) {
      return removeInline(this.root!, range, spec) || this.clearPending();
    }
    return this.applyOrPend(range, spec, value);
  }

  /**
   * With a collapsed selection there is no text to wrap: the empty wrapper is
   * inserted with an invisible character and the caret inside it, so the
   * format applies to whatever is typed next. getData drops the character.
   */
  applyOrPend(range: Range, spec: InlineSpec, value: unknown) {
    const root = this.root!;
    if (!range.collapsed) return applyInline(root, range, spec, value);

    const wrapper = spec.create(value);
    const text = document.createTextNode(ZWSP);
    wrapper.appendChild(text);
    range.insertNode(wrapper);
    collapseTo(text, 1);
    return true;
  }

  clearPending() {
    return true;
  }

  runHistory(action: "undo" | "redo") {
    this.closeAllBalloons();
    if (!this.history || !this.history[action]()) return;
    this.syncFlags();
    this.emitChange();
    this.refreshState();
    this.root?.focus();
  }

  // --- Links ----------------------------------------------------------------

  openLinkBalloon(range: Range) {
    const root = this.root!;
    const existing = findLink(root, range.startContainer);
    this.linkTarget = existing;
    this.savedRange = range.cloneRange();
    this.update({
      linkHref: existing ? existing.getAttribute("href") || "" : "",
      linkEditing: true,
      linkOpen: true,
    });
  }

  saveLink = (href: string) => {
    const root = this.root;
    if (!root) return;
    if (this.linkTarget) updateLink(root, this.linkTarget, href);
    else {
      if (this.savedRange) setRange(this.savedRange);
      const range = getRange(root);
      if (!range) return;
      if (range.collapsed) {
        // With no text selected, the link uses the URL as its label.
        const text = document.createTextNode(href);
        range.insertNode(text);
        const wrap = document.createRange();
        wrap.selectNode(text);
        applyLink(root, wrap, href);
      } else {
        applyLink(root, range, href);
      }
    }
    this.update({ linkEditing: false, linkOpen: false });
    this.commit();
  };

  removeLink = () => {
    const root = this.root;
    if (!root) return;
    unlink(root, getRange(root), this.linkTarget);
    this.linkTarget = null;
    this.update({ linkEditing: false, linkOpen: false });
    this.commit();
  };

  closeLinkBalloon = () => {
    this.update({ linkEditing: false, linkOpen: false });
    this.root?.focus();
  };

  // --- Tables ---------------------------------------------------------------

  onTableCommand = (command: TableCommand) => {
    const root = this.root;
    const cell = this.view.state.cell as HTMLTableCellElement | null;
    const tableEl = this.view.state.table as HTMLTableElement | null;
    if (!root || !cell || !tableEl) return;

    const actions: Record<TableCommand, () => unknown> = {
      columnInsertLeft: () => table.insertColumn(tableEl, cell, "left"),
      columnInsertRight: () => table.insertColumn(tableEl, cell, "right"),
      columnDelete: () => table.deleteColumn(tableEl, cell),
      columnHeader: () => table.toggleHeaderColumn(tableEl, cell),
      rowInsertAbove: () => table.insertRow(tableEl, cell, "above"),
      rowInsertBelow: () => table.insertRow(tableEl, cell, "below"),
      rowDelete: () => table.deleteRow(tableEl, cell),
      rowHeader: () => table.toggleHeaderRow(tableEl, cell),
      mergeUp: () => table.mergeCells(tableEl, cell, "up"),
      mergeRight: () => table.mergeCells(tableEl, cell, "right"),
      mergeDown: () => table.mergeCells(tableEl, cell, "down"),
      mergeLeft: () => table.mergeCells(tableEl, cell, "left"),
      splitHorizontally: () => table.splitCell(tableEl, cell, "horizontally"),
      splitVertically: () => table.splitCell(tableEl, cell, "vertically"),
      tableDelete: () => table.removeTable(root, tableEl),
    };

    const action = actions[command];
    if (!action) return;
    action();
    this.commit();
  };

  // --- Mentions -------------------------------------------------------------

  updateMentions() {
    const feed = this.mentionFeed;
    const root = this.root;
    if (!feed || !root) return;
    const range = getRange(root);
    const context = range ? detectMention(root, range) : null;

    if (!context) return this.closeMentions();

    const items = filterFeed(feed, context.query);
    if (!items.length) return this.closeMentions();

    const probe = document.createRange();
    probe.setStart(context.textNode, context.markerOffset);
    probe.collapse(true);

    this.mentionContext = context;
    this.mentionAnchor = probe;
    this.update({
      mentionItems: items,
      mentionActive: Math.min(this.view.mentionActive, items.length - 1),
      mentionOpen: true,
    });
  }

  onMentionKeydown(event: KeyboardEvent) {
    const { mentionItems, mentionActive } = this.view;
    const total = mentionItems.length;
    if (!total) return false;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      this.update({ mentionActive: (mentionActive + 1) % total });
      return true;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      this.update({ mentionActive: (mentionActive - 1 + total) % total });
      return true;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      this.applyMention(mentionItems[mentionActive]);
      return true;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      this.closeMentions();
      return true;
    }
    return false;
  }

  activateMention = (index: number) => {
    this.update({ mentionActive: index });
  };

  applyMention = (value: string) => {
    if (!this.mentionContext || !this.root) return;
    const inserted = insertMention(this.root, this.mentionContext, value);
    this.mentionSpace = inserted ? inserted.space : null;
    this.closeMentions();
    this.commit();
  };

  // The &nbsp; left behind a freshly inserted mention is only there to give
  // the caret somewhere to stand at the end of the block. Once it is no longer
  // last it becomes a plain space again, which is what the contract stores.
  // Only the one we inserted is touched: an &nbsp; that came in with the data
  // is content and is left alone.
  releaseMentionSpace() {
    const node = this.mentionSpace;
    if (!node) return;
    if (!node.parentNode || !node.data.startsWith("\u00a0")) {
      this.mentionSpace = null;
      return;
    }
    if (node.data.length === 1 && !node.nextSibling) return;

    // Rewriting `data` resets the caret to offset 0 of the node, so it has to
    // be noted and put back. The length does not change, so the offset stays
    // valid.
    const current = this.root ? getRange(this.root) : null;
    const inside = !!current && current.startContainer === node;
    const offset = inside && current ? current.startOffset : 0;
    node.data = ` ${node.data.slice(1)}`;
    if (inside) {
      const restored = document.createRange();
      restored.setStart(node, offset);
      restored.collapse(true);
      setRange(restored);
    }
    this.mentionSpace = null;
  }

  closeMentions() {
    this.mentionAnchor = null;
    this.mentionContext = null;
    this.update({
      mentionOpen: false,
      mentionItems: [],
      mentionActive: 0,
    });
  }
}
