"use client";

import { useRef, type PointerEvent } from "react";

const MIN_DISTANCE = 40;

/**
 * Horizontal swipe for sliders. Spread `handlers` on the element (give it `touch-pan-y`
 * so vertical scrolling still works). `swiped()` tells a click handler that the click
 * ended a swipe and should be ignored.
 */
export function useSwipe(onPrevious: () => void, onNext: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const didSwipe = useRef(false);

  return {
    swiped: () => didSwipe.current,
    handlers: {
      onPointerDown(event: PointerEvent) {
        start.current = { x: event.clientX, y: event.clientY };
        didSwipe.current = false;
      },
      onPointerUp(event: PointerEvent) {
        const from = start.current;
        start.current = null;
        if (!from) return;
        const dx = event.clientX - from.x;
        const dy = event.clientY - from.y;
        if (Math.abs(dx) >= MIN_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.5) {
          didSwipe.current = true;
          if (dx < 0) onNext();
          else onPrevious();
        }
      },
      onPointerCancel() {
        start.current = null;
      },
    },
  };
}
