import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/ui/icons";
import { formatPostDate, type BlogPostSummary } from "@/lib/blog";

/** A post in the blog list and under "Related posts": cover, date, title, excerpt. */
export function PostCard({
  post,
  heading: Heading = "h2",
  eager = false,
}: {
  post: BlogPostSummary;
  heading?: "h2" | "h3";
  /** The first card on /blog: its cover is the largest thing on screen when the page opens. */
  eager?: boolean;
}) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-card shadow-card transition-[translate,box-shadow,border-color] duration-300 ease-out-soft hover:-translate-y-1 hover:border-brand-deep/30 hover:shadow-[0_18px_40px_-20px_rgb(10_23_48/0.28)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="relative aspect-[16/9] overflow-hidden bg-surface">
        {post.cover ? (
          <Image
            src={post.cover.url}
            alt={post.cover.alt}
            fill
            sizes="(width >= 80rem) 25rem, (width >= 64rem) calc((100vw - 7rem) / 3), (width >= 40rem) calc((100vw - 4rem) / 2), calc(100vw - 2.5rem)"
            loading={eager ? "eager" : "lazy"}
            fetchPriority={eager ? "high" : "auto"}
            className="object-cover transition-transform duration-500 ease-out-soft group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <PostCoverPlaceholder />
        )}
      </div>
      <div className="flex flex-1 flex-col p-5 xl:p-6">
        <PostMeta post={post} />
        <Heading className="mt-2 font-display text-lg leading-snug font-bold tracking-[-0.01em] wrap-break-word text-ink group-hover:text-brand-deep">
          {/* The whole card is the link (the ::after covers it), with the title as its name. */}
          <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0">
            {post.title}
          </Link>
        </Heading>
        {post.excerpt && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{post.excerpt}</p>}
        <span aria-hidden="true" className="mt-auto flex items-center gap-1.5 pt-4 text-sm font-medium text-brand-deep">
          Read the post
          <ArrowRightIcon className="text-sm transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </span>
      </div>
    </article>
  );
}

/** "October 21, 2026 · 5 min read". */
export function PostMeta({ post, className = "" }: { post: BlogPostSummary; className?: string }) {
  return (
    <p className={`flex flex-wrap items-center gap-x-2 text-xs text-muted ${className}`}>
      <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt)}</time>
      <span aria-hidden="true">·</span>
      <span>{post.readingTime} min read</span>
    </p>
  );
}

/** A post without a cover: the site's navy with a light streak, no picture. */
export function PostCoverPlaceholder() {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden bg-navy">
      <div className="absolute -inset-x-1/4 top-1/2 h-24 -translate-y-1/2 -rotate-12 bg-linear-to-r from-transparent via-brand-deep/45 to-transparent blur-2xl" />
      <p className="absolute bottom-4 left-5 text-eyebrow font-semibold tracking-[0.3em] text-white/70 uppercase">Bueno Exotics</p>
    </div>
  );
}
