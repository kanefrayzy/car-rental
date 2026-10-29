"use client";

import { useId, type Ref } from "react";
import { CalendarIcon, ChevronDownIcon } from "@/components/ui/icons";
import { formatDate, type IsoDate } from "@/lib/validation";

type DateFieldProps = {
  label: string;
  value: IsoDate;
  onChange: (value: IsoDate) => void;
  min?: IsoDate;
  invalid?: boolean;
  describedBy?: string;
  /** Lets the parent focus the field or open its picker. */
  inputRef?: Ref<HTMLInputElement>;
  /** Hides the chevron where space is tight (the hero bar on wide screens). */
  compact?: boolean;
  /** Drops the chevron on phones, where the value needs the room (the booking form). */
  roomyOnPhone?: boolean;
  className?: string;
};

/** Focuses a date input and opens its calendar. Must be called from a click or key handler. */
export function openDatePicker(input: HTMLInputElement | null) {
  if (!input) return;
  // preventScroll: the field is already where the visitor tapped; focusing must not move the page.
  input.focus({ preventScroll: true });
  try {
    input.showPicker?.();
  } catch {
    // showPicker throws if the picker is already open or the browser refuses; focus is enough.
  }
}

// The mockup's date control, backed by a real <input type="date"> stretched invisibly
// over it: native pickers on phones, keyboard entry on desktop, no date library.
export function DateField({
  label,
  value,
  onChange,
  min,
  invalid,
  describedBy,
  inputRef,
  compact = false,
  roomyOnPhone = false,
  className = "",
}: DateFieldProps) {
  const id = useId();

  return (
    <div
      className={`relative flex items-center gap-3 rounded-btn transition-colors hover:bg-surface/70 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-deep xl:gap-[1.125rem] ${className}`}
    >
      <CalendarIcon className="shrink-0 text-xl text-ink xl:text-[1.375rem]" />
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
          {value ? formatDate(value) : "Select date"}
        </span>
      </span>
      {!compact && <ChevronDownIcon className={`shrink-0 text-sm text-ink-soft ${roomyOnPhone ? "max-sm:hidden" : ""}`} />}
      <input
        ref={inputRef}
        id={id}
        type="date"
        value={value}
        min={min || undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        // Clicking anywhere on the field opens the picker, not just the tiny native icon.
        onClick={(event) => openDatePicker(event.currentTarget)}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      />
    </div>
  );
}
