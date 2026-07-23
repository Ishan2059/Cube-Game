/* Real touch-capability check — not a viewport-width guess. A narrow window
 * on desktop (resized browser, devtools device toolbar) must not count as
 * "mobile"; only an actual touch digitizer should. */
export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ie = navigator as unknown as { msMaxTouchPoints?: number };
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    (ie.msMaxTouchPoints ?? 0) > 0
  );
}
