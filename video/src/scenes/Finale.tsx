import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import { Clip } from "../components/Clip";
import { Flash, Shake, Streaks } from "../components/Fx";
import { Caption, Center } from "../components/Layout";
import { Logo } from "../components/Logo";
import { Kicker, Slam } from "../components/Type";
import { business } from "../data";
import { BAR_SECONDS, BEAT, END, FINAL_HIT, SILENCE, within } from "../timing";
import { color, font } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const t = within(18);

// Bars 18-21.5. "Book online" over the car at the sea; it pulls off and rushes into the lens
// until the frame is black (AI transition), right as the track goes silent. On the hit after
// the silence: the logo, the address and the phone over the car launching away in smoke.
export const Finale: React.FC = () => {
  const rush = 18.8;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Sequence durationInFrames={t(rush - 18)}>
        {/* approach ends at 4.0 s, the first frame of the rush transition */}
        <Clip name="approach" from={4 - (rush - 18) * BAR_SECONDS} brightness={0.65} shade={0.92} push={0.06} />
        <Caption gap={26}>
          <Slam size={116}>Book online.</Slam>
          <Typed delay={BEAT * 0.5} text={business.domain} size={50} />
        </Caption>
      </Sequence>
      <Sequence from={t(rush - 18)} durationInFrames={t(SILENCE - 18) - t(rush - 18)}>
        <Clip name="tr-into-camera" rate={3 / ((t(SILENCE - 18) - t(rush - 18)) / 30)} brightness={0.85} shade={0.3} push={0} />
      </Sequence>
      <Sequence from={t(FINAL_HIT - 18)} durationInFrames={t(END - 18) - t(FINAL_HIT - 18)}>
        <End />
      </Sequence>
    </AbsoluteFill>
  );
};

const End: React.FC = () => {
  const frame = useCurrentFrame();
  const length = within(FINAL_HIT)(END - FINAL_HIT);
  const fade = interpolate(frame, [length - 14, length - 1], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: color.night }}>
      <Clip name="drive-away" from={0.7} brightness={0.5} shade={0.5} push={0.05} />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 42%, rgba(15,32,53,0.75) 0%, rgba(5,11,22,0.2) 70%)` }} />
      <Streaks count={8} seed="outro" opacity={0.7} />
      <Shake hits={[0]} strength={30}>
        <Center gap={30} style={{ paddingBottom: 260 }}>
          <Logo width={860} stagger={BEAT / 3} />
          <Sequence from={10} layout="none">
            <Kicker size={28} color={color.sky}>
              {business.tagline}
            </Kicker>
          </Sequence>
          <Sequence from={Math.round(BEAT * 2)} layout="none">
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginTop: 30 }}>
              <Pill>{business.domain}</Pill>
              <Kicker size={44} color={color.white} delay={6}>
                {business.phone}
              </Kicker>
            </div>
          </Sequence>
        </Center>
      </Shake>
      <Flash length={12} />
      <AbsoluteFill style={{ backgroundColor: "#000", opacity: fade }} />
    </AbsoluteFill>
  );
};

const Pill: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, 8], [0, 1], clamp);
  return (
    <div
      style={{
        fontFamily: font.display,
        fontWeight: 800,
        fontSize: 52,
        color: color.white,
        backgroundColor: color.brandDeep,
        padding: "18px 46px",
        borderRadius: 999,
        boxShadow: "0 10px 50px rgba(5,102,251,0.55)",
        opacity: p,
        transform: `scale(${0.85 + 0.15 * p})`,
      }}
    >
      {children}
    </div>
  );
};

const Typed: React.FC<{ text: string; delay: number; size: number }> = ({ text, delay, size }) => {
  const frame = useCurrentFrame() - delay;
  const shown = Math.max(0, Math.min(text.length, Math.floor(frame / 1.2)));
  const caret = Math.floor(frame / 8) % 2 === 0;
  return (
    <div
      style={{
        fontFamily: font.display,
        fontWeight: 800,
        fontSize: size,
        color: color.white,
        backgroundColor: color.brandDeep,
        padding: "16px 40px",
        borderRadius: 999,
        opacity: frame < 0 ? 0 : 1,
        boxShadow: "0 10px 50px rgba(5,102,251,0.55)",
        whiteSpace: "pre",
      }}
    >
      {text.slice(0, shown)}
      <span style={{ opacity: caret ? 1 : 0 }}>|</span>
      <span style={{ opacity: 0 }}>{text.slice(shown)}</span>
    </div>
  );
};
