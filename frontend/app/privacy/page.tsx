import type { Metadata } from "next";
import { ContentPage } from "@/components/layout/ContentPage";
import { site } from "@/config/site";
import { AnalyticsChoice } from "@/components/layout/AnalyticsChoice";
import { ANALYTICS_ON, GA_ID } from "@/lib/analytics";
import { CLARITY_ID } from "@/lib/clarity";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description: `What ${site.name} collects when you request a booking, why we need it, how your license is protected and how long we keep it.`,
  path: "/privacy",
});

/*
 * DRAFT for the client (and ideally a lawyer) to review. It describes what the site and the
 * API actually do; keep it in step with them:
 * - the booking form collects name, phone, email, dates, license and insurance (lib/api.ts);
 * - documents sit on a private disk, reachable only by the owner (backend/README.md);
 * - documents are deleted documentRetentionDays after the return date (bookings:prune-documents);
 * - Google Analytics 4 when NEXT_PUBLIC_GA_ID is set (components/layout/Analytics.tsx), whose
 *   key events are imported into Google Ads as conversions (no personalised ads), with
 *   an opt-out (AnalyticsChoice, Decline on the cookie notice, Global Privacy Control);
 * - Microsoft Clarity session recordings when NEXT_PUBLIC_CLARITY_ID is set (lib/clarity.ts),
 *   with form fields and the booking page masked, under the same opt-out; no ad
 *   cookies; the browser keeps the booking draft, the "My booking" link and the cookie notice
 *   answer (localStorage); Stripe sets its own cookies on the payment form; Laravel's session
 *   and XSRF cookies are set by the booking system's sign-in (the API itself sets none).
 *   Update the Cookies section and components/layout/CookieNotice.tsx if that changes.
 */
const LAST_UPDATED = "October 30, 2026";

export default function PrivacyPage() {
  const { booking } = site;

  return (
    <ContentPage title="Privacy" path="/privacy" intro={`Last updated ${LAST_UPDATED}`}>
      <p>
        This page explains what {site.name} collects when you request a booking, why we need it
        and how long we keep it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Your name, phone number and email address.</li>
        <li>The dates you want the car.</li>
        <li>A photo or scan of your driver’s license and your proof of insurance.</li>
      </ul>
      <p>
        If you pay a deposit online, your card is handled by our payment processor, Stripe. We
        never see or store your full card number.
      </p>

      <h2>Why we need it</h2>
      <ul>
        <li>To check that you meet the rental requirements before we confirm a booking.</li>
        <li>To contact you about your booking, pickup and delivery.</li>
        <li>To handle an accident, damage or a traffic violation during your rental.</li>
      </ul>

      <h2>How your documents are protected</h2>
      <p>
        Your license and insurance are stored privately. They are never published, and only the
        owner can open them, after signing in. We do not sell your information or share it for
        marketing.
      </p>
      <p>
        We share it only with the services that run this website and send its emails, with our
        payment processor, and with insurers or authorities when an incident during your rental
        or the law requires it.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Your license and insurance files are deleted automatically{" "}
        <strong>{booking.documentRetentionDays} days after your return date</strong>, or{" "}
        {booking.documentRetentionDays} days after a request is declined or cancelled. We keep the
        booking itself (name, contact details, dates and amounts) as part of our business
        records.
      </p>

      <h2 id="cookies">Cookies</h2>
      {GA_ID ? (
        <p>
          We use Google Analytics to count visits and see which pages and buttons people use, so
          we can improve the site. It sets cookies with a random ID; it does not tell us who you
          are.
        </p>
      ) : (
        !ANALYTICS_ON && <p>We do not use analytics, advertising or tracking cookies.</p>
      )}
      {GA_ID && (
        <p>
          We also use Google Ads conversion measurement: if you came to the site from one of our
          Google ads, Google can tell us whether the visit led to a booking request, a call or a
          message. We do not use personalized advertising or remarketing, so you will not be
          followed by our ads around the web.
        </p>
      )}
      {CLARITY_ID && (
        <p>
          We use Microsoft Clarity to see how visitors use the site: where they click, how far
          they scroll and where they get stuck, so we can fix what is confusing. What you type
          into our forms and the details on your booking page are hidden from it, and it never
          sees your card. Clarity sets its own cookies. Read{" "}
          <a href="https://www.microsoft.com/privacy/privacystatement" rel="noopener">
            Microsoft’s privacy statement
          </a>{" "}
          for how Microsoft handles this data.
        </p>
      )}
      <p>
        Our booking system uses two technical cookies, a session cookie and an XSRF token that
        protects forms against forgery. They hold no personal details and are needed for the
        forms to work securely.
      </p>
      <p>
        Your browser also keeps the booking details you have typed but not sent yet, the link to
        your latest booking, and your answer to our cookie notice. This stays on your device.
      </p>
      <p>
        When you pay a deposit or the rental, our payment processor, Stripe, sets its own
        cookies on the payment form to keep the payment secure and prevent fraud.
      </p>

      {ANALYTICS_ON && (
        <>
          <h3>How to opt out</h3>
          <p>
            Turn analytics{CLARITY_ID ? (GA_ID ? " (Google Analytics and Microsoft Clarity)" : " (Microsoft Clarity)") : ""} off
            for this browser with the button below or with Decline on our cookie notice. We also
            respect Global Privacy Control. You can block or delete cookies in your browser
            settings
            {GA_ID ? (
              <>
                , or install Google’s{" "}
                <a href="https://tools.google.com/dlpage/gaoptout" rel="noopener">
                  opt-out add-on
                </a>{" "}
                for every site.
              </>
            ) : (
              "."
            )}
          </p>
          <AnalyticsChoice />
        </>
      )}
      {site.email && (
        <p>
          Questions about cookies or your data: <a href={`mailto:${site.email}`}>{site.email}</a>.
        </p>
      )}

      <h2>Your choices</h2>
      <p>
        You can ask for a copy of what we hold about you, ask us to correct it, or ask us to
        delete it.{" "}
        {site.email && (
          <>
            Email <a href={`mailto:${site.email}`}>{site.email}</a> or call{" "}
          </>
        )}
        {!site.email && "Call or text "}
        <a href={site.phone.href}>{site.phone.display}</a>. We may need to keep some details
        while a rental or a claim is still open.
      </p>
    </ContentPage>
  );
}
