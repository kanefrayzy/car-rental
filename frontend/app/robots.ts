import type { MetadataRoute } from "next";
import { site } from "@/config/site";

// /be is the admin panel and /api the booking API (both Laravel, behind the same domain). The
// private booking page (/booking) is left crawlable on purpose: it says noindex itself, and a
// blocked page could not tell search engines that.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/be", "/api/"] },
    sitemap: new URL("/sitemap.xml", site.url).toString(),
  };
}
