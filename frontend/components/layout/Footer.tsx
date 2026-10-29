import Link from "next/link";
import { MailIcon, PhoneIcon, StarIcon } from "@/components/ui/icons";
import { Logo } from "@/components/ui/Logo";
import { SocialLinks } from "@/components/ui/SocialLinks";
import { areas } from "@/config/locations";
import { services } from "@/config/services";
import { legalLinks, nav, site } from "@/config/site";
import { getSiteSettings } from "@/lib/catalog";

// Fixed at build time (see next.config.ts): reading the clock during render would
// make the page dynamic.
const year = process.env.NEXT_PUBLIC_BUILD_YEAR;

// One light footer at every width: a single row on desktop (desktop mockup), the same
// content stacked and wrapped below that. No photo: the page already ends on the CTA car.
export async function Footer() {
  // Not needed for the content: awaiting the cached settings makes the footer its own chunk of
  // the streamed HTML, so the page above it (with the hero image) is parsed first. With a plain
  // sync footer, mobile Lighthouse LCP went from 2.48 s to 2.55 s (measured 2026-10-23).
  await getSiteSettings();
  const { city, state, region } = site.location;
  const link = "transition-colors hover:text-brand-deep";

  return (
    <footer className="text-ink-soft">
      <div className="container-site pt-9 pb-8 xl:pt-6 xl:pb-9">
        <div className="flex flex-col gap-6 border-b border-line pb-7 md:flex-row md:flex-wrap md:items-center md:gap-x-12 xl:flex-nowrap xl:gap-0 xl:pb-6">
          <div className="xl:w-[19.5rem] xl:shrink-0">
            <Link href="/#top" className="inline-flex">
              <Logo className="[--logo-size:1.375rem]" />
            </Link>
          </div>

          {/* Contacts, then the social icons on their own row. */}
          <div>
            <ul className="flex flex-wrap content-start gap-x-8 gap-y-4 text-sm xl:gap-x-[4.25rem] xl:text-[0.8125rem]">
              <li>
                <a href={site.phone.href} className={`flex items-center gap-3 font-medium xl:gap-[1.125rem] ${link}`}>
                  <PhoneIcon className="text-lg text-brand-deep" />
                  {site.phone.display}
                </a>
              </li>
              {site.email && (
                <li>
                  <a href={`mailto:${site.email}`} className={`flex items-center gap-3 font-medium xl:gap-[1.125rem] ${link}`}>
                    <MailIcon className="text-lg text-brand-deep" />
                    {site.email}
                  </a>
                </li>
              )}
              <li>
                <a
                  href={site.google.profile}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-3 font-medium xl:gap-[1.125rem] ${link}`}
                >
                  <StarIcon className="text-lg text-brand-deep" />
                  Reviews on Google
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </li>
            </ul>
            <SocialLinks className="mt-5 xl:mt-4" />
          </div>

          <nav aria-label="Footer" className="md:max-xl:basis-full xl:ml-auto">
            <ul className="flex flex-wrap gap-x-6 gap-y-3 text-sm xl:gap-10 xl:text-xs">
              {nav.map((item) => (
                <li key={item.href}>
                  <a href={item.href} className={link}>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* The service and area pages (config/services.ts, config/locations.ts), on every page
            for search engines and visitors. */}
        <div className="border-b border-line">
          {[
            {
              id: "footer-services",
              title: "Services",
              href: "/services",
              links: services.map((service) => ({ label: service.name, href: `/services/${service.slug}` })),
            },
            {
              id: "footer-areas",
              title: "Areas we serve",
              href: "/locations",
              links: areas.map((area) => ({ label: area.label, href: `/locations/${area.slug}` })),
            },
          ].map((group) => (
            <nav
              key={group.id}
              aria-labelledby={group.id}
              className="flex flex-col gap-3 py-6 not-first:border-t not-first:border-line md:flex-row md:items-baseline md:gap-8 xl:py-4"
            >
              <h2 id={group.id} className="shrink-0 text-[0.6875rem] md:w-36 font-semibold tracking-[0.12em] text-ink uppercase">
                <Link href={group.href} className={link}>
                  {group.title}
                </Link>
              </h2>
              <ul className="flex flex-wrap gap-x-6 gap-y-3 text-sm xl:gap-x-7 xl:text-xs">
                {group.links.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className={link}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[0.6875rem] text-muted xl:mt-4 xl:flex-row-reverse">
          <p className="whitespace-nowrap">
            {city}, {state}
            <span aria-hidden="true" className="mx-2.5">
              •
            </span>
            {region}
          </p>
          <p className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {/* Phones: the links get their own row under the copyright line. */}
            <span className="max-md:basis-full">
              © {year} {site.name}. All rights reserved.
            </span>
            {legalLinks.map((item) => (
              <Link key={item.href} href={item.href} className={link}>
                {item.label}
              </Link>
            ))}
          </p>
        </div>
      </div>
    </footer>
  );
}
