// Stylised map of the Great South Bay shoreline around Patchogue. Decorative only:
// it is drawn by hand, not from map data, and is hidden from assistive tech.
// The 900x300 artboard is cropped with "slice", so keep anything important near the centre.
// Pin and labels are HTML overlays in the Location section, not part of this drawing.

/** Deterministic wobble in [-1, 1] so the street grid looks surveyed, not ruled. */
const wobble = (n: number) => Math.round(Math.sin(n * 12.9898) * 43758.5453 * 10) / 10 % 1;

const r = (n: number) => Math.round(n * 10) / 10;

// Side streets run inland from the shore, each with a slight bend half way up.
const streets = Array.from({ length: 30 }, (_, i) => {
  const x = -60 + i * 34 + wobble(i) * 9;
  const bend = wobble(i + 40) * 7;
  return `M${r(x)}-10 ${r(x + 32 + bend)} 150 ${r(x + 66 + wobble(i + 80) * 6)} 310`;
});

// Avenues run parallel to the shore.
const avenues = Array.from({ length: 12 }, (_, i) => {
  const y = 12 + i * 27 + wobble(i + 120) * 6;
  return `M-20 ${r(y)} 440 ${r(y - 118 + wobble(i + 160) * 5)} 920 ${r(y - 240)}`;
});

const arterials = [
  "M-20 150C200 96 420 52 920-70",
  "M-20 262C180 214 300 196 470 150S760 70 920 22",
  "M250-10C300 80 372 150 470 150",
];

// Creeks and canals cutting inland from the bay: [path, width].
// Each starts just inside the bay so it joins the shoreline.
const inlets: [string, number][] = [
  ["M92 282c-6-12 4-20-2-34", 6],
  ["M176 268c-8-14 6-24-4-46", 8],
  ["M262 252c-4-12 8-22 2-38", 5],
  ["M336 238c-10-14 4-26-6-50", 9],
  ["M414 218c-4-12 6-20 0-32", 5],
  ["M508 196c-8-16 6-28-4-54", 10],
  ["M590 172c-4-12 6-20 2-34", 5],
  ["M672 144c-8-14 4-26-4-46", 8],
  ["M760 114c-4-10 6-18 0-32", 5],
  ["M834 90c-6-12 4-20-2-36", 6],
];

// Thin upstream continuations of the wider inlets.
const creeks = [
  "M172 222c-10-20 4-38-8-60s2-40-10-62",
  "M330 188c-8-18 6-34-6-54s0-36-10-56",
  "M504 142c-10-20 4-36-8-58s2-38-8-58",
  "M668 98c-8-16 4-30-6-48s2-30-6-46",
];

export function MapSvg({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 900 300"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect width="900" height="300" className="fill-surface" />

      <g fill="none" strokeLinejoin="round" className="stroke-white">
        {streets.map((d) => (
          <path key={d} d={d} strokeWidth="1" />
        ))}
        {avenues.map((d) => (
          <path key={d} d={d} strokeWidth="1" />
        ))}
        {arterials.map((d) => (
          <path key={d} d={d} strokeWidth="2.800" />
        ))}
      </g>

      <g fill="none" strokeLinecap="round" strokeWidth="1.400" className="stroke-water/80">
        {creeks.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>

      {/* Great South Bay, then the creeks and canals that open into it */}
      <path
        className="fill-water"
        d="M0 300v-10c120-15 200-28 300-50s180-44 260-64 200-58 340-116v240Z"
      />
      <g fill="none" strokeLinecap="round" className="stroke-water">
        {inlets.map(([d, width]) => (
          <path key={d} d={d} strokeWidth={width} />
        ))}
      </g>

      {/* Marsh islands just off the shore */}
      <g className="fill-surface">
        <ellipse cx="236" cy="262" rx="13" ry="3.500" transform="rotate(-14 236 262)" />
        <ellipse cx="452" cy="218" rx="16" ry="4" transform="rotate(-15 452 218)" />
        <ellipse cx="626" cy="170" rx="11" ry="3" transform="rotate(-17 626 170)" />
      </g>

      {/* Fire Island, with its inlets as gaps */}
      <path
        d="M250 310c130-38 300-82 440-122s160-56 210-74"
        fill="none"
        strokeWidth="4.500"
        strokeLinecap="round"
        strokeDasharray="230 7 300 9 400"
        className="stroke-surface"
      />
    </svg>
  );
}
