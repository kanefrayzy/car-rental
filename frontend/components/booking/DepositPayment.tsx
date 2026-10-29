"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckIcon } from "@/components/ui/icons";
import { site } from "@/config/site";
import { usd } from "@/config/terms";
import { trackOnce } from "@/lib/analytics";
import { ApiError, createDepositIntent, createRentalPaymentIntent } from "@/lib/api";

// Publishable key, compiled in at build time. Without it (or without Stripe on the API) the
// site says a payment link will follow by email, as before.
const STRIPE_KEY = process.env.NEXT_PUBLIC_STRIPE_KEY ?? "";

// Stripe.js loads once, and only when a payment form is actually shown.
let stripePromise: Promise<Stripe | null> | null = null;
const getStripe = () => (stripePromise ??= loadStripe(STRIPE_KEY));

type DepositPaymentProps = {
  bookingId: string;
  amountUsd: number;
  /** "deposit" with the request; "rental" (price plus tax) once the owner has confirmed. */
  kind?: "deposit" | "rental";
  onPaid?: () => void;
};

/**
 * The refundable deposit, paid by card (or Apple Pay / Google Pay) without leaving the page.
 * The API creates the payment; Stripe's webhook, not this form, marks the booking as paid.
 */
export function DepositPayment({ bookingId, amountUsd, kind = "deposit", onPaid }: DepositPaymentProps) {
  const [clientSecret, setClientSecret] = useState<string | null | undefined>(STRIPE_KEY ? undefined : null);
  const [problem, setProblem] = useState("");
  const [paid, setPaid] = useState(false);

  // booking_payment_view: the payment step is on screen, once per booking and kind in a session.
  useEffect(() => {
    trackOnce(`payment-view:${kind}:${bookingId}`, "booking_payment_view", { payment: kind, value: amountUsd, currency: "USD" });
  }, [bookingId, kind, amountUsd]);

  useEffect(() => {
    if (!STRIPE_KEY) return;
    let current = true;
    (kind === "rental" ? createRentalPaymentIntent : createDepositIntent)(bookingId)
      .then((intent) => current && setClientSecret(intent.clientSecret))
      .catch((error) => {
        if (!current) return;
        setProblem(error instanceof ApiError ? error.message : `We couldn’t open the payment form. Call ${site.phone.display}.`);
      });
    return () => {
      current = false;
    };
  }, [bookingId, kind]);

  if (paid) {
    return (
      <p role="status" className="flex items-start gap-2 text-sm font-medium text-success">
        <CheckIcon className="mt-0.5 shrink-0 text-base" />
        {kind === "rental"
          ? `Payment of ${usd(amountUsd)} received. Thank you, see you at pickup.`
          : `Deposit of ${usd(amountUsd)} received. Your dates are held while we review your request.`}
      </p>
    );
  }
  if (problem) {
    return (
      <p role="alert" className="text-sm font-medium text-danger">
        {problem}
      </p>
    );
  }
  if (clientSecret === null) {
    return (
      <p className="text-sm leading-relaxed text-muted">
        Card payment isn’t switched on yet. We’ll contact you about paying {usd(amountUsd)}.
      </p>
    );
  }
  if (clientSecret === undefined) {
    return <p className="text-sm text-muted">Loading the secure payment form…</p>;
  }

  return (
    <Elements
      stripe={getStripe()}
      options={{
        clientSecret,
        // The site is in English; without this Stripe follows the browser language.
        locale: "en",
        appearance: {
          theme: "stripe",
          // The site's tokens: brand-deep, ink, danger, and the button radius.
          variables: {
            colorPrimary: "#0566fb",
            colorText: "#0a1730",
            colorDanger: "#c8102e",
            fontFamily: "DM Sans, system-ui, sans-serif",
            borderRadius: "10px",
          },
        },
      }}
    >
      <PayForm
        kind={kind}
        label={kind === "rental" ? `Pay ${usd(amountUsd)}` : `Pay ${usd(amountUsd)} deposit`}
        onPaid={() => {
          setPaid(true);
          trackPayment(bookingId, kind, amountUsd);
          onPaid?.();
        }}
      />
    </Elements>
  );
}

/** Counts a payment in analytics: deposit_paid or rental_paid, once per booking. */
export function trackPayment(bookingId: string, kind: "deposit" | "rental", amountUsd?: number) {
  trackOnce(`${kind}:${bookingId}`, kind === "rental" ? "rental_paid" : "deposit_paid", {
    value: amountUsd,
    currency: "USD",
  });
}

const returnUrl = (kind: "deposit" | "rental") => {
  const url = new URL(window.location.href);
  url.searchParams.set("paid", kind);
  return url.toString();
};

function PayForm({ label, kind, onPaid }: { label: string; kind: "deposit" | "rental"; onPaid: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pay = async () => {
    if (!stripe || !elements || busy) return;
    setBusy(true);
    setError("");

    // The API only offers payment methods that need no redirect, so this resolves here.
    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      // If a bank check sends the customer away anyway, they come back with Stripe's
      // redirect_status and this `paid`, which BookingTracker counts.
      confirmParams: { return_url: returnUrl(kind) },
    });
    setBusy(false);

    if (result.error) {
      setError(result.error.message ?? "The payment didn’t go through. Try another card.");
      return;
    }
    if (["succeeded", "processing", "requires_capture"].includes(result.paymentIntent.status)) onPaid();
  };

  return (
    // A div, not a nested form: this sits inside the booking dialog's own form on some screens.
    <div>
      <PaymentElement options={{ layout: "tabs" }} />
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <Button onClick={pay} loading={busy} disabled={!stripe} className="mt-4 max-sm:w-full">
        {busy ? "Paying…" : label}
      </Button>
      <p className="mt-3 text-[0.8125rem] text-muted">Secured by Stripe. We never see your card number.</p>
    </div>
  );
}
