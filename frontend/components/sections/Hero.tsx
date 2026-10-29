import { BookingBar } from "@/components/booking/BookingBar";
import { PinIcon } from "@/components/ui/icons";
import { cars } from "@/config/cars";
import { site } from "@/config/site";
import { HeroScene } from "./HeroScene";

export function Hero() {
  const car = cars[0];
  const { city, state, region } = site.location;

  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate mx-1.5 overflow-hidden rounded-panel xl:mx-0 xl:rounded-none"
    >
      <HeroScene alt={`${car.fullName} parked by the bay`} />

      {/* Explicit heights at every width, so the photo can never shift the layout. On
          tablets the height grows with the width: the car scales with the width, and the
          copy above it must stay clear of it. */}
      <div className="relative flex h-[37.125rem] flex-col pt-8 max-md:px-4 md:h-[calc(25.75rem+32vw)] md:pt-10 md:max-xl:px-8 xl:container-site xl:h-[25.9375rem] xl:pt-[3.25rem]">
        <p className="flex items-center gap-4 text-eyebrow font-semibold text-ink-soft uppercase">
          <span aria-hidden="true" className="h-[3px] w-9 rounded-full bg-brand-deep" />
          Premium exotic car rentals
        </p>
        <h1 id="hero-title" className="mt-4 text-display font-bold">
          Drive Something
          <br />
          Unforgettable
        </h1>
        <p className="mt-3 text-lead text-ink xl:mt-4">{site.tagline}</p>

        <div className="mt-5 md:max-w-[36rem] xl:mt-6 xl:w-[44rem] xl:max-w-none">
          <BookingBar carSlug={car.slug} />
        </div>

        <p className="absolute top-11 right-(--gutter) hidden items-start gap-3 text-[0.5625rem] leading-[1.9] font-medium tracking-[0.14em] text-ink-soft uppercase xl:flex">
          <PinIcon className="mt-px text-sm text-brand-deep" />
          <span>
            {city}, {state}
            <br />
            {region}, {state}
          </span>
        </p>
      </div>
    </section>
  );
}
