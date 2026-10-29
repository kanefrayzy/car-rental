import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { ChevronRightIcon } from "@/components/ui/icons";
import { absoluteUrl, type Crumb } from "@/lib/seo";

/**
 * The trail above an inner page's title, and the same trail for search engines
 * (BreadcrumbList). "Home" comes first by itself; the last crumb is the page itself.
 */
export function Breadcrumbs({ trail, className = "" }: { trail: Crumb[]; className?: string }) {
  const crumbs = [{ label: "Home", href: "/" }, ...trail];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: crumbs.map((crumb, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: crumb.label,
            item: absoluteUrl(crumb.href),
          })),
        }}
      />
      <nav aria-label="Breadcrumb" className={className}>
        <ol className="flex flex-wrap items-center gap-1.5 text-[0.8125rem] text-muted">
          {crumbs.map((crumb, index) =>
            index === crumbs.length - 1 ? (
              <li key={crumb.href} aria-current="page" className="flex min-w-0 max-w-full items-center gap-1.5 font-medium text-ink-soft">
                <ChevronRightIcon className="shrink-0 text-xs" />
                {/* A long blog title stays on one line here; the H1 below has it in full. */}
                <span className="truncate">{crumb.label}</span>
              </li>
            ) : (
              <li key={crumb.href} className="flex items-center gap-1.5">
                {index > 0 && <ChevronRightIcon className="text-xs" />}
                <Link href={crumb.href} className="hover:text-brand-deep">
                  {crumb.label}
                </Link>
              </li>
            ),
          )}
        </ol>
      </nav>
    </>
  );
}
