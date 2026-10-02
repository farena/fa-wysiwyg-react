import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { positionPanel } from "../core/position";

interface Props {
  /**
   * Returns the viewport rect to anchor to, or null to hide.
   * It is a function and not a fixed rect because the anchor moves: when the
   * container scrolls (a modal, say) its position has to be read again.
   */
  anchor: () => DOMRect | null;
  prefer?: "south" | "north";
  children: ReactNode;
}

type BalloonStyle = CSSProperties & {
  "--fa-wysiwyg-arrow-left"?: string;
};

const same = (a: BalloonStyle | null, b: BalloonStyle) =>
  !!a &&
  a.top === b.top &&
  a.left === b.left &&
  a["--fa-wysiwyg-arrow-left"] === b["--fa-wysiwyg-arrow-left"];

export default function FaBalloon({
  anchor,
  prefer = "south",
  children,
}: Props) {
  const [placement, setPlacement] = useState<string>(prefer);
  const [hidden, setHidden] = useState(true);
  const [style, setStyle] = useState<BalloonStyle | null>(null);
  const balloon = useRef<HTMLDivElement>(null);

  /**
   * A click inside the balloon must not steal the selection from the
   * editable: without a selection, commands have nothing to act on.
   *
   * Text fields are the exception. `preventDefault` on mousedown also cancels
   * focus, so over an <input> this rule would make it unusable: the link form
   * would open but refuse to accept typing.
   */
  const onMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    if (target.closest("input, textarea, select, [contenteditable]")) return;
    event.preventDefault();
  };

  const reposition = () => {
    const el = balloon.current;
    if (!el) return;

    const rect = anchor();
    if (!rect) {
      setHidden(true);
      return;
    }

    const pos = positionPanel(rect, el, { prefer });
    const next: BalloonStyle = {
      top: `${pos.top}px`,
      left: `${pos.left}px`,
      "--fa-wysiwyg-arrow-left": `${pos.arrowLeft}px`,
    };

    // This runs again after every render. Writing a fresh object every time
    // would re-render forever, so only real movement is written.
    setHidden(false);
    setPlacement(pos.placement);
    setStyle((current) => (same(current, next) ? current : next));
  };

  // The scroll and resize listeners are bound once, so they read the latest
  // `reposition` (and with it the latest `anchor`) through a ref.
  const latest = useRef(reposition);
  useLayoutEffect(() => {
    latest.current = reposition;
  });

  // After every render, like Vue's `updated`: the content of the balloon can
  // change its size, and the anchor can have moved with it.
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reposition();
  });

  useEffect(() => {
    const onMove = () => latest.current();
    // Capture phase: scroll does not bubble, but it does travel down on
    // capture. That is what makes the balloon follow content inside a modal.
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, []);

  return createPortal(
    <div
      ref={balloon}
      className={`fa-wysiwyg-balloon fa-wysiwyg-balloon--${placement}`}
      style={{ ...style, display: hidden ? "none" : undefined }}
      onMouseDown={onMouseDown}
    >
      {children}
    </div>,
    document.body,
  );
}
