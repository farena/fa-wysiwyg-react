const MARGIN = 8;

/**
 * Positions a floating panel against a viewport rect.
 *
 * Everything is `position: fixed`, so the coordinates are viewport coordinates
 * directly: no offsetParent math, no compensating for scrollable ancestors.
 * That is what makes the balloons work inside a modal.
 */
export function positionPanel(
  targetRect: DOMRect,
  panelEl: HTMLElement,
  { prefer = "south", margin = MARGIN } = {},
) {
  const panel = panelEl.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;

  const southTop = targetRect.bottom + margin;
  const northTop = targetRect.top - panel.height - margin;

  let placement = prefer;
  if (
    placement === "south" &&
    southTop + panel.height > viewportHeight &&
    northTop >= 0
  ) {
    placement = "north";
  } else if (
    placement === "north" &&
    northTop < 0 &&
    southTop + panel.height <= viewportHeight
  ) {
    placement = "south";
  }

  const top = placement === "south" ? southTop : northTop;
  const centered = targetRect.left + targetRect.width / 2 - panel.width / 2;
  const left = Math.max(
    margin,
    Math.min(centered, viewportWidth - panel.width - margin),
  );

  return {
    top: Math.round(top),
    left: Math.round(left),
    placement,
    arrowLeft: Math.round(targetRect.left + targetRect.width / 2 - left),
  };
}

// True once the anchor has scrolled out of the editor's visible area.
export function isOutOfView(targetRect: DOMRect, containerRect: DOMRect) {
  return (
    targetRect.bottom < containerRect.top ||
    targetRect.top > containerRect.bottom ||
    targetRect.right < containerRect.left ||
    targetRect.left > containerRect.right
  );
}
