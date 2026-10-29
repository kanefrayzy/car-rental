import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { logoPaths, logoViewBox } from "../../../frontend/components/ui/logoPaths";
import { color } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * The approved logo (paths from scripts/brand.mjs), white and blue for dark backgrounds.
 * Animated, BUENO's letters slam in one by one from the left, then EXOTICS slides in.
 */
export const Logo: React.FC<{ width: number; animate?: boolean; delay?: number; stagger?: number }> = ({
  width,
  animate = true,
  delay = 0,
  stagger = 3,
}) => {
  const frame = useCurrentFrame() - delay;
  const { fps } = useVideoConfig();
  let letter = 0;
  let accent = 0;
  return (
    <svg viewBox={logoViewBox} style={{ width, height: "auto", overflow: "visible", display: "block" }}>
      {logoPaths.map((path, i) => {
        let transform = "none";
        let opacity = 1;
        if (animate) {
          if (!path.accent) {
            const t = frame - letter++ * stagger;
            const s = spring({ frame: t, fps, config: { damping: 14, stiffness: 380, mass: 0.5 } });
            transform = `translateX(${(1 - s) * -160}px) skewX(${(1 - s) * -20}deg) scale(${1 + (1 - s) * 0.4})`;
            opacity = interpolate(t, [0, 2], [0, 1], clamp);
          } else {
            const t = frame - 5 * stagger - 2 - accent++;
            const s = spring({ frame: t, fps, config: { damping: 18, stiffness: 260, mass: 0.5 } });
            transform = `translateX(${(1 - s) * 220}px)`;
            opacity = interpolate(t, [0, 3], [0, 1], clamp);
          }
        }
        return (
          <path
            key={i}
            d={path.d}
            fillRule="evenodd"
            fill={path.accent ? color.brand : color.white}
            style={{ transform, transformBox: "fill-box", transformOrigin: "center", opacity }}
          />
        );
      })}
    </svg>
  );
};
