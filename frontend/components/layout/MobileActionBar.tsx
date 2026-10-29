"use client";

import { usePathname } from "next/navigation";
import { BookButton } from "@/components/booking/BookButton";
import { buttonClasses } from "@/components/ui/Button";
import { MessageIcon, PhoneIcon } from "@/components/ui/icons";
import { site } from "@/config/site";

/**
 * Phones only (below md): Call, Text and Book Now, fixed to the bottom of the screen
 * (user, 2026-10-16). globals.css pads the body by its height so it never covers the footer,
 * and hides it while the mobile menu is open. Not on the booking form, which has its own
 * Send button at the bottom (the booking form replaced the old booking dialog). On the
 * customer's booking page (/booking) only Call and Text: a "Book Now" right under the deposit
 * form was taken for the pay button and led back to the form (a customer, 2026-10-16).
 */
export function MobileActionBar() {
  const pathname = usePathname();
  if (pathname.startsWith("/book/")) return null;
  const booking = pathname === "/booking";

  // px-2! beats the base size's px-7, and minmax(0, ...) columns may shrink below their
  // content: before, Book Now ran past the right edge on phones under 390px (2026-10-22).
  const small = "h-11 gap-1.5 px-2! text-sm";
  return (
    <nav
      aria-label="Call, text or book"
      data-mobile-bar
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-12px_rgb(10_23_48/0.18)] backdrop-blur-md md:hidden"
    >
      <div
        className={`grid h-[calc(var(--mobile-bar-h)-1px)] items-center gap-2 px-3 ${booking ? "grid-cols-2" : "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.35fr)]"}`}
      >
        <a href={site.phone.href} className={`${buttonClasses({ variant: "outline", shape: "pill" })} ${small}`}>
          <PhoneIcon className="text-base" />
          Call
        </a>
        <a href={site.phone.sms} className={`${buttonClasses({ variant: "outline", shape: "pill" })} ${small}`}>
          <MessageIcon className="text-base" />
          Text
        </a>
        {!booking && (
          <BookButton shape="pill" className={small}>
            Book Now
          </BookButton>
        )}
      </div>
    </nav>
  );
}
