import Link from "next/link";
import { BookButton } from "@/components/booking/BookButton";
import { buttonClasses } from "@/components/ui/Button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { cars } from "@/config/cars";
import { site } from "@/config/site";

/**
 * The call to action in the middle of a post: a small card in the text column with the same
 * buttons as the rest of the site. The end of the post has the site's CtaBanner.
 */
export function PostCta() {
  const [car] = cars;

  return (
    <aside aria-label="Book the car" className="my-10 overflow-hidden rounded-card bg-navy p-6 text-white shadow-card md:p-7">
      <p className="text-eyebrow font-medium tracking-[0.3em] text-white/80 uppercase">Drive it yourself</p>
      <p className="mt-2.5 font-display text-xl leading-snug font-bold text-white md:text-2xl">
        The {car.name}, from {site.location.city} or delivered to you
      </p>
      <p className="mt-2 text-sm leading-relaxed text-white/85">
        Check your dates in a minute. Free delivery within {site.booking.delivery.freeRadiusMiles} miles of {site.location.city}.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <BookButton size="md">
          Book Now
          <ArrowRightIcon className="text-base" />
        </BookButton>
        <Link
          href="/contact"
          className={`${buttonClasses({ variant: "outline", size: "md" })} border-white/30 bg-transparent text-white hover:border-white hover:bg-white/10`}
        >
          Ask a question
        </Link>
      </div>
    </aside>
  );
}
