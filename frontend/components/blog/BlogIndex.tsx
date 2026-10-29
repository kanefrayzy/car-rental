import Link from "next/link";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CtaBanner } from "@/components/sections/CtaBanner";
import { buttonClasses } from "@/components/ui/Button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { site } from "@/config/site";
import { blogPageHref, type BlogPostSummary } from "@/lib/blog";
import { Pagination } from "./Pagination";
import { PostCard } from "./PostCard";

export const blogIntro = `Ideas, guides and local tips for renting an exotic car on ${site.location.region}: weddings, prom, photoshoots and weekend drives.`;

/** /blog and /blog/page/N: the list of posts, newest first, with page links. */
export function BlogIndex({ posts, page, pageCount }: { posts: BlogPostSummary[]; page: number; pageCount: number }) {
  const firstCover = posts.slice(0, 3).findIndex((post) => post.cover);
  const trail = [{ label: "Blog", href: "/blog" }, ...(page > 1 ? [{ label: `Page ${page}`, href: blogPageHref(page) }] : [])];

  return (
    <main id="top" className="flex-1">
      <div className="bg-surface/50">
        <div className="container-site pt-6 pb-10 xl:pt-10 xl:pb-14">
          <Breadcrumbs trail={trail} />
          <div className="mt-6 max-w-[40rem] xl:mt-8">
            <p className="text-eyebrow font-semibold text-brand-deep uppercase">Blog</p>
            <h1 className="mt-3 text-title font-bold xl:text-[2.75rem] xl:leading-[1.1]">
              {page > 1 ? `The ${site.name} blog, page ${page}` : `The ${site.name} blog`}
            </h1>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted xl:text-base">{blogIntro}</p>
          </div>

          {posts.length > 0 ? (
            <>
              <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:mt-10 xl:gap-6">
                {posts.map((post, index) => (
                  <li key={post.slug}>
                    {/* The first cover is the page's largest picture on load (LCP). */}
                    <PostCard post={post} eager={index === firstCover} />
                  </li>
                ))}
              </ul>
              <div className="mt-10 xl:mt-12">
                <Pagination page={page} pageCount={pageCount} />
              </div>
            </>
          ) : (
            <div className="mt-8 max-w-[40rem] rounded-card border border-line bg-card p-6 shadow-card xl:mt-10 xl:p-8">
              <h2 className="font-display text-lg font-bold text-ink">The first posts are on their way</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Until then, see what the car is booked for most, or ask us anything about your date.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/services" className={buttonClasses({ variant: "primary", size: "md" })}>
                  Our services
                  <ArrowRightIcon className="text-base" />
                </Link>
                <Link href="/contact" className={buttonClasses({ variant: "outline", size: "md" })}>
                  Ask a question
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="pt-12 pb-10 xl:pt-14 xl:pb-14">
        <CtaBanner />
      </div>
    </main>
  );
}
