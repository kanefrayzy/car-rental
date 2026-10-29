import Link from "next/link";
import { BookButton } from "@/components/booking/BookButton";
import { MyBookingLink } from "@/components/booking/MyBookingLink";
import { buttonClasses } from "@/components/ui/Button";
import { PhoneIcon } from "@/components/ui/icons";
import { Logo } from "@/components/ui/Logo";
import { site } from "@/config/site";
import { MobileMenu } from "./MobileMenu";
import { NavLinks } from "./NavLinks";

export function Header() {
  return (
    <header className="sticky top-0 z-40">
      {/* The blur sits on its own layer: backdrop-filter on the header itself would
          become the containing block for the fixed mobile menu panel. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-page/90 backdrop-blur-md" />
      <div className="container-site flex h-(--header-h) items-center">
        {/* Fixed-width slot so the nav position does not depend on the length of the brand name.
            Narrower than the mockup's (19.5rem from 90rem) since the menu has seven links: the
            row did not fit (2026-10-21, measured with "My booking" shown). */}
        <div className="shrink-0 xl:w-[13rem] min-[90rem]:w-[14rem]">
          <Link href="/#top" className="inline-flex">
            <Logo />
          </Link>
        </div>

        <nav aria-label="Primary" className="hidden xl:block">
          <NavLinks />
        </nav>

        {/* pl-4: the menu never runs into the buttons when the row is full. */}
        <div className="ml-auto flex items-center gap-3.5 xl:gap-5 xl:pl-4 min-[90rem]:gap-6">
          <div className="hidden xl:block">
            <MyBookingLink variant="header" />
          </div>
          {/* Phones: a plain link (the bottom bar has Call and Text). From md up: a pill with the
              icon, "Call or text" and the number, beside Book Now (user, 2026-10-16). */}
          <a
            href={site.phone.href}
            className="group flex items-center gap-2 py-2 text-xs font-medium whitespace-nowrap text-ink-soft transition-[color,border-color,background-color] hover:text-brand-deep md:gap-2.5 md:rounded-full md:border md:border-line-strong md:bg-card md:py-1 md:pr-4 md:pl-1 md:hover:border-brand-deep"
          >
            <PhoneIcon className="text-sm text-brand-deep md:hidden" />
            <span className="hidden size-8 items-center justify-center rounded-full bg-brand-deep text-sm text-white transition-colors group-hover:bg-brand-press md:flex">
              <PhoneIcon />
            </span>
            <span className="leading-tight">
              <span className="hidden text-[0.625rem] font-normal text-muted md:block">Call or text</span>
              <span className="md:text-sm md:font-semibold md:text-ink md:group-hover:text-brand-deep">{site.phone.display}</span>
            </span>
          </a>
          {/* "Instant Quote" leads to the contact page's form (user, 2026-10-16). From 1280 to
              1439px it is left out: with the Blog link the row no longer fit, and the menu's
              Contact link beside it goes to the same page (2026-10-21). */}
          <div className="hidden items-center gap-2.5 xl:flex">
            <Link
              href="/contact"
              className={`${buttonClasses({ variant: "outline", size: "sm", shape: "pill" })} px-5 max-[90rem]:hidden min-[90rem]:px-6`}
            >
              Instant Quote
            </Link>
            <BookButton size="sm" shape="pill" className="px-5 min-[90rem]:px-[1.875rem]">
              Book Now
            </BookButton>
          </div>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
