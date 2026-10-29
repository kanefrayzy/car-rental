import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BookingForm } from "@/components/booking/BookingForm";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Faq } from "@/components/sections/Faq";
import { Requirements } from "@/components/sections/Requirements";
import { cars, charger } from "@/config/cars";
import { site } from "@/config/site";
import { usd } from "@/config/terms";
import { getCars, getSiteSettings } from "@/lib/catalog";
import { pageMetadata } from "@/lib/seo";

// One booking page per car, built at deploy time.
export function generateStaticParams() {
  return cars.map((car) => ({ slug: car.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/book/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const car = (await getCars()).find((item) => item.slug === slug);
  if (!car) return {};

  return pageMetadata({
    title: `Book the ${car.name} in ${site.location.city}`,
    description: `Rent the ${charger.horsepower} hp ${car.name} for ${usd(car.pricePerDay)} a day in ${site.location.city}, Long Island. Check your dates, see the total with tax, book in two minutes.`,
    path: `/book/${car.slug}`,
  });
}

export default function BookPage({ params }: PageProps<"/book/[slug]">) {
  return (
    <>
      <main id="top" className="flex-1 bg-surface/50">
        {/* Every car's page is prerendered (generateStaticParams), so the HTML has the full
            form; the fallback only shows while an unknown address is looked up. */}
        <Suspense
          fallback={<div className="container-site min-h-[60rem] pt-6" />}
        >
          <BookContent params={params} />
        </Suspense>

        <div className="bg-page pb-4">
          <Requirements />
          <Faq />
        </div>
      </main>
    </>
  );
}

async function BookContent({
  params,
}: Pick<PageProps<"/book/[slug]">, "params">) {
  const { slug } = await params;
  const car = (await getCars()).find((item) => item.slug === slug);
  if (!car) notFound();

  return (
    <div className="container-site pt-6 pb-12 xl:pt-10 xl:pb-16">
      <Breadcrumbs
        trail={[
          { label: car.name, href: "/#the-car" },
          { label: "Book", href: `/book/${car.slug}` },
        ]}
      />

      <div className="mt-4 max-w-[44rem] xl:mt-5">
        <h1 className="text-title font-bold">Book the {car.name}</h1>
        <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-muted xl:text-base">
          {car.fullName}, {usd(car.pricePerDay)} a day. Pick up in{" "}
          {site.location.city} or have it delivered on Long Island. Send a
          request and we confirm by email, usually the same day.
        </p>
      </div>

      <div className="mt-6 xl:mt-8">
        <BookingForm car={car} depositUsd={(await getSiteSettings()).depositUsd} />
      </div>
    </div>
  );
}
