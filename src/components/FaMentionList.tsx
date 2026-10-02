import { useEffect, useRef } from "react";

interface Props {
  items: string[];
  active: number;
  onSelect: (item: string) => void;
  onActivate: (index: number) => void;
}

export default function FaMentionList({
  items,
  active,
  onSelect,
  onActivate,
}: Props) {
  const list = useRef<HTMLUListElement>(null);

  // Keyboard navigation can move the active item out of the scrolled view.
  useEffect(() => {
    const el = list.current?.querySelector(".fa-wysiwyg-mentions__item--on");
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <ul ref={list} className="fa-wysiwyg-mentions">
      {items.map((item, index) => (
        <li key={item}>
          <button
            type="button"
            className={[
              "fa-wysiwyg-mentions__item",
              index === active && "fa-wysiwyg-mentions__item--on",
            ]
              .filter(Boolean)
              .join(" ")}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => onActivate(index)}
            onClick={() => onSelect(item)}
          >
            {item}
          </button>
        </li>
      ))}
    </ul>
  );
}
