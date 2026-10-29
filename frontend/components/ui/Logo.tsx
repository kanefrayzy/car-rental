import { site } from "@/config/site";
import { logoPaths, logoViewBox } from "./logoPaths";

type LogoProps = {
  className?: string;
};

// The approved logo, inline so it needs no request and never flashes in. The paths come
// from scripts/brand.mjs. Its height follows --logo-size (globals.css), the width follows.
export function Logo({ className = "" }: LogoProps) {
  return (
    <svg
      viewBox={logoViewBox}
      role="img"
      aria-label={site.name}
      className={`block h-[calc(var(--logo-size)*1.6)] w-auto ${className}`}
    >
      {logoPaths.map((path, i) => (
        <path
          key={i}
          d={path.d}
          fillRule="evenodd"
          className={path.accent ? "fill-brand-deep" : "fill-navy"}
        />
      ))}
    </svg>
  );
}
