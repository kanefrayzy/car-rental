import { AbsoluteFill, Sequence } from "remotion";
import { Clip, Spliced } from "../components/Clip";
import { Flash } from "../components/Fx";
import { Caption } from "../components/Layout";
import { Kicker, Rise } from "../components/Type";
import { name, seats } from "../data";
import { BEAT, within } from "../timing";
import { color } from "../theme";

// Bars 10-14. The burnout smoke fills the frame and clears into the studio (AI transition),
// where the full name comes in a line a beat; then the tail lights flood the frame red and
// the red turns into the leather inside (AI transition).
const t = within(10);
const rate = (from: number, to: number) => 3 / ((t(to) - t(from)) / 30); // a 3 s transition over that span

export const Model: React.FC = () => (
  <AbsoluteFill>
    <Sequence durationInFrames={t(1)}>
      <Clip name="tr-smoke-studio" rate={rate(0, 1)} brightness={0.85} push={0} />
    </Sequence>
    <Sequence from={t(1)} durationInFrames={t(2) - t(1)}>
      <Clip name="studio" from={0} brightness={0.85} push={0.06} />
    </Sequence>
    <Sequence from={t(0.55)} durationInFrames={t(2) - t(0.55)}>
      <Caption gap={6}>
        <Kicker size={34}>{name.year}</Kicker>
        <Rise delay={t(1) - t(0.55)} size={92} weight={600}>
          {name.model}
        </Rise>
        <Rise delay={t(1, 1) - t(0.55)} size={128} italic color={color.brand}>
          {name.line1}
        </Rise>
        {name.line2 && (
          <Rise delay={t(1, 2) - t(0.55)} size={84}>
            {name.line2}
          </Rise>
        )}
      </Caption>
    </Sequence>

    <Sequence from={t(2)} durationInFrames={t(3) - t(2)}>
      <Spliced name="tr-red-light2" parts={[[0, 0.9], [2.1, 3]]} duration={t(3) - t(2)} tint="#ff1e2d" brightness={0.85} shade={0.4} push={0} />
      <Flash length={5} strength={0.5} />
    </Sequence>
    <Sequence from={t(3)} durationInFrames={t(4) - t(3)}>
      {/* the red transition ends on interior2 at 4.0 s; slowed down so it lasts the bar */}
      <Clip name="interior2" from={4} rate={0.55} brightness={0.85} push={0.04} />
      <Caption gap={4}>
        <Rise size={120}>Red leather</Rise>
        <Rise delay={BEAT} size={120} italic color={color.brand}>
          inside.
        </Rise>
        <Kicker delay={BEAT * 2} size={32} style={{ marginTop: 18 }}>
          {seats}
        </Kicker>
      </Caption>
    </Sequence>
  </AbsoluteFill>
);
