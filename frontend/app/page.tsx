import type { Metadata } from "next";
import { Contact } from "@/components/sections/Contact";
import { CtaBanner } from "@/components/sections/CtaBanner";
import { Faq } from "@/components/sections/Faq";
import { Hero } from "@/components/sections/Hero";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Occasions } from "@/components/sections/Occasions";
import { Location } from "@/components/sections/Location";
import { Requirements } from "@/components/sections/Requirements";
import { TheCar } from "@/components/sections/TheCar";
import { BusinessJsonLd } from "@/components/seo/BusinessJsonLd";
import { charger } from "@/config/cars";
import { site } from "@/config/site";
import { pageMetadata, siteVerification } from "@/lib/seo";

export const metadata: Metadata = {
  ...pageMetadata({
    title: `Exotic Car Rental in ${site.location.city}, ${site.location.region}`,
    description: `Rent a ${charger.horsepower} hp Dodge Charger SRT Hellcat Widebody in ${site.location.city}, NY. Pickup or delivery across Long Island. Check your dates and book online.`,
    path: "/",
  }),
  verification: siteVerification,
};

// Sections are added here top to bottom as they are built.
export default function Home() {
  return (
    <>
      <BusinessJsonLd />
      <main id="top" className="flex-1">
        <Hero />
        <TheCar />
        <Occasions />
        <HowItWorks />
        <Requirements />
        <Location />
        <Faq />
        <Contact />
        <CtaBanner />
      </main>
    </>
  );
}
