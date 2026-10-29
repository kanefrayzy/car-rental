import { AbsoluteFill, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { color } from "../theme";
import { Flash } from "./Fx";

// The generated footage (scripts/runware-video.mjs), all 9:16. Clips: Hailuo 2.3 Fast, 6 s.
// Transitions (tr-*): Kling 3.0 with a first and a last frame, 3 s. Where a model starts to
// invent parts of the car it never saw, the clip is unusable: `usable` is the last good second.
export const CLIPS = {
  approach: { usable: 4.3 }, // a badge appears on the fender after 4.4 s
  headlight: { usable: 5.8 },
  wheel: { usable: 5.8 },
  taillights: { usable: 5.8 },
  // The first interior clip (Hailuo) had wobbling gauges; this one is Kling 3.0 from a still
  // made after the client's interior photos (design/generated/car-interior-vertical.jpg).
  interior2: { usable: 5 },
  "tr-headlight-interior2": { usable: 3 }, // 1.1-2.0 s: the camera swings past a warped door
  "tr-red-light2": { usable: 3 }, // 0.9-2.1 s: a tail light smears onto the side
  front: { usable: 2.2 }, // the bumper melts after that
  studio: { usable: 5.8 },
  "rear-burnout": { usable: 5.8 },
  "drive-away": { usable: 5.8 },
  "tr-smoke-studio": { usable: 3 },
  "tr-into-camera": { usable: 3 },
};
export type ClipName = keyof typeof CLIPS;

type Look = {
  brightness?: number;
  /** 0..1: navy gradient at the bottom, under the text. */
  shade?: number;
  /** Slow push-in, as a fraction (0.06 = 6%) over two seconds. */
  push?: number;
};

const Grade: React.FC<Look & { children: React.ReactNode }> = ({ shade = 0.8, push = 0.05, children }) => {
  const frame = useCurrentFrame();
  const scale = 1 + push * interpolate(frame, [0, 60], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: color.night }}>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>{children}</AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `linear-gradient(to top, rgba(5,11,22,${shade}) 0%, rgba(5,11,22,${shade * 0.55}) 32%, rgba(5,11,22,0) 62%), radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(5,11,22,0.5) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

const Video: React.FC<{ name: ClipName; from: number; rate: number; brightness: number }> = ({ name, from, rate, brightness }) => {
  const { fps } = useVideoConfig();
  return (
    <OffthreadVideo
      src={staticFile(`clips/${name}.mp4`)}
      startFrom={Math.round(from * fps)}
      playbackRate={rate}
      muted
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        filter: `brightness(${brightness}) contrast(1.12) saturate(1.08)`,
      }}
    />
  );
};

/** One clip from second `from`, at `rate`. */
export const Clip: React.FC<Look & { name: ClipName; from?: number; rate?: number }> = ({
  name,
  from = 0,
  rate = 1,
  brightness = 0.85,
  ...look
}) => (
  <Grade {...look}>
    <Video name={name} from={from} rate={rate} brightness={brightness} />
  </Grade>
);

/**
 * Speed ramp: the clip plays through `segments` back to back, each at its own rate, and
 * picks up exactly where the previous segment left it.
 */
export const Ramp: React.FC<Look & { name: ClipName; from: number; segments: { frames: number; rate: number }[] }> = ({
  name,
  from,
  segments,
  brightness = 0.85,
  ...look
}) => {
  const { fps } = useVideoConfig();
  let start = 0;
  let clipTime = from;
  return (
    <Grade {...look}>
      {segments.map((s, i) => {
        const node = (
          <Sequence key={i} from={start} durationInFrames={s.frames} layout="absolute-fill">
            <Video name={name} from={clipTime} rate={s.rate} brightness={brightness} />
          </Sequence>
        );
        start += s.frames;
        clipTime += (s.frames / fps) * s.rate;
        return node;
      })}
    </Grade>
  );
};

/**
 * Plays only the given parts of a clip ([from, to] seconds), sped up to fill `duration`
 * frames, with a flash over each joint. Used to cut the warped middle out of a transition.
 */
export const Spliced: React.FC<Look & { name: ClipName; parts: [number, number][]; duration: number; tint?: string }> = ({
  name,
  parts,
  duration,
  tint = color.white,
  brightness = 0.85,
  ...look
}) => {
  const { fps } = useVideoConfig();
  const total = parts.reduce((t, [a, b]) => t + b - a, 0);
  const rate = total / (duration / fps);
  let start = 0;
  return (
    <Grade {...look}>
      {parts.map(([a, b], i) => {
        const frames = i === parts.length - 1 ? duration - start : Math.round(((b - a) / rate) * fps);
        const node = (
          <Sequence key={i} from={start} durationInFrames={frames} layout="absolute-fill">
            <Video name={name} from={a} rate={rate} brightness={brightness} />
            {i > 0 && <Flash length={7} tint={tint} />}
          </Sequence>
        );
        start += frames;
        return node;
      })}
    </Grade>
  );
};

/** Where a ramp leaves the clip: `from` plus the time its segments play. */
export const rampEnd = (from: number, segments: { frames: number; rate: number }[], fps = 30) =>
  segments.reduce((t, s) => t + (s.frames / fps) * s.rate, from);
