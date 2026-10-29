import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { ArrowRightIcon, PinIcon } from "@/components/ui/icons";
import { MapSvg } from "@/components/ui/MapSvg";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { site } from "@/config/site";

export function Location() {
  const { city, state, region, directionsUrl } = site.location;

  return (
    <section id="location" aria-labelledby="location-title" className="container-site">
      <div className="border-line pt-10 md:grid md:grid-cols-[17rem_1fr] md:items-center md:gap-8 xl:grid-cols-[25.375rem_1fr] xl:items-stretch xl:gap-0 xl:border-b xl:pt-6 xl:pb-6">
        <div>
          <SectionHeading id="location-title">Location</SectionHeading>
          <h3 className="mt-2 text-[1.625rem] leading-tight font-semibold">
            {city}, {state}
          </h3>
          <p className="mt-2 max-w-[14.5rem] text-[1.0625rem] leading-[1.3] text-muted">
            Pickup or delivery available on {region}.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${buttonClasses({ variant: "outline", size: "sm", shape: "pill" })} gap-3.5! px-5! shadow-card`}
            >
              <PinIcon className="text-lg text-brand" />
              Get Directions
              <span className="sr-only">(opens Google Maps in a new tab)</span>
            </a>
            <Link href="/locations" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-deep hover:underline">
              Areas we serve
              <ArrowRightIcon />
            </Link>
          </div>
        </div>

        <div className="relative mt-6 h-[14.5rem] overflow-hidden rounded-btn-lg bg-surface md:mt-0 xl:mt-2 xl:h-[11.5rem]">
          <MapSvg className="absolute inset-0 size-full" />

          <div className="absolute top-[46%] left-1/2 flex -translate-x-1/2 -translate-y-full flex-col items-center">
            <PinIcon className="text-[2.125rem] text-brand drop-shadow-[0_3px_4px_rgb(10_122_255/0.3)]" />
          </div>
          <p className="absolute top-[46%] left-1/2 mt-1.5 -translate-x-1/2 text-sm font-semibold text-ink [text-shadow:0_0_6px_var(--color-surface),0_0_2px_var(--color-surface)]">
            {city}
          </p>
          <p className="absolute right-[10%] bottom-[18%] text-xs tracking-[0.22em] text-water-ink italic xl:right-[11%] xl:bottom-[30%] xl:text-[0.8125rem]">
            {region}
          </p>
        </div>
      </div>
    </section>
  );
}
