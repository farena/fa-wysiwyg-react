import { useEffect, useRef, useState, type MouseEvent } from "react";
import FaIcon from "./FaIcon";
import { useTranslator } from "./translator";

interface Props {
  value?: string;
  // `true` opens the form directly; `false` shows the link preview.
  initialEditing?: boolean;
  onSave: (href: string) => void;
  onUnlink: () => void;
  onCancel: () => void;
}

export default function FaLinkBalloon({
  value = "",
  initialEditing = false,
  onSave,
  onUnlink,
  onCancel,
}: Props) {
  const t = useTranslator();
  const [editing, setEditing] = useState(initialEditing);
  const [href, setHref] = useState(value);
  const input = useRef<HTMLInputElement>(null);

  // The props win whenever they change: a different link under the caret
  // resets the form, and the parent can switch the balloon into edit mode.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setHref(value);
  }
  const [prevEditing, setPrevEditing] = useState(initialEditing);
  if (initialEditing !== prevEditing) {
    setPrevEditing(initialEditing);
    setEditing(initialEditing);
  }

  useEffect(() => {
    if (!editing) return;
    const el = input.current;
    if (!el) return;

    el.focus();
    el.select();
    // The balloon starts hidden until it is positioned, and a hidden element
    // cannot take focus. This effect can land in exactly that window: retry
    // on the next frame, with the balloon visible.
    if (document.activeElement !== el) {
      const frame = requestAnimationFrame(() => {
        el.focus();
        el.select();
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [editing]);

  const submit = () => {
    const trimmed = href.trim();
    if (!trimmed) return;
    onSave(trimmed);
  };

  const preventMouseDown = (event: MouseEvent) => event.preventDefault();

  if (editing) {
    return (
      <div className="fa-wysiwyg-link">
        <div className="fa-wysiwyg-link__form">
          <input
            ref={input}
            value={href}
            type="url"
            className="fa-wysiwyg-link__input"
            placeholder={t("linkPlaceholder")}
            onChange={(event) => setHref(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              } else if (event.key === "Escape") {
                event.preventDefault();
                onCancel();
              }
            }}
          />
          <div className="fa-wysiwyg-link__actions">
            <button
              type="button"
              className="fa-wysiwyg__btn"
              title={t("save")}
              disabled={!href.trim()}
              onMouseDown={preventMouseDown}
              onClick={submit}
            >
              <FaIcon name="check" />
            </button>
            <button
              type="button"
              className="fa-wysiwyg__btn"
              title={t("cancel")}
              onMouseDown={preventMouseDown}
              onClick={onCancel}
            >
              <FaIcon name="close" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fa-wysiwyg-link">
      <a
        className="fa-wysiwyg-link__preview"
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        title={value}
      >
        {value}
      </a>
      <button
        type="button"
        className="fa-wysiwyg__btn"
        title={t("editLink")}
        onMouseDown={preventMouseDown}
        onClick={() => setEditing(true)}
      >
        <FaIcon name="edit" />
      </button>
      <button
        type="button"
        className="fa-wysiwyg__btn"
        title={t("unlink")}
        onMouseDown={preventMouseDown}
        onClick={onUnlink}
      >
        <FaIcon name="unlink" />
      </button>
    </div>
  );
}
