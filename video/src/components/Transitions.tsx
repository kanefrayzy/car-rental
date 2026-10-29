import { useId } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { logoAspect, logoPaths, logoViewBox } from "../../../frontend/components/ui/logoPaths";
import { color, useLayout } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const [VX, VY, VW] = logoViewBox.split(" ").map(Number);
// The thickest point inside the letters (in logo units), measured on a raster of the logo:
// the camera flies into it, so the letter grows over the whole frame without a gap.
const CORE = { x: 1287, y: 921 };

/**
 * The logo in the middle of the frame. From `fill`, the next shot (`children`) shows through
 * the letters; from `fly`, the camera rushes into a letter until the shot fills the frame.
 * Frames are local to the parent Sequence.
 */
export const LogoPortal: React.FC<{
  width: number;
  centerY: number;
  fill: number;
  fly: number;
  end: number;
  children: React.ReactNode;
}> = ({ width, centerY, fill, fly, end, children }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useLayout();
  if (frame < fill) return null;
  const h = width / logoAspect;
  const left = W / 2 - width / 2;
  const top = centerY - h / 2;
  const k = width / VW;
  const px = left + (CORE.x - VX) * k;
  const py = top + (CORE.y - VY) * k;
  const zoom = interpolate(frame, [fly, end], [1, 60], { ...clamp, easing: Easing.in(Easing.exp) });
  const shot = interpolate(frame, [fill, fill + 6], [0, 1], clamp);
  const transform = `translate(${px} ${py}) scale(${zoom}) translate(${-px} ${-py}) translate(${left} ${top}) scale(${k}) translate(${-VX} ${-VY})`;
  // A CSS mask made of the same letters (a clip-path pointing at inline SVG did not render).
  const mask = `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><g transform="${transform}">${logoPaths
      .map((p) => `<path fill="#fff" fill-rule="evenodd" d="${p.d}"/>`)
      .join("")}</g></svg>`,
  )}")`;
  return (
    <AbsoluteFill>
      {/* Solid letters under the shot, so the logo never blinks while the shot fades in. */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <g transform={transform}>
          {logoPaths.map((p, i) => (
            <path key={i} d={p.d} fillRule="evenodd" fill={p.accent ? color.brand : color.white} />
          ))}
        </g>
      </svg>
      <AbsoluteFill
        style={{ maskImage: mask, WebkitMaskImage: mask, maskSize: "100% 100%", WebkitMaskSize: "100% 100%", maskRepeat: "no-repeat", opacity: shot }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * Whip pan around a cut: the shot arrives from the right and leaves to the left, smeared
 * sideways, over `length` frames at each end of its Sequence (`duration` frames long).
 */
export const Whip: React.FC<{ duration: number; length?: number; enter?: boolean; exit?: boolean; children: React.ReactNode }> = ({
  duration,
  length = 5,
  enter = true,
  exit = true,
  children,
}) => {
  const frame = useCurrentFrame();
  const { width: W } = useLayout();
  const id = `whip${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const inP = enter ? interpolate(frame, [0, length], [1, 0], { ...clamp, easing: Easing.out(Easing.cubic) }) : 0;
  const outP = exit ? interpolate(frame, [duration - length, duration], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) }) : 0;
  const x = inP * W * 0.7 - outP * W * 0.7;
  const blur = Math.max(inP, outP) * 70;
  return (
    <AbsoluteFill>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <filter id={id} x="-20%" y="0" width="140%" height="100%">
          <feGaussianBlur stdDeviation={`${blur} 0`} />
        </filter>
      </svg>
      <AbsoluteFill style={{ transform: `translateX(${x}px)`, filter: blur > 0.5 ? `url(#${id})` : undefined }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

/** A punch-in on the beat: the frame jumps closer and settles back. */
export const Punch: React.FC<{ at?: number; amount?: number; children: React.ReactNode }> = ({ at = 0, amount = 0.1, children }) => {
  const frame = useCurrentFrame() - at;
  const s = frame < 0 ? 1 : 1 + amount * Math.exp(-frame / 3.5);
  return <AbsoluteFill style={{ transform: `scale(${s})` }}>{children}</AbsoluteFill>;
};
