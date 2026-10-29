/**
 * Business constants. Everything a non-developer may need to change lives here
 * (and in ./cars.ts for per-car data). Values marked PLACEHOLDER are not real yet.
 */
export const site = {
  // Final (client, 2026-10-15). The logo is a drawing of this name, not text: see
  // components/ui/Logo.tsx and scripts/brand.mjs.
  name: "Bueno Exotics",
  tagline: "Exotic car rental in Patchogue, Long Island",
  url: "https://buenoexoticsny.com",

  phone: {
    display: "(631) 459-1929",
    href: "tel:+16314591929",
    sms: "sms:+16314591929",
    /** The form schema.org examples use; structured data only. */
    schema: "+1-631-459-1929",
  },

  // null hides it everywhere on the site. Set them once the client confirms a mailbox and
  // an account: a link that goes nowhere is worse than no link.
  email: "info@buenoexoticsny.com" as string | null, // user, 2026-10-16; the contact form sends here too
  /**
   * The one place for the social profiles (user, 2026-10-23): the footer icons, "Follow us" on
   * /contact and the structured data (sameAs) all read them through `socialLinks` in
   * lib/seo.ts. An empty string hides that network everywhere.
   */
  social: {
    // Checked 2026-10-23: the "BE" monogram in the brand colours, posts of the car.
    instagram: "https://www.instagram.com/buenoexotics/" as string,
    // Confirmed as the business's by the user on 2026-10-23 (the profile itself was still bare).
    tiktok: "https://www.tiktok.com/@buenoexotics" as string,
    facebook: "" as string,
  },
  /**
   * The Google Business Profile (user, 2026-10-22). `profile` is the permanent Maps address
   * (cid from the review link, which redirects to the same place); the footer and /contact
   * link to it as "Reviews on Google". `review` opens the write-a-review box: the API sends it
   * after a rental (GOOGLE_REVIEW_URL on the server).
   */
  google: {
    profile: "https://maps.google.com/?cid=8350110052818599674",
    review: "https://g.page/r/Cfq-qy3ajOFzEBM/review",
  },
  /**
   * The business's own profiles elsewhere (Google Business Profile, Yelp, Facebook...), for
   * search engines (sameAs in the structured data). The Google profile above and the social
   * links are added to it automatically (lib/seo.ts). Add Yelp, Bing Places and the like here.
   */
  sameAs: [] as string[],

  /** Where the business rents and delivers, for search engines (areaServed). */
  areaServed: [
    { type: "City", name: "Patchogue" },
    { type: "AdministrativeArea", name: "Suffolk County" },
    { type: "AdministrativeArea", name: "Nassau County" },
    { type: "Place", name: "Long Island" },
    { type: "City", name: "New York City" },
  ],

  location: {
    city: "Patchogue",
    state: "NY",
    zip: "11772",
    region: "Long Island",
    country: "US",
    lat: 40.7657,
    lng: -73.0151,
    directionsUrl:
      "https://www.google.com/maps/dir/?api=1&destination=Patchogue%2C+NY+11772",
  },

  booking: {
    // Confirmed by the client on 2026-10-14. The API charges the deposit from its own
    // setting (RENTAL_DEPOSIT_USD in /backend): change both together.
    minDriverAge: 21,
    minRentalDays: 1,
    maxRentalDays: 30, // RENTAL_MAX_DAYS in /backend
    // Pick-up and return times (user, 2026-10-16): half-hour slots from open to close, New York
    // time; a rental is charged per started 24 hours from the pick-up time. The API has the
    // same hours (rental.hours in /backend): change both together.
    timeZone: "America/New_York",
    hours: { open: "07:00", close: "23:00", slotMinutes: 30, defaultTime: "10:00" },
    depositUsd: 1000, // the default; the owner changes it on the admin panel's Settings page
    // How long an unpaid request keeps its dates (RENTAL_HOLD_HOURS in /backend).
    holdHours: 24,
    includedMilesPerDay: 110,
    extraMileUsd: 3,
    delivery: {
      freeRadiusMiles: 10, // confirmed by the client on 2026-10-20
      feeMinUsd: 100,
      feeMaxUsd: 200,
    },
    upload: {
      maxSizeMb: 10,
      accept: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    },
    /**
     * Licenses and insurance cards are deleted this many days after the return date. Stated
     * on the privacy page; the API does the deleting (RENTAL_DOCUMENT_RETENTION_DAYS in
     * /backend). Change both together.
     */
    documentRetentionDays: 180, // PLACEHOLDER: not agreed with the client yet
  },
} as const;

/** Linked from the footer and the booking dialog. Both pages are drafts for the client to review. */
export const legalLinks = [
  { label: "Rental Terms", href: "/rental-terms" },
  { label: "Privacy", href: "/privacy" },
] as const;

export const nav = [
  { label: "The Car", href: "/#the-car" },
  { label: "Services", href: "/services" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Requirements", href: "/#requirements" },
  { label: "FAQ", href: "/#faq" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
] as const;
