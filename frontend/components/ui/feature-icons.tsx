import type { SVGProps } from "react";
import type { RequirementIcon, StepIcon } from "@/config/content";

type IconProps = SVGProps<SVGSVGElement>;

// Larger line icons for How It Works and Requirements. 32px grid, 1.6 stroke.
function Glyph({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
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
      {children}
    </svg>
  );
}

const dot = { fill: "currentColor", stroke: "none" } as const;

const stepGlyphs: Record<StepIcon, React.ReactNode> = {
  calendar: (
    <>
      <rect x="4" y="6.500" width="24" height="21.500" rx="3" />
      <path d="M4 12.500h24M10.500 3.500v6M21.500 3.500v6" />
      {[17.500, 22.500].map((y) =>
        [10.500, 16, 21.500].map((x) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.100" {...dot} />
        )),
      )}
    </>
  ),
  message: (
    <>
      <path d="M7 5.500h18a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3h-3.500l-2.800 4.200a.800.800 0 0 1-1.400 0l-2.800-4.200H11l-4.500 4v-4.200A3 3 0 0 1 4 19.500v-11a3 3 0 0 1 3-3Z" />
      {[10.500, 16, 21.500].map((x) => (
        <circle key={x} cx={x} cy="14" r="1.200" {...dot} />
      ))}
    </>
  ),
  documents: (
    <>
      <path d="M17 27.500H7a3 3 0 0 1-3-3v-17a3 3 0 0 1 3-3h11.500L24 10v5" />
      <path d="M18 4.500V8a2 2 0 0 0 2 2h4" />
      <circle cx="11.500" cy="13.500" r="2.600" />
      <path d="M7 22.500c.500-2.400 2.200-3.800 4.500-3.800s4 1.400 4.500 3.800" />
      <path d="M24 17.500l4.500 1.700v3.600c0 2.600-1.800 4.600-4.500 5.700-2.700-1.100-4.500-3.100-4.500-5.700v-3.600L24 17.500Z" />
      <path d="m22.200 22.800 1.300 1.300 2.400-2.600" />
    </>
  ),
  deposit: (
    <>
      <path d="M18 25.500H7a3 3 0 0 1-3-3v-14a3 3 0 0 1 3-3h18a3 3 0 0 1 3 3V16" />
      <path d="M4 11.500h24M8.500 20h4" />
      <circle cx="24.500" cy="23.500" r="5" />
      <path d="M24.500 21.300v4.400M22.300 23.500h4.400" />
    </>
  ),
};

const requirementGlyphs: Record<Exclude<RequirementIcon, "age">, React.ReactNode> = {
  license: (
    <>
      <rect x="3.500" y="6.500" width="25" height="19" rx="3" />
      <circle cx="11.500" cy="13.800" r="2.400" />
      <path d="M7.500 21c.500-2 1.900-3.100 4-3.100s3.500 1.100 4 3.100M19.500 13h5M19.500 17.500h5" />
    </>
  ),
  insurance: (
    <>
      <path d="M16 3.500 26.500 7.300v7.900c0 5.800-4.200 10.300-10.500 12.800C9.700 25.500 5.500 21 5.500 15.200V7.300L16 3.500Z" />
      <path d="m11.500 15.800 3.200 3.200 5.800-6.300" />
    </>
  ),
  card: (
    <>
      <rect x="3.500" y="6.500" width="25" height="19" rx="3" />
      <path d="M3.500 12.500h25M8 20h6" />
    </>
  ),
};

export function StepGlyph({ name, ...props }: IconProps & { name: StepIcon }) {
  return <Glyph {...props}>{stepGlyphs[name]}</Glyph>;
}

export function RequirementGlyph({
  name,
  ...props
}: IconProps & { name: Exclude<RequirementIcon, "age"> }) {
  return <Glyph {...props}>{requirementGlyphs[name]}</Glyph>;
}
