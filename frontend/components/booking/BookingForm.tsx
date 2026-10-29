"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { ArrowRightIcon, CalendarIcon, CheckIcon, ChevronDownIcon, PhoneIcon, SpinnerIcon } from "@/components/ui/icons";
import type { Car } from "@/config/cars";
import { bookingJourneyFor, isOccasion, occasionLabel, occasions, type Occasion } from "@/config/content";
import { site } from "@/config/site";
import { priceWithTax, rentalTerms, usd } from "@/config/terms";
import { track } from "@/lib/analytics";
import { ApiError, bookingPagePath, checkAvailability, submitBookingRequest } from "@/lib/api";
import { saveBooking } from "@/lib/savedBooking";
import { billedDays, formatTime, isTimeSlot, minutesOf, type TimeSlot } from "@/lib/time";
import { useBusinessNow } from "@/lib/useToday";
import {
  formatDate,
  formatUsPhone,
  parseIsoDate,
  validateContact,
  validateTrip,
  type ContactErrors,
  type ContactValues,
  type Trip,
  type TripErrors,
} from "@/lib/validation";
import { DateField } from "./DateField";
import { PriceSummary, type PriceQuote } from "./PriceSummary";
import { TimeField } from "./TimeField";

type Availability =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "unavailable"; message: string };

/**
 * What the visitor has typed, kept in this browser (localStorage) until the request is sent,
 * so leaving the page, closing the tab or coming back tomorrow loses nothing.
 */
const DRAFT_KEY = "bueno:booking-draft";
type Draft = ContactValues & Trip & { occasion?: Occasion | null };

const { defaultTime } = site.booking.hours;
const EMPTY_TRIP: Trip = { pickupDate: "", pickupTime: defaultTime, returnDate: "", returnTime: defaultTime };

/** "Oct 25, 2026, 10:00 AM" */
const formatMoment = (date: string, time: TimeSlot) => `${formatDate(date)}, ${formatTime(time)}`;

function readDraft(): Partial<Draft> {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") as Partial<Draft>;
  } catch {
    return {};
  }
}

function writeDraft(draft: Draft | null) {
  try {
    if (draft) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage blocked: the form still works, it just isn't remembered.
  }
}

/**
 * The booking request, on its own page (/book/[slug]): dates and times, driver and agreement
 * in one form, with the price and the steps after it beside it. Availability is checked as
 * soon as the trip is complete. A sent request opens the customer's booking page, where the
 * deposit and the documents come next. Times are New York time; days are charged per
 * started 24 hours from the pick-up time.
 */
export function BookingForm({ car, depositUsd }: { car: Car; depositUsd: number }) {
  const router = useRouter();
  const now = useBusinessNow();
  const today = now?.date ?? "";
  const formId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const datesRef = useRef<HTMLDivElement>(null);
  const termsRef = useRef<HTMLInputElement>(null);

  const [trip, setTripState] = useState<Trip>(EMPTY_TRIP);
  const [contact, setContact] = useState<ContactValues>({ name: "", phone: "", email: "" });
  const [occasion, setOccasion] = useState<Occasion | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [dateErrors, setDateErrors] = useState<TripErrors>({});
  const [contactErrors, setContactErrors] = useState<ContactErrors>({});
  const [termsError, setTermsError] = useState("");
  const [availability, setAvailability] = useState<Availability>({ state: "idle" });
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [restored, setRestored] = useState(false);
  const checkCount = useRef(0);
  // Analytics (booking funnel steps): where the dates came from, and what was already counted.
  const datesFrom = useRef<"link" | "draft" | "form">("form");
  const countedTrips = useRef(new Set<string>());
  const datesAnswered = useRef(false);
  const detailsInView = useRef(false);
  const detailsCounted = useRef(false);
  // booking_details_view: once, when the visitor reaches Driver details: a tap in one of its
  // fields, or the section half on screen once the dates got their answer.
  const countDetails = (reached: boolean) => {
    if (detailsCounted.current || !reached) return;
    detailsCounted.current = true;
    track("booking_details_view");
  };

  const { pickupDate, pickupTime, returnDate, returnTime } = trip;

  // The trip from the hero bar comes in the address (?pickup=…&pickupTime=…&return=…&returnTime=…),
  // and so does the occasion from its card (?occasion=wedding); the rest of an unfinished
  // request comes from this browser's draft.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const draft = readDraft();
    const time = (value: string | null | undefined) => (value && isTimeSlot(value) ? value : defaultTime);
    const fromUrl = parseIsoDate(params.get("pickup") ?? "") && parseIsoDate(params.get("return") ?? "");
    datesFrom.current = fromUrl ? "link" : draft.pickupDate && draft.returnDate ? "draft" : "form";
    // Restoring browser-held state once after mount; there is no server value to match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTripState(
      fromUrl
        ? {
            pickupDate: params.get("pickup")!,
            pickupTime: time(params.get("pickupTime")),
            returnDate: params.get("return")!,
            returnTime: time(params.get("returnTime")),
          }
        : {
            pickupDate: draft.pickupDate ?? "",
            pickupTime: time(draft.pickupTime),
            returnDate: draft.returnDate ?? "",
            returnTime: time(draft.returnTime),
          },
    );
    setContact({ name: draft.name ?? "", phone: formatUsPhone(draft.phone ?? ""), email: draft.email ?? "" });
    const fromCard = params.get("occasion");
    setOccasion(isOccasion(fromCard) ? fromCard : isOccasion(draft.occasion) ? draft.occasion : null);
    setRestored(true);
  }, []);

  useEffect(() => {
    if (restored) writeDraft({ ...trip, ...contact, occasion });
  }, [restored, trip, contact, occasion]);

  // The trip is checkable once it passes the period rules; the minute matters only for today.
  const tripReady = !!now && Object.keys(validateTrip(trip, now)).length === 0;

  // Check availability whenever the trip is complete and valid. Only the latest answer counts.
  useEffect(() => {
    if (!tripReady) {
      // Dates cleared or made invalid: drop any answer still on its way, and stop "Checking…".
      checkCount.current++;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAvailability({ state: "idle" });
      return;
    }

    const id = ++checkCount.current;
    setAvailability({ state: "checking" });
    // booking_dates_selected: once per trip, with the answer. No dates or personal data in it.
    const counted = (availability: "available" | "unavailable" | "error") => {
      const key = [pickupDate, pickupTime, returnDate, returnTime].join(" ");
      if (countedTrips.current.has(key)) return;
      countedTrips.current.add(key);
      datesAnswered.current = true;
      track("booking_dates_selected", {
        rental_days: billedDays(pickupDate, pickupTime, returnDate, returnTime),
        availability,
        dates_from: datesFrom.current,
      });
      countDetails(detailsInView.current);
    };
    const timer = setTimeout(() => {
      checkAvailability({ carSlug: car.slug, pickupDate, pickupTime, returnDate, returnTime })
        .then((result) => {
          if (id !== checkCount.current) return;
          counted(result.available ? "available" : "unavailable");
          setAvailability(
            result.available
              ? { state: "available" }
              : { state: "unavailable", message: "Those dates are already booked. Try different dates." },
          );
        })
        .catch((error) => {
          if (id !== checkCount.current) return;
          counted("error");
          setAvailability({
            state: "unavailable",
            message:
              error instanceof ApiError
                ? error.message
                : `We couldn’t check availability. Try again or call ${site.phone.display}.`,
          });
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [car.slug, pickupDate, pickupTime, returnDate, returnTime, tripReady]);

  useEffect(() => {
    const section = nameRef.current?.closest("section");
    if (!section) return;
    const focused = () => countDetails(true);
    const observer = new IntersectionObserver(
      (entries) => {
        detailsInView.current = entries[entries.length - 1].isIntersecting;
        countDetails(detailsInView.current && datesAnswered.current);
      },
      { threshold: 0.5 },
    );
    observer.observe(section);
    section.addEventListener("focusin", focused);
    return () => {
      observer.disconnect();
      section.removeEventListener("focusin", focused);
    };
  }, []);

  const setTrip = (next: Partial<Trip>) => {
    datesFrom.current = "form";
    setTripState((current) => ({ ...current, ...next }));
    setDateErrors({});
    setAvailability({ state: "idle" });
    checkCount.current++;
  };

  const days = billedDays(pickupDate, pickupTime, returnDate, returnTime);
  const datesValid = days > 0;
  const rentalUsd = datesValid ? days * car.pricePerDay : 0;
  const { taxUsd, totalUsd } = priceWithTax(rentalUsd);
  const quote: PriceQuote | null = datesValid
    ? {
        days,
        pricePerDay: car.pricePerDay,
        rentalUsd,
        taxRate: rentalTerms.taxRatePercent,
        taxUsd,
        totalUsd,
        depositUsd,
      }
    : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;

    if (!now) return;
    const nextDateErrors = validateTrip(trip, now);
    const nextContactErrors = validateContact(contact);
    setDateErrors(nextDateErrors);
    setContactErrors(nextContactErrors);
    setTermsError(acceptTerms ? "" : "Agree to the Rental Terms to send your request.");

    // Take the visitor to the first thing that needs attention.
    if (Object.keys(nextDateErrors).length || availability.state === "unavailable") {
      datesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (Object.values(nextContactErrors).some(Boolean)) {
      nameRef.current?.closest("section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (!acceptTerms) {
      termsRef.current?.focus();
      return;
    }

    setBusy(true);
    setSubmitError("");
    try {
      const result = await submitBookingRequest({ carSlug: car.slug, ...trip, ...contact, occasion, acceptTerms });
      writeDraft(null);
      saveBooking(result.link);
      track("booking_submit", { value: totalUsd, currency: "USD", occasion: occasion || undefined });
      router.push(bookingPagePath(result.link, { new: "1" }));
    } catch (error) {
      setBusy(false);
      if (error instanceof ApiError && error.status === 409) {
        setAvailability({ state: "unavailable", message: error.message });
        datesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      setSubmitError(
        error instanceof ApiError ? error.message : `We couldn’t send your request. Try again or call ${site.phone.display}.`,
      );
    }
  };

  const field = (key: keyof ContactValues) => ({
    value: contact[key],
    error: contactErrors[key],
    onChange: (value: string) => {
      // The phone is masked as it is typed: (631) 555-0142.
      setContact((current) => ({ ...current, [key]: key === "phone" ? formatUsPhone(value, current.phone) : value }));
      setContactErrors((current) => ({ ...current, [key]: undefined }));
    },
  });

  const fieldClass = (error?: string) =>
    `h-[3.75rem] rounded-btn-lg border bg-card px-3 sm:px-4 ${error ? "border-danger" : "border-line-strong"}`;
  // Today's passed slots, and on a same-day rental anything not after the pick-up.
  const pickupDisabled = (slot: TimeSlot) => !!now && pickupDate === now.date && minutesOf(slot) <= now.minutes;
  const returnDisabled = (slot: TimeSlot) =>
    returnDate !== "" && returnDate === pickupDate && minutesOf(slot) <= minutesOf(pickupTime);
  const { open, close } = site.booking.hours;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_26rem] xl:gap-12">
      <form id="booking-form" onSubmit={submit} noValidate data-clarity-mask="true" className="grid gap-4 sm:gap-5">
        <div className="flex items-center gap-4 rounded-card border border-line bg-card p-3 shadow-card lg:hidden">
          <div className="relative aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-btn-lg bg-surface sm:w-32">
            <Image src={carImage(car)} alt="" fill sizes="8rem" className="object-cover" />
          </div>
          <div className="min-w-0">
            <p className="font-display font-bold text-ink">{car.name}</p>
            <p className="mt-0.5 text-[0.8125rem] leading-snug text-muted">{car.fullName}</p>
            <p className="mt-1 text-sm text-muted">
              <span className="font-semibold text-ink">{usd(car.pricePerDay)}</span>/day + tax
            </p>
          </div>
        </div>

        <FormSection
          number={1}
          title="Choose your dates and times"
          intro={`Pick-up and return from ${formatTime(open)} to ${formatTime(close)}, New York time.`}
        >
          <div ref={datesRef} className="grid gap-3">
            <TripRow
              dateError={dateErrors.pickupDate}
              timeError={dateErrors.pickupTime}
              date={(errorId) => (
                <DateField
                  label="Pick-up date"
                  value={pickupDate}
                  min={today}
                  invalid={!!dateErrors.pickupDate}
                  describedBy={errorId}
                  onChange={(value) => {
                    const keepReturn = returnDate && value && returnDate >= value;
                    setTrip({ pickupDate: value, returnDate: keepReturn ? returnDate : "" });
                  }}
                  roomyOnPhone
                  className={fieldClass(dateErrors.pickupDate)}
                />
              )}
              time={(errorId) => (
                <TimeField
                  label="Pick-up time"
                  value={pickupTime}
                  isDisabled={pickupDisabled}
                  invalid={!!dateErrors.pickupTime}
                  describedBy={errorId}
                  onChange={(value) => setTrip({ pickupTime: value })}
                  roomyOnPhone
                  className={fieldClass(dateErrors.pickupTime)}
                />
              )}
            />
            <TripRow
              dateError={dateErrors.returnDate}
              timeError={dateErrors.returnTime}
              date={(errorId) => (
                <DateField
                  label="Return date"
                  value={returnDate}
                  min={pickupDate || today}
                  invalid={!!dateErrors.returnDate || availability.state === "unavailable"}
                  describedBy={errorId}
                  onChange={(value) => setTrip({ returnDate: value })}
                  roomyOnPhone
                  className={fieldClass(dateErrors.returnDate)}
                />
              )}
              time={(errorId) => (
                <TimeField
                  label="Return time"
                  value={returnTime}
                  isDisabled={returnDisabled}
                  invalid={!!dateErrors.returnTime}
                  describedBy={errorId}
                  onChange={(value) => setTrip({ returnTime: value })}
                  roomyOnPhone
                  className={fieldClass(dateErrors.returnTime)}
                />
              )}
            />
          </div>
          <AvailabilityLine availability={availability} days={datesValid ? days : 0} />
          {/* Phones and tablets: the total right under the dates (user, 2026-10-25: people from ads
              picked dates and left at Driver details, with the price still further down). The side
              panel shows the same quote from lg up. Free dates only. */}
          {quote && availability.state === "available" && (
            <div className="mt-4 rounded-btn-lg border border-line bg-surface p-4 lg:hidden" data-price-under-dates>
              <PriceSummary quote={quote} />
              <p className="mt-3 flex items-center gap-2 text-[0.8125rem] font-medium text-ink">
                <CheckIcon className="shrink-0 text-sm text-success" />
                Nothing is charged now.
              </p>
            </div>
          )}
          <OccasionField value={occasion} onChange={setOccasion} />
        </FormSection>

        <FormSection number={2} title="Driver details" intro="The person who will drive, as on their license.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <TextField label="Full name" autoComplete="name" inputRef={nameRef} {...field("name")} />
            </div>
            <TextField
              label="Mobile phone"
              type="tel"
              autoComplete="tel-national"
              placeholder="(631) 555-0142"
              {...field("phone")}
            />
            <TextField label="Email" type="email" autoComplete="email" {...field("email")} />
          </div>
          <p className="mt-3 text-[0.8125rem] text-muted">
            We text and email you about this booking only.
          </p>
        </FormSection>

        <FormSection number={3} title="Review and send">
          {quote ? (
            <PriceSummary quote={quote} className="mb-5 lg:hidden" />
          ) : (
            <p className="mb-5 text-sm text-muted lg:hidden">Choose your dates to see the total.</p>
          )}

          <div className="flex gap-3 rounded-btn-lg border border-line-strong px-4 py-3.5 text-sm leading-relaxed">
            <CheckIcon className="mt-0.5 shrink-0 text-base text-success" />
            <p>
              <span className="font-medium text-ink">Nothing is charged now.</span> Next you pay the{" "}
              {usd(depositUsd)} refundable deposit to lock your dates, and upload your license and
              insurance.
            </p>
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-3 text-[0.9375rem] text-ink">
            <input
              ref={termsRef}
              type="checkbox"
              checked={acceptTerms}
              onChange={(event) => {
                setAcceptTerms(event.target.checked);
                setTermsError("");
              }}
              aria-invalid={!!termsError || undefined}
              aria-describedby={termsError ? `${formId}-terms-error` : undefined}
              className="mt-0.5 size-5 shrink-0 accent-brand-deep"
            />
            <span>
              I agree to the{" "}
              <a
                href="/rental-terms"
                target="_blank"
                rel="noopener"
                className="font-medium text-brand-deep underline underline-offset-2 hover:no-underline"
              >
                Rental Terms
              </a>
              .
            </span>
          </label>
          {termsError && (
            <p id={`${formId}-terms-error`} role="alert" className="mt-1.5 text-[0.8125rem] font-medium text-danger">
              {termsError}
            </p>
          )}

          {submitError && (
            <p role="alert" className="mt-4 rounded-btn-lg bg-danger/5 px-4 py-3 text-sm font-medium text-danger">
              {submitError}
            </p>
          )}

          <Button type="submit" size="lg" block loading={busy} className="mt-6">
            {busy ? "Sending…" : "Send booking request"}
            {!busy && <ArrowRightIcon className="text-lg" />}
          </Button>
          <p className="mt-3 text-center text-[0.8125rem] text-muted">
            Questions first?{" "}
            <a href={site.phone.href} className="font-medium text-brand-deep hover:underline">
              Call or text {site.phone.display}
            </a>
          </p>
        </FormSection>
      </form>

      <aside className="lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]" aria-label="Your booking">
        <div className="overflow-hidden rounded-card border border-line bg-card shadow-card max-lg:hidden">
          <div className="relative aspect-[16/9] bg-surface">
            <Image
              src={carImage(car)}
              alt=""
              fill
              sizes="(min-width: 80rem) 26rem, (min-width: 64rem) 23rem, 100vw"
              className="object-cover"
            />
          </div>
          <div className="p-5 sm:p-6">
            <p className="text-eyebrow font-semibold text-muted uppercase">{car.category}</p>
            <div className="mt-1.5 flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-bold">{car.name}</h2>
              <p className="text-sm whitespace-nowrap text-muted">
                <span className="font-display text-lg font-bold text-ink">{usd(car.pricePerDay)}</span>/day
              </p>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-btn-lg bg-surface px-3.5 py-3 text-sm">
              <CalendarIcon className="shrink-0 text-lg text-brand-deep" />
              {datesValid ? (
                <p className="text-ink">
                  <span className="block font-medium">{formatMoment(pickupDate, pickupTime)}</span>
                  <span className="block font-medium">to {formatMoment(returnDate, returnTime)}</span>
                  <span className="text-muted">
                    {days} {days === 1 ? "day" : "days"}, charged per 24 hours from pick-up
                  </span>
                  {occasion && <span className="block text-muted">Occasion: {occasionLabel(occasion)}</span>}
                </p>
              ) : (
                <p className="text-muted">Choose your dates to see the total.</p>
              )}
            </div>

            {quote && <PriceSummary quote={quote} className="mt-5 max-lg:hidden" />}

            <ul className="mt-5 grid gap-2 border-t border-line pt-5 text-[0.8125rem] text-ink-soft">
              <li className="flex gap-2.5">
                <CheckIcon className="mt-0.5 shrink-0 text-sm text-brand-deep" />
                {datesValid ? (days * site.booking.includedMilesPerDay).toLocaleString("en-US") : site.booking.includedMilesPerDay}{" "}
                miles{datesValid ? "" : " a day"} included, then ${site.booking.extraMileUsd} a mile
              </li>
              <li className="flex gap-2.5">
                <CheckIcon className="mt-0.5 shrink-0 text-sm text-brand-deep" />
                Free pickup in {site.location.city}, free delivery within {site.booking.delivery.freeRadiusMiles} miles
              </li>
              <li className="flex gap-2.5">
                <CheckIcon className="mt-0.5 shrink-0 text-sm text-brand-deep" />
                Driver {site.booking.minDriverAge}+ with a license and {rentalTerms.driver.insurance} insurance
              </li>
            </ul>
          </div>
        </div>

        <div className="rounded-card border border-line bg-card p-5 sm:p-6 lg:mt-5">
          <h2 className="text-base font-bold">What happens next</h2>
          <ol className="mt-4 grid gap-3.5">
            {bookingJourneyFor(depositUsd).map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-tint text-xs font-semibold text-brand-deep">
                  {index + 1}
                </span>
                <p className="text-sm leading-snug">
                  <span className="font-medium text-ink">{step.title}</span>
                  <span className="block text-[0.8125rem] text-muted">{step.text}</span>
                </p>
              </li>
            ))}
          </ol>
          <a
            href={site.phone.href}
            className="mt-5 flex items-center gap-2 border-t border-line pt-4 text-sm font-medium text-ink-soft hover:text-brand-deep"
          >
            <PhoneIcon className="text-brand-deep" />
            Call or text {site.phone.display}
          </a>
        </div>
      </aside>
    </div>
  );
}

/**
 * One leg of the trip: date and time side by side, each with its own error message below.
 * The time column is narrow: "10:00 AM" needs little room, the date more.
 */
function TripRow({
  date,
  time,
  dateError,
  timeError,
}: {
  date: (errorId: string | undefined) => ReactNode;
  time: (errorId: string | undefined) => ReactNode;
  dateError?: string;
  timeError?: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_8.75rem] gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
      <FieldMessage message={dateError}>{date}</FieldMessage>
      <FieldMessage message={timeError}>{time}</FieldMessage>
    </div>
  );
}

/** The three-quarter view, the photo that shows the car best. */
const carImage = (car: Car) =>
  car.gallery.find((image) => image.src.includes("three-quarter"))?.src ?? car.gallery[0].src;

function AvailabilityLine({ availability, days }: { availability: Availability; days: number }) {
  // A live region, so screen readers hear the result of the check.
  return (
    <p role="status" className="mt-3.5 flex min-h-6 items-center gap-2 text-sm">
      {availability.state === "checking" && (
        <>
          <SpinnerIcon className="text-base text-muted" />
          <span className="text-muted">Checking availability…</span>
        </>
      )}
      {availability.state === "available" && (
        <>
          <span className="flex size-5 items-center justify-center rounded-full bg-success text-white">
            <CheckIcon className="text-xs" />
          </span>
          <span className="font-medium text-success">
            Available for your dates · {days} {days === 1 ? "day" : "days"}
          </span>
        </>
      )}
      {availability.state === "unavailable" && <span className="font-medium text-danger">{availability.message}</span>}
      {availability.state === "idle" && (
        <span className="text-muted">Choose both dates to check availability.</span>
      )}
    </p>
  );
}

/** What the car is for: optional, chosen already when the visitor came from an Occasions card. */
function OccasionField({ value, onChange }: { value: Occasion | null; onChange: (value: Occasion | null) => void }) {
  const id = useId();
  return (
    <div className="mt-5 border-t border-line pt-5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        What’s the occasion? <span className="font-normal text-muted">(optional)</span>
      </label>
      <div className="relative mt-1.5">
        <select
          id={id}
          value={value ?? ""}
          onChange={(event) => onChange(isOccasion(event.target.value) ? event.target.value : null)}
          className="block h-12 w-full appearance-none rounded-btn-lg border border-line-strong bg-card pr-11 pl-4 text-base text-ink transition-colors hover:border-brand-deep/50"
        >
          <option value="">No special occasion</option>
          {occasions.map((occasion) => (
            <option key={occasion.slug} value={occasion.slug}>
              {occasion.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm text-muted" />
      </div>
    </div>
  );
}

function FormSection({
  number,
  title,
  intro,
  children,
}: {
  number: number;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="rounded-card border border-line bg-card p-5 shadow-card sm:p-7">
      <div className="mb-5 flex items-start gap-3.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-navy font-display text-sm font-bold text-white">
          {number}
        </span>
        <div className="pt-0.5">
          <h2 id={id} className="text-lg leading-tight font-bold">
            {title}
          </h2>
          {intro && <p className="mt-1 text-sm text-muted">{intro}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/** A field with its error message below, wired up via aria-describedby. */
function FieldMessage({
  message,
  children,
}: {
  message?: string;
  children: (errorId: string | undefined) => ReactNode;
}) {
  const id = useId();
  return (
    <div>
      {children(message ? id : undefined)}
      {message && (
        <p id={id} role="alert" className="mt-1.5 text-[0.8125rem] font-medium text-danger">
          {message}
        </p>
      )}
    </div>
  );
}

function TextField({
  label,
  value,
  error,
  onChange,
  type = "text",
  autoComplete,
  placeholder,
  inputRef,
}: {
  label: string;
  placeholder?: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  type?: "text" | "tel" | "email";
  autoComplete: string;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1.5 block h-12 w-full rounded-btn-lg border bg-card px-4 text-base text-ink transition-colors placeholder:text-muted hover:border-brand-deep/50 ${
          error ? "border-danger" : "border-line-strong"
        }`}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-[0.8125rem] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
