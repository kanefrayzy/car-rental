import { AbsoluteFill, Sequence } from "remotion";
import { Clip, type ClipName } from "../components/Clip";
import { SpeedLines } from "../components/Fx";
import { Caption } from "../components/Layout";
import { Punch, Whip } from "../components/Transitions";
import { Count, Kicker, Slam } from "../components/Type";
import { specs } from "../data";
import { BAR_SECONDS, within } from "../timing";
import { color, font } from "../theme";

// Bars 6-10: one figure a bar, whip pans between them. 0-60 comes last: its clip ends on the
// frame the smoke transition starts from (wheel at 4.0 s).
const t = within(6);
const order = [0, 1, 3, 2]; // horsepower, torque, top speed, 0-60 (data.ts order: hp, torque, 0-60, top speed)
const shots: { clip: ClipName; at: number; speed?: boolean }[] = [
  { clip: "headlight", at: 3.4 }, // lit headlight, pushing in
  { clip: "taillights", at: 3 }, // exhaust smoke
  { clip: "approach", at: 4.3 - BAR_SECONDS }, // starts rolling at the camera
  { clip: "wheel", at: 4 - BAR_SECONDS, speed: true }, // pulling away in smoke
];
export const firstSpecShot = shots[0];

export const Specs: React.FC = () => {
  const size = 300;
  return (
    <AbsoluteFill>
      {order.map((index, i) => {
        const spec = specs[index];
        const shot = shots[i];
        const length = t(i + 1) - t(i);
        return (
          <Sequence key={spec.label} from={t(i)} durationInFrames={length}>
            <Whip duration={length} enter={i > 0} exit={i < 3}>
              <Punch amount={i === 0 ? 0 : 0.08}>
                <Clip name={shot.clip} from={shot.at} brightness={0.75} push={0.07} />
                {shot.speed && <SpeedLines />}
              </Punch>
              <Caption gap={0}>
                <Kicker size={34} delay={1}>
                  {spec.label}
                </Kicker>
                <Slam size={size} style={{ display: "flex", alignItems: "baseline", gap: size * 0.08, lineHeight: 1 }}>
                  <Count value={spec.value} decimals={spec.decimals} length={16} />
                  <span style={{ fontSize: size * 0.3, color: color.brand, fontFamily: font.display }}>{spec.unit}</span>
                </Slam>
              </Caption>
            </Whip>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
