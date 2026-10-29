import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { PostArticle } from "@/components/blog/PostArticle";
import { JsonLd } from "@/components/seo/JsonLd";
import { site } from "@/config/site";
import { getAllPosts, getPost, type BlogPost } from "@/lib/blog";
import { absoluteUrl, blogPublisher, pageMetadata } from "@/lib/seo";

// Every post is a static page. A post published after the build is rendered on its first
// visit (the visitor waits for the whole page, so search engines get a real 404 or redirect),
// and kept until the API says it changed (lib/blog.ts).
export const ensureStatic = "navigation";

export async function generateStaticParams() {
  const posts = await getAllPosts();
  // At least one is required; with no posts yet, a name no post can have (it renders 404).
  return posts.length ? posts.map((post) => ({ slug: post.slug })) : [{ slug: "no-posts-yet" }];
}

async function loadPost(slug: string): Promise<BlogPost> {
  const found = await getPost(slug);
  if (!found) notFound();
  // A renamed post: its old address sends visitors and search engines to the new one.
  if ("redirectTo" in found) permanentRedirect(`/blog/${found.redirectTo}`);
  return found.post;
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const found = await getPost((await params).slug);
  if (!found || !("post" in found)) return {};
  const { post } = found;

  return pageMetadata({
    title: post.title,
    fullTitle: post.metaTitle,
    description: post.metaDescription,
    path: `/blog/${post.slug}`,
    ...(post.cover ? { image: post.cover } : {}),
    article: { publishedTime: post.publishedAt, modifiedTime: post.updatedAt },
  });
}

export default async function BlogPostPage({ params }: PageProps<"/blog/[slug]">) {
  const post = await loadPost((await params).slug);
  // The newest other posts.
  const related = (await getAllPosts()).filter((item) => item.slug !== post.slug).slice(0, 3);
  const url = absoluteUrl(`/blog/${post.slug}`);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          "@id": `${url}#post`,
          headline: post.title.length > 110 ? `${post.title.slice(0, 109)}…` : post.title,
          description: post.metaDescription,
          image: [post.cover ? post.cover.url : absoluteUrl("/opengraph-image.jpg")],
          datePublished: post.publishedAt,
          dateModified: post.updatedAt,
          author: { ...blogPublisher, "@type": "Organization" },
          publisher: blogPublisher,
          mainEntityOfPage: { "@type": "WebPage", "@id": url },
          url,
          inLanguage: "en-US",
          isPartOf: { "@type": "Blog", "@id": absoluteUrl("/blog#blog"), name: `${site.name} blog`, url: absoluteUrl("/blog") },
        }}
      />
      <PostArticle post={post} related={related} />
    </>
  );
}
