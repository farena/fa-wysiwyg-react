// fa-wysiwyg configuration. These values define the HTML contract: changing them
// changes the markup that gets written to your database.
//
// `label` is a key into `lang.js`, never a user-visible string: what the reader
// sees depends on the editor's `lang`, what gets stored never does.

import type { IconName } from "./icons";

export interface HeadingOption {
  model: string;
  label: string;
}

export interface AlignmentOption {
  model: string;
  label: string;
  icon: IconName;
}

export interface FontFamilyOption {
  model: string | null;
  label?: string;
  title?: string;
}

export interface FontSizeOption {
  model: string | null;
  label: string;
  className: string | null;
  preview: string;
}

export interface ColorOption {
  color: string;
  label: string;
  hasBorder?: boolean;
}

export const BLOCK_TAGS: string[] = ["P", "H2", "H3", "H4"];
export const ROOT_TAGS: string[] = ["P", "H2", "H3", "H4", "UL", "OL", "FIGURE"];

export const HEADINGS: HeadingOption[] = [
  { model: "p", label: "paragraph" },
  { model: "h2", label: "heading1" },
  { model: "h3", label: "heading2" },
  { model: "h4", label: "heading3" },
];

export const ALIGNMENTS: AlignmentOption[] = [
  { model: "left", label: "alignLeft", icon: "alignLeft" },
  { model: "right", label: "alignRight", icon: "alignRight" },
  { model: "center", label: "alignCenter", icon: "alignCenter" },
  { model: "justify", label: "alignJustify", icon: "alignJustify" },
];

// The first entry clears the format. Family names are proper nouns and stay as
// they are; only that first entry is translated.
export const FONT_FAMILIES: FontFamilyOption[] = [
  { model: null, label: "defaultOption" },
  { model: "Arial, Helvetica, sans-serif", title: "Arial" },
  { model: "Courier New, Courier, monospace", title: "Courier New" },
  { model: "Georgia, serif", title: "Georgia" },
  { model: "Lucida Sans Unicode, Lucida Grande, sans-serif", title: "Lucida Sans Unicode" },
  { model: "Tahoma, Geneva, sans-serif", title: "Tahoma" },
  { model: "Times New Roman, Times, serif", title: "Times New Roman" },
  { model: "Trebuchet MS, Helvetica, sans-serif", title: "Trebuchet MS" },
  { model: "Verdana, Geneva, sans-serif", title: "Verdana" },
];

// Sizes are classes, not inline styles: the host stylesheet owns the actual
// values, so the same document can render at different scales per project.
export const FONT_SIZES: FontSizeOption[] = [
  { model: "tiny", label: "sizeTiny", className: "text-tiny", preview: "0.7em" },
  { model: "small", label: "sizeSmall", className: "text-small", preview: "0.85em" },
  { model: null, label: "defaultOption", className: null, preview: "1em" },
  { model: "big", label: "sizeBig", className: "text-big", preview: "1.4em" },
  { model: "huge", label: "sizeHuge", className: "text-huge", preview: "1.8em" },
];

export const FONT_SIZE_CLASSES: string[] = FONT_SIZES.filter((x) => x.className).map(
  (x) => x.className as string,
);

// Default palette: 15 colors laid out in 5 columns.
// No spaces after the commas: that is the canonical form the serializer emits,
// and the form documents are stored in.
export const COLORS: ColorOption[] = [
  { color: "hsl(0,0%,0%)", label: "colorBlack" },
  { color: "hsl(0,0%,30%)", label: "colorDimGrey" },
  { color: "hsl(0,0%,60%)", label: "colorGrey" },
  { color: "hsl(0,0%,90%)", label: "colorLightGrey" },
  { color: "hsl(0,0%,100%)", label: "colorWhite", hasBorder: true },
  { color: "hsl(0,75%,60%)", label: "colorRed" },
  { color: "hsl(30,75%,60%)", label: "colorOrange" },
  { color: "hsl(60,75%,60%)", label: "colorYellow" },
  { color: "hsl(90,75%,60%)", label: "colorLightGreen" },
  { color: "hsl(120,75%,60%)", label: "colorGreen" },
  { color: "hsl(150,75%,60%)", label: "colorAquamarine" },
  { color: "hsl(180,75%,60%)", label: "colorTurquoise" },
  { color: "hsl(210,75%,60%)", label: "colorLightBlue" },
  { color: "hsl(240,75%,60%)", label: "colorBlue" },
  { color: "hsl(270,75%,60%)", label: "colorPurple" },
];

export const COLOR_COLUMNS = 5;

export const TABLE_GRID_SIZE = 10;

// Indentation. A level is written as `margin-left:40px;` on the block, so the
// step is part of the contract: changing it rewrites every indented document.
// A value that is not a multiple of the step is quantized to the nearest level
// on load, and level 0 is not serialized at all.
export const INDENT_STEP = 40;
export const INDENT_UNIT = "px";
export const MAX_INDENT = 10;

// Blocks that can be indented. Cells are not among them: indenting inside a
// table is done on the paragraph, not on the cell.
export const INDENTABLE_TAGS: string[] = ["P", "H2", "H3", "H4", "LI"];

// Property order inside a block's style attribute. Like the span's, it defines
// how the element serializes, so it is part of the contract.
export const BLOCK_STYLE_ORDER: string[] = ["text-align", "margin-left"];

/** Panels a toolbar dropdown can open. */
export type ToolbarPanel =
  | "alignment"
  | "heading"
  | "fontFamily"
  | "fontSize"
  | "fontColor"
  | "table";

export type ToolbarSeparator = "|";

export interface ToolbarButtonItem {
  name: string;
  type: "button";
  icon: IconName;
  label: string;
  toggle?: boolean;
}

export interface ToolbarDropdownItem {
  name: string;
  type: "dropdown";
  panel: ToolbarPanel;
  label: string;
  icon?: IconName;
  wide?: boolean;
}

export type ToolbarItem = ToolbarSeparator | ToolbarButtonItem | ToolbarDropdownItem;

// `toggle` marks the two-state buttons: those are the ones that get aria-pressed.
export const TOOLBAR_ITEMS: ToolbarItem[] = [
  { name: "undo", type: "button", icon: "undo", label: "undo" },
  { name: "redo", type: "button", icon: "redo", label: "redo" },
  "|",
  { name: "alignment", type: "dropdown", panel: "alignment", label: "alignment" },
  "|",
  { name: "heading", type: "dropdown", panel: "heading", label: "heading", wide: true },
  "|",
  {
    name: "bold",
    type: "button",
    toggle: true,
    icon: "bold",
    label: "bold",
  },
  {
    name: "italic",
    type: "button",
    toggle: true,
    icon: "italic",
    label: "italic",
  },
  {
    name: "underline",
    type: "button",
    toggle: true,
    icon: "underline",
    label: "underline",
  },
  "|",
  {
    name: "fontFamily",
    type: "dropdown",
    panel: "fontFamily",
    label: "fontFamily",
    icon: "fontFamily",
    wide: true,
  },
  {
    name: "fontSize",
    type: "dropdown",
    panel: "fontSize",
    label: "fontSize",
    icon: "fontSize",
    wide: true,
  },
  {
    name: "fontColor",
    type: "dropdown",
    panel: "fontColor",
    label: "fontColor",
    icon: "palette",
  },
  "|",
  {
    name: "insertTable",
    type: "dropdown",
    panel: "table",
    label: "insertTable",
    icon: "table",
  },
  "|",
  {
    name: "link",
    type: "button",
    toggle: true,
    icon: "link",
    label: "link",
  },
  "|",
  {
    name: "numberedList",
    type: "button",
    toggle: true,
    icon: "numberedList",
    label: "numberedList",
  },
  {
    name: "bulletedList",
    type: "button",
    toggle: true,
    icon: "bulletedList",
    label: "bulletedList",
  },
  {
    name: "indent",
    type: "button",
    icon: "indent",
    label: "indent",
  },
  {
    name: "outdent",
    type: "button",
    icon: "outdent",
    label: "outdent",
  },
];

// Marks a <br> that only exists to give an empty line its height while editing.
export const FILLER_ATTR = "data-fa-filler";

export const DEFAULT_PROTOCOL = "http://";

export const EXTERNAL_LINK_RE = /^(https?:)?\/\//i;
