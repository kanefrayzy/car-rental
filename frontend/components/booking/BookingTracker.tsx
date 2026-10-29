"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { CalendarIcon, CheckIcon, PhoneIcon } from "@/components/ui/icons";
import { cars } from "@/config/cars";
import { site } from "@/config/site";
import { usd } from "@/config/terms";
import { ApiError, getBooking, type BookingDetails, type BookingLink } from "@/lib/api";
import { forgetBooking, saveBooking } from "@/lib/savedBooking";
import { occasionLabel } from "@/config/content";
import { formatTime } from "@/lib/time";
import { formatDate } from "@/lib/validation";
import { DepositPayment, trackPayment } from "./DepositPayment";
import { DocumentsForm } from "./DocumentsForm";
import { PriceSummary } from "./PriceSummary";

const callUs = `Call or text ${site.phone.display} and we’ll send you a new link.`;

/** Why the link cannot be used, in words for the customer. */
function linkProblem(error: unknown): string {
  if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
    return `This link has expired or isn’t valid. ${callUs}`;
  }
  return error instanceof ApiError ? error.message : `Something went wrong loading your booking. ${callUs}`;
}

const formatMoment = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

type StepState = "done" | "current" | "upcoming";

/**
 * The customer's booking page (/booking): where the request stands, and the one thing to do
 * next. The link from the request or any email carries the booking and its signature; the
 * API decides whether it is still good. Payments are confirmed by Stripe's webhook, so after
 * paying the page shows the payment at once and reloads the booking a moment later.
 */
export function BookingTracker() {
  const [link, setLink] = useState<BookingLink | null>(null);
  const [justSent, setJustSent] = useState(false);
  const [details, setDetails] = useState<BookingDetails | null>(null);
  const [problem, setProblem] = useState("");
  const [paid, setPaid] = useState({ deposit: false, rental: false });
  const [showDocuments, setShowDocuments] = useState(false);
  // Back from a payment that Stripe sent elsewhere first (a bank check): which one went through.
  const [returnedPayment, setReturnedPayment] = useState<"deposit" | "rental" | null>(null);

  // The link's values are in the address, which only the browser knows (the page is static).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bookingId = params.get("booking");
    const expires = params.get("expires");
    const signature = params.get("signature");
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!bookingId || !expires || !signature) {
      setProblem(`This link is incomplete. Use the link in your email, or ${callUs.toLowerCase()}`);
      return;
    }
    setLink({ bookingId, expires, signature });
    if (params.get("new") === "1") {
      setJustSent(true);
      // Keep the address clean for bookmarking: the banner is for this visit only.
      params.delete("new");
      window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
    }
    const paidKind = params.get("paid");
    if (paidKind === "deposit" || paidKind === "rental") {
      if (["succeeded", "processing"].includes(params.get("redirect_status") ?? "")) setReturnedPayment(paidKind);
      for (const key of ["paid", "redirect_status", "payment_intent", "payment_intent_client_secret"]) params.delete(key);
      window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const load = useCallback(
    (current: BookingLink) =>
      getBooking(current)
        .then((next) => {
          setDetails(next);
          // Opened from an email on this device: the header's "My booking" leads back here.
          saveBooking(current);
        })
        .catch((error) => {
          setProblem(linkProblem(error));
          if (error instanceof ApiError && (error.status === 403 || error.status === 404)) forgetBooking(current.bookingId);
        }),
    [],
  );

  useEffect(() => {
    if (link) load(link);
  }, [link, load]);

  // Counted once the booking is loaded, with the amount.
  useEffect(() => {
    if (!details || !link || !returnedPayment) return;
    trackPayment(link.bookingId, returnedPayment, returnedPayment === "rental" ? details.rentalTotalUsd : details.depositUsd);
  }, [details, link, returnedPayment]);

  const paidNow = (kind: "deposit" | "rental") => {
    setPaid((current) => ({ ...current, [kind]: true }));
    // Stripe's webhook updates the booking within a few seconds.
    if (link) [3000, 8000].forEach((ms) => setTimeout(() => load(link), ms));
  };

  if (problem) {
    return (
      <div role="alert" className="max-w-[40rem] rounded-card border border-line bg-card p-6 shadow-card">
        <h2 className="text-lg font-bold">We can’t open this booking</h2>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">{problem}</p>
        <a href={site.phone.href} className="mt-4 inline-flex items-center gap-2 font-medium text-brand-deep">
          <PhoneIcon /> {site.phone.display}
        </a>
      </div>
    );
  }
  if (!details || !link) return <TrackerSkeleton />;

  const car = cars.find((item) => item.slug === details.carSlug) ?? cars[0];
  const cancelled = details.status === "cancelled";
  const depositDone = details.depositPaid || paid.deposit || details.status === "deposit_paid";
  const depositOpen = details.awaitingDeposit && !depositDone;
  const docsDone = details.documents.license && details.documents.insurance;
  const returned = details.status === "returned";
  const confirmed = details.status === "confirmed" || returned;
  const rentalDone = details.rentalPaid || paid.rental;
  const rentalOpen = details.rentalDue && !rentalDone;

  // The first unfinished step is the one the customer is on.
  const order = [
    { key: "deposit", done: depositDone || !details.awaitingDeposit },
    { key: "documents", done: docsDone },
    { key: "confirm", done: confirmed },
    { key: "rental", done: rentalDone },
  ] as const;
  const currentKey = order.find((step) => !step.done)?.key ?? "pickup";
  const state = (key: (typeof order)[number]["key"] | "pickup", done: boolean): StepState =>
    done ? "done" : key === currentKey ? "current" : "upcoming";

  const status = cancelled
    ? { label: "Cancelled", tone: "muted" as const }
    : returned
      ? { label: "Returned", tone: rentalOpen ? ("brand" as const) : ("success" as const) }
      : rentalDone
      ? { label: "Paid · ready for pickup", tone: "success" as const }
      : confirmed
        ? { label: "Confirmed · payment due", tone: "brand" as const }
        : depositOpen
          ? { label: "Waiting for your deposit", tone: "warning" as const }
          : !docsDone
            ? { label: "Waiting for your documents", tone: "warning" as const }
            : { label: "In review", tone: "brand" as const };

  const nextAction = cancelled
    ? "This booking was cancelled."
    : returned
      ? rentalOpen
        ? `Next: pay ${usd(details.rentalTotalUsd)} for the rental.`
        : "The car is back. Thank you for driving with us."
      : rentalDone
      ? "All set. We’ll be in touch to arrange pickup."
      : rentalOpen
        ? `Next: pay ${usd(details.rentalTotalUsd)} for the rental, any time before pickup.`
        : depositOpen
          ? `Next: pay the ${usd(details.depositUsd)} refundable deposit to lock your dates.`
          : !docsDone && details.acceptsUploads
            ? "Next: upload your driver’s license and proof of insurance."
            : "Nothing to do right now. We’re reviewing your request and will email you.";

  const quote = {
    days: details.days,
    pricePerDay: details.pricePerDay,
    rentalUsd: details.rentalUsd,
    taxRate: details.taxRate,
    taxUsd: details.taxUsd,
    totalUsd: details.rentalTotalUsd,
    depositUsd: details.depositUsd,
  };

  // The customer's own page: name, email, dates, amounts and the signed links stay out of
  // Clarity's recordings (lib/clarity.ts). Stripe's card fields are iframes it never records.
  return (
    <div data-clarity-mask="true">
      {justSent && !cancelled && (
        <div
          role="status"
          className="mb-6 flex gap-4 rounded-card border border-success/25 bg-success/5 p-5 motion-safe:animate-fade-in sm:items-center"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success text-xl text-white">
            <CheckIcon />
          </span>
          <div>
            <p className="font-semibold text-ink">Request sent. Thanks, {details.firstName}!</p>
            <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">
              This is your booking page. We emailed its link to <span className="font-medium">{details.email}</span>, so
              you can come back to it any time.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
        <p className="text-sm text-muted">Reference {details.bookingId}</p>
      </div>
      <p className="mt-3 text-lead font-medium text-ink">{nextAction}</p>

      <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_25rem] xl:gap-12">
        {cancelled ? (
          <section className="rounded-card border border-line bg-card p-6 shadow-card sm:p-8">
            <h2 className="text-lg font-bold">This booking was cancelled</h2>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">
              Anything you paid by card goes back to the same card; banks usually show it within 5 to 10 business days.
              Want to pick new dates?
            </p>
            <Link href={`/book/${car.slug}`} className="mt-4 inline-block font-medium text-brand-deep hover:underline">
              Book again
            </Link>
          </section>
        ) : (
          <ol className="rounded-card border border-line bg-card p-5 shadow-card sm:p-8" aria-label="Booking steps">
            <Step
              state="done"
              title="Request sent"
              meta={details.requestedAt ? formatMoment(details.requestedAt) : undefined}
            />

            <Step
              state={state("deposit", depositDone || !details.awaitingDeposit)}
              title={`Refundable deposit · ${usd(details.depositUsd)}`}
              meta={
                depositDone
                  ? "Paid. It comes back after the car is checked in."
                  : !details.awaitingDeposit
                    ? "Due before pickup. We’ll arrange it with you."
                    : details.holdExpired
                      ? "The hold on your dates has ended. Pay now to lock them if they’re still free."
                      : details.holdEndsAt
                        ? `Your dates are held until ${formatMoment(details.holdEndsAt)}. The deposit locks them.`
                        : undefined
              }
              warn={depositOpen && details.holdExpired}
            >
              {depositOpen && (
                <div className="mt-4 rounded-btn-lg border border-line-strong p-4 sm:p-5">
                  <DepositPayment
                    bookingId={details.bookingId}
                    amountUsd={details.depositUsd}
                    onPaid={() => paidNow("deposit")}
                  />
                </div>
              )}
            </Step>

            <Step
              state={state("documents", docsDone)}
              title="Driver’s license and insurance"
              meta={
                docsDone
                  ? "Both received. Thank you."
                  : !details.acceptsUploads
                    ? `This booking no longer takes documents. Questions? Call ${site.phone.display}.`
                    : "A photo of your license and your full coverage insurance card."
              }
            >
              {details.acceptsUploads &&
                (currentKey === "documents" || showDocuments ? (
                  <div className="mt-4">
                    <DocumentsForm
                      link={link}
                      documents={details.documents}
                      onUploaded={(next) => {
                        setDetails((current) => (current ? { ...current, documents: next.documents } : next));
                        setShowDocuments(false);
                      }}
                    />
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setShowDocuments(true)} className="mt-3">
                    {docsDone ? "Replace a file" : "Upload now"}
                  </Button>
                ))}
            </Step>

            <Step
              state={state("confirm", confirmed)}
              title="We confirm your booking"
              meta={
                confirmed
                  ? "Confirmed. The car is reserved for you."
                  : "We check your request and documents and confirm by email, usually the same day."
              }
            />

            <Step
              state={state("rental", rentalDone)}
              title={`Pay for the rental · ${usd(details.rentalTotalUsd)}`}
              meta={
                rentalDone
                  ? "Paid. Thank you!"
                  : rentalOpen
                    ? "Rental and tax, due before pickup."
                    : "Opens here once we confirm. Due before pickup."
              }
            >
              {rentalOpen && (
                <div className="mt-4 rounded-btn-lg border border-line-strong p-4 sm:p-5">
                  <DepositPayment
                    bookingId={details.bookingId}
                    amountUsd={details.rentalTotalUsd}
                    kind="rental"
                    onPaid={() => paidNow("rental")}
                  />
                </div>
              )}
            </Step>

            <Step
              state={state("pickup", returned)}
              title={`Pickup · ${formatDate(details.pickupDate)}, ${formatTime(details.pickupTime)}`}
              meta={`Return by ${formatDate(details.returnDate)}, ${formatTime(details.returnTime)}. We call or text to arrange pickup in ${site.location.city} or delivery. Bring your driver’s license and the credit card in your name.`}
              last
            />
          </ol>
        )}

        <aside className="lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]" aria-label="Booking summary">
          <div className="overflow-hidden rounded-card border border-line bg-card shadow-card">
            <div className="relative aspect-[16/9] bg-surface">
              <Image
                src={car.gallery.find((image) => image.src.includes("three-quarter"))?.src ?? car.gallery[0].src}
                alt=""
                fill
                sizes="(min-width: 80rem) 25rem, (min-width: 64rem) 22rem, 100vw"
                className="object-cover"
              />
            </div>
            <div className="p-5 sm:p-6">
              <h2 className="text-lg font-bold">{car.name}</h2>
              <p className="mt-0.5 text-[0.8125rem] text-muted">{details.carName}</p>
              <div className="mt-4 flex items-center gap-3 rounded-btn-lg bg-surface px-3.5 py-3 text-sm">
                <CalendarIcon className="shrink-0 text-lg text-brand-deep" />
                <p className="text-ink">
                  <span className="block font-medium">
                    {formatDate(details.pickupDate)}, {formatTime(details.pickupTime)}
                  </span>
                  <span className="block font-medium">
                    to {formatDate(details.returnDate)}, {formatTime(details.returnTime)}
                  </span>
                  <span className="text-muted">
                    {details.days} {details.days === 1 ? "day" : "days"} · New York time
                  </span>
                  {details.occasion && (
                    <span className="block text-muted">Occasion: {occasionLabel(details.occasion)}</span>
                  )}
                </p>
              </div>
              <PriceSummary quote={quote} className="mt-5" />
            </div>
          </div>

          <div className="mt-5 rounded-card border border-line bg-card p-5 text-sm sm:p-6">
            <h2 className="text-base font-bold">Questions or changes?</h2>
            <p className="mt-1.5 leading-relaxed text-muted">Call or text us at the number below.</p>
            <a
              href={site.phone.href}
              className="mt-3 flex items-center gap-2 font-medium text-ink-soft hover:text-brand-deep"
            >
              <PhoneIcon className="text-brand-deep" />
              {site.phone.display}
            </a>
            <Link href="/rental-terms" className="mt-2 block font-medium text-brand-deep hover:underline">
              Rental Terms
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Step({
  state,
  title,
  meta,
  warn = false,
  last = false,
  children,
}: {
  state: StepState;
  title: string;
  meta?: string;
  warn?: boolean;
  last?: boolean;
  children?: ReactNode;
}) {
  return (
    <li
      aria-current={state === "current" ? "step" : undefined}
      className={`relative flex gap-4 ${last ? "" : "pb-7"} sm:gap-5`}
    >
      {!last && (
        <span
          aria-hidden="true"
          className={`absolute top-10 bottom-1 left-[1.0625rem] w-0.5 rounded-full ${state === "done" ? "bg-success/35" : "bg-line-strong"}`}
        />
      )}
      <span
        className={`relative flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          state === "done"
            ? "bg-success text-white"
            : state === "current"
              ? "bg-brand-deep text-white ring-4 ring-tint"
              : "border-2 border-line-strong bg-card text-muted"
        }`}
      >
        {state === "done" ? <CheckIcon className="text-base" /> : <span className="size-2 rounded-full bg-current" />}
        <span className="sr-only">{state === "done" ? "Done: " : state === "current" ? "Current step: " : "Later: "}</span>
      </span>
      <div className="min-w-0 flex-1 pt-1.5">
        <h3 className={`text-base leading-snug font-semibold ${state === "upcoming" ? "text-ink-soft" : "text-ink"}`}>
          {title}
        </h3>
        {meta && (
          <p className={`mt-1 text-sm leading-relaxed ${warn ? "font-medium text-warning" : "text-muted"}`}>{meta}</p>
        )}
        {children}
      </div>
    </li>
  );
}

const tones = {
  success: "bg-success/10 text-success",
  brand: "bg-tint text-brand-deep",
  warning: "bg-warning/10 text-warning",
  muted: "bg-surface text-muted",
};

function StatusPill({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold ${tones[tone]}`}>
      <span aria-hidden="true" className="size-2 rounded-full bg-current" />
      {children}
    </span>
  );
}

function TrackerSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your booking…</span>
      <div className="h-8 w-56 rounded-full bg-line motion-safe:animate-pulse" />
      <div className="mt-4 h-6 w-full max-w-[30rem] rounded bg-line motion-safe:animate-pulse" />
      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="h-[28rem] rounded-card bg-card shadow-card motion-safe:animate-pulse" />
        <div className="h-[22rem] rounded-card bg-card shadow-card motion-safe:animate-pulse" />
      </div>
    </div>
  );
}
