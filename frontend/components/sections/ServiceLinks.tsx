import Link from "next/link";
import { ArrowRightIcon } from "@/components/ui/icons";
import { occasions, type Occasion } from "@/config/content";
import { serviceFor } from "@/config/services";
import { OccasionIcon } from "./OccasionShowcase";

/** Compact links to a few services, each to its own page (the area and service pages). */
export function ServiceLinks({ slugs }: { slugs: Occasion[] }) {
  const list = slugs.map((slug) => occasions.find((occasion) => occasion.slug === slug)!);

  return (
    <ul className={`grid gap-3 xl:gap-5 ${list.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
      {list.map((occasion) => {
        return (
          <li key={occasion.slug}>
            <Link
              href={`/services/${serviceFor(occasion.slug).slug}`}
              className="group flex h-full items-center gap-4 rounded-card border border-line bg-card p-4 transition-colors hover:border-brand-deep/40 xl:p-5"
            >
              <OccasionIcon occasion={occasion.slug} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 font-display text-[0.9375rem] font-bold text-ink group-hover:text-brand-deep">
                  {occasion.title}
                  <ArrowRightIcon className="text-sm" />
                </span>
                <span className="mt-0.5 block text-[0.8125rem] leading-snug text-muted">{occasion.text}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
