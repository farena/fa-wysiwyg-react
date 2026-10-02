import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from "react";
import FaToolbar from "./FaToolbar";
import FaBalloon from "./FaBalloon";
import FaLinkBalloon from "./FaLinkBalloon";
import FaTableBalloon from "./FaTableBalloon";
import FaMentionList from "./FaMentionList";
import FaWysiwygController from "./controller";
import { TranslatorContext } from "./translator";
import { translator, DEFAULT_LANG } from "../core/lang";

/** What a `ref` on <FaWysiwyg> exposes. */
export interface FaWysiwygHandle {
  /** Focuses the editable and drops the caret at the end of the content. */
  focus: () => void;
  /** The current HTML, serialized to the contract, without waiting for onChange. */
  getData: () => string;
}

export interface FaWysiwygProps {
  /** HTML in the editor's contract. */
  value?: string;
  /** Called with the serialized HTML, debounced while typing. */
  onChange?: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Mention feed: only the entries starting with `#` are offered. */
  autocompleteOpts?: string[] | null;
  /** Interface language: a code from `LANGS`. Unknown codes fall back to English. */
  lang?: string;
  className?: string;
  onFocus?: (event: FocusEvent) => void;
  onBlur?: (event: FocusEvent) => void;
  ref?: Ref<FaWysiwygHandle>;
}

export default function FaWysiwyg({
  value = "",
  onChange,
  placeholder,
  disabled = false,
  autocompleteOpts = null,
  lang = DEFAULT_LANG,
  className,
  onFocus,
  onBlur,
  ref,
}: FaWysiwygProps) {
  const [controller] = useState(() => new FaWysiwygController());
  const [view, setView] = useState(controller.view);
  const content = useRef<HTMLDivElement>(null);

  // Declared first so the controller already sees the current props when the
  // mount effect below runs.
  useLayoutEffect(() => {
    controller.setProps({ disabled, autocompleteOpts, onChange, onFocus, onBlur });
  });

  useLayoutEffect(() => {
    controller.attach(content.current!, value, setView);
    return () => controller.detach();
    // The initial value only: later changes go through `receive` below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller]);

  useEffect(() => {
    controller.receive(value);
  }, [controller, value]);

  useEffect(() => {
    if (disabled) controller.closeAllBalloons();
  }, [controller, disabled]);

  useImperativeHandle(
    ref,
    () => ({ focus: controller.focus, getData: controller.getData }),
    [controller],
  );

  /**
   * The lookup handed down to the toolbar, the panels and the balloons.
   * Changing `lang` re-renders every label, including the ones portaled to
   * <body>.
   */
  const t = useMemo(() => translator(lang), [lang]);

  const showPlaceholder = view.empty && !!placeholder;

  const rootClasses = [
    "fa-wysiwyg",
    view.focused && "fa-wysiwyg--focused",
    disabled && "fa-wysiwyg--disabled",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <TranslatorContext.Provider value={t}>
      <div className={rootClasses}>
        <FaToolbar
          state={view.state}
          canUndo={view.canUndo}
          canRedo={view.canRedo}
          disabled={disabled}
          onCommand={controller.onCommand}
        />

        {/* React renders this element empty and never reconciles its
            children: the content belongs to the controller. */}
        <div
          ref={content}
          className={[
            "fa-wysiwyg__content",
            showPlaceholder && "fa-wysiwyg__content--empty",
          ]
            .filter(Boolean)
            .join(" ")}
          contentEditable={!disabled}
          suppressContentEditableWarning
          data-placeholder={placeholder || ""}
          style={
            {
              "--fa-wysiwyg-placeholder": JSON.stringify(placeholder || ""),
            } as CSSProperties
          }
          role="textbox"
          aria-multiline="true"
          onInput={(event) => controller.onInput(event.nativeEvent as InputEvent)}
          onKeyDown={(event) => controller.onKeydown(event.nativeEvent)}
          onPaste={(event) => controller.onPaste(event.nativeEvent)}
          onDrop={(event) => event.preventDefault()}
          onFocus={(event) => controller.onFocus(event.nativeEvent)}
          onBlur={(event) => controller.onBlur(event.nativeEvent)}
          onClick={(event) => controller.onClick(event.nativeEvent)}
          onCompositionStart={controller.onCompositionStart}
          onCompositionEnd={controller.onCompositionEnd}
        />

        {view.linkOpen && (
          <FaBalloon anchor={controller.linkRect}>
            <FaLinkBalloon
              value={view.linkHref}
              initialEditing={view.linkEditing}
              onSave={controller.saveLink}
              onUnlink={controller.removeLink}
              onCancel={controller.closeLinkBalloon}
            />
          </FaBalloon>
        )}

        {view.tableOpen && (
          <FaBalloon anchor={controller.tableRect} prefer="north">
            <FaTableBalloon onCommand={controller.onTableCommand} />
          </FaBalloon>
        )}

        {view.mentionOpen && (
          <FaBalloon anchor={controller.mentionRect}>
            <FaMentionList
              items={view.mentionItems}
              active={view.mentionActive}
              onSelect={controller.applyMention}
              onActivate={controller.activateMention}
            />
          </FaBalloon>
        )}
      </div>
    </TranslatorContext.Provider>
  );
}
