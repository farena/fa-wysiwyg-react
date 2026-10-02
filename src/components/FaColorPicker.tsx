import { useEffect, useRef, useState, type CSSProperties } from "react";
import FaIcon from "./FaIcon";
import { useTranslator } from "./translator";
import { formatHsl, hexToHsv, hsvToHex, parseColor } from "../core/color";

interface Hsv {
  h: number;
  s: number;
  v: number;
}

interface Props {
  // The text's current color, in whatever format it happens to be stored.
  value?: string | null;
  onAccept: (color: string) => void;
  onCancel: () => void;
}

const DEFAULT_HSV: Hsv = { h: 0, s: 0, v: 0 };

export default function FaColorPicker({ value = null, onAccept, onCancel }: Props) {
  const t = useTranslator();
  const [hsv, setHsv] = useState<Hsv>(() => parseColor(value) || { ...DEFAULT_HSV });
  const [hex, setHex] = useState(() => hsvToHex(hsv));
  const area = useRef<HTMLDivElement>(null);
  const hueBar = useRef<HTMLDivElement>(null);
  const dragging = useRef<"area" | "hue" | null>(null);

  const hue = Math.round(hsv.h);
  const preview = `#${hsvToHex(hsv)}`;

  const applyPointer = (event: { clientX: number; clientY: number }) => {
    const element = dragging.current === "hue" ? hueBar.current : area.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));

    let next: Hsv;
    if (dragging.current === "hue") {
      next = { ...hsv, h: x * 360 };
    } else {
      const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
      next = { ...hsv, s: x, v: 1 - y };
    }
    setHsv(next);
    setHex(hsvToHex(next));
  };

  // The document listeners are bound once and read the latest handler here.
  const latestApply = useRef(applyPointer);
  useEffect(() => {
    latestApply.current = applyPointer;
  });

  useEffect(() => {
    // Pointer events are captured at document level: dragging outside the
    // panel has to keep moving the handle, as in any color picker.
    const onMove = (event: PointerEvent) => {
      if (!dragging.current) return;
      event.preventDefault();
      latestApply.current(event);
    };
    const onUp = () => {
      dragging.current = null;
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const onHexInput = (next: string) => {
    setHex(next);
    // Typed without the `#`. While the value is incomplete the handle is
    // left alone: it only syncs once the hex parses.
    const parsed = hexToHsv(next);
    if (parsed) setHsv(parsed);
  };

  const accept = () => {
    const parsed = hexToHsv(hex);
    const final = parsed || hsv;
    if (parsed) setHsv(parsed);
    onAccept(formatHsl(final));
  };

  return (
    <div className="fa-wysiwyg-color-picker">
      <div
        ref={area}
        className="fa-wysiwyg-color-picker__area"
        style={{ "--fa-wysiwyg-picker-hue": hue } as CSSProperties}
        onPointerDown={(event) => {
          dragging.current = "area";
          applyPointer(event);
        }}
      >
        <span
          className="fa-wysiwyg-color-picker__pointer"
          style={{
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
            background: preview,
          }}
        />
      </div>

      <div
        ref={hueBar}
        className="fa-wysiwyg-color-picker__hue"
        onPointerDown={(event) => {
          dragging.current = "hue";
          applyPointer(event);
        }}
      >
        <span
          className="fa-wysiwyg-color-picker__pointer"
          style={{
            left: `${(hsv.h / 360) * 100}%`,
            background: `hsl(${hue}, 100%, 50%)`,
          }}
        />
      </div>

      <div className="fa-wysiwyg-color-picker__row">
        <span className="fa-wysiwyg-color-picker__hash">#</span>
        <input
          value={hex}
          type="text"
          className="fa-wysiwyg-color-picker__input"
          maxLength={6}
          spellCheck={false}
          autoComplete="off"
          placeholder={t("hex")}
          aria-label={t("hex")}
          onChange={(event) => onHexInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              accept();
            } else if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
            }
          }}
        />
      </div>

      <div className="fa-wysiwyg-color-picker__actions">
        <button
          type="button"
          className="fa-wysiwyg__btn fa-wysiwyg-color-picker__accept"
          title={t("accept")}
          aria-label={t("accept")}
          onMouseDown={(event) => event.preventDefault()}
          onClick={accept}
        >
          <FaIcon name="check" />
        </button>
        <button
          type="button"
          className="fa-wysiwyg__btn fa-wysiwyg-color-picker__cancel"
          title={t("cancel")}
          aria-label={t("cancel")}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onCancel}
        >
          <FaIcon name="close" />
        </button>
      </div>
    </div>
  );
}
