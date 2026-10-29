import type { TocEntry } from "@/lib/markdown";

/**
 * "In this post": a link to each H2. Phones and tablets get it folded above the text; from
 * lg up it sits beside the text and stays in view while reading.
 */
export function TableOfContents({ entries, variant }: { entries: TocEntry[]; variant: "inline" | "aside" }) {
  if (entries.length < 2) return null;

  const list = (
    <ol className="grid gap-2.5 text-sm leading-snug">
      {entries.map((entry, index) => (
        <li key={entry.id} className="flex gap-2.5">
          <span aria-hidden="true" className="w-4 shrink-0 text-right font-semibold text-brand-deep tabular-nums">
            {index + 1}
          </span>
          <a href={`#${entry.id}`} className="text-ink-soft transition-colors wrap-break-word hover:text-brand-deep">
            {entry.text}
          </a>
        </li>
      ))}
    </ol>
  );

  if (variant === "aside") {
    return (
      <nav aria-labelledby="toc-title" className="sticky top-[calc(var(--header-h)+1.5rem)] rounded-card border border-line bg-card p-5 shadow-card">
        <p id="toc-title" className="mb-4 text-eyebrow font-semibold tracking-[0.12em] text-ink uppercase">
          In this post
        </p>
        {list}
      </nav>
    );
  }

  return (
    <details className="group rounded-card border border-line bg-card shadow-card">
      <summary className="flex list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
        In this post
        <span aria-hidden="true" className="text-xs text-brand-deep transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none">
          ▾
        </span>
      </summary>
      <nav aria-label="In this post" className="px-5 pb-5">
        {list}
      </nav>
    </details>
  );
}
