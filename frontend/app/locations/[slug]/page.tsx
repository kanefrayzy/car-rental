import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingBar } from "@/components/booking/BookingBar";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { AreaCards } from "@/components/sections/AreaCards";
import { CtaBanner } from "@/components/sections/CtaBanner";
import { Faq } from "@/components/sections/Faq";
import { ServiceLinks } from "@/components/sections/ServiceLinks";
import { TheCar } from "@/components/sections/TheCar";
import { JsonLd } from "@/components/seo/JsonLd";
import { ArrowRightIcon } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { areas, findArea } from "@/config/locations";
import { getCars } from "@/lib/catalog";
import { absoluteUrl, businessRef, pageMetadata } from "@/lib/seo";

// One page per area in config/locations.ts, built at deploy time.
export function generateStaticParams() {
  return areas.map((area) => ({ slug: area.slug }));
}

export async function generateMetadata({ params }: PageProps<"/locations/[slug]">): Promise<Metadata> {
  const area = findArea((await params).slug);
  if (!area) return {};
  return pageMetadata({ title: area.title, description: area.description, path: `/locations/${area.slug}` });
}

/**
 * An area page (SEO, 2026-10-19): the area's own copy and facts, the car, the date bar, the
 * area's questions, and links to its services and the areas next to it.
 */
export default async function AreaPage({ params }: PageProps<"/locations/[slug]">) {
  const area = findArea((await params).slug);
  if (!area) notFound();

  const path = `/locations/${area.slug}`;
  const [car] = await getCars();
  const nearby = area.nearby.map((slug) => findArea(slug)!);

  return (
    <main id="top" className="flex-1">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: `Hellcat Rental in ${area.name}`,
          serviceType: "Exotic car rental",
          description: area.description,
          url: absoluteUrl(path),
          provider: businessRef,
          areaServed: { "@type": area.place.type, name: area.place.name },
          offers: {
            "@type": "Offer",
            url: absoluteUrl(`/book/${car.slug}`),
            itemOffered: { "@type": "Car", name: car.fullName },
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: car.pricePerDay,
              priceCurrency: car.currency,
              unitText: "DAY",
            },
          },
        }}
      />

      <div className="bg-surface/50">
        <div className="container-site pt-6 pb-10 xl:pt-10 xl:pb-14">
          <Breadcrumbs
            trail={[
              { label: "Locations", href: "/locations" },
              { label: area.label, href: path },
            ]}
          />
          <div className="mt-6 max-w-[44rem] xl:mt-8">
            <p className="text-eyebrow font-semibold text-brand-deep uppercase">Areas we serve</p>
            <h1 className="mt-3 text-title font-bold xl:text-[2.75rem] xl:leading-[1.1]">Hellcat Rental in {area.name}</h1>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted xl:text-base">{area.lead}</p>
          </div>
          <div className="mt-6 md:max-w-[36rem] xl:mt-8 xl:w-[44rem] xl:max-w-none">
            <BookingBar carSlug={car.slug} />
          </div>
        </div>
      </div>

      <section aria-labelledby="area-title" className="container-site pt-10 xl:pt-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_24rem] xl:gap-16">
          <div className="max-w-[42rem]">
            <SectionHeading id="area-title">{area.heading}</SectionHeading>
            <div className="mt-4 grid gap-4 text-[0.9375rem] leading-relaxed text-ink-soft xl:text-base">
              {area.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
          <aside aria-label={`${area.label} at a glance`} className="rounded-card border border-line bg-card p-5 shadow-card xl:p-6">
            {/* Tablets: two by two, since the card spans the full width there. */}
            <dl className="grid gap-4 md:max-lg:grid-cols-2 md:max-lg:gap-x-8">
              {area.facts.map((fact) => (
                <div key={fact.label} className="border-line not-first:border-t not-first:pt-4 md:max-lg:nth-2:border-t-0 md:max-lg:nth-2:pt-0">
                  <dt className="text-[0.6875rem] font-semibold tracking-[0.12em] text-muted uppercase">{fact.label}</dt>
                  <dd className="mt-1 text-[0.9375rem] font-medium text-ink">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </section>

      <TheCar />

      <section aria-labelledby="area-services-title" className="container-site pt-10 xl:pt-12">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-2">
          <SectionHeading id="area-services-title">Popular in {area.name}</SectionHeading>
          <Link href="/services" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-deep hover:underline">
            All services
            <ArrowRightIcon />
          </Link>
        </div>
        <div className="mt-5 xl:mt-6">
          <ServiceLinks slugs={area.occasions} />
        </div>
      </section>

      <Faq id="area-faq" title={`${area.label} FAQ`} questions={[]} extra={area.faqs} />

      <section aria-labelledby="nearby-title" className="container-site pt-6 xl:pt-8">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-2">
          <SectionHeading id="nearby-title">Nearby areas</SectionHeading>
          <Link href="/locations" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-deep hover:underline">
            All areas
            <ArrowRightIcon />
          </Link>
        </div>
        <div className="mt-5 xl:mt-6">
          <AreaCards areas={nearby} />
        </div>
      </section>

      <div className="pt-12 pb-10 xl:pt-14 xl:pb-14">
        <CtaBanner />
      </div>
    </main>
  );
}
