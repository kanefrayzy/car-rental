import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { BlogIndex, blogIntro } from "@/components/blog/BlogIndex";
import { BLOG_PAGE_SIZE, blogPageHref, getAllPosts, postsPage } from "@/lib/blog";
import { pageMetadata } from "@/lib/seo";

export const ensureStatic = "navigation";

export async function generateStaticParams() {
  const pageCount = Math.ceil((await getAllPosts()).length / BLOG_PAGE_SIZE);
  // At least one is required: page 2 renders 404 until there are that many posts.
  return Array.from({ length: Math.max(1, pageCount - 1) }, (_, index) => ({ page: String(index + 2) }));
}

const pageNumber = (value: string) => (/^[1-9]\d{0,3}$/.test(value) ? Number(value) : NaN);

export async function generateMetadata({ params }: PageProps<"/blog/page/[page]">): Promise<Metadata> {
  const page = pageNumber((await params).page);
  const found = postsPage(await getAllPosts(), page);
  if (!found || page < 2) return {};

  // Each page is its own canonical (not page 1): it lists other posts.
  return pageMetadata({
    title: `Blog, Page ${page} of ${found.pageCount}`,
    description: `${blogIntro} Page ${page}.`,
    path: blogPageHref(page),
  });
}

/** /blog/page/2 and on. /blog/page/1 is /blog. */
export default async function BlogListPage({ params }: PageProps<"/blog/page/[page]">) {
  const { page: raw } = await params;
  if (raw === "1") permanentRedirect("/blog");

  const found = postsPage(await getAllPosts(), pageNumber(raw));
  if (!found) notFound();

  return <BlogIndex posts={found.posts} page={found.page} pageCount={found.pageCount} />;
}
