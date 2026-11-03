import Link from "next/link";
import { PostCard } from "@/components/blog/PostCard";
import { ArrowRightIcon } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getAllPosts, type BlogPostSummary } from "@/lib/blog";

/** How many of the newest posts the home page shows. */
const COUNT = 3;

/**
 * The newest posts on the home page (user, 2026-11-03). Phones and tablets swipe through the
 * cards like the Occasions ones; from lg they sit in three columns. Covers load lazily: the
 * section is far below the fold.
 *
 * The home page must never fail because of the blog, so an API error here hides the section
 * instead of throwing (the blog pages themselves throw, see lib/blog.ts). No posts: no section.
 */
export async function BlogTeaser() {
  let posts: BlogPostSummary[];
  try {
    posts = (await getAllPosts()).slice(0, COUNT);
  } catch {
    return null;
  }
  if (posts.length === 0) return null;

  return (
    <section id="blog" aria-labelledby="blog-title" className="container-site pt-2 xl:pt-8">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-2">
        <div>
          <SectionHeading id="blog-title">From the blog</SectionHeading>
          <p className="mt-2 max-w-[34rem] text-[0.9375rem] leading-relaxed text-muted">
            Guides for renting on Long Island: what it costs, what you need, and where to drive.
          </p>
        </div>
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-deep hover:underline">
          All posts
          <ArrowRightIcon />
        </Link>
      </div>

      <ul className="-mx-(--gutter) mt-5 flex snap-x snap-mandatory scroll-px-(--gutter) gap-4 overflow-x-auto px-(--gutter) pt-1 pb-3 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 lg:pb-0 xl:mt-6 xl:gap-6">
        {posts.map((post) => (
          <li key={post.slug} className="w-[82%] max-w-[21rem] shrink-0 snap-start lg:w-auto lg:max-w-none">
            <PostCard post={post} heading="h3" />
          </li>
        ))}
      </ul>
    </section>
  );
}
