// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => void;

/** A debounced function: same signature as the original, plus `cancel` and `flush`. */
export type Debounced<F extends AnyFn> = ((this: ThisParameterType<F>, ...args: Parameters<F>) => void) & {
  cancel: () => void;
  flush: () => void;
};

/**
 * In-house debounce. It exists so the editor ships with zero dependencies.
 *
 * - `leading: false` (default): fires once, `wait` ms after the last call.
 * - `leading: true`: fires on the first call of a burst as well, and again at
 *   the end only if there was more than one call. This is what the v-model
 *   needs: the first character typed has to be emitted right away.
 *
 * `cancel()` drops the pending call; use it in `beforeUnmount` so a destroyed
 * component is never touched.
 *
 * @param {Function} fn
 * @param {number} wait milliseconds
 * @param {{ leading?: boolean }} [options]
 * @returns {Function & { cancel: () => void, flush: () => void }}
 */
export default function debounce<F extends AnyFn>(
  fn: F,
  wait: number,
  { leading = false }: { leading?: boolean } = {},
): Debounced<F> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: Parameters<F> | null = null;
  let pendingThis: ThisParameterType<F> | null = null;

  const invoke = () => {
    const args = pendingArgs;
    const context = pendingThis;
    pendingArgs = null;
    pendingThis = null;
    fn.apply(context, args || []);
  };

  function debounced(this: ThisParameterType<F>, ...args: Parameters<F>) {
    const isFirst = timer === null;

    pendingArgs = args;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    pendingThis = this;

    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      // With `leading`, the opening call already ran: only repeat when the
      // burst closes if there was at least one call after it.
      if (pendingArgs !== null) invoke();
    }, wait);

    if (leading && isFirst) invoke();
  }

  debounced.cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    pendingArgs = null;
    pendingThis = null;
  };

  debounced.flush = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
    if (pendingArgs !== null) invoke();
  };

  return debounced;
}
