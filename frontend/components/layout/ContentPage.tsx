import type { ReactNode } from "react";
import { Breadcrumbs } from "./Breadcrumbs";

type ContentPageProps = {
  title: string;
  /** The page's own address, for the breadcrumb trail. */
  path: string;
  /** Small line under the title, such as the date a policy was last updated. */
  intro?: ReactNode;
  children: ReactNode;
};

/**
 * Text pages (rental terms, privacy): the site's header and footer around a single readable
 * column. Plain h2, p and ul inside `children` are styled here, so the pages stay plain markup.
 */
export function ContentPage({ title, path, intro, children }: ContentPageProps) {
  return (
    <>
      <main id="top" className="flex-1">
        <article className="container-site pt-6 pb-16 xl:pt-10 xl:pb-24">
          <Breadcrumbs trail={[{ label: title, href: path }]} />
          <div className="mt-8 max-w-[44rem] xl:mt-10">
            <span
              aria-hidden="true"
              className="block h-[3px] w-[2.375rem] rounded-full bg-brand-deep"
            />
            <h1 className="mt-3 text-title font-bold">{title}</h1>
            {intro && <p className="mt-3 text-sm text-muted">{intro}</p>}
            <div className="mt-8 text-[0.9375rem] leading-relaxed text-ink-soft [&_a]:font-medium [&_a]:text-brand-deep [&_a]:underline-offset-2 hover:[&_a]:underline [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_h3]:mt-6 [&_h3]:font-display [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-ink [&_li]:mt-1.5 [&_p]:mt-3 [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
              {children}
            </div>
          </div>
        </article>
      </main>
    </>
  );
}
