import {
  queryInline,
  boldSpec,
  italicSpec,
  underlineSpec,
  fontFamilySpec,
  fontSizeSpec,
  fontColorSpec,
} from "./commands/inline";
import {
  queryBlockTag,
  queryAlignment,
  queryIndent,
  queryIndentLimits,
} from "./commands/block";
import { queryList } from "./commands/list";
import { findLink } from "./commands/link";
import { cellOf, tableOf } from "./commands/table";

/**
 * Every value that can vary across the selection reads `'mixed'` when it does.
 */
export interface EditorState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  fontFamily: string | null;
  fontSize: string | null;
  fontColor: string | null;
  blockTag: string | null;
  align: string | null;
  indent: number | "mixed" | null;
  canIndent: boolean;
  canOutdent: boolean;
  list: string | null;
  link: HTMLAnchorElement | null;
  cell: HTMLTableCellElement | null;
  table: HTMLTableElement | null;
}

export const EMPTY_STATE: EditorState = {
  bold: false,
  italic: false,
  underline: false,
  fontFamily: null,
  fontSize: null,
  fontColor: null,
  blockTag: null,
  align: null,
  indent: null,
  canIndent: false,
  canOutdent: false,
  list: null,
  link: null,
  cell: null,
  table: null,
};

/**
 * Formatting state under the caret, used to paint the toolbar.
 * Recomputed on `selectionchange` and after every command.
 */
export function computeState(
  root: HTMLElement,
  range: Range | null,
): EditorState {
  if (!range) return { ...EMPTY_STATE };

  const node = range.startContainer;
  const limits = queryIndentLimits(root, range);
  return {
    bold: queryInline(root, range, boldSpec) === true,
    italic: queryInline(root, range, italicSpec) === true,
    underline: queryInline(root, range, underlineSpec) === true,
    fontFamily: queryInline(root, range, fontFamilySpec),
    fontSize: queryInline(root, range, fontSizeSpec),
    fontColor: queryInline(root, range, fontColorSpec),
    blockTag: queryBlockTag(root, range),
    align: queryAlignment(root, range),
    indent: queryIndent(root, range),
    canIndent: limits.canIndent,
    canOutdent: limits.canOutdent,
    list: queryList(root, range),
    link: findLink(root, node),
    cell: cellOf(root, node),
    table: tableOf(root, node),
  };
}
