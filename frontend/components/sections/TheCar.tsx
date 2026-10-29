import { BookButton } from "@/components/booking/BookButton";
import { ArrowRightIcon } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SpecGlyph } from "@/components/ui/spec-icons";
import type { Car } from "@/config/cars";
import { getCars } from "@/lib/catalog";
import { CarGallery } from "./CarGallery";

function CarCard({ car }: { car: Car }) {
  return (
    <article
      aria-label={car.fullName}
      className="md:grid md:grid-cols-2 md:items-start md:gap-8 xl:grid-cols-[44rem_1fr] xl:items-stretch xl:gap-0 xl:rounded-card xl:border xl:border-line xl:bg-card"
    >
      <div className="xl:-m-px">
        <CarGallery images={car.gallery} carName={car.name} />
      </div>

      <div className="mt-5 px-1.5 md:mt-2 xl:mt-0 xl:flex xl:flex-col xl:justify-center xl:px-12 xl:py-8">
        <p className="hidden text-[0.625rem] font-semibold tracking-[0.12em] text-ink-soft uppercase xl:block">
          {car.category}
        </p>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 xl:mt-2.5">
          <h3 className="text-[1.0625rem] font-bold tracking-[-0.03em] xl:text-[1.625rem]">
            {car.name}
          </h3>
          <p className="text-xs font-medium whitespace-nowrap text-ink-soft">
            from{" "}
            <span className="font-display text-[1.1875rem] font-bold tracking-[-0.02em] text-brand xl:text-[2rem]">
              ${car.pricePerDay}
            </span>
            {/* brand-deep, not brand: at this size the lighter blue fails AA contrast. */}
            <span className="text-[0.8125rem] text-brand-deep xl:text-[1.0625rem]">/day</span>
          </p>
        </div>
        <p className="mt-1 border-b border-line pb-4 text-xs text-muted xl:mt-1.5 xl:pb-6 xl:text-sm">
          {car.fullName}
        </p>

        <dl className="grid grid-cols-4 py-5 xl:py-7">
          {car.specs.map((spec) => (
            <div
              key={spec.label}
              className="flex flex-col border-line not-first:border-l not-first:pl-3.5 xl:not-first:pl-[1.375rem]"
            >
              <SpecGlyph name={spec.icon} className="text-[1.75rem] text-ink xl:text-[2rem]" />
              {/* dt/dd order is label then value for assistive tech; visually the value comes first. */}
              <dt className="order-2 mt-1.5 text-xs text-muted xl:text-[0.8125rem]">{spec.label}</dt>
              <dd className="order-1 mt-3 text-sm font-medium text-ink-soft xl:text-base">
                {spec.value}
              </dd>
            </div>
          ))}
        </dl>

        <BookButton
          carSlug={car.slug}
          block
          className="max-xl:h-[3.125rem] max-xl:rounded-btn-lg xl:h-12"
        >
          Request Booking
          <ArrowRightIcon className="text-base" />
        </BookButton>
      </div>
    </article>
  );
}

export async function TheCar({ title = "The Car" }: { title?: string }) {
  const cars = await getCars();

  return (
    <section id="the-car" aria-labelledby="the-car-title" className="container-site pt-9 xl:pt-[1.875rem]">
      <SectionHeading id="the-car-title">{title}</SectionHeading>

      {/* One card per car in config/cars.ts, priced by lib/catalog.ts. */}
      <div className="mt-4 grid gap-6 xl:mt-3 xl:gap-5">
        {cars.map((car) => (
          <CarCard key={car.slug} car={car} />
        ))}
      </div>
    </section>
  );
}
