"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { BookButton } from "@/components/booking/BookButton";
import { MyBookingLink } from "@/components/booking/MyBookingLink";
import { buttonClasses } from "@/components/ui/Button";
import { ArrowRightIcon, PhoneIcon } from "@/components/ui/icons";
import { services } from "@/config/services";
import { nav, site } from "@/config/site";

// Not in the mockups: a full-height panel under the header, styled from the same tokens.
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    // Close if the viewport grows into the desktop layout while the menu is open.
    const desktop = window.matchMedia("(width >= 80rem)");
    const onDesktop = () => desktop.matches && setOpen(false);

    document.documentElement.style.overflow = "hidden";
    // Hides the bottom bar on phones (globals.css) while the menu covers the page.
    document.documentElement.dataset.menuOpen = "";
    window.addEventListener("keydown", onKey);
    desktop.addEventListener("change", onDesktop);
    return () => {
      document.documentElement.style.overflow = "";
      delete document.documentElement.dataset.menuOpen;
      window.removeEventListener("keydown", onKey);
      desktop.removeEventListener("change", onDesktop);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="xl:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
        className="flex size-11 items-center justify-center rounded-[0.875rem] bg-ink text-white shadow-[0_8px_16px_-8px_rgb(10_23_48/0.7)] transition-[background-color,scale] duration-200 hover:bg-brand-deep active:scale-90"
      >
        {/* Three bars (the last one shorter) that fold into a cross when the menu is open. */}
        <span aria-hidden="true" className="relative block h-3.5 w-5">
          <span
            className={`absolute h-0.5 rounded-full bg-current ease-out-soft motion-reduce:transition-none top-0 left-0 w-5 transition-[translate,rotate] duration-300 ${open ? "translate-y-1.5 rotate-45" : ""}`}
          />
          <span
            className={`absolute h-0.5 rounded-full bg-current ease-out-soft motion-reduce:transition-none top-1.5 left-0 w-5 transition-opacity duration-200 ${open ? "opacity-0" : ""}`}
          />
          <span
            className={`absolute h-0.5 rounded-full bg-current ease-out-soft motion-reduce:transition-none top-3 right-0 transition-[translate,rotate,width] duration-300 ${open ? "w-5 -translate-y-1.5 -rotate-45" : "w-3"}`}
          />
        </span>
      </button>

      <div
        id={panelId}
        inert={!open}
        className={`fixed inset-x-0 top-(--header-h) bottom-0 z-40 overflow-y-auto bg-page transition-[opacity,translate,visibility] duration-200 ease-out-soft motion-reduce:transition-none ${
          open
            ? "visible translate-y-0 opacity-100"
            : "invisible -translate-y-2 opacity-0"
        }`}
      >
        <div className="container-site flex min-h-full flex-col pt-4 pb-8">
          <nav aria-label="Mobile">
            <ul>
              {nav.map((item) => (
                <li key={item.href} className="border-b border-line">
                  <a
                    href={item.href}
                    onClick={close}
                    className="flex items-center justify-between py-5 font-display text-2xl font-semibold text-ink"
                  >
                    {item.label}
                    <ArrowRightIcon className="text-xl text-brand-deep" />
                  </a>
                  {/* The service pages, two columns under "Services". */}
                  {item.href === "/services" && (
                    <ul className="-mt-1 grid grid-cols-2 gap-x-4 gap-y-1 pb-4">
                      {services.map((service) => (
                        <li key={service.slug}>
                          <a
                            href={`/services/${service.slug}`}
                            onClick={close}
                            className="block py-1.5 text-[0.9375rem] font-medium text-ink-soft hover:text-brand-deep"
                          >
                            {service.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-auto flex flex-col gap-4 pt-8">
            <a
              href={site.phone.href}
              className="flex items-center justify-center gap-3 text-base font-medium text-ink-soft"
            >
              <PhoneIcon className="text-lg text-brand-deep" />
              {site.phone.display}
            </a>
            <MyBookingLink variant="menu" onOpen={close} />
            <Link
              href="/contact"
              onClick={close}
              className={buttonClasses({ variant: "outline", size: "lg", block: true })}
            >
              Instant Quote
            </Link>
            <BookButton size="lg" block onOpen={close}>
              Book Now
              <ArrowRightIcon className="text-lg" />
            </BookButton>
          </div>
        </div>
      </div>
    </div>
  );
}
