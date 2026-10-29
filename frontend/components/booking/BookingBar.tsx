"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { ArrowRightIcon } from "@/components/ui/icons";
import type { Occasion } from "@/config/content";
import { site } from "@/config/site";
import { ApiError, checkAvailability } from "@/lib/api";
import { minutesOf, type TimeSlot } from "@/lib/time";
import { useBusinessNow } from "@/lib/useToday";
import { validateTrip, type IsoDate, type Trip } from "@/lib/validation";
import { DateField, openDatePicker } from "./DateField";
import { TimeField } from "./TimeField";

type Status =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "error"; message: string };

const { defaultTime } = site.booking.hours;

// The hero's date and time bar. Free dates open the car's booking page with the trip filled
// in (?pickup=…&pickupTime=…&return=…&returnTime=…); taken ones are reported right here.
// Below xl it is two rows (pick-up, return) and the button; from xl one row.
export function BookingBar({
  carSlug,
  occasion,
}: {
  carSlug: string;
  /** Passed on to the booking page (the service pages). */
  occasion?: Occasion;
}) {
  const router = useRouter();
  const now = useBusinessNow();
  const today = now?.date ?? "";
  const statusId = useId();
  const pickupRef = useRef<HTMLInputElement>(null);
  const returnRef = useRef<HTMLInputElement>(null);
  const [trip, setTrip] = useState<Trip>({
    pickupDate: "",
    pickupTime: defaultTime,
    returnDate: "",
    returnTime: defaultTime,
  });
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [invalid, setInvalid] = useState<Partial<Record<keyof Trip, boolean>>>({});

  const update = (next: Partial<Trip>) => {
    setTrip((current) => ({ ...current, ...next }));
    setInvalid({});
    setStatus({ kind: "idle" });
  };

  const changePickupDate = (value: IsoDate) => {
    // Keep the range valid: a return before the new pick-up is cleared.
    const keepReturn = trip.returnDate && value && trip.returnDate >= value;
    update({ pickupDate: value, returnDate: keepReturn ? trip.returnDate : "" });
    // The natural next step is the return date.
    if (value && !keepReturn) returnRef.current?.focus({ preventScroll: true });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!now) return;
    const errors = validateTrip(trip, now);
    const message = errors.pickupDate ?? errors.pickupTime ?? errors.returnDate ?? errors.returnTime;
    if (message) {
      setInvalid(Object.fromEntries(Object.keys(errors).map((key) => [key, true])));
      setStatus({ kind: "error", message });
      // Take the visitor straight to the date that needs attention.
      if (errors.pickupDate) openDatePicker(pickupRef.current);
      else if (errors.returnDate) openDatePicker(returnRef.current);
      return;
    }

    setStatus({ kind: "checking" });
    try {
      const result = await checkAvailability({ carSlug, ...trip });
      if (!result.available) {
        setInvalid({ pickupDate: true, returnDate: true });
        setStatus({ kind: "error", message: "Those dates are already booked. Try different dates." });
        return;
      }
      // Free: continue on the booking page. The status stays "checking", so the button keeps
      // its spinner while the page opens.
      router.push(
        `/book/${carSlug}?${new URLSearchParams({
          pickup: trip.pickupDate,
          pickupTime: trip.pickupTime,
          return: trip.returnDate,
          returnTime: trip.returnTime,
          ...(occasion ? { occasion } : {}),
        })}`,
      );
    } catch (error) {
      setStatus({
        kind: "error",
        message:
          error instanceof ApiError
            ? error.message
            : `We couldn’t check availability. Try again or call ${site.phone.display}.`,
      });
    }
  };

  const checking = status.kind === "checking";
  // Today's passed slots, and on a same-day rental anything not after the pick-up.
  const pickupDisabled = (slot: TimeSlot) => !!now && trip.pickupDate === now.date && minutesOf(slot) <= now.minutes;
  const returnDisabled = (slot: TimeSlot) =>
    trip.returnDate !== "" && trip.returnDate === trip.pickupDate && minutesOf(slot) <= minutesOf(trip.pickupTime);

  const date = "h-[3.25rem] min-w-0 flex-1 px-3 xl:h-[3.9375rem] xl:gap-3 xl:pr-3 xl:pl-5";
  const time = "h-[3.25rem] w-[8.25rem] shrink-0 px-3 xl:h-[3.9375rem] xl:w-[6.5rem] xl:pl-3 xl:pr-2";
  const divider = <span aria-hidden="true" className="my-2.5 w-px shrink-0 bg-line xl:my-3.5" />;

  return (
    <form id="availability-form" onSubmit={submit} noValidate aria-label="Check availability" className="relative">
      <div className="rounded-card bg-card p-2.5 shadow-bar xl:flex xl:items-center xl:rounded-btn-lg xl:p-0 xl:pr-2.5">
        <div className="xl:flex xl:flex-1">
          <div className="flex xl:min-w-0 xl:flex-1">
            <DateField
              label="Pick-up date"
              value={trip.pickupDate}
              onChange={changePickupDate}
              min={today}
              invalid={invalid.pickupDate}
              describedBy={statusId}
              inputRef={pickupRef}
              compact
              className={`${date} xl:rounded-l-btn-lg`}
            />
            {divider}
            <TimeField
              label="Pick-up time"
              value={trip.pickupTime}
              onChange={(pickupTime) => update({ pickupTime })}
              isDisabled={pickupDisabled}
              invalid={invalid.pickupTime}
              describedBy={statusId}
              compact
              className={time}
            />
          </div>
          <span aria-hidden="true" className="mx-3 block h-px bg-line xl:mx-0 xl:my-3.5 xl:h-auto xl:w-px" />
          <div className="flex xl:min-w-0 xl:flex-1">
            <DateField
              label="Return date"
              value={trip.returnDate}
              onChange={(returnDate) => update({ returnDate })}
              min={trip.pickupDate || today}
              invalid={invalid.returnDate}
              describedBy={statusId}
              inputRef={returnRef}
              compact
              className={date}
            />
            {divider}
            <TimeField
              label="Return time"
              value={trip.returnTime}
              onChange={(returnTime) => update({ returnTime })}
              isDisabled={returnDisabled}
              invalid={invalid.returnTime}
              describedBy={statusId}
              compact
              className={time}
            />
          </div>
        </div>
        <Button
          type="submit"
          loading={checking}
          className="mt-1.5 w-full max-xl:rounded-btn-lg xl:mt-0 xl:ml-1 xl:h-[2.6875rem] xl:w-[10rem] xl:px-0 xl:text-sm"
        >
          {checking ? "Checking…" : "Check Availability"}
          {!checking && <ArrowRightIcon className="text-base xl:hidden" />}
        </Button>
      </div>

      {/* Absolutely positioned so a message never shifts the hero layout. */}
      <p
        id={statusId}
        role="status"
        className="absolute top-full left-0 mt-2 rounded-btn bg-card/95 px-3 py-1.5 text-[0.8125rem] font-medium text-danger shadow-card empty:hidden"
      >
        {status.kind === "error" ? status.message : ""}
      </p>
    </form>
  );
}
