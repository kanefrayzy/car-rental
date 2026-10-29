"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { analyticsOptedOut, GA_ID, gaDebug, restartExpiredSession, safePageLocation, track, trackLeaving } from "@/lib/analytics";
import { CLARITY_ID, clarityEvent, claritySnippet, prepareClarity, tagAdsTraffic } from "@/lib/clarity";

/**
 * Loads Google Analytics 4 after the page is interactive, so it never delays the first paint
 * or the hero image (LCP). Nothing loads without a measurement ID, for visitors who turned it
 * off, or under /be (the admin panel is Laravel's, but the rule holds if a page ever lands there).
 *
 * Microsoft Clarity (session recordings, lib/clarity.ts) loads the same way, under the same
 * rules, and also only in a production build and not for ?ga_debug=1 (developer) sessions.
 *
 * Also counts the clicks that matter on every page: Call, Text, and links to the quote form.
 */
export function Analytics() {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);
  const [clarityOn, setClarityOn] = useState(false);
  const admin = pathname === "/be" || pathname.startsWith("/be/");

  useEffect(() => {
    if (!GA_ID || admin || analyticsOptedOut()) return;
    window.dataLayer = window.dataLayer || [];
    // gtag.js reads `arguments` objects from the queue, not arrays.
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    // Opt-out model (user, 2026-10-22: a US-only business): consent is granted until the visitor
    // presses Decline, which updates it to denied (lib/analytics.ts). ad_user_data is granted so
    // GA4 key events imported into Google Ads as conversions can be tied to the ad click;
    // ad_personalization stays denied (no remarketing).
    window.gtag("consent", "default", {
      analytics_storage: "granted",
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "denied",
    });
    window.gtag("js", new Date());
    window.gtag("config", GA_ID, {
      page_location: safePageLocation(window.location.href),
      // ?ga_debug=1 marks this browser's hits for GA4 DebugView, for checking the setup.
      ...(gaDebug() ? { debug_mode: true } : {}),
      // No Google signals and no ad personalisation. Key events still reach Google Ads as
      // conversions through the GA4 import.
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnabled(true);
  }, [admin]);

  useEffect(() => {
    if (!CLARITY_ID || process.env.NODE_ENV !== "production" || admin || analyticsOptedOut() || gaDebug()) return;
    // Arrived by a full page load from the booking page: the referrer is its signed link, which
    // Clarity would record as it is (its dropped parameters apply to addresses, not the referrer).
    if (/[?&](signature|payment_intent_client_secret)=/.test(document.referrer)) return;
    prepareClarity();
    tagAdsTraffic();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClarityOn(true);
  }, [admin]);

  useEffect(() => {
    if (!enabled && !clarityOn) return;
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      const href = link.getAttribute("href") ?? "";
      // innerText keeps the space between an icon label's parts; it is empty for a link that is not
      // rendered (the closed mobile menu), so textContent is the fallback.
      const text = (link.innerText.trim() || link.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60) || link.getAttribute("aria-label") || "";
      const leaving = href.startsWith("tel:") ? "click_call" : href.startsWith("sms:") ? "click_sms" : null;
      if (leaving) {
        // Never hold the link back: Safari only opens a call that starts in the tap itself.
        trackLeaving(leaving, { link_text: text });
      } else if (link.pathname === "/contact" && link.origin === window.location.origin) {
        track("quote_open", { link_text: text });
      }
    };
    // Back on a tab left open for more than 30 minutes (or restored from the back-forward
    // cache): the new session starts with a page_view, not with the next click or form event.
    const onReturn = () => document.visibilityState === "visible" && restartExpiredSession();
    // pageshow also fires on every normal load; only a restore from the cache counts.
    const onRestore = (event: PageTransitionEvent) => event.persisted && restartExpiredSession();
    // GA4 counts form_start itself (enhanced measurement); Clarity gets the same event: the
    // first typed or changed field of each form, once per page.
    const started = new Set<string>();
    const onField = (event: Event) => {
      const form = (event.target as Element | null)?.closest?.("form");
      const key = `${window.location.pathname}#${form?.id ?? ""}`;
      if (!form || started.has(key) || analyticsOptedOut()) return;
      started.add(key);
      clarityEvent("form_start");
    };
    // Capture: the click is counted before Next navigates away.
    document.addEventListener("click", onClick, true);
    if (clarityOn) {
      document.addEventListener("input", onField, true);
      document.addEventListener("change", onField, true);
    }
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("pageshow", onRestore);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("input", onField, true);
      document.removeEventListener("change", onField, true);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("pageshow", onRestore);
    };
  }, [enabled, clarityOn]);

  return (
    <>
      {enabled && <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />}
      {clarityOn && (
        <Script id="clarity" strategy="afterInteractive">
          {claritySnippet()}
        </Script>
      )}
    </>
  );
}
