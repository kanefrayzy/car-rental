/**
 * Microsoft Clarity (session recordings, user 2026-10-30). The project ID is compiled in
 * (NEXT_PUBLIC_CLARITY_ID, from deploy/.env); without it nothing loads. The tag is loaded by
 * <Analytics> in the root layout under the same rules as GA4: production only, not under /be,
 * not for ?ga_debug=1 sessions, and never after Decline (lib/analytics.ts).
 *
 * Everything here is a no-op until the tag is on the page, and never throws.
 */
export const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID ?? "";

type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[][] };

declare global {
  interface Window {
    clarity?: ClarityFn;
  }
}

/**
 * Query parameters Clarity replaces with "*na*" in every address it records (the page, clicked
 * links, errors). The booking page's signed link opens a customer's booking, and Stripe sends
 * the payment's client secret back in the return address.
 */
const DROPPED_PARAMS = [
  "booking",
  "expires",
  "signature",
  "payment_intent",
  "payment_intent_client_secret",
  "setup_intent",
  "setup_intent_client_secret",
];

/** The events Clarity gets, to filter recordings by (the same names as in GA4). */
const CLARITY_EVENTS = new Set([
  "booking_dates_selected",
  "booking_details_view",
  "booking_payment_view",
  "booking_submit",
  "click_call",
  "click_sms",
  "form_start",
  "contact_submit",
]);

function clarity(...args: unknown[]) {
  try {
    window.clarity?.(...args);
  } catch {
    // Clarity's own error: never let it break the page.
  }
}

/**
 * Sets up the command queue before the official snippet runs (the snippet keeps an existing
 * window.clarity). The tag's own "start" call goes through this queue, so the dropped
 * parameters are added to its settings before clarity.js reads them.
 */
export function prepareClarity() {
  if (window.clarity) return;
  const queue: ClarityFn = function (...args: unknown[]) {
    if (args[0] === "start" && args[1] && typeof args[1] === "object") {
      const config = args[1] as { drop?: string[] };
      args[1] = { ...config, drop: [...(config.drop ?? []), ...DROPPED_PARAMS] };
    }
    (queue.q = queue.q || []).push(args);
  };
  window.clarity = queue;
}

/** The official snippet (Clarity, Settings, Setup), with the project ID filled in. */
export function claritySnippet(): string {
  return `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script",${JSON.stringify(CLARITY_ID)});`;
}

export function clarityEvent(name: string) {
  if (CLARITY_EVENTS.has(name)) clarity("event", name);
}

/**
 * A visit from a Google ad (gclid, or the iOS gbraid/wbraid, or utm_source=google with
 * utm_medium=cpc): tagged once per browser session, so recordings can be filtered by it.
 */
export function tagAdsTraffic() {
  const params = new URLSearchParams(window.location.search);
  const fromAds =
    params.has("gclid") ||
    params.has("gbraid") ||
    params.has("wbraid") ||
    (params.get("utm_source") === "google" && params.get("utm_medium") === "cpc");
  if (!fromAds) return;
  try {
    const key = "bueno:clarity-ads";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    // Storage blocked: tag it on this page anyway.
  }
  clarity("set", "traffic", "google_ads");
}

/** Decline (or the switch on /privacy): consent denied and recording stopped on this page. */
export function setClarityConsent(granted: boolean) {
  const state = granted ? "granted" : "denied";
  clarity("consentv2", { ad_Storage: state, analytics_Storage: state });
  clarity(granted ? "start" : "stop");
}
