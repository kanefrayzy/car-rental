import type { MetadataRoute } from "next";
import { cars } from "@/config/cars";
import { areas } from "@/config/locations";
import { services } from "@/config/services";
import { site } from "@/config/site";
import { getAllPosts, type BlogPostSummary } from "@/lib/blog";
import { absoluteUrl } from "@/lib/seo";

/**
 * When each page's content last changed (lastmod). Dates, not the build time: reading the
 * clock would change the file on every deploy without the pages changing, and search engines
 * learn to ignore a lastmod that always moves. Change a date when you change that page; the
 * service and area pages keep theirs in config/services.ts and config/locations.ts.
 */
const updated = {
  home: "2026-10-20",
  services: "2026-10-19",
  locations: "2026-10-19",
  contact: "2026-10-19",
  book: "2026-10-19",
  rentalTerms: "2026-10-20",
  privacy: "2026-10-18",
};

/** Live posts for the sitemap; without them (the API is down) the rest is still listed. */
async function blogPosts(): Promise<BlogPostSummary[]> {
  try {
    return await getAllPosts();
  } catch (error) {
    console.warn(`The sitemap is listed without the blog: ${String(error)}`);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // The blog's dates come from the posts (updated_at in the admin panel). /blog itself is
  // listed once there is a post: until then it is noindex.
  const posts = await blogPosts();
  const blog: MetadataRoute.Sitemap = posts.length
    ? [
        // The list changes with any of its posts: the latest change of any.
        { url: absoluteUrl("/blog"), lastModified: posts.map((post) => post.updatedAt).sort().at(-1), changeFrequency: "weekly", priority: 0.6 },
        ...posts.map((post) => ({
          url: absoluteUrl(`/blog/${post.slug}`),
          lastModified: post.updatedAt,
          changeFrequency: "monthly" as const,
          priority: 0.6,
        })),
      ]
    : [];

  return [
    { url: site.url, lastModified: updated.home, changeFrequency: "weekly", priority: 1 },
    ...cars.map((car) => ({
      url: absoluteUrl(`/book/${car.slug}`),
      lastModified: updated.book,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    { url: absoluteUrl("/services"), lastModified: updated.services, changeFrequency: "monthly", priority: 0.8 },
    ...services.map((service) => ({
      url: absoluteUrl(`/services/${service.slug}`),
      lastModified: service.updated,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    { url: absoluteUrl("/locations"), lastModified: updated.locations, changeFrequency: "monthly", priority: 0.8 },
    ...areas.map((area) => ({
      url: absoluteUrl(`/locations/${area.slug}`),
      lastModified: area.updated,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: absoluteUrl("/contact"), lastModified: updated.contact, changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/rental-terms"), lastModified: updated.rentalTerms, changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/privacy"), lastModified: updated.privacy, changeFrequency: "yearly", priority: 0.3 },
    ...blog,
  ];
}
