import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";

/**
 * Called by the API after a blog post is published, changed or deleted (backend:
 * App\Services\BlogRevalidator): drops the cached blog pages, sitemap and RSS feed, so the
 * next visit gets the new version. Authenticated by BLOG_REVALIDATE_SECRET, shared with the API.
 * In production only the API reaches it: Caddy answers 404 for /internal/* from outside.
 */
function authorized(request: Request) {
  const secret = process.env.BLOG_REVALIDATE_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || !given) return false;

  const [a, b] = [Buffer.from(given), Buffer.from(secret)];
  return a.length === b.length && timingSafeEqual(a, b);
}

const ALLOWED_TAGS = new Set(["blog"]);

export async function POST(request: Request) {
  if (!authorized(request)) {
    return Response.json({ revalidated: false, message: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { tags?: unknown; slugs?: unknown };
  const tags = Array.isArray(body.tags) ? body.tags.filter((tag): tag is string => ALLOWED_TAGS.has(tag)) : ["blog"];

  // Expire at once (not stale-while-revalidate): the owner just pressed Publish and looks.
  for (const tag of tags.length ? tags : ["blog"]) revalidateTag(tag, { expire: 0 });

  const slugs = Array.isArray(body.slugs) ? body.slugs.filter((slug) => typeof slug === "string").slice(0, 20) : [];
  console.info(`Blog revalidated${slugs.length ? ` (${slugs.join(", ")})` : ""}.`);

  return Response.json({ revalidated: true, tags, now: Date.now() });
}
