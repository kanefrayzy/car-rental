import Image from "next/image";
import { BookButton } from "@/components/booking/BookButton";
import { ArrowRightIcon } from "@/components/ui/icons";

// A navy card at every width. Phones: tall, text on top, the side profile along the bottom.
// Tablets: the same card with the landscape hero crop. From lg up: the short desktop-mockup
// card with the side profile on the right.
export function CtaBanner() {
  return (
    <section aria-labelledby="cta-title" className="max-lg:px-1.5 lg:container-site">
      <div className="relative isolate h-[24.25rem] overflow-hidden rounded-panel bg-navy px-7 pt-10 md:px-10 md:pt-12 lg:h-52 lg:rounded-card lg:px-[3.625rem] lg:pt-8">
        {/* Phones: the side profile sits on the bottom edge and its sky dissolves into the navy.
            A different photo from the hero, so the page does not repeat itself. */}
        <div aria-hidden="true" className="absolute inset-0 -z-10 md:hidden">
          <div className="absolute inset-x-0 bottom-0 aspect-[1920/1011]">
            <Image
              src="/images/gallery/charger-side.webp"
              alt=""
              fill
              sizes="(width >= 48rem) 1px, 100vw"
              className="object-cover"
            />
          </div>
          <div className="absolute inset-0 bg-linear-to-b from-navy from-48% via-navy/45 via-59% to-transparent to-70%" />
        </div>

        {/* Tablets: the landscape hero crop, car bottom right, navy washing in from the left. */}
        <div aria-hidden="true" className="absolute inset-0 -z-10 hidden md:block lg:hidden">
          <Image
            src="/images/hero-scene-tablet.webp"
            alt=""
            fill
            sizes="(width >= 64rem) 1px, (width >= 48rem) 100vw, 1px"
            className="object-cover object-right-bottom"
          />
          <div className="absolute inset-0 bg-linear-to-r from-navy from-28% via-navy/70 via-50% to-navy/10" />
        </div>

        {/* Desktop: the side profile fills the right 55%, navy washing in from the left. */}
        <div aria-hidden="true" className="absolute inset-0 -z-10 hidden lg:block">
          <div className="absolute inset-y-0 right-0 w-[55%]">
            <Image
              src="/images/cta-side.webp"
              alt=""
              fill
              sizes="(width >= 80rem) 710px, (width >= 64rem) 55vw, 1px"
              className="object-cover object-right"
            />
          </div>
          <div className="absolute inset-0 bg-linear-to-r from-navy from-45% via-navy/55 via-53% to-transparent to-62%" />
        </div>

        <p className="text-eyebrow font-medium tracking-[0.3em] text-white/85 uppercase lg:text-[0.8125rem]">
          Ready for the ultimate ride?
        </p>
        <h2
          id="cta-title"
          className="mt-3.5 text-[1.875rem] leading-tight font-bold text-white md:text-[2.25rem] lg:mt-2 lg:text-[2.75rem] lg:leading-[1.15]"
        >
          Book Your Ride
        </h2>
        <p className="mt-2.5 text-[0.9375rem] text-white lg:mt-1 lg:text-[1.0625rem]">
          Experience the power. Drive the difference.
        </p>
        <BookButton className="mt-6 lg:mt-4 lg:h-[2.5625rem] lg:w-[10.125rem] lg:px-0 lg:text-sm">
          Book Now
          <ArrowRightIcon className="text-base" />
        </BookButton>
      </div>
    </section>
  );
}
