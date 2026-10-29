import { AbsoluteFill, Sequence } from "remotion";
import { Clip, type ClipName } from "../components/Clip";
import { Flash, Shake, Streaks } from "../components/Fx";
import { Caption, Center, fit } from "../components/Layout";
import { Punch } from "../components/Transitions";
import { Kicker, Slam } from "../components/Type";
import { occasionTitles } from "../data";
import { within } from "../timing";
import { color, useLayout } from "../theme";

// Bars 14-16: the occasions from the site, one a beat, each over a different clip with a
// punch-in; then a blue card on the last two beats.
const t = within(14);
const backdrops: { clip: ClipName; at: number }[] = [
  { clip: "studio", at: 2.5 },
  { clip: "wheel", at: 1.6 },
  { clip: "headlight", at: 2.2 },
  { clip: "interior2", at: 2.5 },
  { clip: "approach", at: 3.7 },
  { clip: "rear-burnout", at: 3.5 },
];

export const Occasions: React.FC = () => {
  const { width: W } = useLayout();
  const titles = occasionTitles.slice(0, 6);
  return (
    <AbsoluteFill>
      {titles.map((title, i) => {
        const b = backdrops[i % backdrops.length];
        return (
          <Sequence key={title} from={t(0, i)} durationInFrames={t(0, i + 1) - t(0, i)}>
            <Punch amount={0.12}>
              <Clip name={b.clip} from={b.at} brightness={0.65} shade={0.9} push={0.1} />
            </Punch>
            <Flash length={4} strength={0.3} />
            <Caption>
              <Slam size={fit(title, 132, W * 0.86)}>{title}</Slam>
            </Caption>
          </Sequence>
        );
      })}
      <Sequence durationInFrames={t(0, titles.length)}>
        <Caption lift={0.11}>
          <Kicker size={34} color={color.white}>
            Book it for
          </Kicker>
        </Caption>
      </Sequence>
      <Sequence from={t(0, titles.length)}>
        <AbsoluteFill style={{ background: `linear-gradient(150deg, ${color.brand}, ${color.brandDeep} 45%, ${color.navy})` }} />
        <Streaks count={8} seed="occasions" opacity={0.7} />
        <Shake hits={[0]} strength={18}>
          <Center gap={8}>
            <Slam size={150}>Any</Slam>
            <Slam delay={t(0, titles.length + 1) - t(0, titles.length)} size={150} color={color.night}>
              occasion.
            </Slam>
          </Center>
        </Shake>
        <Flash length={6} strength={0.6} />
      </Sequence>
    </AbsoluteFill>
  );
};
