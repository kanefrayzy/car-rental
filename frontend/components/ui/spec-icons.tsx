import type { SVGProps } from "react";
import type { SpecIcon } from "@/config/cars";

const glyphs: Record<SpecIcon, React.ReactNode> = {
  // Horse head, as in the mockup
  horsepower: (
    <>
      <path d="M8 20.500c.300-3.200 1.600-5 4-6.300-1.700.600-3.200 1.300-4.700 2.300L4.500 13.800l4.300-6.300c1.200-1.800 3-2.900 5.200-3.200l.500-1.800 2 2.300c2 1.600 3 4 3 6.700v9Z" />
      <path d="M12.200 8.300h.010" strokeWidth={2.200} />
    </>
  ),
  acceleration: (
    <>
      <path d="M5.300 18.500a9 9 0 1 1 13.400 0" />
      <path d="m12 13 3.500-4.500" />
      <circle cx="12" cy="13" r="1.300" fill="currentColor" stroke="none" />
      <path d="M12 6.500v1M6.500 12h1M16.500 12h1" />
    </>
  ),
  topSpeed: (
    <>
      <circle cx="12" cy="12" r="8.500" />
      <path d="m12 12 4-3.500" />
      <circle cx="12" cy="12" r="1.300" fill="currentColor" stroke="none" />
      <path d="M8.500 16.500h7" />
    </>
  ),
  seats: (
    <>
      <path d="M8.500 3.500h2.500a1.500 1.500 0 0 1 1.500 1.500v2a1.500 1.500 0 0 1-1.500 1.500H9.500" />
      <path d="M7.500 3.500 9.500 14.500h6a2.500 2.500 0 0 1 2.500 2.500v.500H9a2.500 2.500 0 0 1-2.500-2L5 5.500a1.700 1.700 0 0 1 1.700-2Z" />
      <path d="M9.500 17.500v3M16 17.500v3M7.500 20.500h10.500" />
    </>
  ),
};

export function SpecGlyph({ name, ...props }: SVGProps<SVGSVGElement> & { name: SpecIcon }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {glyphs[name]}
    </svg>
  );
}

/** Sedan outline for the "more cars coming soon" card and empty gallery slots. */
export function CarOutlineIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 48 24"
      width="2em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M9 17.500H5.500A2.500 2.500 0 0 1 3 15v-2.500c0-1.500 1-2.700 2.500-3l6-1.200 4.200-4c.900-.900 2.100-1.300 3.300-1.300h9.500c1.300 0 2.500.500 3.400 1.400l3.600 3.600 6.300 1.200c1.900.400 3.200 2 3.200 3.900V15a2.500 2.500 0 0 1-2.500 2.500H39M15 17.500h18" />
      <circle cx="12" cy="17.500" r="3" />
      <circle cx="36" cy="17.500" r="3" />
      <path d="M13.500 8.500h20" />
    </svg>
  );
}
