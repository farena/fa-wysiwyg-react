import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import FaIcon from "./FaIcon";
import { positionPanel } from "../core/position";

interface Props {
  title?: string;
  label?: string | null;
  icon?: string;
  wide?: boolean;
  active?: boolean;
  disabled?: boolean;
  /** Renders the panel content; `close` hides the panel. */
  children: (close: () => void) => ReactNode;
}

export default function FaDropdown({
  title,
  label,
  icon,
  wide = false,
  active = false,
  disabled = false,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  const toggle = () => {
    if (disabled) return;
    setOpen((value) => !value);
  };

  /**
   * A click inside the panel must not steal the selection from the editable,
   * but `preventDefault` on mousedown also cancels focus: over a text field
   * (the color picker's hex input) that would make it unusable.
   */
  const onPanelMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    if (target.closest("input, textarea, select, [contenteditable]")) return;
    event.preventDefault();
  };

  const reposition = useCallback(() => {
    if (!trigger.current || !panel.current) return;
    const { top, left } = positionPanel(
      trigger.current.getBoundingClientRect(),
      panel.current,
      { margin: 2 },
    );
    setPanelStyle({ top: `${top}px`, left: `${left}px` });
  }, []);

  // Placed before the first paint, so the panel never flashes at 0,0.
  useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;

    const onOutside = (event: Event) => {
      const target = event.target as Node;
      if (panel.current && panel.current.contains(target)) return;
      if (trigger.current && trigger.current.contains(target)) return;
      setOpen(false);
    };
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };

    // Scroll is listened for on capture so a modal's own scroll is seen too.
    document.addEventListener("mousedown", onOutside, true);
    document.addEventListener("keydown", onKeydown, true);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("mousedown", onOutside, true);
      document.removeEventListener("keydown", onKeydown, true);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, reposition]);

  // A trigger disabled while open (the editor got disabled) closes its panel.
  if (open && disabled) setOpen(false);

  return (
    <div className="fa-wysiwyg__dropdown">
      <button
        ref={trigger}
        type="button"
        className={[
          "fa-wysiwyg__btn",
          "fa-wysiwyg__btn--dropdown",
          (open || active) && "fa-wysiwyg__btn--on",
        ]
          .filter(Boolean)
          .join(" ")}
        title={title}
        aria-label={title}
        aria-expanded={open ? "true" : "false"}
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={toggle}
      >
        <FaIcon name={icon} />
        {label && <span className="fa-wysiwyg__btn-label">{label}</span>}
        <FaIcon name="caret" className="fa-wysiwyg__caret" />
      </button>

      {open &&
        createPortal(
          <div
            ref={panel}
            className={[
              "fa-wysiwyg-panel",
              wide && "fa-wysiwyg-panel--wide",
            ]
              .filter(Boolean)
              .join(" ")}
            style={panelStyle ?? undefined}
            onMouseDown={onPanelMouseDown}
          >
            {children(close)}
          </div>,
          document.body,
        )}
    </div>
  );
}
