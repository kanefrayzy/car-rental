import { CLARITY_ID, clarityEvent, setClarityConsent } from "./clarity";

/**
 * Google Analytics 4. The measurement ID is compiled in (NEXT_PUBLIC_GA_ID, from deploy/.env);
 * without it nothing loads and `track` does nothing. The tag itself is <Analytics> in the root
 * layout; components only call `track`.
 */
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";

/** Anything that counts visits is compiled in: GA4 or Microsoft Clarity (lib/clarity.ts). */
export const ANALYTICS_ON = !!(GA_ID || CLARITY_ID);

/** The site's own events (user, 2026-10-19). Page views are counted by GA itself. */
export type AnalyticsEvent =
  | "booking_submit"
  | "deposit_paid"
  | "rental_paid"
  | "contact_submit"
  | "click_call"
  | "click_sms"
  | "quote_open"
  // Booking funnel steps (user, 2026-10-24), not key events: where people leave the booking.
  | "booking_dates_selected"
  | "booking_details_view"
  | "booking_payment_view";

type Params = Record<string, string | number | undefined>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const OPT_OUT_KEY = "bueno:analytics";

/**
 * The visitor turned analytics off: Decline on the cookie notice or the switch on /privacy,
 * or their browser sends Global Privacy Control.
 */
export function analyticsOptedOut(): boolean {
  if (typeof navigator !== "undefined" && (navigator as { globalPrivacyControl?: boolean }).globalPrivacyControl) return true;
  try {
    return localStorage.getItem(OPT_OUT_KEY) === "off";
  } catch {
    return false;
  }
}

/** Turns analytics off (or back on) for this browser. Off takes effect at once. */
export function setAnalyticsOptOut(off: boolean) {
  try {
    if (off) localStorage.setItem(OPT_OUT_KEY, "off");
    else localStorage.removeItem(OPT_OUT_KEY);
  } catch {
    // Storage blocked: the choice holds for this page only.
  }
  // Clarity follows the same choice: denied and stopped now, not loaded on later visits.
  setClarityConsent(!off);
  if (!GA_ID) return;
  // Consent Mode: everything denied (or granted again). After a Decline the tag is also told to
  // send nothing at all, and later visits do not load it, so no cookieless pings go out either.
  const state = off ? "denied" : "granted";
  window.gtag?.("consent", "update", {
    analytics_storage: state,
    ad_storage: state,
    ad_user_data: state,
    // Never granted: no remarketing (Analytics.tsx).
    ad_personalization: "denied",
  });
  (window as unknown as Record<string, boolean>)[`ga-disable-${GA_ID}`] = off;
}

/** `?ga_debug=1` once in a session sends this browser's hits to GA4 DebugView. */
export function gaDebug(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get("ga_debug") === "1") sessionStorage.setItem("bueno:ga-debug", "1");
    return sessionStorage.getItem("bueno:ga-debug") === "1";
  } catch {
    return false;
  }
}

/**
 * The customer's booking page carries a signed link (booking, expires, signature) that opens
 * the booking. It must not end up in reports, so the address is sent without its query.
 */
export function safePageLocation(href: string): string {
  const url = new URL(href);
  if (url.pathname.startsWith("/booking")) url.search = "";
  return url.toString();
}

/** GA4's default session timeout (Admin, Data streams, Configure tag settings). */
const SESSION_TIMEOUT_S = 30 * 60;
let restartedAt = 0;

/** When gtag last sent a hit: `t` in the _ga_<stream> cookie ("GS2.1.s…$o…$t1792840118$…", or "GS1.1.sid.sct.seg.t…"). */
function lastHitSeconds(): number {
  const match = document.cookie.match(new RegExp(`(?:^|; )_ga_${GA_ID.replace(/^G-/, "")}=([^;]*)`));
  if (!match) return 0;
  const value = decodeURIComponent(match[1]);
  return Number(value.startsWith("GS1") ? value.split(".")[5] : /\$t(\d+)/.exec(value)?.[1]) || 0;
}

/**
 * A page left open for more than 30 minutes: gtag starts a new session with the next hit. If
 * that hit is a click or a form event, the session has no page_view, and GA4 reports its
 * source as (not set), channel Unassigned, which Google Ads cannot tie to the ad click
 * (2026-10-24 audit: lead events with source (not set) in GA4). A page_view first
 * starts the new session properly, with the page address (and its gclid) as the landing page.
 * Called before each tracked event and when the visitor comes back to the tab.
 */
export function restartExpiredSession() {
  if (!GA_ID || !window.gtag || analyticsOptedOut()) return;
  const cookieLast = lastHitSeconds();
  if (!cookieLast) return;
  // A page loaded in the last 30 minutes sent its own page_view with the config (or is about to,
  // before gtag.js is in): the session is fresh even when the cookie is older, as it is for a
  // visitor back after an hour. Without this, that visitor got two page_views (2026-10-25).
  const last = Math.max(cookieLast, performance.timeOrigin / 1000);
  if (Date.now() / 1000 - last < SESSION_TIMEOUT_S || Date.now() - restartedAt < 10_000) return;
  restartedAt = Date.now();
  window.gtag("event", "page_view", { page_location: safePageLocation(window.location.href) });
}

export function track(event: AnalyticsEvent, params: Params = {}) {
  if (!analyticsOptedOut()) clarityEvent(event);
  if (!GA_ID || !window.gtag || analyticsOptedOut()) return;
  restartExpiredSession();
  window.gtag("event", event, { ...params, page_location: safePageLocation(window.location.href) });
}

/**
 * An event for a link that leaves the page (tel:, sms:), sent as a beacon so it survives the
 * call or text app taking over. The link itself opens natively, in the tap: a version that held
 * it and opened the call from a script after gtag answered was live for a few hours on
 * 2026-10-23 and was taken back after an iPhone showed "blocked from automatically starting a
 * call" (which Safari shows after Cancel three times in a row; tap Allow Call to reset).
 */
export function trackLeaving(event: AnalyticsEvent, params: Params = {}) {
  if (!analyticsOptedOut()) clarityEvent(event);
  if (!GA_ID || !window.gtag || analyticsOptedOut()) return;
  restartExpiredSession();
  window.gtag("event", event, {
    ...params,
    page_location: safePageLocation(window.location.href),
    transport_type: "beacon",
  });
}

/** Like `track`, but once per key in this browser session (a payment seen again on reload). */
export function trackOnce(key: string, event: AnalyticsEvent, params: Params = {}) {
  try {
    const stored = `bueno:tracked:${key}`;
    if (sessionStorage.getItem(stored)) return;
    sessionStorage.setItem(stored, "1");
  } catch {
    // Storage blocked: count it anyway.
  }
  track(event, params);
}
