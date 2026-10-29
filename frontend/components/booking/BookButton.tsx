"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClasses, type ButtonStyle } from "@/components/ui/Button";
import { cars } from "@/config/cars";
import type { Occasion } from "@/config/content";

type BookButtonProps = ButtonStyle & {
  children: ReactNode;
  /** Which car the button is for; page-level buttons go to the first car. */
  carSlug?: string;
  className?: string;
  /** What the car is for (the Occasions cards); the booking form starts with it chosen. */
  occasion?: Occasion;
  /** Called on click, e.g. to close the mobile menu. */
  onOpen?: () => void;
};

/** Any "Book Now" / "Request Booking" button: a link to the car's booking page. */
export function BookButton({
  children,
  carSlug = cars[0].slug,
  occasion,
  onOpen,
  className = "",
  ...style
}: BookButtonProps) {
  return (
    <Link
      href={occasion ? `/book/${carSlug}?occasion=${occasion}` : `/book/${carSlug}`}
      onClick={onOpen}
      className={`${buttonClasses(style)} ${className}`}
    >
      {children}
    </Link>
  );
}
