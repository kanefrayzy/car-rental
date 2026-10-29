"use client";

import dynamic from "next/dynamic";
import { FillPicture } from "@/components/ui/ArtImage";
import { useState, type KeyboardEvent } from "react";
import { ChevronLeftIcon, ChevronRightIcon, ExpandIcon } from "@/components/ui/icons";
import { CarOutlineIcon } from "@/components/ui/spec-icons";
import type { CarImage } from "@/config/cars";
import { useSwipe } from "@/lib/useSwipe";

// Loaded the first time a photo is enlarged.
const GalleryLightbox = dynamic(() => import("./GalleryLightbox"), { ssr: false });

/** Thumbnails shown under the main photo. Further photos are reached with the arrows. */
const MAX_THUMBS = 5;

type CarGalleryProps = {
  images: CarImage[];
  carName: string;
};

// A slider: one main photo, with arrows, swipe and the arrow keys to move through the set,
// thumbnails that stay in place and mark the current photo, and a full-screen view on click.
export function CarGallery({ images, carName }: CarGalleryProps) {
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const count = images.length;
  const current = images[index];

  const step = (delta: number) => setIndex((value) => (value + delta + count) % count);
  const swipe = useSwipe(
    () => step(-1),
    () => step(1),
  );

  const onKeyDown = (event: KeyboardEvent) => {
    if (count < 2) return;
    if (event.key === "ArrowLeft") step(-1);
    if (event.key === "ArrowRight") step(1);
  };

  if (!current) {
    return (
      <div className="rounded-card border border-line bg-card p-2 shadow-card xl:p-3.5">
        <div className="flex aspect-[16/10] flex-col items-center justify-center gap-2 rounded-lg bg-surface text-muted xl:rounded-md">
          <CarOutlineIcon className="text-4xl" />
          <p className="text-xs">{carName} photos coming soon</p>
        </div>
      </div>
    );
  }

  const arrow =
    "absolute top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 text-lg text-ink shadow-card transition-[background-color,scale,opacity] duration-200 hover:scale-110 hover:bg-card hover:text-brand-deep active:scale-90 xl:size-9";

  return (
    <div className="rounded-card border border-line bg-card p-2 shadow-card xl:p-3.5">
      <div
        role="group"
        aria-roledescription="carousel"
        aria-label={`${carName} photos`}
        onKeyDown={onKeyDown}
        {...swipe.handlers}
        className="relative aspect-[16/10] touch-pan-y overflow-hidden rounded-lg bg-surface xl:rounded-md"
      >
        <button
          type="button"
          onClick={() => {
            if (!swipe.swiped()) setZoomed(true);
          }}
          aria-label={`View larger: ${current.alt}`}
          className="group absolute inset-0 cursor-zoom-in"
        >
          <FillPicture
            key={current.src}
            src={current.src}
            alt={current.alt}
            sizes="(width >= 80rem) 676px, (width >= 48rem) 50vw, calc(100vw - 3.5rem)"
            draggable={false}
            className="animate-fade-in object-cover object-[50%_58%] motion-reduce:animate-none"
          />
          <span className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-card/90 text-sm text-ink shadow-card transition-[background-color,scale] duration-200 group-hover:scale-110 group-hover:bg-card">
            <ExpandIcon />
          </span>
        </button>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous photo"
              className={`${arrow} left-2`}
            >
              <ChevronLeftIcon />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next photo"
              className={`${arrow} right-2`}
            >
              <ChevronRightIcon />
            </button>
            <p
              aria-hidden="true"
              className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-ink/65 px-2.5 py-1 text-[0.6875rem] leading-none font-medium text-white"
            >
              {index + 1} / {count}
            </p>
          </>
        )}
        <p aria-live="polite" className="sr-only">
          Photo {index + 1} of {count}: {current.alt}
        </p>
      </div>

      {count > 1 && (
        <ul
          className="mt-2 grid gap-2 xl:mt-3 xl:gap-3"
          style={{ gridTemplateColumns: `repeat(${Math.min(count, MAX_THUMBS)}, minmax(0, 1fr))` }}
        >
          {images.slice(0, MAX_THUMBS).map((image, position) => {
            const active = position === index;
            return (
              <li key={image.src} className="aspect-[3/2]">
                <button
                  type="button"
                  onClick={() => setIndex(position)}
                  aria-label={`Show photo ${position + 1}: ${image.alt}`}
                  aria-current={active ? "true" : undefined}
                  className={`group relative block size-full overflow-hidden rounded-md outline-offset-2 transition-[opacity,box-shadow] duration-200 ${
                    active
                      ? "ring-2 ring-brand-deep ring-offset-2 ring-offset-card"
                      : "opacity-70 hover:opacity-100"
                  }`}
                >
                  <FillPicture
                    src={image.src}
                    alt=""
                    sizes="(width >= 48rem) 140px, 20vw"
                    className="object-cover object-[50%_62%] transition-transform duration-300 ease-out-soft group-hover:scale-[1.06] motion-reduce:transition-none"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {zoomed && (
        <GalleryLightbox
          images={images}
          index={index}
          onIndexChange={setIndex}
          onClose={() => setZoomed(false)}
        />
      )}
    </div>
  );
}
