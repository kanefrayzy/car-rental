"use client";

import { useId } from "react";
import { ChevronDownIcon, ClockIcon } from "@/components/ui/icons";
import { formatTime, timeSlots, type TimeSlot } from "@/lib/time";

type TimeFieldProps = {
  label: string;
  value: TimeSlot;
  onChange: (value: TimeSlot) => void;
  /** Slots that cannot be picked right now (passed today, or not after pick-up). */
  isDisabled?: (slot: TimeSlot) => boolean;
  invalid?: boolean;
  describedBy?: string;
  /** Hides the clock and chevron where space is tight (the hero bar on wide screens). */
  compact?: boolean;
  /** Drops the chevron on phones, where the value needs the room (the booking form). */
  roomyOnPhone?: boolean;
  className?: string;
};

// Same look as DateField, backed by a native <select> stretched invisibly over it: the phone's
// own time wheel on iOS and Android, keyboard selection on desktop, nothing to load.
export function TimeField({
  label,
  value,
  onChange,
  isDisabled,
  invalid,
  describedBy,
  compact = false,
  roomyOnPhone = false,
  className = "",
}: TimeFieldProps) {
  const id = useId();

  return (
    <div
      className={`relative flex items-center gap-3 rounded-btn transition-colors hover:bg-surface/70 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-deep ${className}`}
    >
      {!compact && <ClockIcon className="shrink-0 text-xl text-ink" />}
      <span className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-[0.6875rem] leading-none text-muted">
          {label}
        </label>
        <span
          aria-hidden="true"
          className={`mt-1.5 block truncate text-[0.8125rem] leading-none font-medium ${
            invalid ? "text-danger" : "text-ink-soft"
          }`}
        >
          {formatTime(value) || "Select time"}
        </span>
      </span>
      {!compact && <ChevronDownIcon className={`shrink-0 text-sm text-ink-soft ${roomyOnPhone ? "max-sm:hidden" : ""}`} />}
      <select
        id={id}
        value={value}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
      >
        {timeSlots.map((slot) => (
          <option key={slot} value={slot} disabled={isDisabled?.(slot)}>
            {formatTime(slot)}
          </option>
        ))}
      </select>
    </div>
  );
}
