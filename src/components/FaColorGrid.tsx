import { useState, type CSSProperties } from "react";
import FaIcon from "./FaIcon";
import FaColorPicker from "./FaColorPicker";
import { useTranslator } from "./translator";
import { COLORS, COLOR_COLUMNS } from "../core/constants";

interface Props {
  value?: string | null;
  onSelect: (color: string | null) => void;
}

export default function FaColorGrid({ value = null, onSelect }: Props) {
  const t = useTranslator();
  const [picking, setPicking] = useState(false);

  return (
    <div className="fa-wysiwyg-color-grid">
      {picking ? (
        <FaColorPicker
          value={value}
          onAccept={onSelect}
          onCancel={() => setPicking(false)}
        />
      ) : (
        <>
          <button
            type="button"
            className="fa-wysiwyg-color-grid__remove"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSelect(null)}
          >
            <FaIcon name="close" />
            <span>{t("removeColor")}</span>
          </button>
          <div
            className="fa-wysiwyg-color-grid__grid"
            style={{ "--fa-wysiwyg-color-columns": COLOR_COLUMNS } as CSSProperties}
          >
            {COLORS.map((item) => (
              <button
                key={item.color}
                type="button"
                className={[
                  "fa-wysiwyg-color-grid__swatch",
                  item.hasBorder && "fa-wysiwyg-color-grid__swatch--bordered",
                  item.color === value && "fa-wysiwyg-color-grid__swatch--on",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ background: item.color }}
                title={t(item.label)}
                aria-label={t(item.label)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onSelect(item.color)}
              />
            ))}
          </div>
          <button
            type="button"
            className="fa-wysiwyg-color-grid__more"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setPicking(true)}
          >
            <FaIcon name="palette" />
            <span>{t("colorPicker")}</span>
          </button>
        </>
      )}
    </div>
  );
}
