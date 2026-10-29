import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookButton } from "@/components/booking/BookButton";
import { BookingBar } from "@/components/booking/BookingBar";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CtaBanner } from "@/components/sections/CtaBanner";
import { Faq } from "@/components/sections/Faq";
import { ServiceLinks } from "@/components/sections/ServiceLinks";
import { TheCar } from "@/components/sections/TheCar";
import { JsonLd } from "@/components/seo/JsonLd";
import { ArtImage } from "@/components/ui/ArtImage";
import { buttonClasses } from "@/components/ui/Button";
import { ArrowRightIcon, CheckIcon, PinIcon } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { areas } from "@/config/locations";
import { findService, services } from "@/config/services";
import { getCars } from "@/lib/catalog";
import { absoluteUrl, areaServed, businessRef, pageMetadata } from "@/lib/seo";

// Shoots are quoted per project (config/services.ts), so their structured data has no day rate.
const quotedPerProject = new Set(["photoshoot", "music-video"]);

// One page per service in config/services.ts, built at deploy time.
export function generateStaticParams() {
  return services.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({ params }: PageProps<"/services/[slug]">): Promise<Metadata> {
  const service = findService((await params).slug);
  if (!service) return {};
  return pageMetadata({ title: service.title, description: service.description, path: `/services/${service.slug}` });
}

/**
 * A service page (SEO, 2026-10-19): the occasion's own copy over a real photo of the car, the
 * date bar, the car, the occasion's questions, and links to two other services and the areas.
 */
export default async function ServicePage({ params }: PageProps<"/services/[slug]">) {
  const service = findService((await params).slug);
  if (!service) notFound();

  const path = `/services/${service.slug}`;
  const h1 = `${service.name} Car Rental on Long Island`;
  const [car] = await getCars();
  const related = service.related.map((slug) => findService(slug)!.occasion);

  return (
    <main id="top" className="flex-1">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: h1,
          serviceType: "Exotic car rental",
          description: service.description,
          url: absoluteUrl(path),
          image: absoluteUrl(service.image.src),
          provider: businessRef,
          areaServed,
          ...(quotedPerProject.has(service.occasion)
            ? {}
            : {
                offers: {
                  "@type": "Offer",
                  url: absoluteUrl(`/book/${car.slug}?occasion=${service.occasion}`),
                  itemOffered: { "@type": "Car", name: car.fullName },
                  priceSpecification: {
                    "@type": "UnitPriceSpecification",
                    price: car.pricePerDay,
                    priceCurrency: car.currency,
                    unitText: "DAY",
                  },
                },
              }),
        }}
      />

      <div className="bg-surface/50">
        <div className="container-site grid items-center gap-8 pt-6 pb-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] xl:grid-cols-[minmax(0,1fr)_36rem] xl:gap-14 xl:pt-10 xl:pb-14">
          <div>
            <Breadcrumbs
              trail={[
                { label: "Services", href: "/services" },
                { label: `${service.name} Car Rental`, href: path },
              ]}
            />
            <p className="mt-6 text-eyebrow font-semibold text-brand-deep uppercase xl:mt-8">Services</p>
            <h1 className="mt-3 text-title font-bold xl:text-[2.75rem] xl:leading-[1.1]">{h1}</h1>
            <p className="mt-3 max-w-[36rem] text-[0.9375rem] leading-relaxed text-muted xl:text-base">{service.lead}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <BookButton occasion={service.occasion} size="md">
                Book now
                <ArrowRightIcon className="text-base" />
              </BookButton>
              <Link href={`/contact?occasion=${service.occasion}`} className={buttonClasses({ variant: "outline", size: "md" })}>
                Request a quote
              </Link>
            </div>
            {/* Phones: plain checked lines, so the photo stays near the top; pills from md up. */}
            <ul className="mt-5 grid gap-2 md:mt-6 md:flex md:flex-wrap">
              {service.badges.map((badge) => (
                <li
                  key={badge}
                  className="flex items-center gap-2 text-[0.8125rem] font-medium text-ink-soft md:rounded-full md:border md:border-line md:bg-card md:py-1.5 md:pr-3.5 md:pl-2"
                >
                  <span className="flex size-5 items-center justify-center rounded-full bg-tint text-[0.625rem] text-brand-deep">
                    <CheckIcon />
                  </span>
                  {badge}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative aspect-[16/10] overflow-hidden rounded-card bg-surface shadow-card">
            <ArtImage
              mobile={{
                src: service.image.src,
                width: service.image.width,
                height: service.image.height,
                sizes: "(width >= 80rem) 36rem, (width >= 64rem) 28rem, (width >= 48rem) calc(100vw - 5rem), calc(100vw - 2.5rem)",
              }}
              alt={service.image.alt}
              priority
              className="absolute inset-0 size-full object-cover"
            />
          </div>
        </div>
      </div>

      <section aria-labelledby="service-title" className="container-site pt-10 xl:pt-14">
        <div className="max-w-[42rem]">
          <SectionHeading id="service-title">{service.heading}</SectionHeading>
          <div className="mt-4 grid gap-4 text-[0.9375rem] leading-relaxed text-ink-soft xl:text-base">
            {service.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="dates-title" className="container-site pt-10 xl:pt-12">
        <SectionHeading id="dates-title">Check your dates</SectionHeading>
        <div className="mt-5 md:max-w-[36rem] xl:mt-6 xl:w-[44rem] xl:max-w-none">
          <BookingBar carSlug={car.slug} occasion={service.occasion} />
        </div>
      </section>

      <TheCar />

      <Faq id="service-faq" title={`${service.name} rental FAQ`} questions={[]} extra={service.faqs} />

      <section aria-labelledby="more-title" className="container-site pt-6 xl:pt-8">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-2">
          <SectionHeading id="more-title">More occasions</SectionHeading>
          <Link href="/services" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-deep hover:underline">
            All services
            <ArrowRightIcon />
          </Link>
        </div>
        <div className="mt-5 xl:mt-6">
          <ServiceLinks slugs={related} />
        </div>
      </section>

      <section aria-labelledby="areas-title" className="container-site pt-10 xl:pt-12">
        <SectionHeading id="areas-title">Where we deliver</SectionHeading>
        <ul className="mt-5 flex flex-wrap gap-2.5 xl:mt-6">
          {areas.map((area) => (
            <li key={area.slug}>
              <Link
                href={`/locations/${area.slug}`}
                className="flex items-center gap-2 rounded-full border border-line bg-card py-2 pr-4 pl-3 text-sm font-medium text-ink-soft transition-colors hover:border-brand-deep/40 hover:text-brand-deep"
              >
                <PinIcon className="text-base text-brand-deep" />
                {area.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="pt-12 pb-10 xl:pt-14 xl:pb-14">
        <CtaBanner />
      </div>
    </main>
  );
}
