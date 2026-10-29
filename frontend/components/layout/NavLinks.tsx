"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { services } from "@/config/services";
import { nav } from "@/config/site";

// Sections in page order. "location" has no link of its own; listing it keeps the
// Requirements link from staying highlighted while the map is on screen.
const SECTION_IDS = ["the-car", "occasions", "how-it-works", "requirements", "location", "faq", "contact"];

/**
 * The id of the section the visitor is reading, or "" above the first one. Only on the home
 * page: other pages (the booking page) reuse some sections, but the links lead home.
 */
function useActiveSection() {
  const pathname = usePathname();
  const onHome = pathname === "/";
  const [active, setActive] = useState("");

  useEffect(() => {
    if (!onHome) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.4;
      const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 2;
      let current = "";
      for (const id of SECTION_IDS) {
        const section = document.getElementById(id);
        if (section && section.getBoundingClientRect().top <= line) current = id;
      }
      setActive(atBottom ? SECTION_IDS[SECTION_IDS.length - 1] : current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [onHome]);

  // Pages of their own (/contact) light up their link.
  return onHome ? `/#${active}` : pathname;
}

// Desktop navigation. The link of the section on screen is highlighted. "Services" opens a
// list of the service pages on hover or keyboard focus (CSS only).
export function NavLinks() {
  const active = useActiveSection();

  return (
    // Seven links since the blog (2026-10-21): from 1440px the gap is 24px (was 32), or the
    // header overflowed with "My booking" shown.
    <ul className="flex gap-5 whitespace-nowrap min-[90rem]:gap-6">
      {nav.map((item) => {
        const current =
          item.href === active ||
          (item.href === "/services" && active.startsWith("/services/")) ||
          (item.href === "/blog" && active.startsWith("/blog/"));
        return (
          <li key={item.href} className={item.href === "/services" ? "group relative" : undefined}>
            <a
              href={item.href}
              aria-current={current ? "location" : undefined}
              className={`relative py-2 text-[0.8125rem] font-medium transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-left after:rounded-full after:bg-brand-deep after:transition-transform after:duration-300 hover:text-brand-deep motion-reduce:after:transition-none ${
                current ? "text-brand-deep after:scale-x-100" : "text-ink-soft after:scale-x-0"
              }`}
            >
              {item.label}
            </a>
            {item.href === "/services" && (
              <div className="invisible absolute top-full left-1/2 z-50 -translate-x-1/2 pt-4 opacity-0 transition-[opacity,visibility] duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 motion-reduce:transition-none">
                <ul className="w-48 rounded-card border border-line bg-card p-2 shadow-card">
                  {services.map((service) => (
                    <li key={service.slug}>
                      <a
                        href={`/services/${service.slug}`}
                        aria-current={active === `/services/${service.slug}` ? "page" : undefined}
                        className="block rounded-btn px-3 py-2 text-[0.8125rem] font-medium text-ink-soft transition-colors hover:bg-tint hover:text-brand-deep aria-[current=page]:text-brand-deep"
                      >
                        {service.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
