import { ArtImage } from "@/components/ui/ArtImage";

// The hero photograph, static for now: one generated scene (car included), cropped
// differently for mobile and desktop by scripts/images.mjs. It fills the fixed-height
// hero behind the copy, so it cannot shift layout.
export function HeroScene({ alt }: { alt: string }) {
  return (
    <div className="absolute inset-0 -z-10 bg-sky-pale">
      <ArtImage
        alt={alt}
        priority
        mobile={{
          src: "/images/hero-scene-mobile.webp",
          width: 780,
          height: 1119,
          // The hero sits 6px in from each edge below xl (Hero.tsx, mx-1.5).
          sizes: "calc(100vw - 0.75rem)",
        }}
        tablet={{
          src: "/images/hero-scene-tablet.webp",
          width: 1600,
          height: 1221,
          sizes: "calc(100vw - 0.75rem)",
        }}
        desktop={{
          src: "/images/hero-scene-desktop.webp",
          width: 2880,
          height: 830,
          sizes: "100vw",
        }}
        className="size-full object-cover object-bottom md:object-right-bottom xl:object-[100%_85%]"
      />
      {/* Fades the photo to the page colour behind the copy: from the top on mobile, from
          the top-left corner on tablets, from the left on desktop. */}
      <div className="absolute inset-0 bg-linear-to-b from-page/90 via-page/60 via-35% to-transparent to-60% md:bg-linear-to-br md:from-page md:via-page/75 md:via-36% md:to-58% xl:bg-linear-to-r xl:from-page xl:via-page/85 xl:via-34% xl:to-transparent xl:to-56%" />
    </div>
  );
}
