import { site } from "@/config/site";

/**
 * Pick-up and return times: "HH:MM" slots in business hours, New York time. The API has the
 * same rules (App\Support\RentalTime in /backend); change both together.
 */
export type TimeSlot = string;

const { hours, timeZone } = site.booking;

const toMinutes = (time: TimeSlot) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

/** "07:00", "07:30" … "23:00". */
export const timeSlots: TimeSlot[] = (() => {
  const slots: TimeSlot[] = [];
  for (let m = toMinutes(hours.open); m <= toMinutes(hours.close); m += hours.slotMinutes) {
    slots.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return slots;
})();

export const isTimeSlot = (value: string) => timeSlots.includes(value);

export const minutesOf = toMinutes;

/** "13:30" as "1:30 PM". */
export function formatTime(time: TimeSlot): string {
  if (!isTimeSlot(time)) return "";
  const m = toMinutes(time);
  const h = Math.floor(m / 60);
  return `${h % 12 || 12}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Today's date and the minutes past midnight, in New York, wherever the visitor is. */
export function businessNow(at = new Date()): { date: string; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((part) => [part.type, part.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

/** Whole calendar days between two ISO dates (UTC, so every day has 24 hours). */
function calendarDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * Minutes from pick-up to return on the wall clock, or NaN while something is missing. A
 * period across a daylight-saving change is not an hour longer or shorter.
 */
export function tripMinutes(pickupDate: string, pickupTime: TimeSlot, returnDate: string, returnTime: TimeSlot): number {
  if (!pickupDate || !returnDate || !isTimeSlot(pickupTime) || !isTimeSlot(returnTime)) return Number.NaN;
  return calendarDays(pickupDate, returnDate) * 1440 + toMinutes(returnTime) - toMinutes(pickupTime);
}

/** Days charged: every started 24 hours from the pick-up time; 0 while the period is not valid. */
export function billedDays(pickupDate: string, pickupTime: TimeSlot, returnDate: string, returnTime: TimeSlot): number {
  const minutes = tripMinutes(pickupDate, pickupTime, returnDate, returnTime);
  return minutes > 0 ? Math.max(site.booking.minRentalDays, Math.ceil(minutes / 1440)) : 0;
}
