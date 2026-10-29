import Image from "next/image";
import Link from "next/link";
import { BookButton } from "@/components/booking/BookButton";
import { ArrowRightIcon } from "@/components/ui/icons";
import { occasions, type Occasion } from "@/config/content";
import { serviceFor } from "@/config/services";

/**
 * The occasion's icon (Recraft V4 Vector, approved 2026-10-19; prepared by scripts/images.mjs)
 * on a light tile with a soft blue glow. The icons are navy and blue, so the tile stays light
 * on the navy tiles too.
 */
export function OccasionIcon({ occasion, size = "md" }: { occasion: Occasion; size?: "sm" | "md" | "lg" }) {
  const box = { sm: "size-12 rounded-xl", md: "size-16 rounded-2xl", lg: "size-[4.5rem] rounded-[1.25rem]" }[size];
  const px = { sm: 32, md: 42, lg: 48 }[size];
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center bg-linear-to-br from-white to-tint shadow-[0_10px_24px_-10px_rgb(5_102_251/0.55),inset_0_1px_0_white] ring-1 ring-brand-deep/10 transition-transform duration-300 ease-out-soft group-hover:scale-105 group-hover:-rotate-3 motion-reduce:transition-none motion-reduce:group-hover:transform-none ${box}`}
    >
      {/* Decorative: the title next to it names the occasion. */}
      <Image src={`/images/occasions/icons/${occasion}.svg`} alt="" width={px} height={px} unoptimized />
    </span>
  );
}

type Item = (typeof occasions)[number];

const service = (item: Item) => serviceFor(item.slug);

/** The title is the card's link to the service page; it stretches over the whole card. */
function CardTitle({ item, className, as: Heading }: { item: Item; className: string; as: "h2" | "h3" }) {
  return (
    <Heading className={className}>
      <Link href={`/services/${service(item).slug}`} className="after:absolute after:inset-0 after:z-[1] after:rounded-[inherit]">
        {item.title}
      </Link>
    </Heading>
  );
}

/** "Wedding car rental →" (the visible cue for the stretched link) and a small Book button above it. */
function CardFooter({ item, tone }: { item: Item; tone: "light" | "dark" }) {
  return (
    <div className="mt-auto flex items-center justify-between gap-3 pt-5">
      <span
        aria-hidden="true"
        className={`inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap transition-[gap] duration-200 group-hover:gap-2.5 ${tone === "dark" ? "text-white" : "text-brand-deep"}`}
      >
        {service(item).name.charAt(0) + service(item).name.slice(1).toLowerCase()} car rental
        <ArrowRightIcon />
      </span>
      <BookButton
        occasion={item.slug}
        variant={tone === "dark" ? "primary" : "outline"}
        size="sm"
        className="relative z-[2] h-9! px-4! text-[0.8125rem]!"
      >
        Book
      </BookButton>
    </div>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone: "light" | "dark" }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[0.6875rem] whitespace-nowrap font-semibold tracking-[0.02em] ${
        // brand-press, not brand-deep: 11px text on tint needs it for 4.5:1 (brand-deep is 4.3).
        tone === "dark" ? "bg-navy/80 text-white ring-1 ring-white/20" : "bg-tint text-brand-press"
      }`}
    >
      {children}
    </span>
  );
}

// Faint dots behind the stage, fading out from its centre.
const dots = {
  backgroundImage: "radial-gradient(rgb(255 255 255 / 0.09) 1px, transparent 1.4px)",
  backgroundSize: "16px 16px",
  maskImage: "radial-gradient(circle at center, black 10%, transparent 65%)",
};

// The rings around the icon: size in rem, line strength, and where a glowing dot sits on it.
const rings = [
  { size: 13, line: "border-white/[0.12]", dot: -40 },
  { size: 20, line: "border-white/[0.08]", dot: 150 },
  { size: 27, line: "border-white/[0.05]", dot: null },
  { size: 34, line: "border-white/[0.03]", dot: 70 },
];

/**
 * The large icon as the picture of a navy tile (user, 2026-10-19: icons only, no photos or
 * drawings): a tilted white tile with a blue glow, rings spreading out like ripples, and a few
 * glowing dots on them. On hover the tile straightens and lifts and the rings turn a little.
 */
function IconStage({ occasion, className }: { occasion: Occasion; className: string }) {
  const motion = "transition-transform duration-[1200ms] ease-out-soft motion-reduce:transition-none";
  return (
    <div aria-hidden="true" className={`pointer-events-none flex items-center justify-center ${className}`}>
      <span className="absolute size-[30rem]" style={dots} />
      {rings.map((ring, index) => (
        <span
          key={ring.size}
          className={`absolute rounded-full border ${ring.line} ${motion} ${index % 2 ? "group-hover:-rotate-12" : "group-hover:rotate-[18deg]"} group-hover:scale-[1.04]`}
          style={{ width: `${ring.size}rem`, height: `${ring.size}rem` }}
        >
          {ring.dot !== null && (
            <span
              className="absolute top-1/2 left-1/2 size-1.5 rounded-full bg-sky shadow-[0_0_10px_2px_rgb(10_122_255/0.8)]"
              style={{ transform: `rotate(${ring.dot}deg) translateX(${ring.size / 2}rem) translate(-50%, -50%)` }}
            />
          )}
        </span>
      ))}
      <span className="absolute size-44 rounded-full bg-brand/45 blur-3xl" />
      <span className="relative flex size-28 -rotate-6 items-center justify-center rounded-[1.75rem] bg-linear-to-br from-white to-tint shadow-[0_28px_56px_-18px_rgb(10_122_255/0.75),inset_0_1px_0_white] ring-1 ring-white/50 transition-transform duration-500 ease-out-soft group-hover:-translate-y-1.5 group-hover:rotate-0 motion-reduce:transition-none motion-reduce:group-hover:transform-none xl:size-32 xl:rounded-[2rem]">
        <Image src={`/images/occasions/icons/${occasion}.svg`} alt="" width={84} height={84} unoptimized className="size-[4.5rem] xl:size-[5.25rem]" />
      </span>
    </div>
  );
}

/**
 * A large navy tile with the occasion's icon as its picture: above the copy on phones, on the
 * right from md up. A light streak passes on hover.
 */
function FeatureTile({ item, heading }: { item: Item; heading: "h2" | "h3" }) {
  return (
    <article className="group relative isolate flex h-full flex-col overflow-hidden rounded-card bg-navy text-white shadow-[0_24px_48px_-28px_rgb(10_23_48/0.6)] transition-[translate,box-shadow] duration-300 ease-out-soft hover:-translate-y-1 hover:shadow-[0_30px_60px_-28px_rgb(10_23_48/0.75)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 md:min-h-[18rem] xl:min-h-[19.5rem]">
      <span aria-hidden="true" className="absolute -top-28 -left-24 -z-10 size-72 rounded-full bg-navy-soft blur-3xl" />
      {/* Phones: the icon on top. */}
      <IconStage occasion={item.slug} className="relative -z-10 h-52 md:hidden" />
      {/* From md up: the right part of the tile. */}
      <IconStage occasion={item.slug} className="absolute inset-y-0 right-0 -z-10 hidden w-[48%] md:flex" />
      {/* The light streak. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-1/3 -translate-x-full skew-x-[-20deg] bg-linear-to-r from-transparent via-white/10 to-transparent transition-transform duration-[900ms] ease-out-soft group-hover:translate-x-[400%] motion-reduce:hidden"
      />

      <div className="flex flex-1 flex-col p-6 pt-0 md:max-w-[56%] md:justify-center md:pt-6 xl:p-8">
        <div>
          <Chip tone="dark">{service(item).badges[0]}</Chip>
        </div>
        <CardTitle item={item} as={heading} className="mt-4 text-2xl font-bold tracking-[-0.02em] text-white xl:text-[2rem]" />
        <p className="mt-1.5 max-w-[22rem] text-[0.9375rem] leading-relaxed text-white/80">{item.text}</p>
        <CardFooter item={item} tone="dark" />
      </div>
    </article>
  );
}

/** A light card: the icon, a fact chip, faint rings, a brand-coloured edge and glow on hover. */
function Card({ item, heading }: { item: Item; heading: "h2" | "h3" }) {
  return (
    <article className="group relative isolate flex h-full flex-col overflow-hidden rounded-card border border-line bg-card p-5 shadow-card transition-[translate,box-shadow,border-color] duration-300 ease-out-soft hover:-translate-y-1 hover:border-brand-deep/30 hover:shadow-[0_18px_40px_-20px_rgb(10_23_48/0.28)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 xl:p-6">
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-brand-deep via-brand to-sky opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-16 -z-10 size-40 rounded-full bg-brand/10 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
      />
      {/* The rings of the large tiles, faintly, behind the icon. */}
      <span aria-hidden="true" className="pointer-events-none absolute top-[-2.5rem] left-[-2.5rem] -z-10 size-[11.5rem] rounded-full border border-brand-deep/[0.07] transition-transform duration-700 ease-out-soft group-hover:scale-110 motion-reduce:transition-none" />
      <span aria-hidden="true" className="pointer-events-none absolute top-[-5.5rem] left-[-5.5rem] -z-10 size-[17.5rem] rounded-full border border-brand-deep/[0.05] transition-transform duration-700 ease-out-soft group-hover:scale-105 motion-reduce:transition-none" />
      <div className="flex items-start justify-between gap-3">
        <OccasionIcon occasion={item.slug} />
        <Chip tone="light">{service(item).badges[0]}</Chip>
      </div>
      <CardTitle item={item} as={heading} className="mt-5 text-lg font-bold tracking-[-0.01em]" />
      <p className="mt-1 text-sm leading-relaxed text-muted">{item.text}</p>
      <CardFooter item={item} tone="light" />
    </article>
  );
}

// Weddings and photoshoots lead as large navy tiles, the other four follow as cards.
const featured: Occasion[] = ["wedding", "photoshoot"];
const ordered = [
  ...featured.map((slug) => occasions.find((item) => item.slug === slug)!),
  ...occasions.filter((item) => !featured.includes(item.slug)),
];

/**
 * The occasion (service) cards, chosen by the user on 2026-10-19 (bento): two large navy tiles
 * with photos, then four cards with the generated icons. Each card links to its service page and
 * has a Book button that opens the booking page with the occasion chosen. The home page lets
 * phones swipe through them; /services stacks them.
 */
export function OccasionShowcase({ layout = "swipe", heading = "h3" }: { layout?: "swipe" | "grid"; heading?: "h2" | "h3" }) {
  const swipe = layout === "swipe";
  return (
    <ul
      className={`gap-4 md:grid md:grid-cols-2 xl:grid-cols-4 xl:gap-5 ${
        swipe
          ? "-mx-(--gutter) flex snap-x snap-mandatory scroll-px-(--gutter) overflow-x-auto px-(--gutter) pt-1 pb-3 [scrollbar-width:none] md:mx-0 md:overflow-visible md:px-0 md:pb-0"
          : "grid"
      }`}
    >
      {ordered.map((item) => {
        const big = featured.includes(item.slug);
        return (
          <li
            key={item.slug}
            className={`${swipe ? "w-[82%] max-w-[21rem] shrink-0 snap-start md:w-auto md:max-w-none" : ""} ${big ? "md:col-span-2" : ""}`}
          >
            {big ? <FeatureTile item={item} heading={heading} /> : <Card item={item} heading={heading} />}
          </li>
        );
      })}
    </ul>
  );
}
