import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CtaBanner } from "@/components/sections/CtaBanner";
import { ArrowRightIcon } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { formatPostDate, updatedLater, type BlogPost, type BlogPostSummary } from "@/lib/blog";
import { renderMarkdown } from "@/lib/markdown";
import { PostCard, PostCoverPlaceholder } from "./PostCard";
import { PostCta } from "./PostCta";
import { TableOfContents } from "./TableOfContents";

/**
 * A blog post page: breadcrumbs, H1, dates, the cover (the page's LCP, so it loads first), the
 * contents, the text with a call to action in the middle and the site's banner at the end,
 * then related posts. Shared by /blog/[slug] and the draft preview.
 */
export function PostArticle({
  post,
  related,
  notice,
}: {
  post: BlogPost;
  related: BlogPostSummary[];
  /** A bar above the post (the preview says it is a preview). */
  notice?: ReactNode;
}) {
  const { toc, firstHalf, secondHalf } = renderMarkdown(post.content);
  const path = `/blog/${post.slug}`;

  return (
    <main id="top" className="flex-1">
      {notice}
      <article>
        <header className="bg-surface/50">
          <div className="container-site pt-6 pb-8 xl:pt-10 xl:pb-10">
            <Breadcrumbs
              trail={[
                { label: "Blog", href: "/blog" },
                { label: post.title, href: path },
              ]}
            />
            <div className="mt-6 max-w-[48rem] xl:mt-8">
              <p className="text-eyebrow font-semibold text-brand-deep uppercase">Blog</p>
              <h1 className="mt-3 text-title font-bold wrap-break-word xl:text-[2.75rem] xl:leading-[1.1]">{post.title}</h1>
              <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                {/* A draft in the preview has no publish date yet. */}
                {post.publishedAt ? (
                  <span>
                    Published <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt)}</time>
                  </span>
                ) : (
                  <span>Not published yet</span>
                )}
                {post.publishedAt && updatedLater(post) && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      Updated <time dateTime={post.updatedAt}>{formatPostDate(post.updatedAt)}</time>
                    </span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span>{post.readingTime} min read</span>
              </p>
            </div>
          </div>
        </header>

        <div className="container-site">
          <div className="relative aspect-[16/9] max-w-[56rem] overflow-hidden rounded-card bg-surface shadow-card">
            {post.cover ? (
              <Image
                src={post.cover.url}
                alt={post.cover.alt}
                fill
                sizes="(width >= 80rem) 56rem, (width >= 48rem) calc(100vw - 5rem), calc(100vw - 2rem)"
                loading="eager"
                fetchPriority="high"
                className="object-cover"
              />
            ) : (
              <PostCoverPlaceholder />
            )}
          </div>

          <div className="grid gap-10 pt-8 pb-12 lg:grid-cols-[minmax(0,44rem)_16rem] lg:justify-between xl:grid-cols-[minmax(0,44rem)_18rem] xl:pt-12 xl:pb-14">
            <div className="min-w-0">
              <div className="lg:hidden">
                <TableOfContents entries={toc} variant="inline" />
              </div>
              <div className="blog-prose mt-8 lg:mt-0">{firstHalf}</div>
              {secondHalf && (
                <>
                  <PostCta />
                  <div className="blog-prose">{secondHalf}</div>
                </>
              )}
            </div>
            <div className="hidden lg:block">
              <TableOfContents entries={toc} variant="aside" />
            </div>
          </div>
        </div>
      </article>

      <div className="pb-12 xl:pb-14">
        <CtaBanner />
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-title" className="container-site pb-12 xl:pb-16">
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-2">
            <SectionHeading id="related-title">Related posts</SectionHeading>
            <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-deep hover:underline">
              All posts
              <ArrowRightIcon />
            </Link>
          </div>
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:gap-6">
            {related.map((item) => (
              <li key={item.slug}>
                <PostCard post={item} heading="h3" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
