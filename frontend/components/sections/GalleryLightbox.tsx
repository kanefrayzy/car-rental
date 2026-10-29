"use client";

import Image from "next/image";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "@/components/ui/icons";
import type { CarImage } from "@/config/cars";
import { useSwipe } from "@/lib/useSwipe";

type GalleryLightboxProps = {
  images: CarImage[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

// Full-screen photo viewer. Mounted only while open; shares the current photo with the
// gallery, so closing it leaves the gallery on the photo that was being viewed.
// Arrow keys, swipe and the on-screen arrows change the photo; Escape, the close button
// or a click on the empty area close it.
export default function GalleryLightbox({
  images,
  index,
  onIndexChange,
  onClose,
}: GalleryLightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const count = images.length;
  const current = images[index];

  const step = (delta: number) => onIndexChange((index + delta + count) % count);
  const swipe = useSwipe(
    () => step(-1),
    () => step(1),
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft") step(-1);
    if (event.key === "ArrowRight") step(1);
  };

  const control =
    "flex size-11 items-center justify-center rounded-full bg-white/10 text-xl text-white transition-[background-color,scale] duration-200 hover:bg-white/20 active:scale-90";

  return (
    <dialog
      ref={dialogRef}
      aria-label="Photo viewer"
      onClose={onClose}
      onKeyDown={onKeyDown}
      className="m-0 h-dvh max-h-none w-full max-w-none flex-col bg-navy/97 text-white backdrop:bg-navy open:flex"
    >
      <div className="flex items-center justify-between px-4 pt-4 sm:px-6">
        <p className="text-sm font-medium tabular-nums text-white/80">
          {index + 1} / {count}
        </p>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Close photo viewer"
          className={control}
        >
          <CloseIcon />
        </button>
      </div>

      <div
        {...swipe.handlers}
        onClick={(event) => {
          // A click beside the photo closes the viewer; a click that ended a swipe does not.
          if (event.target === event.currentTarget && !swipe.swiped()) dialogRef.current?.close();
        }}
        className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center px-3 py-4 sm:px-20"
      >
        <div className="pointer-events-none relative size-full max-w-[90rem]">
          <Image
            key={current.src}
            src={current.zoom ?? current.src}
            alt={current.alt}
            fill
            sizes="100vw"
            draggable={false}
            className="animate-fade-in object-contain motion-reduce:animate-none"
          />
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous photo"
              className={`${control} absolute top-1/2 left-3 -translate-y-1/2 max-sm:bg-navy/60 sm:left-5`}
            >
              <ChevronLeftIcon />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next photo"
              className={`${control} absolute top-1/2 right-3 -translate-y-1/2 max-sm:bg-navy/60 sm:right-5`}
            >
              <ChevronRightIcon />
            </button>
          </>
        )}
      </div>

      <p aria-live="polite" className="px-6 text-center text-sm text-white/80">
        {current.alt}
      </p>

      {count > 1 && (
        <ul className="flex justify-center gap-2 px-4 pt-3 pb-5">
          {images.map((image, position) => (
            <li key={image.src}>
              <button
                type="button"
                onClick={() => onIndexChange(position)}
                aria-label={`Show photo ${position + 1}: ${image.alt}`}
                aria-current={position === index ? "true" : undefined}
                className={`relative block h-11 w-16 overflow-hidden rounded-md transition-opacity duration-200 sm:h-14 sm:w-20 ${
                  position === index ? "ring-2 ring-white" : "opacity-50 hover:opacity-100"
                }`}
              >
                <Image src={image.src} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </dialog>
  );
}
