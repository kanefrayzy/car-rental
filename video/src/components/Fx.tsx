import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from "remotion";
import { color, useLayout } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** White flash that fades over `length` frames. Put it in a Sequence at the hit. */
export const Flash: React.FC<{ length?: number; strength?: number; tint?: string }> = ({
  length = 8,
  strength = 1,
  tint = color.white,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, length], [strength, 0], { ...clamp, easing: Easing.out(Easing.quad) });
  return <AbsoluteFill style={{ backgroundColor: tint, opacity }} />;
};

/** Shakes its children after each hit; `strength` in pixels. */
export const Shake: React.FC<{ hits: number[]; strength?: number; children: React.ReactNode }> = ({
  hits,
  strength = 26,
  children,
}) => {
  const frame = useCurrentFrame();
  let x = 0;
  let y = 0;
  let s = 1;
  for (const hit of hits) {
    const t = frame - hit;
    if (t < 0 || t > 24) continue;
    const amp = strength * Math.exp(-t / 5);
    x += (random(`x${hit}-${frame}`) - 0.5) * 2 * amp;
    y += (random(`y${hit}-${frame}`) - 0.5) * 2 * amp;
    s += 0.06 * Math.exp(-t / 4);
  }
  return <AbsoluteFill style={{ transform: `translate(${x}px, ${y}px) scale(${s})` }}>{children}</AbsoluteFill>;
};

/** Thin blue light streaks racing across, like the site's backgrounds. */
export const Streaks: React.FC<{ count?: number; seed?: string; opacity?: number }> = ({
  count = 7,
  seed = "streaks",
  opacity = 1,
}) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useLayout();
  return (
    <AbsoluteFill style={{ opacity, overflow: "hidden" }}>
      {Array.from({ length: count }, (_, i) => {
        const r = (k: string) => random(`${seed}-${i}-${k}`);
        const speed = 30 + r("v") * 50;
        const len = W * (0.25 + r("l") * 0.5);
        const span = W + len * 2;
        const x = ((frame * speed + r("o") * span) % span) - len;
        const y = H * (0.1 + r("y") * 0.8);
        const thick = 2 + r("t") * 4;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: len,
              height: thick,
              borderRadius: thick,
              transform: "rotate(-8deg)",
              background: `linear-gradient(to right, rgba(10,122,255,0), ${i % 3 ? color.brand : color.sky})`,
              boxShadow: `0 0 ${thick * 6}px ${color.brand}`,
              opacity: 0.35 + r("a") * 0.5,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Horizontal speed lines for the 0-60 shot. */
export const SpeedLines: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useLayout();
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {Array.from({ length: 26 }, (_, i) => {
        const r = (k: string) => random(`speed-${i}-${k}`);
        const len = W * (0.2 + r("l") * 0.4);
        const span = W + len;
        const x = W - ((frame * (90 + r("v") * 80) + r("o") * span) % span);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: H * r("y"),
              width: len,
              height: 1 + r("t") * 3,
              background: "linear-gradient(to right, rgba(255,255,255,0.75), rgba(255,255,255,0))",
              opacity: 0.25 + r("a") * 0.45,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
