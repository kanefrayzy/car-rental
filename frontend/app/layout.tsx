import type { Metadata, Viewport } from "next";
import { DM_Sans, Plus_Jakarta_Sans } from "next/font/google";
import { Analytics } from "@/components/layout/Analytics";
import { CookieNotice } from "@/components/layout/CookieNotice";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { MobileActionBar } from "@/components/layout/MobileActionBar";
import { site } from "@/config/site";
import { pageMetadata } from "@/lib/seo";
import "./globals.css";

// Body text. Preloaded too: without it the first paint came about 0.3 s later in Lighthouse
// (2026-10-19), since the text waits for the font it is set in.
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

// Headings. Closest match to the mockup's wide geometric display face. Preloaded: the hero
// headline is set in it.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

// The fallback for pages without their own (404, the private booking page). Every public
// page sets its own, with its canonical address, through pageMetadata (lib/seo.ts).
export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  ...pageMetadata({
    title: `Exotic Car Rental in ${site.location.city}, ${site.location.region}`,
    description: `Rent a Dodge Charger SRT Hellcat Widebody in ${site.location.city}, NY. Pickup or delivery across Long Island. Check your dates and book online.`,
  }),
};

export const viewport: Viewport = {
  themeColor: "#fcfdfe",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-scroll-behavior: Next turns the smooth scrolling off while it moves to a new page.
    // Without it, its scroll to the new page raced the smooth animation and phones landed
    // at the footer (2026-10-16).
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${dmSans.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* The header and footer live here, not in each page: a page then starts with its
            <main>, and Next can tell whether that top is on screen after a navigation (the
            sticky header always looked "on screen", so pages kept the old scroll position). */}
        <Header />
        {children}
        <Footer />
        <MobileActionBar />
        <CookieNotice />
        <Analytics />
      </body>
    </html>
  );
}
