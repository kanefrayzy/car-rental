import { JsonLd } from "@/components/seo/JsonLd";
import { ChevronDownIcon } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { faqFor } from "@/config/content";
import { getSiteSettings } from "@/lib/catalog";

// Native <details name="faq">: one open at a time, keyboard and screen-reader support
// for free, and no client JavaScript. The open/close transition is in globals.css.
// The contact and services pages show a few of the questions under their own title; the
// area pages add their own questions in front. Every block is also marked up as a FAQPage.
export async function Faq({
  questions,
  extra = [],
  title = "FAQ",
  id = "faq",
}: {
  /** Only these questions, in the FAQ's order; all of them when left out. */
  questions?: readonly string[];
  /** Questions of the page's own, shown first. */
  extra?: readonly { question: string; answer: string }[];
  title?: string;
  id?: string;
}) {
  const all = faqFor((await getSiteSettings()).depositUsd);
  const items = [...extra, ...(questions ? all.filter((item) => questions.includes(item.question)) : all)];

  return (
    <section id={id} aria-labelledby={`${id}-title`} className="container-site pt-10 pb-8 xl:pt-5 xl:pb-6">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          })),
        }}
      />
      <SectionHeading id={`${id}-title`}>{title}</SectionHeading>

      <div className="mt-5 grid items-start gap-4 md:grid-cols-2 xl:mt-2.5 xl:gap-x-9 xl:gap-y-2">
        {items.map((item) => (
          <details
            key={item.question}
            name="faq"
            className="group rounded-btn-lg border border-line bg-surface/60 transition-colors hover:border-brand-deep/40 open:border-brand-deep/40 xl:rounded-[0.625rem] xl:border-line-strong xl:bg-card"
          >
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-[inherit] px-4 text-[0.8125rem] font-medium text-ink-soft transition-colors hover:text-brand-deep xl:min-h-10 xl:px-5 [&::-webkit-details-marker]:hidden">
              {item.question}
              <ChevronDownIcon className="shrink-0 text-base transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
            </summary>
            <p className="px-4 pt-1 pb-4 text-sm leading-relaxed text-muted xl:px-5">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
