import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Flash, Shake, Streaks } from "../components/Fx";
import { Center } from "../components/Layout";
import { Clip } from "../components/Clip";
import { Count, Kicker, Slam } from "../components/Type";
import { business, usd } from "../data";
import { BAR, BEAT } from "../timing";
import { color, font, useLayout } from "../theme";

// Bars 16-18: the day price counts up over the car rocking on its springs in slow motion; in
// the second bar the terms the client confirmed come in, one a beat.
export const Price: React.FC = () => {
  const { portrait } = useLayout();
  const size = portrait ? 290 : 280;
  const terms = [
    `${business.minAge}+ to drive`,
    `${usd(business.deposit)} deposit`,
    `${business.miles} miles a day included`,
  ];
  return (
    <AbsoluteFill>
      <Clip name="front" from={0} rate={0.6} brightness={0.6} shade={0.6} push={0.08} />
      <AbsoluteFill style={{ background: "linear-gradient(160deg, rgba(5,102,251,0.55) 0%, rgba(5,11,22,0.88) 70%)" }} />
      <Streaks count={6} seed="price" opacity={0.6} />
      <Shake hits={[0]} strength={28}>
        <Center gap={0} style={{ paddingBottom: portrait ? 160 : 0 }}>
          <Kicker size={portrait ? 34 : 30} color={color.white}>
            Rent it for
          </Kicker>
          <Slam size={size} style={{ lineHeight: 1 }}>
            <Count value={business.price} prefix="$" length={18} />
          </Slam>
          <div style={{ display: "flex", gap: 18, alignItems: "baseline", marginTop: 4 }}>
            <Kicker size={portrait ? 40 : 36} color={color.brand} delay={8}>
              per day
            </Kicker>
            <Kicker size={portrait ? 26 : 24} color={color.sky} delay={14}>
              plus tax
            </Kicker>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: portrait ? "column" : "row",
              gap: portrait ? 16 : 22,
              marginTop: portrait ? 64 : 54,
              alignItems: "center",
            }}
          >
            {terms.map((term, i) => (
              <Chip key={term} delay={BAR + i * BEAT} portrait={portrait}>
                {term}
              </Chip>
            ))}
          </div>
        </Center>
      </Shake>
      <Flash length={10} />
    </AbsoluteFill>
  );
};

const Chip: React.FC<{ delay: number; portrait: boolean; children: React.ReactNode }> = ({ delay, portrait, children }) => {
  const frame = useCurrentFrame() - delay;
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 16, stiffness: 260, mass: 0.5 } });
  return (
    <div
      style={{
        fontFamily: font.body,
        fontWeight: 700,
        fontSize: portrait ? 46 : 34,
        color: color.white,
        padding: portrait ? "16px 34px" : "14px 28px",
        borderRadius: 999,
        border: `2px solid ${color.brand}`,
        backgroundColor: "rgba(5,11,22,0.55)",
        boxShadow: `0 0 30px rgba(10,122,255,0.35)`,
        opacity: interpolate(frame, [0, 3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        transform: `translateY(${(1 - s) * 40}px) scale(${0.9 + 0.1 * s})`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
};
