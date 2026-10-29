import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { blogPageHref } from "@/lib/blog";

/** Page links under the blog list: previous, the page numbers (with gaps), next. */
export function Pagination({ page, pageCount }: { page: number; pageCount: number }) {
  if (pageCount <= 1) return null;

  // First, last, and the pages next to the current one; "…" for the rest.
  const shown = [...new Set([1, page - 1, page, page + 1, pageCount])].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  const items: (number | "gap")[] = [];
  shown.forEach((n, index) => {
    if (index > 0 && n - shown[index - 1] > 1) items.push("gap");
    items.push(n);
  });

  const box =
    "flex h-10 min-w-10 items-center justify-center rounded-btn border px-3 text-sm font-medium transition-colors";

  return (
    <nav aria-label="Blog pages" className="flex flex-wrap items-center justify-center gap-2">
      {page > 1 && (
        <Link href={blogPageHref(page - 1)} className={`${box} gap-1 border-line-strong bg-card text-ink-soft hover:border-brand-deep hover:text-brand-deep`}>
          <ChevronLeftIcon className="text-xs" />
          Newer
        </Link>
      )}
      <ul className="flex flex-wrap items-center gap-2">
        {items.map((item, index) =>
          item === "gap" ? (
            <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-muted">
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                href={blogPageHref(item)}
                aria-current={item === page ? "page" : undefined}
                aria-label={`Page ${item}`}
                className={`${box} ${
                  item === page
                    ? "border-brand-deep bg-brand-deep text-white"
                    : "border-line-strong bg-card text-ink-soft hover:border-brand-deep hover:text-brand-deep"
                }`}
              >
                {item}
              </Link>
            </li>
          ),
        )}
      </ul>
      {page < pageCount && (
        <Link href={blogPageHref(page + 1)} className={`${box} gap-1 border-line-strong bg-card text-ink-soft hover:border-brand-deep hover:text-brand-deep`}>
          Older
          <ChevronRightIcon className="text-xs" />
        </Link>
      )}
    </nav>
  );
}
