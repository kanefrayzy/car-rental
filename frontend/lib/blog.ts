import { cacheLife, cacheTag } from "next/cache";

/**
 * The blog, read from the API (backend: GET /api/blog/posts, Api\BlogPostController). Server-side
 * only. Everything is cached under the tag "blog": the API calls the website's
 * /internal/revalidate after a post is published, changed or deleted, and the pages, the
 * sitemap and the RSS feed refresh at once. Without that call they refresh within minutes.
 *
 * While the site is being built the API may be out of reach (a Docker build); the blog is
 * then empty until the first refresh. Once the site runs, a failed call throws instead, so
 * a passing outage never replaces a cached post with "not found".
 */
const SERVER_API_URL = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL)?.replace(/\/+$/, "");

/** Posts per page on /blog and /blog/page/N. */
export const BLOG_PAGE_SIZE = 12;

export type BlogCover = { url: string; width: number; height: number; alt: string };

export type BlogPostSummary = {
  slug: string;
  title: string;
  excerpt: string;
  cover: BlogCover | null;
  publishedAt: string;
  updatedAt: string;
  readingTime: number;
};

export type BlogPost = BlogPostSummary & {
  content: string;
  /** The whole <title> (the API adds the site's name when it fits). */
  metaTitle: string;
  metaDescription: string;
};

type ListResponse = { data: BlogPostSummary[]; meta: { page: number; lastPage: number } };

const building = () => process.env.NEXT_PHASE === "phase-production-build";

async function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${SERVER_API_URL}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(5000),
    ...init,
  });
}

/** Every live post, newest first (the API pages them; this reads all pages). */
export async function getAllPosts(): Promise<BlogPostSummary[]> {
  "use cache";
  cacheTag("blog");
  cacheLife("minutes");

  if (!SERVER_API_URL) return [];

  try {
    const posts: BlogPostSummary[] = [];
    for (let page = 1; ; page++) {
      const response = await api(`/blog/posts?perPage=100&page=${page}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { data, meta } = (await response.json()) as ListResponse;
      posts.push(...data);
      if (page >= meta.lastPage) break;
    }
    return posts;
  } catch (error) {
    if (building()) {
      console.warn(`The blog is unavailable during the build, starting empty: ${String(error)}`);
      return [];
    }
    throw new Error(`The blog API is unavailable: ${String(error)}`);
  }
}

export type PostLookup = { post: BlogPost } | { redirectTo: string } | null;

/**
 * One live post. A renamed post's old slug gives `redirectTo` (the API answers 301 with the
 * current slug); a draft, a scheduled post or a missing one gives null.
 */
export async function getPost(slug: string): Promise<PostLookup> {
  "use cache";
  cacheTag("blog");
  cacheLife("minutes");

  if (!SERVER_API_URL || !/^[a-z0-9-]+$/i.test(slug)) return null;

  try {
    const response = await api(`/blog/posts/${encodeURIComponent(slug)}`, { redirect: "manual" });
    if (response.status === 404) return null;
    if (response.status === 301) {
      const { slug: current } = (await response.json()) as { slug: string };
      return { redirectTo: current };
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { post: ((await response.json()) as { data: BlogPost }).data };
  } catch (error) {
    if (building()) return null;
    throw new Error(`The blog API is unavailable: ${String(error)}`);
  }
}

/**
 * Any post, draft or not, through its signed preview link from the admin panel. Not cached:
 * the preview shows the last saved version.
 */
export async function getPreview(params: { post: string; expires: string; signature: string }) {
  if (!SERVER_API_URL || !/^\d+$/.test(params.post)) return null;

  const query = new URLSearchParams({ expires: params.expires, signature: params.signature });
  const response = await api(`/blog/preview/${params.post}?${query}`, { cache: "no-store" });
  if (!response.ok) return null;
  return (await response.json()) as { data: BlogPost; state: "draft" | "scheduled" | "published" };
}

/** Page `page` of the list (1-based), or null past the last page. Page 1 always exists. */
export function postsPage(posts: BlogPostSummary[], page: number) {
  const pageCount = Math.max(1, Math.ceil(posts.length / BLOG_PAGE_SIZE));
  if (!Number.isInteger(page) || page < 1 || page > pageCount) return null;
  return { posts: posts.slice((page - 1) * BLOG_PAGE_SIZE, page * BLOG_PAGE_SIZE), page, pageCount };
}

/** The address of page `page` of the list. */
export const blogPageHref = (page: number) => (page <= 1 ? "/blog" : `/blog/page/${page}`);

/** "October 21, 2026", the business's calendar day. */
export function formatPostDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "America/New_York" }).format(new Date(iso));
}

/** Whether a post was updated on a later day than it was published (then the page says so). */
export function updatedLater(post: BlogPostSummary) {
  return formatPostDate(post.updatedAt) !== formatPostDate(post.publishedAt) && post.updatedAt > post.publishedAt;
}
