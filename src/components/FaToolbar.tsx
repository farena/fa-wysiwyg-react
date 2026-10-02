import type { CSSProperties, ElementType } from "react";
import FaIcon from "./FaIcon";
import FaDropdown from "./FaDropdown";
import FaColorGrid from "./FaColorGrid";
import FaTableGrid from "./FaTableGrid";
import { useTranslator } from "./translator";
import {
  TOOLBAR_ITEMS,
  HEADINGS,
  ALIGNMENTS,
  FONT_FAMILIES,
  FONT_SIZES,
} from "../core/constants";
import type { EditorState } from "../core/state";

export type CommandHandler = (name: string, value?: unknown) => void;

interface Props {
  state: EditorState;
  canUndo: boolean;
  canRedo: boolean;
  disabled: boolean;
  onCommand: CommandHandler;
}

type ToolbarItem = (typeof TOOLBAR_ITEMS)[number];
type DropdownItem = Exclude<ToolbarItem, "|"> & { panel?: string; wide?: boolean };

interface Option {
  key: string;
  value: string | null;
  title: string;
  tag?: ElementType;
  icon?: string;
  style?: CSSProperties;
  on: boolean;
}

interface Titled {
  label?: string;
  title?: string;
}

// A 'mixed' value stands for no concrete state, so nothing is highlighted.
const asValue = (value: unknown) =>
  value === "mixed" ? null : ((value as string | null | undefined) ?? null);

export default function FaToolbar({
  state,
  canUndo,
  canRedo,
  disabled,
  onCommand,
}: Props) {
  const t = useTranslator();

  const isOn = (name: string) => {
    const map: Record<string, unknown> = {
      bold: state.bold,
      italic: state.italic,
      underline: state.underline,
      link: !!state.link,
      bulletedList: state.list === "ul",
      numberedList: state.list === "ol",
    };
    return !!map[name];
  };

  const isDisabled = (name: string) => {
    if (disabled) return true;
    if (name === "undo") return !canUndo;
    if (name === "redo") return !canRedo;
    // A mixed selection always has somewhere to go: some block in it is off
    // the limit the button would hit. An item that is the first of its list
    // cannot be indented at all — there is no item above to nest it into.
    if (name === "indent") return !state.canIndent;
    if (name === "outdent") return !state.canOutdent;
    return false;
  };

  // Font family names are proper nouns and carry a literal title; everything
  // else names a key in the language file.
  const titleOf = (option: Titled) =>
    option.label ? t(option.label) : (option.title ?? "");

  // The alignment button shows the icon of the current alignment.
  const iconFor = (item: DropdownItem) => {
    if (item.panel !== "alignment") return item.icon;
    const current = ALIGNMENTS.find((a) => a.model === asValue(state.align));
    return (current || ALIGNMENTS[0]).icon;
  };

  // Only the heading dropdown shows its current value as a label; font family
  // and font size are icon-only triggers and carry theirs in the tooltip.
  const labelFor = (item: DropdownItem) => {
    if (item.panel !== "heading") return null;
    const current = HEADINGS.find((h) => h.model === asValue(state.blockTag));
    // With no recognized block, the paragraph option is the one shown.
    return titleOf(current || HEADINGS[0]);
  };

  const titleFor = (item: DropdownItem) => {
    const label = t(item.label);
    const panel = item.panel as "fontFamily" | "fontSize";
    const options = { fontFamily: FONT_FAMILIES, fontSize: FONT_SIZES }[panel] as
      | { model: string | null; label?: string; title?: string }[]
      | undefined;
    if (!options) return label;
    const current = options.find((o) => o.model === asValue(state[panel]));
    return `${label}: ${current ? titleOf(current) : t("defaultOption")}`;
  };

  const optionsFor = (panel?: string): Option[] => {
    if (panel === "heading") {
      return HEADINGS.map((option) => ({
        key: option.model,
        value: option.model,
        title: titleOf(option),
        // Each option previews itself in its own typeface.
        tag: (option.model === "p" ? "span" : option.model) as ElementType,
        on: option.model === asValue(state.blockTag),
      }));
    }
    if (panel === "alignment") {
      return ALIGNMENTS.map((option) => ({
        key: option.model,
        value: option.model,
        title: titleOf(option),
        icon: option.icon,
        on: option.model === asValue(state.align),
      }));
    }
    if (panel === "fontFamily") {
      return FONT_FAMILIES.map((option) => ({
        key: option.model || "default",
        value: option.model,
        title: titleOf(option),
        style: option.model ? { fontFamily: option.model } : undefined,
        on: option.model === asValue(state.fontFamily),
      }));
    }
    if (panel === "fontSize") {
      return FONT_SIZES.map((option) => ({
        key: option.model || "default",
        value: option.model,
        title: titleOf(option),
        style: { fontSize: option.preview },
        on: option.model === asValue(state.fontSize),
      }));
    }
    return [];
  };

  const run = (name: string, value: unknown, close: () => void) => {
    close();
    onCommand(name, value);
  };

  return (
    <div className="fa-wysiwyg__toolbar" role="toolbar">
      {TOOLBAR_ITEMS.map((entry, index) => {
        if (entry === "|") {
          return <span key={`sep-${index}`} className="fa-wysiwyg__separator" />;
        }

        const item = entry as DropdownItem;

        if (item.type === "button") {
          const label = t(item.label);
          return (
            <button
              key={item.name}
              type="button"
              className={[
                "fa-wysiwyg__btn",
                isOn(item.name) && "fa-wysiwyg__btn--on",
              ]
                .filter(Boolean)
                .join(" ")}
              title={label}
              aria-label={label}
              aria-pressed={
                "toggle" in item && item.toggle ? isOn(item.name) : undefined
              }
              disabled={isDisabled(item.name)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onCommand(item.name)}
            >
              <FaIcon name={item.icon} />
            </button>
          );
        }

        return (
          <FaDropdown
            key={item.name}
            title={titleFor(item)}
            icon={iconFor(item)}
            label={labelFor(item)}
            wide={item.wide}
            disabled={disabled}
          >
            {(close) => {
              if (item.panel === "fontColor") {
                return (
                  <FaColorGrid
                    value={asValue(state.fontColor)}
                    onSelect={(color) => run("fontColor", color, close)}
                  />
                );
              }
              if (item.panel === "table") {
                return (
                  <FaTableGrid
                    onSelect={(size) => run("insertTable", size, close)}
                  />
                );
              }
              return (
                <ul className="fa-wysiwyg-panel__list">
                  {optionsFor(item.panel).map((option) => {
                    const Tag = option.tag || "span";
                    return (
                      <li key={option.key}>
                        <button
                          type="button"
                          className={[
                            "fa-wysiwyg-panel__item",
                            option.on && "fa-wysiwyg-panel__item--on",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          style={option.style}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => run(item.name, option.value, close)}
                        >
                          {option.icon && <FaIcon name={option.icon} />}
                          <Tag className="fa-wysiwyg-panel__item-text">
                            {option.title}
                          </Tag>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              );
            }}
          </FaDropdown>
        );
      })}
    </div>
  );
}
