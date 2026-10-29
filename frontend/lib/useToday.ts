"use client";

import { useSyncExternalStore } from "react";
import { businessNow } from "./time";
import type { IsoDate } from "./validation";

// Re-read the clock every 30 seconds, so a time slot that passes while the form is open
// becomes unavailable.
const subscribe = (onChange: () => void) => {
  const timer = setInterval(onChange, 30_000);
  return () => clearInterval(timer);
};

// A string snapshot: equal values compare equal, so React re-renders only when the minute changes.
const snapshot = () => {
  const { date, minutes } = businessNow();
  return `${date}|${minutes}`;
};

/**
 * Today's date and the minutes past midnight in New York (the business's time, whatever the
 * visitor's time zone), or null during server render and hydration: reading the clock in
 * render would bake the build time into the static HTML.
 */
export function useBusinessNow(): { date: IsoDate; minutes: number } | null {
  const value = useSyncExternalStore(subscribe, snapshot, () => "");
  if (!value) return null;
  const [date, minutes] = value.split("|");
  return { date, minutes: Number(minutes) };
}

/** Today's date in New York, or "" during server render and hydration. */
export function useToday(): IsoDate {
  return useBusinessNow()?.date ?? "";
}
