import { site } from "@/config/site";
import { getAllPosts } from "@/lib/blog";
import { absoluteUrl } from "@/lib/seo";

/**
 * The blog as an RSS 2.0 feed, newest 50 posts. Static: rebuilt when the blog changes (the
 * "blog" cache tag, lib/blog.ts).
 */
const escape = (text: string) =>
  text.replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char]!);

export async function GET() {
  const posts = (await getAllPosts()).slice(0, 50);
  const blogUrl = absoluteUrl("/blog");

  const items = posts
    .map((post) => {
      const url = absoluteUrl(`/blog/${post.slug}`);
      return `    <item>
      <title>${escape(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
      <description>${escape(post.excerpt)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(`${site.name} blog`)}</title>
    <link>${blogUrl}</link>
    <description>${escape(`Exotic car rental tips and guides from ${site.name}, ${site.location.city}, ${site.location.region}.`)}</description>
    <language>en-us</language>
    <atom:link href="${absoluteUrl("/blog/rss.xml")}" rel="self" type="application/rss+xml" />${
      posts[0] ? `\n    <lastBuildDate>${new Date(posts[0].updatedAt).toUTCString()}</lastBuildDate>` : ""
    }
${items}
  </channel>
</rss>
`;

  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
