import Link from "next/link";
import { ArrowRightIcon, PinIcon } from "@/components/ui/icons";
import type { Area } from "@/config/locations";

/**
 * Link cards to the area pages: on /locations, on /services ("Where we deliver") and at the
 * bottom of each area page (the areas next to it).
 */
export function AreaCards({ areas, heading: Heading = "h3" }: { areas: Area[]; heading?: "h2" | "h3" }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:gap-5">
      {areas.map((area) => (
        <li key={area.slug}>
          <Link
            href={`/locations/${area.slug}`}
            className="group flex h-full items-start gap-4 rounded-card border border-line bg-card p-5 shadow-card transition-[translate,box-shadow,border-color] duration-300 ease-out-soft hover:-translate-y-1 hover:border-brand-deep/30 hover:shadow-[0_18px_40px_-20px_rgb(10_23_48/0.28)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 xl:p-6"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-tint text-xl text-brand-deep">
              <PinIcon />
            </span>
            <span className="min-w-0 flex-1">
              <Heading className="flex items-center gap-1.5 text-base font-bold tracking-[-0.01em] text-ink group-hover:text-brand-deep">
                {area.label}
                <ArrowRightIcon className="text-sm transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
              </Heading>
              <span className="mt-1 block text-sm leading-relaxed text-muted">{area.summary}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
