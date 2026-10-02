import { ICONS } from "../core/icons";

interface Props {
  name?: string | null;
  className?: string;
}

/**
 * Draws one of the inlined icons. Buttons always carry their own `title` and
 * `aria-label`, so the glyph itself is decorative: `aria-hidden` keeps it out
 * of the accessibility tree, and `focusable="false"` keeps old Edge from
 * putting it in the tab order.
 */
export default function FaIcon({ name, className }: Props) {
  const icon = name ? ICONS[name as keyof typeof ICONS] : null;
  if (!icon) return null;

  return (
    <svg
      className={["fa-wysiwyg__icon", className].filter(Boolean).join(" ")}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={icon.box}
      aria-hidden="true"
      focusable="false"
    >
      <path d={icon.path} />
    </svg>
  );
}
