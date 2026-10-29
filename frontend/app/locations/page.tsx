import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { AreaCards } from "@/components/sections/AreaCards";
import { CtaBanner } from "@/components/sections/CtaBanner";
import { CheckIcon } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { areas } from "@/config/locations";
import { site } from "@/config/site";
import { usd } from "@/config/terms";
import { pageMetadata } from "@/lib/seo";

const { delivery } = site.booking;

export const metadata: Metadata = pageMetadata({
  title: "Areas We Serve: Long Island and NYC",
  description: `Hellcat Widebody rental from ${site.location.city}: free delivery within ${delivery.freeRadiusMiles} miles, Suffolk, Nassau and the Hamptons for a fee, NYC on request.`,
  path: "/locations",
});

/** The list of area pages (SEO, 2026-10-19), and how delivery works across them. */
export default function LocationsPage() {
  const rules = [
    `Free pickup in ${site.location.city}, every day`,
    `Free delivery within ${delivery.freeRadiusMiles} miles of ${site.location.city}`,
    `${usd(delivery.feeMinUsd)} to ${usd(delivery.feeMaxUsd)} farther on Long Island, NYC on request`,
  ];

  return (
    <main id="top" className="flex-1">
      <div className="bg-surface/50">
        <div className="container-site pt-6 pb-10 xl:pt-10 xl:pb-14">
          <Breadcrumbs trail={[{ label: "Locations", href: "/locations" }]} />
          <div className="mt-6 max-w-[40rem] xl:mt-8">
            <p className="text-eyebrow font-semibold text-brand-deep uppercase">Locations</p>
            <h1 className="mt-3 text-title font-bold xl:text-[2.75rem] xl:leading-[1.1]">Areas we serve</h1>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted xl:text-base">
              The car lives in {site.location.city}, on the South Shore. From there it goes anywhere on Long Island, and
              the city is a train ride away.
            </p>
          </div>
          <div className="mt-8 xl:mt-10">
            <AreaCards areas={areas} heading="h2" />
          </div>
        </div>
      </div>

      <div className="border-y border-line bg-card">
        <section aria-labelledby="delivery-title" className="container-site py-8 xl:py-10">
          <SectionHeading id="delivery-title">How delivery works</SectionHeading>
          <ul className="mt-5 grid gap-3 sm:grid-cols-3 sm:gap-6">
            {rules.map((rule) => (
              <li key={rule} className="flex items-center gap-2.5 text-sm font-medium text-ink-soft">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-tint text-xs text-brand-deep">
                  <CheckIcon />
                </span>
                {rule}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="pt-12 pb-10 xl:pt-14 xl:pb-14">
        <CtaBanner />
      </div>
    </main>
  );
}
