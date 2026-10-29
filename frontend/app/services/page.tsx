import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { AreaCards } from "@/components/sections/AreaCards";
import { CtaBanner } from "@/components/sections/CtaBanner";
import { Faq } from "@/components/sections/Faq";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { OccasionShowcase } from "@/components/sections/OccasionShowcase";
import { JsonLd } from "@/components/seo/JsonLd";
import { buttonClasses } from "@/components/ui/Button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { services } from "@/config/services";
import { areas } from "@/config/locations";
import { site } from "@/config/site";
import { absoluteUrl, areaServed, businessRef, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Hellcat for Weddings, Prom and Photoshoots",
  description: `Rent a Dodge Charger Hellcat Widebody in ${site.location.city}, Long Island for a photoshoot, music video, wedding, prom, birthday or event. Delivery to your venue.`,
  path: "/services",
});

// The services of the business, each described in full on its own page (/services/[slug]).
const servicesJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  itemListElement: services.map((service, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: {
      "@type": "Service",
      name: `${service.name} Car Rental on Long Island`,
      serviceType: "Exotic car rental",
      description: service.description,
      url: absoluteUrl(`/services/${service.slug}`),
      provider: businessRef,
      areaServed,
    },
  })),
};

const questions = [
  "Can I rent the car for a photoshoot or music video?",
  "Can I book the car for a wedding or prom?",
  "Can I pick up or get delivery?",
  "What are the rental requirements?",
];

/**
 * The occasions as services (user, 2026-10-16): the same cards as the home page, each with a
 * button that opens the booking page with the occasion chosen. "Services" in the menu.
 */
export default function ServicesPage() {
  return (
    <main id="top" className="flex-1">
      <JsonLd data={servicesJsonLd} />
      <div className="bg-surface/50">
        <div className="container-site pt-6 pb-10 xl:pt-10 xl:pb-14">
          <Breadcrumbs trail={[{ label: "Services", href: "/services" }]} />
          <div className="mt-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-5 xl:mt-8">
            <div className="max-w-[40rem]">
              <p className="text-eyebrow font-semibold text-brand-deep uppercase">Services</p>
              <h1 className="mt-3 text-title font-bold xl:text-[2.75rem] xl:leading-[1.1]">
                An exotic car for the day that matters
              </h1>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted xl:text-base">
                Pick the occasion, choose your dates and send a request. We deliver to your venue or set on Long
                Island, or you pick it up in {site.location.city}.
              </p>
            </div>
            <Link href="/contact" className={buttonClasses({ variant: "outline" })}>
              Get an instant quote
            </Link>
          </div>

          <div className="mt-8 xl:mt-10">
            <OccasionShowcase layout="grid" heading="h2" />
          </div>
        </div>
      </div>

      <section aria-labelledby="where-title" className="container-site pt-10 xl:pt-12">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-2">
          <div>
            <SectionHeading id="where-title">Where we deliver</SectionHeading>
            <p className="mt-2 max-w-[34rem] text-[0.9375rem] leading-relaxed text-muted">
              Free within {site.booking.delivery.freeRadiusMiles} miles of {site.location.city}, anywhere on Long
              Island for a fee, and the city on request.
            </p>
          </div>
          <Link href="/locations" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-deep hover:underline">
            All areas
            <ArrowRightIcon />
          </Link>
        </div>
        <div className="mt-5 xl:mt-6">
          <AreaCards areas={areas} />
        </div>
      </section>

      <HowItWorks />
      <Faq id="services-faq" title="Good to know" questions={questions} />
      <div className="pt-4 pb-10 xl:pb-14">
        <CtaBanner />
      </div>
    </main>
  );
}
