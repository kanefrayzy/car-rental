import type { Metadata } from "next";
import { site } from "@/config/site";

/** An absolute address on the live site, as structured data and link previews need. */
export const absoluteUrl = (path: string) => new URL(path, site.url).toString();

/**
 * The link preview for every page: the hero photo of the car with the logo above it
 * (app/opengraph-image.jpg, built by scripts/brand.mjs). Set on each page explicitly: a page
 * that sets its own openGraph replaces the layout's, and the file-based image went with it.
 */
const shareImage = {
  url: "/opengraph-image.jpg",
  width: 1200,
  height: 630,
  alt: `${site.name}: the Dodge Charger Hellcat Widebody by the bay in ${site.location.city}`,
};

/**
 * Title, description, canonical address and link previews for one page. `title` is the
 * part before "| Bueno Exotics"; with it the whole title must stay within 60 characters, and
 * the description within 155 (search results cut them there).
 */
export function pageMetadata({
  title,
  fullTitle = `${title} | ${site.name}`,
  description,
  path,
  image = shareImage,
  article,
  noindex = false,
}: {
  title: string;
  /** The whole <title>, when the page sets it itself (a blog post's SEO title from the admin panel). */
  fullTitle?: string;
  description: string;
  /** The page's address; left out only by the layout's fallback (no canonical then). */
  path?: string;
  /** The link preview picture; the hero scene by default. A blog post uses its cover. */
  image?: { url: string; width: number; height: number; alt: string };
  /** A blog post: Open Graph type "article" with its dates. */
  article?: { publishedTime: string; modifiedTime: string };
  /** Keep the page out of search results (an empty blog, a draft preview). */
  noindex?: boolean;
}): Metadata {
  return {
    title: { absolute: fullTitle },
    description,
    ...(path ? { alternates: { canonical: path } } : {}),
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title: fullTitle,
      description,
      ...(path ? { url: path } : {}),
      siteName: site.name,
      locale: "en_US",
      ...(article ? { type: "article", ...article, authors: [site.url] } : { type: "website" }),
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image],
    },
  };
}

/** The business as the author and publisher of the blog's posts (BlogPosting structured data). */
export const blogPublisher = {
  "@type": "Organization",
  "@id": absoluteUrl("/#organization"),
  name: site.name,
  url: site.url,
  logo: { "@type": "ImageObject", url: absoluteUrl("/brand/logo.png") },
};

/**
 * The Google Search Console ownership check, on the home page only. The code comes from the
 * build (deploy/.env, inlined by next.config.ts); without it the tag is left out.
 */
export const siteVerification: Metadata["verification"] = {
  google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
};

/** The social profiles that are set in config (site.social), in display order. */
export const socialLinks = (
  [
    ["instagram", "Instagram"],
    ["tiktok", "TikTok"],
    ["facebook", "Facebook"],
  ] as const
)
  .filter(([network]) => site.social[network])
  .map(([network, label]) => ({ network, label, url: site.social[network] }));

/** The business's profiles elsewhere, for `sameAs`: Google first, then the social links. */
export const sameAs = [site.google.profile, ...socialLinks.map((link) => link.url), ...site.sameAs];

/** The business's id in structured data. The home page describes it in full (BusinessJsonLd). */
export const businessId = absoluteUrl("/#business");

/** A reference to the business from another page's structured data (a Service's provider). */
export const businessRef = {
  "@type": "AutoRental",
  "@id": businessId,
  name: site.name,
  url: site.url,
  telephone: site.phone.schema,
};

/** The areas from config, as schema.org places. */
export const areaServed = site.areaServed.map((area) => ({ "@type": area.type, name: area.name }));

export type Crumb = { label: string; href: string };
