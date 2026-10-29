import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ContactPanel } from "@/components/sections/ContactPanel";
import { CtaBanner } from "@/components/sections/CtaBanner";
import { Faq } from "@/components/sections/Faq";
import { buttonClasses } from "@/components/ui/Button";
import { ArrowRightIcon, CheckIcon, PhoneIcon } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cars } from "@/config/cars";
import { site } from "@/config/site";
import { pageMetadata } from "@/lib/seo";
import { formatTime } from "@/lib/time";

export const metadata: Metadata = pageMetadata({
  title: `Contact and Instant Quote, ${site.location.city} NY`,
  description: `Get a quote for a Hellcat rental in ${site.location.city}, Long Island: a shoot, wedding, prom or weekend drive. Call or text ${site.phone.display}, or write online.`,
  path: "/contact",
});

// The questions people ask before writing in; the rest are on the home page.
const beforeYouWrite = [
  "Can I rent the car for a photoshoot or music video?",
  "Can I book the car for a wedding or prom?",
  "What does it cost in total?",
  "Can I pick up or get delivery?",
];

/**
 * Contact and quotes (user, 2026-10-16), structured after aaxotics.com/contact: intro with two
 * actions, a strip of three facts, the form beside hours / quick contact / social, a few
 * questions, and the booking banner. "Instant Quote" in the header leads here.
 */
export default function ContactPage() {
  const { open, close } = site.booking.hours;
  const facts = [
    `Call or text daily, ${formatTime(open)} – ${formatTime(close)}`,
    `Pickup in ${site.location.city} or delivery to you`,
    "Every quote shows the total with tax",
  ];

  return (
    <main id="top" className="flex-1">
      <div className="bg-surface/50">
        <div className="container-site grid items-center gap-8 pt-6 pb-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] xl:grid-cols-[minmax(0,1fr)_36rem] xl:gap-14 xl:pt-10 xl:pb-14">
          <div>
            <Breadcrumbs trail={[{ label: "Contact", href: "/contact" }]} />
            <p className="mt-6 text-eyebrow font-semibold text-brand-deep uppercase xl:mt-8">Contact &amp; quotes</p>
            <h1 className="mt-3 text-title font-bold xl:text-[2.75rem] xl:leading-[1.1]">
              Tell us the occasion. We’ll send the quote.
            </h1>
            <p className="mt-3 max-w-[36rem] text-[0.9375rem] leading-relaxed text-muted xl:text-base">
              A photoshoot, a wedding, prom or a weekend on Long Island: send the dates and what you have in mind, and
              we reply with availability and the price.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#send-details" className={buttonClasses({ size: "md" })}>
                Send a request
                <ArrowRightIcon className="text-base" />
              </a>
              <a href={site.phone.href} className={buttonClasses({ variant: "outline", size: "md" })}>
                <PhoneIcon />
                Call {site.phone.display}
              </a>
            </div>
          </div>
          <div className="relative aspect-[16/10] overflow-hidden rounded-card bg-surface shadow-card max-lg:hidden">
            <Image
              src="/images/gallery/charger-rear.webp"
              alt=""
              fill
              priority
              sizes="(min-width: 80rem) 36rem, 30rem"
              className="object-cover"
            />
          </div>
        </div>
      </div>

      <div className="border-y border-line bg-card">
        <ul className="container-site grid gap-3 py-5 sm:grid-cols-3 sm:gap-6">
          {facts.map((fact) => (
            <li key={fact} className="flex items-center gap-2.5 text-sm font-medium text-ink-soft">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-tint text-xs text-brand-deep">
                <CheckIcon />
              </span>
              {fact}
            </li>
          ))}
        </ul>
      </div>

      <section
        id="send-details"
        aria-labelledby="send-details-title"
        className="container-site pt-10 pb-10 xl:pt-14 xl:pb-12"
      >
        <SectionHeading id="send-details-title">Send the details</SectionHeading>
        <p className="mt-2 max-w-[36rem] text-[0.9375rem] leading-relaxed text-muted">
          The more we know about the day, the more exact the quote. Ready to pick dates?{" "}
          <Link href={`/book/${cars[0].slug}`} className="font-medium text-brand-deep hover:underline">
            Book online
          </Link>
          .
        </p>
        <div className="mt-6">
          <ContactPanel />
        </div>
      </section>

      <Faq id="before-you-write" title="Before you write" questions={beforeYouWrite} />

      <div className="pt-4 pb-10 xl:pb-14">
        <CtaBanner />
      </div>
    </main>
  );
}
