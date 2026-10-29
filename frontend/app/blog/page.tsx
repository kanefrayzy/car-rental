import type { Metadata } from "next";
import { BlogIndex, blogIntro } from "@/components/blog/BlogIndex";
import { JsonLd } from "@/components/seo/JsonLd";
import { site } from "@/config/site";
import { getAllPosts, postsPage } from "@/lib/blog";
import { absoluteUrl, blogPublisher, pageMetadata } from "@/lib/seo";

export const ensureStatic = "navigation";

export async function generateMetadata(): Promise<Metadata> {
  const posts = await getAllPosts();
  return {
    ...pageMetadata({
      title: "Blog: Exotic Car Rental Tips and Guides",
      description: blogIntro,
      path: "/blog",
      // Kept out of search results until the first post is published.
      noindex: posts.length === 0,
    }),
    alternates: { canonical: "/blog", types: { "application/rss+xml": [{ url: "/blog/rss.xml", title: `${site.name} blog` }] } },
  };
}

/** The blog's first page (2026-10-21). Later pages are /blog/page/N. */
export default async function BlogPage() {
  const posts = await getAllPosts();
  const { posts: shown, pageCount } = postsPage(posts, 1)!;

  return (
    <>
      {posts.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Blog",
            "@id": absoluteUrl("/blog#blog"),
            name: `${site.name} blog`,
            description: blogIntro,
            url: absoluteUrl("/blog"),
            publisher: blogPublisher,
            blogPost: shown.map((post) => ({
              "@type": "BlogPosting",
              "@id": `${absoluteUrl(`/blog/${post.slug}`)}#post`,
              headline: post.title,
              url: absoluteUrl(`/blog/${post.slug}`),
              datePublished: post.publishedAt,
              dateModified: post.updatedAt,
            })),
          }}
        />
      )}
      <BlogIndex posts={shown} page={1} pageCount={pageCount} />
    </>
  );
}
