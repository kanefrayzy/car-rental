import Link from "next/link";
import { ArrowRightIcon } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { OccasionShowcase } from "./OccasionShowcase";

/**
 * Not in the mockups (user, 2026-10-16): what people rent the car for. Each card leads to its
 * service page, and its Book button opens the booking page with the occasion chosen.
 * Phones swipe through the cards (the next one peeks in); from md up they sit in a bento grid
 * (user, 2026-10-19). The same cards are on /services.
 */
export function Occasions() {
  return (
    <section id="occasions" aria-labelledby="occasions-title" className="container-site pt-10 xl:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-2">
        <div>
          <SectionHeading id="occasions-title">Occasions</SectionHeading>
          <p className="mt-2 max-w-[30rem] text-[0.9375rem] leading-relaxed text-muted">
            The car for the day you want to remember. Pick the occasion when you book.
          </p>
        </div>
        <Link href="/services" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-deep hover:underline">
          All services
          <ArrowRightIcon />
        </Link>
      </div>

      <div className="mt-5 xl:mt-6">
        <OccasionShowcase />
      </div>
    </section>
  );
}
