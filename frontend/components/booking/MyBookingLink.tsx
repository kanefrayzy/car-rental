"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonClasses } from "@/components/ui/Button";
import { CalendarIcon } from "@/components/ui/icons";
import { bookingPagePath } from "@/lib/api";
import { useSavedBooking } from "@/lib/savedBooking";

/**
 * "My booking": back to the visitor's booking page, shown only in a browser that has made or
 * opened a booking whose link still works (lib/savedBooking.ts). Hidden on that page itself.
 */
export function MyBookingLink({ variant, onOpen }: { variant: "header" | "menu"; onOpen?: () => void }) {
  const link = useSavedBooking();
  const onBookingPage = usePathname() === "/booking";
  if (!link || onBookingPage) return null;

  if (variant === "menu") {
    return (
      <Link href={bookingPagePath(link)} onClick={onOpen} data-clarity-mask="true" className={buttonClasses({ variant: "outline", size: "lg", block: true })}>
        <CalendarIcon className="text-lg" />
        My booking
      </Link>
    );
  }
  // The desktop header has no room for the words (since the Blog link, 2026-10-21, not even at
  // 1600px and up): an icon, named for assistive tech.
  return (
    <Link
      href={bookingPagePath(link)}
      // The href is the signed booking link: masked, Clarity records it blank.
      data-clarity-mask="true"
      title="My booking"
      className="flex size-10 items-center justify-center rounded-full bg-tint text-sm font-medium text-ink-soft transition-colors hover:text-brand-deep"
    >
      <CalendarIcon className="text-base text-brand-deep" />
      <span className="sr-only">My booking</span>
    </Link>
  );
}
