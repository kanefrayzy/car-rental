import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { color, font } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

type Base = { delay?: number; size: number; color?: string; style?: React.CSSProperties; children: React.ReactNode };

/** Big slanted headline that slams in: oversized and blurred, then snaps into place. */
export const Slam: React.FC<Base & { italic?: boolean }> = ({
  delay = 0,
  size,
  color: c = color.white,
  style,
  italic = true,
  children,
}) => {
  const frame = useCurrentFrame() - delay;
  const { fps } = useVideoConfig();
  if (frame < 0) return null;
  const s = spring({ frame, fps, config: { damping: 15, stiffness: 320, mass: 0.5 } });
  const scale = interpolate(s, [0, 1], [1.45, 1]);
  const blur = interpolate(frame, [0, 4], [14, 0], clamp);
  // RGB split that snaps back: red and blue ghosts either side for the first few frames.
  const split = 16 * Math.exp(-frame / 2.5);
  return (
    <div
      style={{
        fontFamily: font.display,
        fontWeight: 800,
        fontStyle: italic ? "italic" : "normal",
        fontSize: size,
        lineHeight: 0.92,
        letterSpacing: "-0.02em",
        textTransform: "uppercase",
        color: c,
        opacity: interpolate(frame, [0, 2], [0, 1], clamp),
        transform: `scale(${scale})`,
        filter: blur > 0.1 ? `blur(${blur}px)` : undefined,
        textShadow: `${split}px 0 rgba(255,30,70,${split > 0.5 ? 0.85 : 0}), ${-split}px 0 rgba(10,122,255,${split > 0.5 ? 0.85 : 0}), 0 8px 40px rgba(0,0,0,0.45)`,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** A line that rises out of a mask. */
export const Rise: React.FC<Base & { weight?: number; italic?: boolean }> = ({
  delay = 0,
  size,
  color: c = color.white,
  style,
  weight = 800,
  italic = false,
  children,
}) => {
  const frame = useCurrentFrame() - delay;
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 18, stiffness: 200, mass: 0.6 } });
  return (
    <div style={{ overflow: "hidden", padding: "0.08em 0.12em", margin: "-0.08em -0.12em", ...style }}>
      <div
        style={{
          fontFamily: font.display,
          fontWeight: weight,
          fontStyle: italic ? "italic" : "normal",
          fontSize: size,
          lineHeight: 1.02,
          letterSpacing: "-0.02em",
          color: c,
          transform: `translateY(${(1 - s) * 110}%)`,
          whiteSpace: "nowrap",
          textShadow: "0 6px 30px rgba(0,0,0,0.4)",
        }}
      >
        {children}
      </div>
    </div>
  );
};

/** Small spaced capitals above a headline. The spacing tightens as it fades in. */
export const Kicker: React.FC<Base> = ({ delay = 0, size, color: c = color.sky, style, children }) => {
  const frame = useCurrentFrame() - delay;
  const p = interpolate(frame, [0, 14], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <div
      style={{
        fontFamily: font.body,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: `${0.5 - 0.22 * p}em`,
        textTransform: "uppercase",
        color: c,
        opacity: p,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** A number that counts up to `value` over `length` frames. */
export const Count: React.FC<{ value: number; decimals?: number; delay?: number; length?: number; prefix?: string }> = ({
  value,
  decimals = 0,
  delay = 0,
  length = 16,
  prefix = "",
}) => {
  const frame = useCurrentFrame() - delay;
  const p = interpolate(frame, [0, length], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const n = value * p;
  const text = decimals ? n.toFixed(decimals) : Math.round(n).toLocaleString("en-US");
  return (
    <span style={{ fontVariantNumeric: "tabular-nums" }}>
      {prefix}
      {text}
    </span>
  );
};
