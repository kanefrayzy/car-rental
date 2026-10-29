"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { ANALYTICS_ON, setAnalyticsOptOut } from "@/lib/analytics";

/**
 * The cookie notice shown on a visitor's first visit (user, 2026-10-18: "like on every other
 * site"). With Google Analytics or Microsoft Clarity on (NEXT_PUBLIC_GA_ID, NEXT_PUBLIC_CLARITY_ID)
 * it offers Decline, which turns both off for this browser; analytics runs until then (opt-out, as the
 * privacy page says). Without an ID there is nothing to opt out of: Accept only.
 *
 * One row, text and buttons side by side (user, 2026-10-22): on phones the two-row card covered
 * the hero photo above the Call / Text / Book Now bar. The word "cookies" links to the policy.
 * Navy, not white: the light card blended into the page and went unnoticed (user, 2026-10-22).
 *
 * Fixed, so it shifts no layout; globals.css lifts it above the phone action bar and hides it
 * while the mobile menu is open.
 */
const KEY = "bueno:cookie-notice";
const listeners = new Set<() => void>();
let acceptedNow = false;

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function accepted(): boolean {
  if (acceptedNow) return true;
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    // Storage blocked: the answer could not be remembered, so do not ask on every page.
    return true;
  }
}

function accept() {
  acceptedNow = true;
  try {
    localStorage.setItem(KEY, new Date().toISOString());
  } catch {
    // Storage blocked: hidden for this visit anyway.
  }
  listeners.forEach((listener) => listener());
}

export function CookieNotice() {
  // Hidden on the server and during hydration; shown after it if nothing is stored.
  const open = !useSyncExternalStore(subscribe, accepted, () => true);
  if (!open) return null;

  return (
    <section
      aria-label="Cookie notice"
      data-cookie-notice
      className="fixed inset-x-2 z-30 flex animate-rise items-center gap-2 rounded-card bg-navy py-2 pr-2 pl-3.5 shadow-[0_16px_40px_-12px_rgb(10_23_48/0.55)] ring-1 ring-white/10 motion-reduce:animate-none md:inset-x-auto md:left-(--gutter) md:max-w-[30rem] md:gap-4 md:p-3 md:pl-5"
    >
      <p className="min-w-0 flex-1 text-[0.8125rem] leading-snug text-white/85 md:text-sm">
        {ANALYTICS_ON ? "We use " : "We use only essential "}
        <Link
          href="/privacy#cookies"
          className="font-medium text-white underline decoration-sky underline-offset-2 hover:text-sky"
        >
          cookies
        </Link>
        {ANALYTICS_ON ? " for analytics." : ", for bookings and secure payments."}
      </p>
      <div className="flex shrink-0 gap-1.5">
        {ANALYTICS_ON && (
          <Button
            size="sm"
            variant="outline"
            className="h-9! border-white/35! bg-transparent! px-3.5! text-[0.8125rem]! text-white! hover:border-white! hover:bg-white/10! hover:shadow-none!"
            onClick={() => {
              setAnalyticsOptOut(true);
              accept();
            }}
          >
            Decline
          </Button>
        )}
        <Button size="sm" onClick={accept} className="h-9! px-4! text-[0.8125rem]!">
          Accept
        </Button>
      </div>
    </section>
  );
}
