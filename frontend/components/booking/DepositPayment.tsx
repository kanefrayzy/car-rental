"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type PaymentIntentResult, type SetupIntentResult, type Stripe } from "@stripe/stripe-js";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckIcon } from "@/components/ui/icons";
import { site } from "@/config/site";
import { depositCopy, usd } from "@/config/terms";
import { trackOnce } from "@/lib/analytics";
import { ApiError, createDepositIntent, createRentalPaymentIntent, resumeDepositHold, startCardSetup } from "@/lib/api";
import { useResetOnLeave } from "@/lib/useResetOnLeave";

// Publishable key, compiled in at build time. Without it (or without Stripe on the API) the
// site says a payment link will follow by email, as before.
const STRIPE_KEY = process.env.NEXT_PUBLIC_STRIPE_KEY ?? "";

// Stripe.js loads once, and only when a payment form is actually shown.
let stripePromise: Promise<Stripe | null> | null = null;
const getStripe = () => (stripePromise ??= loadStripe(STRIPE_KEY));

/**
 * "deposit": the old deposit, charged with the request. "rental": price plus tax once the owner
 * has confirmed. "card": the card saved for the deposit hold (since 2026-11-10), nothing
 * charged. "hold": the customer finishes a hold their bank did not approve without them.
 */
export type PaymentKind = "deposit" | "rental" | "card" | "hold";

type DepositPaymentProps = {
  bookingId: string;
  amountUsd: number;
  kind?: PaymentKind;
  onPaid?: () => void;
};

// The site's tokens: brand-deep, ink, danger, and the button radius.
const appearance = {
  theme: "stripe" as const,
  variables: {
    colorPrimary: "#0566fb",
    colorText: "#0a1730",
    colorDanger: "#c8102e",
    fontFamily: "DM Sans, system-ui, sans-serif",
    borderRadius: "10px",
  },
};

/** Analytics' name for the step: the deposit as a hold or a charge, or the rental. */
const paymentParams = (kind: PaymentKind) =>
  kind === "rental" ? { payment: "rental" } : { payment: "deposit", deposit_type: kind === "deposit" ? "charge" : "hold" };

/**
 * Card payments without leaving the page (card, Apple Pay / Google Pay). The API creates the
 * payment or the card setup; Stripe (its webhook, or the API asking it) records the outcome,
 * never this form.
 */
export function DepositPayment({ bookingId, amountUsd, kind = "deposit", onPaid }: DepositPaymentProps) {
  // The card is saved through a deferred SetupIntent: the form shows first, and the API creates
  // the setup only once the customer has ticked the hold agreement and pressed the button.
  const deferred = kind === "card";
  const [clientSecret, setClientSecret] = useState<string | null | undefined>(STRIPE_KEY ? (deferred ? "" : undefined) : null);
  const [problem, setProblem] = useState("");
  const [paid, setPaid] = useState(false);

  // booking_payment_view: the payment step is on screen, once per booking and kind in a session.
  useEffect(() => {
    trackOnce(`payment-view:${kind}:${bookingId}`, "booking_payment_view", { ...paymentParams(kind), value: amountUsd, currency: "USD" });
  }, [bookingId, kind, amountUsd]);

  useEffect(() => {
    if (!STRIPE_KEY || deferred) return;
    let current = true;
    const start = kind === "rental" ? createRentalPaymentIntent : kind === "hold" ? resumeDepositHold : createDepositIntent;
    start(bookingId)
      .then((intent) => current && setClientSecret(intent.clientSecret))
      .catch((error) => {
        if (!current) return;
        setProblem(error instanceof ApiError ? error.message : `We couldn’t open the payment form. Call ${site.phone.display}.`);
      });
    return () => {
      current = false;
    };
  }, [bookingId, kind, deferred]);

  if (paid) {
    return (
      <p role="status" className="flex items-start gap-2 text-sm font-medium text-success">
        <CheckIcon className="mt-0.5 shrink-0 text-base" />
        {kind === "rental"
          ? `Payment of ${usd(amountUsd)} received. Thank you, see you at pickup.`
          : kind === "card"
            ? "Card saved. Nothing was charged. Your dates are held while we review your request."
            : kind === "hold"
              ? `Thank you. The ${usd(amountUsd)} hold is on your card. Nothing is charged.`
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
        {kind === "card" || kind === "hold"
          ? `Card payment isn’t switched on yet. We’ll contact you about the ${usd(amountUsd)} deposit hold.`
          : `Card payment isn’t switched on yet. We’ll contact you about paying ${usd(amountUsd)}.`}
      </p>
    );
  }
  if (clientSecret === undefined) {
    return <p className="text-sm text-muted">Loading the secure payment form…</p>;
  }

  const done = () => {
    setPaid(true);
    trackPayment(bookingId, kind, amountUsd);
    onPaid?.();
  };

  return (
    <Elements
      stripe={getStripe()}
      options={
        deferred
          ? // No intent yet: Stripe needs to know it is a card saved for later, without the customer.
            { mode: "setup", currency: "usd", setupFutureUsage: "off_session", locale: "en", appearance }
          : { clientSecret: clientSecret as string, locale: "en", appearance }
      }
    >
      {deferred ? (
        <SaveCardForm bookingId={bookingId} amountUsd={amountUsd} onSaved={done} />
      ) : (
        <PayForm
          kind={kind}
          label={kind === "rental" ? `Pay ${usd(amountUsd)}` : kind === "hold" ? `Confirm the ${usd(amountUsd)} hold` : `Pay ${usd(amountUsd)} deposit`}
          note={kind === "hold" ? "Nothing is charged. You can use another card." : undefined}
          onPaid={done}
        />
      )}
    </Elements>
  );
}

/**
 * Counts a payment in analytics, once per booking: rental_paid, or deposit_paid. A saved card
 * (or a finished hold) is the deposit step of the hold model, so it counts as deposit_paid with
 * deposit_type "hold": the funnel and the Ads conversion keep their meaning.
 */
export function trackPayment(bookingId: string, kind: PaymentKind, amountUsd?: number) {
  const deposit = kind !== "rental";
  trackOnce(`${deposit ? "deposit" : "rental"}:${bookingId}`, deposit ? "deposit_paid" : "rental_paid", {
    ...(deposit ? { deposit_type: kind === "deposit" ? "charge" : "hold" } : {}),
    value: amountUsd,
    currency: "USD",
  });
}

const returnUrl = (kind: PaymentKind) => {
  const url = new URL(window.location.href);
  url.searchParams.set("paid", kind);
  return url.toString();
};

function PayForm({ label, kind, note, onPaid }: { label: string; kind: PaymentKind; note?: string; onPaid: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Set at once on click (state is a render late): a double click confirms once.
  const paying = useRef(false);
  // A bank check that sends the customer away and Back to this page (back-forward cache), or
  // leaving the page: never with "Paying…" still on.
  useResetOnLeave(() => {
    paying.current = false;
    setBusy(false);
  });

  const pay = async () => {
    if (!stripe || !elements || paying.current) return;
    paying.current = true;
    setBusy(true);
    setError("");

    let result: PaymentIntentResult;
    try {
      // The API only offers payment methods that need no redirect, so this resolves here.
      result = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
        // If a bank check sends the customer away anyway, they come back with Stripe's
        // redirect_status and this `paid`, which BookingTracker counts.
        confirmParams: { return_url: returnUrl(kind) },
      });
    } catch {
      setError(`The payment didn’t go through. Try again or call ${site.phone.display}.`);
      return;
    } finally {
      paying.current = false;
      setBusy(false);
    }

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
        {busy ? "Confirming…" : label}
      </Button>
      <p className="mt-3 text-[0.8125rem] text-muted">
        {note ? `${note} ` : ""}Secured by Stripe. We never see your card number.
      </p>
    </div>
  );
}

/**
 * The card for the deposit hold: the agreement checkbox, the card, and "Save card". Nothing is
 * charged; the API creates the SetupIntent only after the box is ticked, and records the time.
 */
function SaveCardForm({ bookingId, amountUsd, onSaved }: { bookingId: string; amountUsd: number; onSaved: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [agreed, setAgreed] = useState(false);
  const [agreeError, setAgreeError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const saving = useRef(false);
  const checkbox = useRef<HTMLInputElement>(null);
  useResetOnLeave(() => {
    saving.current = false;
    setBusy(false);
  });
  const copy = depositCopy(amountUsd);
  // The agreement links its "Rental Terms".
  const [termsBefore, termsAfter] = copy.checkbox.split("Rental Terms");

  const save = async () => {
    if (!stripe || !elements || saving.current) return;
    // The button is never disabled for a missing tick: a click says what is missing.
    if (!agreed) {
      setAgreeError(`Tick the box to agree to the ${usd(amountUsd)} hold.`);
      checkbox.current?.focus();
      return;
    }
    saving.current = true;
    setBusy(true);
    setError("");

    let result: SetupIntentResult | undefined;
    try {
      // Card details first, so a typo shows before anything is created.
      const { error: invalid } = await elements.submit();
      if (invalid) {
        setError(invalid.message ?? "Check your card details.");
        return;
      }
      const { clientSecret } = await startCardSetup(bookingId, true);
      if (!clientSecret) {
        setError(`Card payment isn’t switched on yet. We’ll contact you about the deposit. Questions? Call ${site.phone.display}.`);
        return;
      }
      result = await stripe.confirmSetup({
        elements,
        clientSecret,
        redirect: "if_required",
        confirmParams: { return_url: returnUrl("card") },
      });
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : `We couldn’t save your card. Try again or call ${site.phone.display}.`);
      return;
    } finally {
      saving.current = false;
      setBusy(false);
    }

    if (result?.error) {
      setError(result.error.message ?? "Your card wasn’t accepted. Try another card.");
      return;
    }
    if (result && ["succeeded", "processing"].includes(result.setupIntent.status)) onSaved();
  };

  return (
    <div>
      <p className="mb-4 rounded-btn-lg bg-tint/60 px-3.5 py-3 text-sm leading-relaxed text-ink">{copy.summary}</p>
      <PaymentElement options={{ layout: "tabs" }} />
      <label className="mt-4 flex items-start gap-3 text-sm leading-relaxed text-ink-soft">
        <input
          ref={checkbox}
          type="checkbox"
          checked={agreed}
          onChange={(event) => {
            setAgreed(event.target.checked);
            if (event.target.checked) setAgreeError("");
          }}
          aria-invalid={agreeError ? true : undefined}
          aria-describedby={agreeError ? "hold-agree-error" : undefined}
          className="mt-0.5 size-5 shrink-0 accent-brand-deep"
        />
        <span>
          {termsBefore}
          <Link href="/rental-terms" target="_blank" className="font-medium text-brand-deep underline">
            Rental Terms
          </Link>
          {termsAfter}
        </span>
      </label>
      {agreeError && (
        <p id="hold-agree-error" role="alert" className="mt-2 text-sm font-medium text-danger">
          {agreeError}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <Button onClick={save} loading={busy} disabled={!stripe} className="mt-4 max-sm:w-full">
        {busy ? "Saving…" : "Save card"}
      </Button>
      <p className="mt-3 text-[0.8125rem] text-muted">Nothing is charged now. Secured by Stripe. We never see your card number.</p>
    </div>
  );
}
