import { site } from "@/config/site";
import { billedDays, isTimeSlot, minutesOf, tripMinutes, type TimeSlot } from "./time";

/** Dates travel as ISO strings (yyyy-mm-dd), the same format <input type="date"> uses. */
export type IsoDate = string;

export function toIsoDate(date: Date): IsoDate {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Parses as local midnight. `new Date("2026-01-05")` would be UTC and can shift a day. */
export function parseIsoDate(value: IsoDate): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);
  return date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

export function addDays(value: IsoDate, days: number): IsoDate {
  const date = parseIsoDate(value);
  if (!date) return value;
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}


export function formatDate(value: IsoDate): string {
  const date = parseIsoDate(value);
  if (!date) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** A rental period: dates and "HH:MM" times, New York time. */
export type Trip = { pickupDate: IsoDate; pickupTime: TimeSlot; returnDate: IsoDate; returnTime: TimeSlot };
export type TripErrors = Partial<Record<keyof Trip, string>>;

/**
 * The period rules the API also checks (ValidatesRentalPeriod): pick-up not in the past
 * (today's passed slots included), return after pick-up (the same day is fine), at most
 * maxRentalDays charged days. `now` is New York's date and time (useBusinessNow).
 */
export function validateTrip(trip: Trip, now: { date: IsoDate; minutes: number }): TripErrors {
  const { pickupDate, pickupTime, returnDate, returnTime } = trip;
  const errors: TripErrors = {};

  if (!parseIsoDate(pickupDate)) errors.pickupDate = "Choose a pick-up date.";
  else if (pickupDate < now.date) errors.pickupDate = "Pick-up can’t be in the past.";
  if (!isTimeSlot(pickupTime)) errors.pickupTime = "Choose a pick-up time.";
  else if (!errors.pickupDate && pickupDate === now.date && minutesOf(pickupTime) <= now.minutes) {
    errors.pickupTime = "That time has passed. Choose a later one.";
  }
  if (!parseIsoDate(returnDate)) errors.returnDate = "Choose a return date.";
  else if (!errors.pickupDate && returnDate < pickupDate) errors.returnDate = "Return can’t be before pick-up.";
  if (!isTimeSlot(returnTime)) errors.returnTime = "Choose a return time.";

  if (!Object.keys(errors).length) {
    if (tripMinutes(pickupDate, pickupTime, returnDate, returnTime) <= 0) {
      errors.returnTime = "Return must be after pick-up.";
    } else if (billedDays(pickupDate, pickupTime, returnDate, returnTime) > site.booking.maxRentalDays) {
      errors.returnDate = `The longest rental is ${site.booking.maxRentalDays} days. Call us for a longer one.`;
    }
  }
  return errors;
}

/**
 * Input mask for a US phone number: digits become "(631) 555-0142" as they are typed. A
 * pasted "+1 631…" loses its country code. `previous` is the field's value before this
 * edit: a Backspace that only removed a bracket, space or dash removes the digit before it,
 * so deleting never gets stuck on the formatting.
 */
export function formatUsPhone(value: string, previous = ""): string {
  let digits = value.replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("1")) digits = digits.slice(1);
  if (value.length < previous.length && digits === previous.replace(/\D/g, "")) digits = digits.slice(0, -1);
  digits = digits.slice(0, 10);

  if (!digits) return "";
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export type ContactValues = { name: string; phone: string; email: string };
export type ContactErrors = Partial<Record<keyof ContactValues, string>>;

export function validateContact({ name, phone, email }: ContactValues): ContactErrors {
  const errors: ContactErrors = {};
  if (name.trim().split(/\s+/).filter(Boolean).length < 2) {
    errors.name = "Enter your first and last name, as on your license.";
  }
  // US numbers: 10 digits, or 11 starting with the country code 1.
  const digits = phone.replace(/\D/g, "");
  if (!(digits.length === 10 || (digits.length === 11 && digits.startsWith("1")))) {
    errors.phone = "Enter a 10-digit US phone number.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  return errors;
}

const fileTypeLabels: Record<string, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WebP",
  "application/pdf": "PDF",
};

export const acceptedFileTypes: readonly string[] = site.booking.upload.accept;

export const acceptedFileLabel = acceptedFileTypes
  .map((type) => fileTypeLabels[type] ?? type)
  .join(", ");

/** Returns an error message, or null when the file is acceptable. UX only: the API re-checks. */
export function validateFile(file: File | null): string | null {
  if (!file) return "Upload a file to continue.";
  if (!acceptedFileTypes.includes(file.type)) {
    return `That file type isn’t supported. Use ${acceptedFileLabel}.`;
  }
  if (file.size > site.booking.upload.maxSizeMb * 1024 * 1024) {
    return `That file is too large. The limit is ${site.booking.upload.maxSizeMb} MB.`;
  }
  if (file.size === 0) return "That file is empty.";
  return null;
}
