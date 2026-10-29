import { site } from "@/config/site";
import { getCars } from "@/lib/catalog";
import { absoluteUrl, areaServed, businessId, sameAs } from "@/lib/seo";
import { JsonLd } from "./JsonLd";

// "07:00" to "Mo-Su 07:00-23:00": the phone is answered and the car handed over every day.
const { open, close } = site.booking.hours;

/**
 * The business for search engines, on the home page: who, where, when and what it rents.
 * Built from config and the live price, so a new name, phone or price shows up here too.
 * The address has no street on purpose: the pickup spot is sent with the confirmation.
 * Other pages refer to it by its @id (lib/seo.ts, businessRef).
 */
export async function BusinessJsonLd() {
  const cars = await getCars();
  const { location } = site;

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "AutoRental",
        "@id": businessId,
        name: site.name,
        url: site.url,
        telephone: site.phone.schema,
        ...(site.email ? { email: site.email } : {}),
        logo: absoluteUrl("/brand/logo.png"),
        image: [absoluteUrl("/opengraph-image.jpg"), ...cars[0].gallery.slice(0, 3).map((image) => absoluteUrl(image.src))],
        priceRange: "$$$",
        address: {
          "@type": "PostalAddress",
          addressLocality: location.city,
          addressRegion: location.state,
          postalCode: location.zip,
          addressCountry: location.country,
        },
        geo: { "@type": "GeoCoordinates", latitude: location.lat, longitude: location.lng },
        areaServed,
        openingHours: `Mo-Su ${open}-${close}`,
        hasMap: site.google.profile,
        sameAs,
        makesOffer: cars.map((car) => ({
          "@type": "Offer",
          itemOffered: { "@type": "Car", name: car.fullName },
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: car.pricePerDay,
            priceCurrency: car.currency,
            unitText: "DAY",
          },
        })),
      }}
    />
  );
}
