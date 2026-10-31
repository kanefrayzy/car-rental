"use client";

import { useEffectEvent, useLayoutEffect } from "react";

/**
 * Runs `reset` whenever the page a form is on stops being the live one, so a spinner or a
 * "sending" state never survives the browser's Back button (bug of 2026-10-31: the hero's
 * "Checking…" came back after Back from the booking page, and nothing could be sent again):
 *
 * - Next hides the page on navigation (with cacheComponents it keeps the last pages alive in
 *   React's <Activity> and shows them again on Back, state and all): hiding runs layout effect
 *   cleanups, and so does a real unmount;
 * - the browser restores the whole document from the back-forward cache (pageshow with
 *   `persisted`), frozen as it was when the visitor left.
 *
 * `reset` should abort what is in flight and put loading flags back to rest. It may run more
 * than once.
 */
export function useResetOnLeave(reset: () => void) {
  const onLeave = useEffectEvent(reset);
  useLayoutEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) onLeave();
    };
    window.addEventListener("pageshow", onShow);
    return () => {
      window.removeEventListener("pageshow", onShow);
      onLeave();
    };
  }, []);
}
