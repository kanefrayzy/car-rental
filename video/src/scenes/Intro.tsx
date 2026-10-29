import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import { Clip, Ramp, rampEnd, Spliced } from "../components/Clip";
import { Flash, Shake, Streaks } from "../components/Fx";
import { Caption, Center } from "../components/Layout";
import { Kicker, Rise, Slam } from "../components/Type";
import { business } from "../data";
import { within } from "../timing";
import { color, useLayout } from "../theme";

// Bars 0-4, the track's quiet intro. The headlight wakes and the camera rushes at it, dives
// through its light into the cabin (AI transition), the gauges glow; then a hard cut to the
// rear wheel, which breaks loose and drops into slow motion while the track goes silent.
const t = within(0);

// The headlight: real time until it is lit, then fast forward into the transition, whose
// first frame is this clip at 5.6 s.
const lightOn = t(0.6);
const headlight = [
  { frames: lightOn, rate: 1 },
  { frames: t(1) - lightOn, rate: (5.6 - rampEnd(0.5, [{ frames: lightOn, rate: 1 }])) / ((t(1) - lightOn) / 30) },
];

// The burnout: real time, then slow motion through the track's silence (bar 3.34-3.96).
const burnoutFrom = 0.9;
const burnout = [
  { frames: t(3.34) - t(3), rate: 1 },
  { frames: t(3.96) - t(3.34), rate: 0.25 },
  { frames: t(4) - t(3.96), rate: 1 },
];
/** Where the drop picks the burnout up. */
export const burnoutContinues = rampEnd(burnoutFrom, burnout);

export const Intro: React.FC = () => {
  const { width: W } = useLayout();
  const big = 132;
  return (
    <AbsoluteFill style={{ backgroundColor: color.night }}>
      <Sequence durationInFrames={t(1)}>
        <Ramp name="headlight" from={0.5} segments={headlight} brightness={0.8} shade={0.7} push={0.04} />
        <FadeFromBlack length={14} />
        <Streaks count={6} seed="intro" opacity={0.6} />
        <Center gap={26} style={{ paddingTop: 700 }}>
          <Kicker delay={6} size={34} color={color.white}>
            {business.city.split(",")[0]} · {business.region}
          </Kicker>
          <Line delay={12} width={W * 0.18} />
        </Center>
      </Sequence>

      <Sequence from={t(1)} durationInFrames={t(2) - t(1)}>
        <Spliced name="tr-headlight-interior2" parts={[[0, 1.1], [2, 3]]} duration={t(2) - t(1)} brightness={0.85} shade={0.5} push={0} />
      </Sequence>

      <Sequence from={t(2)} durationInFrames={t(3) - t(2)}>
        <Clip name="interior2" from={0} brightness={0.85} push={0.04} />
        <Caption gap={4}>
          <Rise size={big * 0.8} weight={600} delay={4}>
            Some cars
          </Rise>
          <Rise size={big * 0.8} weight={600} delay={4 + 13} color={color.sky}>
            get you there.
          </Rise>
        </Caption>
      </Sequence>

      <Sequence from={t(3)} durationInFrames={t(4) - t(3)}>
        <Shake hits={[0]} strength={14}>
          <Ramp name="rear-burnout" from={burnoutFrom} segments={burnout} brightness={0.8} shade={0.75} push={0.1} />
        </Shake>
        <Flash length={5} strength={0.6} />
        <Caption gap={2}>
          <Rise size={big * 0.8} weight={600}>
            This one makes
          </Rise>
          <Slam delay={t(3.34) - t(3)} size={118} color={color.brand}>
            an entrance.
          </Slam>
        </Caption>
      </Sequence>
    </AbsoluteFill>
  );
};

const FadeFromBlack: React.FC<{ length: number }> = ({ length }) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ backgroundColor: "#000", opacity: interpolate(frame, [0, length], [1, 0], { extrapolateRight: "clamp" }) }} />;
};

const Line: React.FC<{ delay: number; width: number }> = ({ delay, width }) => {
  const frame = useCurrentFrame() - delay;
  const p = interpolate(frame, [0, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <div style={{ width: width * p, height: 4, borderRadius: 2, backgroundColor: color.brand, boxShadow: `0 0 24px ${color.brand}` }} />;
};
