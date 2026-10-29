import type { Metadata } from "next";
import { BookingTracker } from "@/components/booking/BookingTracker";
import { site } from "@/config/site";

// Private to the customer (reached through their signed link): kept out of search results.
export const metadata: Metadata = {
  title: `Your booking | ${site.name}`,
  robots: { index: false, follow: false },
};

export default function BookingPage() {
  return (
    <>
      <main id="top" className="flex-1 bg-surface/50">
        <div className="container-site pt-8 pb-14 xl:pt-12 xl:pb-20">
          <h1 className="mb-4 text-title font-bold">Your booking</h1>
          <BookingTracker />
        </div>
      </main>
    </>
  );
}
